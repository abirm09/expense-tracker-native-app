import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBDT } from '@/lib/format-currency';
import { useGetAccountingSummaryQuery } from '@/store/api/expenses-api';

interface AccountingLedgerCardProps {
  startDate?: string;
  endDate?: string;
}

export function AccountingLedgerCard({ startDate, endDate }: AccountingLedgerCardProps) {
  const { data: summary, isFetching } = useGetAccountingSummaryQuery({
    startDate,
    endDate,
  });

  const totalCredits = summary?.total_credits ?? 0;
  const totalDebits = summary?.total_debits ?? 0;
  const netBalance = summary?.net_balance ?? 0;
  const isSurplus = netBalance >= 0;
  const transactionCount = summary?.transaction_count ?? 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Icon as={Scale} size={15} className="text-primary" />
            <Text variant="muted" className="text-xs font-semibold uppercase tracking-wider">
              Accounting Ledger Summary
            </Text>
            {isFetching && <ActivityIndicator size="small" />}
          </View>
          <Badge
            variant={isSurplus ? 'default' : 'destructive'}
            className="px-2 py-0.5">
            <Text className="text-[10px] font-bold">
              {isSurplus ? 'Surplus' : 'Deficit'}
            </Text>
          </Badge>
        </View>

        <View className="mt-2">
          <Text variant="muted" className="text-xs font-medium">
            Net Ledger Balance (Credits − Debits)
          </Text>
          <CardTitle className="text-3xl font-extrabold mt-0.5 text-foreground">
            {formatBDT(netBalance)}
          </CardTitle>
        </View>
      </CardHeader>

      <CardContent className="pt-2">
        <View className="flex-row gap-3">
          {/* Total Debits (Expenses) */}
          <View className="flex-1 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
            <View className="flex-row items-center gap-1 mb-1">
              <Icon as={ArrowUpRight} size={14} className="text-rose-500" />
              <Text className="text-[11px] font-medium text-rose-500">
                Total Debits
              </Text>
            </View>
            <Text className="text-base font-bold text-rose-600 dark:text-rose-400">
              {formatBDT(totalDebits)}
            </Text>
            <Text variant="muted" className="text-[10px] mt-0.5">
              Expenses Outflow
            </Text>
          </View>

          {/* Total Credits (Income) */}
          <View className="flex-1 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl">
            <View className="flex-row items-center gap-1 mb-1">
              <Icon as={ArrowDownLeft} size={14} className="text-emerald-500" />
              <Text className="text-[11px] font-medium text-emerald-500">
                Total Credits
              </Text>
            </View>
            <Text className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatBDT(totalCredits)}
            </Text>
            <Text variant="muted" className="text-[10px] mt-0.5">
              Income Inflow
            </Text>
          </View>
        </View>

        {/* Footer info */}
        <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-border/60">
          <Text variant="muted" className="text-[11px]">
            {transactionCount} total {transactionCount === 1 ? 'entry' : 'entries'} recorded
          </Text>
          <Text variant="muted" className="text-[11px] font-medium">
            Double-entry ready
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
