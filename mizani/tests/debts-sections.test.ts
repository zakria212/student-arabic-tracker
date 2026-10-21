import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db, MizaniDB } from '../src/db/db';
import {
  addDebtPayment, addSection, deleteDebt, deleteSection, restoreDebt, saveDebt, saveTransaction, updateSection, wipeAllData,
} from '../src/db/repo';
import { applyBackup, createBackup, parseBackup } from '../src/domain/backup';
import { buildDebtViews, debtTotals, sortDebts } from '../src/domain/debts';
import { bySection, filterTransactions, summarize } from '../src/domain/reports';
import { buildCsv } from '../src/domain/csv';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const exp = { type: 'expense' as const, amountMinor: 1000, details: 'x', categoryId: 'exp-food', date: '2026-10-10' };
const views = async (today = '2026-10-21') => buildDebtViews(await db.debts.toArray(), await db.debtPayments.toArray(), today);

describe('الأقسام', () => {
  it('أقسام افتراضية: المنزل والعمل', async () => {
    expect((await db.sections.toArray()).map((s) => s.name)).toEqual(['المنزل', 'العمل']);
  });

  it('تصفية الإجماليات حسب القسم', async () => {
    await saveTransaction({ ...exp, sectionId: 'sec-home', amountMinor: 3000 });
    await saveTransaction({ ...exp, sectionId: 'sec-work', amountMinor: 500 });
    await saveTransaction({ ...exp, amountMinor: 200 });
    const all = await db.transactions.toArray();
    expect(summarize(filterTransactions(all, { sectionId: 'sec-home' })).expenseMinor).toBe(3000);
    expect(summarize(filterTransactions(all, { sectionId: 'none' })).expenseMinor).toBe(200);
    const by = bySection(all, await db.sections.toArray());
    expect(by.map((s) => s.name)).toEqual(['المنزل', 'العمل', 'بدون قسم']);
  });

  it('رفض قسم غير موجود، ومنع حذف قسم مستخدم', async () => {
    await expect(saveTransaction({ ...exp, sectionId: 'nope' })).rejects.toThrow();
    await saveTransaction({ ...exp, sectionId: 'sec-home' });
    await expect(deleteSection('sec-home')).rejects.toThrow();
    await updateSection('sec-home', { isActive: false });
    const id = await addSection({ name: 'السيارة', icon: 'car', color: '#000' });
    await expect(addSection({ name: 'السيارة', icon: 'car', color: '#000' })).rejects.toThrow();
    await deleteSection(id);
    expect(await db.sections.get(id)).toBeUndefined();
  });

  it('CSV يتضمن عمود القسم', async () => {
    await saveTransaction({ ...exp, sectionId: 'sec-work' });
    const csv = buildCsv(await db.transactions.toArray(), await db.categories.toArray(), 'SAR', new Map(), await db.sections.toArray());
    expect(csv).toContain('التصنيف,القسم');
    expect(csv).toContain(',طعام,العمل,');
  });
});

