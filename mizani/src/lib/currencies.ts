export type Currency = { code: string; name: string; symbol: string };

/** العملات المتاحة. المبالغ تُخزن دائمًا بمنزلتين عشريتين بغض النظر عن العملة. */
export const CURRENCIES: Currency[] = [
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب' },
  { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع' },
  { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ' },
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'IQD', name: 'دينار عراقي', symbol: 'د.ع' },
  { code: 'LBP', name: 'ليرة لبنانية', symbol: 'ل.ل' },
  { code: 'SYP', name: 'ليرة سورية', symbol: 'ل.س' },
  { code: 'YER', name: 'ريال يمني', symbol: 'ر.ي' },
  { code: 'SDG', name: 'جنيه سوداني', symbol: 'ج.س' },
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'TND', name: 'دينار تونسي', symbol: 'د.ت' },
  { code: 'DZD', name: 'دينار جزائري', symbol: 'د.ج' },
  { code: 'MAD', name: 'درهم مغربي', symbol: 'د.م' },
  { code: 'MRU', name: 'أوقية موريتانية', symbol: 'أ.م' },
  { code: 'TRY', name: 'ليرة تركية', symbol: '₺' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? { code, name: code, symbol: code };
}
