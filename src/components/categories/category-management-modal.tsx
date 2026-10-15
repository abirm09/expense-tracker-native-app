import {
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryFormCard } from '@/components/categories/category-form-modal';
import { getCategoryIcon } from '@/components/categories/category-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
} from '@/store/api/categories-api';
import { Category } from '@/types/database.types';

interface CategoryManagementModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: 'expense' | 'income';
}

function CategoryManagementModalContent({
  onClose,
  initialType = 'expense',
}: {
  onClose: () => void;
  initialType?: 'expense' | 'income';
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<'expense' | 'income'>(initialType);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [viewMode, setViewMode] = React.useState<'list' | 'form'>('list');

  const { data: allCategories = [], isLoading } = useGetCategoriesQuery();
  const [deleteCategory] = useDeleteCategoryMutation();

  const filteredCategories = React.useMemo(() => {
    return allCategories.filter((cat) => {
      if (activeTab === 'expense') {
        return cat.type === 'expense' || cat.type === 'both' || !cat.type;
      }
      return cat.type === 'income' || cat.type === 'both';
    });
  }, [allCategories, activeTab]);

  const handleDelete = (cat: Category) => {
    if (cat.is_default) {
      Alert.alert('System Category', 'Default system categories cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"? Transactions in this category will become uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id).unwrap();
            } catch (err: unknown) {
              const msg =
                typeof err === 'object' && err !== null && 'message' in err
                  ? String((err as any).message)
                  : err instanceof Error
                  ? err.message
                  : 'Could not delete category';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setViewMode('form');
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setViewMode('form');
  };

  return (
    <View className="flex-1 bg-black/60 justify-end">
      <Pressable className="flex-1" onPress={onClose} />

      {viewMode === 'form' ? (
        <CategoryFormCard
          categoryToEdit={editingCategory}
          defaultType={activeTab}
          onClose={() => {
            setViewMode('list');
            setEditingCategory(null);
          }}
          onSuccess={() => {
            setViewMode('list');
            setEditingCategory(null);
          }}
          isEmbedded
        />
      ) : (
        <View
          className="bg-card rounded-t-3xl border-t border-border max-h-[88%] flex-col"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-border">
            <View>
              <Text variant="h4" className="font-bold">
                Manage Categories
              </Text>
              <Text variant="muted" className="text-xs">
                Create, customize & configure monthly limits
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Pressable>
          </View>

          <View className="px-6">
            {/* Type Tabs */}
            <View className="flex-row bg-muted p-1 rounded-xl my-4">
              <Pressable
                onPress={() => setActiveTab('expense')}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                  activeTab === 'expense' ? 'bg-background shadow-sm' : ''
                }`}>
                <Icon
                  as={ArrowUpRight}
                  size={15}
                  color={activeTab === 'expense' ? '#ef4444' : '#64748b'}
                />
                <Text
                  className={`font-semibold text-xs ${
                    activeTab === 'expense' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                  Expenses (Debits)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('income')}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${
                  activeTab === 'income' ? 'bg-background shadow-sm' : ''
                }`}>
                <Icon
                  as={ArrowDownLeft}
                  size={15}
                  color={activeTab === 'income' ? '#10b981' : '#64748b'}
                />
                <Text
                  className={`font-semibold text-xs ${
                    activeTab === 'income' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                  Income (Credits)
                </Text>
              </Pressable>
            </View>

            {/* Add Category Quick Button */}
            <Button
              onPress={handleAddNew}
              className="flex-row items-center justify-center gap-2 mb-3 bg-primary">
              <Icon as={Plus} size={16} className="text-primary-foreground" />
              <Text className="font-semibold text-xs text-primary-foreground">
                Add New {activeTab === 'expense' ? 'Expense' : 'Income'} Category
              </Text>
            </Button>
          </View>

          {/* Categories List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-6 flex-1"
            contentContainerClassName="pb-6 gap-2.5">
            {isLoading ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="small" />
                <Text variant="muted" className="text-xs mt-2">
                  Loading categories...
                </Text>
              </View>
            ) : filteredCategories.length === 0 ? (
              <View className="py-10 items-center justify-center">
                <Text variant="muted" className="text-xs">
                  No categories found for this type.
                </Text>
              </View>
            ) : (
              filteredCategories.map((cat) => {
                const IconComponent = getCategoryIcon(cat.icon);
                const isExpense = cat.type === 'expense' || !cat.type;
                const hasLimit =
                  isExpense &&
                  cat.monthly_limit !== null &&
                  cat.monthly_limit !== undefined &&
                  Number(cat.monthly_limit) > 0;

                return (
                  <View
                    key={cat.id}
                    className="flex-row items-center justify-between p-3.5 rounded-2xl border border-border bg-card/60">
                    <View className="flex-row items-center gap-3 flex-1 mr-2">
                      <View
                        className="h-10 w-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${cat.color || '#10b981'}20` }}>
                        <Icon
                          as={IconComponent}
                          size={18}
                          color={cat.color || '#10b981'}
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text variant="small" className="font-semibold text-foreground">
                            {cat.name}
                          </Text>
                          {cat.is_default ? (
                            <Badge variant="secondary" className="px-1.5 py-0">
                              <Text className="text-[9px] font-medium text-muted-foreground">
                                Default
                              </Text>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="px-1.5 py-0 border-primary/40">
                              <Text className="text-[9px] font-medium text-primary">
                                Custom
                              </Text>
                            </Badge>
                          )}
                        </View>

                        {isExpense && (
                          <Text variant="muted" className="text-[11px] mt-0.5">
                            {hasLimit
                              ? `Monthly Limit: ৳${Number(cat.monthly_limit).toFixed(2)}`
                              : 'No monthly limit set'}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={() => handleEdit(cat)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="h-8 w-8 rounded-full items-center justify-center bg-muted/60 active:bg-muted">
                        <Icon as={Edit2} size={14} className="text-foreground" />
                      </Pressable>

                      {!cat.is_default && (
                        <Pressable
                          onPress={() => handleDelete(cat)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="h-8 w-8 rounded-full items-center justify-center bg-destructive/10 active:bg-destructive/20">
                          <Icon as={Trash2} size={14} className="text-destructive" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function CategoryManagementModal({
  visible,
  onClose,
  initialType = 'expense',
}: CategoryManagementModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <CategoryManagementModalContent
          key={`${visible}-${initialType}`}
          onClose={onClose}
          initialType={initialType}
        />
      ) : null}
    </Modal>
  );
}
