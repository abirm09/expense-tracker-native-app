import { Check, Plus, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getLocalDateString } from '@/lib/date-utils';
import { useGetCategoriesQuery } from '@/store/api/categories-api';
import { useAddExpenseMutation } from '@/store/api/expenses-api';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddExpenseModal({ visible, onClose }: AddExpenseModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxModalHeight = Math.round(windowHeight * 0.88);
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const { data: categories = [], isLoading: isLoadingCategories } = useGetCategoriesQuery();
  const [addExpense, { isLoading: isSubmitting }] = useAddExpenseMutation();

  const activeCategoryId = selectedCategoryId ?? categories[0]?.id ?? null;

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setSelectedCategoryId(null);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a description or title');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    setError(null);
    try {
      // By convention in expense tracking, expenses are negative amounts
      await addExpense({
        title: title.trim(),
        amount: -Math.abs(numericAmount),
        category_id: activeCategoryId,
        date: getLocalDateString(),
        notes: notes.trim() || null,
        currency: 'BDT',
      }).unwrap();

      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save expense';
      setError(msg);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="absolute inset-0" onPress={handleClose} />
          <View
            className="bg-card rounded-t-3xl border-t border-border flex-col overflow-hidden w-full"
            style={{
              height: maxModalHeight,
              maxHeight: maxModalHeight,
              paddingBottom: Math.max(insets.bottom, 16),
            }}>
            {/* Header */}
            <View className="shrink-0 flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <Text variant="h4" className="font-bold flex-1 mr-2" numberOfLines={1}>
                Add New Expense
              </Text>
              <Pressable
                onPress={handleClose}
                className="h-8 w-8 rounded-full bg-muted items-center justify-center">
                <Icon as={X} className="text-foreground" size={16} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              className="px-6 py-4 flex-1"
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 320 }}>
            <View className="gap-4">
              {/* Title Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Description / Title
                </Text>
                <Input
                  placeholder="e.g. Grocery Shopping, Dinner"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="sentences"
                />
              </View>

              {/* Amount Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Amount (৳)
                </Text>
                <Input
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Categories Selector */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Category
                </Text>
                {isLoadingCategories ? (
                  <ActivityIndicator size="small" className="py-2" />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row gap-2 py-1">
                    {categories.map((cat) => {
                      const isSelected = activeCategoryId === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setSelectedCategoryId(cat.id)}
                          className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border border-border"
                          style={{
                            backgroundColor: isSelected ? cat.color : undefined,
                            borderColor: isSelected ? cat.color : undefined,
                          }}>
                          {isSelected && (
                            <Icon as={Check} className="text-white" size={14} />
                          )}
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: isSelected ? '#ffffff' : undefined,
                            }}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* Notes Input */}
              <View className="gap-1.5">
                <Text variant="small" className="font-medium text-foreground">
                  Notes (Optional)
                </Text>
                <Input
                  placeholder="Additional details..."
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Error display */}
              {error && (
                <Text className="text-destructive text-sm font-medium">
                  {error}
                </Text>
              )}

            </View>
          </ScrollView>

          {/* Pinned Action Buttons Footer */}
          <View className="shrink-0 px-6 pt-3 border-t border-border gap-2">
            {error && (
              <Text className="text-destructive text-sm font-medium">
                {error}
              </Text>
            )}

            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex-row items-center justify-center gap-2">
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon as={Plus} className="text-primary-foreground" size={18} />
                  <Text className="font-semibold text-primary-foreground">
                    Save Expense
                  </Text>
                </>
              )}
            </Button>
            <Button variant="ghost" onPress={handleClose} disabled={isSubmitting}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
