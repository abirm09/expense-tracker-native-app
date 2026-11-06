import {
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Search,
  UserPlus,
  Users,
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

import { ContactCard } from '@/components/debts/contact-card';
import { ContactFormModal } from '@/components/debts/contact-form-modal';
import { RecordDebtModal } from '@/components/debts/record-debt-modal';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import {
  useGetContactsQuery,
  useGetDebtSummaryQuery,
} from '@/store/api/debts-api';
import { DebtType } from '@/types/database.types';

export default function DebtsScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterTab, setFilterTab] = React.useState<'all' | 'receivable' | 'payable' | 'settled'>('all');
  const [showAddContactModal, setShowAddContactModal] = React.useState(false);
  const [showRecordModal, setShowRecordModal] = React.useState(false);
  const [recordDefaultType, setRecordDefaultType] = React.useState<DebtType>('receivable');

  const {
    data: contacts = [],
    isLoading: isLoadingContacts,
    isFetching: isFetchingContacts,
    refetch: refetchContacts,
  } = useGetContactsQuery();

  const {
    data: summary,
    isFetching: isFetchingSummary,
    refetch: refetchSummary,
  } = useGetDebtSummaryQuery();

  const isRefreshing = isFetchingContacts || isFetchingSummary;

  const handleRefresh = React.useCallback(() => {
    refetchContacts();
    refetchSummary();
  }, [refetchContacts, refetchSummary]);

  // Filter contacts by search and debt status
  const filteredContacts = React.useMemo(() => {
    return contacts.filter((contact) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = contact.name?.toLowerCase().includes(query) ?? false;
        const matchesPhone = contact.phone.includes(query);
        const matchesEmail = contact.email?.toLowerCase().includes(query) ?? false;
        const matchesWhatsapp = contact.whatsapp?.includes(query) ?? false;
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesWhatsapp) {
          return false;
        }
      }

      // 2. Status Tab Filter
      if (filterTab === 'receivable') {
        return contact.net_balance > 0.01;
      }
      if (filterTab === 'payable') {
        return contact.net_balance < -0.01;
      }
      if (filterTab === 'settled') {
        return Math.abs(contact.net_balance) <= 0.01;
      }

      return true;
    });
  }, [contacts, searchQuery, filterTab]);

  const totalReceivable = summary?.total_receivable ?? 0;
  const totalPayable = summary?.total_payable ?? 0;
  const netBalance = summary?.net_balance ?? 0;

  const handleOpenRecord = (type: DebtType) => {
    setRecordDefaultType(type);
    setShowRecordModal(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top Header */}
      <View className="px-5 py-3 border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <HamburgerButton />
          <View>
            <Text variant="h3" className="font-extrabold text-foreground">
              Receivable & Payable
            </Text>
            <Text variant="muted" className="text-xs">
              Lend, borrow & user ledger
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowAddContactModal(true)}
            className="h-9 px-3 rounded-xl bg-primary flex-row items-center gap-1.5 shadow-sm active:opacity-80">
            <Icon as={UserPlus} size={15} className="text-primary-foreground" />
            <Text className="text-xs font-bold text-primary-foreground">+ User</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="p-5 pb-24 gap-4"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }>
        {/* Ledger Summary Cards */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardHeader className="pb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon as={Scale} size={16} className="text-primary" />
                <Text variant="muted" className="text-xs font-bold uppercase tracking-wider">
                  Ledger Overview
                </Text>
              </View>
              <Badge variant="outline" className="px-2 py-0.5">
                <Text className="text-[10px] font-bold">
                  {summary?.contact_count ?? contacts.length} Users
                </Text>
              </Badge>
            </View>

            <View className="mt-2">
              <Text variant="muted" className="text-xs">
                Net Outstanding Position
              </Text>
              <CardTitle
                className={`text-2xl font-extrabold mt-0.5 ${
                  netBalance > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : netBalance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                }`}>
                {netBalance > 0
                  ? `+${formatBDT(netBalance)} (Net To Collect)`
                  : netBalance < 0
                  ? `-${formatBDT(Math.abs(netBalance))} (Net To Pay)`
                  : '৳0.00 (All Clear)'}
              </CardTitle>
            </View>
          </CardHeader>

          <CardContent className="pt-2">
            <View className="flex-row gap-2.5">
              {/* Total Receivables (Lent / To Receive) */}
              <Pressable
                onPress={() => setFilterTab('receivable')}
                className="flex-1 bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
                <View className="flex-row items-center gap-1 mb-1">
                  <Icon as={ArrowUpRight} size={14} className="text-amber-600 dark:text-amber-400" />
                  <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    Receivables
                  </Text>
                </View>
                <Text className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {formatBDT(totalReceivable)}
                </Text>
                <Text variant="muted" className="text-[10px] mt-0.5">
                  Money others owe you
                </Text>
              </Pressable>

              {/* Total Payables (Borrowed / To Pay) */}
              <Pressable
                onPress={() => setFilterTab('payable')}
                className="flex-1 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                <View className="flex-row items-center gap-1 mb-1">
                  <Icon as={ArrowDownLeft} size={14} className="text-rose-600 dark:text-rose-400" />
                  <Text className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
                    Payables
                  </Text>
                </View>
                <Text className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {formatBDT(totalPayable)}
                </Text>
                <Text variant="muted" className="text-[10px] mt-0.5">
                  Money you owe others
                </Text>
              </Pressable>
            </View>

            {/* Quick Record Actions */}
            <View className="flex-row gap-2 mt-3 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                onPress={() => handleOpenRecord('receivable')}
                className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-1.5 border-amber-500/30 bg-amber-500/5">
                <Icon as={ArrowUpRight} size={14} className="text-amber-600 dark:text-amber-400" />
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  + Lend Money
                </Text>
              </Button>

              <Button
                variant="outline"
                onPress={() => handleOpenRecord('payable')}
                className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-1.5 border-rose-500/30 bg-rose-500/5">
                <Icon as={ArrowDownLeft} size={14} className="text-rose-600 dark:text-rose-400" />
                <Text className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  + Borrow Money
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <View className="relative">
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users by name, phone, email..."
            className="pl-10 pr-9 h-11 text-xs"
          />
          <View className="absolute left-3 top-3">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          {searchQuery.trim().length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              className="absolute right-3 top-3 h-5 w-5 rounded-full bg-muted items-center justify-center">
              <Icon as={X} size={12} className="text-muted-foreground" />
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <View className="bg-muted p-1 rounded-2xl flex-row gap-1">
          <Pressable
            onPress={() => setFilterTab('all')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filterTab === 'all' ? 'bg-card shadow-sm border border-border' : ''
            }`}>
            <Text
              className={`text-xs font-semibold ${
                filterTab === 'all' ? 'text-foreground font-bold' : 'text-muted-foreground'
              }`}>
              All ({contacts.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab('receivable')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filterTab === 'receivable' ? 'bg-card shadow-sm border border-border' : ''
            }`}>
            <Text
              className={`text-xs font-semibold ${
                filterTab === 'receivable'
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-muted-foreground'
              }`}>
              Owe Me
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab('payable')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filterTab === 'payable' ? 'bg-card shadow-sm border border-border' : ''
            }`}>
            <Text
              className={`text-xs font-semibold ${
                filterTab === 'payable'
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-muted-foreground'
              }`}>
              I Owe
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab('settled')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filterTab === 'settled' ? 'bg-card shadow-sm border border-border' : ''
            }`}>
            <Text
              className={`text-xs font-semibold ${
                filterTab === 'settled' ? 'text-foreground font-bold' : 'text-muted-foreground'
              }`}>
              Settled
            </Text>
          </Pressable>
        </View>

        {/* User Contacts List */}
        <View className="mt-1">
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Users & Ledgers ({filteredContacts.length})
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Tap user to view transactions
            </Text>
          </View>

          {isLoadingContacts ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" />
              <Text variant="muted" className="text-xs mt-3">
                Loading users...
              </Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View className="py-12 px-6 items-center justify-center bg-card rounded-3xl border border-dashed border-border gap-3">
              <View className="h-14 w-14 rounded-full bg-primary/10 items-center justify-center border border-primary/20">
                <Icon as={Users} size={28} className="text-primary" />
              </View>
              <Text className="text-base font-bold text-foreground text-center">
                {searchQuery.trim()
                  ? 'No matching users found'
                  : filterTab !== 'all'
                  ? `No ${filterTab} users`
                  : 'No users created yet'}
              </Text>
              <Text variant="muted" className="text-xs text-center max-w-xs">
                {searchQuery.trim()
                  ? 'Try searching with a different name or phone number.'
                  : 'Create a user with name, phone and WhatsApp to start tracking money you lend or borrow.'}
              </Text>
              <Button
                onPress={() => setShowAddContactModal(true)}
                className="mt-2 h-10 px-5 rounded-xl flex-row items-center gap-2">
                <Icon as={UserPlus} size={16} className="text-primary-foreground" />
                <Text className="font-bold text-primary-foreground text-xs">Add First User</Text>
              </Button>
            </View>
          ) : (
            filteredContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add User Modal */}
      <ContactFormModal
        visible={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onSuccess={() => {
          refetchContacts();
          refetchSummary();
        }}
      />

      {/* Record Debt Modal */}
      <RecordDebtModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        defaultType={recordDefaultType}
        onSuccess={() => {
          refetchContacts();
          refetchSummary();
        }}
      />
    </SafeAreaView>
  );
}
