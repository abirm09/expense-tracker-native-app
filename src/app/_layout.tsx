import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Provider } from 'react-redux';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PinScreen } from '@/components/auth/pin-screen';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { NAV_THEME } from '@/lib/theme';
import { store } from '@/store';


import { ThemePreferenceProvider, useAppTheme } from '@/context/theme-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

function NavigationRoot() {
  const { user, isLoading, isLocked, unlockApp, signOut } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 1. First Password: Not logged in -> Show Account Login & Register
  if (!user) {
    return <AuthScreen />;
  }

  // 2. Second Password: Logged in, but app is locked -> Show 5-Digit PIN Screen
  if (isLocked) {
    return (
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
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutContent() {
  const { colorScheme, isDark } = useAppTheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationRoot />
      <PortalHost />
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
