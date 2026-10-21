/**
 * منطق المبالغ: تُخزَّن جميع المبالغ كأعداد صحيحة بوحدة «جزء من مئة» من العملة
 * (هللات للريال السعودي) لتجنب أخطاء الفاصلة العشرية.
 */

export const MINOR_PER_UNIT = 100;
/** أقصى مبلغ مسموح لحركة واحدة (مليار وحدة) حماية من أخطاء الإدخال */
export const MAX_AMOUNT_MINOR = 100_000_000_000;

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية/الفارسية إلى لاتينية ويوحّد الفواصل */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const p = PERSIAN.indexOf(ch);
    if (a >= 0) out += String(a);
    else if (p >= 0) out += String(p);
    else if (ch === '٫') out += '.'; // الفاصلة العشرية العربية
    else if (ch === '٬' || ch === '٬') out += ','; // فاصل الآلاف العربي
    else out += ch;
  }
  return out;
}

export type ParseResult = { ok: true; minor: number } | { ok: false; error: string };

/**
 * يقرأ مبلغًا يكتبه المستخدم ويعيده بالوحدة الصغرى.
 * يقبل: 1234.50 ، ١٢٣٤٫٥٠ ، 1,234.5 ، 45,5 (فاصلة عشرية أوروبية).
 */
export function parseAmount(raw: string): ParseResult {
  let s = normalizeDigits(raw ?? '').replace(/[\s ‏‎]/g, '');
  if (s === '') return { ok: false, error: 'أدخل المبلغ' };
  if (s.startsWith('-') || s.startsWith('−')) return { ok: false, error: 'يجب أن يكون المبلغ أكبر من صفر' };

  if (s.includes('.')) {
    // النقطة هي العشرية؛ الفواصل هنا فواصل آلاف
    s = s.replace(/,/g, '');
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    // فاصلة واحدة يتبعها رقم أو رقمان = فاصلة عشرية
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'أدخل رقمًا صحيحًا، مثل 45.50' };
  const [intPart, fracPart = ''] = s.split('.');
  if (fracPart.length > 2) return { ok: false, error: 'مسموح بمنزلتين عشريتين فقط' };
  const intDigits = intPart.replace(/^0+(?=\d)/, '');
  if (intDigits.length > 12) return { ok: false, error: 'المبلغ كبير جدًا' };

  const minor = Number(intDigits) * MINOR_PER_UNIT + Number(fracPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) return { ok: false, error: 'المبلغ كبير جدًا' };
  if (minor <= 0) return { ok: false, error: 'يجب أن يكون المبلغ أكبر من صفر' };
  if (minor > MAX_AMOUNT_MINOR) return { ok: false, error: 'المبلغ كبير جدًا' };
  return { ok: true, minor };
}

/** تمثيل نصي ثابت بنقطة عشرية (للحقول وCSV): 25075 → "250.75" */
export function minorToPlain(minor: number): string {
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const units = Math.floor(abs / MINOR_PER_UNIT);
  const cents = abs % MINOR_PER_UNIT;
  return `${neg ? '-' : ''}${units}.${String(cents).padStart(2, '0')}`;
}

export type Numerals = 'latn' | 'arab';

const formatters = new Map<string, Intl.NumberFormat>();
function getFormatter(numerals: Numerals, fraction: boolean) {
  const key = `${numerals}-${fraction}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(`ar-u-nu-${numerals}`, {
      minimumFractionDigits: fraction ? 2 : 0,
      maximumFractionDigits: fraction ? 2 : 0,
      useGrouping: true,
    });
    formatters.set(key, f);
  }
  return f;
}

/** تنسيق المبلغ للعرض دون رمز العملة: 25075 → "250.75" مع فواصل الآلاف */
export function formatMinor(minor: number, numerals: Numerals = 'latn', opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(minor);
  const value = abs / MINOR_PER_UNIT;
  const showFraction = !opts.compact || abs % MINOR_PER_UNIT !== 0;
  return getFormatter(numerals, showFraction).format(value);
}

export function formatPercent(ratio: number, numerals: Numerals = 'latn'): string {
  return new Intl.NumberFormat(`ar-u-nu-${numerals}`, { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
}
