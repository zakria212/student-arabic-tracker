import { describe, expect, it } from 'vitest';
import type { Transaction } from '../src/db/types';
import { byCategory, filterTransactions, groupByDay, sortNewestFirst, summarize, timeSeries } from '../src/domain/reports';
import { DEFAULT_CATEGORIES } from '../src/db/defaults';
import { minorToPlain } from '../src/lib/money';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  type: 'expense',
  amountMinor: 100,
  details: 'x',
  categoryId: 'exp-food',
  date: '2026-10-10',
  createdAt: `2026-10-10T10:00:0${n % 10}Z`,
  updatedAt: '2026-10-10T10:00:00Z',
  ...p,
});

describe('الحسابات', () => {
  it('اختبار 1: دخل 1000 ومصروف 250.75 → صافي 749.25', () => {
    const list = [tx({ type: 'income', amountMinor: 100000, categoryId: 'inc-salary' }), tx({ amountMinor: 25075 })];
    const s = summarize(filterTransactions(list, { start: '2026-10-01', end: '2026-10-31' }));
    expect(minorToPlain(s.incomeMinor)).toBe('1000.00');
    expect(minorToPlain(s.expenseMinor)).toBe('250.75');
    expect(minorToPlain(s.netMinor)).toBe('749.25');
  });

  it('الصافي قد يكون سالبًا', () => {
    expect(summarize([tx({ amountMinor: 500 })]).netMinor).toBe(-500);
  });

  it('اختبار 2: حركة خارج الفترة لا تظهر ولا تُحسب', () => {
    const list = [tx({ date: '2026-09-30', amountMinor: 999 }), tx({ date: '2026-10-21', amountMinor: 1 }), tx({ date: '2026-11-01', amountMinor: 777 })];
    const f = filterTransactions(list, { start: '2026-10-01', end: '2026-10-20' });
    expect(f).toHaveLength(0);
    expect(summarize(f).expenseMinor).toBe(0);
  });

  it('اختبار 3: الفترة تشمل يوم البداية ويوم النهاية', () => {
    const list = [tx({ date: '2026-10-01', amountMinor: 100 }), tx({ date: '2026-10-20', amountMinor: 200 }), tx({ date: '2026-10-21', amountMinor: 400 })];
    const f = filterTransactions(list, { start: '2026-10-01', end: '2026-10-20' });
    expect(f.map((t) => t.date)).toEqual(['2026-10-01', '2026-10-20']);
    expect(summarize(f).expenseMinor).toBe(300);
  });

  it('البحث يتجاهل الهمزات والتشكيل، والتصفية بالنوع والدفع والتصنيف', () => {
    const list = [
      tx({ details: 'وجبة غداء', paymentMethod: 'card' }),
      tx({ details: 'إيجار الشقة', categoryId: 'exp-housing', paymentMethod: 'bank' }),
      tx({ type: 'income', details: 'مكافأة', categoryId: 'inc-other', notes: 'من العمل' }),
    ];
    expect(filterTransactions(list, { search: 'ايجار' })).toHaveLength(1);
    expect(filterTransactions(list, { search: 'العمل' })).toHaveLength(1);
    expect(filterTransactions(list, { type: 'income' })).toHaveLength(1);
    expect(filterTransactions(list, { paymentMethod: 'card' })[0].details).toBe('وجبة غداء');
    expect(filterTransactions(list, { categoryId: 'exp-housing' })).toHaveLength(1);
  });

  it('التوزيع حسب التصنيف مرتب ونسبه صحيحة', () => {
    const list = [tx({ amountMinor: 300 }), tx({ amountMinor: 100, categoryId: 'exp-bills' }), tx({ type: 'income', amountMinor: 5, categoryId: 'inc-gift' })];
    const r = byCategory(list, 'expense', DEFAULT_CATEGORIES);
    expect(r.map((x) => x.name)).toEqual(['طعام', 'فواتير']);
    expect(r[0].share).toBeCloseTo(0.75);
  });

  it('السلسلة الزمنية اليومية والشهرية', () => {
    const list = [tx({ date: '2026-10-01', amountMinor: 100 }), tx({ date: '2026-10-03', type: 'income', amountMinor: 50, categoryId: 'inc-gift' })];
    const days = timeSeries(list, '2026-10-01', '2026-10-05');
    expect(days).toHaveLength(5);
    expect(days[0].expenseMinor).toBe(100);
    expect(days[2].incomeMinor).toBe(50);
    const months = timeSeries(list, '2026-01-01', '2026-12-31');
    expect(months).toHaveLength(12);
    expect(months[9].expenseMinor).toBe(100);
  });

  it('الترتيب من الأحدث والتجميع حسب اليوم', () => {
    const list = sortNewestFirst([tx({ date: '2026-10-01' }), tx({ date: '2026-10-05' }), tx({ date: '2026-10-05', type: 'income', categoryId: 'inc-gift' })]);
    expect(list[0].date).toBe('2026-10-05');
    const g = groupByDay(list);
    expect(g).toHaveLength(2);
    expect(g[0].netMinor).toBe(0);
  });
});
