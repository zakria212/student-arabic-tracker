import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_SETTINGS, type Settings } from '../db/types';
import { getCurrency, type Currency } from '../lib/currencies';

type Ctx = { settings: Settings; currency: Currency; loaded: boolean };
const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, currency: getCurrency('SAR'), loaded: false });

function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0C1A1F' : '#123B49');
  try {
    localStorage.setItem('mizani-theme', theme); // تفضيل عرض فقط لتجنب الوميض
  } catch { /* التخزين غير متاح */ }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => db.settings.get('app'), [], null);
  const settings = stored ?? DEFAULT_SETTINGS;

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [settings.theme]);

  return (
    <SettingsContext.Provider value={{ settings, currency: getCurrency(settings.currency), loaded: stored !== null }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
