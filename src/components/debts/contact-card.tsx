import { router } from 'expo-router';
import { ChevronRight, MessageSquare, Phone } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { ContactWithLedger } from '@/types/database.types';

interface ContactCardProps {
  contact: ContactWithLedger;
}

export function ContactCard({ contact }: ContactCardProps) {
  const displayName = contact.name?.trim() || contact.phone;
  const netBalance = contact.net_balance;
  const owesYou = netBalance > 0.01;
  const youOwe = netBalance < -0.01;
  const isSettled = !owesYou && !youOwe;

  const handleOpenWhatsApp = async (e: any) => {
    e.stopPropagation();
    const phoneToUse = contact.whatsapp?.trim() || contact.phone;
    let cleanNumber = phoneToUse.replace(/[^0-9]/g, '');

    // If starts with 01 (local Bangladeshi mobile), prefix country code 88
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

  const handlePhoneCall = async (e: any) => {
    e.stopPropagation();
    const cleanNumber = contact.phone.replace(/[^0-9+]/g, '');
    try {
      await Linking.openURL(`tel:${cleanNumber}`);
    } catch {
      Alert.alert('Error', 'Could not initiate phone call');
    }
  };

  const handlePressCard = () => {
    router.push({
      pathname: '/(tabs)/debt-user',
      params: { id: contact.id },
    } as any);
  };

  return (
    <Card className="mb-2.5 border-border shadow-xs overflow-hidden active:scale-[0.99] transition-all">
      <Pressable onPress={handlePressCard} className="p-4">
        <View className="flex-row items-center justify-between">
          {/* User Info with Avatar */}
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <View className="h-11 w-11 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
              <Text className="text-base font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                  {displayName}
                </Text>
                {contact.name && (
                  <View className="px-1.5 py-0.2 rounded bg-muted">
                    <Text className="text-[10px] text-muted-foreground font-medium">User</Text>
                  </View>
                )}
              </View>

              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                {contact.phone}
              </Text>
            </View>
          </View>

          {/* Balance Badge & Indicator */}
          <View className="items-end">
            {owesYou && (
              <View className="items-end">
                <Text className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                  Owes You
                </Text>
                <Text className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                  {formatBDT(netBalance)}
                </Text>
              </View>
            )}

            {youOwe && (
              <View className="items-end">
                <Text className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">
                  You Owe
                </Text>
                <Text className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                  {formatBDT(Math.abs(netBalance))}
                </Text>
              </View>
            )}

            {isSettled && (
              <Badge variant="outline" className="px-2 py-0.5">
                <Text className="text-[10px] font-bold text-muted-foreground">Settled</Text>
              </Badge>
            )}
          </View>
        </View>

        {/* Action Row */}
        <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-border/60">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handlePhoneCall}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="h-7 px-2.5 rounded-lg bg-muted active:bg-muted/80 flex-row items-center gap-1 border border-border/80">
              <Icon as={Phone} size={12} className="text-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">Call</Text>
            </Pressable>

            <Pressable
              onPress={handleOpenWhatsApp}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="h-7 px-2.5 rounded-lg bg-emerald-500/10 active:bg-emerald-500/20 flex-row items-center gap-1 border border-emerald-500/20">
              <Icon as={MessageSquare} size={12} className="text-emerald-600 dark:text-emerald-400" />
              <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                WhatsApp
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-[11px] font-medium text-muted-foreground">
              {contact.transaction_count} {contact.transaction_count === 1 ? 'entry' : 'entries'}
            </Text>
            <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
