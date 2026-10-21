import type { Category, Section, Transaction } from '../db/types';
import { paymentLabel, TYPE_LABEL } from '../db/types';
import { minorToPlain } from '../lib/money';

const BOM = '﻿';

/** يحمي من حقن الصيغ في Excel ويهرب علامات الاقتباس */
function cell(value: string | number | undefined): string {
  let s = value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export const CSV_HEADERS = ['التاريخ', 'النوع', 'المبلغ', 'العملة', 'السبب / المصدر', 'التصنيف', 'القسم', 'طريقة الدفع', 'ملاحظات', 'عدد المرفقات', 'المعرّف'];

export function buildCsv(
  txs: Transaction[],
  categories: Category[],
  currency: string,
  receiptCounts: Map<string, number> = new Map(),
  sections: Section[] = [],
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const secName = new Map(sections.map((x) => [x.id, x.name]));
  const rows = [CSV_HEADERS.map(cell).join(',')];
  for (const t of txs) {
    rows.push(
      [
        t.date,
        TYPE_LABEL[t.type],
        minorToPlain(t.amountMinor),
        currency,
        t.details,
        catName.get(t.categoryId) ?? '',
        (t.sectionId && secName.get(t.sectionId)) || '',
        paymentLabel(t.paymentMethod),
        t.notes ?? '',
        receiptCounts.get(t.id) ?? 0,
        t.id,
      ]
        .map((v, i) => (i === 2 || i === 9 ? String(v) : cell(v)))
        .join(','),
    );
  }
  return BOM + rows.join('\r\n') + '\r\n';
}
