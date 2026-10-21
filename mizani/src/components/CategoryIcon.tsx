import {
  Award, Baby, Book, Briefcase, Car, CircleEllipsis, Coffee, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HandHeart,
  HeartPulse, Home, Laptop, PawPrint, PiggyBank, Plane, Receipt, Shirt, ShoppingBag, ShoppingCart, Smartphone, Store,
  Undo2, Utensils, Wallet, Wifi, Wrench, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, home: Home, receipt: Receipt, car: Car, 'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse,
  'shopping-bag': ShoppingBag, 'hand-heart': HandHeart, 'circle-ellipsis': CircleEllipsis, briefcase: Briefcase,
  laptop: Laptop, store: Store, gift: Gift, undo: Undo2, award: Award, wallet: Wallet, plane: Plane, smartphone: Smartphone,
  baby: Baby, dumbbell: Dumbbell, coffee: Coffee, fuel: Fuel, shirt: Shirt, gamepad: Gamepad2, 'piggy-bank': PiggyBank,
  cart: ShoppingCart, wifi: Wifi, wrench: Wrench, book: Book, paw: PawPrint,
};

export const CATEGORY_COLORS = ['#E08A3C', '#5B6CC2', '#2E8FB0', '#8A63C9', '#2F9C8F', '#D2566A', '#C9922E', '#4C9A5B', '#14866D', '#7C8A90', '#B4589C', '#3D7A52'];

export function CategoryIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[icon] ?? CircleEllipsis;
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-xl`} style={{ background: color + '1F', color }} aria-hidden>
      <Icon className={ic} strokeWidth={1.8} />
    </span>
  );
}
