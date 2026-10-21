import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Category, Transaction } from '../db/types';

/** الحركات ضمن مدى زمني (شامل) باستخدام فهرس التاريخ */
export function useTransactionsInRange(start: string, end: string): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.where('date').between(start, end, true, true).toArray(), [start, end]);
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
}

/** عدد المرفقات لكل حركة دون تحميل بيانات الصور */
export function useReceiptCounts(): Map<string, number> {
  return (
    useLiveQuery(async () => {
      const keys = (await db.receipts.orderBy('transactionId').keys()) as string[];
      const m = new Map<string, number>();
      for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    }, []) ?? new Map()
  );
}

export function useTransactionCount(): number | undefined {
  return useLiveQuery(() => db.transactions.count(), []);
}
