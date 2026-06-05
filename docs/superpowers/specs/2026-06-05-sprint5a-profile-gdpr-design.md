# Sprint 5a — Profile interactif + GDPR

> Design spec for Sprint 5a of Je Le Veux (Sprint 5 split in two: 5a = Profile + GDPR; 5b = Resources + Legal).
> Approved 2026-06-05.

## Goal

Make ProfileScreen fully interactive (biometric lock, notifications toggle, editable pseudonym) and deliver GDPR-required user controls: export personal data and delete account.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Biometric scope | Lock at cold start + after >5min foreground inactivity | Standard pattern (banks, password managers). Matches user expectation. |
| Notifications toggle | Persist flag only (no permission, no push wiring) | Push will be wired in Sprint 6. Avoid asking permission we can't honor. |
| Theme switcher | Skip for 5a (handled in Sprint 7) | Real light mode is a refactor; a fake toggle is worse than no toggle. |
| Pseudonym editing | Dedicated screen with explanatory note | Existing consents keep the old pseudo (snapshot at creation). Explicit UI prevents user confusion. |
| Data export format | JSON via `expo-sharing` share sheet | Standard mobile UX, no backend dependency, user picks destination. |
| Data export content | Decrypted statements when session key available, `null` + status flag otherwise | Transparent and useful. User reads their own data. |
| Account deletion | Supabase RPC `delete_my_account()` with `SECURITY DEFINER` | Cascades via existing FK ON DELETE CASCADE. No service_role on client. GDPR-compliant hard delete. |
| Use case granularity | Atomic use cases (one per concern) | Matches existing project pattern (createConsent, withdrawConsent, etc.). |

## Architecture

### Flow 1 — Biometric lock at startup

```
App.tsx (cold start OR foreground after >5min idle)
  -> checkBiometricLockUseCase()
    -> secureStorage.get('jeleveux.biometrics_enabled')
    -> If OFF -> { locked: false }
    -> If ON -> biometric.authenticate(t('biometricLock.title'))
      -> success -> { locked: false }
      -> failure -> { locked: true, error: 'FAILED' | 'CANCELLED' | 'UNAVAILABLE' }
  -> If locked, render BiometricLockScreen (retry button)
  -> Else render RootNavigator
```

### Flow 2 — Toggle biometrics

```
ProfileScreen <Switch> tap
  -> toggleBiometricsUseCase({ enabled })
    -> If enabling: biometric.isAvailable() + biometric.isEnrolled()
       -> throw HARDWARE_UNAVAILABLE or NOT_ENROLLED if missing
    -> secureStorage.save('jeleveux.biometrics_enabled', boolean)
    -> useSettingsStore.setBiometrics(enabled)
  -> On error, switch reverts to previous value + Alert with i18n message
```

### Flow 3 — Toggle notifications

```
ProfileScreen <Switch> tap
  -> toggleNotificationsUseCase({ enabled })
    -> secureStorage.save('jeleveux.notifications_enabled', boolean)
    -> useSettingsStore.setNotifications(enabled)
```

### Flow 4 — Edit pseudonym

```
ProfileScreen "Edit pseudonym" -> EditPseudonymScreen
  -> User types new value, validation live (3-30 chars regex)
  -> updatePseudonymUseCase({ userId, newPseudonym })
    -> isValidPseudonym(newPseudonym) -> else INVALID_PSEUDONYM
    -> If same as current -> return early (no-op)
    -> auth.updateProfile(userId, { pseudonym })
       -> Supabase UNIQUE constraint -> PSEUDONYM_TAKEN
    -> useAuthStore.setUser(updated profile)
  -> navigation.goBack()
```

### Flow 5 — Export personal data

```
ProfileScreen "Export my data" button
  -> setLoading(true)
  -> exportUserDataUseCase({ userId })
    -> auth.getProfile(userId)
    -> consent.findByUserId(userId)
    -> For each consent, try secureStorage.get('jeleveux.session.<id>') + decrypt
    -> Build JSON object (see schema below)
    -> Return { json, filename }
  -> FileSystem.writeAsStringAsync(fileUri, json)
  -> Sharing.shareAsync(fileUri)
  -> setLoading(false)
```

### Flow 6 — Delete account

