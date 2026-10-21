import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
};

/**
 * نافذة حوار: تظهر كورقة سفلية على الجوال ونافذة وسطية على الحاسوب.
 * تعتمد على <dialog> الأصلي لإدارة التركيز وزر Esc وقارئات الشاشة.
 */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[#071a20]/55 md:m-auto ${size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg'}`}
    >
      {open && (
        <div
          className="anim-rise flex max-h-[92dvh] flex-col rounded-t-3xl md:rounded-3xl"
          style={{ background: 'var(--surface)', color: 'var(--text)' }}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4 line">
            <h2 className="text-lg font-bold">{title}</h2>
            <button className="btn-ghost !min-h-0 rounded-full p-2" onClick={onClose} aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="safe-bottom flex flex-wrap gap-2 border-t px-5 py-3 line">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({ open, title, message, confirmLabel, danger, busy, confirmDisabled, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? 'جارٍ التنفيذ…' : confirmLabel}
          </button>
          <button className="btn-outline flex-1" onClick={onClose} disabled={busy}>إلغاء</button>
        </>
      }
    >
      <div className="leading-7">{message}</div>
      {children}
    </Sheet>
  );
}
