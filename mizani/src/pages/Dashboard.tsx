import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { PeriodPicker } from '../components/PeriodPicker';
import { SummaryCards } from '../components/SummaryCards';
import { CategoryBars, TrendChart } from '../components/Charts';
import { TransactionRow } from '../components/TransactionRow';
import { EmptyState } from '../components/EmptyState';
import { Logo } from '../components/Layout';
import { useDetails } from '../components/TransactionDetails';
import { byCategory, sortNewestFirst, summarize, timeSeries } from '../domain/reports';
import { resolvePeriod, usePeriod } from '../state/period';
import { useCategories, useReceiptCounts, useTransactionsInRange } from '../state/queries';
import { useSettings } from '../state/settings';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء الخير';
  return 'مساء النور';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { openDetails } = useDetails();
  const { period } = usePeriod();
  const { settings } = useSettings();
  const { start, end } = resolvePeriod(period, settings.numerals);
  const txs = useTransactionsInRange(start, end);
  const categories = useCategories() ?? [];
  const receiptCounts = useReceiptCounts();
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const data = useMemo(() => {
    if (!txs) return null;
    const sorted = sortNewestFirst(txs);
    // في «كل الفترات» نرسم المدى الفعلي للبيانات فقط
    const dates = txs.map((t) => t.date).sort();
    const chartStart = period.mode === 'all' ? dates[0] : start;
    const chartEnd = period.mode === 'all' ? dates[dates.length - 1] : end;
    return {
      summary: summarize(txs),
      recent: sorted.slice(0, 6),
      cats: byCategory(txs, 'expense', categories),
      series: txs.length ? timeSeries(txs, chartStart, chartEnd) : [],
    };
  }, [txs, categories, start, end, period.mode]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 md:hidden" />
          <div>
            <p className="muted text-sm">{greeting()} 👋</p>
            <h1 className="font-display text-2xl font-bold text-ink-adaptive">ميزاني</h1>
          </div>
        </div>
        <button className="btn-primary hidden sm:inline-flex md:hidden" onClick={() => navigate('/transactions/new')}>
          <Plus className="h-5 w-5" /> إضافة حركة
        </button>
      </header>

      <PeriodPicker />

      {data && <SummaryCards summary={data.summary} />}

      {data && data.recent.length === 0 && (
        <div className="card">
          <EmptyState
            title="لا توجد حركات في هذه الفترة"
            text="ابدأ بتسجيل أول دخل أو مصروف، وسترى الإجماليات والرسوم هنا مباشرة."
            action={<button className="btn-primary" onClick={() => navigate('/transactions/new')}><Plus className="h-5 w-5" /> إضافة أول حركة</button>}
          />
        </div>
      )}

      {data && data.recent.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <section className="card p-4 lg:col-span-3" aria-labelledby="recent-h">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="recent-h" className="text-base font-bold">آخر الحركات</h2>
              <Link to="/transactions" className="inline-flex items-center gap-1 text-sm font-medium text-ink-adaptive hover:underline">
                عرض الكل <ChevronLeft className="h-4 w-4" />
              </Link>
            </div>
            <ul className="-mx-2">
              {data.recent.map((t) => (
                <TransactionRow key={t.id} tx={t} category={catById.get(t.categoryId)} receipts={receiptCounts.get(t.id)} onOpen={openDetails} />
              ))}
            </ul>
          </section>

          <section className="card p-4 lg:col-span-2" aria-labelledby="cats-h">
            <h2 id="cats-h" className="mb-4 text-base font-bold">المصروفات حسب التصنيف</h2>
            {data.cats.length ? <CategoryBars data={data.cats} /> : <p className="muted py-6 text-center text-sm">لا توجد مصروفات في هذه الفترة.</p>}
          </section>

          <section className="card p-4 lg:col-span-5" aria-labelledby="trend-h">
            <h2 id="trend-h" className="mb-3 text-base font-bold">الدخل والمصروفات عبر الفترة</h2>
            <TrendChart data={data.series} />
          </section>
        </div>
      )}
    </div>
  );
}
