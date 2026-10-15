import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/auth-context';

export function AuthScreen() {
  const { signInWithEmail, isLoading, isAuthenticating } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isEmailFocused, setIsEmailFocused] = React.useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const isBusy = isLoading || isAuthenticating;

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleEmailFocus = () => {
    setIsEmailFocused(true);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    const { error } = await signInWithEmail(email.trim(), password);
    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
            paddingHorizontal: 24,
            paddingTop: isKeyboardVisible ? 16 : 24,
            paddingBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 40 : 120) : 24,
          }}
          className="max-w-md mx-auto w-full">
          {/* Header Branding */}
          <View className={`items-center ${isKeyboardVisible ? 'mb-4 mt-1' : 'mb-8'}`}>
            <View
              className={`rounded-2xl bg-primary/10 items-center justify-center border border-primary/20 ${
                isKeyboardVisible ? 'h-11 w-11 mb-2' : 'h-16 w-16 mb-4'
              }`}>
              <Icon
                as={ShieldCheck}
                className="text-primary"
                size={isKeyboardVisible ? 22 : 32}
              />
            </View>
            <Text
              variant={isKeyboardVisible ? 'h4' : 'h2'}
              className="text-center font-bold">
              Expense Tracker
            </Text>
            {!isKeyboardVisible && (
              <Text variant="muted" className="text-center mt-1">
                Personal Financial Vault
              </Text>
            )}
          </View>

          {/* Login Card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">Account Login</CardTitle>
              <CardDescription>
                Enter your account credentials to access your data
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              <View className="gap-1.5">
                <Text variant="small">Email Address</Text>
                <View
                  className={`flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 ${
                    isEmailFocused ? 'border-primary' : 'border-input'
                  }`}>
                  <Icon as={Mail} className="text-muted-foreground mr-2.5" size={18} />
                  <Input
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!isBusy}
                    onFocus={handleEmailFocus}
                    onBlur={() => setIsEmailFocused(false)}
                    className="flex-1 border-0 h-10 px-0 shadow-none bg-transparent dark:bg-transparent text-foreground"
                  />
                </View>
              </View>

              <View className="gap-1.5">
                <Text variant="small">Password</Text>
                <View
                  className={`flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 ${
                    isPasswordFocused ? 'border-primary' : 'border-input'
                  }`}>
                  <Icon as={Lock} className="text-muted-foreground mr-2.5" size={18} />
                  <Input
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="password"
                    autoComplete="current-password"
                    editable={!isBusy}
                    onFocus={handlePasswordFocus}
                    onBlur={() => setIsPasswordFocused(false)}
                    className="flex-1 border-0 h-10 px-0 shadow-none bg-transparent dark:bg-transparent text-foreground"
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                    className="p-1 -mr-1 items-center justify-center">
                    <Icon
                      as={showPassword ? EyeOff : Eye}
                      className="text-muted-foreground"
                      size={18}
                    />
                  </Pressable>
                </View>
              </View>

              {errorMessage && (
                <View className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <Text className="text-xs text-destructive font-medium text-center">
                    {errorMessage}
                  </Text>
                </View>
              )}

              <Button
                onPress={handleSubmit}
                disabled={isBusy}
                className="w-full mt-2 flex-row items-center justify-center gap-2">
                {isBusy ? (
                  <>
                    <ActivityIndicator size="small" />
                    <Text className="font-semibold text-primary-foreground">
                      Signing in...
                    </Text>
                  </>
                ) : (
                  <Text className="font-semibold text-primary-foreground">
                    Sign In
                  </Text>
                )}
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
