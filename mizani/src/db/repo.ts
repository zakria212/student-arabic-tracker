import { db } from './db';
import { DEFAULT_CATEGORIES, DEFAULT_SECTIONS } from './defaults';
import {
  DEFAULT_SETTINGS, type Category, type Debt, type DebtDirection, type DebtPayment, type PaymentMethod, type Receipt, type Section,
  type Settings, type Transaction, type TransactionType,
} from './types';
import { newId, nowISO } from '../lib/ids';
import { isValidISODate } from '../lib/dates';
import { MAX_AMOUNT_MINOR } from '../lib/money';

export const MAX_RECEIPTS_PER_TRANSACTION = 3;

export class ValidationError extends Error {}

// ───────────── الإعدادات ─────────────

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'key'>>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, key: 'app' });
}

// ───────────── الحركات ─────────────

export type TransactionInput = {
  id?: string;
  type: TransactionType;
  amountMinor: number;
  details: string;
  categoryId: string;
  date: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  sectionId?: string;
};

export type NewReceipt = { filename: string; mimeType: string; data: ArrayBuffer };

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function cleanInput(input: TransactionInput) {
  const details = input.details.trim();
  const notes = input.notes?.trim() || undefined;
  if (!(input.type === 'income' || input.type === 'expense')) throw new ValidationError('نوع الحركة غير صالح');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > MAX_AMOUNT_MINOR) {
    throw new ValidationError('المبلغ يجب أن يكون أكبر من صفر');
  }
  if (!details) throw new ValidationError(input.type === 'expense' ? 'اكتب سبب الصرف' : 'اكتب مصدر المبلغ');
  if (!isValidISODate(input.date)) throw new ValidationError('التاريخ غير صالح');
  return { details, notes };
}

/**
 * يحفظ حركة جديدة أو يعدّل حركة قائمة مع مرفقاتها في معاملة واحدة ذرّية.
 */
export async function saveTransaction(
  input: TransactionInput,
  newReceipts: NewReceipt[] = [],
  removeReceiptIds: string[] = [],
): Promise<string> {
  const { details, notes } = cleanInput(input);
  for (const r of newReceipts) {
    if (!ALLOWED_IMAGE_TYPES.includes(r.mimeType)) throw new ValidationError('نوع الصورة غير مدعوم');
  }

  return db.transaction('rw', [db.transactions, db.receipts, db.categories, db.sections], async () => {
    const category = await db.categories.get(input.categoryId);
    if (!category || category.type !== input.type) throw new ValidationError('اختر تصنيفًا مناسبًا');
    const sectionId = input.sectionId || undefined;
    if (sectionId && !(await db.sections.get(sectionId))) throw new ValidationError('القسم المختار غير موجود');

    const now = nowISO();
    const existing = input.id ? await db.transactions.get(input.id) : undefined;
    const id = existing?.id ?? input.id ?? newId();

    const existingReceipts = existing ? await db.receipts.where('transactionId').equals(id).primaryKeys() : [];
    const keep = existingReceipts.filter((rid) => !removeReceiptIds.includes(rid));
    if (keep.length + newReceipts.length > MAX_RECEIPTS_PER_TRANSACTION) {
      throw new ValidationError(`الحد الأقصى ${MAX_RECEIPTS_PER_TRANSACTION} صور لكل حركة`);
    }

    const tx: Transaction = {
      id,
      type: input.type,
      amountMinor: input.amountMinor,
      details,
      categoryId: input.categoryId,
      date: input.date,
      notes,
      paymentMethod: input.paymentMethod || undefined,
      sectionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.transactions.put(tx);

    const toRemove = existingReceipts.filter((rid) => removeReceiptIds.includes(rid));
    if (toRemove.length) await db.receipts.bulkDelete(toRemove);
    if (newReceipts.length) {
      await db.receipts.bulkAdd(
        newReceipts.map<Receipt>((r) => ({
          id: newId(),
          transactionId: id,
          filename: r.filename,
          mimeType: r.mimeType,
          size: r.data.byteLength,
          data: r.data,
          createdAt: now,
        })),
      );
    }
    return id;
  });
}

export type DeletedSnapshot = { transaction: Transaction; receipts: Receipt[] };

/** يحذف الحركة ومرفقاتها معًا، ويعيد نسخة تسمح بالتراجع */
export async function deleteTransaction(id: string): Promise<DeletedSnapshot | null> {
  return db.transaction('rw', db.transactions, db.receipts, async () => {
    const transaction = await db.transactions.get(id);
    if (!transaction) return null;
    const receipts = await db.receipts.where('transactionId').equals(id).toArray();
    await db.receipts.where('transactionId').equals(id).delete();
    await db.transactions.delete(id);
    return { transaction, receipts };
  });
}

/** التراجع عن الحذف: يعيد الحركة ومرفقاتها كما كانت */
export async function restoreTransaction(snapshot: DeletedSnapshot) {
  await db.transaction('rw', db.transactions, db.receipts, async () => {
    await db.transactions.put(snapshot.transaction);
    if (snapshot.receipts.length) await db.receipts.bulkPut(snapshot.receipts);
  });
}

export async function getReceiptsFor(transactionId: string) {
  return db.receipts.where('transactionId').equals(transactionId).toArray();
}

// ───────────── التصنيفات ─────────────

export type CategoryInput = { name: string; icon: string; color: string; type: TransactionType };

async function assertUniqueName(type: TransactionType, name: string, exceptId?: string) {
  const same = await db.categories
    .where('type')
    .equals(type)
    .filter((c) => c.name.trim() === name && c.id !== exceptId)
    .count();
  if (same) throw new ValidationError('يوجد تصنيف بالاسم نفسه');
}

export async function addCategory(input: CategoryInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('اكتب اسم التصنيف');
  if (name.length > 40) throw new ValidationError('اسم التصنيف طويل جدًا');
  await assertUniqueName(input.type, name);
  const max = await db.categories.orderBy('order').last();
  const id = newId();
  await db.categories.add({
    id,
    type: input.type,
    name,
    icon: input.icon,
    color: input.color,
    isDefault: false,
    isActive: true,
    order: (max?.order ?? 0) + 1,
  });
  return id;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'isActive'>>) {
  const cat = await db.categories.get(id);
  if (!cat) throw new ValidationError('التصنيف غير موجود');
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new ValidationError('اكتب اسم التصنيف');
    if (name.length > 40) throw new ValidationError('اسم التصنيف طويل جدًا');
    await assertUniqueName(cat.type, name, id);
    patch = { ...patch, name };
  }
  if (patch.isActive === false) {
    const activeSameType = await db.categories.where('type').equals(cat.type).filter((c) => c.isActive && c.id !== id).count();
    if (activeSameType === 0) throw new ValidationError('يجب أن يبقى تصنيف واحد مفعّل على الأقل');
  }
  await db.categories.update(id, patch);
}

