import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CheckCircle2, HandCoins, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Money } from '../components/Money';
import { ConfirmDialog, Sheet } from '../components/Sheet';
import { addDebtPayment, deleteDebt, deleteDebtPayment, restoreDebt, saveDebt, ValidationError } from '../db/repo';
import { DEBT_LABEL, type DebtDirection } from '../db/types';
import { debtTotals, sortDebts, type DebtView } from '../domain/debts';
import { normalizeArabic } from '../domain/reports';
import { formatDateAr, isValidISODate, todayISO, toDigits } from '../lib/dates';
import { minorToPlain, parseAmount } from '../lib/money';
import { useDebtViews } from '../state/debts';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';

export default function Debts() {
  const views = useDebtViews();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const direction: DebtDirection = params.get('d') === 'borrowed' ? 'borrowed' : 'lent';
  const setDirection = (d: DebtDirection) => setParams(d === 'lent' ? {} : { d }, { replace: true });
  const [showSettled, setShowSettled] = useState(false);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ debt?: DebtView } | null>(null);

  const lent = views ? debtTotals(views, 'lent') : null;
  const borrowed = views ? debtTotals(views, 'borrowed') : null;
  const n = (x: number) => toDigits(x, settings.numerals);

  const list = useMemo(() => {
    if (!views) return [];
    const nq = normalizeArabic(q);
    return sortDebts(views.filter((v) => v.direction === direction && (showSettled || v.status !== 'settled') && (!nq || normalizeArabic(`${v.person} ${v.notes ?? ''}`).includes(nq))));
  }, [views, direction, showSettled, q]);
  const settledCount = views?.filter((v) => v.direction === direction && v.status === 'settled').length ?? 0;
  const opened = views?.find((v) => v.id === openId);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الديون</h1>
        <button className="btn-primary" onClick={() => setForm({})}><Plus className="h-5 w-5" /> دين جديد</button>
      </header>

      {lent && borrowed && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setDirection('lent')} className={`card p-4 text-start transition ${direction === 'lent' ? 'ring-2 ring-income/60' : ''}`}>
            <div className="flex items-center gap-2 text-sm font-medium text-income dark:text-[#4FC7A6]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-income-soft dark:bg-[#123a31]"><ArrowDownLeft className="h-4 w-4" /></span>
              لك عند الآخرين
            </div>
            <Money minor={lent.remainingMinor} className="mt-3 block font-display text-xl font-bold" />
            <div className="muted mt-1 text-xs">
              {n(lent.openCount)} دين مفتوح{lent.overdueCount > 0 && <span className="font-semibold text-expense"> · {n(lent.overdueCount)} متأخر</span>}
            </div>
          </button>
          <button onClick={() => setDirection('borrowed')} className={`card p-4 text-start transition ${direction === 'borrowed' ? 'ring-2 ring-expense/60' : ''}`}>
            <div className="flex items-center gap-2 text-sm font-medium text-expense dark:text-[#EE8C92]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-expense-soft dark:bg-[#3a1d20]"><ArrowUpRight className="h-4 w-4" /></span>
              عليك للآخرين
            </div>
            <Money minor={borrowed.remainingMinor} className="mt-3 block font-display text-xl font-bold" />
            <div className="muted mt-1 text-xs">
              {n(borrowed.openCount)} دين مفتوح{borrowed.overdueCount > 0 && <span className="font-semibold text-expense"> · {n(borrowed.overdueCount)} متأخر</span>}
            </div>
          </button>
        </div>
      )}

      <div role="tablist" aria-label="نوع الدين" className="card grid grid-cols-2 gap-1 p-1">
        {(['lent', 'borrowed'] as const).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={direction === d}
            onClick={() => setDirection(d)}
            className={`min-h-[2.75rem] rounded-xl font-display font-semibold transition ${direction === d ? 'bg-ink text-white dark:bg-[#2B7A90]' : 'muted hover:bg-[var(--surface-2)]'}`}
          >
            {DEBT_LABEL[d].tab}
            <span className="block text-[11px] font-normal opacity-80">{DEBT_LABEL[d].who}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">بحث بالاسم</span>
          <Search className="muted pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input id="debt-search" type="search" className="field !pr-9" placeholder="ابحث باسم الشخص" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {settledCount > 0 && (
          <button className="chip" aria-pressed={showSettled} onClick={() => setShowSettled((s) => !s)}>
            المسددة ({n(settledCount)})
          </button>
        )}
      </div>

      {views && list.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<HandCoins className="h-9 w-9" />}
            title={q ? 'لا نتائج مطابقة' : direction === 'lent' ? 'لا أحد مدين لك حاليًا' : 'لا ديون عليك حاليًا'}
            text={q ? undefined : direction === 'lent' ? 'سجّل المبالغ التي أخذها منك الآخرون لتتابع سدادها.' : 'سجّل المبالغ التي أخذتها من الآخرين لتتذكر سدادها.'}
            action={!q && <button className="btn-primary" onClick={() => setForm({})}><Plus className="h-5 w-5" /> دين جديد</button>}
          />
        </div>
      )}

      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((v) => <DebtRow key={v.id} v={v} onOpen={() => setOpenId(v.id)} />)}
        </ul>
      )}

      {form && <DebtForm debt={form.debt} defaultDirection={direction} onClose={() => setForm(null)} onSaved={(d) => setDirection(d)} />}
      {opened && <DebtDetails v={opened} onClose={() => setOpenId(null)} onEdit={() => { setForm({ debt: opened }); }} />}
    </div>
  );
}

