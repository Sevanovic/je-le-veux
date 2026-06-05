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
 * - Les clés de session des consents (jeleveux.session.<id>)
 * - Le PIN code / état biométrique
 * - Les tokens sensibles
 *
 * Auto-maintient un index des clés de session pour permettre clearAll()
 * de tout supprimer lors de la suppression de compte (GDPR).
 */

const SECURE_STORE_OPTS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const SESSION_KEY_PREFIX = 'jeleveux.session.';

export class SecureStorageService implements ISecureStorageService {
  async save(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTS);

    // Auto-track session keys in the index so clearAll() can wipe them.
    if (key.startsWith(SESSION_KEY_PREFIX)) {
      const consentId = key.slice(SESSION_KEY_PREFIX.length);
      await this.appendToSessionIndex(consentId);
    }
  }

  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async delete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  /**
   * Wipe every jeleveux.* key stored on this device.
   * Best-effort: individual key failures are swallowed and never throw.
   */
  async clearAll(): Promise<void> {
    // 1. Delete all session keys via the index
    try {
      const index = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_INDEX);
      if (index) {
        for (const consentId of index.split(',').filter(Boolean)) {
          try {
            await SecureStore.deleteItemAsync(`${SESSION_KEY_PREFIX}${consentId}`);
          } catch {
            // best-effort
          }
        }
      }
    } catch {
      // best-effort
    }

    // 2. Delete all fixed keys
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // best-effort
      }
    }
  }

  private async appendToSessionIndex(consentId: string): Promise<void> {
    const current = (await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_INDEX)) ?? '';
    const ids = current ? current.split(',').filter(Boolean) : [];
    if (ids.includes(consentId)) return;
    ids.push(consentId);
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_INDEX, ids.join(','), SECURE_STORE_OPTS);
  }
}

// Clés de stockage prédéfinies
// SecureStore n'accepte que : alphanumériques, ".", "-", "_"
export const STORAGE_KEYS = {
  SECRET_KEY: 'jeleveux.secret_key',
  PUBLIC_KEY: 'jeleveux.public_key',
  PIN_CODE: 'jeleveux.pin',
  BIOMETRICS_ENABLED: 'jeleveux.biometrics',
  NOTIFICATIONS_ENABLED: 'jeleveux.notifications',
  AGE_VERIFIED: 'jeleveux.age_verified',
  ONBOARDING_COMPLETED: 'jeleveux.onboarding_done',
  SESSION_INDEX: 'jeleveux.session_index',
} as const;

// Singleton
export const secureStorage = new SecureStorageService();
