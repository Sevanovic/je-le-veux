# Sprint 5a — Profile + GDPR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire ProfileScreen interactivity (biometric lock, notifications toggle, editable pseudonym) and deliver GDPR-required user controls (data export, account deletion).

**Architecture:** Six atomic use cases under `application/usecases/profile/`. New `IBiometricService` (wraps expo-local-authentication). `IAuthService.deleteCurrentAccount` calls a `SECURITY DEFINER` Supabase RPC. `ISecureStorageService.clearAll` wipes all jeleveux.* keys including dynamic session keys (tracked via an auto-maintained index).

**Tech Stack:** expo-local-authentication, expo-file-system, expo-sharing, Supabase RPC, AsyncStorage, Zustand

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/004_delete_my_account.sql` | Postgres RPC SECURITY DEFINER for self-delete |
| Modify | `src/domain/interfaces/repositories.ts` | Add `IBiometricService`, extend `IAuthService` + `ISecureStorageService` |
| Create | `src/infrastructure/biometrics/BiometricService.ts` | expo-local-authentication wrapper + singleton |
| Modify | `src/infrastructure/auth/AuthService.ts` | Implement `deleteCurrentAccount` (rpc call) |
| Modify | `src/infrastructure/storage/SecureStorageService.ts` | Implement `clearAll` + session index tracking + new STORAGE_KEYS |
| Modify | `src/infrastructure/index.ts` | Export `BiometricService` |
| Modify | `src/application/interfaces/container.ts` | Add `biometric: IBiometricService` slot |
| Create | `src/application/usecases/profile/checkBiometricLockUseCase.ts` | Decide if biometric prompt needed at startup |
| Create | `src/application/usecases/profile/toggleBiometricsUseCase.ts` | Validate hardware + persist flag |
| Create | `src/application/usecases/profile/toggleNotificationsUseCase.ts` | Persist flag |
| Create | `src/application/usecases/profile/updatePseudonymUseCase.ts` | Validate + update profile pseudo |
| Create | `src/application/usecases/profile/exportUserDataUseCase.ts` | Build JSON dump of profile + consents |
| Create | `src/application/usecases/profile/deleteAccountUseCase.ts` | Validate typed pseudo, call RPC, wipe local |
| Create | `src/application/usecases/profile/index.ts` | Barrel |
| Modify | `src/application/index.ts` | Export new use cases |
| Create | `src/presentation/screens/EditPseudonym/EditPseudonymScreen.tsx` + `index.ts` | Pseudonym edit UI |
| Create | `src/presentation/screens/DeleteAccountConfirm/DeleteAccountConfirmScreen.tsx` + `index.ts` | Account-deletion confirmation UI |
| Create | `src/presentation/screens/BiometricLock/BiometricLockScreen.tsx` + `index.ts` | Lock screen rendered above the navigator |
| Modify | `src/presentation/screens/Profile/ProfileScreen.tsx` | Wire switches, add export/delete sections, remove theme |
| Modify | `src/presentation/components/navigation/MainTabNavigator.tsx` | Add EditPseudonym + DeleteAccountConfirm routes |
| Modify | `App.tsx` | Wire biometric, lock state, AppState listener, render BiometricLockScreen |
| Modify | `src/infrastructure/i18n/locales/fr.json` | Profile extensions + deleteAccount + biometricLock sections |
| Modify | `src/infrastructure/i18n/locales/en.json` | Parity |

---

## Task 1: Supabase migration — delete_my_account RPC

**Files:** Create `supabase/migrations/004_delete_my_account.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 5a : RPC pour suppression de compte (GDPR)
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

-- ──────────────────────────────────────────────────────
-- delete_my_account()
-- Supprime l'utilisateur courant (auth.uid()) depuis auth.users.
-- Les profils, consents et invitations suivent automatiquement
-- via les FK ON DELETE CASCADE définies dans 001_initial_schema.sql.
--
-- SECURITY DEFINER : la fonction s'exécute avec les droits du
-- propriétaire (postgres), ce qui permet le DELETE sur auth.users
-- alors que le client n'a que les droits authenticated.
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Verrouille l'accès : seul un utilisateur authentifié peut l'appeler
REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
```

- [ ] **Step 2: Apply migration manually**

Open Supabase Dashboard → SQL Editor → paste contents of `004_delete_my_account.sql` → Run.

Expected: function created, grants applied. No errors.

---

## Task 2: Domain interface extensions

**Files:** Modify `src/domain/interfaces/repositories.ts`

- [ ] **Step 1: Add `deleteCurrentAccount` to IAuthService**

Find the `IAuthService` interface. After the `updateProfile` method, add:

```typescript
  /**
   * Delete the current authenticated user account via supabase.rpc('delete_my_account').
   * Cascades: profile, consents, invitations are removed via FK ON DELETE CASCADE.
   * The caller must clear local storage and sign out separately.
   */
  deleteCurrentAccount(): Promise<void>;
```

- [ ] **Step 2: Add `clearAll` to ISecureStorageService**

Find the `ISecureStorageService` interface. After the `delete` method, add:

```typescript
  /**
   * Wipe every jeleveux.* key stored on this device.
   * Used during account deletion (GDPR right to erasure).
   * Best-effort: individual key failures are swallowed.
   */
  clearAll(): Promise<void>;
```

- [ ] **Step 3: Add new IBiometricService interface**

At the end of the file (after `ISecureStorageService`), add:

```typescript
/**
 * Contract for biometric authentication (Face ID, Touch ID, fingerprint).
 */
