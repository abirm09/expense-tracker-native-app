import { ArrowDownLeft, ArrowUpRight, Check, Plus, Tag, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountFormModal } from '@/components/accounts/account-form-modal';
import { getAccountIcon } from '@/components/accounts/account-utils';
import { CategoryFormCard } from '@/components/categories/category-form-modal';
import { getCategoryIcon } from '@/components/categories/category-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { cn } from '@/lib/utils';
import { useGetAccountsQuery } from '@/store/api/accounts-api';
import { useGetCategoriesQuery } from '@/store/api/categories-api';
import { useAddExpenseMutation } from '@/store/api/expenses-api';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: 'expense' | 'income';
}

export function AddTransactionModal({
  visible,
  onClose,
  defaultType = 'expense',
}: AddTransactionModalProps) {
  const insets = useSafeAreaInsets();
  const [transactionType, setTransactionType] = React.useState<'expense' | 'income'>(defaultType);
  const [prevDefaultType, setPrevDefaultType] = React.useState(defaultType);
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = React.useState(false);
  const [showAccountForm, setShowAccountForm] = React.useState(false);

  if (prevDefaultType !== defaultType) {
    setPrevDefaultType(defaultType);
    setTransactionType(defaultType);
  }

  const { data: categories = [], isLoading: isLoadingCategories } = useGetCategoriesQuery({
    type: transactionType,
  });

  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();

  const [addExpense, { isLoading: isSubmitting }] = useAddExpenseMutation();

  const activeCategoryId = selectedCategoryId ?? categories[0]?.id ?? null;
  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const activeAccountId = selectedAccountId ?? defaultAccount?.id ?? null;

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setSelectedCategoryId(null);
    setSelectedAccountId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a description or title');
      return;
    }

    const cleanAmount = amount.replace(/,/g, '').trim();
    const numericAmount = parseFloat(cleanAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
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

  const isIncome = transactionType === 'income';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="flex-1" onPress={handleClose} />
        <View
          className="bg-card rounded-t-3xl border-t border-border max-h-[90%] flex-col"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-border">
            <Text variant="h4" className="font-bold">
              {isIncome ? 'Add New Income' : 'Add New Expense'}
            </Text>
            <Pressable
              onPress={handleClose}
              className="h-8 w-8 rounded-full bg-muted items-center justify-center">
              <Icon as={X} className="text-foreground" size={16} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-6 py-4 flex-1"
            contentContainerStyle={{ paddingBottom: 16 }}>
            <View className="gap-4">
              {/* Type Switcher: Debit (Expense) / Credit (Income) */}
              <View className="gap-1">
                <Text variant="small" className="font-semibold text-foreground">
                  Transaction Flow (Accounting)
                </Text>
                <View className="flex-row rounded-xl bg-muted p-1 border border-border/50">
                  <Pressable
                    onPress={() => {
                      setTransactionType('expense');
                      setSelectedCategoryId(null);
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                      !isIncome ? 'bg-background shadow-sm' : ''
                    }`}>
                    <Icon
                      as={ArrowUpRight}
                      size={16}
                      color={!isIncome ? '#ef4444' : '#64748b'}
                    />
                    <Text
                      className={`font-semibold text-xs ${
                        !isIncome ? 'text-foreground font-bold' : 'text-muted-foreground'
                      }`}>
                      Debit (Expense)
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setTransactionType('income');
                      setSelectedCategoryId(null);
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                      isIncome ? 'bg-background shadow-sm' : ''
                    }`}>
                    <Icon
                      as={ArrowDownLeft}
                      size={16}
                      color={isIncome ? '#10b981' : '#64748b'}
                    />
                    <Text
                      className={`font-semibold text-xs ${
                        isIncome ? 'text-foreground font-bold' : 'text-muted-foreground'
                      }`}>
                      Credit (Income)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Title Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Description / Title
                </Text>
                <Input
                  placeholder={isIncome ? 'e.g. October Salary, Freelance Gig' : 'e.g. Grocery Shopping, Dinner'}
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

              {/* Financial Account Selector (Cash, Bank, Mobile Wallet) */}
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

              {/* Categories Selector with + New Category */}
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

              {/* Notes Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Notes (Optional)
                </Text>
                <Input
                  placeholder="Additional context or notes..."
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

            </View>
          </ScrollView>

          {/* Pinned Action Buttons Footer */}
          <View className="px-6 pt-3 border-t border-border gap-2">
            {error && (
              <Text className="text-destructive text-sm font-medium">
                {error}
              </Text>
            )}
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex-row items-center justify-center gap-2"
              style={{
                backgroundColor: isIncome ? '#059669' : undefined,
              }}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={isIncome ? '#ffffff' : undefined} />
              ) : (
                <>
                  <Icon
                    as={Plus}
                    className={isIncome ? 'text-white' : 'text-primary-foreground'}
                    size={18}
                  />
                  <Text
                    className={cn(
                      'font-semibold',
                      isIncome ? 'text-white' : 'text-primary-foreground'
                    )}>
                    {isIncome ? 'Save Credit (Income)' : 'Save Debit (Expense)'}
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
              className="flex-1"
              onPress={() => setShowCategoryForm(false)}
            />
            <CategoryFormCard
              defaultType={transactionType}
              onClose={() => setShowCategoryForm(false)}
              onSuccess={(newCat) => {
                setSelectedCategoryId(newCat.id);
                setShowCategoryForm(false);
              }}
              isEmbedded
            />
          </View>
        )}

        {/* Account Creation Modal */}
        <AccountFormModal
          visible={showAccountForm}
          onClose={() => setShowAccountForm(false)}
        />
      </View>
    </Modal>
  );
}