export async function categoryUsage(id: string) {
  return db.transactions.where('categoryId').equals(id).count();
}

/** الحذف مسموح فقط لتصنيف غير مستخدم؛ وإلا يُعطَّل للحفاظ على السجل */
export async function deleteCategory(id: string) {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const used = await categoryUsage(id);
    if (used > 0) throw new ValidationError('هذا التصنيف مستخدم في حركات سابقة؛ يمكنك تعطيله بدل حذفه');
    const cat = await db.categories.get(id);
    if (!cat) return;
    const others = await db.categories.where('type').equals(cat.type).filter((c) => c.isActive && c.id !== id).count();
    if (others === 0) throw new ValidationError('يجب أن يبقى تصنيف واحد مفعّل على الأقل');
    await db.categories.delete(id);
  });
}

// ───────────── الأقسام ─────────────

export type SectionInput = { name: string; icon: string; color: string };

function cleanSectionName(raw: string) {
  const name = raw.trim();
  if (!name) throw new ValidationError('اكتب اسم القسم');
  if (name.length > 30) throw new ValidationError('اسم القسم طويل جدًا');
  return name;
}

async function assertUniqueSection(name: string, exceptId?: string) {
  const same = await db.sections.filter((x) => x.name.trim() === name && x.id !== exceptId).count();
  if (same) throw new ValidationError('يوجد قسم بالاسم نفسه');
}

export async function addSection(input: SectionInput): Promise<string> {
  const name = cleanSectionName(input.name);
  await assertUniqueSection(name);
  const last = await db.sections.orderBy('order').last();
  const id = newId();
  await db.sections.add({ id, name, icon: input.icon, color: input.color, isActive: true, order: (last?.order ?? 0) + 1 });
  return id;
}

export async function updateSection(id: string, patch: Partial<Pick<Section, 'name' | 'icon' | 'color' | 'isActive'>>) {
  if (!(await db.sections.get(id))) throw new ValidationError('القسم غير موجود');
  if (patch.name !== undefined) {
    const name = cleanSectionName(patch.name);
    await assertUniqueSection(name, id);
    patch = { ...patch, name };
  }
  await db.sections.update(id, patch);
}

