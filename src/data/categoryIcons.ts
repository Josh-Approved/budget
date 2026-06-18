/**
 * Curated category-icon registry. Categories store a stable string key (e.g.
 * 'groceries'); this resolves it to a Lucide component. We deliberately import a
 * fixed ~30-icon set rather than `import * as lucide` so the icon set the user
 * can pick from is bounded and the bundle doesn't pull thousands of unused
 * glyphs. The picker (Categories screen) lists ICON_KEYS in this order.
 */

import {
  ShoppingCart,
  UtensilsCrossed,
  Coffee,
  Car,
  Bus,
  Fuel,
  House,
  Zap,
  Smartphone,
  Wifi,
  HeartPulse,
  Pill,
  Dumbbell,
  Shirt,
  Gift,
  Plane,
  Film,
  Music,
  Gamepad2,
  BookOpen,
  GraduationCap,
  Baby,
  Dog,
  Scissors,
  Wrench,
  Receipt,
  CreditCard,
  Banknote,
  Briefcase,
  PiggyBank,
  TrendingUp,
  Wallet,
  Landmark,
  Sparkles,
  Tag,
  Circle,
  type LucideIcon,
} from 'lucide-react-native';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingCart,
  food: UtensilsCrossed,
  coffee: Coffee,
  car: Car,
  transit: Bus,
  fuel: Fuel,
  home: House,
  utilities: Zap,
  phone: Smartphone,
  internet: Wifi,
  health: HeartPulse,
  pharmacy: Pill,
  fitness: Dumbbell,
  clothing: Shirt,
  gifts: Gift,
  travel: Plane,
  entertainment: Film,
  music: Music,
  games: Gamepad2,
  books: BookOpen,
  education: GraduationCap,
  kids: Baby,
  pets: Dog,
  personal: Scissors,
  repairs: Wrench,
  bills: Receipt,
  card: CreditCard,
  salary: Banknote,
  business: Briefcase,
  savings: PiggyBank,
  investment: TrendingUp,
  wallet: Wallet,
  bank: Landmark,
  other: Sparkles,
  tag: Tag,
};

/** The order categories are offered in the icon picker. */
export const ICON_KEYS = Object.keys(CATEGORY_ICONS);

/** Resolve an icon key to its component; unknown keys degrade to a circle. */
export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? Circle;
}
