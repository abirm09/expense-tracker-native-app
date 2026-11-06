import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  Plus,
  User,
  X,
} from 'lucide-react-native';
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

import { ContactFormModal } from './contact-form-modal';
import { getAccountIcon } from '@/components/accounts/account-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getLocalDateString, isValidDateString } from '@/lib/date-utils';
import { formatBDT } from '@/lib/format-currency';
import { useGetAccountsQuery } from '@/store/api/accounts-api';
import {
  useGetContactsQuery,
  useRecordDebtTransactionMutation,
} from '@/store/api/debts-api';
import { DebtType } from '@/types/database.types';

interface RecordDebtModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: DebtType;
  defaultContactId?: string | null;
  onSuccess?: () => void;
}

function RecordDebtModalContent({
  onClose,
  defaultType = 'receivable',
  defaultContactId = null,
  onSuccess,
}: {
  onClose: () => void;
  defaultType?: DebtType;
  defaultContactId?: string | null;
  onSuccess?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxModalHeight = Math.round(windowHeight * 0.9);

  const [debtType, setDebtType] = React.useState<DebtType>(defaultType);
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(
    defaultContactId
  );
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(() => getLocalDateString());
  const [dueDate, setDueDate] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [showAddContactModal, setShowAddContactModal] = React.useState(false);

  const { data: contacts = [], isLoading: isLoadingContacts } = useGetContactsQuery();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();

  const [recordDebtTransaction, { isLoading: isSubmitting }] =
    useRecordDebtTransactionMutation();

  const effectiveContactId = selectedContactId ?? (contacts[0]?.id || null);
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const effectiveAccountId = selectedAccountId ?? (defaultAccount?.id || null);

  const activeContact = contacts.find((c) => c.id === effectiveContactId);
  const activeAccount = accounts.find((a) => a.id === effectiveAccountId);

  // Determine whether money enters or leaves the user's account:
  // - receivable (I lend): OUT (deducts from my account)
  // - payable (I borrow): IN (adds to my account)
  // - receivable_payment (they repay me): IN (adds to my account)
  // - payable_payment (I repay them): OUT (deducts from my account)
  const isMoneyInflow = debtType === 'payable' || debtType === 'receivable_payment';

  const quickAmounts = [500, 1000, 2000, 5000, 10000];

  const handleSubmit = async () => {
    const cleanAmount = amount.replace(/,/g, '').trim();
    const numericAmount = parseFloat(cleanAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!effectiveContactId) {
      setError('Please select or create a contact');
      return;
    }

    if (!effectiveAccountId) {
      setError('Please select an account');
      return;
    }

    if (date && !isValidDateString(date)) {
      setError('Please enter the date as YYYY-MM-DD');
      return;
    }

    if (dueDate.trim() && !isValidDateString(dueDate.trim())) {
      setError('Please enter the due date as YYYY-MM-DD');
      return;
    }

    setError(null);

    try {
      await recordDebtTransaction({
        contact_id: effectiveContactId,
        account_id: effectiveAccountId,
        amount: Math.abs(numericAmount),
        debt_type: debtType,
        title: title.trim() || null,
        notes: notes.trim() || null,
        date: date || getLocalDateString(),
        due_date: dueDate.trim() || null,
      }).unwrap();

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record transaction';
      setError(msg);
    }
  };

  return (
    <>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="bg-card rounded-t-3xl border-t border-border px-5 pt-4 overflow-hidden"
          style={{
            maxHeight: maxModalHeight,
            paddingBottom: Math.max(insets.bottom + 12, 24),
          }}>
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-border">
            <View>
              <Text variant="h4" className="font-bold text-foreground">
                Record Ledger Entry
              </Text>
              <Text variant="muted" className="text-xs">
                Receivable, Payable & Settlements
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 rounded-full bg-muted items-center justify-center">
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="py-3 gap-4"
            keyboardShouldPersistTaps="handled">
            {error && (
              <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <Text className="text-xs text-destructive font-medium">{error}</Text>
              </View>
            )}

            {/* Debt Type Selector Tabs */}
            <View className="bg-muted p-1 rounded-2xl flex-row gap-1">
              <Pressable
                onPress={() => setDebtType('receivable')}
                className={`flex-1 py-2 px-1 rounded-xl items-center justify-center ${
                  debtType === 'receivable' ? 'bg-card shadow-sm border border-border' : ''
                }`}>
                <Text
                  className={`text-[11px] font-bold ${
                    debtType === 'receivable' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                  }`}>
                  Lend Money
                </Text>
                <Text className="text-[9px] text-muted-foreground">Receivable</Text>
              </Pressable>

              <Pressable
                onPress={() => setDebtType('payable')}
                className={`flex-1 py-2 px-1 rounded-xl items-center justify-center ${
                  debtType === 'payable' ? 'bg-card shadow-sm border border-border' : ''
                }`}>
                <Text
                  className={`text-[11px] font-bold ${
                    debtType === 'payable' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                  }`}>
                  Borrow Money
                </Text>
                <Text className="text-[9px] text-muted-foreground">Payable</Text>
              </Pressable>

              <Pressable
                onPress={() => setDebtType('receivable_payment')}
                className={`flex-1 py-2 px-1 rounded-xl items-center justify-center ${
                  debtType === 'receivable_payment' ? 'bg-card shadow-sm border border-border' : ''
                }`}>
                <Text
                  className={`text-[11px] font-bold ${
                    debtType === 'receivable_payment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                  }`}>
                  Got Repayment
                </Text>
                <Text className="text-[9px] text-muted-foreground">Collect</Text>
              </Pressable>

              <Pressable
                onPress={() => setDebtType('payable_payment')}
                className={`flex-1 py-2 px-1 rounded-xl items-center justify-center ${
                  debtType === 'payable_payment' ? 'bg-card shadow-sm border border-border' : ''
                }`}>
                <Text
                  className={`text-[11px] font-bold ${
                    debtType === 'payable_payment' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                  }`}>
                  Paid Repayment
                </Text>
                <Text className="text-[9px] text-muted-foreground">Settle</Text>
              </Pressable>
            </View>

            {/* Dynamic Accounting Impact Banner */}
            <View
              className={`p-3 rounded-2xl border flex-row items-center gap-2.5 ${
                isMoneyInflow
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/20'
              }`}>
              <View
                className={`h-8 w-8 rounded-full items-center justify-center ${
                  isMoneyInflow ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                }`}>
                <Icon
                  as={isMoneyInflow ? ArrowDownLeft : ArrowUpRight}
                  size={16}
                  className={isMoneyInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-xs font-bold ${
                    isMoneyInflow ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                  }`}>
                  {isMoneyInflow ? 'Account Inflow (Credit)' : 'Account Outflow (Debit)'}
                </Text>
                <Text className="text-[11px] text-muted-foreground mt-0.5">
                  {debtType === 'receivable' &&
                    `Money will be DEDUCTED from ${activeAccount?.name || 'account'} and added to ${activeContact?.name || 'their'} receivable ledger.`}
                  {debtType === 'payable' &&
                    `Money will be ADDED to ${activeAccount?.name || 'account'} and recorded as a payable you owe ${activeContact?.name || 'them'}.`}
                  {debtType === 'receivable_payment' &&
                    `Money will be ADDED to ${activeAccount?.name || 'account'} and reduces ${activeContact?.name || 'their'} debt to you.`}
                  {debtType === 'payable_payment' &&
                    `Money will be DEDUCTED from ${activeAccount?.name || 'account'} and reduces your debt to ${activeContact?.name || 'them'}.`}
                </Text>
              </View>
            </View>

            {/* Amount Input */}
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1.5">Amount (BDT)</Text>
              <View className="relative">
                <Input
                  value={amount}
                  onChangeText={(val) => {
                    setAmount(val);
                    if (error) setError(null);
                  }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  className="text-2xl font-bold pl-12 h-14"
                />
                <Text className="absolute left-4 top-3 text-2xl font-bold text-muted-foreground">
                  ৳
                </Text>
              </View>

              {/* Quick amount chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="flex-row gap-2 mt-2">
                {quickAmounts.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setAmount(q.toString())}
                    className="px-3 py-1.5 rounded-xl bg-muted active:bg-muted/80 border border-border">
                    <Text className="text-xs font-semibold text-foreground">
                      +৳{q.toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Contact / User Selection */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-semibold text-foreground">
                  Counterparty User <Text className="text-destructive">*</Text>
                </Text>
                <Pressable
                  onPress={() => setShowAddContactModal(true)}
                  className="flex-row items-center gap-1">
                  <Icon as={Plus} size={13} className="text-primary" />
                  <Text className="text-xs font-bold text-primary">New User</Text>
                </Pressable>
              </View>

              {isLoadingContacts ? (
                <ActivityIndicator size="small" />
              ) : contacts.length === 0 ? (
                <Pressable
                  onPress={() => setShowAddContactModal(true)}
                  className="p-4 rounded-2xl bg-muted/50 border border-dashed border-border items-center justify-center gap-1">
                  <Icon as={User} size={20} className="text-muted-foreground" />
                  <Text className="text-xs font-semibold text-foreground">No users created yet</Text>
                  <Text className="text-[11px] text-primary font-bold">Tap here to add a user</Text>
                </Pressable>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="flex-row gap-2 py-1">
                  {contacts.map((c) => {
                    const isSelected = c.id === effectiveContactId;
                    const displayName = c.name?.trim() || c.phone;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedContactId(c.id)}
                        className={`px-3.5 py-2.5 rounded-2xl border flex-row items-center gap-2 ${
                          isSelected
                            ? 'bg-primary/10 border-primary'
                            : 'bg-card border-border active:bg-muted'
                        }`}>
                        <View
                          className={`h-7 w-7 rounded-full items-center justify-center ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? 'text-primary-foreground' : 'text-foreground'
                            }`}>
                            {displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-primary' : 'font-semibold text-foreground'
                            }`}
                            numberOfLines={1}>
                            {displayName}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                            {c.phone}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Account Selection */}
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Account ({isMoneyInflow ? 'Deposit into' : 'Pay from'}){' '}
                <Text className="text-destructive">*</Text>
              </Text>

              {isLoadingAccounts ? (
                <ActivityIndicator size="small" />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="flex-row gap-2 py-1">
                  {accounts.map((acc) => {
                    const isSelected = acc.id === effectiveAccountId;
                    const IconComp = getAccountIcon(acc.type);
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setSelectedAccountId(acc.id)}
                        className={`p-3 rounded-2xl border min-w-[130px] ${
                          isSelected
                            ? 'bg-primary/10 border-primary'
                            : 'bg-card border-border active:bg-muted'
                        }`}>
                        <View className="flex-row items-center gap-1.5 mb-1">
                          <Icon
                            as={IconComp}
                            size={15}
                            color={acc.color || '#10b981'}
                          />
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-primary' : 'font-semibold text-foreground'
                            }`}
                            numberOfLines={1}>
                            {acc.name}
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-foreground">
                          {formatBDT(acc.current_balance)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Date & Due Date */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">Date</Text>
                <View className="relative">
                  <Input
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    className="pl-9 text-xs"
                  />
                  <View className="absolute left-3 top-3">
                    <Icon as={Calendar} size={15} className="text-muted-foreground" />
                  </View>
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">
                  Due Date <Text className="text-muted-foreground font-normal">(Optional)</Text>
                </Text>
                <View className="relative">
                  <Input
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                    className="pl-9 text-xs"
                  />
                  <View className="absolute left-3 top-3">
                    <Icon as={Calendar} size={15} className="text-muted-foreground" />
                  </View>
                </View>
              </View>
            </View>

            {/* Title / Description */}
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Description / Title <Text className="text-muted-foreground font-normal">(Optional)</Text>
              </Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Personal loan, office expense support"
                className="text-xs"
              />
            </View>

            {/* Notes */}
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Notes / Reference <Text className="text-muted-foreground font-normal">(Optional)</Text>
              </Text>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Emergency loan, purchase support, partial return"
                className="text-xs"
              />
            </View>

            {/* Submit Button */}
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="mt-2 h-12 rounded-xl flex-row items-center justify-center gap-2">
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon as={Check} size={18} className="text-primary-foreground" />
                  <Text className="font-bold text-primary-foreground">
                    Confirm & Record Entry
                  </Text>
                </>
              )}
            </Button>
          </ScrollView>
        </View>
      </View>

      {/* Nested Add Contact Modal */}
      <ContactFormModal
        visible={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onSuccess={(created) => {
          setSelectedContactId(created.id);
        }}
      />
    </>
  );
}

export function RecordDebtModal({
  visible,
  onClose,
  defaultType = 'receivable',
  defaultContactId = null,
  onSuccess,
}: RecordDebtModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <RecordDebtModalContent
        key={`${defaultType}-${defaultContactId || 'none'}`}
        onClose={onClose}
        defaultType={defaultType}
        defaultContactId={defaultContactId}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}
