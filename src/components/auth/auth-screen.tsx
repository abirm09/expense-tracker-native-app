import { Lock, Mail, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
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
  const { signInWithEmail, isLoading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerClassName="p-6 justify-center flex-grow max-w-md mx-auto w-full"
          keyboardShouldPersistTaps="handled">
          {/* Header Branding */}
          <View className="items-center mb-8">
            <View className="h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center mb-4 border border-primary/20">
              <Icon as={ShieldCheck} className="text-primary" size={32} />
            </View>
            <Text variant="h2" className="text-center font-bold">
              Expense Tracker
            </Text>
            <Text variant="muted" className="text-center mt-1">
              Personal Financial Vault
            </Text>
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
                <View className="flex-row items-center border border-input rounded-md px-3 bg-background">
                  <Icon as={Mail} className="text-muted-foreground mr-2" size={18} />
                  <Input
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 border-0 h-10 px-0 shadow-none"
                  />
                </View>
              </View>

              <View className="gap-1.5">
                <Text variant="small">Password</Text>
                <View className="flex-row items-center border border-input rounded-md px-3 bg-background">
                  <Icon as={Lock} className="text-muted-foreground mr-2" size={18} />
                  <Input
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    className="flex-1 border-0 h-10 px-0 shadow-none"
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
                disabled={isLoading}
                className="w-full mt-2">
                <Text className="font-semibold text-primary-foreground">
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
