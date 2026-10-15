import { Check, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCOUNT_COLORS,
  ACCOUNT_TYPE_LIST,
} from '@/components/accounts/account-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  useCreateAccountMutation,
  useUpdateAccountMutation,
} from '@/store/api/accounts-api';
import { Account, AccountType } from '@/types/database.types';

interface AccountFormModalProps {
  visible: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
  defaultType?: AccountType;
}

function AccountFormModalInner({
  onClose,
  accountToEdit,
  defaultType = 'cash',
}: {
  onClose: () => void;
  accountToEdit?: Account | null;
  defaultType?: AccountType;
}) {
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(accountToEdit);

  const [name, setName] = React.useState(accountToEdit?.name || '');
  const [type, setType] = React.useState<AccountType>(
    accountToEdit?.type || defaultType
  );
  const [accountNumber, setAccountNumber] = React.useState(
    accountToEdit?.account_number || ''
  );
  const [openingBalance, setOpeningBalance] = React.useState(
    accountToEdit?.opening_balance !== undefined && accountToEdit?.opening_balance !== null
      ? String(accountToEdit.opening_balance)
      : '0.00'
  );
  const [isDefault, setIsDefault] = React.useState(
    accountToEdit?.is_default || false
  );
  const [color, setColor] = React.useState(
    accountToEdit?.color || '#10b981'
  );
  const [notes, setNotes] = React.useState(accountToEdit?.notes || '');
  const [error, setError] = React.useState<string | null>(null);

  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAccountMutation();

  const isSaving = isCreating || isUpdating;

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter an account name');
      return;
    }

    const numBalance = parseFloat(openingBalance);
    if (isNaN(numBalance)) {
      setError('Please enter a valid numeric opening balance');
      return;
    }

    try {
      if (isEditing && accountToEdit) {
        await updateAccount({
          id: accountToEdit.id,
          name: name.trim(),
          type,
          account_number: accountNumber.trim() || null,
          opening_balance: numBalance,
          is_default: isDefault,
          color,
          notes: notes.trim() || null,
        }).unwrap();
      } else {
        await createAccount({
          name: name.trim(),
          type,
          account_number: accountNumber.trim() || null,
          opening_balance: numBalance,
          is_default: isDefault,
          color,
          notes: notes.trim() || null,
        }).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save account';
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
          <Text variant="h4" className="font-bold">
            {isEditing ? 'Edit Account' : 'New Financial Account'}
          </Text>
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
            {/* Account Type Selector */}
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold text-foreground">
                Account Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {ACCOUNT_TYPE_LIST.map((opt) => {
                  const isSelected = type === opt.type;
                  const IconComp = opt.icon;
                  return (
                    <Pressable
                      key={opt.type}
                      onPress={() => {
                        setType(opt.type);
                        setColor(opt.defaultColor);
                      }}
                      className={`flex-1 min-w-[45%] p-3 rounded-2xl border flex-row items-center gap-2.5 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/30'
                      }`}>
                      <View
                        className="h-8 w-8 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${opt.defaultColor}20` }}>
                        <Icon as={IconComp} size={16} color={opt.defaultColor} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-primary' : 'text-foreground'
                          }`}>
                          {opt.label}
                        </Text>
                        <Text variant="muted" className="text-[10px]" numberOfLines={1}>
                          {opt.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Name Input */}
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold text-foreground">
                Account Name
              </Text>
              <Input
                placeholder="e.g. Dutch Bangla Bank, bKash Personal, Main Wallet"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Account / Phone Number (Optional) */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text variant="small" className="font-semibold text-foreground">
                  Account / Mobile Number
                </Text>
                <Text variant="muted" className="text-[11px]">
                  Optional
                </Text>
              </View>
              <Input
                placeholder="e.g. 017XXXXXXXX or **** 4589"
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="default"
              />
            </View>

            {/* Opening Balance (৳ BDT) */}
            <View className="gap-1.5 bg-muted/40 p-3.5 rounded-2xl border border-border">
              <View className="flex-row items-center justify-between">
                <Text variant="small" className="font-semibold text-foreground">
                  Opening Balance (৳)
                </Text>
                <Text variant="muted" className="text-[11px]">
                  BDT
                </Text>
              </View>
              <Input
                placeholder="0.00"
                value={openingBalance}
                onChangeText={setOpeningBalance}
                keyboardType="decimal-pad"
              />
              <Text variant="muted" className="text-[11px] leading-4">
                Initial starting funds in this account before logging transactions.
              </Text>
            </View>

            {/* Default Account Toggle */}
            <View className="flex-row items-center justify-between p-3.5 rounded-2xl border border-border bg-muted/20">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-semibold text-foreground">
                  Set as Default Account
                </Text>
                <Text variant="muted" className="text-[11px] mt-0.5">
                  Pre-selected for new expense and income entries.
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: '#94a3b8', true: '#10b981' }}
              />
            </View>

            {/* Color Tag */}
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold text-foreground">
                Account Theme Color
              </Text>
              <View className="flex-row flex-wrap gap-2.5">
                {ACCOUNT_COLORS.map((c) => {
                  const isSelected = color === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className="h-8 w-8 rounded-full items-center justify-center border-2 border-background">
                      {isSelected && <Icon as={Check} size={14} color="#ffffff" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View className="gap-1.5">
              <Text variant="small" className="font-medium text-foreground">
                Notes (Optional)
              </Text>
              <Input
                placeholder="Branch name, routing number, or memo..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                className="h-16 py-2"
              />
            </View>

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
              disabled={isSaving}
              className="w-full h-12 bg-primary">
              {isSaving ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="font-bold text-primary-foreground">
                  {isEditing ? 'Save Changes' : 'Create Account'}
                </Text>
              )}
            </Button>
            <Button variant="ghost" onPress={onClose} disabled={isSaving}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      </View>
  );
}

export function AccountFormModal({
  visible,
  onClose,
  accountToEdit,
  defaultType,
}: AccountFormModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <AccountFormModalInner
        key={accountToEdit ? accountToEdit.id : `new-${defaultType || 'cash'}`}
        onClose={onClose}
        accountToEdit={accountToEdit}
        defaultType={defaultType}
      />
    </Modal>
  );
}
