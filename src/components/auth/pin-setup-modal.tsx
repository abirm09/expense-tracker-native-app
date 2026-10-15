import * as React from 'react';
import { Animated, Modal, View } from 'react-native';

import { PinScreen } from '@/components/auth/pin-screen';
import { useAuth } from '@/context/auth-context';

interface PinSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function AnimatedStepContainer({
  children,
  stepKey,
}: {
  children: React.ReactNode;
  stepKey: string;
}) {
  const [fadeAnim] = React.useState(() => new Animated.Value(0));
  const [slideAnim] = React.useState(() => new Animated.Value(20));

  React.useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);

    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [stepKey, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
      }}>
      {children}
    </Animated.View>
  );
}

export function PinSetupModal({ visible, onClose, onSuccess }: PinSetupModalProps) {
  const { setAppPin } = useAuth();
  const [step, setStep] = React.useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = React.useState('');

  const handleClose = () => {
    setStep('create');
    setFirstPin('');
    onClose();
  };

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
  };

  const handleConfirmPin = async (confirmPin: string) => {
    if (confirmPin !== firstPin) {
      throw new Error('PINs do not match. Please re-enter or go back.');
    }

    const res = await setAppPin(confirmPin);
    if (!res.success) {
      throw new Error(res.error || 'Failed to save PIN.');
    }

    setStep('create');
    setFirstPin('');
    onClose();
    onSuccess?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}>
      <View className="flex-1 bg-background">
        {step === 'create' ? (
          <AnimatedStepContainer key="create-container" stepKey="create">
            <PinScreen
              key="pin-create-screen"
              title="Create 5-Digit PIN"
              subtitle="Choose a 5-digit security PIN to quickly unlock your app"
              stepIndicator="Step 1 of 2"
              doneButtonText="Continue"
              onSuccess={handleFirstPin}
              allowCancel
              onCancel={handleClose}
            />
          </AnimatedStepContainer>
        ) : (
          <AnimatedStepContainer key="confirm-container" stepKey="confirm">
            <PinScreen
              key="pin-confirm-screen"
              title="Confirm 5-Digit PIN"
              subtitle="Re-enter your 5-digit PIN to confirm"
              stepIndicator="Step 2 of 2"
              doneButtonText="Confirm & Set PIN"
              onSuccess={handleConfirmPin}
              allowCancel
              onCancel={() => {
                setStep('create');
                setFirstPin('');
              }}
            />
          </AnimatedStepContainer>
        )}
      </View>
    </Modal>
  );
}
