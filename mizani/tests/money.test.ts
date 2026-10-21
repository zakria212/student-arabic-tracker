import { describe, expect, it } from 'vitest';
import { formatMinor, minorToPlain, parseAmount } from '../src/lib/money';

const ok = (s: string) => {
  const r = parseAmount(s);
  if (!r.ok) throw new Error(`expected ok for ${s}: ${r.error}`);
  return r.minor;
};

describe('parseAmount', () => {
  it('يقرأ الأرقام الإنجليزية والعربية بالقيمة نفسها (اختبار 9)', () => {
    expect(ok('1234.50')).toBe(123450);
    expect(ok('١٢٣٤٫٥٠')).toBe(123450);
    expect(ok('۱۲۳۴.۵')).toBe(123450);
  });
  it('يقبل الأعداد الصحيحة والكسور والفواصل', () => {
    expect(ok('45.50')).toBe(4550);
    expect(ok('2500')).toBe(250000);
    expect(ok('250.75')).toBe(25075);
    expect(ok('0.01')).toBe(1);
    expect(ok('1,234.5')).toBe(123450);
    expect(ok('١٬٢٣٤٫٥')).toBe(123450);
    expect(ok('45,5')).toBe(4550);
    expect(ok(' 12 ')).toBe(1200);
  });
  it('يرفض السالب والصفر والنص غير الرقمي (اختبار 4)', () => {
    for (const bad of ['', '0', '0.00', '-5', '−5', 'abc', '12a', '1.2.3', '10.123', '.']) {
      expect(parseAmount(bad).ok, bad).toBe(false);
    }
  });
  it('يتجنب أخطاء الفاصلة العائمة', () => {
    expect(ok('0.1') + ok('0.2')).toBe(30);
    expect(ok('19.99')).toBe(1999);
  });
});

describe('formatting', () => {
  it('minorToPlain', () => {
    expect(minorToPlain(74925)).toBe('749.25');
    expect(minorToPlain(-5)).toBe('-0.05');
  });
  it('formatMinor بالأرقام اللاتينية والعربية', () => {
    expect(formatMinor(123450, 'latn')).toBe('1,234.50');
    expect(formatMinor(123450, 'arab')).toBe('١٬٢٣٤٫٥٠');
  });
});