export interface IBiometricService {
  /** True if the device has biometric hardware. */
  isAvailable(): Promise<boolean>;
  /** True if the user has enrolled at least one credential. */
  isEnrolled(): Promise<boolean>;
  /** Prompt the user. Returns true on success, false on user cancel / failure. */
  authenticate(reason?: string): Promise<boolean>;
}
```

- [ ] **Step 4: Update the barrel**

Edit `src/domain/interfaces/index.ts`. Add `IBiometricService` to the export list:

```typescript
export type {
  IConsentRepository,
  IUserRepository,
  IInvitationRepository,
  IAuthService,
  ICryptoService,
  INotificationService,
  ISecureStorageService,
  IBiometricService,
} from './repositories';
```

- [ ] **Step 5: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: errors about `AuthService` / `SecureStorageService` missing the new methods (which is fine — those are fixed in later tasks). No errors about `repositories.ts` itself.

---

## Task 3: BiometricService infrastructure

**Files:**
- Create `src/infrastructure/biometrics/BiometricService.ts`
- Modify `src/infrastructure/index.ts`

- [ ] **Step 1: Write the BiometricService**

Create `src/infrastructure/biometrics/BiometricService.ts`:

```typescript
import * as LocalAuthentication from 'expo-local-authentication';
import type { IBiometricService } from '../../domain/interfaces';

/**
 * Biometric authentication service wrapping expo-local-authentication.
 *
 * Used by the biometric lock at app startup and by the Profile toggle
 * to verify hardware availability before enabling the lock.
 */
export class BiometricService implements IBiometricService {
  async isAvailable(): Promise<boolean> {
    return LocalAuthentication.hasHardwareAsync();
  }

  async isEnrolled(): Promise<boolean> {
    return LocalAuthentication.isEnrolledAsync();
  }

  async authenticate(reason?: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? 'Authenticate',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }
}

export const biometricService = new BiometricService();
```

- [ ] **Step 2: Export from infrastructure barrel**

Edit `src/infrastructure/index.ts`. Add after the existing exports:

```typescript
export {
  biometricService,
  BiometricService,
} from './biometrics/BiometricService';
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors about BiometricService (other unrelated errors from Task 4/5 dependencies are fine).

---

## Task 4: AuthService.deleteCurrentAccount

**Files:** Modify `src/infrastructure/auth/AuthService.ts`

- [ ] **Step 1: Add the method**

Inside the `AuthService` class, after the `updateProfile` method, before `onAuthStateChange`, add:

```typescript
  async deleteCurrentAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
  }
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to AuthService.

---

## Task 5: SecureStorageService.clearAll + session index

**Files:** Modify `src/infrastructure/storage/SecureStorageService.ts`

- [ ] **Step 1: Replace the entire file**

Replace the file content with:

```typescript
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
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to SecureStorageService.

---

## Task 6: Extend DI container

**Files:** Modify `src/application/interfaces/container.ts`

- [ ] **Step 1: Add biometric to ServiceContainer**

Replace the file content with:

```typescript
import type {
  IAuthService,
  ICryptoService,
  ISecureStorageService,
  IConsentRepository,
  IInvitationRepository,
  IBiometricService,
} from '../../domain/interfaces';

/**
 * Dependency injection container for the Application layer.
 *
 * All use cases receive their dependencies through this container
 * rather than importing infrastructure directly. This ensures:
 * - Domain/Application layers never depend on Infrastructure
 * - Easy to swap implementations (e.g., mock for testing)
 * - Single source of truth for service wiring
 *
 * Initialized once at app startup via `initContainer()`.
 */
interface ServiceContainer {
  auth: IAuthService;
  crypto: ICryptoService;
  secureStorage: ISecureStorageService;
  consent: IConsentRepository;
  invitation: IInvitationRepository;
  biometric: IBiometricService;
}

let container: ServiceContainer | null = null;

/**
 * Initialize the DI container with concrete implementations.
 * Must be called once at app startup before any use case is invoked.
 */
export function initContainer(services: ServiceContainer): void {
  container = services;
}

/**
 * Retrieve the DI container.
 * Throws if called before initialization.
 */
export function getContainer(): ServiceContainer {
  if (!container) {
    throw new Error(
      'Service container not initialized. Call initContainer() in App.tsx before rendering.',
    );
  }
  return container;
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: an error about `App.tsx` missing `biometric` in initContainer (will be fixed in Task 19). No other errors.

---

## Task 7: checkBiometricLockUseCase

**Files:** Create `src/application/usecases/profile/checkBiometricLockUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';

export interface CheckBiometricLockOutput {
  locked: boolean;
  error?: 'CANCELLED' | 'FAILED' | 'UNAVAILABLE';
}

/**
 * Decide whether the app should be locked behind biometric auth.
 *
 * - If biometrics disabled (flag absent or 'false') -> not locked.
 * - If biometrics enabled but hardware unavailable -> locked + error.
 * - If biometrics enabled and authentication succeeds -> not locked.
 * - If biometrics enabled and authentication fails -> locked + error.
 */
