import { Paperclip } from 'lucide-react';
import type { Category, Transaction } from '../db/types';
import { TYPE_LABEL } from '../db/types';
import { formatDateAr } from '../lib/dates';
import { useSettings } from '../state/settings';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';

type Props = {
  tx: Transaction;
  category?: Category;
  receipts?: number;
  showDate?: boolean;
  onOpen: (id: string) => void;
};

export function TransactionRow({ tx, category, receipts = 0, showDate = true, onOpen }: Props) {
  const { settings } = useSettings();
  const income = tx.type === 'income';
  return (
    <li>
      <button
        onClick={() => onOpen(tx.id)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-[var(--surface-2)]"
        aria-label={`${TYPE_LABEL[tx.type]}: ${tx.details}`}
      >
        <CategoryIcon icon={category?.icon ?? 'circle-ellipsis'} color={category?.color ?? '#7C8A90'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{tx.details}</span>
            {receipts > 0 && (
              <span className="muted inline-flex items-center" title={`${receipts} مرفق`}>
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">يحتوي مرفقًا</span>
              </span>
            )}
          </span>
          <span className="muted block truncate text-xs leading-5">
            {category?.name ?? 'تصنيف محذوف'}
            {showDate && <> · {formatDateAr(tx.date, settings.numerals)}</>}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <Money minor={tx.amountMinor} type={tx.type} className={`font-semibold ${income ? 'text-income dark:text-[#4FC7A6]' : 'text-expense dark:text-[#EE8C92]'}`} />
          <span className={`text-[11px] ${income ? 'text-income dark:text-[#4FC7A6]' : 'text-expense dark:text-[#EE8C92]'}`}>
            {income ? 'دخل +' : 'مصروف −'}
          </span>
        </span>
      </button>
    </li>
  );
}
