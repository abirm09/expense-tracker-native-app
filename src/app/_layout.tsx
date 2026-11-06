import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Lock } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { Provider } from 'react-redux';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PinScreen } from '@/components/auth/pin-screen';
import { ResetPasswordScreen } from '@/components/auth/reset-password-screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { NAV_THEME } from '@/lib/theme';
import { store } from '@/store';


import { ThemePreferenceProvider, useAppTheme } from '@/context/theme-context';

import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// NativeWind v4 animated transition classes trigger strict mode shared value access warnings in Reanimated 4
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

function NavigationRoot() {
  const {
    user,
    isLoading,
    isPinChecking,
    isLocked,
    isPasswordRecovery,
    unlockApp,
    signOut,
  } = useAuth();

  // 1. Initial restoration loading
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 2. Password recovery deep link -> choose a new password before entering.
  if (isPasswordRecovery) {
    return <ResetPasswordScreen />;
  }

  // 3. First Password: Not logged in -> Show Account Login & Register
  if (!user) {
    return <AuthScreen />;
  }

  // 4. User is authenticated -> Render persistent Stack navigator, with PIN check & lock screens as security overlays
  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* Security Overlay: Checking PIN status */}
      {isPinChecking && (
        <View className="absolute inset-0 bg-background items-center justify-center p-6 z-50">
          <View className="items-center max-w-sm w-full">
            <View className="h-20 w-20 rounded-full bg-primary/10 items-center justify-center mb-6 border border-primary/20">
              <Icon as={Lock} className="text-primary" size={36} />
            </View>
            <ActivityIndicator size="large" className="my-3 text-primary" />
            <Text variant="h3" className="font-bold text-center mt-2">
              Checking PIN Security
            </Text>
            <Text variant="muted" className="text-center text-sm mt-2">
              Verifying your security credentials...
            </Text>
          </View>
        </View>
      )}

      {/* Security Overlay: PIN Locked Screen */}
      {!isPinChecking && isLocked && (
        <View className="absolute inset-0 z-50 bg-background">
          <PinScreen
            title="App Locked"
            subtitle="Enter your 5-digit PIN to open the app"
            onSuccess={async (pin) => {
              const unlocked = await unlockApp(pin);
              if (!unlocked) {
                throw new Error('Incorrect PIN. Please try again.');
              }
            }}
            onForgotPin={signOut}
          />
        </View>
      )}
    </View>
  );
}

function RootLayoutContent() {
  const { colorScheme, isDark } = useAppTheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className={isDark ? 'dark flex-1' : 'flex-1'}>
        <NavigationRoot />
        <PortalHost />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <ThemePreferenceProvider>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </ThemePreferenceProvider>
    </Provider>
  );
}
