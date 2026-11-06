import { Plus, Search, Sliders, Tag, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryManagementModal } from '@/components/categories/category-management-modal';
import { AddTransactionModal } from '@/components/expenses/add-transaction-modal';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { useGetCategoriesQuery } from '@/store/api/categories-api';
import { useDeleteExpenseMutation, useGetExpensesQuery } from '@/store/api/expenses-api';

export default function ExpensesScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);

  // RTK Query: fetch only expense items
  const {
    data: allExpenses = [],
    isLoading,
    isFetching,
    refetch,
  } = useGetExpensesQuery({ type: 'expense' });

  const { data: categories = [] } = useGetCategoriesQuery({ type: 'expense' });
  const [deleteExpense] = useDeleteExpenseMutation();

  // Filter expenses by search query and category
  const filteredExpenses = React.useMemo(() => {
    return allExpenses.filter((item) => {
      // Balance reconciliation adjustments are not real spending.
      if (item.entry_type === 'adjustment') return false;

      // Must be an expense
      const isExpense = item.type === 'expense' || (!item.type && item.amount < 0);
      if (!isExpense) return false;

      if (selectedCategory && item.category_id !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query) ?? false;
        const matchesCategory = item.categories?.name.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesNotes && !matchesCategory) return false;
      }
      return true;
    });
  }, [allExpenses, selectedCategory, searchQuery]);

  const totalSpent = React.useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
  }, [filteredExpenses]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(id).unwrap();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not delete expense';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-3 border-b border-border/40">
        <HamburgerButton />
        <View className="flex-1">
          <Text variant="h3" className="font-bold" numberOfLines={1}>
            Expenses
          </Text>
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            Debit ledger & spending tracker
          </Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerClassName="p-5 pt-3 pb-16 gap-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />
        }>
        {/* Action Row */}
        <View className="flex-row items-center gap-2.5">
          <Button
            variant="outline"
            onPress={() => setShowCategoryModal(true)}
            className="flex-1 flex-row items-center justify-center gap-2 h-10 rounded-xl border-border bg-card">
            <Icon as={Sliders} size={14} className="text-muted-foreground" />
            <Text className="text-xs font-semibold text-foreground">Manage Categories</Text>
          </Button>
          <Button
            onPress={() => setShowAddModal(true)}
            style={{ backgroundColor: '#e11d48' }}
            className="flex-1 flex-row items-center justify-center gap-2 h-10 rounded-xl active:opacity-90">
            <Icon as={Plus} color="#ffffff" size={15} />
            <Text className="text-xs font-semibold text-white">Add Debit</Text>
          </Button>
        </View>

        {/* Spent Summary Banner */}
        <View className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-medium text-rose-600 dark:text-rose-400">
              Total Filtered Debits
            </Text>
            <Text className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
              {formatBDT(totalSpent)}
            </Text>
          </View>
          <Badge variant="secondary" className="px-2.5 py-1">
            <Text className="text-xs font-semibold">{filteredExpenses.length} debits</Text>
          </Badge>
        </View>

        {/* Search Input */}
        <View className="relative flex-row items-center">
          <View className="absolute left-3 z-10">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <Input
            placeholder="Search expenses by title or note..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="pl-9 pr-9 h-10 rounded-xl"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              className="absolute right-3 z-10 h-6 w-6 rounded-full bg-muted items-center justify-center">
              <Icon as={X} size={12} className="text-foreground" />
            </Pressable>
          )}
        </View>

        {/* Category Filter Chips with Monthly Limits */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
          className="-mx-5 px-5 py-0.5">
          {/* Manage categories chip */}
          <Pressable
            onPress={() => setShowCategoryModal(true)}
            className="px-3 py-1.5 rounded-full border border-dashed border-primary/50 bg-primary/5 flex-row items-center gap-1">
            <Icon as={Sliders} size={12} className="text-primary" />
            <Text className="text-xs font-semibold text-primary">Manage</Text>
          </Pressable>

          <Pressable
            key="cat-chip-all"
            onPress={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-full border ${
              selectedCategory === null
                ? 'bg-rose-500 border-rose-500'
                : 'bg-muted/60 border-border/60'
            }`}>
            <Text
              className={`text-xs font-medium ${
                selectedCategory === null ? 'text-white font-semibold' : 'text-foreground'
              }`}>
              All
            </Text>
          </Pressable>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const hasLimit =
              cat.monthly_limit !== null &&
              cat.monthly_limit !== undefined &&
              Number(cat.monthly_limit) > 0;

            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                className="px-3.5 py-1.5 rounded-full border flex-row items-center gap-1"
                style={{
                  backgroundColor: isSelected ? cat.color : undefined,
                  borderColor: isSelected ? cat.color : '#cbd5e1',
                }}>
                <Text
                  className="text-xs font-medium"
                  style={{ color: isSelected ? '#ffffff' : undefined }}>
                  {cat.name}
                  {hasLimit ? ` (৳${Number(cat.monthly_limit).toFixed(0)})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="small" />
            <Text variant="muted" className="text-xs mt-2">
              Loading expenses...
            </Text>
          </View>
        ) : filteredExpenses.length === 0 ? (
          <View className="py-16 items-center justify-center px-6">
            <View className="h-16 w-16 rounded-full bg-rose-500/10 items-center justify-center mb-3">
              <Icon as={Tag} size={28} className="text-rose-500" />
            </View>
            <Text variant="large" className="font-semibold text-center">
              No Expenses Found
            </Text>
            <Text variant="muted" className="text-xs text-center mt-1 max-w-xs">
              {searchQuery || selectedCategory
                ? 'Try adjusting your search or category filter.'
                : 'You have not recorded any expenses yet. Tap "Add" above to start!'}
            </Text>
          </View>
        ) : (
          filteredExpenses.map((item) => {
            const absAmount = Math.abs(Number(item.amount));
            const categoryName = item.categories?.name ?? 'General Expense';
            const categoryColor = item.categories?.color || '#ef4444';

            return (
              <Card key={item.id} className="py-3 px-4">
                <CardContent className="flex-row items-center justify-between p-0">
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <View
                      className="h-10 w-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${categoryColor}20` }}>
                      <Icon as={Tag} size={18} color={categoryColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="px-1 py-0 border-rose-500/30 bg-rose-500/5">
                          <Text className="text-[9px] font-bold text-rose-500">DEBIT</Text>
                        </Badge>
                        <Text variant="muted" className="text-xs">
                          {item.date} • {categoryName}
                          {item.accounts?.name ? ` • ${item.accounts.name}` : ''}
                          {item.contacts ? ` • User: ${item.contacts.name || item.contacts.phone}` : ''}
                        </Text>
                      </View>
                      {item.notes ? (
                        <Text variant="muted" className="text-[11px] italic mt-0.5">
                          &ldquo;{item.notes}&rdquo;
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold text-sm text-rose-600 dark:text-rose-400">
                      -{formatBDT(absAmount)}
                    </Text>
                    <Pressable
                      onPress={() => handleDelete(item.id, item.title)}
                      className="p-1.5 rounded-lg active:bg-muted">
                      <Icon as={Trash2} size={15} className="text-muted-foreground/60" />
                    </Pressable>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={showAddModal}
        defaultType="expense"
        onClose={() => setShowAddModal(false)}
      />

      {/* Dynamic Category Management Modal */}
      <CategoryManagementModal
        visible={showCategoryModal}
        initialType="expense"
        onClose={() => setShowCategoryModal(false)}
      />
    </SafeAreaView>
  );
}
