import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { PeriodPicker } from '../components/PeriodPicker';
import { TransactionRow } from '../components/TransactionRow';
import { EmptyState } from '../components/EmptyState';
import { Money } from '../components/Money';
import { useDetails } from '../components/TransactionDetails';
import { filterTransactions, groupByDay, sortNewestFirst, summarize, type Filters } from '../domain/reports';
import { PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '../db/types';
import { formatDayHeading, todayISO, toDigits } from '../lib/dates';
import { exportTransactionsCsv } from '../lib/exportCsv';
import { resolvePeriod, usePeriod } from '../state/period';
import { useCategories, useReceiptCounts, useTransactionsInRange } from '../state/queries';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';

const PAGE = 150;

export default function Transactions() {
  const navigate = useNavigate();
  const toast = useToast();
  const { openDetails } = useDetails();
  const { period } = usePeriod();
  const { settings } = useSettings();
  const { start, end, label } = resolvePeriod(period, settings.numerals);
  const txs = useTransactionsInRange(start, end);
  const categories = useCategories() ?? [];
  const receiptCounts = useReceiptCounts();
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // الفلاتر في عنوان الصفحة حتى تبقى عند الرجوع من التعديل
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = (params.get('type') ?? 'all') as TransactionType | 'all';
  const categoryId = params.get('cat') ?? 'all';
  const paymentMethod = (params.get('pm') ?? 'all') as PaymentMethod | 'all';
  const grouped = params.get('group') !== '0';
  const setParam = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(params);
    if (v === def) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };
  const [showFilters, setShowFilters] = useState(categoryId !== 'all' || paymentMethod !== 'all');
  const [limit, setLimit] = useState(PAGE);

  const filters: Filters = { type, categoryId, paymentMethod, search: q };
  const filtered = useMemo(
    () => (txs ? sortNewestFirst(filterTransactions(txs, filters)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs, q, type, categoryId, paymentMethod],
  );
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const visible = filtered.slice(0, limit);
  const activeFilters = (type !== 'all' ? 1 : 0) + (categoryId !== 'all' ? 1 : 0) + (paymentMethod !== 'all' ? 1 : 0) + (q ? 1 : 0);
  const today = todayISO();

  const catOptions = categories.filter((c) => type === 'all' || c.type === type);

  const onExport = async () => {
    if (!filtered.length) return toast('لا توجد حركات لتصديرها', { kind: 'info' });
    await exportTransactionsCsv(filtered, settings.currency, period.mode === 'all' ? 'all' : `${start}_${end}`);
    toast(`تم تصدير ${toDigits(filtered.length, settings.numerals)} حركة بصيغة CSV`);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الحركات</h1>
        <div className="flex gap-2">
          <button className="btn-outline !px-3" onClick={onExport} aria-label="تصدير الحركات المعروضة CSV">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">تصدير CSV</span>
          </button>
          <button className="btn-primary hidden md:inline-flex" onClick={() => navigate('/transactions/new')}>
            <Plus className="h-5 w-5" /> إضافة
          </button>
        </div>
      </header>

      <PeriodPicker allowAll />

      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">بحث</span>
          <Search className="muted pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value, '')}
            placeholder="ابحث في السبب أو المصدر أو الملاحظات"
            className="field !pr-9"
          />
        </label>
        <button
          className="btn-outline relative !px-3"
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          aria-controls="filters"
          aria-label="خيارات التصفية"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-ink">{activeFilters}</span>}
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="نوع الحركة">
        {([['all', 'الكل'], ['expense', 'مصروفات −'], ['income', 'دخل +']] as const).map(([v, l]) => (
          <button key={v} className="chip" aria-pressed={type === v} onClick={() => {
            const next = new URLSearchParams(params);
            if (v === 'all') next.delete('type'); else next.set('type', v);
            next.delete('cat');
            setParams(next, { replace: true });
          }}>{l}</button>
        ))}
      </div>

      {showFilters && (
        <div id="filters" className="card anim-fade grid gap-3 p-4 sm:grid-cols-3">
          <label>
            <span className="label">التصنيف</span>
            <select className="field" value={categoryId} onChange={(e) => setParam('cat', e.target.value, 'all')}>
              <option value="all">كل التصنيفات</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>{type === 'all' ? `${c.type === 'income' ? 'دخل' : 'مصروف'} · ` : ''}{c.name}{c.isActive ? '' : ' (معطّل)'}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">طريقة الدفع</span>
            <select className="field" value={paymentMethod} onChange={(e) => setParam('pm', e.target.value, 'all')}>
              <option value="all">الكل</option>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="flex min-h-[2.75rem] flex-1 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#123B49]" checked={grouped} onChange={(e) => setParam('group', e.target.checked ? '1' : '0', '1')} />
              تجميع حسب اليوم
            </label>
            {activeFilters > 0 && (
              <button className="btn-ghost !px-2 text-sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                <X className="h-4 w-4" /> مسح
              </button>
            )}
          </div>
        </div>
      )}

      {txs && (
        <div className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="muted">{toDigits(filtered.length, settings.numerals)} حركة · {label}</span>
          <span className="flex flex-wrap gap-x-4">
            <span>دخل: <Money minor={summary.incomeMinor} className="font-semibold text-income dark:text-[#4FC7A6]" /></span>
            <span>مصروف: <Money minor={summary.expenseMinor} className="font-semibold text-expense dark:text-[#EE8C92]" /></span>
            <span>الصافي: <Money minor={summary.netMinor} signed className="font-semibold" /></span>
          </span>
        </div>
      )}

      {txs && filtered.length === 0 && (
        <div className="card">
          {txs.length === 0 ? (
            <EmptyState
              title="لا توجد حركات في هذه الفترة"
              text="جرّب فترة أخرى أو أضف حركة جديدة."
              action={<button className="btn-primary" onClick={() => navigate('/transactions/new')}><Plus className="h-5 w-5" /> إضافة حركة</button>}
            />
          ) : (
            <EmptyState title="لا نتائج مطابقة" text="غيّر كلمات البحث أو خيارات التصفية." icon={<Search className="h-9 w-9" />} />
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="card p-2 sm:p-3">
          {grouped ? (
            groupByDay(visible).map((g) => (
              <section key={g.date} className="mb-1" aria-label={formatDayHeading(g.date, today, settings.numerals)}>
                <div className="sticky top-0 z-10 flex items-center justify-between px-2 py-2 text-xs font-semibold" style={{ background: 'var(--surface)' }}>
                  <span className="muted">{formatDayHeading(g.date, today, settings.numerals)}</span>
                  <Money minor={g.netMinor} signed className="muted" />
                </div>
                <ul>
                  {g.items.map((t) => (
                    <TransactionRow key={t.id} tx={t} category={catById.get(t.categoryId)} receipts={receiptCounts.get(t.id)} showDate={false} onOpen={openDetails} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul>
              {visible.map((t) => (
                <TransactionRow key={t.id} tx={t} category={catById.get(t.categoryId)} receipts={receiptCounts.get(t.id)} onOpen={openDetails} />
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <button className="btn-outline mt-2 w-full" onClick={() => setLimit((l) => l + PAGE)}>
              عرض المزيد ({toDigits(filtered.length - limit, settings.numerals)} متبقية)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
