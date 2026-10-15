import { router, usePathname } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  LayoutDashboard,
  Lock,
  LogOut,
  LucideIcon,
  Moon,
  PieChart,
  ShieldCheck,
  Sliders,
  Sun,
  User,
  Wallet,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryManagementModal } from '@/components/categories/category-management-modal';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeSidebar } from '@/store/slices/ui-slice';

interface NavItem {
  id: string;
  label: string;
  subtitle: string;
  route: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'Dashboard & summary',
    route: '/(tabs)',
    icon: LayoutDashboard,
  },
  {
    id: 'accounts',
    label: 'Accounts & Ledger',
    subtitle: 'Cash, bank & transfers',
    route: '/(tabs)/accounts',
    icon: Wallet,
  },
  {
    id: 'expenses',
    label: 'Expenses',
    subtitle: 'Debit spending records',
    route: '/(tabs)/expenses',
    icon: ArrowUpRight,
    badge: 'Debit',
    badgeColor: '#ef4444',
  },
  {
    id: 'income',
    label: 'Income',
    subtitle: 'Credit earnings streams',
    route: '/(tabs)/income',
    icon: ArrowDownLeft,
    badge: 'Credit',
    badgeColor: '#10b981',
  },
  {
    id: 'reports',
    label: 'Analytics & Reports',
    subtitle: 'Charts & budget usage',
    route: '/(tabs)/reports',
    icon: PieChart,
  },
  {
    id: 'profile',
    label: 'Profile & Security',
    subtitle: 'PIN & account settings',
    route: '/(tabs)/profile',
    icon: User,
  },
];

