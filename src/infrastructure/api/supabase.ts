import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Variables d'environnement Supabase.
 *
 * Expo expose les variables préfixées EXPO_PUBLIC_ via process.env.
 * Elles sont lues depuis le fichier .env à la racine du projet.
 *
 * 🟢 La clé anon est PUBLIQUE par design (comme une clé API Firebase).
 *    La sécurité repose sur le Row Level Security (RLS) côté Supabase,
 *    pas sur le secret de cette clé.
 *
 * 🔴 La service_role key ne doit JAMAIS apparaître côté client.
 *    Elle est réservée aux Edge Functions / backend.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
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
    '[Supabase] Variables manquantes. Créez un fichier .env avec :',
    'EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...',
  );
  // Client placeholder — l'app démarre sans backend
  supabase = createClient('https://placeholder.supabase.co', 'placeholder', {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };
export default supabase;
