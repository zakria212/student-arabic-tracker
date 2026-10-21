import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { Money } from '../components/Money';
import { byCategory, filterTransactions, sortNewestFirst, summarize, type CategoryShare } from '../domain/reports';
import { paymentLabel, TYPE_LABEL } from '../db/types';
import { formatDateAr, isValidISODate, todayISO, toDigits } from '../lib/dates';
import { formatPercent } from '../lib/money';
import { useCategories, useSections, useTransactionsInRange } from '../state/queries';
import { useSettings } from '../state/settings';

/** صفحة تقرير منسقة للطباعة أو الحفظ PDF من المتصفح */
export default function PrintReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { settings, currency } = useSettings();
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  const valid = isValidISODate(start) && isValidISODate(end) && start <= end;
  const section = params.get('section') ?? 'all';
  const sections = useSections() ?? [];
  const sectionName = section === 'none' ? 'بدون قسم' : sections.find((x) => x.id === section)?.name;
  const rangeTxs = useTransactionsInRange(valid ? start : '0', valid ? end : '0');
  const txs = useMemo(() => rangeTxs && filterTransactions(rangeTxs, { sectionId: section }), [rangeTxs, section]);
  const categories = useCategories() ?? [];
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const data = useMemo(() => {
    if (!txs) return null;
    return {
      list: sortNewestFirst(txs),
      summary: summarize(txs),
      exp: byCategory(txs, 'expense', categories),
      inc: byCategory(txs, 'income', categories),
    };
  }, [txs, categories]);

  const n = (x: number | string) => toDigits(x, settings.numerals);

  return (
    <div className="print-root mx-auto max-w-4xl px-4 py-6 text-[13px] leading-6">
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <button className="btn-outline" onClick={() => navigate(-1)}><ArrowRight className="h-4 w-4" /> رجوع</button>
        <button className="btn-primary" onClick={() => window.print()} disabled={!data}><Printer className="h-4 w-4" /> طباعة / حفظ PDF</button>
        <span className="muted text-xs">اختر «حفظ بتنسيق PDF» من نافذة الطباعة لحفظ التقرير كملف.</span>
      </div>

      {!valid && <p>الفترة غير صالحة.</p>}

      {valid && data && (
        <article>
          <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink-adaptive">تقرير ميزاني المالي</h1>
              <p className="mt-1">الفترة: من <b>{formatDateAr(start, settings.numerals)}</b> إلى <b>{formatDateAr(end, settings.numerals)}</b> (شاملة)</p>
              {section !== 'all' && sectionName && <p>القسم: <b>{sectionName}</b></p>}
              <p className="muted text-xs">العملة: {currency.name} ({currency.code}) · أُعد في {formatDateAr(todayISO(), settings.numerals)}</p>
            </div>
          </header>

          <section className="mb-6 grid grid-cols-3 gap-3">
            {[
              ['إجمالي الدخل', data.summary.incomeMinor, n(data.summary.incomeCount)],
              ['إجمالي المصروفات', data.summary.expenseMinor, n(data.summary.expenseCount)],
              ['الصافي (الدخل − المصروفات)', data.summary.netMinor, null],
            ].map(([l, v, c]) => (
              <div key={l as string} className="card p-3">
                <div className="muted text-xs">{l}</div>
                <Money minor={v as number} signed={c === null} className="font-display text-lg font-bold" />
                {c !== null && <div className="muted text-[11px]">{c} حركة</div>}
              </div>
            ))}
          </section>

          <div className="mb-6 grid grid-cols-2 gap-4">
            <PrintCats title="المصروفات حسب التصنيف" rows={data.exp} />
            <PrintCats title="الدخل حسب التصنيف" rows={data.inc} />
          </div>

          <section>
            <h2 className="mb-2 text-base font-bold">سجل الحركات ({n(data.list.length)})</h2>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b-2 border-[var(--line)] text-start">
                  <th className="py-1.5 text-start">التاريخ</th>
                  <th className="text-start">النوع</th>
                  <th className="text-start">السبب / المصدر</th>
                  <th className="text-start">التصنيف</th>
                  <th className="text-start">الدفع</th>
                  <th className="text-end">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--line)] align-top">
                    <td className="whitespace-nowrap py-1.5"><span className="num">{n(t.date)}</span></td>
                    <td>{TYPE_LABEL[t.type]} {t.type === 'income' ? '+' : '−'}</td>
                    <td>{t.details}{t.notes && <div className="muted text-[11px]">{t.notes}</div>}</td>
                    <td>{catName.get(t.categoryId) ?? '—'}</td>
                    <td>{paymentLabel(t.paymentMethod) || '—'}</td>
                    <td className="text-end"><Money minor={t.amountMinor} type={t.type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="muted mt-6 text-[11px]">الصافي هنا هو الفرق بين الدخل والمصروفات المسجلة في الفترة، وليس رصيد حساب بنكي.</p>
        </article>
      )}
    </div>
  );
}

function PrintCats({ title, rows }: { title: string; rows: CategoryShare[] }) {
  const { settings } = useSettings();
  return (
    <section className="card p-3">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      {rows.length === 0 ? <p className="muted text-xs">لا يوجد.</p> : (
        <table className="w-full text-[12px]">
          <tbody>
            {rows.map((c) => (
              <tr key={c.categoryId} className="border-b border-[var(--line)] last:border-0">
                <td className="py-1">{c.name}</td>
                <td className="text-end"><Money minor={c.totalMinor} /></td>
                <td className="num w-14 text-end">{formatPercent(c.share, settings.numerals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
