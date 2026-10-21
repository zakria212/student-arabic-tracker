import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  addCategory, deleteCategory, deleteTransaction, restoreTransaction, saveTransaction, updateCategory, wipeAllData,
} from '../src/db/repo';
import { applyBackup, createBackup, parseBackup } from '../src/domain/backup';
import { buildCsv } from '../src/domain/csv';
import { filterTransactions, summarize } from '../src/domain/reports';
import { parseAmount } from '../src/lib/money';

const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]).buffer;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const base = { type: 'expense' as const, amountMinor: 4550, details: 'وجبة غداء', categoryId: 'exp-food', date: '2026-10-21' };

describe('قاعدة البيانات', () => {
  it('تُنشأ التصنيفات الافتراضية فقط دون حركات تجريبية', async () => {
    expect(await db.categories.count()).toBe(15);
    expect(await db.transactions.count()).toBe(0);
    expect((await db.settings.get('app'))?.currency).toBe('SAR');
  });

  it('اختبار 4: يرفض المبالغ غير الصالحة على مستوى التخزين أيضًا', async () => {
    await expect(saveTransaction({ ...base, amountMinor: 0 })).rejects.toThrow();
    await expect(saveTransaction({ ...base, amountMinor: -100 })).rejects.toThrow();
    await expect(saveTransaction({ ...base, amountMinor: 1.5 })).rejects.toThrow();
    await expect(saveTransaction({ ...base, details: '  ' })).rejects.toThrow();
    await expect(saveTransaction({ ...base, categoryId: 'inc-salary' })).rejects.toThrow();
    expect(await db.transactions.count()).toBe(0);
  });

  it('اختبار 6: التعديل ينعكس على المجاميع والحذف يزيل الأثر، مع التراجع', async () => {
    const id = await saveTransaction({ ...base, amountMinor: parseAmount('250.75').ok ? 25075 : 0 });
    await saveTransaction({ type: 'income', amountMinor: 100000, details: 'راتب', categoryId: 'inc-salary', date: '2026-10-01' });
    const sum = async () => summarize(filterTransactions(await db.transactions.toArray(), { start: '2026-10-01', end: '2026-10-31' }));
    expect((await sum()).netMinor).toBe(74925);

    await saveTransaction({ ...base, id, amountMinor: 5000 });
    expect((await sum()).expenseMinor).toBe(5000);
    expect(await db.transactions.count()).toBe(2);

    const snap = await deleteTransaction(id);
    expect((await sum()).expenseMinor).toBe(0);
    await restoreTransaction(snap!);
    expect((await sum()).expenseMinor).toBe(5000);
  });

  it('المرفقات: حد 3 صور، وتُحذف مع الحركة دون سجلات يتيمة', async () => {
    const r = { filename: 'a.png', mimeType: 'image/png', data: png() };
    const id = await saveTransaction(base, [r, r]);
    expect(await db.receipts.where('transactionId').equals(id).count()).toBe(2);
    await expect(saveTransaction({ ...base, id }, [r, r])).rejects.toThrow();
    const [first] = await db.receipts.where('transactionId').equals(id).primaryKeys();
    await saveTransaction({ ...base, id }, [r], [first]);
    expect(await db.receipts.where('transactionId').equals(id).count()).toBe(2);
    await expect(saveTransaction(base, [{ ...r, mimeType: 'application/pdf' }])).rejects.toThrow();
    await deleteTransaction(id);
    expect(await db.receipts.count()).toBe(0);
  });

  it('التصنيفات: لا يُحذف تصنيف مستخدم، ويمكن تعطيله', async () => {
    await saveTransaction(base);
    await expect(deleteCategory('exp-food')).rejects.toThrow();
    await updateCategory('exp-food', { isActive: false });
    expect((await db.categories.get('exp-food'))?.isActive).toBe(false);
    const id = await addCategory({ type: 'expense', name: 'قهوة', icon: 'coffee', color: '#000' });
    await expect(addCategory({ type: 'expense', name: 'قهوة', icon: 'coffee', color: '#000' })).rejects.toThrow();
    await deleteCategory(id);
    expect(await db.categories.get(id)).toBeUndefined();
  });

  it('مسح جميع البيانات يعيد التصنيفات الافتراضية', async () => {
    await saveTransaction(base, [{ filename: 'a.png', mimeType: 'image/png', data: png() }]);
    await wipeAllData();
    expect(await db.transactions.count()).toBe(0);
    expect(await db.receipts.count()).toBe(0);
    expect(await db.categories.count()).toBe(15);
  });
});

describe('النسخ الاحتياطي (اختبارات 5 و10)', () => {
  it('تصدير ثم استبدال يعيد كل شيء كما هو', async () => {
    const id = await saveTransaction(base, [{ filename: 'فاتورة.png', mimeType: 'image/png', data: png() }]);
    await saveTransaction({ type: 'income', amountMinor: 250000, details: 'مكافأة', categoryId: 'inc-other', date: '2026-10-05' });
    const catId = await addCategory({ type: 'expense', name: 'قهوة', icon: 'coffee', color: '#333' });
    const { bytes } = await createBackup();

    await wipeAllData();
    const parsed = await parseBackup(bytes);
    expect(parsed.preview).toMatchObject({ transactions: 2, receipts: 1, categories: 16 });
    await applyBackup(parsed, 'replace');

    expect(await db.transactions.count()).toBe(2);
    expect(await db.categories.get(catId)).toBeTruthy();
    const [rc] = await db.receipts.where('transactionId').equals(id).toArray();
    expect(new Uint8Array(rc.data)).toEqual(new Uint8Array(png()));
    expect(rc.filename).toBe('فاتورة.png');
  });

  it('الدمج لا يكرر المعرّفات ولا المرفقات', async () => {
    await saveTransaction(base, [{ filename: 'a.png', mimeType: 'image/png', data: png() }]);
    const { bytes } = await createBackup();
    await saveTransaction({ ...base, details: 'حركة جديدة بعد النسخة' });

    const res = await applyBackup(await parseBackup(bytes), 'merge');
    expect(res.addedTransactions).toBe(0);
    expect(res.skippedTransactions).toBe(1);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.receipts.count()).toBe(1);

    // دمج في قاعدة فارغة يضيف الكل
    await wipeAllData();
    const res2 = await applyBackup(await parseBackup(bytes), 'merge');
    expect(res2.addedTransactions).toBe(1);
    expect(res2.addedReceipts).toBe(1);
  });

  it('يرفض الملفات التالفة دون المساس بالبيانات', async () => {
    await saveTransaction(base);
    await expect(parseBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    const JSZip = (await import('jszip')).default;
    const z = new JSZip();
    z.file('mizani-backup.json', JSON.stringify({ app: 'mizani', schemaVersion: 1, exportedAt: '', categories: [], transactions: [{ id: 'x' }], receipts: [] }));
    await expect(parseBackup(await z.generateAsync({ type: 'uint8array' }))).rejects.toThrow();
    expect(await db.transactions.count()).toBe(1);
  });
});

describe('CSV (اختبار 11)', () => {
  it('يبدأ بـ BOM ويحتوي أعمدة عربية وقيمًا مهربة', async () => {
    await saveTransaction({ ...base, details: 'غداء, مع "صديق"', notes: '=HYPERLINK()' });
    const csv = buildCsv(await db.transactions.toArray(), await db.categories.toArray(), 'SAR');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toContain('التاريخ,النوع,المبلغ');
    expect(lines[1]).toContain('2026-10-21,مصروف,45.50,SAR,"غداء, مع ""صديق""",طعام');
    expect(lines[1]).toContain("'=HYPERLINK()");
  });
});