function StatusPill({ v }: { v: DebtView }) {
  const { settings } = useSettings();
  if (v.status === 'settled') return <span className="inline-flex items-center gap-1 rounded-full bg-income-soft px-2 py-0.5 text-[11px] font-semibold text-income dark:bg-[#123a31] dark:text-[#4FC7A6]"><CheckCircle2 className="h-3 w-3" /> مسدَّد</span>;
  if (v.status === 'overdue') return <span className="rounded-full bg-expense px-2 py-0.5 text-[11px] font-semibold text-white">متأخر منذ {formatDateAr(v.dueDate!, settings.numerals, false)}</span>;
  if (v.dueDate) return <span className="muted inline-flex items-center gap-1 text-[11px]"><CalendarClock className="h-3 w-3" /> يستحق {formatDateAr(v.dueDate, settings.numerals, false)}</span>;
  return null;
}

function DebtRow({ v, onOpen }: { v: DebtView; onOpen: () => void }) {
  const { settings } = useSettings();
  const pct = v.amountMinor ? v.paidMinor / v.amountMinor : 0;
  const lent = v.direction === 'lent';
  return (
    <li>
      <button onClick={onOpen} className={`card flex w-full items-center gap-3 p-3.5 text-start transition hover:bg-[var(--surface-2)] ${v.status === 'settled' ? 'opacity-70' : ''}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ${lent ? 'bg-income-soft text-income dark:bg-[#123a31] dark:text-[#4FC7A6]' : 'bg-expense-soft text-expense dark:bg-[#3a1d20] dark:text-[#EE8C92]'}`} aria-hidden>
          {v.person.trim().charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{v.person}</span>
            <Money minor={v.remainingMinor} className="font-semibold" />
          </span>
          <span className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span className="muted truncate">{formatDateAr(v.date, settings.numerals)}</span>
            <StatusPill v={v} />
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full surface-2" aria-label={`مسدَّد ${Math.round(pct * 100)}٪`}>
            <span className={`block h-full rounded-full ${lent ? 'bg-income' : 'bg-expense'}`} style={{ width: `${pct * 100}%` }} />
          </span>
          <span className="muted mt-1 block text-[11px]">
            {v.paidMinor > 0 ? <>سُدِّد <Money minor={v.paidMinor} /> من <Money minor={v.amountMinor} /></> : <>المبلغ الكامل <Money minor={v.amountMinor} /></>}
          </span>
        </span>
      </button>
    </li>
  );
}

function DebtForm({ debt, defaultDirection, onClose, onSaved }: { debt?: DebtView; defaultDirection: DebtDirection; onClose: () => void; onSaved: (d: DebtDirection) => void }) {
  const toast = useToast();
  const { currency } = useSettings();
  const views = useDebtViews();
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection);
  const [person, setPerson] = useState(debt?.person ?? '');
  const [amount, setAmount] = useState(debt ? minorToPlain(debt.amountMinor) : '');
  const [date, setDate] = useState(debt?.date ?? todayISO());
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [notes, setNotes] = useState(debt?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const people = useMemo(() => [...new Set((views ?? []).map((v) => v.person))], [views]);

  const save = async () => {
    const e: Record<string, string> = {};
    const a = parseAmount(amount);
    if (!person.trim()) e.person = 'اكتب اسم الشخص';
    if (!a.ok) e.amount = a.error;
    if (!isValidISODate(date)) e.date = 'اختر تاريخًا صحيحًا';
    if (dueDate && dueDate < date) e.dueDate = 'تاريخ الاستحقاق لا يسبق تاريخ الدين';
    setErrors(e);
    if (Object.keys(e).length || !a.ok) return;
    setBusy(true);
    try {
      await saveDebt({ id: debt?.id, direction, person, amountMinor: a.minor, date, dueDate: dueDate || undefined, notes });
      toast(debt ? 'تم حفظ التعديلات' : 'تم تسجيل الدين');
      onSaved(direction);
      onClose();
    } catch (err) {
      toast(err instanceof ValidationError ? err.message : 'تعذر حفظ الدين', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={debt ? 'تعديل الدين' : 'دين جديد'}
      footer={<><button className="btn-primary flex-1" onClick={save} disabled={busy}>حفظ الدين</button><button className="btn-outline flex-1" onClick={onClose}>إلغاء</button></>}
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="نوع الدين" className="grid grid-cols-2 gap-2">
          {(['lent', 'borrowed'] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => setDirection(d)}
              className={`rounded-xl border p-3 text-start transition ${direction === d ? (d === 'lent' ? 'border-income bg-income-soft dark:bg-[#123a31]' : 'border-expense bg-expense-soft dark:bg-[#3a1d20]') : 'line'}`}>
              <span className="block font-semibold">{d === 'lent' ? 'شخص أخذ مني' : 'أخذتُ من شخص'}</span>
              <span className="muted text-xs">{d === 'lent' ? 'المبلغ لي عنده' : 'المبلغ عليّ له'}</span>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="label">{direction === 'lent' ? 'من أخذ منك؟' : 'ممن أخذت؟'} <span className="text-expense">*</span></span>
          <input id="debt-person" className="field" value={person} onChange={(e) => setPerson(e.target.value)} list="debt-people" maxLength={60} placeholder="اسم الشخص" aria-invalid={!!errors.person} />
          <datalist id="debt-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
          {errors.person && <span className="mt-1 block text-sm text-expense" role="alert">{errors.person}</span>}
        </label>
        <label className="block">
          <span className="label">المبلغ <span className="text-expense">*</span></span>
          <span className="flex items-center gap-2">
            <input id="debt-amount" className="field text-end font-display text-xl font-bold" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={!!errors.amount} />
            <span className="muted shrink-0">{currency.symbol}</span>
          </span>
          {errors.amount && <span className="mt-1 block text-sm text-expense" role="alert">{errors.amount}</span>}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">تاريخ الدين <span className="text-expense">*</span></span>
            <input id="debt-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
            {errors.date && <span className="mt-1 block text-sm text-expense" role="alert">{errors.date}</span>}
          </label>
          <label className="block">
            <span className="label">موعد السداد <span className="muted text-xs">(اختياري)</span></span>
            <input id="debt-due" type="date" className="field" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!errors.dueDate} />
            {errors.dueDate && <span className="mt-1 block text-sm text-expense" role="alert">{errors.dueDate}</span>}
          </label>
        </div>
        <label className="block">
          <span className="label">ملاحظات <span className="muted text-xs">(اختياري)</span></span>
          <textarea id="debt-notes" className="field" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="muted text-xs leading-5">الديون تُتابع منفصلة، ولا تدخل في إجمالي الدخل والمصروفات.</p>
      </div>
    </Sheet>
  );
}

function DebtDetails({ v, onClose, onEdit }: { v: DebtView; onClose: () => void; onEdit: () => void }) {
  const toast = useToast();
  const { settings, currency } = useSettings();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const lent = v.direction === 'lent';
  const pct = v.amountMinor ? v.paidMinor / v.amountMinor : 0;

  const pay = async (minor: number) => {
    try {
      await addDebtPayment(v.id, minor, date);
      setAmount('');
      setErr('');
      toast(minor === v.remainingMinor ? 'تم تسديد الدين بالكامل' : 'تم تسجيل الدفعة');
    } catch (e) {
      setErr(e instanceof ValidationError ? e.message : 'تعذر تسجيل الدفعة');
    }
  };
  const onPay = () => {
    const a = parseAmount(amount);
    if (!a.ok) return setErr(a.error);
    if (!isValidISODate(date)) return setErr('اختر تاريخًا صحيحًا');
    pay(a.minor);
  };
  const onDelete = async () => {
    const snap = await deleteDebt(v.id);
    setConfirm(false);
    onClose();
    if (snap) toast('تم حذف الدين', { action: { label: 'تراجع', run: () => restoreDebt(snap).then(() => toast('تمت استعادة الدين')) } });
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={v.person}
        footer={
          <>
            <button className="btn-outline flex-1" onClick={() => { onClose(); onEdit(); }}><Pencil className="h-4 w-4" /> تعديل</button>
            <button className="btn-outline flex-1 !text-expense" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> حذف</button>
          </>
        }
      >
        <div className="space-y-5">
          <div className={`rounded-2xl p-4 ${lent ? 'bg-income-soft dark:bg-[#123a31]' : 'bg-expense-soft dark:bg-[#3a1d20]'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{lent ? `${v.person} أخذ منك (لك عنده)` : `أخذتَ من ${v.person} (عليك له)`}</span>
              <StatusPill v={v} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="muted text-[11px]">المبلغ</div><Money minor={v.amountMinor} className="font-semibold" /></div>
              <div><div className="muted text-[11px]">المسدَّد</div><Money minor={v.paidMinor} className="font-semibold" /></div>
              <div><div className="muted text-[11px]">المتبقي</div><Money minor={v.remainingMinor} className={`font-display text-lg font-bold ${lent ? 'text-income dark:text-[#4FC7A6]' : 'text-expense dark:text-[#EE8C92]'}`} /></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-black/20">
              <div className={`h-full rounded-full ${lent ? 'bg-income' : 'bg-expense'}`} style={{ width: `${pct * 100}%` }} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="muted text-xs">تاريخ الدين</dt><dd>{formatDateAr(v.date, settings.numerals)}</dd></div>
            <div><dt className="muted text-xs">موعد السداد</dt><dd>{v.dueDate ? formatDateAr(v.dueDate, settings.numerals) : '—'}</dd></div>
            {v.notes && <div className="col-span-2"><dt className="muted text-xs">ملاحظات</dt><dd className="whitespace-pre-wrap">{v.notes}</dd></div>}
          </dl>

          {v.status !== 'settled' && (
            <section className="rounded-2xl border p-3 line">
              <h3 className="mb-2 text-sm font-semibold">{lent ? 'تسجيل مبلغ استلمته' : 'تسجيل مبلغ سددته'}</h3>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="sr-only">مبلغ الدفعة</span>
                  <span className="flex items-center gap-1.5">
                    <input id="pay-amount" className="field text-end" dir="ltr" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!err} />
                    <span className="muted text-xs">{currency.symbol}</span>
                  </span>
                </label>
                <label>
                  <span className="sr-only">تاريخ الدفعة</span>
                  <input id="pay-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              {err && <p className="mt-1.5 text-sm text-expense" role="alert">{err}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn-primary" onClick={onPay}>إضافة دفعة</button>
                <button className="btn-outline" onClick={() => pay(v.remainingMinor)}>سداد كامل المتبقي</button>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">سجل السداد ({toDigits(v.payments.length, settings.numerals)})</h3>
            {v.payments.length === 0 ? (
              <p className="muted text-sm">لم تُسجَّل أي دفعة بعد.</p>
            ) : (
              <ul className="divide-y rounded-xl border line [&>li]:border-[var(--line)]">
                {v.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm">{formatDateAr(p.date, settings.numerals)}</span>
                    <Money minor={p.amountMinor} className="font-semibold" />
                    <button className="btn-ghost !min-h-[2rem] !px-1.5 text-expense" aria-label="حذف الدفعة"
                      onClick={() => deleteDebtPayment(p.id).then(() => toast('تم حذف الدفعة'))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="حذف الدين"
        message={<>سيُحذف دين «{v.person}» وسجل سداده. يمكنك التراجع خلال ثوانٍ بعد الحذف.</>}
        confirmLabel="نعم، احذف"
        danger
        onConfirm={onDelete}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
