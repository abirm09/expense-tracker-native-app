import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Edit2,
  Mail,
  MessageSquare,
  Phone,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactFormModal } from '@/components/debts/contact-form-modal';
import { RecordDebtModal } from '@/components/debts/record-debt-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import {
  useDeleteContactMutation,
  useDeleteDebtTransactionMutation,
  useGetContactQuery,
  useGetDebtTransactionsQuery,
} from '@/store/api/debts-api';
import { DebtType, ExpenseWithCategory } from '@/types/database.types';

export default function DebtUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [filterType, setFilterType] = React.useState<'all' | 'receivable' | 'payable' | 'repayment'>('all');
  const [showEditContactModal, setShowEditContactModal] = React.useState(false);
  const [showRecordModal, setShowRecordModal] = React.useState(false);
  const [recordDefaultType, setRecordDefaultType] = React.useState<DebtType>('receivable');

  const {
    data: contact,
    isLoading: isLoadingContact,
    isFetching: isFetchingContact,
    refetch: refetchContact,
  } = useGetContactQuery(id as string, { skip: !id });

  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    isFetching: isFetchingTransactions,
    refetch: refetchTransactions,
  } = useGetDebtTransactionsQuery({ contact_id: id }, { skip: !id });

  const [deleteContact] = useDeleteContactMutation();
  const [deleteDebtTransaction] = useDeleteDebtTransactionMutation();

  const isRefreshing = isFetchingContact || isFetchingTransactions;

  const handleRefresh = React.useCallback(() => {
    refetchContact();
    refetchTransactions();
  }, [refetchContact, refetchTransactions]);

  const displayName = contact?.name?.trim() || contact?.phone || 'User';
  const netBalance = contact?.net_balance ?? 0;
  const owesYou = netBalance > 0.01;
  const youOwe = netBalance < -0.01;
  const isSettled = !owesYou && !youOwe;

  // Filter transactions
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((t) => {
      if (filterType === 'receivable') return t.debt_type === 'receivable';
      if (filterType === 'payable') return t.debt_type === 'payable';
      if (filterType === 'repayment') {
        return (
          t.debt_type === 'receivable_payment' || t.debt_type === 'payable_payment'
        );
      }
      return true;
    });
  }, [transactions, filterType]);

  const handleOpenWhatsApp = async () => {
    if (!contact) return;
    const phoneToUse = contact.whatsapp?.trim() || contact.phone;
    let cleanNumber = phoneToUse.replace(/[^0-9]/g, '');

    if (cleanNumber.startsWith('01') && cleanNumber.length === 11) {
      cleanNumber = '88' + cleanNumber;
    }

    const whatsappUrl = `whatsapp://send?phone=${cleanNumber}`;
    const webUrl = `https://wa.me/${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      Alert.alert('Error', 'Could not open WhatsApp');
    }
  };

  const handlePhoneCall = async () => {
    if (!contact) return;
    const cleanNumber = contact.phone.replace(/[^0-9+]/g, '');
    try {
      await Linking.openURL(`tel:${cleanNumber}`);
    } catch {
      Alert.alert('Error', 'Could not initiate phone call');
    }
  };

  const handleDeleteUser = () => {
    if (!contact) return;
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${displayName}"? All associated debt records and account transactions will also be updated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(contact.id).unwrap();
              router.replace('/(tabs)/debts' as any);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not delete user';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleDeleteTransaction = (tx: ExpenseWithCategory) => {
    Alert.alert(
      'Delete Transaction',
      `Delete "${tx.title}" of ${formatBDT(tx.amount)}? Account balance will be restored accordingly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebtTransaction(tx.id).unwrap();
              refetchContact();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not delete entry';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleOpenRecordModal = (type: DebtType) => {
    setRecordDefaultType(type);
    setShowRecordModal(true);
  };

  if (isLoadingContact) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
        <Text variant="muted" className="text-xs mt-3">
          Loading user profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-6 gap-3">
        <Text className="text-lg font-bold text-foreground">User not found</Text>
        <Text variant="muted" className="text-xs text-center">
          The requested user profile does not exist or has been removed.
        </Text>
        <Button onPress={() => router.back()} className="mt-2">
          <Text className="text-primary-foreground font-bold text-xs">Go Back</Text>
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top Header */}
      <View className="px-5 py-3 border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="h-9 w-9 rounded-full bg-muted items-center justify-center active:bg-muted/80">
            <Icon as={ArrowLeft} size={18} className="text-foreground" />
          </Pressable>
          <View className="flex-1">
            <Text variant="h4" className="font-extrabold text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {contact.phone}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => setShowEditContactModal(true)}
            className="h-8 w-8 rounded-full bg-muted items-center justify-center active:bg-muted/80">
            <Icon as={Edit2} size={14} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={handleDeleteUser}
            className="h-8 w-8 rounded-full bg-destructive/10 items-center justify-center active:bg-destructive/20">
            <Icon as={Trash2} size={14} className="text-destructive" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="p-5 pb-24 gap-4"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }>
        {/* User Profile Info Card */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardContent className="p-4">
            <View className="flex-row items-center gap-3.5">
              <View className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                <Text className="text-2xl font-bold text-primary">
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Badge variant={owesYou ? 'default' : youOwe ? 'destructive' : 'outline'} className="px-2 py-0.2">
                    <Text className="text-[10px] font-bold">
                      {owesYou ? 'Borrower' : youOwe ? 'Lender' : 'Settled'}
                    </Text>
                  </Badge>
                </View>

                <View className="flex-row items-center gap-1.5 mt-1">
                  <Icon as={Phone} size={12} className="text-muted-foreground" />
                  <Text className="text-xs font-semibold text-foreground">{contact.phone}</Text>
                </View>

                {contact.email && (
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <Icon as={Mail} size={12} className="text-muted-foreground" />
                    <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                      {contact.email}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Direct Contact Buttons */}
            <View className="flex-row gap-2 mt-3.5 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                onPress={handlePhoneCall}
                className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-1.5 border-border">
                <Icon as={Phone} size={14} className="text-foreground" />
                <Text className="text-xs font-semibold text-foreground">Call Phone</Text>
              </Button>

              <Button
                onPress={handleOpenWhatsApp}
                className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-1.5 bg-emerald-600 active:bg-emerald-700">
                <Icon as={MessageSquare} size={14} className="text-white" />
                <Text className="text-xs font-bold text-white">WhatsApp</Text>
              </Button>
            </View>

            {contact.notes && (
              <View className="mt-2.5 p-2 rounded-xl bg-muted/50 border border-border/60">
                <Text className="text-[11px] text-muted-foreground" numberOfLines={2}>
                  Note: {contact.notes}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Ledger Breakdown Card for this user */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardHeader className="pb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Scale} size={16} className="text-primary" />
                <Text variant="muted" className="text-xs font-bold uppercase tracking-wider">
                  Ledger Position with {displayName}
                </Text>
              </View>
            </View>

            {/* Net Position Summary Banner */}
            <View className="mt-2 p-3 rounded-2xl bg-muted/60 border border-border/80">
              <Text variant="muted" className="text-[11px]">
                Net Balance
              </Text>
              <Text
                className={`text-2xl font-black mt-0.5 ${
                  owesYou
                    ? 'text-amber-600 dark:text-amber-400'
                    : youOwe
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                }`}>
                {owesYou && `${displayName} owes you ${formatBDT(netBalance)}`}
                {youOwe && `You owe ${displayName} ${formatBDT(Math.abs(netBalance))}`}
                {isSettled && 'All settled up (৳0.00)'}
              </Text>
            </View>
          </CardHeader>

          <CardContent className="pt-1">
            <View className="flex-row gap-2.5">
              {/* Receivable Position (I gave money) */}
              <View className="flex-1 bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Receivable
                </Text>
                <Text className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatBDT(contact.outstanding_receivable)}
                </Text>
                <Text variant="muted" className="text-[10px] mt-0.5">
                  Lent: {formatBDT(contact.total_receivable)}
                </Text>
                <Text variant="muted" className="text-[10px]">
                  Collected: {formatBDT(contact.total_receivable_collected)}
                </Text>
              </View>

              {/* Payable Position (I got money) */}
              <View className="flex-1 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Payable
                </Text>
                <Text className="text-base font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                  {formatBDT(contact.outstanding_payable)}
                </Text>
                <Text variant="muted" className="text-[10px] mt-0.5">
                  Borrowed: {formatBDT(contact.total_payable)}
                </Text>
                <Text variant="muted" className="text-[10px]">
                  Repaid: {formatBDT(contact.total_payable_paid)}
                </Text>
              </View>
            </View>

            {/* Action Buttons for this user */}
            <View className="flex-row gap-2 mt-3 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                onPress={() => handleOpenRecordModal('receivable')}
                className="flex-1 h-10 rounded-xl flex-row items-center justify-center gap-1.5 border-amber-500/30 bg-amber-500/5">
                <Icon as={ArrowUpRight} size={15} className="text-amber-600 dark:text-amber-400" />
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  + Lend
                </Text>
              </Button>

              <Button
                variant="outline"
                onPress={() => handleOpenRecordModal('payable')}
                className="flex-1 h-10 rounded-xl flex-row items-center justify-center gap-1.5 border-rose-500/30 bg-rose-500/5">
                <Icon as={ArrowDownLeft} size={15} className="text-rose-600 dark:text-rose-400" />
                <Text className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  + Borrow
                </Text>
              </Button>

              <Button
                variant="outline"
                onPress={() =>
                  handleOpenRecordModal(
                    owesYou ? 'receivable_payment' : 'payable_payment'
                  )
                }
                className="flex-1 h-10 rounded-xl flex-row items-center justify-center gap-1.5 border-primary/30 bg-primary/5">
                <Icon as={CheckCircle2} size={15} className="text-primary" />
                <Text className="text-xs font-bold text-primary">
                  Settle
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Transactions History Header & Tabs */}
        <View className="mt-1">
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Transactions History ({filteredTransactions.length})
            </Text>
          </View>

          {/* Filter chips */}
          <View className="bg-muted p-1 rounded-2xl flex-row gap-1 mb-3">
            <Pressable
              onPress={() => setFilterType('all')}
              className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                filterType === 'all' ? 'bg-card shadow-sm border border-border' : ''
              }`}>
              <Text
                className={`text-[11px] font-semibold ${
                  filterType === 'all' ? 'text-foreground font-bold' : 'text-muted-foreground'
                }`}>
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterType('receivable')}
              className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                filterType === 'receivable' ? 'bg-card shadow-sm border border-border' : ''
              }`}>
              <Text
                className={`text-[11px] font-semibold ${
                  filterType === 'receivable' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'
                }`}>
                Lent
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterType('payable')}
              className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                filterType === 'payable' ? 'bg-card shadow-sm border border-border' : ''
              }`}>
              <Text
                className={`text-[11px] font-semibold ${
                  filterType === 'payable' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground'
                }`}>
                Borrowed
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterType('repayment')}
              className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                filterType === 'repayment' ? 'bg-card shadow-sm border border-border' : ''
              }`}>
              <Text
                className={`text-[11px] font-semibold ${
                  filterType === 'repayment' ? 'text-primary font-bold' : 'text-muted-foreground'
                }`}>
                Settlements
              </Text>
            </Pressable>
          </View>

          {/* Transactions List */}
          {isLoadingTransactions ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="small" />
              <Text variant="muted" className="text-xs mt-2">
                Loading transactions...
              </Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View className="py-10 px-4 items-center justify-center bg-card rounded-3xl border border-dashed border-border gap-2">
              <Icon as={Wallet} size={28} className="text-muted-foreground" />
              <Text className="text-sm font-bold text-foreground">No transactions recorded</Text>
              <Text variant="muted" className="text-xs text-center max-w-xs">
                Record a lend, borrow, or settlement transaction with {displayName} to update account balances.
              </Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => {
              const isDebit = tx.entry_type === 'debit';
              const isInflow = !isDebit;
              const accountName = tx.accounts?.name || 'Account';

              let badgeText = 'Transaction';
              let badgeBg = 'bg-muted';
              let badgeColor = 'text-muted-foreground';

              if (tx.debt_type === 'receivable') {
                badgeText = 'Lent (Receivable)';
                badgeBg = 'bg-amber-500/10 border-amber-500/20';
                badgeColor = 'text-amber-600 dark:text-amber-400';
              } else if (tx.debt_type === 'payable') {
                badgeText = 'Borrowed (Payable)';
                badgeBg = 'bg-rose-500/10 border-rose-500/20';
                badgeColor = 'text-rose-600 dark:text-rose-400';
              } else if (tx.debt_type === 'receivable_payment') {
                badgeText = 'Repayment Received';
                badgeBg = 'bg-emerald-500/10 border-emerald-500/20';
                badgeColor = 'text-emerald-600 dark:text-emerald-400';
              } else if (tx.debt_type === 'payable_payment') {
                badgeText = 'Repayment Paid';
                badgeBg = 'bg-blue-500/10 border-blue-500/20';
                badgeColor = 'text-blue-600 dark:text-blue-400';
              }

              return (
                <Card key={tx.id} className="mb-2.5 border-border shadow-2xs overflow-hidden">
                  <View className="p-3.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                        <View
                          className={`h-9 w-9 rounded-xl items-center justify-center ${
                            isInflow ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                          }`}>
                          <Icon
                            as={isInflow ? ArrowDownLeft : ArrowUpRight}
                            size={16}
                            className={isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                            {tx.title}
                          </Text>
                          <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Text className="text-[11px] text-muted-foreground">
                              {tx.date}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">•</Text>
                            <Text className="text-[11px] font-semibold text-foreground">
                              {accountName}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text
                          className={`text-sm font-black ${
                            isInflow
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>
                          {isInflow ? '+' : '-'}
                          {formatBDT(tx.amount)}
                        </Text>
                        <View className={`px-1.5 py-0.2 rounded border ${badgeBg} mt-0.5`}>
                          <Text className={`text-[9px] font-bold ${badgeColor}`}>
                            {badgeText}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Notes & Actions Row */}
                    <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border/50">
                      <Text className="text-[10px] text-muted-foreground flex-1 mr-2" numberOfLines={1}>
                        {tx.notes ? `Note: ${tx.notes}` : `Linked to ${accountName}`}
                      </Text>

                      <Pressable
                        onPress={() => handleDeleteTransaction(tx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="h-6 px-2 rounded-md bg-destructive/10 active:bg-destructive/20 flex-row items-center gap-1">
                        <Icon as={Trash2} size={11} className="text-destructive" />
                        <Text className="text-[10px] font-bold text-destructive">Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Edit User Modal */}
      <ContactFormModal
        visible={showEditContactModal}
        onClose={() => setShowEditContactModal(false)}
        contact={contact}
        onSuccess={() => {
          refetchContact();
        }}
      />

      {/* Record Debt Modal */}
      <RecordDebtModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        defaultType={recordDefaultType}
        defaultContactId={contact.id}
        onSuccess={() => {
          refetchContact();
          refetchTransactions();
        }}
      />
    </SafeAreaView>
  );
}