export async function checkBiometricLockUseCase(
  reason?: string,
): Promise<CheckBiometricLockOutput> {
  const { secureStorage, biometric } = getContainer();

  const flag = await secureStorage.get('jeleveux.biometrics');
  if (flag !== 'true') {
    return { locked: false };
  }

  const available = await biometric.isAvailable();
  if (!available) {
    return { locked: true, error: 'UNAVAILABLE' };
  }

  const ok = await biometric.authenticate(reason);
  if (ok) return { locked: false };

  return { locked: true, error: 'FAILED' };
}
```

---

## Task 8: toggleBiometricsUseCase

**Files:** Create `src/application/usecases/profile/toggleBiometricsUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';

export interface ToggleBiometricsInput {
  enabled: boolean;
}

export interface ToggleBiometricsOutput {
  enabled: boolean;
}

/**
 * Persist the biometrics-enabled flag.
 * When enabling, verifies the device actually has biometric hardware
 * and at least one enrolled credential, else throws.
 *
 * Errors: HARDWARE_UNAVAILABLE, NOT_ENROLLED.
 */
export async function toggleBiometricsUseCase(
  input: ToggleBiometricsInput,
): Promise<ToggleBiometricsOutput> {
  const { secureStorage, biometric } = getContainer();

  if (input.enabled) {
    const available = await biometric.isAvailable();
    if (!available) {
      throw new Error('HARDWARE_UNAVAILABLE');
    }
    const enrolled = await biometric.isEnrolled();
    if (!enrolled) {
      throw new Error('NOT_ENROLLED');
    }
  }

  await secureStorage.save('jeleveux.biometrics', input.enabled ? 'true' : 'false');
  return { enabled: input.enabled };
}
```

---

## Task 9: toggleNotificationsUseCase

**Files:** Create `src/application/usecases/profile/toggleNotificationsUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';

export interface ToggleNotificationsInput {
  enabled: boolean;
}

export interface ToggleNotificationsOutput {
  enabled: boolean;
}

/**
 * Persist the notifications-enabled flag.
 * No permission is requested and no service is wired yet — the flag
 * will be consumed by push infrastructure in Sprint 6.
 */
export async function toggleNotificationsUseCase(
  input: ToggleNotificationsInput,
): Promise<ToggleNotificationsOutput> {
  const { secureStorage } = getContainer();
  await secureStorage.save('jeleveux.notifications', input.enabled ? 'true' : 'false');
  return { enabled: input.enabled };
}
```

---

## Task 10: updatePseudonymUseCase

**Files:** Create `src/application/usecases/profile/updatePseudonymUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import type { User } from '../../../domain/entities';

export interface UpdatePseudonymInput {
  userId: string;
  currentPseudonym: string;
  newPseudonym: string;
}

export interface UpdatePseudonymOutput {
  user: User;
}

/**
 * Update the user's pseudonym on the profile row.
 *
 * Existing consents keep their snapshot pseudonyms unchanged — the new
 * value will appear only on future consents.
 *
 * Errors:
 *   INVALID_PSEUDONYM  -> regex / length validation failed
 *   PSEUDONYM_TAKEN    -> Supabase UNIQUE constraint hit
 *   UPDATE_FAILED      -> generic Supabase error
 *   PROFILE_NOT_FOUND  -> shouldn't happen but guard anyway
 */
