import {
  Building2,
  CreditCard,
  Landmark,
  LucideIcon,
  Smartphone,
  Wallet,
} from 'lucide-react-native';
import { AccountType } from '@/types/database.types';

export interface AccountTypeOption {
  type: AccountType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultColor: string;
}

export const ACCOUNT_TYPE_CONFIGS: Record<AccountType, AccountTypeOption> = {
  cash: {
    type: 'cash',
    label: 'Cash',
    description: 'Physical cash in hand or wallet',
    icon: Wallet,
    defaultColor: '#10b981', // Emerald
  },
  bank: {
    type: 'bank',
    label: 'Bank Account',
    description: 'Savings or current bank account',
    icon: Landmark,
    defaultColor: '#3b82f6', // Blue
  },
  mobile_wallet: {
    type: 'mobile_wallet',
    label: 'Mobile Wallet',
    description: 'bKash, Nagad, Rocket, Upay',
    icon: Smartphone,
    defaultColor: '#ec4899', // Pink
  },
  other: {
    type: 'other',
    label: 'Other Asset',
    description: 'Credit card, escrow, or other',
    icon: CreditCard,
    defaultColor: '#8b5cf6', // Purple
  },
};

export const ACCOUNT_TYPE_LIST: AccountTypeOption[] = [
  ACCOUNT_TYPE_CONFIGS.cash,
  ACCOUNT_TYPE_CONFIGS.bank,
  ACCOUNT_TYPE_CONFIGS.mobile_wallet,
  ACCOUNT_TYPE_CONFIGS.other,
];

export function getAccountIcon(type?: string | null): LucideIcon {
  if (!type || !(type in ACCOUNT_TYPE_CONFIGS)) {
    return Building2;
  }
  return ACCOUNT_TYPE_CONFIGS[type as AccountType].icon;
}

export function getAccountTypeLabel(type?: string | null): string {
  if (!type || !(type in ACCOUNT_TYPE_CONFIGS)) {
    return 'Account';
  }
  return ACCOUNT_TYPE_CONFIGS[type as AccountType].label;
}

export const ACCOUNT_COLORS = [
  '#10b981', // Emerald (Cash)
  '#3b82f6', // Blue (Bank)
  '#ec4899', // Pink (bKash)
  '#f97316', // Orange (Nagad)
  '#8b5cf6', // Purple (Rocket/Other)
  '#06b6d4', // Cyan
  '#eab308', // Amber
  '#64748b', // Slate
];
