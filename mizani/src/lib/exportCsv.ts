import { db } from '../db/db';
import type { Transaction } from '../db/types';
import { buildCsv } from '../domain/csv';
import { sortNewestFirst } from '../domain/reports';
import { downloadBlob } from './download';

export async function exportTransactionsCsv(txs: Transaction[], currency: string, filenameHint: string) {
  const [categories, keys] = await Promise.all([db.categories.toArray(), db.receipts.orderBy('transactionId').keys()]);
  const counts = new Map<string, number>();
  for (const k of keys as string[]) counts.set(k, (counts.get(k) ?? 0) + 1);
  const csv = buildCsv(sortNewestFirst(txs), categories, currency, counts);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `mizani-${filenameHint}.csv`);
}
