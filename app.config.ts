import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo configuration.
 *
 * Loads environment variables from .env via dotenv,
 * then injects them into `extra` so they're accessible
 * at runtime via Constants.expoConfig.extra.
 *
 * This replaces the static app.json for config purposes.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Je Le Veux',
  slug: 'je-le-veux',
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
