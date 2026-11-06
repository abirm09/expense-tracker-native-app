import {
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Sliders,
  Sparkles,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryBudgetUsageSection } from '@/components/categories/category-budget-usage-section';
import { CategoryManagementModal } from '@/components/categories/category-management-modal';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { AccountingLedgerCard } from '@/components/expenses/accounting-ledger-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { useGetExpenseStatsQuery } from '@/store/api/expenses-api';

export default function ReportsScreen() {
  const { data: stats, isLoading, isFetching, refetch } = useGetExpenseStatsQuery();
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);

  const totalIncome = stats?.totalIncome ?? 0;
  const totalSpent = stats?.totalSpent ?? 0;
  const netSavings = stats?.netSavings ?? 0;
  const savingsRate = stats?.savingsRate ?? 0;
  const categoryBreakdown = stats?.categoryBreakdown ?? [];
  const incomeBreakdown = stats?.incomeBreakdown ?? [];

  const hasData = totalIncome > 0 || totalSpent > 0;

  // Compute spend ratio for visual bar (0 - 100%)
  const totalCashFlow = totalIncome + totalSpent;
  const incomeShare = totalCashFlow > 0 ? (totalIncome / totalCashFlow) * 100 : 50;
  const expenseShare = totalCashFlow > 0 ? (totalSpent / totalCashFlow) * 100 : 50;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-3 border-b border-border/40">
        <HamburgerButton />
        <View className="flex-1">
          <Text variant="h3" className="font-bold" numberOfLines={1}>
            Analytics & Reports
          </Text>
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            Ledger cash flow & category budget analytics
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="p-5 pt-3 pb-16 gap-5 max-w-xl mx-auto w-full"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}>
        {/* Manage Categories Action (Scrollable) */}
        <Button
          variant="outline"
          onPress={() => setShowCategoryModal(true)}
          className="w-full flex-row items-center justify-center gap-2 h-10 rounded-xl border-border bg-card">
          <Icon as={Sliders} size={14} className="text-muted-foreground" />
          <Text className="text-xs font-semibold text-foreground">Manage Categories & Budget Limits</Text>
        </Button>
        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="small" />
            <Text variant="muted" className="text-xs mt-2">
              Generating report...
            </Text>
          </View>
        ) : !hasData ? (
          <View className="py-16 items-center justify-center px-6">
            <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center mb-3">
              <Icon as={PieChart} size={28} className="text-primary" />
            </View>
            <Text variant="large" className="font-semibold text-center">
              No Data to Analyze Yet
            </Text>
            <Text variant="muted" className="text-xs text-center mt-1 max-w-xs">
              Start adding your income and expenses to unlock visual charts, savings rates, and category distributions!
            </Text>
          </View>
        ) : (
          <>
            {/* Accounting Ledger Summary */}
            <AccountingLedgerCard />

            {/* Overview Card */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <View className="flex-row items-center justify-between">
                  <Text variant="muted" className="text-xs font-medium">
                    Net Cash Flow
                  </Text>
                  <Badge
                    variant={netSavings >= 0 ? 'default' : 'destructive'}
                    className="px-2.5 py-0.5">
                    <Text className="text-[11px] font-bold">
                      {savingsRate < 0
                        ? `${Math.abs(savingsRate).toFixed(0)}% Over`
                        : `${savingsRate.toFixed(0)}% Saved`}
                    </Text>
                  </Badge>
                </View>
                <CardTitle className="text-3xl font-extrabold mt-1">
                  {formatBDT(netSavings)}
                </CardTitle>
              </CardHeader>
              <CardContent className="gap-4">
                {/* Visual Cash Flow Bar */}
                <View className="gap-1.5">
                  <View className="h-3 w-full rounded-full bg-muted overflow-hidden flex-row">
                    <View
                      style={{ width: `${incomeShare}%` }}
                      className="h-full bg-emerald-500 rounded-l-full"
                    />
                    <View
                      style={{ width: `${expenseShare}%` }}
                      className="h-full bg-rose-500 rounded-r-full"
                    />
                  </View>
                  <View className="flex-row justify-between text-xs">
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <Text className="text-xs text-foreground font-medium">
                        Income (+{formatBDT(totalIncome)})
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <Text className="text-xs text-foreground font-medium">
                        Spent (-{formatBDT(totalSpent)})
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Key Insight */}
                <View className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex-row items-center gap-2.5">
                  <Icon as={Sparkles} size={18} className="text-primary" />
                  <Text className="text-xs text-foreground flex-1">
                    {netSavings >= 0
                      ? `Great job! You retained ${savingsRate.toFixed(1)}% of your earnings this period.`
                      : 'Expenses exceeded income this period. Review your category breakdown below to optimize.'}
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* Spending by Category Breakdown */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon as={ArrowUpRight} size={18} color="#ef4444" />
                  <CardTitle className="text-base font-bold">
                    Spending by Category
                  </CardTitle>
                </View>
                <Text variant="muted" className="text-xs">
                  {formatBDT(totalSpent)} Total
                </Text>
              </CardHeader>
              <CardContent className="gap-3 pt-2">
                {categoryBreakdown.length === 0 ? (
                  <Text variant="muted" className="text-xs text-center py-4">
                    No expense categories recorded yet.
                  </Text>
                ) : (
                  categoryBreakdown.map((item, index) => (
                    <View key={`exp-cat-${item.categoryId || index}`} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <View
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.categoryColor || '#ef4444' }}
                          />
                          <Text className="font-medium text-xs text-foreground">
                            {item.categoryName}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground font-medium">
                            {item.percentage.toFixed(1)}%
                          </Text>
                          <Text className="font-semibold text-xs text-foreground">
                            {formatBDT(item.total)}
                          </Text>
                        </View>
                      </View>
                      <View className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(3, item.percentage))}%`,
                            backgroundColor: item.categoryColor || '#ef4444',
                          }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Income Streams Breakdown */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon as={ArrowDownLeft} size={18} color="#10b981" />
                  <CardTitle className="text-base font-bold">
                    Income Streams
                  </CardTitle>
                </View>
                <Text variant="muted" className="text-xs">
                  {formatBDT(totalIncome)} Total
                </Text>
              </CardHeader>
              <CardContent className="gap-3 pt-2">
                {incomeBreakdown.length === 0 ? (
                  <Text variant="muted" className="text-xs text-center py-4">
                    No income sources recorded yet.
                  </Text>
                ) : (
                  incomeBreakdown.map((item, index) => (
                    <View key={`inc-cat-${item.categoryId || index}`} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <View
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.categoryColor || '#10b981' }}
                          />
                          <Text className="font-medium text-xs text-foreground">
                            {item.categoryName}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground font-medium">
                            {item.percentage.toFixed(1)}%
                          </Text>
                          <Text className="font-semibold text-xs text-foreground">
                            +{formatBDT(item.total)}
                          </Text>
                        </View>
                      </View>
                      <View className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(3, item.percentage))}%`,
                            backgroundColor: item.categoryColor || '#10b981',
                          }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Category Monthly Limits & Usage Percentages */}
            <CategoryBudgetUsageSection
              onOpenManageCategories={() => setShowCategoryModal(true)}
            />
          </>
        )}
      </ScrollView>

      {/* Dynamic Category Management Modal */}
      <CategoryManagementModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />
    </SafeAreaView>
  );
}
