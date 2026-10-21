import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { db } from '../db/db';
import { MAX_RECEIPTS_PER_TRANSACTION, saveTransaction, ValidationError, type NewReceipt } from '../db/repo';
import { PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '../db/types';
import { isValidISODate, todayISO } from '../lib/dates';
import { minorToPlain, parseAmount } from '../lib/money';
import { formatBytes, ImageError, prepareReceipt } from '../lib/image';
import { CategoryIcon } from '../components/CategoryIcon';
import { useCategories, useSections } from '../state/queries';
import { usePeriod } from '../state/period';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';

const schema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.string(),
    details: z.string().trim().max(120, 'النص طويل جدًا (120 حرفًا كحد أقصى)'),
    categoryId: z.string().min(1, 'اختر التصنيف'),
    date: z.string().refine(isValidISODate, 'اختر تاريخًا صحيحًا'),
    notes: z.string().max(500, 'الملاحظات طويلة جدًا').optional(),
    paymentMethod: z.enum(['', 'cash', 'bank', 'card', 'other']),
    sectionId: z.string(),
  })
  .superRefine((v, ctx) => {
    const r = parseAmount(v.amount);
    if (!r.ok) ctx.addIssue({ code: 'custom', path: ['amount'], message: r.error });
    if (!v.details) {
      ctx.addIssue({ code: 'custom', path: ['details'], message: v.type === 'expense' ? 'اكتب سبب الصرف' : 'اكتب من أين جاء المبلغ' });
    }
  });

type FormValues = z.infer<typeof schema>;

type Attachment =
  | { kind: 'existing'; id: string; url: string; name: string; size: number }
  | { kind: 'new'; key: string; url: string; name: string; size: number; receipt: NewReceipt };

