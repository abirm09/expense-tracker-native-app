import { ChevronRight, Sliders, Sparkles } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { getCategoryIcon } from '@/components/categories/category-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { useGetCategoryMonthlyUsageQuery } from '@/store/api/categories-api';

interface CategoryBudgetUsageSectionProps {
  onOpenManageCategories: () => void;
  month?: number;
  year?: number;
}

export function CategoryBudgetUsageSection({
  onOpenManageCategories,
  month,
  year,
}: CategoryBudgetUsageSectionProps) {
  const { data: usageList = [], isLoading, isFetching } = useGetCategoryMonthlyUsageQuery({
    month,
    year,
  });

  // Filter to categories that have a monthly limit set
  const categoriesWithLimits = React.useMemo(() => {
    return usageList.filter((item) => Number(item.monthly_limit) > 0);
  }, [usageList]);

  // Overall totals across categories with limits
  const { totalBudgeted, totalSpent } = React.useMemo(() => {
    let budgeted = 0;
    let spent = 0;
    for (const item of categoriesWithLimits) {
      budgeted += Number(item.monthly_limit || 0);
      spent += Number(item.total_spent || 0);
    }
    return { totalBudgeted: budgeted, totalSpent: spent };
  }, [categoriesWithLimits]);

  const overallPercentage =
    totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5">
            <CardTitle className="text-base font-bold">Category Budgets & Usage</CardTitle>
            {isFetching && <ActivityIndicator size="small" />}
          </View>
          <Text variant="muted" className="text-xs">
            Dynamic monthly limits & live usage percentages
          </Text>
        </View>

        <Pressable
          onPress={onOpenManageCategories}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-muted active:bg-muted/80">
          <Icon as={Sliders} size={13} className="text-muted-foreground" />
          <Text className="text-[11px] font-semibold text-muted-foreground">Manage</Text>
        </Pressable>
      </CardHeader>

      <CardContent className="gap-3.5 pt-0">
        {isLoading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" />
            <Text variant="muted" className="text-xs mt-1.5">
              Calculating category usage...
            </Text>
          </View>
        ) : categoriesWithLimits.length === 0 ? (
          <View className="py-6 px-3 bg-muted/30 rounded-2xl border border-dashed border-border items-center">
            <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center mb-2">
              <Icon as={Sparkles} size={20} className="text-primary" />
            </View>
            <Text variant="small" className="font-semibold text-center text-foreground">
              No Category Limits Configured Yet
            </Text>
            <Text variant="muted" className="text-xs text-center mt-1 max-w-xs">
              Assign monthly limits to your expense categories to automatically calculate spending usage and get over-budget alerts.
            </Text>
            <Button
              size="sm"
              onPress={onOpenManageCategories}
              className="mt-3.5 flex-row items-center gap-1.5">
              <Text className="text-xs font-semibold text-primary-foreground">Configure Category Limits</Text>
              <Icon as={ChevronRight} size={14} className="text-primary-foreground" />
            </Button>
          </View>
        ) : (
          <View className="gap-3">
            {/* Overall Category Budget Summary */}
            {totalBudgeted > 0 && (
              <View className="bg-muted/40 p-3 rounded-2xl border border-border flex-row items-center justify-between">
                <View>
                  <Text variant="muted" className="text-[11px]">
                    Total Allocated Budget
                  </Text>
                  <Text className="text-sm font-bold text-foreground">
                    {formatBDT(totalSpent)}{' '}
                    <Text className="text-xs font-normal text-muted-foreground">
                      / {formatBDT(totalBudgeted)}
                    </Text>
                  </Text>
                </View>
                <Badge
                  variant={
                    overallPercentage >= 100
                      ? 'destructive'
                      : overallPercentage >= 75
                      ? 'secondary'
                      : 'default'
                  }
                  className="px-2 py-0.5">
                  <Text className="text-[10px] font-bold">
                    {overallPercentage.toFixed(0)}% Overall
                  </Text>
                </Badge>
              </View>
            )}

            {/* Individual Category Cards */}
            {categoriesWithLimits.map((item) => {
              const IconComp = getCategoryIcon(item.icon);
              const limit = Number(item.monthly_limit);
              const spent = Number(item.total_spent);
              const percentage = Number(item.usage_percentage);
              const isOver = item.is_over_budget || percentage >= 100;
              const remaining = Number(item.remaining_limit);

              // Progress bar fill capped at 100%
              const progressWidth = Math.min(100, Math.max(0, percentage));

              // Determine status colors
              let barColor = 'bg-emerald-500';
              let badgeVariant: 'default' | 'secondary' | 'destructive' = 'default';

              if (percentage >= 100) {
                barColor = 'bg-rose-500';
                badgeVariant = 'destructive';
              } else if (percentage >= 75) {
                barColor = 'bg-amber-500';
                badgeVariant = 'secondary';
              }

              return (
                <View
                  key={item.category_id}
                  className="p-3.5 rounded-2xl border border-border bg-card">
                  {/* Category info header */}
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2.5">
                      <View
                        className="h-8 w-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${item.color || '#10b981'}20` }}>
                        <Icon
                          as={IconComp}
                          size={15}
                          color={item.color || '#10b981'}
                        />
                      </View>
                      <View>
                        <Text variant="small" className="font-semibold text-foreground">
                          {item.category_name}
                        </Text>
                        <Text variant="muted" className="text-[11px]">
                          Limit: {formatBDT(limit)} / mo
                        </Text>
                      </View>
                    </View>

                    <Badge variant={badgeVariant} className="px-2 py-0.5">
                      <Text className="text-[10px] font-bold">
                        {percentage.toFixed(0)}% Used
                      </Text>
                    </Badge>
                  </View>

                  {/* Progress Bar */}
                  <View className="h-2 w-full rounded-full bg-muted overflow-hidden my-1">
                    <View
                      style={{ width: `${progressWidth}%` }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </View>

                  {/* Spent and Remaining */}
                  <View className="flex-row items-center justify-between mt-1">
                    <Text variant="muted" className="text-[11px]">
                      Spent: <Text className="font-semibold text-foreground">{formatBDT(spent)}</Text>
                    </Text>
                    <Text
                      className={`text-[11px] font-medium ${
                        isOver ? 'text-destructive font-bold' : 'text-muted-foreground'
                      }`}>
                      {isOver
                        ? `Over by ${formatBDT(Math.abs(remaining))}`
                        : `${formatBDT(remaining)} remaining`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </CardContent>
    </Card>
  );
}
