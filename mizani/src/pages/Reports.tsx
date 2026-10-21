import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Printer, Table2, BarChart3 } from 'lucide-react';
import { PeriodPicker } from '../components/PeriodPicker';
import { SummaryCards } from '../components/SummaryCards';
import { CategoryBars, TrendChart } from '../components/Charts';
import { CategoryIcon } from '../components/CategoryIcon';
import { EmptyState } from '../components/EmptyState';
import { Money } from '../components/Money';
import { byCategory, pickGranularity, summarize, timeSeries, type CategoryShare } from '../domain/reports';
import { formatPercent } from '../lib/money';
import { toDigits } from '../lib/dates';
import { exportTransactionsCsv } from '../lib/exportCsv';
import { resolvePeriod, usePeriod } from '../state/period';
import { useCategories, useTransactionsInRange } from '../state/queries';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';

export default function Reports() {
  const navigate = useNavigate();
  const toast = useToast();
  const { period } = usePeriod();
  const { settings } = useSettings();
  const { start, end, label } = resolvePeriod(period, settings.numerals);
  const txs = useTransactionsInRange(start, end);
  const categories = useCategories() ?? [];
  const [trendAsTable, setTrendAsTable] = useState(false);

  const r = useMemo(() => {
    if (!txs) return null;
    const dates = txs.map((t) => t.date).sort();
    const s = period.mode === 'all' ? dates[0] : start;
    const e = period.mode === 'all' ? dates[dates.length - 1] : end;
    return {
      summary: summarize(txs),
      expenseCats: byCategory(txs, 'expense', categories),
      incomeCats: byCategory(txs, 'income', categories),
      series: txs.length ? timeSeries(txs, s, e) : [],
      granularity: txs.length ? pickGranularity(s, e) : 'day',
      range: { s, e },
    };
  }, [txs, categories, start, end, period.mode]);

  const spendRatio = r && r.summary.incomeMinor > 0 ? r.summary.expenseMinor / r.summary.incomeMinor : null;
  const g = { day: 'يوميًا', week: 'أسبوعيًا', month: 'شهريًا' }[r?.granularity ?? 'day'];

  const onCsv = async () => {
    if (!txs?.length) return toast('لا توجد حركات في هذه الفترة', { kind: 'info' });
    await exportTransactionsCsv(txs, settings.currency, period.mode === 'all' ? 'all' : `${start}_${end}`);
    toast('تم تصدير ملف CSV');
  };

  const onPrint = () => {
    if (!r || !txs?.length) return toast('لا توجد حركات في هذه الفترة', { kind: 'info' });
    const p = new URLSearchParams({ start: r.range.s, end: r.range.e, label });
    navigate(`/reports/print?${p}`);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <div className="flex gap-2">
          <button className="btn-outline !px-3" onClick={onCsv}><Download className="h-4 w-4" /> CSV</button>
          <button className="btn-outline !px-3" onClick={onPrint}><Printer className="h-4 w-4" /> طباعة / PDF</button>
        </div>
      </header>

      <PeriodPicker allowAll />

      {r && <SummaryCards summary={r.summary} />}

      {r && txs && txs.length === 0 && (
        <div className="card"><EmptyState title="لا توجد بيانات لهذه الفترة" text="اختر فترة أخرى لرؤية التقرير." /></div>
      )}

      {r && txs && txs.length > 0 && (
        <>
          {spendRatio !== null && (
            <div className="card flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium">نسبة المصروفات إلى الدخل</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full surface-2">
                  <div className={`h-full rounded-full ${spendRatio > 1 ? 'bg-expense' : 'bg-gold'}`} style={{ width: `${Math.min(spendRatio, 1) * 100}%` }} />
                </div>
                <p className="muted mt-1.5 text-xs">
                  {spendRatio > 1 ? 'المصروفات تجاوزت الدخل في هذه الفترة.' : `بقي ${formatPercent(1 - spendRatio, settings.numerals)} من الدخل بعد المصروفات.`}
                </p>
              </div>
              <div className="num font-display text-2xl font-bold">{formatPercent(spendRatio, settings.numerals)}</div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="mb-4 text-base font-bold">أكثر تصنيفات المصروفات استهلاكًا</h2>
              {r.expenseCats.length ? <CategoryBars data={r.expenseCats} limit={8} /> : <p className="muted py-4 text-center text-sm">لا توجد مصروفات.</p>}
            </section>
            <section className="card p-4">
              <h2 className="mb-4 text-base font-bold">مصادر الدخل</h2>
              {r.incomeCats.length ? <CategoryBars data={r.incomeCats} limit={8} /> : <p className="muted py-4 text-center text-sm">لا يوجد دخل.</p>}
            </section>
          </div>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">الاتجاه الزمني ({g})</h2>
              <button className="btn-ghost !min-h-[2.25rem] !px-2 text-sm" onClick={() => setTrendAsTable((x) => !x)}>
                {trendAsTable ? <><BarChart3 className="h-4 w-4" /> رسم</> : <><Table2 className="h-4 w-4" /> جدول</>}
              </button>
            </div>
            {trendAsTable ? (
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="muted sticky top-0 text-xs" style={{ background: 'var(--surface)' }}>
                    <tr><th className="py-2 text-start font-medium">الفترة</th><th className="text-end font-medium">الدخل</th><th className="text-end font-medium">المصروفات</th><th className="text-end font-medium">الصافي</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {r.series.filter((b) => b.incomeMinor || b.expenseMinor).map((b) => (
                      <tr key={b.key}>
                        <td className="py-2"><span className="num">{toDigits(b.start === b.end ? b.start : `${b.start} → ${b.end}`, settings.numerals)}</span></td>
                        <td className="text-end"><Money minor={b.incomeMinor} /></td>
                        <td className="text-end"><Money minor={b.expenseMinor} /></td>
                        <td className="text-end"><Money minor={b.incomeMinor - b.expenseMinor} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <TrendChart data={r.series} height={260} />
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="p-4 pb-2 text-base font-bold">التوزيع التفصيلي حسب التصنيف</h2>
            <CategoryTable title="المصروفات" rows={r.expenseCats} total={r.summary.expenseMinor} />
            <CategoryTable title="الدخل" rows={r.incomeCats} total={r.summary.incomeMinor} />
          </section>
        </>
      )}
    </div>
  );
}

function CategoryTable({ title, rows, total }: { title: string; rows: CategoryShare[]; total: number }) {
  const { settings } = useSettings();
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full min-w-[420px] text-sm">
        <caption className="muted py-2 text-start text-xs font-semibold">{title}</caption>
        <thead className="muted text-xs">
          <tr className="border-b line">
            <th className="py-2 text-start font-medium">التصنيف</th>
            <th className="text-center font-medium">عدد الحركات</th>
            <th className="text-end font-medium">المبلغ</th>
            <th className="text-end font-medium">النسبة</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {rows.map((c) => (
            <tr key={c.categoryId}>
              <td className="py-2"><span className="flex items-center gap-2"><CategoryIcon icon={c.icon} color={c.color} size="sm" />{c.name}</span></td>
              <td className="num text-center">{toDigits(c.count, settings.numerals)}</td>
              <td className="text-end"><Money minor={c.totalMinor} /></td>
              <td className="num text-end">{formatPercent(c.share, settings.numerals)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold line">
            <td className="py-2">الإجمالي</td><td /><td className="text-end"><Money minor={total} /></td><td className="num text-end">{formatPercent(1, settings.numerals)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
