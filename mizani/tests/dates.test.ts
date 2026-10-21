import { describe, expect, it } from 'vitest';
import { addDays, formatDateAr, isValidISODate, monthRange, shiftMonth, toISODate } from '../src/lib/dates';

describe('dates', () => {
  it('حدود الشهر شاملة وتراعي السنة الكبيسة', () => {
    expect(monthRange(2026, 10)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthRange(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange(2026, 2).end).toBe('2026-02-28');
  });
  it('التنقل بين الشهور عبر السنوات', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it('لا يتغير اليوم بسبب المنطقة الزمنية', () => {
    expect(toISODate(new Date(2026, 9, 1, 0, 5))).toBe('2026-10-01');
    expect(toISODate(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31');
  });
  it('التحقق من صحة التاريخ', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026/10/01')).toBe(false);
  });
  it('التنسيق بالتقويم الميلادي', () => {
    expect(formatDateAr('2026-10-21')).toBe('21 أكتوبر 2026');
    expect(formatDateAr('2026-10-21', 'arab')).toBe('٢١ أكتوبر ٢٠٢٦');
  });
});
