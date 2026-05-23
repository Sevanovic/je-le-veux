# Sprint 3 — Receive Invitation, Accept/Refuse, Confirmation

> Design spec for Sprint 3 of Je Le Veux.
> Approved 2026-05-09.

## Goal

Allow a receiver to join an invitation (via shareCode or QR), read the decrypted statement, accept or refuse it, and let both parties see the confirmed consent in real time.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Receiver code entry | Manual + QR scan (Option C) | Maximum flexibility. Manual entry uses paste, QR uses camera. |
| Statement decryption | Session key in QR (Option A) | Truly E2E. Server never sees plaintext. Refactor of Sprint 2 needed. |
| Manual entry format | Combined `JLV-YYYY-XXXX-XXXX#sessionKey` (Option B) | Single share format. Same data in QR and manual entry. |
| Initiator notification | Supabase Realtime (Option B) | Instant feedback inside app. No push infra needed (Sprint 5). |
| Join screen location | Secondary button on Home (Option A) | Discoverable, no nav clutter, matches "start a flow" UX. |

## Architecture

### Refactor Sprint 2 — Symmetric Encryption (prerequisite)

Sprint 2 used asymmetric `encrypt(statement, initiatorPublicKey, initiatorSecretKey)`. Only the initiator could decrypt. For Sprint 3, the receiver must read the statement before accepting, but the server must never see plaintext. Solution: encrypt statement with a random symmetric session key, transmit the session key out-of-band via QR code.

**Changes:**
- `ICryptoService` gains `generateSymmetricKey()`, `encryptSymmetric(message, key)`, `decryptSymmetric(ciphertext, key)`
- `CryptoService` implements via TweetNaCl `secretbox` (XSalsa20-Poly1305)
- `createConsentUseCase` generates session key, encrypts statement+conditions with it, persists key locally as `jeleveux.session.<consentId>` so initiator can re-read later, returns `shareCode = secureCode + '#' + sessionKey` in output
- `CreateConsentScreen` QR encodes `shareCode`, copy/share use `shareCode`. Display shows `secureCode` for human readability.

### Receive Invitation Flow

```
HomeScreen ("Rejoindre une invitation")
  -> JoinInvitationScreen
    -> Manual paste OR QR scan -> shareCode
    -> joinInvitationUseCase(shareCode)
      -> Parse shareCode (split on '#')
      -> consent.findBySecureCode(secureCode)
      -> invitation.findByLink(secureCode), check TTL + isUsed
      -> crypto.decryptSymmetric(encryptedStatement, sessionKey)
      -> crypto.decryptSymmetric(encryptedConditions, sessionKey) if present
      -> Return { consent, decryptedStatement, decryptedConditions?, invitation }
    -> Navigate to InvitationReceivedScreen with full payload
  -> InvitationReceivedScreen
    -> Renders pseudonym, decrypted statement, level, duration
    -> Receiver enters their pseudonym
    -> Accept -> acceptInvitationUseCase -> Navigate to ConfirmationScreen
    -> Refuse -> refuseInvitationUseCase -> Navigate back to Home
    -> Unsure -> Show toast, no state change
  -> ConfirmationScreen reads consent from Zustand store via consentId param
```

### Realtime Initiator Updates

`ConsentRepository.subscribeToUserConsents(userId, onChange)` wraps Supabase Realtime channel filtered on `initiator_id = userId`, listens for UPDATE events, calls `onChange(consent)` on each change. Returns `{ unsubscribe }`.

Wired in `App.tsx` after auth restore: subscribe when user signs in, unsubscribe on sign out. Callback updates `useConsentStore.updateConsent()`.

## Use Cases

### joinInvitationUseCase

**Input:** `{ shareCode: string }`

**Output:** `{ consent: Consent, decryptedStatement: string, decryptedConditions?: string, invitation: Invitation }`

