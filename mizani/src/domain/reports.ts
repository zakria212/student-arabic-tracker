import type { Category, PaymentMethod, Transaction, TransactionType } from '../db/types';
import { addDays, diffDays, inRange, MONTHS_AR, parseISODate, toISODate, type ISODate } from '../lib/dates';

export type Filters = {
  start?: ISODate;
  end?: ISODate;
  type?: TransactionType | 'all';
  categoryId?: string | 'all';
  paymentMethod?: PaymentMethod | 'all';
  search?: string;
};

/** تطبيع النص العربي للبحث: إزالة التشكيل وتوحيد الهمزات والتاء المربوطة والياء */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

export function filterTransactions(txs: Transaction[], f: Filters): Transaction[] {
  const q = f.search ? normalizeArabic(f.search) : '';
  return txs.filter((t) => {
    if (f.start && f.end && !inRange(t.date, f.start, f.end)) return false;
    if (f.type && f.type !== 'all' && t.type !== f.type) return false;
    if (f.categoryId && f.categoryId !== 'all' && t.categoryId !== f.categoryId) return false;
    if (f.paymentMethod && f.paymentMethod !== 'all' && t.paymentMethod !== f.paymentMethod) return false;
    if (q) {
      const hay = normalizeArabic(`${t.details} ${t.notes ?? ''}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** الأحدث أولًا: حسب التاريخ ثم وقت الإنشاء */
export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export type Summary = { incomeMinor: number; expenseMinor: number; netMinor: number; incomeCount: number; expenseCount: number };

export function summarize(txs: Transaction[]): Summary {
  let incomeMinor = 0, expenseMinor = 0, incomeCount = 0, expenseCount = 0;
  for (const t of txs) {
    if (t.type === 'income') { incomeMinor += t.amountMinor; incomeCount++; }
    else { expenseMinor += t.amountMinor; expenseCount++; }
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor, incomeCount, expenseCount };
}

export type CategoryShare = { categoryId: string; name: string; color: string; icon: string; totalMinor: number; count: number; share: number };

export function byCategory(txs: Transaction[], type: TransactionType, categories: Category[]): CategoryShare[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    const e = map.get(t.categoryId) ?? { total: 0, count: 0 };
    e.total += t.amountMinor; e.count++;
    map.set(t.categoryId, e);
    grand += t.amountMinor;
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  return [...map.entries()]
    .map(([categoryId, { total, count }]) => {
      const c = catById.get(categoryId);
      return {
        categoryId,
        name: c?.name ?? 'تصنيف محذوف',
        color: c?.color ?? '#9AA5AA',
        icon: c?.icon ?? 'circle-ellipsis',
        totalMinor: total,
        count,
        share: grand ? total / grand : 0,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export type Bucket = { key: string; label: string; start: ISODate; end: ISODate; incomeMinor: number; expenseMinor: number };
export type Granularity = 'day' | 'week' | 'month';

export function pickGranularity(start: ISODate, end: ISODate): Granularity {
  const days = diffDays(start, end) + 1;
  if (days <= 45) return 'day';
  if (days <= 190) return 'week';
  return 'month';
}

/** يقسم المدى إلى فترات (يوم/أسبوع/شهر) ويجمع الدخل والمصروفات في كل منها */
export function timeSeries(txs: Transaction[], start: ISODate, end: ISODate, granularity = pickGranularity(start, end)): Bucket[] {
  if (end < start) return [];
  const buckets: Bucket[] = [];
  if (granularity === 'day') {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const [, m, day] = d.split('-').map(Number);
      buckets.push({ key: d, label: `${day}/${m}`, start: d, end: d, incomeMinor: 0, expenseMinor: 0 });
    }
  } else if (granularity === 'week') {
    for (let d = start; d <= end; d = addDays(d, 7)) {
      const e = addDays(d, 6) > end ? end : addDays(d, 6);
      const [, m, day] = d.split('-').map(Number);
      buckets.push({ key: d, label: `${day}/${m}`, start: d, end: e, incomeMinor: 0, expenseMinor: 0 });
    }
  } else {
    let cur = parseISODate(start);
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1, 12);
    while (toISODate(cur) <= end) {
      const s = toISODate(cur);
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12);
      const e = addDays(toISODate(next), -1);
      buckets.push({
        key: s.slice(0, 7),
        label: `${MONTHS_AR[cur.getMonth()]}${cur.getFullYear() !== parseISODate(end).getFullYear() || cur.getFullYear() !== parseISODate(start).getFullYear() ? ' ' + String(cur.getFullYear()).slice(2) : ''}`,
        start: s < start ? start : s,
        end: e > end ? end : e,
        incomeMinor: 0,
        expenseMinor: 0,
      });
      cur = next;
    }
  }
  for (const t of txs) {
    if (!inRange(t.date, start, end)) continue;
    // بحث خطي كافٍ لعدد الفترات الصغير
    const b = buckets.find((x) => t.date >= x.start && t.date <= x.end);
    if (!b) continue;
    if (t.type === 'income') b.incomeMinor += t.amountMinor;
    else b.expenseMinor += t.amountMinor;
  }
  return buckets;
}

/** يجمع الحركات حسب اليوم مع الحفاظ على الترتيب */
export function groupByDay(txs: Transaction[]): { date: ISODate; items: Transaction[]; netMinor: number }[] {
  const groups: { date: ISODate; items: Transaction[]; netMinor: number }[] = [];
  for (const t of txs) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) { g = { date: t.date, items: [], netMinor: 0 }; groups.push(g); }
    g.items.push(t);
    g.netMinor += t.type === 'income' ? t.amountMinor : -t.amountMinor;
  }
  return groups;
}
