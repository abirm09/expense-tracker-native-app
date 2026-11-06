import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  KeyRound,
  Lock,
  Plus,
  ShoppingBag,
  Sliders,
  Tag,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as React from 'react';

import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountTransferModal } from '@/components/accounts/account-transfer-modal';
import { getAccountIcon } from '@/components/accounts/account-utils';
import { PinSetupModal } from '@/components/auth/pin-setup-modal';
import { CategoryBudgetUsageSection } from '@/components/categories/category-budget-usage-section';
import { CategoryManagementModal } from '@/components/categories/category-management-modal';
import { AccountingLedgerCard } from '@/components/expenses/accounting-ledger-card';
import { AddTransactionModal } from '@/components/expenses/add-transaction-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/auth-context';
import { formatBDT } from '@/lib/format-currency';
import { useGetAccountsQuery } from '@/store/api/accounts-api';
import { useGetDebtSummaryQuery } from '@/store/api/debts-api';
import { useGetExpensesQuery, useGetExpenseStatsQuery } from '@/store/api/expenses-api';

const SAMPLE_TRANSACTIONS = [
  {
    id: 'sample-1',
    title: 'Salary Deposit',
    category: 'Salary',
    amount: 3500.0,
    type: 'income',
    date: 'Today',
    icon: TrendingUp,
    color: '#10b981',
  },
  {
    id: 'sample-2',
    title: 'Whole Foods Market',
    category: 'Groceries',
    amount: 84.5,
    type: 'expense',
    date: 'Yesterday',
    icon: ShoppingBag,
    color: '#f59e0b',
  },
  {
    id: 'sample-3',
    title: 'Electricity & Gas',
    category: 'Housing & Utilities',
    amount: 120.0,
    type: 'expense',
    date: 'Oct 12',
    icon: Tag,
    color: '#6366f1',
  },
];

