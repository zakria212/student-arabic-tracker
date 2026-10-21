export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'other';

export type Transaction = {
  id: string;
  type: TransactionType;
  /** موجب وصحيح، بوحدة 1/100 من العملة */
  amountMinor: number;
  /** «سبب الصرف» أو «من أين جاء المبلغ؟» */
  details: string;
  categoryId: string;
  /** YYYY-MM-DD محلي */
  date: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  type: TransactionType;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  /** ترتيب العرض */
  order: number;
};

/**
 * إيصال مرفق. نخزن البيانات كـ ArrayBuffer (بدل Blob) لأنها أكثر ثباتًا
 * في IndexedDB على جميع المتصفحات، ونحوّلها إلى Blob عند العرض.
 */
export type Receipt = {
  id: string;
  transactionId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer;
  createdAt: string;
};

export type Theme = 'light' | 'dark' | 'system';

export type Settings = {
  key: 'app';
  currency: string;
  theme: Theme;
  numerals: 'latn' | 'arab';
  /** آخر نسخة احتياطية (ISO) لتذكير المستخدم */
  lastBackupAt?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  currency: 'SAR',
  theme: 'system',
  numerals: 'latn',
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدًا' },
  { value: 'bank', label: 'تحويل بنكي' },
  { value: 'card', label: 'بطاقة' },
  { value: 'other', label: 'أخرى' },
];

export function paymentLabel(m?: PaymentMethod) {
  return PAYMENT_METHODS.find((p) => p.value === m)?.label ?? '';
}

export const TYPE_LABEL: Record<TransactionType, string> = { income: 'دخل', expense: 'مصروف' };
