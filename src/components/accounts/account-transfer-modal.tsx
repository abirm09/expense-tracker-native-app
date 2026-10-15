import { ArrowLeftRight, Check, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAccountIcon } from '@/components/accounts/account-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import {
  useGetAccountsQuery,
  useTransferBetweenAccountsMutation,
} from '@/store/api/accounts-api';
import { Account } from '@/types/database.types';

interface AccountTransferModalProps {
  visible: boolean;
  onClose: () => void;
  initialFromAccountId?: string | null;
}

function AccountTransferModalInner({
  onClose,
  initialFromAccountId,
}: {
  onClose: () => void;
  initialFromAccountId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();
  const [transfer, { isLoading: isTransferring }] = useTransferBetweenAccountsMutation();

  const [selectedFromAccountId, setSelectedFromAccountId] = React.useState<string | null>(null);
  const [selectedToAccountId, setSelectedToAccountId] = React.useState<string | null>(null);

  const fromAccountId =
    selectedFromAccountId ?? (initialFromAccountId || (accounts.length > 0 ? accounts[0].id : ''));
  const toAccountId =
    selectedToAccountId ??
    (accounts.length > 1
      ? accounts.find((a) => a.id !== fromAccountId)?.id || accounts[1].id
      : accounts.length === 1 && accounts[0].id !== fromAccountId
      ? accounts[0].id
      : '');

  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const handleSwap = () => {
    if (fromAccountId && toAccountId) {
      setSelectedFromAccountId(toAccountId);
      setSelectedToAccountId(fromAccountId);
    }
  };

  const handleSubmit = async () => {
    setError(null);

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

    const cleanAmount = amount.replace(/,/g, '').trim();
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid transfer amount greater than 0');
      return;
    }

    try {
      await transfer({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: numAmount,
        notes: notes.trim() || null,
        transfer_date: new Date().toISOString().split('T')[0],
      }).unwrap();

      setAmount('');
      setNotes('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete transfer';
      setError(msg);
    }
  };

  return (
    <View className="flex-1 bg-black/60 justify-end">
      <Pressable className="flex-1" onPress={onClose} />
      <View
        className="bg-card rounded-t-3xl border-t border-border max-h-[90%] flex-col"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-full bg-primary/10 items-center justify-center">
              <Icon as={ArrowLeftRight} size={16} className="text-primary" />
            </View>
            <Text variant="h4" className="font-bold">
              Account Transfer
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-8 w-8 rounded-full bg-muted items-center justify-center">
            <Icon as={X} className="text-foreground" size={16} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="px-6 py-4 flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="gap-4">
            {isLoadingAccounts ? (
              <ActivityIndicator size="small" className="py-6" />
            ) : accounts.length < 2 ? (
              <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 items-center">
                <Text className="text-xs text-amber-700 dark:text-amber-400 font-semibold text-center">
                  You need at least two accounts to transfer funds. Create another account first.
                </Text>
              </View>
            ) : (
              <>
                {/* From Account Selector */}
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-semibold text-foreground">
                      From Account (Outflow)
                    </Text>
                    {fromAccount && (
                      <Text variant="muted" className="text-[11px]">
                        Available: <Text className="font-bold text-foreground">{formatBDT(fromAccount.current_balance)}</Text>
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
                            key={acc.id}
                            disabled={isDest}
                            onPress={() => setSelectedFromAccountId(acc.id)}
                            className={`p-3 rounded-2xl border min-w-[140px] ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : isDest
                                ? 'border-border/40 bg-muted/20 opacity-40'
                                : 'border-border bg-card'
                            }`}>
                            <View className="flex-row items-center justify-between mb-1.5">
                              <View
                                className="h-7 w-7 rounded-lg items-center justify-center"
                                style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                <Icon as={AccIcon} size={14} color={acc.color || '#10b981'} />
                              </View>
                              {isSelected && <Icon as={Check} size={14} className="text-primary" />}
                            </View>
                            <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                              {acc.name}
                            </Text>
                            <Text className="text-[11px] font-bold text-muted-foreground mt-0.5">
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
                    onPress={handleSwap}
                    className="h-9 w-9 rounded-full bg-muted border border-border items-center justify-center active:bg-primary/10">
                    <Icon as={ArrowLeftRight} size={15} className="text-foreground" />
                  </Pressable>
                </View>

                {/* To Account Selector */}
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-semibold text-foreground">
                      To Account (Inflow)
                    </Text>
                    {toAccount && (
                      <Text variant="muted" className="text-[11px]">
                        Balance: <Text className="font-bold text-foreground">{formatBDT(toAccount.current_balance)}</Text>
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
                            key={acc.id}
                            disabled={isSrc}
                            onPress={() => setSelectedToAccountId(acc.id)}
                            className={`p-3 rounded-2xl border min-w-[140px] ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : isSrc
                                ? 'border-border/40 bg-muted/20 opacity-40'
                                : 'border-border bg-card'
                            }`}>
                            <View className="flex-row items-center justify-between mb-1.5">
                              <View
                                className="h-7 w-7 rounded-lg items-center justify-center"
                                style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                <Icon as={AccIcon} size={14} color={acc.color || '#10b981'} />
                              </View>
                              {isSelected && <Icon as={Check} size={14} color="#10b981" />}
                            </View>
                            <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                              {acc.name}
                            </Text>
                            <Text className="text-[11px] font-bold text-muted-foreground mt-0.5">
                              {formatBDT(acc.current_balance)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Transfer Amount (৳ BDT) */}
                <View className="gap-1.5 bg-muted/40 p-3.5 rounded-2xl border border-border">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-semibold text-foreground">
                      Transfer Amount (৳)
                    </Text>
                    {fromAccount && (
                      <Pressable
                        onPress={() => {
                          const max = Math.max(0, fromAccount.current_balance);
                          setAmount(max.toFixed(2));
                        }}>
                        <Text className="text-[11px] font-bold text-primary">Use Full Balance</Text>
                      </Pressable>
                    )}
                  </View>
                  <Input
                    placeholder="0.00"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Notes / Reference */}
                <View className="gap-1.5">
                  <Text variant="small" className="font-medium text-foreground">
                    Notes / Reference (Optional)
                  </Text>
                  <Input
                    placeholder="e.g. Bank to bKash add money, ATM cash out"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* Pinned Action Buttons Footer */}
        <View className="px-6 pt-3 border-t border-border gap-2">
          {error && (
            <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <Text variant="small" className="text-destructive font-medium text-xs">
                {error}
              </Text>
            </View>
          )}

          <Button
            onPress={handleSubmit}
            disabled={
              isTransferring ||
              !fromAccountId ||
              !toAccountId ||
              fromAccountId === toAccountId ||
              accounts.length < 2
            }
            className="w-full h-12 bg-primary">
            {isTransferring ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="font-bold text-primary-foreground">
                Confirm Transfer
              </Text>
            )}
          </Button>
          <Button variant="ghost" onPress={onClose} disabled={isTransferring}>
            <Text>Cancel</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

export function AccountTransferModal({
  visible,
  onClose,
  initialFromAccountId,
}: AccountTransferModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <AccountTransferModalInner
        key={initialFromAccountId || 'default-transfer'}
        onClose={onClose}
        initialFromAccountId={initialFromAccountId}
      />
    </Modal>
  );
}
