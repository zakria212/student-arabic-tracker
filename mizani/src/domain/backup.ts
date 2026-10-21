import JSZip from 'jszip';
import { z } from 'zod';
import { db, DATA_SCHEMA_VERSION } from '../db/db';
import type { Category, Debt, DebtPayment, Receipt, Section, Settings, Transaction } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import { isValidISODate } from '../lib/dates';

/**
 * بنية ملف النسخة الاحتياطية (ZIP):
 *   mizani-backup.json  ← الإصدار والحركات والتصنيفات والإعدادات وبيانات المرفقات
 *   receipts/<id>.<ext> ← ملفات الصور الأصلية
 */
export const BACKUP_JSON = 'mizani-backup.json';
const APP_ID = 'mizani';

const extFor = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

const txSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amountMinor: z.number().int().positive().max(100_000_000_000),
  details: z.string().min(1),
  categoryId: z.string().min(1),
  date: z.string().refine(isValidISODate, 'تاريخ غير صالح'),
  notes: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'card', 'other']).optional(),
  sectionId: z.string().min(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  isActive: z.boolean(),
  order: z.number(),
});

const debtSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['lent', 'borrowed']),
  person: z.string().min(1),
  amountMinor: z.number().int().positive().max(100_000_000_000),
  date: z.string().refine(isValidISODate, 'تاريخ غير صالح'),
  dueDate: z.string().refine(isValidISODate, 'تاريخ غير صالح').optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const debtPaymentSchema = z.object({
  id: z.string().min(1),
  debtId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  date: z.string().refine(isValidISODate, 'تاريخ غير صالح'),
  notes: z.string().optional(),
  createdAt: z.string(),
});

const catSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['income', 'expense']),
  name: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  order: z.number().optional(),
});

const receiptMetaSchema = z.object({
  id: z.string().min(1),
  transactionId: z.string().min(1),
  filename: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
  path: z.string().min(1),
});

const backupSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  settings: z
    .object({
      currency: z.string().min(1),
      theme: z.enum(['light', 'dark', 'system']).optional(),
      numerals: z.enum(['latn', 'arab']).optional(),
    })
    .optional(),
  categories: z.array(catSchema),
  transactions: z.array(txSchema),
  receipts: z.array(receiptMetaSchema),
  // أُضيفت في الإصدار 2 — اختيارية لقبول نسخ الإصدار 1
  sections: z.array(sectionSchema).optional(),
  debts: z.array(debtSchema).optional(),
  debtPayments: z.array(debtPaymentSchema).optional(),
});

export type BackupFile = z.infer<typeof backupSchema>;

export async function createBackup(): Promise<{ bytes: Uint8Array; filename: string; counts: { transactions: number; receipts: number } }> {
  const [transactions, categories, receipts, settings, sections, debts, debtPayments] = await db.transaction(
    'r',
    [db.transactions, db.categories, db.receipts, db.settings, db.sections, db.debts, db.debtPayments],
    () => Promise.all([
      db.transactions.toArray(), db.categories.toArray(), db.receipts.toArray(), db.settings.get('app'),
      db.sections.toArray(), db.debts.toArray(), db.debtPayments.toArray(),
    ]),
  );

  const zip = new JSZip();
  const meta: BackupFile = {
    app: APP_ID,
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      currency: settings?.currency ?? DEFAULT_SETTINGS.currency,
      theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
      numerals: settings?.numerals ?? DEFAULT_SETTINGS.numerals,
    },
    categories,
    transactions,
    sections,
    debts,
    debtPayments,
    receipts: receipts.map((r) => {
      const path = `receipts/${r.id}.${extFor(r.mimeType)}`;
      zip.file(path, r.data);
      return { id: r.id, transactionId: r.transactionId, filename: r.filename, mimeType: r.mimeType as 'image/jpeg', size: r.size, createdAt: r.createdAt, path };
    }),
  };
  zip.file(BACKUP_JSON, JSON.stringify(meta, null, 2));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const stamp = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const filename = `mizani-backup-${stamp.getFullYear()}-${p(stamp.getMonth() + 1)}-${p(stamp.getDate())}.zip`;
  return { bytes, filename, counts: { transactions: transactions.length, receipts: receipts.length } };
}

