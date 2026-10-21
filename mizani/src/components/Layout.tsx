import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Home, ListOrdered, Plus, Settings } from 'lucide-react';

const NAV = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true },
  { to: '/transactions', label: 'الحركات', icon: ListOrdered },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="120" fill="#123B49" />
      <path d="M256 120v272" stroke="#D9AA58" strokeWidth="26" strokeLinecap="round" />
      <path d="M136 176h240" stroke="#F7F9F8" strokeWidth="26" strokeLinecap="round" />
      <path d="M136 176l-52 112h104zM376 176l-52 112h104z" fill="none" stroke="#F7F9F8" strokeWidth="22" strokeLinejoin="round" />
      <rect x="196" y="384" width="120" height="24" rx="12" fill="#D9AA58" />
    </svg>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inForm = pathname.startsWith('/transactions/new') || pathname.endsWith('/edit');

  return (
    <div className="min-h-[100dvh] md:flex">
      {/* شريط جانبي للحاسوب (يمين الشاشة في RTL) */}
      <aside className="no-print sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-e px-4 py-6 line md:flex" style={{ background: 'var(--surface)' }}>
        <div className="mb-8 flex items-center gap-3 px-2">
          <Logo className="h-10 w-10" />
          <div>
            <div className="font-display text-xl font-bold text-ink-adaptive">ميزاني</div>
            <div className="muted text-xs">دخلك ومصروفاتك بوضوح</div>
          </div>
        </div>
        <button className="btn-primary mb-6 w-full" onClick={() => navigate('/transactions/new')}>
          <Plus className="h-5 w-5" /> إضافة حركة
        </button>
        <nav className="space-y-1" aria-label="التنقل الرئيسي">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${isActive ? 'bg-ink/10 text-ink-adaptive dark:bg-white/10' : 'muted hover:bg-[var(--surface-2)]'}`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} /> {label}
            </NavLink>
          ))}
        </nav>
        <p className="muted mt-auto px-2 text-[11px] leading-5">بياناتك محفوظة على هذا الجهاز فقط. احتفظ بنسخة احتياطية دوريًا.</p>
      </aside>

      <main className={`mx-auto w-full max-w-5xl px-4 pt-4 md:px-8 md:pt-8 ${inForm ? 'pb-32' : 'pb-28'} md:pb-10`}>
        <Outlet />
      </main>

      {/* شريط تنقل سفلي للجوال */}
      {!inForm && (
        <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t line md:hidden" style={{ background: 'var(--surface)' }} aria-label="التنقل الرئيسي">
          <div className="relative grid grid-cols-5 items-end px-1">
            {NAV.slice(0, 2).map((n) => <BottomItem key={n.to} {...n} />)}
            <div className="flex justify-center">
              <button
                onClick={() => navigate('/transactions/new')}
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white shadow-lg ring-4 ring-[var(--bg)] transition active:scale-95 dark:bg-[#2B7A90]"
                aria-label="إضافة حركة"
              >
                <Plus className="h-7 w-7" />
              </button>
            </div>
            {NAV.slice(2).map((n) => <BottomItem key={n.to} {...n} />)}
          </div>
        </nav>
      )}
    </div>
  );
}

function BottomItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-ink-adaptive' : 'muted'}`}
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.7} />
          {label}
        </>
      )}
    </NavLink>
  );
}