export default function OverviewScreen() {
  const { user, profile, hasPin, lockApp } = useAuth();
  const [showPinModal, setShowPinModal] = React.useState(false);
  const [modalType, setModalType] = React.useState<'expense' | 'income' | 'transfer' | null>(null);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [showTransferModal, setShowTransferModal] = React.useState(false);

  // RTK Query hooks
  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    isFetching: isFetchingTransactions,
    refetch: refetchTransactions,
  } = useGetExpensesQuery({ limit: 6 });

  const {
    data: stats,
    refetch: refetchStats,
  } = useGetExpenseStatsQuery();

  const {
    data: accounts = [],
    refetch: refetchAccounts,
  } = useGetAccountsQuery();

  const {
    data: debtSummary,
    refetch: refetchDebts,
  } = useGetDebtSummaryQuery();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const totalAccountBalance = React.useMemo(() => {
    return accounts.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);
  }, [accounts]);

  const hasRealActivity = transactions.length > 0;
  // Accounts alone are real data even before the first transaction (e.g. a user
  // who set an opening balance). Never show sample money when real accounts exist.
  const hasRealData = accounts.length > 0 || hasRealActivity;
  const totalSpent = stats?.totalSpent ?? 0;
  const totalIncome = stats?.totalIncome ?? 0;
  // If accounts exist, use total liquid accounts balance so internal transfers never cut off net balance
  const netBalance = accounts.length > 0 ? totalAccountBalance : (stats?.netSavings ?? 0);

  const handleRefresh = React.useCallback(async () => {
    await Promise.all([refetchTransactions(), refetchStats(), refetchAccounts(), refetchDebts()]);
  }, [refetchTransactions, refetchStats, refetchAccounts, refetchDebts]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="p-5 pb-12 gap-5 max-w-xl mx-auto w-full"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetchingTransactions}
            onRefresh={handleRefresh}
          />
        }>
        {/* User Module Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <HamburgerButton />
            <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center border border-primary/20">
              <Icon as={User} className="text-primary" size={18} />
            </View>
            <View className="flex-1">
              <Text variant="large" className="font-bold text-foreground" numberOfLines={1}>
                Hi, {displayName}
              </Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            {hasPin ? (
              <Button
                variant="outline"
                size="sm"
                onPress={lockApp}
                className="flex-row items-center gap-1.5 px-3 h-9 rounded-xl border-border">
                <Icon as={Lock} className="text-foreground" size={14} />
                <Text variant="small" className="text-foreground font-semibold">
                  Lock
                </Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setShowPinModal(true)}
                className="flex-row items-center gap-1.5 px-3 h-9 rounded-xl border-border">
                <Icon as={Lock} className="text-muted-foreground" size={14} />
                <Text variant="small" className="text-muted-foreground font-medium">
                  Set PIN
                </Text>
              </Button>
            )}
          </View>
        </View>

        {/* Security PIN Setup Prompt: Render ONLY if PIN is NOT set up yet */}
        {!hasPin && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                  <Icon as={KeyRound} className="text-primary" size={22} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold text-sm">Secure Your App</Text>
                    <Badge variant="outline" className="px-2 py-0">
                      <Text className="text-[10px]">Setup PIN</Text>
                    </Badge>
                  </View>
                  <Text variant="muted" className="text-xs mt-0.5">
                    Set a 5-digit PIN to open the app quickly without typing password
                  </Text>
                </View>
              </View>

              <Button
                size="sm"
                onPress={() => setShowPinModal(true)}
                className="flex-row items-center gap-1">
                <Icon as={KeyRound} className="text-primary-foreground" size={14} />
                <Text className="text-xs text-primary-foreground">Set PIN</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Net Balance Card */}
        <Card className="bg-primary text-primary-foreground border-none shadow-md">
          <CardHeader>
            <CardDescription className="text-primary-foreground/70 text-xs">
              {hasRealData ? 'Total Net Balance' : 'Sample Balance'}
            </CardDescription>
            <CardTitle className="text-3xl text-primary-foreground font-bold">
              {hasRealData
                ? formatBDT(netBalance)
                : '৳3,295.50'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-row items-center justify-between pt-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 rounded-full bg-emerald-500/20 items-center justify-center">
                <Icon as={ArrowDownLeft} size={16} className="text-emerald-500" />
              </View>
              <View>
                <Text className="text-xs text-primary-foreground/70">Total Income</Text>
                <Text className="text-sm font-semibold text-primary-foreground">
                  {hasRealData ? formatBDT(totalIncome, { showSign: true }) : '+৳3,500.00'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 rounded-full bg-rose-500/20 items-center justify-center">
                <Icon as={ArrowUpRight} size={16} className="text-rose-500" />
              </View>
              <View>
                <Text className="text-xs text-primary-foreground/70">Total Expenses</Text>
                <Text className="text-sm font-semibold text-primary-foreground">
                  {hasRealData ? `-${formatBDT(totalSpent)}` : '-৳204.50'}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Accounting Ledger Summary Card (Debits vs Credits) */}
        <AccountingLedgerCard />

        {/* Receivable & Payable Summary Card */}
        <Pressable
          onPress={() => router.push('/(tabs)/debts' as any)}
          className="p-4 rounded-2xl bg-card border border-border shadow-2xs active:scale-[0.99] transition-all">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 rounded-xl bg-purple-500/10 items-center justify-center">
                <Icon as={Users} size={16} className="text-purple-600 dark:text-purple-400" />
              </View>
              <View>
                <Text className="text-xs font-bold text-foreground">Receivable & Payable</Text>
                <Text className="text-[10px] text-muted-foreground">Lend, borrow & user ledger</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-semibold text-primary">Open</Text>
              <Icon as={ArrowUpRight} size={14} className="text-primary" />
            </View>
          </View>

          <View className="flex-row gap-2 mt-1">
            <View className="flex-1 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                Receivable (To Get)
              </Text>
              <Text className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                {formatBDT(debtSummary?.total_receivable ?? 0)}
              </Text>
            </View>
            <View className="flex-1 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
              <Text className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                Payable (To Pay)
              </Text>
              <Text className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                {formatBDT(debtSummary?.total_payable ?? 0)}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Quick Action Buttons (Add Debit / Credit & Transfer) */}
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            <Button
              onPress={() => setModalType('expense')}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-rose-600 active:bg-rose-700 h-10 px-2">
              <Icon as={Plus} className="text-white" size={14} />
              <Text className="font-semibold text-white text-xs">Expense</Text>
            </Button>

            <Button
              onPress={() => setModalType('income')}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-emerald-600 active:bg-emerald-700 h-10 px-2">
              <Icon as={Plus} className="text-white" size={14} />
              <Text className="font-semibold text-white text-xs">Income</Text>
            </Button>

            <Button
              onPress={() => setModalType('transfer')}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-purple-600 active:bg-purple-700 h-10 px-2">
              <Icon as={ArrowLeftRight} className="text-white" size={14} />
              <Text className="font-semibold text-white text-xs">Transfer</Text>
            </Button>
          </View>

          <Button
            variant="outline"
            size="sm"
            onPress={() => setShowCategoryModal(true)}
            className="flex-row items-center justify-center gap-2 border-border/70 py-2.5">
            <Icon as={Sliders} size={14} className="text-muted-foreground" />
            <Text className="text-xs font-semibold text-foreground">
              Manage Dynamic Categories & Limits
            </Text>
          </Button>
        </View>

        {/* Financial Accounts & Wallets Carousel */}
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon as={Wallet} size={16} className="text-primary" />
              <Text className="font-bold text-base text-foreground">
                Accounts & Wallets
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/accounts')}
              className="flex-row items-center gap-1">
              <Text className="text-xs font-semibold text-primary">Manage</Text>
            </Pressable>
          </View>

          {accounts.length === 0 ? (
            <Pressable
              onPress={() => router.push('/(tabs)/accounts')}
              className="p-4 rounded-2xl border border-dashed border-border bg-card items-center justify-center">
              <Text className="text-xs text-muted-foreground font-medium">
                No accounts set up yet. Tap to add bank, cash, or mobile wallet.
              </Text>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-0.5">
              <View className="flex-row gap-3">
                {accounts.map((acc) => {
                  const AccIcon = getAccountIcon(acc.type);
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => router.push('/(tabs)/accounts')}
                      className="p-3.5 rounded-2xl border border-border bg-card min-w-[150px] shadow-sm">
                      <View className="flex-row items-center justify-between mb-2">
                        <View
                          className="h-8 w-8 rounded-xl items-center justify-center"
                          style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                          <Icon as={AccIcon} size={16} color={acc.color || '#10b981'} />
                        </View>
                        {acc.is_default && (
                          <Badge variant="outline" className="px-1.5 py-0 border-primary/30 bg-primary/10">
                            <Text className="text-[9px] font-bold text-primary">DEFAULT</Text>
                          </Badge>
                        )}
                      </View>
                      <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text className="text-base font-extrabold text-foreground mt-0.5">
                        {formatBDT(acc.current_balance)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Dynamic Category Monthly Budgets & Usage Progress */}
        <CategoryBudgetUsageSection
          onOpenManageCategories={() => setShowCategoryModal(true)}
        />

        {/* Recent Activity Section */}
        <View className="gap-3 pt-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text variant="large" className="font-bold">Recent Activity</Text>
              {!hasRealData && !isLoadingTransactions && (
                <Badge variant="secondary" className="px-1.5 py-0">
                  <Text className="text-[10px]">Sample</Text>
                </Badge>
              )}
            </View>
            {hasRealActivity && (
              <Badge variant="outline" className="px-2 py-0.5">
                <Text className="text-xs">{transactions.length} items</Text>
              </Badge>
            )}
          </View>

          {isLoadingTransactions ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="small" />
              <Text variant="muted" className="text-xs mt-2">
                Loading transactions...
              </Text>
            </View>
          ) : hasRealActivity ? (
            transactions.map((item) => {
              const titleLower = (item.title || '').toLowerCase();
              const isTransferIn =
                item.entry_type === 'transfer_in' ||
                titleLower.startsWith('transfer from ');
              const isTransferOut =
                item.entry_type === 'transfer_out' ||
                titleLower.startsWith('transfer to ');
              const isTransfer =
                item.type === 'transfer' ||
                !!item.transfer_group_id ||
                isTransferIn ||
                isTransferOut;
              const isCredit =
                item.entry_type === 'credit' ||
                isTransferIn ||
                (!isTransfer && (item.type === 'income' || (!item.type && Number(item.amount) > 0)));
              const absAmount = Math.abs(Number(item.amount));

              let categoryName = item.categories?.name;
              let categoryColor = item.categories?.color;
              let iconComp = isCredit ? ArrowDownLeft : Tag;

              if (isTransfer) {
                iconComp = ArrowLeftRight;
                if (isTransferIn) {
                  categoryName = 'Transfer In';
                  categoryColor = '#10b981';
                } else {
                  categoryName = 'Transfer Out';
                  categoryColor = '#8b5cf6';
                }
              } else if (!categoryName) {
                categoryName = isCredit ? 'Income' : 'General';
                categoryColor = isCredit ? '#10b981' : '#64748b';
              }

              return (
                <Card key={item.id} className="py-3.5">
                  <CardContent className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1 pr-3">
                      <View
                        className="h-10 w-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${categoryColor || '#10b981'}20` }}>
                        <Icon
                          as={iconComp}
                          size={18}
                          color={categoryColor || '#10b981'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-foreground" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {item.date} • {categoryName}
                          {item.accounts?.name ? ` • ${item.accounts.name}` : ''}
                        </Text>
                      </View>
                    </View>

                    <Text
                      className={`font-bold text-sm ${
                        isCredit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isTransferOut
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                      {isCredit ? `+${formatBDT(absAmount)}` : `-${formatBDT(absAmount)}`}
                    </Text>
                  </CardContent>
                </Card>
              );
            })
          ) : !hasRealData ? (
            SAMPLE_TRANSACTIONS.map((item) => (
              <Card key={item.id} className="py-3.5">
                <CardContent className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 pr-3">
                    <View
                      className="h-10 w-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${item.color}20` }}>
                      <Icon as={item.icon} size={18} color={item.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-foreground">{item.title}</Text>
                      <Text variant="muted" className="text-xs">
                        {item.date} • {item.category}
                      </Text>
                    </View>
                  </View>

                  <Text
                    className="font-bold text-sm"
                    style={{
                      color: item.type === 'income' ? '#10b981' : '#ef4444',
                    }}>
                    {item.type === 'income' ? `+${formatBDT(item.amount)}` : `-${formatBDT(item.amount)}`}
                  </Text>
                </CardContent>
              </Card>
            ))
          ) : (
            <View className="py-10 px-6 items-center justify-center bg-card rounded-2xl border border-dashed border-border gap-2">
              <Icon as={Tag} size={24} className="text-muted-foreground" />
              <Text className="text-sm font-semibold text-foreground">No transactions yet</Text>
              <Text variant="muted" className="text-xs text-center">
                Add your first expense, income, or transfer to see it here.
              </Text>
            </View>
          )}
        </View>

        {/* PIN Setup Modal */}
        <PinSetupModal
          visible={showPinModal}
          onClose={() => setShowPinModal(false)}
        />

        {/* Add Transaction Modal */}
        <AddTransactionModal
          visible={modalType !== null}
          defaultType={modalType ?? 'expense'}
          onClose={() => setModalType(null)}
        />

        {/* Dynamic Category Management Modal */}
        <CategoryManagementModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
        />

        {/* Inter-Account Transfer Modal */}
        <AccountTransferModal
          visible={showTransferModal}
          onClose={() => setShowTransferModal(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
