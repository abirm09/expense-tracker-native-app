import {
  ArrowLeftRight,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  getAccountIcon,
  getAccountTypeLabel,
} from '@/components/accounts/account-utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { useDeleteAccountMutation } from '@/store/api/accounts-api';
import { Account } from '@/types/database.types';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onTransfer: (account: Account) => void;
}

export function AccountCard({ account, onEdit, onTransfer }: AccountCardProps) {
  const [deleteAccount] = useDeleteAccountMutation();
  const [showMenu, setShowMenu] = React.useState(false);

  const IconComp = getAccountIcon(account.type);
  const typeLabel = getAccountTypeLabel(account.type);
  const balance = Number(account.current_balance);
  const isPositive = balance >= 0;

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${account.name}"? Transactions in this account will remain in history as unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(account.id).unwrap();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to delete account';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 gap-3">
        {/* Top Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <View
              className="h-11 w-11 rounded-2xl items-center justify-center border"
              style={{
                backgroundColor: `${account.color || '#10b981'}15`,
                borderColor: `${account.color || '#10b981'}30`,
              }}>
              <Icon as={IconComp} size={20} color={account.color || '#10b981'} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="font-bold text-sm text-foreground" numberOfLines={1}>
                  {account.name}
                </Text>
                {account.is_default && (
                  <Badge variant="outline" className="px-1.5 py-0 border-primary/40 bg-primary/10">
                    <Text className="text-[9px] font-bold text-primary">DEFAULT</Text>
                  </Badge>
                )}
              </View>
              <Text variant="muted" className="text-xs mt-0.5">
                {typeLabel}
                {account.account_number ? ` • ${account.account_number}` : ''}
              </Text>
            </View>
          </View>

          {/* Quick Menu Toggle */}
          <Pressable
            onPress={() => setShowMenu(!showMenu)}
            className="h-8 w-8 rounded-full items-center justify-center active:bg-muted">
            <Icon as={MoreVertical} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Dropdown Action Menu */}
        {showMenu && (
          <View className="p-2 rounded-xl bg-muted/60 border border-border/70 flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => {
                setShowMenu(false);
                onEdit(account);
              }}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-background border border-border active:bg-muted">
              <Icon as={Pencil} size={12} className="text-foreground" />
              <Text className="text-xs font-medium text-foreground">Edit</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 active:bg-destructive/20">
              <Icon as={Trash2} size={12} className="text-destructive" />
              <Text className="text-xs font-medium text-destructive">Delete</Text>
            </Pressable>
          </View>
        )}

        {/* Account Balance & Transfer CTA */}
        <View className="flex-row items-end justify-between pt-1 border-t border-border/50">
          <View>
            <Text variant="muted" className="text-[11px] font-medium">
              Current Available Balance
            </Text>
            <Text
              className={`text-2xl font-extrabold mt-0.5 ${
                isPositive ? 'text-foreground' : 'text-destructive'
              }`}>
              {formatBDT(balance)}
            </Text>
          </View>

          <Pressable
            onPress={() => onTransfer(account)}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 active:bg-primary/20">
            <Icon as={ArrowLeftRight} size={13} className="text-primary" />
            <Text className="text-xs font-semibold text-primary">Transfer</Text>
          </Pressable>
        </View>
      </CardContent>
    </Card>
  );
}
