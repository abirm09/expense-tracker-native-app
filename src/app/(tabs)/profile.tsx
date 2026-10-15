import {
  KeyRound,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  Sliders,
  Sun,
  User,
  Wallet,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinScreen } from '@/components/auth/pin-screen';
import { PinSetupModal } from '@/components/auth/pin-setup-modal';
import { CategoryManagementModal } from '@/components/categories/category-management-modal';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

export default function ProfileScreen() {
  const { user, profile, hasPin, lockApp, signOut, disableAppPin } = useAuth();
  const { isDark, themePreference, setTheme } = useAppTheme();

  const [showSetupModal, setShowSetupModal] = React.useState(false);
  const [showDisableModal, setShowDisableModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleDisablePin = async (currentPin: string) => {
    const res = await disableAppPin(currentPin);
    if (!res.success) {
      throw new Error(res.error || 'Failed to remove PIN.');
    }
    setShowDisableModal(false);
    Alert.alert('PIN Removed', '5-Digit PIN protection has been disabled.');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <HamburgerButton />
          <View>
            <Text variant="h3" className="font-bold">
              Profile & Settings
            </Text>
            <Text variant="muted" className="text-xs">
              Manage your account, security, and preferences
            </Text>
          </View>
        </View>

        {hasPin && (
          <Button
            variant="outline"
            size="sm"
            onPress={lockApp}
            className="flex-row items-center gap-1.5 px-3 h-8.5 rounded-xl border-border">
            <Icon as={Lock} className="text-foreground" size={13} />
            <Text variant="small" className="text-foreground font-medium">
              Lock
            </Text>
          </Button>
        )}
      </View>

      <ScrollView
        contentContainerClassName="p-5 pt-2 pb-16 gap-5 max-w-xl mx-auto w-full"
        showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <Card className="border-border">
          <CardContent className="flex-row items-center gap-4 py-4">
            <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center border-2 border-primary/20">
              <Icon as={User} size={30} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text variant="h4" className="font-bold">
                {displayName}
              </Text>
              <Text variant="muted" className="text-xs mt-0.5">
                {user?.email}
              </Text>
              <Badge variant="outline" className="mt-2 self-start px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-primary">Single User Mode</Text>
              </Badge>
            </View>
          </CardContent>
        </Card>

        {/* Security Module (5-Digit PIN) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <View className="flex-row items-center gap-2">
              <Icon as={ShieldCheck} size={18} className="text-primary" />
              <CardTitle className="text-base font-bold">
                Dual Authentication & Security
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent className="gap-3 pt-1">
            <View className="p-3.5 rounded-xl bg-muted/50 border border-border flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold text-sm">5-Digit Quick PIN</Text>
                  <Badge variant={hasPin ? 'default' : 'outline'} className="px-2 py-0">
                    <Text className="text-[10px]">{hasPin ? 'Active' : 'Disabled'}</Text>
                  </Badge>
                </View>
                <Text variant="muted" className="text-xs mt-1">
                  {hasPin
                    ? 'App locks when minimized or placed in the background.'
                    : 'Set a 5-digit PIN to open the app quickly without typing your master password.'}
                </Text>
              </View>

              <View className="flex-col gap-2">
                {hasPin ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={lockApp}
                      className="flex-row items-center gap-1">
                      <Icon as={Lock} className="text-foreground" size={13} />
                      <Text className="text-xs font-medium">Lock Now</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => setShowSetupModal(true)}>
                      <Text className="text-xs text-primary font-medium">Change PIN</Text>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onPress={() => setShowSetupModal(true)}
                    className="flex-row items-center gap-1">
                    <Icon as={KeyRound} className="text-primary-foreground" size={13} />
                    <Text className="text-xs text-primary-foreground font-semibold">
                      Set PIN
                    </Text>
                  </Button>
                )}
              </View>
            </View>

            {hasPin && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowDisableModal(true)}
                className="self-start">
                <Text className="text-xs text-destructive">Remove / Disable 5-Digit PIN</Text>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Base Currency (BDT Single Currency) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-6 w-6 rounded-full bg-primary/10 items-center justify-center">
                  <Text className="text-primary font-bold text-xs">৳</Text>
                </View>
                <CardTitle className="text-base font-bold">Standard Currency</CardTitle>
              </View>
              <Badge variant="outline" className="px-2 py-0.5 border-emerald-500/30 bg-emerald-500/10">
                <Text className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">BDT (৳)</Text>
              </Badge>
            </View>
          </CardHeader>
          <CardContent className="pt-1">
            <View className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20">
                <Text className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">৳</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-sm">Bangladeshi Taka (BDT)</Text>
                <Text variant="muted" className="text-xs mt-0.5">
                  App transactions, budgets, category limits, and ledger summaries operate exclusively in Bangladeshi Taka.
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Financial Accounts & Ledger */}
        <Card className="border-border">
          <CardContent className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                <Icon as={Wallet} size={20} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-sm">Financial Accounts & Cashbook</Text>
                <Text variant="muted" className="text-xs">
                  Bank accounts, bKash/Nagad mobile wallets, cash, and transfers
                </Text>
              </View>
            </View>

            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/(tabs)/accounts')}
              className="flex-row items-center gap-1">
              <Text className="text-xs font-medium">Manage</Text>
            </Button>
          </CardContent>
        </Card>

        {/* Dynamic Categories & Monthly Limits */}
        <Card className="border-border">
          <CardContent className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                <Icon as={Sliders} size={20} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-sm">Dynamic Categories & Limits</Text>
                <Text variant="muted" className="text-xs">
                  Create custom expense/income categories and set monthly limits
                </Text>
              </View>
            </View>

            <Button
              size="sm"
              variant="outline"
              onPress={() => setShowCategoryModal(true)}
              className="flex-row items-center gap-1">
              <Text className="text-xs font-medium">Manage</Text>
            </Button>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon as={isDark ? Moon : Sun} size={18} className="text-primary" />
                <CardTitle className="text-base font-bold">App Appearance</CardTitle>
              </View>
              <Badge variant="outline" className="px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-primary">
                  {themePreference === 'system' ? 'System Sync' : isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </Badge>
            </View>
          </CardHeader>
          <CardContent className="pt-1 gap-3">
            <Text variant="muted" className="text-xs">
              Preference is saved automatically to local cache and persists across app reloads.
            </Text>
            <View className="flex-row gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border">
              <Button
                variant={themePreference === 'light' ? 'default' : 'ghost'}
                size="sm"
                onPress={() => setTheme('light')}
                className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl">
                <Icon
                  as={Sun}
                  size={14}
                  className={themePreference === 'light' ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    themePreference === 'light' ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}>
                  Light
                </Text>
              </Button>

              <Button
                variant={themePreference === 'dark' ? 'default' : 'ghost'}
                size="sm"
                onPress={() => setTheme('dark')}
                className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl">
                <Icon
                  as={Moon}
                  size={14}
                  className={themePreference === 'dark' ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    themePreference === 'dark' ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}>
                  Dark
                </Text>
              </Button>

              <Button
                variant={themePreference === 'system' ? 'default' : 'ghost'}
                size="sm"
                onPress={() => setTheme('system')}
                className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl">
                <Icon
                  as={Sliders}
                  size={14}
                  className={themePreference === 'system' ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    themePreference === 'system' ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}>
                  System
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Sign Out Button */}
        <View className="pt-2">
          <Button
            variant="destructive"
            onPress={handleSignOut}
            className="w-full flex-row items-center justify-center gap-2">
            <Icon as={LogOut} size={18} className="text-destructive-foreground" />
            <Text className="font-bold text-destructive-foreground">Sign Out</Text>
          </Button>
        </View>

        {/* PIN Setup Modal */}
        <PinSetupModal
          visible={showSetupModal}
          onClose={() => setShowSetupModal(false)}
        />

        {/* PIN Disable Verification Modal */}
        <Modal
          visible={showDisableModal}
          animationType="slide"
          presentationStyle="pageSheet"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setShowDisableModal(false)}>
          <View className="flex-1 bg-background">
            <PinScreen
              title="Verify PIN to Disable"
              subtitle="Enter your current 5-digit PIN to confirm removing it"
              doneButtonText="Disable PIN"
              onSuccess={handleDisablePin}
              allowCancel
              onCancel={() => setShowDisableModal(false)}
            />
          </View>
        </Modal>

        {/* Dynamic Category Management Modal */}
        <CategoryManagementModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
