import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Supabase client configuration.
 *
 * Credentials are loaded from .env → app.config.ts → Constants.expoConfig.extra.
 *
 * The anon key is PUBLIC by design (like a Firebase API key).
 * Security relies on Row Level Security (RLS) policies in Supabase.
 * The service_role key must NEVER appear in client code.
 */
const supabaseUrl: string =
  Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey: string =
  Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} else {
  console.warn(
    '[Supabase] Missing or invalid credentials. Backend is disabled.',
    '\nEnsure .env has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    '\nThen restart with: npx expo start --clear',
  );

  // No-op fetch prevents network error spam in dev
  const noopFetch = async () =>
    new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });

  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: noopFetch as unknown as typeof fetch,
      },
    },
  );
}

export { supabase };
export default supabase;