**Steps:**
1. Parse `shareCode` — split on `#`. If format invalid, throw `INVALID_FORMAT`.
2. Validate secureCode regex (`^JLV-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$`).
3. `consent.findBySecureCode(secureCode)` — if null, throw `CONSENT_NOT_FOUND`.
4. If consent.status is not PENDING, throw `CONSENT_NOT_PENDING`.
5. `invitation.findByLink(secureCode)` — if null, throw `CONSENT_NOT_FOUND`.
6. If `invitation.isUsed`, throw `INVITATION_USED`.
7. If `!isInvitationValid(invitation)` (TTL check), throw `INVITATION_EXPIRED`.
8. `crypto.decryptSymmetric(consent.encryptedStatement, sessionKey)` — on failure, throw `DECRYPT_FAILED`.
9. If `consent.encryptedConditions`, decrypt similarly.
10. Return payload.

### acceptInvitationUseCase

**Input:** `{ consentId: string, invitationId: string, receiverId: string, receiverPseudonym: string }`

**Output:** `{ consent: Consent }` (updated)

**Steps:**
1. `isValidPseudonym(receiverPseudonym)` — else throw `INVALID_PSEUDONYM`.
2. `consent.findById(consentId)` — verify exists and status is PENDING, else throw.
3. Compute `acceptedAt = new Date()`, `expiresAt = acceptedAt + durationMinutes * 60_000`.
4. `consent.updateStatus(consentId, ACTIVE, { receiverId, receiverPseudonym, acceptedAt, expiresAt })`.
5. `invitation.markAsUsed(invitationId)`.
6. Return updated consent.

**Errors:** `INVALID_PSEUDONYM`, `CONSENT_NOT_FOUND`, `CONSENT_NOT_PENDING`, `UPDATE_FAILED`

### refuseInvitationUseCase

**Input:** `{ consentId: string, invitationId: string }`

**Output:** `{ consent: Consent }`

**Steps:**
1. `consent.findById(consentId)` — verify PENDING.
2. `consent.updateStatus(consentId, REFUSED, { refusedAt: new Date() })`.
3. `invitation.markAsUsed(invitationId)`.
4. Return updated consent.

**Errors:** `CONSENT_NOT_FOUND`, `CONSENT_NOT_PENDING`, `UPDATE_FAILED`

## Repositories

### ConsentRepository — new method

```typescript
subscribeToUserConsents(
  userId: string,
  onChange: (consent: Consent) => void,
): { unsubscribe: () => void }
```

Wraps Supabase Realtime:
- Channel name: `consents:user:${userId}`
- Filter: `initiator_id=eq.${userId}` AND (later, OR `receiver_id=eq.${userId}`)
- Event: UPDATE on `consents` table
- On each event: call `onChange(toEntity(payload.new))`
- Return: `{ unsubscribe: () => supabase.removeChannel(channel) }`

Note: receiver-side subscription is also needed but the `receiver_id` filter is added once we know the user is a receiver. For Sprint 3, both filters are wired so initiator and receiver both get updates.

### IConsentRepository (domain interface) — add method signature

Same signature as above, added to `src/domain/interfaces/repositories.ts`.

## Screens

### JoinInvitationScreen (NEW)

`src/presentation/screens/JoinInvitation/JoinInvitationScreen.tsx`

- Header with back button, title from i18n
- Description text explaining manual vs QR options
- Text input for shareCode (with paste support, autoCapitalize off)
- Primary button "Submit" calling `joinInvitationUseCase`
- Secondary button "Scan QR" — opens camera modal using `expo-camera`
- Loading state during use case execution
- Errors via Alert with i18n messages
- On success: `navigation.replace('InvitationReceived', { consent, decryptedStatement, decryptedConditions, invitation })`

### InvitationReceivedScreen (MODIFIED)

Existing shell at `src/presentation/screens/InvitationReceived/InvitationReceivedScreen.tsx`.

- Receives navigation params: `{ consent, decryptedStatement, decryptedConditions?, invitation }`
- Adds Input for `receiverPseudonym` at top (default empty)
- Renders real data: `consent.initiatorPseudonym`, `decryptedStatement`, `t('createConsent.level' + capitalize(consent.level))`, formatted duration
- Accept button calls `acceptInvitationUseCase`, on success navigates to `Confirmation` with `{ consentId }`
- Refuse button calls `refuseInvitationUseCase`, on success navigates back to `Home`
- Unsure button shows existing alert (unchanged)
- Loading state during async operations
- Errors via Alert

### ConfirmationScreen (MODIFIED)

