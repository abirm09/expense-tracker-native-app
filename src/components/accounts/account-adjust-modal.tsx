import { ArrowDownLeft, ArrowUpRight, Scale, X } from 'lucide-react-native';
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
  useAdjustAccountBalanceMutation,
  useGetAccountsQuery,
} from '@/store/api/accounts-api';
import { Account } from '@/types/database.types';

interface AccountAdjustModalProps {
  visible: boolean;
  onClose: () => void;
  initialAccountId?: string | null;
}

function AccountAdjustModalInner({
  onClose,
  initialAccountId,
}: {
  onClose: () => void;
  initialAccountId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();
  const [adjust, { isLoading: isAdjusting }] = useAdjustAccountBalanceMutation();

  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const accountId = selectedAccountId ?? (initialAccountId || (accounts.length > 0 ? accounts[0].id : ''));
  const [direction, setDirection] = React.useState<'in' | 'out'>('in');
  const [amount, setAmount] = React.useState('');
  const [title, setTitle] = React.useState('Balance Adjustment');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const handleSubmit = async () => {
    setError(null);
    if (!accountId) {
      setError('Please select an account to adjust');
      return;
    }

    const cleanAmount = amount.replace(/,/g, '').trim();
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid numeric amount greater than 0');
      return;
    }

    try {
      await adjust({
        account_id: accountId,
        amount: numAmount,
        direction,
        title: title.trim() || 'Balance Adjustment',
        notes: notes.trim() || null,
        adjustment_date: new Date().toISOString().split('T')[0],
      }).unwrap();

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Adjustment failed';
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
              <Icon as={Scale} size={16} className="text-primary" />
            </View>
            <Text variant="h4" className="font-bold">
              Balance Adjustment
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
            ) : accounts.length === 0 ? (
              <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 items-center">
                <Text className="text-xs text-amber-700 dark:text-amber-400 font-semibold text-center">
                  No accounts found. Create an account first before adjusting balances.
                </Text>
              </View>
            ) : (
              <>
                {/* Account Selector */}
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small" className="font-semibold text-foreground">
                      Target Account
                    </Text>
                    {selectedAccount && (
                      <Text variant="muted" className="text-[11px]">
                        Current: <Text className="font-bold text-foreground">{formatBDT(selectedAccount.current_balance)}</Text>
                      </Text>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                    <View className="flex-row gap-2">
                      {accounts.map((acc: Account) => {
                        const isSelected = accountId === acc.id;
                        const AccIcon = getAccountIcon(acc.type);
                        return (
                          <Pressable
                            key={acc.id}
                            onPress={() => setSelectedAccountId(acc.id)}
                            className={`p-3 rounded-2xl border min-w-[130px] ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-card'
                            }`}>
                            <View className="flex-row items-center gap-2 mb-1">
                              <View
                                className="h-6 w-6 rounded-lg items-center justify-center"
                                style={{ backgroundColor: `${acc.color || '#10b981'}20` }}>
                                <Icon as={AccIcon} size={13} color={acc.color || '#10b981'} />
                              </View>
                              <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                                {acc.name}
                              </Text>
                            </View>
                            <Text className="text-[11px] font-bold text-muted-foreground">
                              {formatBDT(acc.current_balance)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Adjustment Flow: In (+) or Out (-) */}
                <View className="gap-1.5">
                  <Text variant="small" className="font-semibold text-foreground">
                    Adjustment Direction
                  </Text>
                  <View className="flex-row rounded-xl bg-muted p-1 border border-border/50">
                    <Pressable
                      onPress={() => setDirection('in')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                        direction === 'in' ? 'bg-background shadow-sm' : ''
                      }`}>
                      <Icon
                        as={ArrowDownLeft}
                        size={16}
                        color={direction === 'in' ? '#10b981' : '#64748b'}
                      />
                      <Text
                        className={`font-semibold text-xs ${
                          direction === 'in' ? 'text-foreground font-bold' : 'text-muted-foreground'
                        }`}>
                        Increase (+)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setDirection('out')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                        direction === 'out' ? 'bg-background shadow-sm' : ''
                      }`}>
                      <Icon
                        as={ArrowUpRight}
                        size={16}
                        color={direction === 'out' ? '#ef4444' : '#64748b'}
                      />
                      <Text
                        className={`font-semibold text-xs ${
                          direction === 'out' ? 'text-foreground font-bold' : 'text-muted-foreground'
                        }`}>
                        Decrease (−)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Amount Input */}
                <View className="gap-1.5 bg-muted/40 p-3.5 rounded-2xl border border-border">
                  <Text variant="small" className="font-semibold text-foreground">
                    Adjustment Amount (৳)
                  </Text>
                  <Input
                    placeholder="0.00"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                  <Text variant="muted" className="text-[11px]">
                    {direction === 'in'
                      ? 'This amount will be added to the account balance.'
                      : 'This amount will be deducted from the account balance.'}
                  </Text>
                </View>

                {/* Title / Reason */}
                <View className="gap-1.5">
                  <Text variant="small" className="font-semibold text-foreground">
                    Reason / Title
                  </Text>
                  <Input
                    placeholder="e.g. Cash count reconciliation, Missing ATM receipt"
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Notes */}
                <View className="gap-1.5">
                  <Text variant="small" className="font-medium text-foreground">
                    Notes (Optional)
                  </Text>
                  <Input
                    placeholder="Additional reconciliation notes..."
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
            disabled={isAdjusting || !accountId || accounts.length === 0}
            className="w-full h-12 bg-primary">
            {isAdjusting ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="font-bold text-primary-foreground">
                Save Adjustment
              </Text>
            )}
          </Button>
          <Button variant="ghost" onPress={onClose} disabled={isAdjusting}>
            <Text>Cancel</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

export function AccountAdjustModal({
  visible,
  onClose,
  initialAccountId,
}: AccountAdjustModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <AccountAdjustModalInner
        key={initialAccountId || 'default-adjust'}
        onClose={onClose}
        initialAccountId={initialAccountId}
      />
    </Modal>
  );
}
