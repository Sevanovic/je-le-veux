import * as SecureStore from 'expo-secure-store';
import type { ISecureStorageService } from '../../domain/interfaces';

/**
 * Service de stockage sécurisé utilisant expo-secure-store.
 *
 * Sur iOS : utilise le Keychain
 * Sur Android : utilise le Keystore + EncryptedSharedPreferences
 *
 * Utilisé pour stocker :
 * - La clé secrète de l'utilisateur (chiffrement E2E)
 * - Le PIN code / état biométrique
 * - Les tokens sensibles
 */
export class SecureStorageService implements ISecureStorageService {
  async save(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async delete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}

// Clés de stockage prédéfinies
// SecureStore n'accepte que : alphanumériques, ".", "-", "_"
export const STORAGE_KEYS = {
  SECRET_KEY: 'jeleveux.secret_key',
  PUBLIC_KEY: 'jeleveux.public_key',
  PIN_CODE: 'jeleveux.pin',
  BIOMETRICS_ENABLED: 'jeleveux.biometrics',
  AGE_VERIFIED: 'jeleveux.age_verified',
  ONBOARDING_COMPLETED: 'jeleveux.onboarding_done',
} as const;

// Singleton
export const secureStorage = new SecureStorageService();