```
ProfileScreen "Delete my account" -> Alert warning
  -> User confirms -> navigation.navigate('DeleteAccountConfirm')
  -> DeleteAccountConfirmScreen: user types pseudonym
  -> "Delete permanently" button
  -> deleteAccountUseCase({ userId, typedPseudonym, currentPseudonym })
    -> If typedPseudonym !== currentPseudonym -> PSEUDONYM_MISMATCH
    -> auth.deleteCurrentAccount() -> supabase.rpc('delete_my_account')
       -> RPC deletes auth.users.id = auth.uid()
       -> Cascade: profiles -> consents -> invitations (via FK ON DELETE CASCADE)
    -> secureStorage.clearAll()
    -> AsyncStorage.clear()
    -> auth.signOut()
    -> useAuthStore.logout()
  -> RootNavigator sees user = null -> renders Auth flow
```

## Domain & Infrastructure

### New domain interface

```typescript
// src/domain/interfaces/repositories.ts (append)

/**
 * Contract for biometric authentication (Face ID, Touch ID, fingerprint).
 */
export interface IBiometricService {
  isAvailable(): Promise<boolean>;
  isEnrolled(): Promise<boolean>;
  authenticate(reason?: string): Promise<boolean>;
}
```

### IAuthService extension

```typescript
deleteCurrentAccount(): Promise<void>;  // calls supabase.rpc('delete_my_account')
```

### ISecureStorageService extension

```typescript
clearAll(): Promise<void>;  // wipes all known jeleveux.* keys
```

### New infrastructure

**BiometricService** at `src/infrastructure/biometrics/BiometricService.ts`:
- Wraps `expo-local-authentication`
- `isAvailable()` -> `LocalAuthentication.hasHardwareAsync()`
- `isEnrolled()` -> `LocalAuthentication.isEnrolledAsync()`
- `authenticate(reason)` -> `LocalAuthentication.authenticateAsync({ promptMessage: reason })`

**AuthService.deleteCurrentAccount()**:
```typescript
const { error } = await supabase.rpc('delete_my_account');
if (error) throw error;
```

**SecureStorageService.clearAll()**:
- Loops through hardcoded `STORAGE_KEYS` constants
- Maintains an index `jeleveux.session_index` (comma-separated consent IDs) that is appended to on save and cleared by clearAll
- Best-effort: silent on individual key deletion failures

### Supabase migration `004_delete_my_account.sql`

```sql
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

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
```

### DI container extension

```typescript
interface ServiceContainer {
  // ...existing
  biometric: IBiometricService;
}
```

Wired in `App.tsx`.

## Use Cases

All under `src/application/usecases/profile/`.

### checkBiometricLockUseCase

**Input:** none
**Output:** `{ locked: boolean, error?: 'CANCELLED' | 'FAILED' | 'UNAVAILABLE' }`

1. Read `jeleveux.biometrics_enabled` from SecureStore
2. If absent or `'false'` -> `{ locked: false }`
3. If `'true'` -> call `biometric.authenticate(reason)`
4. Map result: success -> `{ locked: false }`, cancellation -> `{ locked: true, error: 'CANCELLED' }`, other failures -> `{ locked: true, error: 'FAILED' }`

### toggleBiometricsUseCase

**Input:** `{ enabled: boolean }`
**Output:** `{ enabled: boolean }`

1. If `enabled === true`: call `biometric.isAvailable()` (else throw `HARDWARE_UNAVAILABLE`), then `isEnrolled()` (else throw `NOT_ENROLLED`)
2. `secureStorage.save('jeleveux.biometrics_enabled', enabled ? 'true' : 'false')`
3. Return `{ enabled }`

### toggleNotificationsUseCase

**Input:** `{ enabled: boolean }`
**Output:** `{ enabled: boolean }`

1. `secureStorage.save('jeleveux.notifications_enabled', enabled ? 'true' : 'false')`
2. Return `{ enabled }`

### updatePseudonymUseCase

**Input:** `{ userId: string, currentPseudonym: string, newPseudonym: string }`
**Output:** `{ user: User }` (the updated profile from `auth.getProfile`)

1. Trim `newPseudonym`; if equal to `currentPseudonym` -> fetch and return current profile (no-op)
2. `isValidPseudonym(newPseudonym)` -> else throw `INVALID_PSEUDONYM`
3. `auth.updateProfile(userId, { pseudonym: newPseudonym })` -> catches Supabase UNIQUE violation (`23505`) -> rethrow as `PSEUDONYM_TAKEN`
4. `auth.getProfile(userId)` -> return

