import {
  Book,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  DollarSign,
  Dumbbell,
  Film,
  Gift,
  Heart,
  Home,
  Laptop,
  LucideIcon,
  Plane,
  ShoppingBag,
  Tag,
  TrendingUp,
  Utensils,
  Zap,
} from 'lucide-react-native';

export const CATEGORY_PALETTE = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Rose / Red
  '#f59e0b', // Amber
  '#ea580c', // Orange
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#64748b', // Slate
];

export const CATEGORY_ICON_LIST: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'tag', label: 'Tag', icon: Tag },
  { id: 'shopping-bag', label: 'Shopping', icon: ShoppingBag },
  { id: 'utensils', label: 'Food', icon: Utensils },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'car', label: 'Transport', icon: Car },
  { id: 'home', label: 'Housing', icon: Home },
  { id: 'zap', label: 'Utilities', icon: Zap },
  { id: 'film', label: 'Fun', icon: Film },
  { id: 'heart', label: 'Health', icon: Heart },
  { id: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { id: 'briefcase', label: 'Work', icon: Briefcase },
  { id: 'laptop', label: 'Tech', icon: Laptop },
  { id: 'trending-up', label: 'Invest', icon: TrendingUp },
  { id: 'dollar-sign', label: 'Income', icon: DollarSign },
  { id: 'credit-card', label: 'Finance', icon: CreditCard },
  { id: 'gift', label: 'Gift', icon: Gift },
  { id: 'plane', label: 'Travel', icon: Plane },
  { id: 'book', label: 'Education', icon: Book },
];

export function getCategoryIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return Tag;
  const match = CATEGORY_ICON_LIST.find((item) => item.id === iconName);
  return match ? match.icon : Tag;
}
