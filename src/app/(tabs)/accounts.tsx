import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Filter,
  Plus,
  Scale,
  Search,
  Wallet,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountAdjustModal } from '@/components/accounts/account-adjust-modal';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { AccountCard } from '@/components/accounts/account-card';
import { AccountFormModal } from '@/components/accounts/account-form-modal';
import { AccountTransferModal } from '@/components/accounts/account-transfer-modal';
import { getAccountIcon } from '@/components/accounts/account-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import {
  useGetAccountsQuery,
  useGetCashbookEntriesQuery,
} from '@/store/api/accounts-api';
import { Account, ExpenseWithCategory } from '@/types/database.types';

export default function AccountsScreen() {
  const [selectedAccountFilter, setSelectedAccountFilter] = React.useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<
    'all' | 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment'
  >('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Modals state
  const [showAccountForm, setShowAccountForm] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [showTransferModal, setShowTransferModal] = React.useState(false);
  const [transferFromAccountId, setTransferFromAccountId] = React.useState<string | null>(null);
  const [showAdjustModal, setShowAdjustModal] = React.useState(false);
  const [adjustAccountId, setAdjustAccountId] = React.useState<string | null>(null);

  // Queries
  const {
    data: accounts = [],
    isLoading: isLoadingAccounts,
    isFetching: isFetchingAccounts,
    refetch: refetchAccounts,
  } = useGetAccountsQuery();

  const {
    data: cashbookEntries = [],
    isLoading: isLoadingCashbook,
    isFetching: isFetchingCashbook,
    refetch: refetchCashbook,
  } = useGetCashbookEntriesQuery({
    account_id: selectedAccountFilter === 'all' ? null : selectedAccountFilter,
    entry_type: selectedTypeFilter === 'all' ? null : selectedTypeFilter,
    search: searchQuery.trim() || undefined,
  });

  const isRefreshing = isFetchingAccounts || isFetchingCashbook;

  const handleRefresh = React.useCallback(() => {
    refetchAccounts();
    refetchCashbook();
  }, [refetchAccounts, refetchCashbook]);

  // Total balance across all accounts
  const totalBalance = React.useMemo(() => {
    return accounts.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);
  }, [accounts]);

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setShowAccountForm(true);
  };

  const handleOpenTransfer = (acc?: Account) => {
    setTransferFromAccountId(acc?.id || null);
    setShowTransferModal(true);
  };

  const handleOpenAdjust = (acc?: Account) => {
    setAdjustAccountId(acc?.id || null);
    setShowAdjustModal(true);
  };

  const TYPE_FILTERS = [
    { id: 'all', label: 'All Entries' },
    { id: 'debit', label: 'Debits (Outflow)' },
    { id: 'credit', label: 'Credits (Inflow)' },
    { id: 'transfer_out', label: 'Transfer Out' },
    { id: 'transfer_in', label: 'Transfer In' },
    { id: 'adjustment', label: 'Adjustments' },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-3 border-b border-border/40">
        <HamburgerButton />
        <View className="flex-1">
          <Text variant="h3" className="font-bold" numberOfLines={1}>
            Accounts & Ledger
          </Text>
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            Bank, mobile wallet, and cash management
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="p-5 pt-3 pb-20 gap-5 max-w-2xl mx-auto w-full"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }>
        {/* Action Row (Scrollable) */}
        <View className="flex-row items-center gap-2.5">
          <Button
            onPress={() => {
              setEditingAccount(null);
              setShowAccountForm(true);
            }}
            className="flex-1 flex-row items-center justify-center gap-2 bg-primary h-10 rounded-xl">
            <Icon as={Plus} size={15} className="text-primary-foreground" />
            <Text className="text-xs font-semibold text-primary-foreground">Add New Account</Text>
          </Button>
          <Button
            variant="outline"
            onPress={() => setShowTransferModal(true)}
            disabled={accounts.length < 2}
            className="flex-row items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl border-border bg-card">
            <Icon as={ArrowLeftRight} size={14} className="text-foreground" />
            <Text className="text-xs font-medium text-foreground">Transfer</Text>
          </Button>
        </View>

        {/* Total Liquidity Net Worth Card */}
        <Card className="bg-primary text-primary-foreground border-none shadow-md overflow-hidden">
          <CardContent className="p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 rounded-full bg-primary-foreground/15 items-center justify-center">
                  <Icon as={Wallet} size={16} className="text-primary-foreground" />
                </View>
                <Text className="text-xs font-semibold text-primary-foreground/80 uppercase tracking-wider">
                  Total Liquid Balance
                </Text>
              </View>
              <Badge variant="outline" className="border-primary-foreground/30 bg-primary-foreground/10 px-2.5 py-0.5">
                <Text className="text-[10px] font-bold text-primary-foreground">
                  {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
                </Text>
              </Badge>
            </View>

            <Text className="text-3xl font-extrabold text-primary-foreground mt-3">
              {formatBDT(totalBalance)}
            </Text>

            {/* Quick Action Toolbar */}
            <View className="flex-row gap-2.5 mt-4 pt-3 border-t border-primary-foreground/20">
              <Pressable
                onPress={() => handleOpenTransfer()}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-foreground/15 active:bg-primary-foreground/25">
                <Icon as={ArrowLeftRight} size={14} className="text-primary-foreground" />
                <Text className="text-xs font-bold text-primary-foreground">Transfer</Text>
              </Pressable>

              <Pressable
                onPress={() => handleOpenAdjust()}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-foreground/15 active:bg-primary-foreground/25">
                <Icon as={Scale} size={14} className="text-primary-foreground" />
                <Text className="text-xs font-bold text-primary-foreground">Adjust</Text>
              </Pressable>
            </View>
          </CardContent>
        </Card>

        {/* Accounts List Section */}
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <Text variant="h4" className="font-bold">
              My Financial Accounts
            </Text>
            <Text variant="muted" className="text-xs">
              {accounts.length} active
            </Text>
          </View>

          {isLoadingAccounts ? (
            <ActivityIndicator size="small" className="py-6" />
          ) : accounts.length === 0 ? (
            <Card className="border-dashed p-6 items-center justify-center">
              <View className="h-12 w-12 rounded-full bg-primary/10 items-center justify-center mb-2">
                <Icon as={Wallet} size={24} className="text-primary" />
              </View>
              <Text className="font-semibold text-sm">No Accounts Configured</Text>
              <Text variant="muted" className="text-xs text-center mt-1 max-w-xs">
                Add your bank, mobile wallet (bKash/Nagad), or physical cash wallet to start tracking balances.
              </Text>
              <Button
                size="sm"
                onPress={() => {
                  setEditingAccount(null);
                  setShowAccountForm(true);
                }}
                className="mt-3">
                <Text className="text-xs text-primary-foreground font-semibold">
                  + Add First Account
                </Text>
              </Button>
            </Card>
          ) : (
            <View className="gap-3">
              {accounts.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onEdit={handleOpenEdit}
                  onTransfer={handleOpenTransfer}
                />
              ))}
            </View>
          )}
        </View>

        {/* Cashbook Ledger Section */}
        <View className="gap-3 pt-2">
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="h4" className="font-bold">
                Cashbook & Transactions
              </Text>
              <Text variant="muted" className="text-xs">
                Double-entry ledger of inflows, outflows, and transfers
              </Text>
            </View>
            <Badge variant="secondary" className="px-2 py-0.5">
              <Text className="text-[10px] font-bold">
                {cashbookEntries.length} entries
              </Text>
            </Badge>
          </View>

          {/* Search Box */}
          <View className="relative flex-row items-center">
            <View className="absolute left-3 z-10">
              <Icon as={Search} size={15} className="text-muted-foreground" />
            </View>
            <Input
              placeholder="Search ledger entries by title..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="pl-9 pr-9 h-10 rounded-xl"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                className="absolute right-3 p-1">
                <Icon as={X} size={14} className="text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>

          {/* Account Filter Pills */}
          <View className="gap-1.5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-0.5">
              <View className="flex-row gap-1.5">
                <Pressable
                  key="account-filter-all"
                  onPress={() => setSelectedAccountFilter('all')}
                  className={`px-3 py-1.5 rounded-full border ${
                    selectedAccountFilter === 'all'
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'bg-muted/40 border-border/70'
                  }`}>
                  <Text
                    className={`text-xs font-semibold ${
                      selectedAccountFilter === 'all' ? 'text-white' : 'text-foreground'
                    }`}>
                    All Accounts
                  </Text>
                </Pressable>

                {accounts.map((acc) => {
                  const isSelected = selectedAccountFilter === acc.id;
                  const AccIcon = getAccountIcon(acc.type);
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => setSelectedAccountFilter(acc.id)}
                      className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-muted/40 border-border/70'
                      }`}>
                      <Icon
                        as={AccIcon}
                        size={12}
                        className={isSelected ? 'text-white' : undefined}
                        color={isSelected ? undefined : acc.color || '#10b981'}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-white' : 'text-foreground'
                        }`}>
                        {acc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Type Filter Pills */}
          <View className="gap-1.5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-0.5">
              <View className="flex-row gap-1.5">
                {TYPE_FILTERS.map((f) => {
                  const isSelected = selectedTypeFilter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setSelectedTypeFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg border ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-muted/20 border-border/50'
                      }`}>
                      <Text
                        className={`text-[11px] font-medium ${
                          isSelected ? 'text-white font-bold' : 'text-muted-foreground'
                        }`}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Cashbook Entries List */}
          {isLoadingCashbook ? (
            <ActivityIndicator size="small" className="py-8" />
          ) : cashbookEntries.length === 0 ? (
            <View className="py-12 items-center justify-center p-6 bg-card rounded-2xl border border-dashed border-border">
              <Icon as={Filter} size={24} className="text-muted-foreground mb-2" />
              <Text className="font-semibold text-sm">No Ledger Entries Found</Text>
              <Text variant="muted" className="text-xs text-center mt-1">
                {searchQuery || selectedAccountFilter !== 'all' || selectedTypeFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Start making expenses, incomes, or transfers to build your ledger.'}
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {cashbookEntries.map((item: ExpenseWithCategory) => {
                const titleLower = (item.title || '').toLowerCase();
                const isTransfer =
                  item.type === 'transfer' ||
                  item.entry_type === 'transfer_out' ||
                  item.entry_type === 'transfer_in' ||
                  !!item.transfer_group_id ||
                  titleLower.startsWith('transfer to ') ||
                  titleLower.startsWith('transfer from ');
                const isTransferIn =
                  item.entry_type === 'transfer_in' ||
                  (isTransfer && titleLower.startsWith('transfer from '));
                const isTransferOut =
                  item.entry_type === 'transfer_out' ||
                  (isTransfer && titleLower.startsWith('transfer to '));
                const isCredit =
                  item.entry_type === 'credit' ||
                  isTransferIn ||
                  (!isTransfer && (item.type === 'income' || (!item.type && Number(item.amount) > 0)));
                const isAdjustment =
                  item.entry_type === 'adjustment' || titleLower.includes('adjustment');
                const absAmount = Math.abs(Number(item.amount));

                let iconComp = isCredit ? ArrowDownLeft : ArrowUpRight;
                let iconColor = isCredit ? '#10b981' : '#ef4444';
                let badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive' = 'default';
                let badgeLabel = 'DEBIT';

                if (isTransfer) {
                  iconComp = ArrowLeftRight;
                  iconColor = isTransferIn ? '#10b981' : '#8b5cf6';
                  badgeLabel = isTransferIn ? 'TRANSFER IN' : 'TRANSFER OUT';
                  badgeVariant = isTransferIn ? 'default' : 'secondary';
                } else if (isAdjustment) {
                  iconComp = Scale;
                  iconColor = '#f59e0b';
                  badgeLabel = 'ADJUSTMENT';
                  badgeVariant = 'outline';
                } else if (isCredit) {
                  badgeLabel = 'CREDIT';
                  badgeVariant = 'default';
                } else {
                  badgeLabel = 'DEBIT';
                  badgeVariant = 'destructive';
                }

                const accountName = item.accounts?.name || 'Unlinked Account';
                const categoryName = item.categories?.name;

                return (
                  <Card key={item.id} className="py-3 px-3.5 border-border">
                    <CardContent className="flex-row items-center justify-between p-0">
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View
                          className="h-10 w-10 rounded-xl items-center justify-center"
                          style={{ backgroundColor: `${iconColor}20` }}>
                          <Icon as={iconComp} size={18} color={iconColor} />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-sm text-foreground" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge variant={badgeVariant} className="px-1 py-0">
                              <Text className="text-[9px] font-bold">{badgeLabel}</Text>
                            </Badge>
                            <Text variant="muted" className="text-xs">
                              {item.date} • {accountName}
                              {categoryName ? ` • ${categoryName}` : ''}
                            </Text>
                          </View>
                          {item.notes ? (
                            <Text variant="muted" className="text-[11px] italic mt-0.5" numberOfLines={1}>
                              &ldquo;{item.notes}&rdquo;
                            </Text>
                          ) : null}
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
                        {isCredit ? '+' : '-'}
                        {formatBDT(absAmount)}
                      </Text>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Account Modals */}
      <AccountFormModal
        visible={showAccountForm}
        onClose={() => {
          setShowAccountForm(false);
          setEditingAccount(null);
        }}
        accountToEdit={editingAccount}
      />

      <AccountTransferModal
        visible={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setTransferFromAccountId(null);
        }}
        initialFromAccountId={transferFromAccountId}
      />

      <AccountAdjustModal
        visible={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false);
          setAdjustAccountId(null);
        }}
        initialAccountId={adjustAccountId}
      />
    </SafeAreaView>
  );
}