export async function updatePseudonymUseCase(
  input: UpdatePseudonymInput,
): Promise<UpdatePseudonymOutput> {
  const { auth } = getContainer();

  const trimmed = input.newPseudonym.trim();

  // No-op when value unchanged: still return current profile for store sync.
  if (trimmed === input.currentPseudonym) {
    const current = await auth.getProfile(input.userId);
    if (!current) throw new Error('PROFILE_NOT_FOUND');
    return { user: current };
  }

  if (!isValidPseudonym(trimmed)) {
    throw new Error('INVALID_PSEUDONYM');
  }

  try {
    await auth.updateProfile(input.userId, { pseudonym: trimmed });
  } catch (e) {
    const msg = (e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? '';
    if (String(msg).includes('23505') || String(msg).toLowerCase().includes('duplicate')) {
      throw new Error('PSEUDONYM_TAKEN');
    }
    throw new Error('UPDATE_FAILED');
  }

  const updated = await auth.getProfile(input.userId);
  if (!updated) throw new Error('PROFILE_NOT_FOUND');
  return { user: updated };
}
```

---

## Task 11: exportUserDataUseCase

**Files:** Create `src/application/usecases/profile/exportUserDataUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';
import type { Consent } from '../../../domain/entities';

export interface ExportUserDataInput {
  userId: string;
}

export interface ExportUserDataOutput {
  /** JSON string ready to be written to a file. */
  json: string;
  /** Suggested filename, e.g. `jeleveux-export-2026-06-05.json`. */
  filename: string;
}

interface ConsentExport {
  id: string;
  secureCode: string;
  status: string;
  level: string;
  durationMinutes: number;
  createdAt: string;
  acceptedAt: string | null;
  expiresAt: string | null;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
  refusedAt: string | null;
  role: 'initiator' | 'receiver';
  counterpartyPseudonym: string | null;
  statement: string | null;
  statementDecryptStatus: 'decrypted' | 'key_unavailable_on_this_device';
  conditions: string | null;
  conditionsDecryptStatus: 'decrypted' | 'absent' | 'key_unavailable_on_this_device';
}

function isoOrNull(d: Date | undefined): string | null {
  return d ? d.toISOString() : null;
}

async function tryDecrypt(
  ciphertext: string,
  sessionKey: string | null,
  decrypt: (ct: string, key: string) => Promise<string>,
): Promise<string | null> {
  if (!sessionKey) return null;
  try {
    return await decrypt(ciphertext, sessionKey);
  } catch {
    return null;
  }
}

async function buildConsentExport(
  consent: Consent,
  userId: string,
  sessionKey: string | null,
  decrypt: (ct: string, key: string) => Promise<string>,
): Promise<ConsentExport> {
  const role: 'initiator' | 'receiver' =
    consent.initiatorId === userId ? 'initiator' : 'receiver';
  const counterpartyPseudonym =
    role === 'initiator'
      ? consent.receiverPseudonym ?? null
      : consent.initiatorPseudonym;

  const statementText = await tryDecrypt(consent.encryptedStatement, sessionKey, decrypt);
  const statementDecryptStatus: ConsentExport['statementDecryptStatus'] =
    statementText !== null ? 'decrypted' : 'key_unavailable_on_this_device';

  let conditions: string | null = null;
  let conditionsDecryptStatus: ConsentExport['conditionsDecryptStatus'] = 'absent';
  if (consent.encryptedConditions) {
    conditions = await tryDecrypt(consent.encryptedConditions, sessionKey, decrypt);
    conditionsDecryptStatus =
      conditions !== null ? 'decrypted' : 'key_unavailable_on_this_device';
  }

  return {
    id: consent.id,
    secureCode: consent.secureCode,
    status: consent.status,
    level: consent.level,
    durationMinutes: consent.durationMinutes,
    createdAt: consent.createdAt.toISOString(),
    acceptedAt: isoOrNull(consent.acceptedAt),
    expiresAt: isoOrNull(consent.expiresAt),
    withdrawnAt: isoOrNull(consent.withdrawnAt),
    withdrawnBy: consent.withdrawnBy ?? null,
    refusedAt: isoOrNull(consent.refusedAt),
    role,
    counterpartyPseudonym,
    statement: statementText,
    statementDecryptStatus,
    conditions,
    conditionsDecryptStatus,
  };
}

/**
 * Build a JSON snapshot of the user's profile + all consents.
 * Decrypts statements/conditions when the session key is available locally.
 */
export async function exportUserDataUseCase(
  input: ExportUserDataInput,
): Promise<ExportUserDataOutput> {
  const { auth, consent: consentRepo, secureStorage, crypto } = getContainer();

  const profile = await auth.getProfile(input.userId);
  if (!profile) throw new Error('PROFILE_NOT_FOUND');

  const consents = await consentRepo.findByUserId(input.userId);

  const consentExports: ConsentExport[] = [];
  for (const c of consents) {
    const sessionKey = await secureStorage.get(`jeleveux.session.${c.id}`);
    consentExports.push(
      await buildConsentExport(c, input.userId, sessionKey, (ct, k) =>
        crypto.decryptSymmetric(ct, k),
      ),
    );
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    profile: {
      id: profile.id,
      pseudonym: profile.pseudonym,
      email: profile.email,
      publicKey: profile.publicKey,
      preferredLanguage: profile.preferredLanguage,
      isAgeVerified: profile.isAgeVerified,
      createdAt: profile.createdAt.toISOString(),
    },
    consents: consentExports,
  };

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `jeleveux-export-${yyyy}-${mm}-${dd}.json`;

  return {
    json: JSON.stringify(payload, null, 2),
    filename,
  };
}
```

---

## Task 12: deleteAccountUseCase

**Files:** Create `src/application/usecases/profile/deleteAccountUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getContainer } from '../../interfaces/container';

export interface DeleteAccountInput {
  userId: string;
  typedPseudonym: string;
  currentPseudonym: string;
}

/**
 * Permanently delete the current user account (GDPR).
 *
 * Sequence:
 *   1. Verify the typed pseudonym matches the current one.
 *   2. Call auth.deleteCurrentAccount() — Supabase RPC that wipes
 *      auth.users and cascades to profile, consents, invitations.
 *   3. Best-effort clear secureStorage (jeleveux.* keys + session index).
 *   4. Best-effort clear AsyncStorage.
 *   5. signOut() defensively in case the session lingers.
 *
 * Errors: PSEUDONYM_MISMATCH, RPC_FAILED.
 */
export async function deleteAccountUseCase(
  input: DeleteAccountInput,
): Promise<void> {
  const { auth, secureStorage } = getContainer();

  if (input.typedPseudonym.trim() !== input.currentPseudonym) {
    throw new Error('PSEUDONYM_MISMATCH');
  }

  try {
    await auth.deleteCurrentAccount();
  } catch {
    throw new Error('RPC_FAILED');
  }

  try {
    await secureStorage.clearAll();
  } catch {
    // best-effort
  }
  try {
    await AsyncStorage.clear();
  } catch {
    // best-effort
  }
  try {
    await auth.signOut();
  } catch {
    // best-effort
  }
}
```

---

## Task 13: Profile use case barrel + application exports

**Files:**
- Create `src/application/usecases/profile/index.ts`
- Modify `src/application/index.ts`

- [ ] **Step 1: Write the profile barrel**

Create `src/application/usecases/profile/index.ts`:

```typescript
export { checkBiometricLockUseCase } from './checkBiometricLockUseCase';
export type { CheckBiometricLockOutput } from './checkBiometricLockUseCase';

export { toggleBiometricsUseCase } from './toggleBiometricsUseCase';
export type {
  ToggleBiometricsInput,
  ToggleBiometricsOutput,
} from './toggleBiometricsUseCase';