export function AppSidebar() {
  const dispatch = useAppDispatch();
  const isSidebarOpen = useAppSelector((state) => state.ui.isSidebarOpen);
  const pathname = usePathname();
  const { user, profile, hasPin, lockApp, signOut } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const handleNavigate = (route: string) => {
    dispatch(closeSidebar());
    // Small timeout to allow modal animation to proceed cleanly
    setTimeout(() => {
      router.push(route as any);
    }, 50);
  };

  const handleLock = () => {
    dispatch(closeSidebar());
    setTimeout(() => {
      lockApp();
    }, 100);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          dispatch(closeSidebar());
          await signOut();
        },
      },
    ]);
  };

  const handleOpenCategories = () => {
    dispatch(closeSidebar());
    setTimeout(() => {
      setShowCategoryModal(true);
    }, 100);
  };

  const isCurrentActive = (route: string, id: string) => {
    if (id === 'overview') {
      return (
        pathname === '/' ||
        pathname === '/(tabs)' ||
        pathname === '/(tabs)/index' ||
        pathname === ''
      );
    }
    return pathname.includes(id);
  };

  return (
    <>
      <Modal
        visible={isSidebarOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => dispatch(closeSidebar())}>
        <View className="flex-1 flex-row">
          {/* Sidebar Drawer Panel */}
          <SafeAreaView
            className="w-[84%] max-w-[320px] bg-card h-full border-r border-border shadow-2xl justify-between"
            edges={['top', 'bottom', 'left']}>
            <View className="flex-1">
              {/* Drawer Top Branding Header */}
              <View className="p-5 pb-4 border-b border-border flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="h-10 w-10 rounded-2xl bg-primary/10 items-center justify-center border border-primary/20">
                    <Icon as={ShieldCheck} size={22} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text variant="small" className="font-bold text-foreground" numberOfLines={1}>
                      Expense Tracker
                    </Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                      Financial Vault
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => dispatch(closeSidebar())}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="h-8 w-8 rounded-full bg-muted items-center justify-center">
                  <Icon as={X} size={16} className="text-muted-foreground" />
                </Pressable>
              </View>

              {/* User Profile Card Summary */}
              <Pressable
                onPress={() => handleNavigate('/(tabs)/profile')}
                className="mx-4 mt-3 mb-2 p-3 rounded-2xl bg-muted/40 border border-border/60 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-full bg-primary/15 items-center justify-center border border-primary/25">
                  <Text className="font-bold text-sm text-primary">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-xs text-foreground" numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                    {user?.email || 'Signed In'}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={15} className="text-muted-foreground" />
              </Pressable>

              {/* Navigation List */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="py-2 px-3 gap-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5">
                  Menu Navigation
                </Text>

                {NAV_ITEMS.map((item) => {
                  const active = isCurrentActive(item.route, item.id);
                  const IconComp = item.icon;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleNavigate(item.route)}
                      className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl border ${
                        active
                          ? 'bg-primary/10 border-primary/30'
                          : 'border-transparent active:bg-muted/60'
                      }`}>
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <View
                          className={`h-8 w-8 rounded-lg items-center justify-center ${
                            active ? 'bg-primary' : 'bg-muted'
                          }`}>
                          <Icon
                            as={IconComp}
                            size={16}
                            className={active ? 'text-primary-foreground' : 'text-muted-foreground'}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-xs ${
                              active ? 'font-bold text-primary' : 'font-semibold text-foreground'
                            }`}>
                            {item.label}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground">
                            {item.subtitle}
                          </Text>
                        </View>
                      </View>

                      {item.badge && (
                        <View
                          className="px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${item.badgeColor || '#10b981'}15`,
                          }}>
                          <Text
                            className="text-[10px] font-semibold"
                            style={{ color: item.badgeColor || '#10b981' }}>
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                {/* Secondary Actions Section */}
                <View className="mt-3 pt-3 border-t border-border/60">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5">
                    Settings & Tools
                  </Text>

                  <Pressable
                    onPress={handleOpenCategories}
                    className="flex-row items-center justify-between px-3 py-2.5 rounded-xl border border-transparent active:bg-muted/60">
                    <View className="flex-row items-center gap-3 flex-1 mr-2">
                      <View className="h-8 w-8 rounded-lg items-center justify-center bg-muted">
                        <Icon as={Sliders} size={16} className="text-muted-foreground" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                          Category Management
                        </Text>
                        <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                          Edit icons, colors & limits
                        </Text>
                      </View>
                    </View>
                    <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                  </Pressable>
                </View>
              </ScrollView>
            </View>

            {/* Bottom Actions Footer */}
            <View className="p-4 border-t border-border gap-2 bg-card">
              <Pressable
                onPress={toggleTheme}
                className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/70 active:bg-muted border border-border">
                <View className="flex-row items-center gap-2">
                  <Icon as={isDark ? Moon : Sun} size={15} className="text-foreground" />
                  <Text className="font-semibold text-xs text-foreground">
                    {isDark ? 'Dark Theme' : 'Light Theme'}
                  </Text>
                </View>
                <Text className="text-[10px] font-bold text-primary uppercase">
                  Switch to {isDark ? 'Light' : 'Dark'}
                </Text>
              </Pressable>

              {hasPin && (
                <Pressable
                  onPress={handleLock}
                  className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-muted active:bg-muted/80 border border-border">
                  <Icon as={Lock} size={15} className="text-foreground" />
                  <Text className="font-semibold text-xs text-foreground">Lock Vault Now</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSignOut}
                className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 active:bg-destructive/20 border border-destructive/20">
                <Icon as={LogOut} size={15} className="text-destructive" />
                <Text className="font-semibold text-xs text-destructive">Sign Out</Text>
              </Pressable>

              <Text className="text-[10px] text-center text-muted-foreground mt-1">
                Personal Financial Vault • v1.0.0
              </Text>
            </View>
          </SafeAreaView>

          {/* Backdrop Tap to Close */}
          <Pressable
            className="flex-1 bg-black/60"
            onPress={() => dispatch(closeSidebar())}
            accessibilityLabel="Close sidebar"
            accessibilityRole="button"
          />
        </View>
      </Modal>

      {/* Category Management Triggered from Sidebar */}
      <CategoryManagementModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />
    </>
  );
}
