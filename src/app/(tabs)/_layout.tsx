import { Tabs } from 'expo-router';
import { LayoutDashboard, User, Wallet } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';

import { AppSidebar } from '@/components/navigation/app-sidebar';
import { Icon } from '@/components/ui/icon';
import { NAV_THEME } from '@/lib/theme';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const colors = theme.colors;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colorScheme === 'dark' ? '#34d399' : '#059669',
          tabBarInactiveTintColor: colorScheme === 'dark' ? '#94a3b8' : '#64748b',
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
            zIndex: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}>
        {/* 3 Visible Bottom Navigation Tabs */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Overview',
            tabBarIcon: ({ color, size }) => (
              <Icon as={LayoutDashboard} color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            tabBarIcon: ({ color, size }) => (
              <Icon as={Wallet} color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Icon as={User} color={color} size={size ?? 22} />
            ),
          }}
        />

        <Tabs.Screen
          name="debts"
          options={{
            title: 'Receivable & Payable',
            href: null,
          }}
        />
        <Tabs.Screen
          name="debt-user"
          options={{
            title: 'User Ledger',
            href: null,
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            title: 'Expenses',
            href: null,
          }}
        />
        <Tabs.Screen
          name="income"
          options={{
            title: 'Income',
            href: null,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            href: null,
          }}
        />
      </Tabs>
      <AppSidebar />
    </>
  );
}