export async function sectionUsage(id: string) {
  return db.transactions.where('sectionId').equals(id).count();
}

/** الحذف للقسم غير المستخدم فقط؛ المستخدم يُعطَّل حفاظًا على السجل */
export async function deleteSection(id: string) {
  await db.transaction('rw', db.sections, db.transactions, async () => {
    if ((await sectionUsage(id)) > 0) throw new ValidationError('هذا القسم مستخدم في حركات سابقة؛ يمكنك تعطيله بدل حذفه');
    await db.sections.delete(id);
  });
}

// ───────────── الديون ─────────────

export type DebtInput = {
  id?: string;
  direction: DebtDirection;
  person: string;
  amountMinor: number;
  date: string;
  dueDate?: string;
  notes?: string;
};

export async function saveDebt(input: DebtInput): Promise<string> {
  const person = input.person.trim();
  if (input.direction !== 'lent' && input.direction !== 'borrowed') throw new ValidationError('نوع الدين غير صالح');
  if (!person) throw new ValidationError('اكتب اسم الشخص');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > MAX_AMOUNT_MINOR) {
    throw new ValidationError('المبلغ يجب أن يكون أكبر من صفر');
  }
  if (!isValidISODate(input.date)) throw new ValidationError('التاريخ غير صالح');
  const dueDate = input.dueDate || undefined;
  if (dueDate && !isValidISODate(dueDate)) throw new ValidationError('تاريخ الاستحقاق غير صالح');
  if (dueDate && dueDate < input.date) throw new ValidationError('تاريخ الاستحقاق لا يسبق تاريخ الدين');

  return db.transaction('rw', db.debts, db.debtPayments, async () => {
    const existing = input.id ? await db.debts.get(input.id) : undefined;
    if (existing) {
      const paid = (await db.debtPayments.where('debtId').equals(existing.id).toArray()).reduce((a, p) => a + p.amountMinor, 0);
      if (input.amountMinor < paid) throw new ValidationError('المبلغ أقل من المسدَّد فعلًا');
    }
    const now = nowISO();
    const id = existing?.id ?? input.id ?? newId();
    await db.debts.put({
      id,
      direction: input.direction,
      person,
      amountMinor: input.amountMinor,
      date: input.date,
      dueDate,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return id;
  });
}

export async function addDebtPayment(debtId: string, amountMinor: number, date: string, notes?: string): Promise<string> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new ValidationError('مبلغ السداد يجب أن يكون أكبر من صفر');
  if (!isValidISODate(date)) throw new ValidationError('التاريخ غير صالح');
  return db.transaction('rw', db.debts, db.debtPayments, async () => {
    const debt = await db.debts.get(debtId);
    if (!debt) throw new ValidationError('الدين غير موجود');
    const paid = (await db.debtPayments.where('debtId').equals(debtId).toArray()).reduce((a, p) => a + p.amountMinor, 0);
    if (amountMinor > debt.amountMinor - paid) throw new ValidationError('مبلغ السداد أكبر من المتبقي');
    const id = newId();
    await db.debtPayments.add({ id, debtId, amountMinor, date, notes: notes?.trim() || undefined, createdAt: nowISO() });
    await db.debts.update(debtId, { updatedAt: nowISO() });
    return id;
  });
}

export async function deleteDebtPayment(id: string) {
  await db.debtPayments.delete(id);
}

export type DeletedDebt = { debt: Debt; payments: DebtPayment[] };

export async function deleteDebt(id: string): Promise<DeletedDebt | null> {
  return db.transaction('rw', db.debts, db.debtPayments, async () => {
    const debt = await db.debts.get(id);
    if (!debt) return null;
    const payments = await db.debtPayments.where('debtId').equals(id).toArray();
    await db.debtPayments.where('debtId').equals(id).delete();
    await db.debts.delete(id);
    return { debt, payments };
  });
}

export async function restoreDebt(snap: DeletedDebt) {
  await db.transaction('rw', db.debts, db.debtPayments, async () => {
    await db.debts.put(snap.debt);
    if (snap.payments.length) await db.debtPayments.bulkPut(snap.payments);
  });
}

// ───────────── مسح كل البيانات ─────────────

export async function wipeAllData() {
  const tables = [db.transactions, db.receipts, db.categories, db.settings, db.sections, db.debts, db.debtPayments];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    await db.settings.add(DEFAULT_SETTINGS);
    await db.sections.bulkAdd(DEFAULT_SECTIONS);
  });
}
