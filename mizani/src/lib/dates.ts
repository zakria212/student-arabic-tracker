/**
 * التواريخ المالية نصوص محلية ثابتة بصيغة YYYY-MM-DD.
 * لا نحوّلها أبدًا عبر UTC حتى لا يتغير يوم الحركة بسبب المنطقة الزمنية.
 */

export type ISODate = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isValidISODate(s: string): boolean {
  const m = RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** يحوّل النص إلى Date محلي منتصف النهار (آمن من تغيّر اليوم) */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function daysInMonth(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

export function monthRange(year: number, month1: number): { start: ISODate; end: ISODate } {
  return {
    start: `${year}-${pad2(month1)}-01`,
    end: `${year}-${pad2(month1)}-${pad2(daysInMonth(year, month1))}`,
  };
}

export function shiftMonth(year: number, month1: number, delta: number) {
  const idx = year * 12 + (month1 - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** شامل لطرفي المدى */
export function inRange(date: ISODate, start: ISODate, end: ISODate) {
  return date >= start && date <= end;
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(start: ISODate, end: ISODate): number {
  const a = parseISODate(start), b = parseISODate(end);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function digits(s: string, numerals: 'latn' | 'arab') {
  return numerals === 'arab' ? s.replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[+c]) : s;
}

/** «21 أكتوبر 2026» بالتقويم الميلادي دائمًا */
export function formatDateAr(date: ISODate, numerals: 'latn' | 'arab' = 'latn', withYear = true): string {
  const [y, m, d] = date.split('-').map(Number);
  return digits(`${d} ${MONTHS_AR[m - 1]}${withYear ? ` ${y}` : ''}`, numerals);
}

export function formatDayHeading(date: ISODate, today: ISODate, numerals: 'latn' | 'arab' = 'latn'): string {
  if (date === today) return 'اليوم';
  if (date === addDays(today, -1)) return 'أمس';
  const wd = WEEKDAYS_AR[parseISODate(date).getDay()];
  return `${wd}، ${formatDateAr(date, numerals, date.slice(0, 4) !== today.slice(0, 4))}`;
}

export function formatShortDate(date: ISODate, numerals: 'latn' | 'arab' = 'latn') {
  const [, m, d] = date.split('-').map(Number);
  return digits(`${d}/${m}`, numerals);
}

export function monthLabel(year: number, month1: number, numerals: 'latn' | 'arab' = 'latn') {
  return digits(`${MONTHS_AR[month1 - 1]} ${year}`, numerals);
}

export function toDigits(s: string | number, numerals: 'latn' | 'arab') {
  return digits(String(s), numerals);
}
