import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info'; action?: { label: string; run: () => void } };
type Ctx = { toast: (message: string, opts?: { kind?: Toast['kind']; action?: Toast['action']; duration?: number }) => void };

const ToastContext = createContext<Ctx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  // نعرض التنبيهات كـ popover حتى تظهر فوق النوافذ المفتوحة (الطبقة العليا)
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover!();
      if (items.length) el.showPopover();
    } catch { /* غير مدعوم */ }
  }, [items]);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback<Ctx['toast']>((message, opts = {}) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, message, kind: opts.kind ?? 'success', action: opts.action }]);
    window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 7000 : 3500));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        ref={(el) => { box.current = el; el?.setAttribute('popover', 'manual'); }}
        className="toast-layer no-print pointer-events-none flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {items.map((t) => (
          <div key={t.id} className="anim-rise pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#0E2F3A] px-4 py-3 text-white shadow-lg">
            {t.kind === 'error' ? <AlertCircle className="h-5 w-5 shrink-0 text-[#F2A3A7]" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-[#7FD8BF]" />}
            <span className="flex-1 text-sm leading-6">{t.message}</span>
            {t.action && (
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#F3CF8E] hover:bg-white/10"
                onClick={() => { t.action!.run(); dismiss(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="إغلاق التنبيه" className="rounded-lg p-1 hover:bg-white/10" onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).toast;
