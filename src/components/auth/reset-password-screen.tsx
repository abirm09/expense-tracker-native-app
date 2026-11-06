import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react-native';
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

/**
 * Shown after the user taps a password-recovery link. The deep link handler has
 * already exchanged the recovery token for a session, so all that remains is
 * choosing a new password.
 */
export function ResetPasswordScreen() {
  const { completePasswordReset, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await completePasswordReset(password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
    }
    // On success the provider clears `isPasswordRecovery`, which unmounts this
    // screen and opens the vault with the user already signed in.
  };

  const handleCancel = async () => {
    setIsSubmitting(true);
    await cancelPasswordRecovery();
    setIsSubmitting(false);
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
          <View className="items-center mb-8">
            <View className="rounded-2xl bg-primary/10 items-center justify-center border border-primary/20 h-16 w-16 mb-4">
              <Icon as={ShieldCheck} className="text-primary" size={32} />
            </View>
            <Text variant="h2" className="text-center font-bold">
              Set a New Password
            </Text>
            <Text variant="muted" className="text-center mt-1">
              Choose a new password for your account
            </Text>
          </View>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">New Password</CardTitle>
              <CardDescription>
                Use at least 6 characters. You will stay signed in after saving.
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              <View className="gap-1.5">
                <Text variant="small">New Password</Text>
                <View className="flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 border-input">
                  <Icon as={Lock} className="text-muted-foreground mr-2.5" size={18} />
                  <Input
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    editable={!isSubmitting}
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

              <View className="gap-1.5">
                <Text variant="small">Confirm New Password</Text>
                <View className="flex-row items-center border rounded-md px-3 bg-background dark:bg-input/30 border-input">
                  <Icon as={Lock} className="text-muted-foreground mr-2.5" size={18} />
                  <Input
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    editable={!isSubmitting}
                    className="flex-1 border-0 h-10 px-0 shadow-none bg-transparent dark:bg-transparent text-foreground"
                  />
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
                disabled={isSubmitting}
                className="w-full mt-2 flex-row items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" />
                    <Text className="font-semibold text-primary-foreground">Saving...</Text>
                  </>
                ) : (
                  <Text className="font-semibold text-primary-foreground">Save New Password</Text>
                )}
              </Button>

              <Button
                variant="ghost"
                onPress={handleCancel}
                disabled={isSubmitting}
                className="w-full">
                <Text className="text-xs font-semibold text-muted-foreground">
                  Back to sign in
                </Text>
              </Button>
            </CardContent>
          </Card>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
