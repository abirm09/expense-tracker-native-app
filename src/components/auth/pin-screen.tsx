import { Check, Delete, Lock, LogOut } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

interface PinScreenProps {
  title?: string;
  subtitle?: string;
  stepIndicator?: string;
  doneButtonText?: string;
  showDoneButton?: boolean;
  autoSubmit?: boolean;
  onSuccess: (pin: string) => void | Promise<void>;
  onForgotPin?: () => void;
  allowCancel?: boolean;
  onCancel?: () => void;
  isVerifying?: boolean;
}

export function PinScreen({
  title = 'Security PIN',
  subtitle = 'Enter your 5-digit PIN to open the app',
  stepIndicator,
  doneButtonText = 'Done',
  showDoneButton = true,
  autoSubmit = true,
  onSuccess,
  onForgotPin,
  allowCancel = false,
  onCancel,
  isVerifying = false,
}: PinScreenProps) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleComplete = React.useCallback(async (completedPin: string) => {
    if (completedPin.length !== 5 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSuccess(completedPin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid PIN');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  }, [onSuccess, isSubmitting]);

  const handleKeyPress = (num: string) => {
    if (isSubmitting || isVerifying) return;
    if (pin.length < 5) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 5 && autoSubmit) {
        // Short delay so the 5th dot renders visibly before submission
        setTimeout(() => {
          handleComplete(nextPin);
        }, 100);
      }
    }
  };

  const handleDelete = () => {
    if (isSubmitting || isVerifying) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const isBusy = isVerifying || isSubmitting;
  const isPinComplete = pin.length === 5;

  return (
    <SafeAreaView className="flex-1 bg-background justify-between p-6">
      {/* Top Header */}
      <View className="items-center pt-6">
        {stepIndicator && (
          <Badge variant="secondary" className="mb-3 px-3 py-1">
            <Text className="text-xs font-semibold text-primary">{stepIndicator}</Text>
          </Badge>
        )}

        <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Icon as={Lock} className="text-primary" size={32} />
        </View>

        <Text variant="h3" className="text-center font-bold">
          {title}
        </Text>
        <Text variant="muted" className="text-center mt-2 px-6">
          {subtitle}
        </Text>

        {/* 5 PIN Dots */}
        <View className="flex-row items-center justify-center gap-4 mt-8">
          {[0, 1, 2, 3, 4].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={`pin-dot-${index}`}
                className="h-4 w-4 rounded-full border-2 border-primary/30 items-center justify-center p-0.5">
                <View
                  className="h-full w-full rounded-full bg-primary"
                  style={{ opacity: isFilled ? 1 : 0 }}
                />
              </View>
            );
          })}
        </View>

        {/* Loading indicator when verifying PIN */}
        {isBusy && (
          <View className="flex-row items-center justify-center gap-2 mt-4">
            <ActivityIndicator size="small" />
            <Text variant="small" className="text-muted-foreground font-medium">
              Verifying PIN...
            </Text>
          </View>
        )}

        {/* Error message */}
        {error && (
          <Text className="text-destructive text-sm text-center mt-4 font-medium px-4">
            {error}
          </Text>
        )}
      </View>

      {/* 3x4 Numeric Keypad */}
      <View className="w-full max-w-xs mx-auto pb-4">
        <View className="gap-3">
          {/* Row 1 */}
          <View className="flex-row justify-between">
            {['1', '2', '3'].map((num) => (
              <KeypadButton
                key={num}
                value={num}
                onPress={() => handleKeyPress(num)}
                disabled={isBusy}
              />
            ))}
          </View>

          {/* Row 2 */}
          <View className="flex-row justify-between">
            {['4', '5', '6'].map((num) => (
              <KeypadButton
                key={num}
                value={num}
                onPress={() => handleKeyPress(num)}
                disabled={isBusy}
              />
            ))}
          </View>

          {/* Row 3 */}
          <View className="flex-row justify-between">
            {['7', '8', '9'].map((num) => (
              <KeypadButton
                key={num}
                value={num}
                onPress={() => handleKeyPress(num)}
                disabled={isBusy}
              />
            ))}
          </View>

          {/* Row 4: Cancel, 0, Backspace */}
          <View className="flex-row justify-between items-center">
            {allowCancel ? (
              <Pressable
                onPress={onCancel}
                disabled={isBusy}
                className="h-16 w-16 rounded-full items-center justify-center active:bg-muted">
                <Text variant="small" className="text-muted-foreground font-medium">
                  Cancel
                </Text>
              </Pressable>
            ) : (
              <View className="h-16 w-16" />
            )}

            <KeypadButton
              value="0"
              onPress={() => handleKeyPress('0')}
              disabled={isBusy}
            />

            <Pressable
              onPress={handleDelete}
              disabled={isBusy || pin.length === 0}
              className="h-16 w-16 rounded-full items-center justify-center active:bg-muted">
              <Icon
                as={Delete}
                className="text-foreground"
                style={{ opacity: pin.length > 0 ? 1 : 0.3 }}
                size={24}
              />
            </Pressable>
          </View>
        </View>

        {/* Done / Confirm Button */}
        {showDoneButton && (
          <View className="mt-4">
            <Button
              size="lg"
              disabled={!isPinComplete || isBusy}
              onPress={() => handleComplete(pin)}
              className="w-full flex-row items-center justify-center gap-2">
              {isBusy ? (
                <ActivityIndicator size="small" />
              ) : (
                <>
                  <Icon as={Check} className="text-primary-foreground" size={18} />
                  <Text className="font-semibold text-primary-foreground">
                    {doneButtonText}
                  </Text>
                </>
              )}
            </Button>
          </View>
        )}

        {/* Footer Actions */}
        {onForgotPin && (
          <View className="mt-4 items-center">
            <Button
              variant="ghost"
              onPress={onForgotPin}
              disabled={isBusy}
              className="flex-row items-center gap-2">
              <Icon as={LogOut} className="text-muted-foreground" size={16} />
              <Text variant="small" className="text-muted-foreground">
                Log in with account password
              </Text>
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function KeypadButton({
  value,
  onPress,
  disabled,
}: {
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-16 w-16 rounded-full bg-secondary/60 active:bg-secondary items-center justify-center border border-border/40">
      <Text className="text-2xl font-semibold text-foreground">{value}</Text>
    </Pressable>
  );
}