export class BackupError extends Error {}

export type ParsedBackup = {
  meta: BackupFile;
  receiptData: Map<string, ArrayBuffer>;
  preview: {
    transactions: number;
    receipts: number;
    categories: number;
    debts: number;
    exportedAt: string;
    range?: { start: string; end: string };
    currency: string;
  };
};

/** يقرأ ملف ZIP ويتحقق من سلامته بالكامل قبل أي كتابة على قاعدة البيانات */
export async function parseBackup(file: ArrayBuffer | Uint8Array | Blob): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupError('الملف ليس نسخة احتياطية صالحة (ZIP تالف أو غير معروف)');
  }
  const jsonFile = zip.file(BACKUP_JSON);
  if (!jsonFile) throw new BackupError('الملف لا يحتوي بيانات ميزاني');

  let raw: unknown;
  try {
    raw = JSON.parse(await jsonFile.async('string'));
  } catch {
    throw new BackupError('بيانات النسخة الاحتياطية تالفة');
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new BackupError('بنية النسخة الاحتياطية غير صحيحة أو ناقصة');
  const meta = parsed.data;
  if (meta.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new BackupError('هذه النسخة أُنشئت بإصدار أحدث من التطبيق؛ حدّث التطبيق أولًا');
  }

  // سلامة المراجع
  const unique = (arr: { id: string }[]) => new Set(arr.map((x) => x.id)).size === arr.length;
  const sections = meta.sections ?? [];
  const debts = meta.debts ?? [];
  const debtPayments = meta.debtPayments ?? [];
  if (!unique(meta.transactions) || !unique(meta.categories) || !unique(meta.receipts) || !unique(sections) || !unique(debts) || !unique(debtPayments)) {
    throw new BackupError('النسخة تحتوي معرّفات مكررة');
  }
  const catIds = new Set(meta.categories.map((c) => c.id));
  for (const t of meta.transactions) {
    if (!catIds.has(t.categoryId)) throw new BackupError('حركة تشير إلى تصنيف غير موجود في النسخة');
    const c = meta.categories.find((x) => x.id === t.categoryId)!;
    if (c.type !== t.type) throw new BackupError('تعارض بين نوع حركة ونوع تصنيفها');
  }
  const sectionIds = new Set(sections.map((x) => x.id));
  if (meta.transactions.some((t) => t.sectionId && !sectionIds.has(t.sectionId))) {
    throw new BackupError('حركة تشير إلى قسم غير موجود في النسخة');
  }
  const debtIds = new Set(debts.map((d) => d.id));
  if (debtPayments.some((p) => !debtIds.has(p.debtId))) throw new BackupError('دفعة سداد لا تتبع أي دين في النسخة');
  const txIds = new Set(meta.transactions.map((t) => t.id));
  const receiptData = new Map<string, ArrayBuffer>();
  for (const r of meta.receipts) {
    if (!txIds.has(r.transactionId)) throw new BackupError('مرفق لا يتبع أي حركة في النسخة');
    const f = zip.file(r.path);
    if (!f) throw new BackupError(`ملف مرفق مفقود: ${r.path}`);
    receiptData.set(r.id, await f.async('arraybuffer'));
  }

  const dates = meta.transactions.map((t) => t.date).sort();
  return {
    meta,
    receiptData,
    preview: {
      transactions: meta.transactions.length,
      receipts: meta.receipts.length,
      categories: meta.categories.length,
      debts: debts.length,
      exportedAt: meta.exportedAt,
      range: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : undefined,
      currency: meta.settings?.currency ?? 'SAR',
    },
  };
}

export type ImportMode = 'replace' | 'merge';
export type ImportResult = { addedTransactions: number; skippedTransactions: number; addedReceipts: number; addedCategories: number; addedDebts: number };

