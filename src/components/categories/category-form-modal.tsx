import { ArrowDownLeft, ArrowUpRight, Check, X } from 'lucide-react-native';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CATEGORY_ICON_LIST,
  CATEGORY_PALETTE,
} from '@/components/categories/category-utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAppTheme } from '@/context/theme-context';
import {
  useAddCategoryMutation,
  useUpdateCategoryMutation,
} from '@/store/api/categories-api';
import { Category } from '@/types/database.types';

export interface CategoryFormValues {
  name: string;
  type: 'expense' | 'income';
  monthlyLimit: string;
  color: string;
  icon: string;
}

export interface CategoryFormCardProps {
  onClose: () => void;
  categoryToEdit?: Category | null;
  defaultType?: 'expense' | 'income';
  onSuccess?: (category: Category) => void;
  isEmbedded?: boolean;
}

export function CategoryFormCard({
  onClose,
  categoryToEdit,
  defaultType = 'expense',
  onSuccess,
  isEmbedded = false,
}: CategoryFormCardProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxModalHeight = Math.round(windowHeight * 0.88);
  const { isDark } = useAppTheme();
  const isEditing = Boolean(categoryToEdit);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const [addCategory, { isLoading: isAdding }] = useAddCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();

  const isSubmittingApi = isAdding || isUpdating;

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    defaultValues: {
      name: categoryToEdit?.name ?? '',
      type: categoryToEdit?.type === 'income' ? 'income' : defaultType,
      monthlyLimit:
        categoryToEdit?.monthly_limit && Number(categoryToEdit.monthly_limit) > 0
          ? String(categoryToEdit.monthly_limit)
          : '',
      color: categoryToEdit?.color || CATEGORY_PALETTE[0],
      icon: categoryToEdit?.icon || CATEGORY_ICON_LIST[0].id,
    },
    mode: 'onBlur',
  });

  const currentType = useWatch({ control, name: 'type' });
  const currentColor = useWatch({ control, name: 'color' });
  const currentIcon = useWatch({ control, name: 'icon' });

  const onSubmit = handleSubmit(async (data) => {
    setApiError(null);

    let parsedLimit: number | null = null;
    if (data.type === 'expense' && data.monthlyLimit.trim()) {
      const num = parseFloat(data.monthlyLimit.trim());
      if (isNaN(num) || num < 0) {
        return;
      }
      parsedLimit = num;
    }

    try {
      let savedCategory: Category;
      if (isEditing && categoryToEdit) {
        savedCategory = await updateCategory({
          id: categoryToEdit.id,
          name: data.name.trim(),
          type: data.type,
          monthly_limit: data.type === 'expense' ? (parsedLimit ?? 0) : null,
          color: data.color,
          icon: data.icon,
        }).unwrap();
      } else {
        savedCategory = await addCategory({
          name: data.name.trim(),
          type: data.type,
          monthly_limit: data.type === 'expense' ? (parsedLimit ?? 0) : null,
          color: data.color,
          icon: data.icon,
        }).unwrap();
      }

      onSuccess?.(savedCategory);
      onClose();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null
          ? ('message' in err && typeof (err as any).message === 'string'
              ? (err as any).message
              : 'error' in err && typeof (err as any).error === 'string'
              ? (err as any).error
              : 'Failed to save category')
          : err instanceof Error
          ? err.message
          : 'Failed to save category';
      setApiError(msg);
    }
  });

  return (
    <View
      className="bg-card rounded-t-3xl border-t border-border flex-col overflow-hidden w-full"
      style={{
        height: maxModalHeight,
        maxHeight: maxModalHeight,
        paddingBottom: Math.max(insets.bottom, 16),
      }}>
        {/* Header */}
        <View className="shrink-0 flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <View className="flex-1 pr-2">
            <Text variant="h4" className="font-bold" numberOfLines={1}>
              {isEditing ? 'Edit Category' : 'Create Category'}
            </Text>
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {currentType === 'expense'
                ? 'Expense Category (with dynamic monthly limit)'
                : 'Income Category (credit cash flow)'}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          className="px-6 flex-1"
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 350, gap: 16 }}>
          {apiError && (
            <View className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
              <Text className="text-xs text-destructive font-medium">{apiError}</Text>
            </View>
          )}

          {/* Type Selector (Debit / Credit) */}
          <View className="gap-1.5">
            <Text variant="small" className="font-semibold text-foreground">
              Category Type (Accounting Flow)
            </Text>
            <View className="flex-row bg-muted p-1 rounded-xl">
              <Pressable
                key="cat-type-expense"
                onPress={() => setValue('type', 'expense', { shouldDirty: true })}
                style={{
                  backgroundColor: currentType === 'expense' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                  elevation: currentType === 'expense' ? 1 : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: currentType === 'expense' ? 0.08 : 0,
                  shadowRadius: 2,
                }}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 border ${
                  currentType === 'expense' ? (isDark ? 'border-rose-500/30' : 'border-rose-200/80') : 'border-transparent'
                }`}>
                <Icon
                  as={ArrowUpRight}
                  size={16}
                  color={currentType === 'expense' ? '#ef4444' : '#64748b'}
                />
                <Text
                  style={{ color: currentType === 'expense' ? (isDark ? '#f87171' : '#dc2626') : '#64748b' }}
                  className="text-xs font-bold">
                  Expense (Debit)
                </Text>
              </Pressable>

              <Pressable
                key="cat-type-income"
                onPress={() => setValue('type', 'income', { shouldDirty: true })}
                style={{
                  backgroundColor: currentType === 'income' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                  elevation: currentType === 'income' ? 1 : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: currentType === 'income' ? 0.08 : 0,
                  shadowRadius: 2,
                }}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 border ${
                  currentType === 'income' ? (isDark ? 'border-emerald-500/30' : 'border-emerald-200/80') : 'border-transparent'
                }`}>
                <Icon
                  as={ArrowDownLeft}
                  size={16}
                  color={currentType === 'income' ? '#10b981' : '#64748b'}
                />
                <Text
                  style={{ color: currentType === 'income' ? (isDark ? '#34d399' : '#059669') : '#64748b' }}
                  className="text-xs font-bold">
                  Income (Credit)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Category Name Input with react-hook-form */}
          <View className="gap-1.5">
            <Text variant="small" className="font-semibold text-foreground">
              Category Name *
            </Text>
            <Controller
              control={control}
              name="name"
              rules={{
                required: 'Please provide a category name',
                validate: {
                  notEmpty: (val) =>
                    (val && val.trim().length > 0) || 'Category name cannot be empty',
                  maxLength: (val) =>
                    val.trim().length <= 50 || 'Category name cannot exceed 50 characters',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="e.g. Groceries, Coffee, Salary, Freelance"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  className={errors.name ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.name && (
              <Text className="text-xs text-destructive font-medium mt-0.5">
                {errors.name.message}
              </Text>
            )}
          </View>

          {/* Monthly Limit (for expense type only) */}
          {currentType === 'expense' && (
            <View className="gap-1.5 bg-muted/40 p-3 rounded-2xl border border-border">
              <View className="flex-row items-center justify-between">
                <Text variant="small" className="font-semibold text-foreground">
                  Monthly Budget Limit (৳)
                </Text>
                <Text variant="muted" className="text-[11px]">
                  Optional
                </Text>
              </View>
              <Controller
                control={control}
                name="monthlyLimit"
                rules={{
                  validate: {
                    isNonNegativeNumber: (val) => {
                      if (!val || !val.trim()) return true;
                      const num = parseFloat(val);
                      if (isNaN(num) || num < 0) {
                        return 'Please enter a valid amount (0 or greater)';
                      }
                      return true;
                    },
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="e.g. 5000.00"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    className={errors.monthlyLimit ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.monthlyLimit && (
                <Text className="text-xs text-destructive font-medium mt-0.5">
                  {errors.monthlyLimit.message}
                </Text>
              )}
              <Text variant="muted" className="text-[11px] mt-1 leading-4">
                Set a monthly threshold to track expenses against this limit and calculate real-time percentage usage.
              </Text>
            </View>
          )}

          {/* Theme Color Picker */}
          <View className="gap-2">
            <Text variant="small" className="font-semibold text-foreground">
              Theme Color
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-3 py-1">
              {CATEGORY_PALETTE.map((color) => {
                const isSelected = currentColor === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => setValue('color', color, { shouldDirty: true })}
                    className="h-10 w-10 rounded-full items-center justify-center shadow-xs"
                    style={{
                      backgroundColor: color,
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: '#ffffff',
                    }}>
                    {isSelected && <Icon as={Check} size={18} className="text-white" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Icon Picker */}
          <View className="gap-2">
            <Text variant="small" className="font-semibold text-foreground">
              Icon
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-2 py-1">
              {CATEGORY_ICON_LIST.map((item) => {
                const isSelected = currentIcon === item.id;
                const IconComp = item.icon;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setValue('icon', item.id, { shouldDirty: true })}
                    className={`items-center justify-center px-3 py-2 rounded-xl border ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}>
                    <Icon
                      as={IconComp}
                      size={20}
                      color={isSelected ? currentColor : '#64748b'}
                    />
                    <Text
                      className={`text-[10px] mt-1 font-medium ${
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View className="shrink-0 flex-row gap-3 px-6 pt-3 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onPress={onClose}
            disabled={isSubmittingApi}>
            <Text>Cancel</Text>
          </Button>
          <Button
            className="flex-1"
            onPress={onSubmit}
            disabled={isSubmittingApi}>
            {isSubmittingApi ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="font-semibold text-primary-foreground">
                {isEditing ? 'Save Changes' : 'Create Category'}
              </Text>
            )}
          </Button>
        </View>
      </View>
  );
}

// Backwards-compatible alias for in-modal embedded usage
export const CategoryFormContent = CategoryFormCard;

export interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  categoryToEdit?: Category | null;
  defaultType?: 'expense' | 'income';
  onSuccess?: (category: Category) => void;
}

export function CategoryFormModal({
  visible,
  onClose,
  categoryToEdit,
  defaultType = 'expense',
  onSuccess,
}: CategoryFormModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="absolute inset-0" onPress={onClose} />
          <CategoryFormCard
            key={categoryToEdit ? categoryToEdit.id : `new-${defaultType}`}
            onClose={onClose}
            categoryToEdit={categoryToEdit}
            defaultType={defaultType}
            onSuccess={onSuccess}
          />
        </View>
      ) : null}
    </Modal>
  );
}
