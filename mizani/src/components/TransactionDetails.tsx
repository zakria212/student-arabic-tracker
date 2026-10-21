import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CreditCard, Pencil, StickyNote, Tag, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { deleteTransaction, restoreTransaction } from '../db/repo';
import { paymentLabel, TYPE_LABEL } from '../db/types';
import { formatDateAr } from '../lib/dates';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { CategoryIcon } from './CategoryIcon';
import { ImageViewer, type ViewerImage } from './ImageViewer';
import { Money } from './Money';
import { ConfirmDialog, Sheet } from './Sheet';

const DetailsContext = createContext<{ openDetails: (id: string) => void }>({ openDetails: () => {} });
export const useDetails = () => useContext(DetailsContext);

/** يعرض تفاصيل أي حركة فوق الصفحة الحالية، فيبقى موضع التمرير في القائمة كما هو */
export function DetailsProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const openDetails = useCallback((x: string) => setId(x), []);
  return (
    <DetailsContext.Provider value={{ openDetails }}>
      {children}
      {id && <TransactionDetails id={id} onClose={() => setId(null)} />}
    </DetailsContext.Provider>
  );
}

function TransactionDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const tx = await db.transactions.get(id);
    if (!tx) return { tx: null };
    const [category, receipts] = await Promise.all([db.categories.get(tx.categoryId), db.receipts.where('transactionId').equals(id).toArray()]);
    return { tx, category, receipts };
  }, [id]);

  const images = useMemo<ViewerImage[]>(
    () => (data?.receipts ?? []).map((r) => ({ url: URL.createObjectURL(new Blob([r.data], { type: r.mimeType })), name: r.filename })),
    [data?.receipts],
  );
  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.url)), [images]);

  const [viewer, setViewer] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const tx = data?.tx;
  const income = tx?.type === 'income';

  const onDelete = async () => {
    setBusy(true);
    try {
      const snap = await deleteTransaction(id);
      setConfirm(false);
      onClose();
      if (snap) {
        toast('تم حذف الحركة', { action: { label: 'تراجع', run: () => restoreTransaction(snap).then(() => toast('تمت استعادة الحركة')) } });
      }
    } catch {
      toast('تعذر حذف الحركة', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="تفاصيل الحركة"
        footer={
          tx ? (
            <>
              <button className="btn-primary flex-1" onClick={() => { onClose(); navigate(`/transactions/${id}/edit`); }}>
                <Pencil className="h-4 w-4" /> تعديل
              </button>
              <button className="btn-outline flex-1 !text-expense" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4" /> حذف
              </button>
            </>
          ) : undefined
        }
      >
        {data && !tx && <p className="muted py-6 text-center">هذه الحركة لم تعد موجودة.</p>}
        {tx && (
          <div className="space-y-5">
            <div className={`rounded-2xl p-5 text-center ${income ? 'bg-income-soft dark:bg-[#123a31]' : 'bg-expense-soft dark:bg-[#3a1d20]'}`}>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${income ? 'bg-income text-white' : 'bg-expense text-white'}`}>
                {income ? 'دخل +' : 'مصروف −'}
              </span>
              <div className={`mt-3 font-display text-3xl font-bold ${income ? 'text-income dark:text-[#4FC7A6]' : 'text-expense dark:text-[#EE8C92]'}`}>
                <Money minor={tx.amountMinor} type={tx.type} />
              </div>
              <p className="mt-2 text-lg font-medium">{tx.details}</p>
              <p className="muted text-xs">{tx.type === 'expense' ? 'سبب الصرف' : 'مصدر المبلغ'}</p>
            </div>

            <dl className="divide-y rounded-2xl border line [&>div]:border-[var(--line)]">
              <Row icon={<Tag className="h-4 w-4" />} label="التصنيف">
                <span className="inline-flex items-center gap-2">
                  {data.category && <CategoryIcon icon={data.category.icon} color={data.category.color} size="sm" />}
                  {data.category?.name ?? 'تصنيف محذوف'}
                  {data.category && !data.category.isActive && <span className="muted text-xs">(معطّل)</span>}
                </span>
              </Row>
              <Row icon={<CalendarDays className="h-4 w-4" />} label="التاريخ">{formatDateAr(tx.date, settings.numerals)}</Row>
              {tx.paymentMethod && (
                <Row icon={<CreditCard className="h-4 w-4" />} label={income ? 'طريقة الاستلام' : 'طريقة الدفع'}>{paymentLabel(tx.paymentMethod)}</Row>
              )}
              {tx.notes && (
                <Row icon={<StickyNote className="h-4 w-4" />} label="ملاحظات">
                  <span className="whitespace-pre-wrap">{tx.notes}</span>
                </Row>
              )}
            </dl>

            {images.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">المرفقات ({images.length})</h3>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <button key={img.url} onClick={() => setViewer(i)} className="aspect-square overflow-hidden rounded-xl border line" aria-label={`فتح المرفق ${img.name}`}>
                      <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <p className="muted text-center text-[11px]">{TYPE_LABEL[tx.type]} · أُضيفت {formatDateAr(tx.createdAt.slice(0, 10), settings.numerals)}</p>
          </div>
        )}
      </Sheet>

      {viewer !== null && images.length > 0 && (
        <ImageViewer images={images} index={Math.min(viewer, images.length - 1)} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}

      <ConfirmDialog
        open={confirm}
        title="حذف الحركة"
        message={<>سيتم حذف «{tx?.details}» ومرفقاتها من السجل وإزالة أثرها من الإجماليات. يمكنك التراجع خلال ثوانٍ بعد الحذف.</>}
        confirmLabel="نعم، احذف"
        danger
        busy={busy}
        onConfirm={onDelete}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="muted mt-0.5">{icon}</span>
      <dt className="muted w-28 shrink-0 text-sm">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}
