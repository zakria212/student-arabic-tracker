import JSZip from 'jszip';
import { z } from 'zod';
import { db, DATA_SCHEMA_VERSION } from '../db/db';
import type { Category, Receipt, Settings, Transaction } from '../db/types';
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
  createdAt: z.string(),
  updatedAt: z.string(),
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
});

export type BackupFile = z.infer<typeof backupSchema>;

export async function createBackup(): Promise<{ bytes: Uint8Array; filename: string; counts: { transactions: number; receipts: number } }> {
  const [transactions, categories, receipts, settings] = await db.transaction(
    'r',
    [db.transactions, db.categories, db.receipts, db.settings],
    () => Promise.all([db.transactions.toArray(), db.categories.toArray(), db.receipts.toArray(), db.settings.get('app')]),
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
  if (!unique(meta.transactions) || !unique(meta.categories) || !unique(meta.receipts)) {
    throw new BackupError('النسخة تحتوي معرّفات مكررة');
  }
  const catIds = new Set(meta.categories.map((c) => c.id));
  for (const t of meta.transactions) {
    if (!catIds.has(t.categoryId)) throw new BackupError('حركة تشير إلى تصنيف غير موجود في النسخة');
    const c = meta.categories.find((x) => x.id === t.categoryId)!;
    if (c.type !== t.type) throw new BackupError('تعارض بين نوع حركة ونوع تصنيفها');
  }
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
      exportedAt: meta.exportedAt,
      range: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : undefined,
      currency: meta.settings?.currency ?? 'SAR',
    },
  };
}

export type ImportMode = 'replace' | 'merge';
export type ImportResult = { addedTransactions: number; skippedTransactions: number; addedReceipts: number; addedCategories: number };

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

  return db.transaction('rw', [db.transactions, db.receipts, db.categories, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.transactions.clear(), db.receipts.clear(), db.categories.clear()]);
      await db.categories.bulkAdd(categories);
      await db.transactions.bulkAdd(transactions);
      await db.receipts.bulkAdd(receipts);
      const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
      const s: Settings = { ...current, key: 'app', currency: meta.settings?.currency ?? current.currency };
      if (meta.settings?.theme) s.theme = meta.settings.theme;
      if (meta.settings?.numerals) s.numerals = meta.settings.numerals;
      await db.settings.put(s);
      return { addedTransactions: transactions.length, skippedTransactions: 0, addedReceipts: receipts.length, addedCategories: categories.length };
    }

    // الدمج: نضيف فقط ما لا يوجد معرّفه مسبقًا، دون تعديل سجلات المستخدم الحالية
    const existingCat = new Set(await db.categories.toCollection().primaryKeys());
    const newCats = categories.filter((c) => !existingCat.has(c.id));
    await db.categories.bulkAdd(newCats);

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

    return {
      addedTransactions: newTxs.length,
      skippedTransactions: transactions.length - newTxs.length,
      addedReceipts: newReceipts.length,
      addedCategories: newCats.length,
    };
  });
}