export { toggleNotificationsUseCase } from './toggleNotificationsUseCase';
export type {
  ToggleNotificationsInput,
  ToggleNotificationsOutput,
} from './toggleNotificationsUseCase';

export { updatePseudonymUseCase } from './updatePseudonymUseCase';
export type {
  UpdatePseudonymInput,
  UpdatePseudonymOutput,
} from './updatePseudonymUseCase';

export { exportUserDataUseCase } from './exportUserDataUseCase';
export type {
  ExportUserDataInput,
  ExportUserDataOutput,
} from './exportUserDataUseCase';

export { deleteAccountUseCase } from './deleteAccountUseCase';
export type { DeleteAccountInput } from './deleteAccountUseCase';
```

- [ ] **Step 2: Update `src/application/index.ts`**

Add at the end of the file:

```typescript
export {
  checkBiometricLockUseCase,
  toggleBiometricsUseCase,
  toggleNotificationsUseCase,
  updatePseudonymUseCase,
  exportUserDataUseCase,
  deleteAccountUseCase,
} from './usecases/profile';
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: errors limited to `App.tsx` (missing biometric in container) — will be fixed in Task 19.

---

## Task 14: EditPseudonymScreen

**Files:**
- Create `src/presentation/screens/EditPseudonym/EditPseudonymScreen.tsx`
- Create `src/presentation/screens/EditPseudonym/index.ts`

- [ ] **Step 1: Write the screen**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { updatePseudonymUseCase } from '../../../application';
import { isValidPseudonym } from '../../../domain/entities';
import { useAuthStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'EditPseudonym'>;

export function EditPseudonymScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const current = user?.pseudonym ?? '';
  const [value, setValue] = useState(current);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = value.trim();
  const isValid = isValidPseudonym(trimmed);
  const isDifferent = trimmed !== current;
  const canSave = isValid && isDifferent && !isSubmitting;

  const handleSave = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const result = await updatePseudonymUseCase({
        userId: user.id,
        currentPseudonym: current,
        newPseudonym: trimmed,
      });
      setUser(result.user);
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_PSEUDONYM') {
        Alert.alert(t('common.error'), t('profile.errorPseudonymInvalid'));
      } else if (message === 'PSEUDONYM_TAKEN') {
        Alert.alert(t('common.error'), t('profile.errorPseudonymTaken'));
      } else {
        Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title={t('profile.editPseudonymTitle')} showBack />

      <View style={styles.body}>
        <Text style={styles.note}>{t('profile.editPseudonymNote')}</Text>

        <Input
          label={t('profile.pseudonym')}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          testID="edit-pseudonym-input"
        />

        {!isValid && trimmed.length > 0 ? (
          <Text style={styles.errorText}>
            {t('profile.errorPseudonymInvalid')}
          </Text>
        ) : null}

        <Button
          title={t('common.save')}
          onPress={handleSave}
          loading={isSubmitting}
          disabled={!canSave}
          testID="edit-pseudonym-save-btn"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  note: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.semantic.danger,
  },
});
```

- [ ] **Step 2: Write the barrel**

Create `src/presentation/screens/EditPseudonym/index.ts`:

```typescript
export { EditPseudonymScreen } from './EditPseudonymScreen';
```

---

## Task 15: DeleteAccountConfirmScreen

**Files:**
- Create `src/presentation/screens/DeleteAccountConfirm/DeleteAccountConfirmScreen.tsx`
- Create `src/presentation/screens/DeleteAccountConfirm/index.ts`

- [ ] **Step 1: Write the screen**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { deleteAccountUseCase } from '../../../application';
import { useAuthStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

export function DeleteAccountConfirmScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const current = user?.pseudonym ?? '';
  const [typed, setTyped] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canDelete = typed.trim() === current && current.length > 0 && !isSubmitting;

  const handleDelete = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await deleteAccountUseCase({
        userId: user.id,
        typedPseudonym: typed,
        currentPseudonym: current,
      });
      // RootNavigator detects user = null and shows Auth flow
      logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setIsSubmitting(false);
      if (message === 'PSEUDONYM_MISMATCH') {
        Alert.alert(t('common.error'), t('deleteAccount.errorMismatch'));
      } else {
        Alert.alert(t('common.error'), t('deleteAccount.errorFailed'));
      }
    }
  };

  return (
    <ScreenWrapper>
      <Header title={t('deleteAccount.title')} showBack />

      <View style={styles.body}>
        <Text style={styles.warningTitle}>{t('deleteAccount.warningTitle')}</Text>
        <Text style={styles.warningSubtitle}>{t('deleteAccount.warningSubtitle')}</Text>

        <View style={styles.bullets}>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence1')}</Text>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence2')}</Text>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence3')}</Text>
        </View>

        <Text style={styles.typePrompt}>
          {t('deleteAccount.typePseudonymHint', { pseudo: current })}
        </Text>

        <Input
          label={t('deleteAccount.typePseudonymLabel')}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          testID="delete-typed-pseudonym-input"
        />

        <Button
          title={t('deleteAccount.confirmButton')}
          variant="danger"
          onPress={handleDelete}
          loading={isSubmitting}
          disabled={!canDelete}
          testID="delete-confirm-btn"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  warningTitle: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.lg,
    color: colors.semantic.danger,
  },
  warningSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  bullets: {
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
    padding: spacing.md,
    borderRadius: 12,
  },
  bullet: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  typePrompt: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
});
```

- [ ] **Step 2: Write the barrel**

