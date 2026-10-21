import type { ReactNode } from 'react';

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gold-soft text-[#A87A2A] dark:bg-[#2a2516]">
        {icon ?? (
          <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M24 8v30M10 15h28M10 15l-6 13h12zM38 15l-6 13h12zM17 40h14" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="muted mt-1.5 max-w-xs text-sm leading-6">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
