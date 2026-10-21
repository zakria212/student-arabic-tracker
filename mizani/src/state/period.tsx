import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { monthLabel, monthRange, shiftMonth, todayISO, toDigits, yearRange, formatDateAr, type ISODate } from '../lib/dates';

export type Period =
  | { mode: 'month'; year: number; month: number }
  | { mode: 'year'; year: number }
  | { mode: 'custom'; start: ISODate; end: ISODate }
  | { mode: 'all' };

export const ALL_START = '1900-01-01';
export const ALL_END = '2200-12-31';

export function currentMonth(): Period {
  const [y, m] = todayISO().split('-').map(Number);
  return { mode: 'month', year: y, month: m };
}

export function resolvePeriod(p: Period, numerals: 'latn' | 'arab' = 'latn'): { start: ISODate; end: ISODate; label: string } {
  switch (p.mode) {
    case 'month':
      return { ...monthRange(p.year, p.month), label: monthLabel(p.year, p.month, numerals) };
    case 'year':
      return { ...yearRange(p.year), label: `عام ${toDigits(p.year, numerals)}` };
    case 'custom':
      return { start: p.start, end: p.end, label: `${formatDateAr(p.start, numerals)} – ${formatDateAr(p.end, numerals)}` };
    case 'all':
      return { start: ALL_START, end: ALL_END, label: 'كل الفترات' };
  }
}

export function shiftPeriod(p: Period, delta: number): Period {
  if (p.mode === 'month') {
    const s = shiftMonth(p.year, p.month, delta);
    return { mode: 'month', year: s.year, month: s.month };
  }
  if (p.mode === 'year') return { mode: 'year', year: p.year + delta };
  return p;
}

/** 'all' = كل الأقسام، 'none' = بلا قسم، أو معرّف قسم */
export type SectionFilter = string;

type Ctx = { period: Period; setPeriod: (p: Period) => void; section: SectionFilter; setSection: (s: SectionFilter) => void };
const PeriodContext = createContext<Ctx>({ period: currentMonth(), setPeriod: () => {}, section: 'all', setSection: () => {} });

/** الفترة والقسم المختاران مشتركان بين الرئيسية والحركات والتقارير */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>(currentMonth);
  const [section, setSection] = useState<SectionFilter>('all');
  const value = useMemo(() => ({ period, setPeriod, section, setSection }), [period, section]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export const usePeriod = () => useContext(PeriodContext);