Create `src/presentation/screens/DeleteAccountConfirm/index.ts`:

```typescript
export { DeleteAccountConfirmScreen } from './DeleteAccountConfirmScreen';
```

---

## Task 16: BiometricLockScreen

**Files:**
- Create `src/presentation/screens/BiometricLock/BiometricLockScreen.tsx`
- Create `src/presentation/screens/BiometricLock/index.ts`

- [ ] **Step 1: Write the screen**

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { checkBiometricLockUseCase } from '../../../application';
import { Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

/**
 * Full-screen lock rendered above the navigator when biometrics are enabled
 * and the user has not yet authenticated this session.
 * Auto-triggers the prompt on mount; offers a manual retry button.
 */
export function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const tryUnlock = async () => {
    setErrorKey(null);
    setIsAuthenticating(true);
    try {
      const result = await checkBiometricLockUseCase(t('biometricLock.title'));
      if (!result.locked) {
        onUnlock();
        return;
      }
      if (result.error === 'CANCELLED') setErrorKey('biometricLock.errorCancelled');
      else setErrorKey('biometricLock.errorFailed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    void tryUnlock();
    // run once on mount; user can retry manually
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>{t('biometricLock.title')}</Text>
        <Text style={styles.subtitle}>{t('biometricLock.subtitle')}</Text>
        {errorKey ? <Text style={styles.error}>{t(errorKey)}</Text> : null}
        <Button
          title={t('biometricLock.unlockButton')}
          onPress={tryUnlock}
          loading={isAuthenticating}
          disabled={isAuthenticating}
          testID="biometric-unlock-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  inner: {
    gap: spacing.lg,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.semantic.danger,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Write the barrel**

Create `src/presentation/screens/BiometricLock/index.ts`:

```typescript
export { BiometricLockScreen } from './BiometricLockScreen';
```

---

## Task 17: Update navigation types and routes

**Files:** Modify `src/presentation/components/navigation/MainTabNavigator.tsx`

- [ ] **Step 1: Add screen imports**

After the existing `import { ConsentDetailScreen } ...` line, add:

```typescript
import { EditPseudonymScreen } from '../../screens/EditPseudonym';
import { DeleteAccountConfirmScreen } from '../../screens/DeleteAccountConfirm';
```

- [ ] **Step 2: Extend `HomeStackParamList`**

Find the existing `HomeStackParamList` type and add two new routes (before `Profile`):

```typescript
export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    invitation: Invitation;
    decryptedStatement: string;
    decryptedConditions?: string;
    sessionKey: string;
  };
  Confirmation: { consentId: string };
  ConsentDetail: { consentId: string };
  EditPseudonym: undefined;
  DeleteAccountConfirm: undefined;
  Profile: undefined;
};
```

- [ ] **Step 3: Add the two screens to HomeStackNavigator**

Inside `HomeStackNavigator()`, after the `Profile` screen line, add the two new entries (or insert anywhere — order doesn't matter, but conventionally after `Profile`):

```typescript
<HomeStack.Screen name="EditPseudonym" component={EditPseudonymScreen} />
<HomeStack.Screen name="DeleteAccountConfirm" component={DeleteAccountConfirmScreen} />
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: only errors remaining are App.tsx-related (Task 19).

---

## Task 18: ProfileScreen rewrite

**Files:** Modify `src/presentation/screens/Profile/ProfileScreen.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  ScreenWrapper,
  Header,
  Card,
  Button,
  LanguageSelector,
} from '../../components';
import { useAuthStore, useSettingsStore } from '../../hooks';
import {
  signOutUseCase,
  toggleBiometricsUseCase,
  toggleNotificationsUseCase,
  exportUserDataUseCase,
} from '../../../application';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const setBiometrics = useSettingsStore((s) => s.setBiometrics);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotifications = useSettingsStore((s) => s.setNotifications);

  const [isExporting, setIsExporting] = useState(false);

  const handleBiometricsToggle = async (value: boolean) => {
    try {
      await toggleBiometricsUseCase({ enabled: value });
      setBiometrics(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'HARDWARE_UNAVAILABLE') {
        Alert.alert(t('common.error'), t('profile.biometricsUnavailable'));
      } else if (message === 'NOT_ENROLLED') {
        Alert.alert(t('common.error'), t('profile.biometricsNotEnrolled'));
      } else {
        Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
      }
      // Switch will revert because state was not updated
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      await toggleNotificationsUseCase({ enabled: value });
      setNotifications(value);
    } catch {
      Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const { json, filename } = await exportUserDataUseCase({ userId: user.id });
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: t('profile.exportData'),
        });
      } else {
        Alert.alert('', t('profile.exportSuccess'));
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUseCase();
    } catch {
      // logout locally even if Supabase signOut fails
    }
    logout();
  };

  return (
    <ScreenWrapper>
      <Header title={t('profile.title')} showBack />

      {/* Avatar + pseudo */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.pseudonym?.substring(0, 2).toUpperCase() ?? 'JV'}
          </Text>
        </View>
        <Text style={styles.pseudonym}>{user?.pseudonym ?? '—'}</Text>
      </View>

      {/* Identity */}
      <Card style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.pseudonym')}</Text>
            <Text style={styles.settingDesc}>{user?.pseudonym ?? '—'}</Text>
          </View>
          <Button
            title={t('profile.editPseudonym')}
            variant="ghost"
            onPress={() => navigation.navigate('EditPseudonym')}
            testID="profile-edit-pseudonym-btn"
          />
        </View>
      </Card>

      {/* Language */}
      <Card style={styles.section}>
        <LanguageSelector />
      </Card>

      {/* Security */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.security')}</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.biometrics')}</Text>
            <Text style={styles.settingDesc}>{t('profile.biometricsDesc')}</Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={handleBiometricsToggle}
            testID="profile-biometrics-switch"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.notifications')}</Text>
            <Text style={styles.settingDesc}>{t('profile.notificationsDesc')}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            testID="profile-notifications-switch"
          />
        </View>
      </Card>

      {/* My data (GDPR) */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.myData')}</Text>
        <View style={styles.dataActions}>
          <Button
            title={t('profile.exportData')}
            variant="secondary"
            onPress={handleExport}
            loading={isExporting}
            disabled={isExporting}
            testID="profile-export-btn"
          />
          <Button
            title={t('profile.deleteAccount')}
            variant="danger"
            onPress={() => navigation.navigate('DeleteAccountConfirm')}
            testID="profile-delete-btn"
          />
        </View>
      </Card>

      {/* Sign out */}
      <View style={styles.signoutContainer}>
        <Button
          title={t('profile.logout')}
          variant="secondary"
          onPress={handleLogout}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing['2xl'],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 2,
    borderColor: colors.gold.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.gold.DEFAULT,
  },
  pseudonym: {
    fontFamily: typography.fontFamily.displayMedium,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingTitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  settingDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  dataActions: {
    gap: spacing.md,
  },
  signoutContainer: {
    marginTop: spacing.lg,
  },
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: only App.tsx-related errors remain.

---

## Task 19: App.tsx wiring (biometric + lock state + AppState)

**Files:** Modify `App.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { secureStorage } from './src/infrastructure/storage/SecureStorageService';` line, add:

```typescript
import { biometricService } from './src/infrastructure/biometrics/BiometricService';
```

Update the application import to include `checkBiometricLockUseCase`:

Find:
```typescript
import {
  initContainer,
  restoreSessionUseCase,
  loadUserConsentsUseCase,
} from './src/application';
```

Replace with:
```typescript
import {
  initContainer,
  restoreSessionUseCase,
  loadUserConsentsUseCase,
  checkBiometricLockUseCase,
} from './src/application';
```

Also add this import after the navigation imports (near `RootNavigator`):

```typescript
import { BiometricLockScreen } from './src/presentation/screens/BiometricLock';
```

And add the AppState import to the existing react-native import line:

Find:
```typescript
import { View, StyleSheet } from 'react-native';
```

Replace with:
```typescript
import { View, StyleSheet, AppState, type AppStateStatus } from 'react-native';
```

- [ ] **Step 2: Add biometric to initContainer**

In the existing `initContainer({...})` block, add `biometric: biometricService` at the end:

```typescript
initContainer({
  auth: authService,
  crypto: cryptoService,
  secureStorage: secureStorage,
  consent: consentRepository,
  invitation: invitationRepository,
  biometric: biometricService,
});
```

- [ ] **Step 3: Add lock state + biometric check effect**

After the existing `const [authChecked, setAuthChecked] = useState(false);` line, add:

```typescript
  const [isLocked, setIsLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
```

After the existing Realtime `useEffect` (the "4. Realtime: subscribe..." block), add a new effect:

```typescript
  // 5. Biometric lock at startup + on foreground after >5min idle.
  useEffect(() => {
    const FIVE_MIN_MS = 5 * 60 * 1000;
    let lastBackgroundedAt: number | null = null;

    const runCheck = async () => {
      try {
        const result = await checkBiometricLockUseCase();
        setIsLocked(result.locked);
      } catch {
        setIsLocked(false);
      } finally {
        setBiometricChecked(true);
      }
    };

    // Initial check (cold start)
    void runCheck();

    // Foreground after >5min idle
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt = Date.now();
        return;
      }
      if (next === 'active' && lastBackgroundedAt !== null) {
        const idle = Date.now() - lastBackgroundedAt;
        lastBackgroundedAt = null;
        if (idle >= FIVE_MIN_MS) {
          void runCheck();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
```

- [ ] **Step 4: Update isReady + render**

Find:
```typescript
  const isReady = i18nReady && authChecked;
```

Replace with:
```typescript
  const isReady = i18nReady && authChecked && biometricChecked;
```

Find the render block:
```typescript
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <View style={styles.root} onLayout={onLayoutRootView}>
            <RootNavigator />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
```

Replace with:
```typescript
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root} onLayout={onLayoutRootView}>
          {isLocked ? (
            <BiometricLockScreen onUnlock={() => setIsLocked(false)} />
          ) : (
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 5: Verify full compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 20: i18n keys (FR + EN)

**Files:**
- Modify `src/infrastructure/i18n/locales/fr.json`
- Modify `src/infrastructure/i18n/locales/en.json`

- [ ] **Step 1: Extend the `profile` section (FR)**

Inside the existing `"profile"` block in `fr.json`, after the existing `"logout"` key, add:

```json
"editPseudonym": "Modifier",
"editPseudonymTitle": "Modifier le pseudonyme",
"editPseudonymNote": "Ce changement s'appliquera aux futurs consentements. Les consentements existants conservent l'ancien pseudonyme.",
"myData": "Mes données",
"exportData": "Exporter mes données",
"exportSuccess": "Export terminé.",
"exportError": "Impossible d'exporter vos données.",
"biometricsUnavailable": "Cet appareil ne dispose pas de capteur biométrique.",
"biometricsNotEnrolled": "Aucune empreinte ni Face ID configuré sur cet appareil.",
"pseudonymUpdated": "Pseudonyme mis à jour.",
"errorPseudonymTaken": "Ce pseudonyme est déjà utilisé.",
"errorPseudonymInvalid": "Le pseudonyme doit contenir 3 à 30 caractères (lettres, chiffres, _ et -).",
"errorUpdateFailed": "La mise à jour a échoué. Veuillez réessayer."
```

- [ ] **Step 2: Extend the `profile` section (EN)**

Inside `"profile"` in `en.json`, after `"logout"`, add:

```json
"editPseudonym": "Edit",
"editPseudonymTitle": "Edit pseudonym",
"editPseudonymNote": "This change will apply to future consents. Existing consents keep the old pseudonym.",
"myData": "My data",
"exportData": "Export my data",
"exportSuccess": "Export complete.",
"exportError": "Unable to export your data.",
"biometricsUnavailable": "This device has no biometric sensor.",
"biometricsNotEnrolled": "No fingerprint or Face ID set up on this device.",
"pseudonymUpdated": "Pseudonym updated.",
"errorPseudonymTaken": "This pseudonym is already taken.",
"errorPseudonymInvalid": "Pseudonym must be 3-30 characters (letters, digits, _ and -).",
"errorUpdateFailed": "Update failed. Please try again."
```

- [ ] **Step 3: Add `deleteAccount` section (FR)**

After the `"profile"` block in `fr.json`, add a new top-level section:

```json
"deleteAccount": {
  "title": "Supprimer mon compte",
  "warningTitle": "Cette action est irréversible",
  "warningSubtitle": "La suppression est définitive et conforme à votre droit à l'effacement (RGPD).",
  "consequence1": "Tous vos consentements seront effacés",
  "consequence2": "Vos clés locales seront détruites",
  "consequence3": "Cette action est irréversible",
  "typePseudonymLabel": "Pseudonyme",
  "typePseudonymHint": "Tapez votre pseudonyme {{pseudo}} pour confirmer",
  "confirmButton": "Supprimer définitivement",
  "errorMismatch": "Le pseudonyme saisi ne correspond pas.",
  "errorFailed": "La suppression a échoué. Veuillez réessayer."
},
```

- [ ] **Step 4: Add `deleteAccount` section (EN)**

After `"profile"` in `en.json`, add:

```json
"deleteAccount": {
  "title": "Delete my account",
  "warningTitle": "This action is irreversible",
  "warningSubtitle": "Deletion is permanent and complies with your right to erasure (GDPR).",
  "consequence1": "All your consents will be erased",
  "consequence2": "Your local keys will be destroyed",
  "consequence3": "This action cannot be undone",
  "typePseudonymLabel": "Pseudonym",
  "typePseudonymHint": "Type your pseudonym {{pseudo}} to confirm",
  "confirmButton": "Delete permanently",
  "errorMismatch": "The pseudonym you typed does not match.",
  "errorFailed": "Deletion failed. Please try again."
},
```

- [ ] **Step 5: Add `biometricLock` section (FR)**

After the `"deleteAccount"` block in `fr.json`, add:

```json
"biometricLock": {
  "title": "Authentification requise",
  "subtitle": "Confirmez votre identité pour accéder à l'application.",
  "unlockButton": "Déverrouiller",
  "errorFailed": "L'authentification a échoué. Veuillez réessayer.",
  "errorCancelled": "Authentification annulée."
},
```

- [ ] **Step 6: Add `biometricLock` section (EN)**

After `"deleteAccount"` in `en.json`, add:

```json
"biometricLock": {
  "title": "Authentication required",
  "subtitle": "Confirm your identity to access the app.",
  "unlockButton": "Unlock",
  "errorFailed": "Authentication failed. Please try again.",
  "errorCancelled": "Authentication cancelled."
},
```

- [ ] **Step 7: Verify FR/EN parity**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" node -e "
const fr = require('/Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/src/infrastructure/i18n/locales/fr.json');
const en = require('/Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/src/infrastructure/i18n/locales/en.json');
const getKeys = (obj, prefix='') => Object.keys(obj).reduce((acc, k) => {
  const key = prefix ? prefix+'.'+k : k;
  if (typeof obj[k] === 'object') return [...acc, ...getKeys(obj[k], key)];
  return [...acc, key];
}, []);
const f = getKeys(fr).sort(), e = getKeys(en).sort();
const missingEn = f.filter(k => !e.includes(k));
const missingFr = e.filter(k => !f.includes(k));
if (missingEn.length || missingFr.length) {
  console.log('MISMATCH'); console.log('Missing in EN:', missingEn); console.log('Missing in FR:', missingFr);
} else { console.log('OK total:', f.length); }
"
```

Expected: `OK total: <number>` (around 233).

---

## Task 21: Final verification

- [ ] **Step 1: Verify Clean Architecture boundaries**

Run:
```bash
grep -r "from.*infrastructure" /Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/src/application/ 2>/dev/null && echo "VIOLATION" || echo "OK: application clean"
```

Expected: `OK: application clean`.

- [ ] **Step 2: Verify full TypeScript compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -30
```

Expected: no output (no errors).

- [ ] **Step 3: Verify i18n parity**

Re-run the parity check from Task 20 Step 7.

Expected: `OK total: <number>`.