### exportUserDataUseCase

**Input:** `{ userId: string }`
**Output:** `{ json: string, filename: string }`

JSON schema:
```json
{
  "exportedAt": "2026-06-05T14:32:00Z",
  "appVersion": "1.0.0",
  "profile": {
    "id": "uuid",
    "pseudonym": "...",
    "email": "...",
    "publicKey": "base64",
    "preferredLanguage": "fr",
    "isAgeVerified": true,
    "createdAt": "2026-..."
  },
  "consents": [
    {
      "id": "uuid",
      "secureCode": "JLV-...",
      "status": "active",
      "level": "moderate",
      "durationMinutes": 360,
      "createdAt": "...",
      "acceptedAt": "...",
      "expiresAt": "...",
      "withdrawnAt": null,
      "withdrawnBy": null,
      "refusedAt": null,
      "role": "initiator",
      "counterpartyPseudonym": "...",
      "statement": "decrypted text or null",
      "statementDecryptStatus": "decrypted" | "key_unavailable_on_this_device",
      "conditions": "decrypted text or null",
      "conditionsDecryptStatus": "decrypted" | "absent" | "key_unavailable_on_this_device"
    }
  ]
}
```

Filename: `jeleveux-export-YYYY-MM-DD.json` (today's date).

### deleteAccountUseCase

**Input:** `{ userId: string, typedPseudonym: string, currentPseudonym: string }`
**Output:** `void`

1. If `typedPseudonym.trim() !== currentPseudonym` -> throw `PSEUDONYM_MISMATCH`
2. `auth.deleteCurrentAccount()` -> may throw `RPC_FAILED`
3. `secureStorage.clearAll()` (best-effort, swallow errors)
4. `AsyncStorage.clear()` (best-effort, swallow errors)
5. `auth.signOut()` (defensive, in case session lingers)

## Screens

### ProfileScreen (MODIFIED)

Sections, top to bottom:

1. **Avatar + pseudonym** (existing — keep visual)
2. **Identity** — pseudonym row with "Edit" button -> `EditPseudonymScreen`
3. **Language** — existing `LanguageSelector` (keep)
4. **Security** — `<Switch>` for biometrics (wired to `toggleBiometricsUseCase`), `<Switch>` for notifications
5. **My data** (new) — "Export my data" button + "Delete my account" button (danger)
6. **Sign out** at bottom (existing)

Remove the theme section entirely (deferred to Sprint 7).

### EditPseudonymScreen (NEW)

File: `src/presentation/screens/EditPseudonym/EditPseudonymScreen.tsx` + `index.ts`

- Header with back button
- Subtitle text: "This change will apply to future consents. Existing consents keep the old pseudonym."
- `<Input>` pre-filled with current pseudonym, autoCapitalize off, autoCorrect off
- Live validation: 3-30 chars, regex `[\p{L}\d_-]+`, shows inline error
- "Save" button: disabled if invalid OR same as current
- Calls `updatePseudonymUseCase` with loading state
- On error: Alert with mapped i18n message
- On success: navigation.goBack()

### DeleteAccountConfirmScreen (NEW)

File: `src/presentation/screens/DeleteAccountConfirm/DeleteAccountConfirmScreen.tsx` + `index.ts`

- Header with back button
- Warning title (red)
- Bullet list of consequences (3 items)
- "Type your pseudonym `Cœur_Vaillant` to confirm" + `<Input>`
- "Delete permanently" button (variant danger), disabled until typed === current pseudonym
- On success: nothing to navigate to — RootNavigator detects `user = null` and renders Auth flow
- On error: Alert + stays on screen

### BiometricLockScreen (NEW)

File: `src/presentation/screens/BiometricLock/BiometricLockScreen.tsx` + `index.ts`

- Centered logo + title "Authentication required"
- "Unlock" button that calls `biometric.authenticate(...)` via a small wrapper (NOT a full use case since it's just one infra call; alternatively use `checkBiometricLockUseCase`)
- On mount, automatically triggers the authentication prompt
- On success, invokes an `onUnlock` callback passed via prop -> App.tsx clears its `isLocked` flag

### Navigation — MainTabNavigator (MODIFIED)

Add to `HomeStackParamList`:
```typescript
EditPseudonym: undefined;
DeleteAccountConfirm: undefined;
```

Add screens to `HomeStackNavigator`. `BiometricLockScreen` is NOT in the navigator — it's rendered outside the NavigationContainer in App.tsx (full screen overlay).

### App.tsx (MODIFIED)

- New state `const [isLocked, setIsLocked] = useState(false);`
- New `useEffect` (run on mount + auth changes): if `useAuthStore.user` present -> call `checkBiometricLockUseCase` -> if locked, `setIsLocked(true)`
- Track AppState via `AppState.addEventListener`: when going to background, record `lastActiveAt`; on active, if elapsed >5 min AND biometrics enabled, re-run check
- In render: if `isLocked === true` AND `user` present -> render `<BiometricLockScreen onUnlock={() => setIsLocked(false)} />` INSTEAD of `<NavigationContainer><RootNavigator /></NavigationContainer>`

## i18n Keys

### Extensions to `profile`
- `editPseudonym`, `editPseudonymTitle`, `editPseudonymNote`
- `myData`, `exportData`, `exportSuccess`, `exportError`
- `biometricsUnavailable`, `biometricsNotEnrolled`
- `pseudonymUpdated`, `errorPseudonymTaken`, `errorPseudonymInvalid`, `errorUpdateFailed`

### New section `deleteAccount`
- `title`, `warningTitle`, `warningSubtitle`
- `consequence1`, `consequence2`, `consequence3`
- `typePseudonymLabel`, `typePseudonymHint` (with `{{pseudo}}`)
- `confirmButton`, `errorMismatch`, `errorFailed`

### New section `biometricLock`
- `title`, `subtitle`, `unlockButton`, `errorFailed`, `errorCancelled`

All keys in both `fr.json` and `en.json` with parity.

## Files

### New files
- `src/application/usecases/profile/checkBiometricLockUseCase.ts`
- `src/application/usecases/profile/toggleBiometricsUseCase.ts`
- `src/application/usecases/profile/toggleNotificationsUseCase.ts`
- `src/application/usecases/profile/updatePseudonymUseCase.ts`
- `src/application/usecases/profile/exportUserDataUseCase.ts`
- `src/application/usecases/profile/deleteAccountUseCase.ts`
- `src/application/usecases/profile/index.ts`
- `src/infrastructure/biometrics/BiometricService.ts`
- `src/presentation/screens/EditPseudonym/EditPseudonymScreen.tsx`
- `src/presentation/screens/EditPseudonym/index.ts`
- `src/presentation/screens/DeleteAccountConfirm/DeleteAccountConfirmScreen.tsx`
- `src/presentation/screens/DeleteAccountConfirm/index.ts`
- `src/presentation/screens/BiometricLock/BiometricLockScreen.tsx`
- `src/presentation/screens/BiometricLock/index.ts`
- `supabase/migrations/004_delete_my_account.sql`

### Modified files
- `src/domain/interfaces/repositories.ts` — add `IBiometricService`, extend `IAuthService.deleteCurrentAccount`, extend `ISecureStorageService.clearAll`
- `src/infrastructure/auth/AuthService.ts` — implement `deleteCurrentAccount`
- `src/infrastructure/storage/SecureStorageService.ts` — implement `clearAll` + session index
- `src/infrastructure/index.ts` — export `BiometricService`
- `src/application/interfaces/container.ts` — add `biometric` slot
- `src/application/index.ts` — export new use cases
- `src/presentation/screens/Profile/ProfileScreen.tsx` — wire switches, add sections, navigation calls
- `src/presentation/components/navigation/MainTabNavigator.tsx` — `EditPseudonym` and `DeleteAccountConfirm` routes
- `App.tsx` — wire `biometric` into container, add lock state + AppState listener, render BiometricLockScreen when locked
- `src/infrastructure/i18n/locales/fr.json` — new keys
- `src/infrastructure/i18n/locales/en.json` — new keys

### Dependencies
- `expo-file-system` (probably already a transitive dep; install via `npx expo install` if not)
- `expo-sharing` (already in package.json)
- `expo-local-authentication` (already in package.json)

## Out of Scope (deferred)

- Push notifications wiring (Sprint 6 — Edge Functions)
- Resources & Legal pages (Sprint 5b)
- Light theme + theme switcher (Sprint 7)
- Avatar upload (later)
- Email change (later)
- Re-authentication before sensitive actions beyond biometrics (later)
