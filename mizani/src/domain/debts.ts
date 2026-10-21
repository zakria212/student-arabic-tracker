import type { Debt, DebtDirection, DebtPayment } from '../db/types';

export type DebtStatus = 'open' | 'overdue' | 'settled';

export type DebtView = Debt & { paidMinor: number; remainingMinor: number; status: DebtStatus; payments: DebtPayment[] };

/** يحسب المسدَّد والمتبقي والحالة لكل دين */
export function buildDebtViews(debts: Debt[], payments: DebtPayment[], today: string): DebtView[] {
  const byDebt = new Map<string, DebtPayment[]>();
  for (const p of payments) {
    const list = byDebt.get(p.debtId) ?? [];
    list.push(p);
    byDebt.set(p.debtId, list);
  }
  return debts.map((d) => {
    const ps = (byDebt.get(d.id) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const paidMinor = ps.reduce((a, p) => a + p.amountMinor, 0);
    const remainingMinor = Math.max(0, d.amountMinor - paidMinor);
    const status: DebtStatus = remainingMinor === 0 ? 'settled' : d.dueDate && d.dueDate < today ? 'overdue' : 'open';
    return { ...d, paidMinor, remainingMinor, status, payments: ps };
  });
}

/** المفتوحة أولًا (المتأخرة ثم الأقرب استحقاقًا)، ثم المسددة */
export function sortDebts(views: DebtView[]): DebtView[] {
  const rank = { overdue: 0, open: 1, settled: 2 } as const;
  return [...views].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status !== 'settled') {
      const ad = a.dueDate ?? '9999-12-31', bd = b.dueDate ?? '9999-12-31';
      if (ad !== bd) return ad.localeCompare(bd);
    }
    return b.date.localeCompare(a.date);
  });
}

export type DebtTotals = { remainingMinor: number; openCount: number; overdueCount: number };

export function debtTotals(views: DebtView[], direction: DebtDirection): DebtTotals {
  let remainingMinor = 0, openCount = 0, overdueCount = 0;
  for (const v of views) {
    if (v.direction !== direction || v.status === 'settled') continue;
    remainingMinor += v.remainingMinor;
    openCount++;
    if (v.status === 'overdue') overdueCount++;
  }
  return { remainingMinor, openCount, overdueCount };
}
