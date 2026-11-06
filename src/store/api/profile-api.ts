import { supabase } from '@/lib/supabase';
import { apiSlice } from '@/store/api/api-slice';
import { Database, Profile } from '@/types/database.types';

export const profileApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<Profile, void>({
      queryFn: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            return { error: { message: 'Not authenticated' } };
          }

          // First try to fetch existing profile
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (error) {
            // Try RPC fallback with security definer
            try {
              const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_profile');
              if (!rpcError && rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
                return { data: rpcData as unknown as Profile };
              }
            } catch {
              // fallback below
            }

            // Fallback in-memory profile
            const fallbackName =
              (user.user_metadata?.full_name as string) ||
              user.email?.split('@')[0] ||
              'User';

            return {
              data: {
                id: user.id,
                email: user.email ?? null,
                full_name: fallbackName,
                avatar_url: null,
                currency: 'BDT',
                has_pin: false,
                pin_hash: null,
                pin_enabled: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            };
          }

          if (data) {
            return { data: data as unknown as Profile };
          }

          // Profile missing: Auto-create via RPC or insert
          const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_profile');
          if (!rpcError && rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
            return { data: rpcData as unknown as Profile };
          }

          // Direct fallback insert
          const fallbackName =
            (user.user_metadata?.full_name as string) ||
            user.email?.split('@')[0] ||
            'User';

          const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: fallbackName,
              has_pin: false,
              pin_enabled: false,
            } as Database['public']['Tables']['profiles']['Insert'])
            .select('*')
            .single();

          if (insertError) {
            return { error: { message: insertError.message } };
          }

          return { data: created as unknown as Profile };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch or create profile';
          return { error: { message } };
        }
      },
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<Profile, Partial<Profile>>({
      queryFn: async (updates) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            return { error: { message: 'Not authenticated' } };
          }

          const { data, error } = await supabase
            .from('profiles')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            } as Database['public']['Tables']['profiles']['Update'])
            .eq('id', user.id)
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as unknown as Profile };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update profile';
          return { error: { message } };
        }
      },
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