export async function applyBackup(parsed: ParsedBackup, mode: ImportMode): Promise<ImportResult> {
  const { meta, receiptData } = parsed;
  const categories: Category[] = meta.categories.map((c, i) => ({ ...c, order: c.order ?? i }));
  const receipts: Receipt[] = meta.receipts.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
    createdAt: r.createdAt,
    data: receiptData.get(r.id)!,
  }));
  const transactions: Transaction[] = meta.transactions;
  const sections: Section[] = meta.sections ?? [];
  const debts: Debt[] = meta.debts ?? [];
  const debtPayments: DebtPayment[] = meta.debtPayments ?? [];
  const isV1 = meta.sections === undefined;

  const tables = [db.transactions, db.receipts, db.categories, db.settings, db.sections, db.debts, db.debtPayments];
  return db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([db.transactions.clear(), db.receipts.clear(), db.categories.clear(), db.debts.clear(), db.debtPayments.clear()]);
      // نسخة الإصدار 1 لا تحتوي أقسامًا، فنُبقي الأقسام الحالية
      if (!isV1) {
        await db.sections.clear();
        await db.sections.bulkAdd(sections);
      }
      await db.categories.bulkAdd(categories);
      await db.transactions.bulkAdd(transactions);
      await db.receipts.bulkAdd(receipts);
      await db.debts.bulkAdd(debts);
      await db.debtPayments.bulkAdd(debtPayments);
      const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
      const s: Settings = { ...current, key: 'app', currency: meta.settings?.currency ?? current.currency };
      if (meta.settings?.theme) s.theme = meta.settings.theme;
      if (meta.settings?.numerals) s.numerals = meta.settings.numerals;
      await db.settings.put(s);
      return { addedTransactions: transactions.length, skippedTransactions: 0, addedReceipts: receipts.length, addedCategories: categories.length, addedDebts: debts.length };
    }

    // الدمج: نضيف فقط ما لا يوجد معرّفه مسبقًا، دون تعديل سجلات المستخدم الحالية
    const existingCat = new Set(await db.categories.toCollection().primaryKeys());
    const newCats = categories.filter((c) => !existingCat.has(c.id));
    await db.categories.bulkAdd(newCats);
    const existingSec = new Set(await db.sections.toCollection().primaryKeys());
    await db.sections.bulkAdd(sections.filter((x) => !existingSec.has(x.id)));

    const existingTx = new Set(await db.transactions.toCollection().primaryKeys());
    const newTxs = transactions.filter((t) => !existingTx.has(t.id));
    // تأكد أن تصنيف كل حركة جديدة متوافق مع ما هو موجود في الجهاز
    const allCats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    for (const t of newTxs) {
      const c = allCats.get(t.categoryId);
      if (!c || c.type !== t.type) throw new BackupError('تعارض في التصنيفات يمنع الدمج الآمن');
    }
    await db.transactions.bulkAdd(newTxs);

    // المرفقات تُضاف فقط للحركات المضافة الآن، لتجنب التكرار وعدم ترك مرفقات يتيمة
    const addedIds = new Set(newTxs.map((t) => t.id));
    const existingRc = new Set(await db.receipts.toCollection().primaryKeys());
    const newReceipts = receipts.filter((r) => addedIds.has(r.transactionId) && !existingRc.has(r.id));
    await db.receipts.bulkAdd(newReceipts);

    // الديون: نضيف غير الموجود فقط، ودفعاتها معها
    const existingDebts = new Set(await db.debts.toCollection().primaryKeys());
    const newDebts = debts.filter((d) => !existingDebts.has(d.id));
    await db.debts.bulkAdd(newDebts);
    const newDebtIds = new Set(newDebts.map((d) => d.id));
    await db.debtPayments.bulkAdd(debtPayments.filter((p) => newDebtIds.has(p.debtId)));

    return {
      addedDebts: newDebts.length,
      addedTransactions: newTxs.length,
      skippedTransactions: transactions.length - newTxs.length,
      addedReceipts: newReceipts.length,
      addedCategories: newCats.length,
    };
  });
}
