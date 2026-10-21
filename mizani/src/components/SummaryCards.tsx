import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import type { Summary } from '../domain/reports';
import { toDigits } from '../lib/dates';
import { useSettings } from '../state/settings';
import { Money } from './Money';

export function SummaryCards({ summary }: { summary: Summary }) {
  const { settings } = useSettings();
  const n = (x: number) => toDigits(x, settings.numerals);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <div className="card anim-rise p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-income dark:text-[#4FC7A6]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-income-soft dark:bg-[#123a31]"><ArrowDownLeft className="h-4 w-4" /></span>
          الدخل +
        </div>
        <Money minor={summary.incomeMinor} className="mt-3 block font-display text-xl font-bold sm:text-2xl" />
        <div className="muted mt-1 text-xs">{n(summary.incomeCount)} حركة</div>
      </div>
      <div className="card anim-rise p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-expense dark:text-[#EE8C92]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-expense-soft dark:bg-[#3a1d20]"><ArrowUpRight className="h-4 w-4" /></span>
          المصروفات −
        </div>
        <Money minor={summary.expenseMinor} className="mt-3 block font-display text-xl font-bold sm:text-2xl" />
        <div className="muted mt-1 text-xs">{n(summary.expenseCount)} حركة</div>
      </div>
      <div className="anim-rise relative col-span-2 overflow-hidden rounded-2xl bg-ink p-4 text-white shadow-card md:col-span-1 dark:bg-[#1B4B5A]">
        <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full border-[10px] border-gold/30" aria-hidden />
        <div className="flex items-center gap-2 text-sm font-medium text-white/85">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><Scale className="h-4 w-4 text-gold" /></span>
          الصافي
        </div>
        <Money minor={summary.netMinor} signed className="mt-3 block font-display text-2xl font-bold" currencyClassName="text-[0.6em] font-normal opacity-75" />
        <div className="mt-1 text-xs text-white/70">الدخل − المصروفات خلال الفترة</div>
      </div>
    </div>
  );
}
