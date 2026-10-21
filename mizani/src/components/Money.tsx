import { useSettings } from '../state/settings';
import { formatMinor } from '../lib/money';
import type { TransactionType } from '../db/types';

type Props = {
  minor: number;
  /** يعرض إشارة +/− حسب النوع أو حسب قيمة الصافي */
  type?: TransactionType;
  signed?: boolean;
  className?: string;
  currencyClassName?: string;
  compact?: boolean;
};

/** مبلغ منسق مع رمز العملة، معزول الاتجاه حتى لا ينقلب داخل واجهة RTL */
export function Money({ minor, type, signed, className = '', currencyClassName = 'text-[0.7em] font-normal opacity-70', compact }: Props) {
  const { settings, currency } = useSettings();
  let sign = '';
  if (type) sign = type === 'income' ? '+' : '−';
  else if (signed && minor !== 0) sign = minor > 0 ? '+' : '−';
  else if (minor < 0) sign = '−';
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="num">{sign}{formatMinor(minor, settings.numerals, { compact })}</span>
      <span className={`ms-1 ${currencyClassName}`}>{currency.symbol}</span>
    </span>
  );
}

export function useMoneyText() {
  const { settings, currency } = useSettings();
  return (minor: number, compact = false) => `${minor < 0 ? '−' : ''}${formatMinor(minor, settings.numerals, { compact })} ${currency.symbol}`;
}