describe('الديون', () => {
  it('لي عند الناس وعليّ للناس مع السداد الجزئي', async () => {
    const lent = await saveDebt({ direction: 'lent', person: 'أحمد', amountMinor: 50000, date: '2026-10-01', dueDate: '2026-10-15' });
    await saveDebt({ direction: 'borrowed', person: 'خالد', amountMinor: 20000, date: '2026-10-05' });
    await addDebtPayment(lent, 15000, '2026-10-10');

    const v = await views();
    const a = v.find((x) => x.id === lent)!;
    expect(a.paidMinor).toBe(15000);
    expect(a.remainingMinor).toBe(35000);
    expect(a.status).toBe('overdue');
    expect(debtTotals(v, 'lent')).toEqual({ remainingMinor: 35000, openCount: 1, overdueCount: 1 });
    expect(debtTotals(v, 'borrowed').remainingMinor).toBe(20000);
    expect(sortDebts(v)[0].id).toBe(lent);
  });

  it('السداد لا يتجاوز المتبقي، والسداد الكامل يجعله مسددًا', async () => {
    const id = await saveDebt({ direction: 'borrowed', person: 'سعيد', amountMinor: 10000, date: '2026-10-01' });
    await expect(addDebtPayment(id, 10001, '2026-10-02')).rejects.toThrow();
    await expect(addDebtPayment(id, 0, '2026-10-02')).rejects.toThrow();
    await addDebtPayment(id, 10000, '2026-10-02');
    expect((await views())[0].status).toBe('settled');
    await expect(saveDebt({ id, direction: 'borrowed', person: 'سعيد', amountMinor: 5000, date: '2026-10-01' })).rejects.toThrow();
  });

  it('التحقق من المدخلات', async () => {
    await expect(saveDebt({ direction: 'lent', person: ' ', amountMinor: 100, date: '2026-10-01' })).rejects.toThrow();
    await expect(saveDebt({ direction: 'lent', person: 'a', amountMinor: -1, date: '2026-10-01' })).rejects.toThrow();
    await expect(saveDebt({ direction: 'lent', person: 'a', amountMinor: 100, date: '2026-10-05', dueDate: '2026-10-01' })).rejects.toThrow();
  });

  it('الديون لا تؤثر على إجمالي الدخل والمصروفات', async () => {
    await saveDebt({ direction: 'lent', person: 'أحمد', amountMinor: 50000, date: '2026-10-01' });
    expect(summarize(await db.transactions.toArray()).netMinor).toBe(0);
  });

  it('الحذف مع الدفعات والتراجع', async () => {
    const id = await saveDebt({ direction: 'lent', person: 'أحمد', amountMinor: 100, date: '2026-10-01' });
    await addDebtPayment(id, 40, '2026-10-02');
    const snap = await deleteDebt(id);
    expect(await db.debtPayments.count()).toBe(0);
    await restoreDebt(snap!);
    expect((await views())[0].paidMinor).toBe(40);
  });
});

describe('النسخ الاحتياطي v2 والترقية', () => {
  it('تشمل الأقسام والديون، والدمج لا يكرر', async () => {
    const sec = await addSection({ name: 'السيارة', icon: 'car', color: '#000' });
    await saveTransaction({ ...exp, sectionId: sec });
    const d = await saveDebt({ direction: 'lent', person: 'أحمد', amountMinor: 100, date: '2026-10-01' });
    await addDebtPayment(d, 30, '2026-10-02');
    const { bytes } = await createBackup();

    await wipeAllData();
    const parsed = await parseBackup(bytes);
    expect(parsed.preview.debts).toBe(1);
    await applyBackup(parsed, 'replace');
    expect((await db.transactions.toArray())[0].sectionId).toBe(sec);
    expect(await db.debtPayments.count()).toBe(1);

    const r = await applyBackup(await parseBackup(bytes), 'merge');
    expect(r.addedDebts).toBe(0);
    expect(await db.debts.count()).toBe(1);
    expect(await db.debtPayments.count()).toBe(1);
  });

  it('يقبل نسخة الإصدار 1 القديمة', async () => {
    const JSZip = (await import('jszip')).default;
    const z = new JSZip();
    z.file('mizani-backup.json', JSON.stringify({
      app: 'mizani', schemaVersion: 1, exportedAt: '2026-10-01T00:00:00Z',
      categories: [{ id: 'exp-food', type: 'expense', name: 'طعام', icon: 'utensils', color: '#000', isDefault: true, isActive: true }],
      transactions: [{ ...exp, id: 't1', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' }],
      receipts: [],
    }));
    await applyBackup(await parseBackup(await z.generateAsync({ type: 'uint8array' })), 'replace');
    expect(await db.transactions.count()).toBe(1);
    expect(await db.sections.count()).toBe(2);
  });

  it('ترقية قاعدة بيانات الإصدار 1 دون فقد الحركات', async () => {
    await db.delete();
    db.close();
    const old = new Dexie('mizani-upgrade-test');
    old.version(1).stores({ transactions: 'id, type, date, categoryId, paymentMethod, [type+date]', categories: 'id, type, order', receipts: 'id, transactionId', settings: 'key' });
    await old.open();
    await old.table('transactions').add({ ...exp, id: 'old1', createdAt: '', updatedAt: '' });
    old.close();

    const upgraded = new MizaniDB('mizani-upgrade-test');
    await upgraded.open();
    expect(await upgraded.transactions.get('old1')).toBeTruthy();
    expect(await upgraded.sections.count()).toBe(2);
    expect(await upgraded.debts.count()).toBe(0);
    await upgraded.delete();
    await db.open();
  });
});
