import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
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
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/auth-context';

type AuthMode = 'signin' | 'signup';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    resendConfirmationEmail,
    requestPasswordReset,
    isLoading,
    isAuthenticating,
  } = useAuth();
  const [mode, setMode] = React.useState<AuthMode>('signin');
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isEmailFocused, setIsEmailFocused] = React.useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [isSendingReset, setIsSendingReset] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  const isBusy = isLoading || isAuthenticating;
  const isSignUp = mode === 'signup';

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((seconds) => seconds - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const switchMode = (nextMode: AuthMode) => {
    if (isBusy) return;
    setMode(nextMode);
    setErrorMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (isSignUp && !fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!normalizedEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    if (isSignUp) {
      const { error, requiresEmailConfirmation } = await signUpWithEmail(
        normalizedEmail,
        password,
        fullName.trim()
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (requiresEmailConfirmation) {
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setConfirmationEmail(normalizedEmail);
        setResendCooldown(45);
        setSuccessMessage(
          'Account created! Check your email and tap the confirmation link to finish signing in.'
        );
      }

      return;
    }

    const { error } = await signInWithEmail(normalizedEmail, password);
    if (error) {
      setErrorMessage(error.message);
      // Offer a resend when the account exists but the address is unverified.
      if (/confirm/i.test(error.message)) {
        setConfirmationEmail(normalizedEmail);
        setResendCooldown(0);
      }
    } else {
      setConfirmationEmail(null);
      setSuccessMessage(null);
    }
  };

  const handleResendConfirmation = async () => {
    const target = (confirmationEmail || email).trim().toLowerCase();

    if (!EMAIL_PATTERN.test(target)) {
      setErrorMessage('Enter the email address you registered with.');
      return;
    }

    setErrorMessage(null);
    setIsResending(true);
    const { error } = await resendConfirmationEmail(target);
    setIsResending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Confirmation email sent again. Check your inbox and spam folder.');
    setResendCooldown(45);
  };

  const handleForgotPassword = async () => {
    const target = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(target)) {
      setErrorMessage('Enter your account email first, then tap “Forgot password?”.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingReset(true);
    const { error } = await requestPasswordReset(target);
    setIsSendingReset(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    // Deliberately generic to avoid revealing whether an account exists.
    setSuccessMessage(
      'If an account exists for that email, a password reset link is on its way.'
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}
        className="max-w-md mx-auto w-full">
          {/* Header Branding */}
          <View className="items-center mb-8">
            <View className="rounded-2xl bg-primary/10 items-center justify-center border border-primary/20 h-16 w-16 mb-4">
              <Icon as={ShieldCheck} className="text-primary" size={32} />
            </View>
            <Text variant="h2" className="text-center font-bold">
              Expense Tracker
            </Text>
            <Text variant="muted" className="text-center mt-1">
              Private financial vault for every account
            </Text>
          </View>

          {/* Login / Register Card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">
                {isSignUp ? 'Create Your Account' : 'Account Login'}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? 'Your expenses, accounts, budgets and PIN stay private to you'
                  : 'Enter your account credentials to access your data'}
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              {/* Mode Switch */}
              <View className="flex-row bg-muted p-1 rounded-xl">
                <Pressable
                  onPress={() => switchMode('signin')}
                  disabled={isBusy}
                  className={`flex-1 items-center justify-center py-2 rounded-lg ${
                    !isSignUp ? 'bg-card border border-border' : ''
                  }`}>
                  <Text
                    className={`text-xs font-semibold ${
                      !isSignUp ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchMode('signup')}
                  disabled={isBusy}
                  className={`flex-1 items-center justify-center py-2 rounded-lg ${
                    isSignUp ? 'bg-card border border-border' : ''
                  }`}>
                  <Text
                    className={`text-xs font-semibold ${
                      isSignUp ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                    Create Account
                  </Text>
                </Pressable>
              </View>

              {isSignUp && (
                <View className="gap-1.5">
                  <Text variant="small">Full Name</Text>
                  <View className="flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 border-input">
                    <Icon as={User} className="text-muted-foreground mr-2.5" size={18} />
                    <Input
                      placeholder="Your full name"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      textContentType="name"
                      autoComplete="name"
                      editable={!isBusy}
                      className="flex-1 border-0 h-10 px-0 shadow-none bg-transparent dark:bg-transparent text-foreground"
                    />
                  </View>
                </View>
              )}

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
                    onFocus={() => setIsEmailFocused(true)}
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
                    textContentType={isSignUp ? 'newPassword' : 'password'}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    editable={!isBusy}
                    onFocus={() => setIsPasswordFocused(true)}
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

              {!isSignUp && (
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={isBusy || isSendingReset}
                  className="self-end -mt-1 px-1 py-1"
                  accessibilityRole="button">
                  <Text className="text-[11px] font-semibold text-primary">
                    {isSendingReset ? 'Sending reset link...' : 'Forgot password?'}
                  </Text>
                </Pressable>
              )}

              {isSignUp && (
                <View className="gap-1.5">
                  <Text variant="small">Confirm Password</Text>
                  <View
                    className={`flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 ${
                      isConfirmPasswordFocused ? 'border-primary' : 'border-input'
                    }`}>
                    <Icon as={Lock} className="text-muted-foreground mr-2.5" size={18} />
                    <Input
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      textContentType="newPassword"
                      autoComplete="new-password"
                      editable={!isBusy}
                      onFocus={() => setIsConfirmPasswordFocused(true)}
                      onBlur={() => setIsConfirmPasswordFocused(false)}
                      className="flex-1 border-0 h-10 px-0 shadow-none bg-transparent dark:bg-transparent text-foreground"
                    />
                  </View>
                </View>
              )}

              {errorMessage && (
                <View className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <Text className="text-xs text-destructive font-medium text-center">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {successMessage && (
                <View className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <Text className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                    {successMessage}
                  </Text>
                </View>
              )}

              {!isSignUp && confirmationEmail && (
                <View className="gap-1.5">
                  <Text variant="muted" className="text-[11px] text-center">
                    Didn&apos;t get the email for {confirmationEmail}?
                  </Text>
                  <Button
                    variant="outline"
                    onPress={handleResendConfirmation}
                    disabled={isBusy || isResending || resendCooldown > 0}
                    className="w-full">
                    {isResending ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text className="text-xs font-semibold">
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend confirmation email'}
                      </Text>
                    )}
                  </Button>
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
                      {isSignUp ? 'Creating account...' : 'Signing in...'}
                    </Text>
                  </>
                ) : (
                  <Text className="font-semibold text-primary-foreground">
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Button>

              <Text variant="muted" className="text-[11px] text-center leading-4">
                Every account has its own private expenses, accounts, budgets and
                5-digit PIN. Your data is never shared with other users.
              </Text>
            </CardContent>
          </Card>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
