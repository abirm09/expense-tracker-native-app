import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as React from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  getAuthRedirectUri,
  isAuthCallbackUrl,
  parseAuthCallbackUrl,
} from '@/lib/auth-redirect';
import { SecureStorage } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';
import { store } from '@/store';
import { apiSlice } from '@/store/api/api-slice';
import { clearAuthSession, setAuthSession } from '@/store/slices/auth-slice';
import { Database, Profile } from '@/types/database.types';

// Every account gets its own PIN so switching users on the same device cannot
// unlock another person's vault. The old single-user keys are removed on switch.
const PIN_STORAGE_PREFIX = 'user_app_pin_v2_';
const PIN_ENABLED_PREFIX = 'user_app_pin_enabled_v2_';
const LEGACY_PIN_STORAGE_KEY = 'user_app_pin_v1';
const LEGACY_PIN_ENABLED_KEY = 'user_app_pin_enabled_v1';

// Set while a password-recovery email has been requested but the user has not
// finished choosing a new password yet.
const PASSWORD_RECOVERY_PENDING_KEY = 'auth_password_recovery_pending';

const getPinStorageKey = (userId: string) => `${PIN_STORAGE_PREFIX}${userId}`;
const getPinEnabledKey = (userId: string) => `${PIN_ENABLED_PREFIX}${userId}`;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isPinChecking: boolean;
  isAuthenticating: boolean;
  isLocked: boolean;
  hasPin: boolean;
  isPasswordRecovery: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: Error | null; requiresEmailConfirmation?: boolean }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  completePasswordReset: (newPassword: string) => Promise<{ error: Error | null }>;
  cancelPasswordRecovery: () => Promise<void>;
  signOut: () => Promise<void>;
  setAppPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAppPin: (pin: string) => Promise<boolean>;
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  disableAppPin: (currentPin: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPinChecking, setIsPinChecking] = React.useState(false);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [hasPin, setHasPin] = React.useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = React.useState(false);
  const lastUserIdRef = React.useRef<string | null>(null);
  const handledAuthUrlRef = React.useRef<string | null>(null);

  // Wipe every in-memory cache that could contain the previous account's data.
  // Per-user PIN keys are intentionally kept so each user can unlock their own
  // vault after signing back in; only the legacy global PIN is destroyed.
  const clearPrivateCaches = React.useCallback(async () => {
    store.dispatch(apiSlice.util.resetApiState());
    store.dispatch(clearAuthSession());
    await SecureStorage.deleteItem(LEGACY_PIN_STORAGE_KEY);
    await SecureStorage.deleteItem(LEGACY_PIN_ENABLED_KEY);
  }, []);

  /**
   * Complete a Supabase auth redirect coming from a confirmation / recovery
   * email. Supports all link shapes GoTrue can produce:
   *  - PKCE:           ?code=...
   *  - custom template: ?token_hash=...&type=signup|recovery
   *  - implicit:       #access_token=...&refresh_token=...
   */
  const handleAuthCallback = React.useCallback(async (url: string) => {
    if (!url || !isAuthCallbackUrl(url)) {
      return;
    }
    if (handledAuthUrlRef.current === url) {
      return;
    }
    handledAuthUrlRef.current = url;

    const parsed = parseAuthCallbackUrl(url);

    if (parsed.error) {
      console.warn(
        'Auth redirect error:',
        parsed.errorDescription || parsed.error
      );
      return;
    }

    const isRecoveryLink =
      parsed.type === 'recovery';
    if (isRecoveryLink) {
      setIsPasswordRecovery(true);
      await SecureStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, 'true');
    }

    try {
      if (parsed.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (error) {
          console.warn('Auth code exchange failed:', error.message);
          return;
        }
      } else if (parsed.tokenHash && parsed.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: parsed.tokenHash,
          type: parsed.type as EmailOtpType,
        });
        if (error) {
          console.warn('Auth token verification failed:', error.message);
          return;
        }
      } else if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) {
          console.warn('Auth session restore failed:', error.message);
          return;
        }
      }

      // PKCE recovery links may not carry `type`, so also honour the flag we
      // persisted when the reset email was requested.
      if (!isRecoveryLink) {
        const pendingRecovery = await SecureStorage.getItem(
          PASSWORD_RECOVERY_PENDING_KEY
        );
        if (pendingRecovery === 'true') {
          setIsPasswordRecovery(true);
        }
      }
    } catch (err) {
      console.warn('Auth redirect handling failed:', err);
    }
  }, []);

  // Listen for auth redirects both when the app is already running and when it
  // is cold-started by tapping a confirmation / recovery link.
  React.useEffect(() => {
    let isActive = true;

    Linking.getInitialURL()
      .then((url) => {
        if (isActive && url) {
          void handleAuthCallback(url);
        }
      })
      .catch(() => {
        // Ignore — no initial URL is normal on a cold manual launch.
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthCallback(url);
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [handleAuthCallback]);

  // Load profile from Supabase and verify PIN security
  const loadProfile = React.useCallback(async (userId: string, shouldLockIfPin = true) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile table read error (permission denied or table ungranted):', error.message);
        
        // Attempt RPC fallback (SECURITY DEFINER bypasses table-level permissions)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_profile');
          if (!rpcError && rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
            const profileData = rpcData as unknown as Profile;
            setProfile(profileData);
            const serverHasPin = profileData.has_pin && profileData.pin_enabled;
            const localPin = await SecureStorage.getItem(getPinStorageKey(userId));
            const pinActive = Boolean(serverHasPin || localPin);
            setHasPin(pinActive);
            if (pinActive) {
              if (shouldLockIfPin) {
                setIsLocked(true);
              }
            } else {
              setIsLocked(false);
            }
            return;
          }
        } catch {
          // ignore RPC error and continue to local fallback
        }

        // Resilient fallback: Construct profile from authenticated user session & SecureStore
        const { data: userData } = await supabase.auth.getUser();
        const userEmail = userData.user?.email ?? '';
        const fallbackName =
          (userData.user?.user_metadata?.full_name as string) ||
          userEmail.split('@')[0] ||
          'User';
        const localPin = await SecureStorage.getItem(getPinStorageKey(userId));
        const pinActive = Boolean(localPin);

        setProfile({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          avatar_url: null,
          currency: 'BDT',
          has_pin: pinActive,
          pin_hash: null,
          pin_enabled: pinActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setHasPin(pinActive);
        if (pinActive) {
          if (shouldLockIfPin) {
            setIsLocked(true);
          }
        } else {
          setIsLocked(false);
        }
        return;
      }

      if (data) {
        const profileData = data as unknown as Profile;
        setProfile(profileData);
        const serverHasPin = profileData.has_pin && profileData.pin_enabled;
        const localPin = await SecureStorage.getItem(getPinStorageKey(userId));
        const pinActive = Boolean(serverHasPin || localPin);
        setHasPin(pinActive);
        if (pinActive) {
          if (shouldLockIfPin) {
            setIsLocked(true);
          }
        } else {
          setIsLocked(false);
        }
        return;
      }

      // No profile found: Auto-create profile for this user
      console.log('No profile found in database for user, creating one now...');
      
      // Step A: Try RPC ensure_user_profile
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_profile');
        if (!rpcError && rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
          const profileData = rpcData as unknown as Profile;
          setProfile(profileData);
          const serverHasPin = profileData.has_pin && profileData.pin_enabled;
          const localPin = await SecureStorage.getItem(getPinStorageKey(userId));
          const pinActive = Boolean(serverHasPin || localPin);
          setHasPin(pinActive);
          if (pinActive) {
            if (shouldLockIfPin) {
              setIsLocked(true);
            }
          } else {
            setIsLocked(false);
          }
          return;
        }
      } catch (rpcEx) {
        console.warn('RPC ensure_user_profile not available, falling back to direct insert', rpcEx);
      }

      // Step B: Direct insert fallback
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email ?? '';
      const fallbackName =
        (userData.user?.user_metadata?.full_name as string) ||
        userEmail.split('@')[0] ||
        'User';

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          has_pin: false,
          pin_enabled: false,
        } as Database['public']['Tables']['profiles']['Insert'])
        .select('*')
        .maybeSingle();

      if (!insertError && inserted) {
        const profileData = inserted as unknown as Profile;
        setProfile(profileData);
        setHasPin(false);
        setIsLocked(false);
      } else {
        console.warn('Could not persist profile in database:', insertError?.message);
        // Step C: In-memory fallback profile so the app works seamlessly
        setProfile({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          avatar_url: null,
          currency: 'BDT',
          has_pin: false,
          pin_hash: null,
          pin_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setHasPin(false);
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('Profile loading error:', e);
    }
  }, []);

  // Initialize auth state
  React.useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (lastUserIdRef.current && lastUserIdRef.current !== session.user.id) {
            await clearPrivateCaches();
          }
          lastUserIdRef.current = session.user.id;
          setIsPinChecking(true);
          await loadProfile(session.user.id, true);
        } else {
          lastUserIdRef.current = null;
          setProfile(null);
          setHasPin(false);
          setIsLocked(false);
        }
      } catch (err) {
        console.warn('Init auth session error:', err);
      } finally {
        if (isMounted) {
          setIsPinChecking(false);
          setIsLoading(false);
        }
      }
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        lastUserIdRef.current = null;
        await clearPrivateCaches();
        await SecureStorage.deleteItem(PASSWORD_RECOVERY_PENDING_KEY);
        setSession(null);
        setUser(null);
        setProfile(null);
        setHasPin(false);
        setIsLocked(false);
        setIsPinChecking(false);
        setIsPasswordRecovery(false);
        setIsLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          lastUserIdRef.current = newSession.user.id;
          setIsPinChecking(true);
          await loadProfile(newSession.user.id, true);
          if (isMounted) {
            setIsPinChecking(false);
          }
        }
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        const nextUser = newSession?.user ?? null;

        // Account switch: clear previous user's cached profile, expenses,
        // accounts, categories, budgets and contacts before loading the new one.
        if (nextUser && lastUserIdRef.current && lastUserIdRef.current !== nextUser.id) {
          await clearPrivateCaches();
          setProfile(null);
          setHasPin(false);
          setIsLocked(false);
        }
        if (nextUser) {
          lastUserIdRef.current = nextUser.id;
        }

        setSession(newSession);
        setUser(nextUser);
        if (nextUser) {
          setIsPinChecking(true);
          await loadProfile(nextUser.id, true);
          if (isMounted) {
            setIsPinChecking(false);
          }
        }
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, clearPrivateCaches]);

  // Sync auth state to Redux
  React.useEffect(() => {
    store.dispatch(
      setAuthSession({
        userId: user?.id ?? null,
        email: user?.email ?? null,
        profile,
        hasPin,
        isLocked,
        isPinChecking,
      })
    );
  }, [user, profile, hasPin, isLocked, isPinChecking]);

  // Listen to AppState to auto-lock when moving to background
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        if (hasPin) {
          setIsLocked(true);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [hasPin]);

  // 1. First Password: Login with Email & Password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsAuthenticating(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsAuthenticating(false);
        return { error };
      }

      if (data.user) {
        // Account switch on the same device must never reuse the previous
        // user's cached profile or API data.
        if (lastUserIdRef.current && lastUserIdRef.current !== data.user.id) {
          await clearPrivateCaches();
          setProfile(null);
          setHasPin(false);
          setIsLocked(false);
        }
        lastUserIdRef.current = data.user.id;

        // Main account authentication passed!
        setUser(data.user);
        setSession(data.session);
        setIsPinChecking(true);
        setIsAuthenticating(false);
        await loadProfile(data.user.id, true);
        setIsPinChecking(false);
      } else {
        setIsAuthenticating(false);
      }

      return { error: null };
    } catch (err: any) {
      setIsAuthenticating(false);
      setIsPinChecking(false);
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  // Register with Email & Password
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    try {
      setIsAuthenticating(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          // Where the confirmation email should send the user back to. This
          // URL must be allow-listed in Supabase → Auth → URL Configuration.
          emailRedirectTo: getAuthRedirectUri(),
        },
      });

      if (error) {
        setIsAuthenticating(false);
        return { error };
      }

      // Supabase returns a user with an empty identities array when the email
      // is already registered. Treat that as a normal sign-up conflict instead
      // of silently signing the visitor into an existing account.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setIsAuthenticating(false);
        return {
          error: new Error(
            'An account with this email already exists. Please sign in instead.'
          ),
        };
      }

      // Email confirmation enabled: account created, but there is no session
      // yet. Do not mark the visitor as signed in until they confirm + log in.
      if (data.user && !data.session) {
        setIsAuthenticating(false);
        return { error: null, requiresEmailConfirmation: true };
      }

      if (data.user && data.session) {
        lastUserIdRef.current = data.user.id;
        setUser(data.user);
        setSession(data.session);
        setIsPinChecking(true);
        setIsAuthenticating(false);
        await loadProfile(data.user.id, true);
        setIsPinChecking(false);
      } else {
        setIsAuthenticating(false);
      }

      return { error: null };
    } catch (err: any) {
      setIsAuthenticating(false);
      setIsPinChecking(false);
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  // Resend the signup confirmation email (expired or never delivered).
  const resendConfirmationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getAuthRedirectUri() },
      });
      return { error: error ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  // Send a password recovery email. The link returns to the app, where the
  // user chooses a new password; passwords are never sent by email.
  const requestPasswordReset = async (email: string) => {
    const redirectTo = getAuthRedirectUri();

    // Print the exact URL during development. If the email still points to the
    // Supabase Site URL instead of this value, the redirect is not allow-listed
    // (or the email template uses {{ .SiteURL }} instead of .ConfirmationURL).
    if (__DEV__) {
      console.log('[auth] password reset redirectTo:', redirectTo);
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (!error) {
        await SecureStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, 'true');
      }
      return { error: error ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  // Save the new password after the recovery deep link has signed the user in.
  const completePasswordReset = async (newPassword: string) => {
    if (newPassword.length < 6) {
      return { error: new Error('Password must be at least 6 characters long.') };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { error };
      }

      await SecureStorage.deleteItem(PASSWORD_RECOVERY_PENDING_KEY);
      setIsPasswordRecovery(false);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  // Logout
  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      lastUserIdRef.current = null;
      await clearPrivateCaches();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLocked(false);
      setHasPin(false);
      setIsPinChecking(false);
      setIsPasswordRecovery(false);
      setIsLoading(false);
    }
  };

  // Abandon a password reset and return to the sign-in screen.
  const cancelPasswordRecovery = async () => {
    await SecureStorage.deleteItem(PASSWORD_RECOVERY_PENDING_KEY);
    setIsPasswordRecovery(false);
    await signOut();
  };

  // 2. Second Password: 5-digit PIN Management

  // Set or update 5-digit PIN
  const setAppPin = async (pin: string) => {
    if (!/^[0-9]{5}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 5 digits.' };
    }

    if (!user) {
      return { success: false, error: 'You must be signed in to set a PIN.' };
    }

    // Save locally under this user's own key so another account on the same
    // device can never inherit or unlock this vault.
    await SecureStorage.setItem(getPinStorageKey(user.id), pin);
    await SecureStorage.setItem(getPinEnabledKey(user.id), 'true');

    // Sync to Supabase profile via secure RPC
    const { data, error } = await (supabase.rpc as any)('set_user_pin', { pin_input: pin });
    if (error) {
      console.warn('Backend PIN sync warning:', error.message);
    } else if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
      return { success: false, error: (data as { error?: string }).error || 'Failed to set PIN.' };
    }

    setHasPin(true);
    setIsLocked(false);
    setProfile((prev) => (prev ? { ...prev, has_pin: true, pin_enabled: true } : prev));
    return { success: true };
  };

  // Verify PIN
  const verifyAppPin = async (pin: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    // 1. Check this user's own local secure store entry
    const localPin = await SecureStorage.getItem(getPinStorageKey(user.id));
    if (localPin) {
      return localPin === pin;
    }

    // 2. If not found locally, verify via the Supabase backend
    const { data, error } = await (supabase.rpc as any)('verify_user_pin', { pin_input: pin });
    if (!error && data && typeof data === 'object' && 'success' in data) {
      const isMatch = Boolean((data as { success: boolean }).success);
      if (isMatch) {
        // Cache verified PIN locally for this user only
        await SecureStorage.setItem(getPinStorageKey(user.id), pin);
        await SecureStorage.setItem(getPinEnabledKey(user.id), 'true');
      }
      return isMatch;
    }

    return false;
  };

  // Unlock app with 5-digit PIN
  const unlockApp = async (pin: string): Promise<boolean> => {
    const isValid = await verifyAppPin(pin);
    if (isValid) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  // Lock app manually
  const lockApp = () => {
    if (hasPin) {
      setIsLocked(true);
    }
  };

  // Disable/Remove 5-digit PIN
  const disableAppPin = async (currentPin: string) => {
    const isValid = await verifyAppPin(currentPin);
    if (!isValid) {
      return { success: false, error: 'Current PIN is incorrect.' };
    }

    if (user) {
      await SecureStorage.deleteItem(getPinStorageKey(user.id));
      await SecureStorage.deleteItem(getPinEnabledKey(user.id));
      await (supabase.rpc as any)('disable_user_pin', { current_pin: currentPin });
    }

    setHasPin(false);
    setIsLocked(false);
    return { success: true };
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id, false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isPinChecking,
        isAuthenticating,
        isLocked,
        hasPin,
        isPasswordRecovery,
        signInWithEmail,
        signUpWithEmail,
        resendConfirmationEmail,
        requestPasswordReset,
        completePasswordReset,
        cancelPasswordRecovery,
        signOut,
        setAppPin,
        verifyAppPin,
        unlockApp,
        lockApp,
        disableAppPin,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