export default function TransactionForm() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => (location.key === 'default' ? navigate('/transactions', { replace: true }) : navigate(-1));
  const toast = useToast();
  const { currency } = useSettings();
  const categories = useCategories();
  const sections = useSections();
  const { section: activeSection } = usePeriod();
  const isEdit = !!id;

  const existing = useLiveQuery(async () => {
    if (!id) return null;
    const tx = await db.transactions.get(id);
    const receipts = tx ? await db.receipts.where('transactionId').equals(id).toArray() : [];
    return { tx, receipts };
  }, [id]);

  const initialType = (search.get('type') === 'income' ? 'income' : 'expense') as TransactionType;
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType, amount: '', details: '', categoryId: '', date: todayISO(), notes: '', paymentMethod: '',
      // عند الإضافة من داخل قسم مختار نقترحه افتراضيًا
      sectionId: activeSection !== 'all' && activeSection !== 'none' ? activeSection : '',
    },
  });

  const type = watch('type');
  const categoryId = watch('categoryId');
  const sectionId = watch('sectionId');
  const sectionOptions = (sections ?? []).filter((x) => x.isActive || x.id === sectionId);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // تعبئة النموذج عند التعديل (مرة واحدة لكل حركة)
  useEffect(() => {
    if (!id || !existing || loadedFor === id) return;
    if (!existing.tx) return;
    const t = existing.tx;
    reset({
      type: t.type,
      amount: minorToPlain(t.amountMinor),
      details: t.details,
      categoryId: t.categoryId,
      date: t.date,
      notes: t.notes ?? '',
      paymentMethod: t.paymentMethod ?? '',
      sectionId: t.sectionId ?? '',
    });
    setAttachments(
      existing.receipts.map((r) => ({
        kind: 'existing',
        id: r.id,
        name: r.filename,
        size: r.size,
        url: URL.createObjectURL(new Blob([r.data], { type: r.mimeType })),
      })),
    );
    setLoadedFor(id);
  }, [id, existing, loadedFor, reset]);

  // تحرير روابط المعاينة عند الخروج
  const attRef = useRef(attachments);
  attRef.current = attachments;
  useEffect(() => () => attRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  const typeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === type && (c.isActive || c.id === categoryId)),
    [categories, type, categoryId],
  );

  // اختيار تصنيف افتراضي مناسب عند تغيير النوع
  useEffect(() => {
    if (!categories) return;
    const current = categories.find((c) => c.id === categoryId);
    if (!current || current.type !== type) {
      const first = categories.find((c) => c.type === type && c.isActive);
      setValue('categoryId', first?.id ?? '');
    }
  }, [type, categories, categoryId, setValue]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_RECEIPTS_PER_TRANSACTION - attachments.length;
    if (room <= 0) return toast(`الحد الأقصى ${MAX_RECEIPTS_PER_TRANSACTION} صور لكل حركة`, { kind: 'error' });
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast(`أُضيفت ${room} صور فقط (الحد الأقصى ${MAX_RECEIPTS_PER_TRANSACTION})`, { kind: 'info' });
    setProcessing(true);
    const added: Attachment[] = [];
    for (const f of list) {
      try {
        const receipt = await prepareReceipt(f);
        added.push({
          kind: 'new',
          key: Math.random().toString(36).slice(2),
          name: receipt.filename,
          size: receipt.data.byteLength,
          receipt,
          url: URL.createObjectURL(new Blob([receipt.data], { type: receipt.mimeType })),
        });
      } catch (e) {
        toast(e instanceof ImageError ? `${f.name}: ${e.message}` : 'تعذرت قراءة الصورة', { kind: 'error' });
      }
    }
    setAttachments((a) => [...a, ...added]);
    setProcessing(false);
  };

  const removeAttachment = (a: Attachment) => {
    URL.revokeObjectURL(a.url);
    setAttachments((xs) => xs.filter((x) => x !== a));
    if (a.kind === 'existing') setRemoved((r) => [...r, a.id]);
  };

  const onSubmit = async (v: FormValues) => {
    const amount = parseAmount(v.amount);
    if (!amount.ok) return;
    try {
      await saveTransaction(
        {
          id,
          type: v.type,
          amountMinor: amount.minor,
          details: v.details,
          categoryId: v.categoryId,
          date: v.date,
          notes: v.notes,
          paymentMethod: (v.paymentMethod || undefined) as PaymentMethod | undefined,
          sectionId: v.sectionId || undefined,
        },
        attachments.filter((a): a is Extract<Attachment, { kind: 'new' }> => a.kind === 'new').map((a) => a.receipt),
        removed,
      );
      toast(isEdit ? 'تم حفظ التعديلات' : v.type === 'expense' ? 'تم تسجيل المصروف' : 'تم تسجيل الدخل');
      goBack();
    } catch (e) {
      toast(e instanceof ValidationError ? e.message : 'تعذر حفظ الحركة، حاول مرة أخرى', { kind: 'error' });
    }
  };

  if (isEdit && existing && !existing.tx) {
    return (
      <div className="card p-8 text-center">
        <p>هذه الحركة غير موجودة.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('/transactions')}>العودة إلى الحركات</button>
      </div>
    );
  }

  const income = type === 'income';
  const accent = income ? 'text-income dark:text-[#4FC7A6]' : 'text-expense dark:text-[#EE8C92]';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto max-w-xl">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="btn-ghost !min-h-[2.5rem] !px-2.5" onClick={goBack} aria-label="رجوع">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'تعديل الحركة' : 'إضافة حركة'}</h1>
      </header>

      {/* مفتاح النوع */}
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <div role="radiogroup" aria-label="نوع الحركة" className="card mb-4 grid grid-cols-2 gap-1 p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={field.value === t}
                onClick={() => field.onChange(t)}
                className={`min-h-[3rem] rounded-xl font-display text-base font-semibold transition ${
                  field.value === t ? (t === 'expense' ? 'bg-expense text-white shadow' : 'bg-income text-white shadow') : 'muted hover:bg-[var(--surface-2)]'
                }`}
              >
                {t === 'expense' ? 'مصروف −' : 'دخل +'}
              </button>
            ))}
          </div>
        )}
      />

      <div className="card space-y-5 p-4 sm:p-5">
        {/* المبلغ */}
        <div>
          <label htmlFor="amount" className="label">المبلغ <span className="text-expense">*</span></label>
          <div className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-2 transition focus-within:border-ink dark:focus-within:border-[#7FC4D6] ${errors.amount ? 'border-expense' : 'line'}`} style={{ background: 'var(--surface)' }}>
            <input
              id="amount"
              {...register('amount')}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!isEdit}
              placeholder="0.00"
              dir="ltr"
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? 'amount-err' : undefined}
              className={`w-full min-w-0 bg-transparent text-end font-display text-4xl font-bold outline-none placeholder:opacity-30 ${accent}`}
            />
            <span className="muted shrink-0 text-lg font-medium">{currency.symbol}</span>
          </div>
          {errors.amount && <p id="amount-err" className="mt-1.5 text-sm text-expense" role="alert">{errors.amount.message}</p>}
        </div>

        {/* السبب أو المصدر */}
        <div>
          <label htmlFor="details" className="label">
            {income ? 'من أين جاء المبلغ؟' : 'سبب الصرف'} <span className="text-expense">*</span>
          </label>
          <input
            id="details"
            {...register('details')}
            className="field"
            placeholder={income ? 'مثال: مكافأة، راتب أكتوبر' : 'مثال: وجبة غداء'}
            aria-invalid={!!errors.details}
            maxLength={120}
          />
          {errors.details && <p className="mt-1.5 text-sm text-expense" role="alert">{errors.details.message}</p>}
        </div>

        {/* التصنيف */}
        <fieldset>
          <legend className="label">التصنيف <span className="text-expense">*</span></legend>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="التصنيف">
                {typeCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={field.value === c.id}
                    onClick={() => field.onChange(c.id)}
                    className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs font-medium transition ${
                      field.value === c.id ? 'border-ink bg-ink/5 ring-2 ring-ink/20 dark:border-[#7FC4D6] dark:bg-white/5' : 'line hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="line-clamp-2 leading-4">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          />
          {errors.categoryId && <p className="mt-1.5 text-sm text-expense" role="alert">{errors.categoryId.message}</p>}
        </fieldset>

        {sectionOptions.length > 0 && (
          <fieldset>
            <legend className="label">القسم <span className="muted text-xs">(اختياري)</span></legend>
            <Controller
              control={control}
              name="sectionId"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="القسم">
                  <button type="button" role="radio" aria-checked={field.value === ''} aria-pressed={field.value === ''} className="chip" onClick={() => field.onChange('')}>
                    بدون قسم
                  </button>
                  {sectionOptions.map((x) => (
                    <button key={x.id} type="button" role="radio" aria-checked={field.value === x.id} aria-pressed={field.value === x.id} className="chip" onClick={() => field.onChange(x.id)}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} aria-hidden />
                      {x.name}
                    </button>
                  ))}
                </div>
              )}
            />
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="label">التاريخ <span className="text-expense">*</span></label>
            <input id="date" type="date" {...register('date')} className="field" aria-invalid={!!errors.date} />
            {errors.date && <p className="mt-1.5 text-sm text-expense" role="alert">{errors.date.message}</p>}
          </div>
          <div>
            <label htmlFor="pm" className="label">{income ? 'طريقة الاستلام' : 'طريقة الدفع'} <span className="muted text-xs">(اختياري)</span></label>
            <select id="pm" {...register('paymentMethod')} className="field">
              <option value="">— غير محدد —</option>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="label">ملاحظات <span className="muted text-xs">(اختياري)</span></label>
          <textarea id="notes" {...register('notes')} rows={2} className="field resize-y" maxLength={500} />
          {errors.notes && <p className="mt-1.5 text-sm text-expense" role="alert">{errors.notes.message}</p>}
        </div>

        {/* المرفقات */}
        <div>
          <div className="label flex items-center justify-between">
            <span>صور الإثبات <span className="muted text-xs">(اختياري، حتى {MAX_RECEIPTS_PER_TRANSACTION} صور)</span></span>
            {processing && <Loader2 className="h-4 w-4 animate-spin" aria-label="جارٍ تجهيز الصورة" />}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((a) => (
              <div key={a.kind === 'new' ? a.key : a.id} className="relative aspect-square overflow-hidden rounded-xl border line">
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a)}
                  className="absolute left-1 top-1 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  aria-label={`حذف الصورة ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {attachments.length < MAX_RECEIPTS_PER_TRANSACTION && (
              <>
                <button type="button" onClick={() => cameraInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs line muted hover:bg-[var(--surface-2)]">
                  <Camera className="h-6 w-6" /> الكاميرا
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs line muted hover:bg-[var(--surface-2)]">
                    <ImagePlus className="h-6 w-6" /> من الجهاز
                  </button>
              </>
            )}
          </div>
          <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <p className="muted mt-1.5 text-xs">JPG أو PNG أو WebP، حتى 5 ميغابايت للصورة. تُضغط الصور الكبيرة مع الحفاظ على وضوحها.</p>
        </div>
      </div>

      {/* زر الحفظ ثابت أسفل الشاشة على الجوال */}
      <div className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 line md:static md:mt-5 md:border-0 md:p-0" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto flex max-w-xl gap-2 md:bg-transparent">
          <button type="submit" className={`btn flex-1 !min-h-[3.25rem] text-base text-white ${income ? 'bg-income hover:brightness-95' : 'bg-ink hover:bg-ink-600 dark:bg-[#2B7A90]'}`} disabled={isSubmitting || processing}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            حفظ الحركة
          </button>
          <button type="button" className="btn-outline !min-h-[3.25rem]" onClick={goBack}>إلغاء</button>
        </div>
      </div>
    </form>
  );
}