Existing shell at `src/presentation/screens/Confirmation/ConfirmationScreen.tsx`.

- Receives `{ consentId }` route param (already typed in MainTabNavigator)
- Reads consent from `useConsentStore.consents.find(c => c.id === consentId)`
- If not found, shows error state with back button
- Renders real data: `consent.initiatorPseudonym`, `consent.receiverPseudonym`, level, formatted timestamps (acceptedAt / expiresAt), `secureCode`
- Withdraw button stays as Sprint 4 placeholder

### HomeScreen (MODIFIED)

Add a secondary button "Rejoindre une invitation" below the existing "Nouveau consentement" button. On press, navigates to `JoinInvitation` route within the Home stack.

### Navigation — MainTabNavigator.tsx (MODIFIED)

Update `HomeStackParamList`:
```typescript
export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    decryptedStatement: string;
    decryptedConditions?: string;
    invitation: Invitation;
  };
  Confirmation: { consentId: string };
  Profile: undefined;
};
```

Add `<HomeStack.Screen name="JoinInvitation" component={JoinInvitationScreen} />`.

## App.tsx — Realtime wiring

After successful session restore and user is signed in:
```typescript
const subscription = consentRepository.subscribeToUserConsents(user.id, (updated) => {
  useConsentStore.getState().updateConsent(updated.id, updated);
});
return () => subscription.unsubscribe();
```

Subscription lifecycle tied to authenticated user via useEffect dependency.

## i18n Keys

### New section `joinInvitation` (FR + EN)
- `title`, `subtitle`, `codeLabel`, `codePlaceholder`, `scanButton`, `submitButton`
- `cameraPermission`, `cameraPermissionDeniedMessage`
- `errorInvalidFormat`, `errorNotFound`, `errorExpired`, `errorAlreadyUsed`, `errorDecryptFailed`
- `errorConsentNotPending`

### Extensions to `invitation`
- `receiverPseudonymLabel`, `receiverPseudonymPlaceholder`
- `acceptSuccess`, `refuseSuccess`
- `errorPseudonymInvalid`, `errorAcceptFailed`, `errorRefuseFailed`

### Extension to `home`
- `joinInvitation` (button label)

All keys in both `fr.json` and `en.json`.

## Files

### New files
- `src/application/usecases/consent/joinInvitationUseCase.ts`
- `src/application/usecases/consent/acceptInvitationUseCase.ts`
- `src/application/usecases/consent/refuseInvitationUseCase.ts`
- `src/presentation/screens/JoinInvitation/JoinInvitationScreen.tsx`
- `src/presentation/screens/JoinInvitation/index.ts`

### Modified files
- `src/domain/interfaces/repositories.ts` — add `subscribeToUserConsents` to IConsentRepository
- `src/domain/interfaces/repositories.ts` — add 3 new symmetric methods to ICryptoService
- `src/infrastructure/crypto/CryptoService.ts` — implement symmetric methods
- `src/infrastructure/repositories/ConsentRepository.ts` — implement `subscribeToUserConsents`
- `src/application/usecases/consent/createConsentUseCase.ts` — switch to symmetric encryption + return shareCode
- `src/application/usecases/consent/index.ts` — export new use cases
- `src/application/index.ts` — export new use cases
- `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx` — QR encodes shareCode, copy uses shareCode
- `src/presentation/screens/InvitationReceived/InvitationReceivedScreen.tsx` — wire to use cases, real data
- `src/presentation/screens/Confirmation/ConfirmationScreen.tsx` — read from store, real data
- `src/presentation/screens/Home/HomeScreen.tsx` — add "Rejoindre" button
- `src/presentation/components/navigation/MainTabNavigator.tsx` — extend HomeStackParamList, add JoinInvitation route
- `App.tsx` — wire realtime subscription
- `src/infrastructure/i18n/locales/fr.json` — new keys
- `src/infrastructure/i18n/locales/en.json` — new keys

### Dependencies to install
- `expo-camera` — for QR scanning

## Out of Scope (deferred)

- Push notifications (Sprint 5)
- Withdrawal flow (Sprint 4)
- Auto-expiration cron (Sprint 4)
- History screen (Sprint 4)
- Initiator re-encryption for asymmetric keys (not needed with symmetric approach)
