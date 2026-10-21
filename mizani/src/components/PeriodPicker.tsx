import { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, resolvePeriod, shiftPeriod, usePeriod, type Period } from '../state/period';
import { useSettings } from '../state/settings';
import { isValidISODate, shiftMonth, todayISO } from '../lib/dates';
import { Sheet } from './Sheet';

export function PeriodPicker({ allowAll = false }: { allowAll?: boolean }) {
  const { period, setPeriod } = usePeriod();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const r = resolvePeriod(period, settings.numerals);
  const canShift = period.mode === 'month' || period.mode === 'year';

  return (
    <>
      <div className="card flex items-center gap-1 p-1.5">
        <button
          className="btn-ghost !min-h-[2.5rem] !px-2.5"
          onClick={() => setPeriod(shiftPeriod(period, -1))}
          disabled={!canShift}
          aria-label={period.mode === 'year' ? 'العام السابق' : 'الشهر السابق'}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button className="btn-ghost !min-h-[2.5rem] flex-1 !px-2 font-display font-semibold" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <CalendarRange className="h-4 w-4 opacity-60" />
          <span className="truncate">{r.label}</span>
        </button>
        <button
          className="btn-ghost !min-h-[2.5rem] !px-2.5"
          onClick={() => setPeriod(shiftPeriod(period, 1))}
          disabled={!canShift}
          aria-label={period.mode === 'year' ? 'العام التالي' : 'الشهر التالي'}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      {open && <PeriodSheet open={open} onClose={() => setOpen(false)} period={period} allowAll={allowAll} onPick={(p) => { setPeriod(p); setOpen(false); }} />}
    </>
  );
}

function PeriodSheet({ open, onClose, period, onPick, allowAll }: { open: boolean; onClose: () => void; period: Period; onPick: (p: Period) => void; allowAll: boolean }) {
  const today = todayISO();
  const [y, m] = today.split('-').map(Number);
  const prev = shiftMonth(y, m, -1);
  const cur = resolvePeriod(period);
  const [start, setStart] = useState(cur.start.startsWith('1900') ? `${y}-${String(m).padStart(2, '0')}-01` : cur.start);
  const [end, setEnd] = useState(cur.end.startsWith('2200') ? today : cur.end);
  const [error, setError] = useState('');

  const isThisMonth = period.mode === 'month' && period.year === y && period.month === m;
  const isPrevMonth = period.mode === 'month' && period.year === prev.year && period.month === prev.month;

  const applyCustom = () => {
    if (!isValidISODate(start) || !isValidISODate(end)) return setError('اختر تاريخ البداية والنهاية');
    if (end < start) return setError('تاريخ النهاية لا يمكن أن يسبق تاريخ البداية');
    setError('');
    onPick({ mode: 'custom', start, end });
  };

  return (
    <Sheet open={open} onClose={onClose} title="اختيار الفترة">
      <div className="grid grid-cols-2 gap-2">
        <button className="chip justify-center !min-h-[2.75rem]" aria-pressed={isThisMonth} onClick={() => onPick(currentMonth())}>هذا الشهر</button>
        <button className="chip justify-center !min-h-[2.75rem]" aria-pressed={isPrevMonth} onClick={() => onPick({ mode: 'month', ...prev })}>الشهر السابق</button>
        <button className="chip justify-center !min-h-[2.75rem]" aria-pressed={period.mode === 'year' && period.year === y} onClick={() => onPick({ mode: 'year', year: y })}>هذا العام</button>
        {allowAll && (
          <button className="chip justify-center !min-h-[2.75rem]" aria-pressed={period.mode === 'all'} onClick={() => onPick({ mode: 'all' })}>كل الفترات</button>
        )}
      </div>

      <fieldset className="mt-5 rounded-2xl border p-4 line">
        <legend className="px-2 text-sm font-semibold">فترة مخصصة</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="label">من تاريخ</span>
            <input type="date" className="field" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span className="label">إلى تاريخ</span>
            <input type="date" className="field" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!error} />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-expense" role="alert">{error}</p>}
        <button className="btn-primary mt-4 w-full" onClick={applyCustom}>تطبيق الفترة</button>
      </fieldset>
    </Sheet>
  );
}
