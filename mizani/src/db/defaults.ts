import type { Category, Section } from './types';

/** معرّفات ثابتة للتصنيفات الافتراضية حتى يكون الدمج بين النسخ الاحتياطية سليمًا */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', type: 'expense', name: 'طعام', icon: 'utensils', color: '#E08A3C' },
  { id: 'exp-housing', type: 'expense', name: 'سكن', icon: 'home', color: '#5B6CC2' },
  { id: 'exp-bills', type: 'expense', name: 'فواتير', icon: 'receipt', color: '#2E8FB0' },
  { id: 'exp-transport', type: 'expense', name: 'مواصلات', icon: 'car', color: '#8A63C9' },
  { id: 'exp-education', type: 'expense', name: 'تعليم', icon: 'graduation-cap', color: '#2F9C8F' },
  { id: 'exp-health', type: 'expense', name: 'صحة', icon: 'heart-pulse', color: '#D2566A' },
  { id: 'exp-shopping', type: 'expense', name: 'تسوق', icon: 'shopping-bag', color: '#C9922E' },
  { id: 'exp-charity', type: 'expense', name: 'تبرعات', icon: 'hand-heart', color: '#4C9A5B' },
  { id: 'exp-other', type: 'expense', name: 'أخرى', icon: 'circle-ellipsis', color: '#7C8A90' },
  { id: 'inc-salary', type: 'income', name: 'راتب', icon: 'briefcase', color: '#14866D' },
  { id: 'inc-freelance', type: 'income', name: 'عمل إضافي', icon: 'laptop', color: '#2E8FB0' },
  { id: 'inc-sales', type: 'income', name: 'مبيعات', icon: 'store', color: '#C9922E' },
  { id: 'inc-gift', type: 'income', name: 'هدية', icon: 'gift', color: '#D2566A' },
  { id: 'inc-refund', type: 'income', name: 'استرداد', icon: 'undo', color: '#5B6CC2' },
  { id: 'inc-other', type: 'income', name: 'أخرى / مكافآت', icon: 'award', color: '#7C8A90' },
].map((c, i) => ({ ...c, type: c.type as Category['type'], isDefault: true, isActive: true, order: i }));

export const DEFAULT_SECTIONS: Section[] = [
  { id: 'sec-home', name: 'المنزل', icon: 'home', color: '#5B6CC2', isActive: true, order: 0 },
  { id: 'sec-work', name: 'العمل', icon: 'briefcase', color: '#2F9C8F', isActive: true, order: 1 },
];
