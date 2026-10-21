import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { buildDebtViews, type DebtView } from '../domain/debts';
import { todayISO } from '../lib/dates';

export function useDebtViews(): DebtView[] | undefined {
  return useLiveQuery(async () => {
    const [debts, payments] = await Promise.all([db.debts.toArray(), db.debtPayments.toArray()]);
    return buildDebtViews(debts, payments, todayISO());
  }, []);
}
