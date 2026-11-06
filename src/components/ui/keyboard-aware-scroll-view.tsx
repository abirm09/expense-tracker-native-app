import * as React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';

type ScrollViewRef = React.ComponentRef<typeof ScrollView>;

interface KeyboardAwareScrollViewContextValue {
  /** Scroll the currently focused text field above the keyboard. */
  scrollToFocusedInput: (additionalOffset?: number) => void;
}

const KeyboardAwareScrollViewContext =
  React.createContext<KeyboardAwareScrollViewContextValue | null>(null);

/**
 * Used by `Input` to bring the focused field above the keyboard automatically.
 * Screens that do not render a `KeyboardAwareScrollView` get `null` and behave
 * exactly as before.
 */
export function useKeyboardAwareScrollView() {
  return React.useContext(KeyboardAwareScrollViewContext);
}

type KeyboardAwareScrollViewProps = React.ComponentProps<typeof ScrollView> & {
  /** Gap to keep between the focused field and the keyboard. Defaults to 24. */
  focusedInputOffset?: number;
  /** Pass the header height when the scroll view sits below a navigation bar. */
  keyboardVerticalOffset?: number;
};

/**
 * ScrollView + KeyboardAvoidingView with one purpose: keep the focused text
 * field visible on both iOS and Android.
 *
 * Expo apps are edge-to-edge on Android, so the window no longer resizes for
 * the keyboard. The `KeyboardAvoidingView` therefore needs an explicit
 * `behavior` on both platforms — without it the content stays behind the
 * keyboard.
 */
export const KeyboardAwareScrollView = React.forwardRef<
  ScrollViewRef,
  KeyboardAwareScrollViewProps
>(function KeyboardAwareScrollView(
  {
    focusedInputOffset = 24,
    keyboardVerticalOffset = 0,
    contentContainerStyle,
    children,
    ...props
  },
  forwardedRef
) {
  const scrollViewRef = React.useRef<ScrollViewRef>(null);

  const setRef = React.useCallback(
    (node: ScrollViewRef | null) => {
      scrollViewRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  const scrollToFocusedInput = React.useCallback(
    (additionalOffset = focusedInputOffset) => {
      const focusedInput = TextInput.State.currentlyFocusedInput();
      if (!focusedInput) return;

      scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        focusedInput,
        additionalOffset,
        true
      );
    },
    [focusedInputOffset]
  );

  const contextValue = React.useMemo(
    () => ({ scrollToFocusedInput }),
    [scrollToFocusedInput]
  );

  // ScrollView tracks the keyboard frame itself, but it does not know which
  // field is focused. Once the keyboard has opened, reveal that field. Focus
  // changes made while the keyboard is already open are handled by `Input`.
  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(showEvent, () => {
      // Let KeyboardAvoidingView apply its padding before measuring.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToFocusedInput());
      });
    });

    return () => subscription.remove();
  }, [scrollToFocusedInput]);

  return (
    <KeyboardAwareScrollViewContext.Provider value={contextValue}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}>
        <ScrollView
          ref={setRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          // iOS already receives the keyboard inset from KeyboardAvoidingView;
          // enabling this too would apply the inset twice.
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={[
            { flexGrow: 1, paddingBottom: 24 },
            contentContainerStyle,
          ]}
          {...props}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardAwareScrollViewContext.Provider>
  );
});
