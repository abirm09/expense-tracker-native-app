export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          currency: string;
          has_pin: boolean;
          pin_hash: string | null;
          pin_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          has_pin?: boolean;
          pin_hash?: string | null;
          pin_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          has_pin?: boolean;
          pin_hash?: string | null;
          pin_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string;
          color: string;
          type: 'expense' | 'income' | 'both';
          monthly_limit: number | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon?: string;
          color?: string;
          type?: 'expense' | 'income' | 'both';
          monthly_limit?: number | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          icon?: string;
          color?: string;
          type?: 'expense' | 'income' | 'both';
          monthly_limit?: number | null;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'cash' | 'bank' | 'mobile_wallet' | 'other';
          account_number: string | null;
          opening_balance: number;
          current_balance: number;
          is_default: boolean;
          is_archived: boolean;
          notes: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type?: 'cash' | 'bank' | 'mobile_wallet' | 'other';
          account_number?: string | null;
          opening_balance?: number;
          current_balance?: number;
          is_default?: boolean;
          is_archived?: boolean;
          notes?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: 'cash' | 'bank' | 'mobile_wallet' | 'other';
          account_number?: string | null;
          opening_balance?: number;
          current_balance?: number;
          is_default?: boolean;
          is_archived?: boolean;
          notes?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          phone: string;
          email: string | null;
          whatsapp: string | null;
          notes: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name?: string | null;
          phone: string;
          email?: string | null;
          whatsapp?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          phone?: string;
          email?: string | null;
          whatsapp?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string | null;
          debt_type: 'receivable' | 'payable' | 'receivable_payment' | 'payable_payment' | null;
          due_date: string | null;
          category_id: string | null;
          account_id: string | null;
          to_account_id: string | null;
          transfer_group_id: string | null;
          title: string;
          amount: number;
          type: 'expense' | 'income' | 'transfer';
          entry_type: 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment';
          currency: string;
          date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          contact_id?: string | null;
          debt_type?: 'receivable' | 'payable' | 'receivable_payment' | 'payable_payment' | null;
          due_date?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          to_account_id?: string | null;
          transfer_group_id?: string | null;
          title: string;
          amount: number;
          type?: 'expense' | 'income' | 'transfer';
          entry_type?: 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment';
          currency?: string;
          date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contact_id?: string | null;
          debt_type?: 'receivable' | 'payable' | 'receivable_payment' | 'payable_payment' | null;
          due_date?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          to_account_id?: string | null;
          transfer_group_id?: string | null;
          title?: string;
          amount?: number;
          type?: 'expense' | 'income' | 'transfer';
          entry_type?: 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment';
          currency?: string;
          date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          amount: number;
          month: number;
          year: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          amount: number;
          month: number;
          year: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          amount?: number;
          month?: number;
          year?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_user_pin: {
        Args: {
          pin_input: string;
        };
        Returns: {
          success: boolean;
          error?: string;
        };
      };
      verify_user_pin: {
        Args: {
          pin_input: string;
        };
        Returns: {
          success: boolean;
          error?: string;
        };
      };
      disable_user_pin: {
        Args: {
          current_pin: string;
        };
        Returns: {
          success: boolean;
          error?: string;
        };
      };
      ensure_user_profile: {
        Args: Record<string, never>;
        Returns: Profile | { success: boolean; error?: string };
      };
      recalculate_account_balance: {
        Args: {
          target_account_id: string;
        };
        Returns: number;
      };
      transfer_between_accounts: {
        Args: {
          from_account_id: string;
          to_account_id: string;
          amount: number;
          notes?: string | null;
          transfer_date?: string | null;
        };
        Returns: {
          success: boolean;
          transfer_group_id: string;
        };
      };
      adjust_account_balance: {
        Args: {
          target_account_id: string;
          amount: number;
          direction: 'in' | 'out';
          title?: string | null;
          notes?: string | null;
          adjustment_date?: string | null;
        };
        Returns: {
          success: boolean;
          id: string;
        };
      };
      seed_default_accounts_for_user: {
        Args: {
          target_user_id: string;
        };
        Returns: void;
      };
      record_debt_transaction: {
        Args: {
          p_contact_id: string;
          p_account_id: string;
          p_amount: number;
          p_debt_type: 'receivable' | 'payable' | 'receivable_payment' | 'payable_payment';
          p_title?: string | null;
          p_notes?: string | null;
          p_date?: string | null;
          p_due_date?: string | null;
        };
        Returns: {
          success: boolean;
          id: string;
          error?: string;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountType = Account['type'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type DebtType = 'receivable' | 'payable' | 'receivable_payment' | 'payable_payment';

export type ExpenseWithCategory = Expense & {
  categories: Category | null;
  accounts?: Account | null;
  to_accounts?: Account | null;
  contacts?: Contact | null;
};

export type Transaction = ExpenseWithCategory;

export interface ContactWithLedger extends Contact {
  total_receivable: number; // Lent to them
  total_receivable_collected: number; // They paid back
  outstanding_receivable: number; // Remaining they owe
  total_payable: number; // Borrowed from them
  total_payable_paid: number; // Repaid to them
  outstanding_payable: number; // Remaining I owe
  net_balance: number; // > 0: they owe me, < 0: I owe them, 0: settled
  last_transaction_date?: string | null;
  transaction_count: number;
}

export interface DebtSummary {
  total_receivable: number; // total amount others owe me
  total_payable: number; // total amount I owe others
  net_balance: number; // total_receivable - total_payable
  contact_count: number;
  active_debt_count: number;
}

export interface RecordDebtRequest {
  contact_id: string;
  account_id: string;
  amount: number;
  debt_type: DebtType;
  title?: string | null;
  notes?: string | null;
  date?: string;
  due_date?: string | null;
}

export interface CategoryMonthlyUsage {
  category_id: string;
  category_name: string;
  category_type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  monthly_limit: number;
  total_spent: number;
  usage_percentage: number;
  remaining_limit: number;
  is_over_budget: boolean;
}

export interface AccountingSummary {
  total_debits: number;
  total_credits: number;
  net_balance: number;
  transaction_count: number;
  status: 'surplus' | 'deficit';
  total_account_balance?: number;
}

export interface TransferRequest {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  notes?: string | null;
  transfer_date?: string;
}

export interface AdjustmentRequest {
  account_id: string;
  amount: number;
  direction: 'in' | 'out';
  title?: string;
  notes?: string | null;
  adjustment_date?: string;
}
