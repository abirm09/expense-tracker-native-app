import { Session, User } from '@supabase/supabase-js';
import * as React from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { SecureStorage } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';
import { store } from '@/store';
import { setAuthSession } from '@/store/slices/auth-slice';
import { Database, Profile } from '@/types/database.types';

const PIN_STORAGE_KEY = 'user_app_pin_v1';
const PIN_ENABLED_KEY = 'user_app_pin_enabled_v1';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isLocked: boolean;
  hasPin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
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
  const [isLocked, setIsLocked] = React.useState(false);
  const [hasPin, setHasPin] = React.useState(false);

  // Load profile from Supabase
  const loadProfile = React.useCallback(async (userId: string) => {
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
            const localPin = await SecureStorage.getItem(PIN_STORAGE_KEY);
            const pinActive = Boolean(serverHasPin || localPin);
            setHasPin(pinActive);
            if (pinActive) {
              setIsLocked(true);
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
        const localPin = await SecureStorage.getItem(PIN_STORAGE_KEY);
        const pinActive = Boolean(localPin);

        setProfile({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          avatar_url: null,
          has_pin: pinActive,
          pin_hash: null,
          pin_enabled: pinActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setHasPin(pinActive);
        if (pinActive) {
          setIsLocked(true);
        }
        return;
      }

      if (data) {
        const profileData = data as unknown as Profile;
        setProfile(profileData);
        const serverHasPin = profileData.has_pin && profileData.pin_enabled;
        const localPin = await SecureStorage.getItem(PIN_STORAGE_KEY);
        const pinActive = Boolean(serverHasPin || localPin);
        setHasPin(pinActive);
        if (pinActive) {
          setIsLocked(true);
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
          setHasPin(Boolean(profileData.has_pin && profileData.pin_enabled));
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
      } else {
        console.warn('Could not persist profile in database:', insertError?.message);
        // Step C: In-memory fallback profile so the app works seamlessly
        setProfile({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          avatar_url: null,
          has_pin: false,
          pin_hash: null,
          pin_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setHasPin(false);
      }
    } catch (e) {
      console.warn('Profile loading error:', e);
    }
  }, []);

  // Initialize auth state
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setHasPin(false);
        setIsLocked(false);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Sync auth state to Redux
  React.useEffect(() => {
    store.dispatch(
      setAuthSession({
        userId: user?.id ?? null,
        email: user?.email ?? null,
        profile,
        hasPin,
        isLocked,
      })
    );
  }, [user, profile, hasPin, isLocked]);

  // Listen to AppState to auto-lock when moving to background
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
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
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    if (!error && data.user) {
      await loadProfile(data.user.id);
    }
    return { error };
  };

  // Register with Email & Password
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    setIsLoading(false);
    if (!error && data.user) {
      await loadProfile(data.user.id);
    }
    return { error };
  };

  // Logout
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsLocked(false);
    setHasPin(false);
  };

  // 2. Second Password: 5-digit PIN Management

  // Set or update 5-digit PIN
  const setAppPin = async (pin: string) => {
    if (!/^[0-9]{5}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 5 digits.' };
    }

    // Save locally to SecureStore for instant access
    await SecureStorage.setItem(PIN_STORAGE_KEY, pin);
    await SecureStorage.setItem(PIN_ENABLED_KEY, 'true');

    // Sync to Supabase profile via secure RPC if authenticated
    if (user) {
      const { data, error } = await (supabase.rpc as any)('set_user_pin', { pin_input: pin });
      if (error) {
        console.warn('Backend PIN sync warning:', error.message);
      } else if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
        return { success: false, error: (data as { error?: string }).error || 'Failed to set PIN.' };
      }
    }

    setHasPin(true);
    setIsLocked(false);
    setProfile((prev) => (prev ? { ...prev, has_pin: true, pin_enabled: true } : prev));
    return { success: true };
  };

  // Verify PIN
  const verifyAppPin = async (pin: string): Promise<boolean> => {
    // 1. Check local secure store
    const localPin = await SecureStorage.getItem(PIN_STORAGE_KEY);
    if (localPin) {
      return localPin === pin;
    }

    // 2. If not found locally, verify via Supabase backend
    if (user) {
      const { data, error } = await (supabase.rpc as any)('verify_user_pin', { pin_input: pin });
      if (!error && data && typeof data === 'object' && 'success' in data) {
        const isMatch = Boolean((data as { success: boolean }).success);
        if (isMatch) {
          // Cache verified PIN locally
          await SecureStorage.setItem(PIN_STORAGE_KEY, pin);
          await SecureStorage.setItem(PIN_ENABLED_KEY, 'true');
        }
        return isMatch;
      }
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

    await SecureStorage.deleteItem(PIN_STORAGE_KEY);
    await SecureStorage.deleteItem(PIN_ENABLED_KEY);

    if (user) {
      await (supabase.rpc as any)('disable_user_pin', { current_pin: currentPin });
    }

    setHasPin(false);
    setIsLocked(false);
    return { success: true };
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isLocked,
        hasPin,
        signInWithEmail,
        signUpWithEmail,
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
