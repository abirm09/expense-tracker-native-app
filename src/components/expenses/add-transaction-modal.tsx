import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Plus, Tag, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountFormModal } from '@/components/accounts/account-form-modal';
import { getAccountIcon } from '@/components/accounts/account-utils';
import { CategoryFormCard } from '@/components/categories/category-form-modal';
import { getCategoryIcon } from '@/components/categories/category-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAppTheme } from '@/context/theme-context';
import { formatBDT } from '@/lib/format-currency';
import {
  useGetAccountsQuery,
  useTransferBetweenAccountsMutation,
} from '@/store/api/accounts-api';
import { useGetCategoriesQuery } from '@/store/api/categories-api';
import { useAddExpenseMutation } from '@/store/api/expenses-api';
import { Account } from '@/types/database.types';

export type TransactionType = 'expense' | 'income' | 'transfer';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
}

function AddTransactionModalContent({
  onClose,
  defaultType = 'expense',
}: {
  onClose: () => void;
  defaultType?: TransactionType;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxModalHeight = Math.round(windowHeight * 0.88);
  const { isDark } = useAppTheme();
  const [transactionType, setTransactionType] = React.useState<TransactionType>(defaultType);
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [selectedFromAccountId, setSelectedFromAccountId] = React.useState<string | null>(null);
  const [selectedToAccountId, setSelectedToAccountId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = React.useState(false);
  const [showAccountForm, setShowAccountForm] = React.useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const { data: categories = [], isLoading: isLoadingCategories } = useGetCategoriesQuery({
    type: transactionType === 'income' ? 'income' : 'expense',
  });

  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();

  const [addExpense, { isLoading: isAddingExpense }] = useAddExpenseMutation();
  const [transferBetweenAccounts, { isLoading: isTransferring }] = useTransferBetweenAccountsMutation();
  const isSubmitting = isAddingExpense || isTransferring;

  const activeCategoryId = selectedCategoryId ?? categories[0]?.id ?? null;
  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const activeAccountId = selectedAccountId ?? defaultAccount?.id ?? null;

  const fromAccountId =
    selectedFromAccountId ?? activeAccountId ?? (accounts.length > 0 ? accounts[0].id : '');
  const toAccountId =
    selectedToAccountId ??
    (accounts.length > 1
      ? accounts.find((a) => a.id !== fromAccountId)?.id || accounts[1].id
      : accounts.length === 1 && accounts[0].id !== fromAccountId
      ? accounts[0].id
      : '');

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const handleSwapAccounts = () => {
    if (fromAccountId && toAccountId) {
      setSelectedFromAccountId(toAccountId);
      setSelectedToAccountId(fromAccountId);
      setSelectedAccountId(toAccountId);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setSelectedCategoryId(null);
    setSelectedAccountId(null);
    setSelectedFromAccountId(null);
    setSelectedToAccountId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isIncome = transactionType === 'income';
  const isTransfer = transactionType === 'transfer';
  const isExpense = transactionType === 'expense';

  const handleSubmit = async () => {
    const cleanAmount = amount.replace(/,/g, '').trim();
    const numericAmount = parseFloat(cleanAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (isTransfer) {
      if (!fromAccountId) {
        setError('Please select a source account (From)');
        return;
      }
      if (!toAccountId) {
        setError('Please select a destination account (To)');
        return;
      }
      if (fromAccountId === toAccountId) {
        setError('Source and destination accounts must be different');
        return;
      }

      setError(null);
      try {
        await transferBetweenAccounts({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: Math.abs(numericAmount),
          notes: notes.trim() || (title.trim() ? title.trim() : null),
          transfer_date: date || new Date().toISOString().split('T')[0],
        }).unwrap();

        handleClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transfer failed';
        setError(msg);
      }
      return;
    }

    if (!title.trim()) {
      setError('Please enter a description or title');
      return;
    }

    setError(null);
    try {
      await addExpense({
        title: title.trim(),
        amount: Math.abs(numericAmount),
        type: transactionType,
        entry_type: transactionType === 'income' ? 'credit' : 'debit',
        category_id: activeCategoryId,
        account_id: activeAccountId,
        date: date || new Date().toISOString().split('T')[0],
        notes: notes.trim() || null,
        currency: 'BDT',
      }).unwrap();

      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(msg);
    }
  };

  return (
    <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="absolute inset-0" onPress={handleClose} />
        <View
          className="bg-card rounded-t-3xl border-t border-border flex-col overflow-hidden w-full"
          style={{
            height: maxModalHeight,
            maxHeight: maxModalHeight,
            paddingBottom: Math.max(insets.bottom, 16),
          }}>
          {/* Header */}
          <View className="shrink-0 flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-border">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <View
                className="h-8 w-8 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isTransfer
                    ? 'rgba(124, 58, 237, 0.15)'
                    : isIncome
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                }}>
                <Icon
                  as={isTransfer ? ArrowLeftRight : isIncome ? ArrowDownLeft : ArrowUpRight}
                  size={16}
                  color={isTransfer ? '#7c3aed' : isIncome ? '#10b981' : '#ef4444'}
                />
              </View>
              <Text variant="h4" className="font-bold flex-1" numberOfLines={1}>
                {isTransfer
                  ? 'Account Transfer'
                  : isIncome
                  ? 'Add New Income'
                  : 'Add New Expense'}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              className="h-8 w-8 rounded-full bg-muted items-center justify-center">
              <Icon as={X} className="text-foreground" size={16} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            className="px-6 py-4 flex-1"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 350 }}>
            <View className="gap-4">
              {/* Type Switcher: Debit (Expense) / Credit (Income) / Transfer */}
              <View className="gap-1">
                <Text variant="small" className="font-semibold text-foreground">
                  Transaction Type
                </Text>
                <View className="flex-row rounded-xl bg-muted p-1 border border-border/50">
                  <Pressable
                    key="tab-debit"
                    onPress={() => {
                      setTransactionType('expense');
                      setSelectedCategoryId(null);
                    }}
                    style={{
                      backgroundColor: isExpense ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      elevation: isExpense ? 1 : 0,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isExpense ? 0.08 : 0,
                      shadowRadius: 2,
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 border ${
                      isExpense ? (isDark ? 'border-rose-500/30' : 'border-rose-200/80') : 'border-transparent'
                    }`}>
                    <Icon
                      as={ArrowUpRight}
                      size={15}
                      color={isExpense ? '#ef4444' : '#64748b'}
                    />
                    <Text
                      style={{ color: isExpense ? (isDark ? '#f87171' : '#dc2626') : '#64748b' }}
                      className="text-xs font-bold">
                      Expense
                    </Text>
                  </Pressable>

                  <Pressable
                    key="tab-credit"
                    onPress={() => {
                      setTransactionType('income');
                      setSelectedCategoryId(null);
                    }}
                    style={{
                      backgroundColor: isIncome ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      elevation: isIncome ? 1 : 0,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isIncome ? 0.08 : 0,
                      shadowRadius: 2,
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 border ${
                      isIncome ? (isDark ? 'border-emerald-500/30' : 'border-emerald-200/80') : 'border-transparent'
                    }`}>
                    <Icon
                      as={ArrowDownLeft}
                      size={15}
                      color={isIncome ? '#10b981' : '#64748b'}
                    />
                    <Text
                      style={{ color: isIncome ? (isDark ? '#34d399' : '#059669') : '#64748b' }}
                      className="text-xs font-bold">
                      Income
                    </Text>
                  </Pressable>

                  <Pressable
                    key="tab-transfer"
                    onPress={() => {
                      setTransactionType('transfer');
                    }}
                    style={{
                      backgroundColor: isTransfer ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      elevation: isTransfer ? 1 : 0,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isTransfer ? 0.08 : 0,
                      shadowRadius: 2,
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 border ${
                      isTransfer ? (isDark ? 'border-purple-500/30' : 'border-purple-200/80') : 'border-transparent'
                    }`}>
                    <Icon
                      as={ArrowLeftRight}
                      size={14}
                      color={isTransfer ? '#8b5cf6' : '#64748b'}
                    />
                    <Text
                      style={{ color: isTransfer ? (isDark ? '#c084fc' : '#7c3aed') : '#64748b' }}
                      className="text-xs font-bold">
                      Transfer
                    </Text>
                  </Pressable>
                </View>
              </View>

              {isTransfer ? (
                <>
                  {/* Transfer Info Banner */}
                  <View className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex-row items-center gap-2.5">
                    <Icon as={ArrowLeftRight} size={16} className="text-purple-600 dark:text-purple-400" />
                    <Text className="text-xs text-foreground flex-1">
                      Transfer moves money directly between your accounts without affecting category budget limits.
                    </Text>
                  </View>

                  {/* From Account Selector */}
                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text variant="small" className="font-medium text-foreground">
                        From Account (Outflow)
                      </Text>
                      {fromAccount && (
                        <Text variant="muted" className="text-[11px]">
                          Available:{' '}
                          <Text className="font-bold text-foreground">
                            {formatBDT(fromAccount.current_balance)}
                          </Text>
                        </Text>
                      )}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                      <View className="flex-row gap-2">
                        {accounts.map((acc: Account) => {
                          const isSelected = fromAccountId === acc.id;
                          const AccIcon = getAccountIcon(acc.type);
                          const isDest = toAccountId === acc.id;
                          return (
                            <Pressable
                              key={`from-${acc.id}`}
                              disabled={isDest}
                              onPress={() => setSelectedFromAccountId(acc.id)}
                              className={`p-2.5 rounded-2xl border min-w-[130px] ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : isDest
                                  ? 'border-border/40 bg-muted/20 opacity-40'
                                  : 'border-border bg-card'
                              }`}>
                              <View className="flex-row items-center justify-between mb-1">
                                <View
                                  className="h-6 w-6 rounded-lg items-center justify-center"
                                  style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                  <Icon as={AccIcon} size={12} color={acc.color || '#10b981'} />
                                </View>
                                {isSelected && <Icon as={Check} size={13} className="text-purple-600" />}
                              </View>
                              <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                                {acc.name}
                              </Text>
                              <Text className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                {formatBDT(acc.current_balance)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Swap Button */}
                  <View className="items-center -my-1">
                    <Pressable
                      onPress={handleSwapAccounts}
                      className="h-8 w-8 rounded-full bg-muted border border-border items-center justify-center active:bg-purple-500/10">
                      <Icon as={ArrowLeftRight} size={14} className="text-foreground" />
                    </Pressable>
                  </View>

                  {/* To Account Selector */}
                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text variant="small" className="font-medium text-foreground">
                        To Account (Inflow)
                      </Text>
                      {toAccount && (
                        <Text variant="muted" className="text-[11px]">
                          Balance:{' '}
                          <Text className="font-bold text-foreground">
                            {formatBDT(toAccount.current_balance)}
                          </Text>
                        </Text>
                      )}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                      <View className="flex-row gap-2">
                        {accounts.map((acc: Account) => {
                          const isSelected = toAccountId === acc.id;
                          const AccIcon = getAccountIcon(acc.type);
                          const isSrc = fromAccountId === acc.id;
                          return (
                            <Pressable
                              key={`to-${acc.id}`}
                              disabled={isSrc}
                              onPress={() => setSelectedToAccountId(acc.id)}
                              className={`p-2.5 rounded-2xl border min-w-[130px] ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : isSrc
                                  ? 'border-border/40 bg-muted/20 opacity-40'
                                  : 'border-border bg-card'
                              }`}>
                              <View className="flex-row items-center justify-between mb-1">
                                <View
                                  className="h-6 w-6 rounded-lg items-center justify-center"
                                  style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                  <Icon as={AccIcon} size={12} color={acc.color || '#10b981'} />
                                </View>
                                {isSelected && <Icon as={Check} size={13} className="text-purple-600" />}
                              </View>
                              <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                                {acc.name}
                              </Text>
                              <Text className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                {formatBDT(acc.current_balance)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </>
              ) : null}

              {/* Title Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  {isTransfer ? 'Transfer Reference (Optional)' : 'Description / Title'}
                </Text>
                <Input
                  placeholder={
                    isTransfer
                      ? `Transfer to ${toAccount?.name || 'Account'}`
                      : isIncome
                      ? 'e.g. October Salary, Freelance Gig'
                      : 'e.g. Grocery Shopping, Dinner'
                  }
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="sentences"
                />
              </View>

              {/* Amount Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Amount (৳)
                </Text>
                <Input
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Financial Account Selector (for Expense and Income) */}
              {!isTransfer && (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-medium text-foreground">
                      {isIncome ? 'Deposit Into Account' : 'Pay From Account'}
                    </Text>
                    <Pressable
                      onPress={() => setShowAccountForm(true)}
                      className="flex-row items-center gap-1">
                      <Icon as={Plus} size={13} className="text-primary" />
                      <Text className="text-[11px] font-semibold text-primary">New Account</Text>
                    </Pressable>
                  </View>

                  {isLoadingAccounts ? (
                    <ActivityIndicator size="small" className="py-2" />
                  ) : accounts.length === 0 ? (
                    <View className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Text className="text-xs text-amber-700 dark:text-amber-400">
                        No accounts found. Tap &quot;New Account&quot; to add cash, bank, or mobile wallet.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                      <View className="flex-row items-center gap-2">
                        {accounts.map((acc) => {
                          const isSelected = activeAccountId === acc.id;
                          const AccIcon = getAccountIcon(acc.type);
                          return (
                            <Pressable
                              key={acc.id}
                              onPress={() => setSelectedAccountId(acc.id)}
                              className={`px-3 py-2 rounded-2xl border flex-row items-center gap-2 ${
                                isSelected
                                  ? 'bg-primary/10 border-primary'
                                  : 'bg-muted/40 border-border/70'
                              }`}>
                              <View
                                className="h-6 w-6 rounded-lg items-center justify-center"
                                style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                <Icon as={AccIcon} size={13} color={acc.color || '#10b981'} />
                              </View>
                              <View>
                                <Text
                                  className={`text-xs font-semibold ${
                                    isSelected ? 'text-primary' : 'text-foreground'
                                  }`}>
                                  {acc.name}
                                </Text>
                                <Text className="text-[10px] text-muted-foreground font-medium">
                                  {formatBDT(acc.current_balance)}
                                </Text>
                              </View>
                              {isSelected && <Icon as={Check} size={13} className="text-primary ml-1" />}
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Categories Selector with + New Category (Only for Expense & Income) */}
              {!isTransfer && (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-medium text-foreground">
                      Category
                    </Text>
                    <Pressable
                      onPress={() => setShowCategoryForm(true)}
                      className="flex-row items-center gap-1">
                      <Icon as={Plus} size={13} className="text-primary" />
                      <Text className="text-[11px] font-semibold text-primary">New Category</Text>
                    </Pressable>
                  </View>

                  {isLoadingCategories ? (
                    <ActivityIndicator size="small" className="py-2" />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row gap-2 py-1">
                      {categories.map((cat) => {
                        const isSelected = activeCategoryId === cat.id;
                        const CatIcon = getCategoryIcon(cat.icon);
                        return (
                          <Pressable
                            key={cat.id}
                            onPress={() => setSelectedCategoryId(cat.id)}
                            className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border border-border"
                            style={{
                              backgroundColor: isSelected ? cat.color : undefined,
                              borderColor: isSelected ? cat.color : undefined,
                            }}>
                            <Icon
                              as={isSelected ? Check : CatIcon}
                              size={14}
                              color={isSelected ? '#ffffff' : cat.color || '#64748b'}
                            />
                            <Text
                              className="text-xs font-medium"
                              style={{
                                color: isSelected ? '#ffffff' : undefined,
                              }}>
                              {cat.name}
                            </Text>
                          </Pressable>
                        );
                      })}

                      {/* Inline Add Category Pill */}
                      <Pressable
                        onPress={() => setShowCategoryForm(true)}
                        className="flex-row items-center gap-1 px-3 py-2 rounded-full border border-dashed border-primary/60 bg-primary/5">
                        <Icon as={Plus} size={13} className="text-primary" />
                        <Text className="text-xs font-semibold text-primary">Add</Text>
                      </Pressable>
                    </ScrollView>
                  )}

                  {/* Monthly limit notice for active category */}
                  {!isIncome &&
                    activeCategory &&
                    activeCategory.monthly_limit !== null &&
                    activeCategory.monthly_limit !== undefined &&
                    Number(activeCategory.monthly_limit) > 0 && (
                      <View className="flex-row items-center gap-1.5 mt-0.5 px-2 py-1 rounded-lg bg-muted/60">
                        <Icon as={Tag} size={12} className="text-primary" />
                        <Text variant="muted" className="text-[11px]">
                          Monthly Limit:{' '}
                          <Text className="font-semibold text-foreground">
                            ৳{Number(activeCategory.monthly_limit).toFixed(2)}
                          </Text>
                        </Text>
                      </View>
                    )}
                </View>
              )}

              {/* Notes Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Notes (Optional)
                </Text>
                <Input
                  placeholder="Additional context or notes..."
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 350);
                  }}
                />
              </View>

            </View>
          </ScrollView>

          {/* Pinned Action Buttons Footer */}
          <View className="shrink-0 px-6 pt-3 border-t border-border gap-2">
            {error && (
              <Text className="text-destructive text-sm font-medium">
                {error}
              </Text>
            )}
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex-row items-center justify-center gap-2 h-11 rounded-xl active:opacity-90"
              style={{
                backgroundColor: isTransfer ? '#7c3aed' : isIncome ? '#059669' : '#e11d48',
              }}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon
                    as={isTransfer ? ArrowLeftRight : Plus}
                    color="#ffffff"
                    size={18}
                  />
                  <Text className="font-semibold text-white">
                    {isTransfer
                      ? 'Complete Transfer'
                      : isIncome
                      ? 'Save Credit (Income)'
                      : 'Save Debit (Expense)'}
                  </Text>
                </>
              )}
            </Button>
            <Button variant="ghost" onPress={handleClose} disabled={isSubmitting}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>

        {/* Category Creation Overlay (in-modal to avoid iOS/Web nested modal issues) */}
        {showCategoryForm && (
          <View className="absolute inset-0 bg-black/60 justify-end z-50">
            <Pressable
              className="absolute inset-0"
              onPress={() => setShowCategoryForm(false)}
            />
            <CategoryFormCard
              defaultType={transactionType === 'income' ? 'income' : 'expense'}
              onClose={() => setShowCategoryForm(false)}
              onSuccess={(newCat) => {
                setSelectedCategoryId(newCat.id);
                setShowCategoryForm(false);
              }}
              isEmbedded
            />
          </View>
        )}

        {/* Account Creation Modal (embedded in-modal overlay to prevent nested native modal issues) */}
        {showAccountForm && (
          <AccountFormModal
            visible={showAccountForm}
            onClose={() => setShowAccountForm(false)}
            isEmbedded
          />
        )}
      </View>
  );
}

export function AddTransactionModal({
  visible,
  onClose,
  defaultType = 'expense',
}: AddTransactionModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <AddTransactionModalContent
          key={`${visible}-${defaultType}`}
          onClose={onClose}
          defaultType={defaultType}
        />
      ) : null}
    </Modal>
  );
}
