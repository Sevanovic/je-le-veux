# Sprint 3 — Receive Invitation, Accept/Refuse, Confirmation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a receiver to join an E2E-encrypted consent via shareCode/QR, read its statement, accept or refuse, and let both parties see the result in real time.

**Architecture:** Refactor Sprint 2 to use symmetric encryption (TweetNaCl secretbox) with session key passed via QR/shareCode (out-of-band). Add new use cases (join/accept/refuse) and a JoinInvitation screen. Wire Supabase Realtime so the initiator gets instant updates when the receiver responds.

**Tech Stack:** TweetNaCl (secretbox), Supabase Realtime, expo-camera, react-native-qrcode-svg, Zustand

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/domain/interfaces/repositories.ts` | Add 3 symmetric methods to ICryptoService + subscribeToUserConsents to IConsentRepository |
| Modify | `src/infrastructure/crypto/CryptoService.ts` | Implement generateSymmetricKey/encryptSymmetric/decryptSymmetric |
| Modify | `src/infrastructure/repositories/ConsentRepository.ts` | Implement subscribeToUserConsents (Supabase Realtime) |
| Modify | `src/application/usecases/consent/createConsentUseCase.ts` | Switch to symmetric encryption + return shareCode |
| Create | `src/application/usecases/consent/joinInvitationUseCase.ts` | Parse shareCode, fetch consent + invitation, decrypt statement |
| Create | `src/application/usecases/consent/acceptInvitationUseCase.ts` | Update consent to ACTIVE with receiver info |
| Create | `src/application/usecases/consent/refuseInvitationUseCase.ts` | Update consent to REFUSED |
| Modify | `src/application/usecases/consent/index.ts` | Export new use cases |
| Modify | `src/application/index.ts` | Export new use cases |
| Create | `src/presentation/screens/JoinInvitation/JoinInvitationScreen.tsx` | UI to enter/scan shareCode |
| Create | `src/presentation/screens/JoinInvitation/index.ts` | Barrel |
| Modify | `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx` | QR/copy/share use shareCode |
| Modify | `src/presentation/screens/InvitationReceived/InvitationReceivedScreen.tsx` | Wire to use cases, real data, receiver pseudonym input |
| Modify | `src/presentation/screens/Confirmation/ConfirmationScreen.tsx` | Read consent from store, real data |
| Modify | `src/presentation/screens/Home/HomeScreen.tsx` | Add "Rejoindre" button |
| Modify | `src/presentation/components/navigation/MainTabNavigator.tsx` | Extend HomeStackParamList, add JoinInvitation route |
| Modify | `App.tsx` | Wire Realtime subscription |
| Modify | `src/infrastructure/i18n/locales/fr.json` | New keys (joinInvitation section + extensions) |
| Modify | `src/infrastructure/i18n/locales/en.json` | New keys (parity) |

---

## Task 1: Install expo-camera

**Files:** `package.json`

- [ ] **Step 1: Install expo-camera via Expo CLI**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx expo install expo-camera
```

Expected: `expo-camera` added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify installation**

Run:
```bash
grep '"expo-camera"' /Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/package.json
```

Expected: matches `"expo-camera": "^x.y.z"`.

---

## Task 2: Extend ICryptoService interface

**Files:**
- Modify: `src/domain/interfaces/repositories.ts`

- [ ] **Step 1: Add 3 symmetric methods to ICryptoService**

Locate the `ICryptoService` interface (around line 71) and replace it with:

```typescript
export interface ICryptoService {
  generateKeyPair(): Promise<{ publicKey: string; secretKey: string }>;
  encrypt(message: string, recipientPublicKey: string, senderSecretKey: string): Promise<string>;
  decrypt(encryptedMessage: string, senderPublicKey: string, recipientSecretKey: string): Promise<string>;

  /** Generate a random 32-byte symmetric key, base64 encoded. */
  generateSymmetricKey(): Promise<string>;
  /** Encrypt with TweetNaCl secretbox. Nonce prepended to ciphertext, all base64. */
  encryptSymmetric(message: string, key: string): Promise<string>;
  /** Decrypt a secretbox ciphertext with the given key. */
  decryptSymmetric(ciphertext: string, key: string): Promise<string>;
}
```

- [ ] **Step 2: Add subscribeToUserConsents to IConsentRepository**

Locate the `IConsentRepository` interface (around line 11) and add this method at the end (before the closing brace):

```typescript
  /**
   * Subscribe to changes on consents where the user is initiator OR receiver.
   * Returns an unsubscribe function. Used by App.tsx for realtime updates.
   */
  subscribeToUserConsents(
    userId: string,
    onChange: (consent: Consent) => void,
  ): { unsubscribe: () => void };
```

So the interface becomes:

```typescript
export interface IConsentRepository {
  create(dto: CreateConsentDTO): Promise<Consent>;
  findById(id: string): Promise<Consent | null>;
  findBySecureCode(code: string): Promise<Consent | null>;
  findByUserId(userId: string): Promise<Consent[]>;
  findByStatus(userId: string, status: ConsentStatus): Promise<Consent[]>;
  updateStatus(id: string, status: ConsentStatus, metadata?: Record<string, unknown>): Promise<Consent>;
  delete(id: string): Promise<void>;
  subscribeToUserConsents(
    userId: string,
    onChange: (consent: Consent) => void,
  ): { unsubscribe: () => void };
}
```

---

## Task 3: Implement symmetric methods in CryptoService

**Files:**
- Modify: `src/infrastructure/crypto/CryptoService.ts`

- [ ] **Step 1: Add the 3 symmetric methods**

Add these methods inside the `CryptoService` class (after the existing `decrypt` method, before the closing brace):

```typescript
  /**
   * Generate a random 32-byte symmetric key.
   * Encoded in base64 for transport in QR codes / shareCode.
   */
  async generateSymmetricKey(): Promise<string> {
    const key = nacl.randomBytes(nacl.secretbox.keyLength);
    return naclUtil.encodeBase64(key);
  }

  /**
   * Encrypt a message with a symmetric key using TweetNaCl secretbox
   * (XSalsa20-Poly1305). Nonce is prepended to ciphertext, all base64.
   */
  async encryptSymmetric(message: string, key: string): Promise<string> {
    const messageUint8 = naclUtil.decodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const keyUint8 = naclUtil.decodeBase64(key);

    const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);
    if (!encrypted) {
      throw new Error('Symmetric encryption failed');
    }

    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  }

  /**
   * Decrypt a secretbox ciphertext with the given symmetric key.
   * Throws if the key is wrong or the ciphertext is corrupted.
   */
  async decryptSymmetric(ciphertext: string, key: string): Promise<string> {
    const fullMessage = naclUtil.decodeBase64(ciphertext);
    const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
    const message = fullMessage.slice(nacl.secretbox.nonceLength);
    const keyUint8 = naclUtil.decodeBase64(key);

    const decrypted = nacl.secretbox.open(message, nonce, keyUint8);
    if (!decrypted) {
      throw new Error('Symmetric decryption failed — invalid key or corrupted ciphertext');
    }

    return naclUtil.encodeUTF8(decrypted);
  }
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to `CryptoService.ts`.

---

## Task 4: Implement subscribeToUserConsents in ConsentRepository

**Files:**
- Modify: `src/infrastructure/repositories/ConsentRepository.ts`

- [ ] **Step 1: Add subscribeToUserConsents method**

Add this method at the end of the `ConsentRepository` class (before the closing brace, after `delete`):

```typescript
  subscribeToUserConsents(
    userId: string,
    onChange: (consent: Consent) => void,
  ): { unsubscribe: () => void } {
    const channel = supabase
      .channel(`consents:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consents',
          filter: `initiator_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onChange(toEntity(payload.new as Record<string, unknown>));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consents',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onChange(toEntity(payload.new as Record<string, unknown>));
          }
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 5: Refactor createConsentUseCase to symmetric encryption

**Files:**
- Modify: `src/application/usecases/consent/createConsentUseCase.ts`

- [ ] **Step 1: Replace the entire file content**

Replace `src/application/usecases/consent/createConsentUseCase.ts` with:

```typescript
import { getContainer } from '../../interfaces/container';
import { isValidPseudonym, generateSecureCode } from '../../../domain/entities';
import type { Consent, Invitation } from '../../../domain/entities';
import type { ConsentLevel } from '../../../domain/enums';

export interface CreateConsentInput {
  initiatorId: string;
  initiatorPseudonym: string;
  statement: string;
  level: ConsentLevel;
  durationMinutes: number;
  conditions?: string;
}

export interface CreateConsentOutput {
  consent: Consent;
  invitation: Invitation;
  /** Format: `JLV-YYYY-XXXX-XXXX#<sessionKey>`. To be encoded in QR / shared. */
  shareCode: string;
}

export async function createConsentUseCase(
  input: CreateConsentInput,
): Promise<CreateConsentOutput> {
  const { crypto, secureStorage, consent, invitation } = getContainer();

  // 1. Domain validation
  if (!isValidPseudonym(input.initiatorPseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }
  if (!input.statement.trim()) {
    throw new Error('INVALID_STATEMENT');
  }
  if (input.durationMinutes <= 0) {
    throw new Error('INVALID_DURATION');
  }

  // 2. Generate a random session key (symmetric, 32 bytes)
  const sessionKey = await crypto.generateSymmetricKey();

  // 3. Encrypt statement with the session key
  const encryptedStatement = await crypto.encryptSymmetric(
    input.statement,
    sessionKey,
  );

  // 4. Encrypt conditions if present
  let encryptedConditions: string | undefined;
  if (input.conditions?.trim()) {
    encryptedConditions = await crypto.encryptSymmetric(
      input.conditions,
      sessionKey,
    );
  }

  // 5. Generate secure code
  const secureCode = generateSecureCode();

  // 6. Create consent in DB
  const createdConsent = await consent.create({
    initiatorId: input.initiatorId,
    initiatorPseudonym: input.initiatorPseudonym,
    secureCode,
    statement: encryptedStatement,
    level: input.level,
    durationMinutes: input.durationMinutes,
    conditions: encryptedConditions,
  });

  // 7. Persist session key locally so initiator can re-read later
  try {
    await secureStorage.save(`jeleveux.session.${createdConsent.id}`, sessionKey);
  } catch {
    // SecureStore failure is non-blocking — initiator can recover via shareCode if they kept it
  }

  // 8. Create invitation
  const createdInvitation = await invitation.create(createdConsent.id);

  // 9. Build shareCode for out-of-band sharing
  const shareCode = `${secureCode}#${sessionKey}`;

  return { consent: createdConsent, invitation: createdInvitation, shareCode };
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 6: Create joinInvitationUseCase

**Files:**
- Create: `src/application/usecases/consent/joinInvitationUseCase.ts`

- [ ] **Step 1: Write the file**

Create `src/application/usecases/consent/joinInvitationUseCase.ts`:

```typescript
import { getContainer } from '../../interfaces/container';
import { isInvitationValid } from '../../../domain/entities';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent, Invitation } from '../../../domain/entities';

export interface JoinInvitationInput {
  /** Format: `JLV-YYYY-XXXX-XXXX#<sessionKey>` */
  shareCode: string;
}

export interface JoinInvitationOutput {
  consent: Consent;
  invitation: Invitation;
  decryptedStatement: string;
  decryptedConditions?: string;
}

const SECURE_CODE_REGEX = /^JLV-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

export async function joinInvitationUseCase(
  input: JoinInvitationInput,
): Promise<JoinInvitationOutput> {
  const { crypto, consent, invitation } = getContainer();

  // 1. Parse shareCode
  const trimmed = input.shareCode.trim();
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex < 0) {
    throw new Error('INVALID_FORMAT');
  }
  const secureCode = trimmed.slice(0, hashIndex);
  const sessionKey = trimmed.slice(hashIndex + 1);

  if (!SECURE_CODE_REGEX.test(secureCode) || !sessionKey) {
    throw new Error('INVALID_FORMAT');
  }

  // 2. Fetch consent
  const foundConsent = await consent.findBySecureCode(secureCode);
  if (!foundConsent) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (foundConsent.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Fetch invitation
  const foundInvitation = await invitation.findByLink(secureCode);
  if (!foundInvitation) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (foundInvitation.isUsed) {
    throw new Error('INVITATION_USED');
  }
  if (!isInvitationValid(foundInvitation)) {
    throw new Error('INVITATION_EXPIRED');
  }

  // 4. Decrypt statement
  let decryptedStatement: string;
  try {
    decryptedStatement = await crypto.decryptSymmetric(
      foundConsent.encryptedStatement,
      sessionKey,
    );
  } catch {
    throw new Error('DECRYPT_FAILED');
  }

  // 5. Decrypt conditions if present
  let decryptedConditions: string | undefined;
  if (foundConsent.encryptedConditions) {
    try {
      decryptedConditions = await crypto.decryptSymmetric(
        foundConsent.encryptedConditions,
        sessionKey,
      );
    } catch {
      throw new Error('DECRYPT_FAILED');
    }
  }

  return {
    consent: foundConsent,
    invitation: foundInvitation,
    decryptedStatement,
    decryptedConditions,
  };
}
```

---

## Task 7: Create acceptInvitationUseCase

**Files:**
- Create: `src/application/usecases/consent/acceptInvitationUseCase.ts`

- [ ] **Step 1: Write the file**

Create `src/application/usecases/consent/acceptInvitationUseCase.ts`:

```typescript
import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface AcceptInvitationInput {
  consentId: string;
  invitationId: string;
  receiverId: string;
  receiverPseudonym: string;
}

export interface AcceptInvitationOutput {
  consent: Consent;
}

export async function acceptInvitationUseCase(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationOutput> {
  const { consent, invitation } = getContainer();

  // 1. Validate pseudonym
  if (!isValidPseudonym(input.receiverPseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }

  // 2. Verify consent state
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Compute timestamps
  const acceptedAt = new Date();
  const expiresAt = new Date(acceptedAt.getTime() + existing.durationMinutes * 60_000);

  // 4. Update consent to ACTIVE
  const updated = await consent.updateStatus(input.consentId, ConsentStatus.ACTIVE, {
    receiverId: input.receiverId,
    receiverPseudonym: input.receiverPseudonym,
    acceptedAt: acceptedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  // 5. Mark invitation as used
  await invitation.markAsUsed(input.invitationId);

  return { consent: updated };
}
```

---

## Task 8: Create refuseInvitationUseCase

**Files:**
- Create: `src/application/usecases/consent/refuseInvitationUseCase.ts`

- [ ] **Step 1: Write the file**

Create `src/application/usecases/consent/refuseInvitationUseCase.ts`:

```typescript
import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface RefuseInvitationInput {
  consentId: string;
  invitationId: string;
}

export interface RefuseInvitationOutput {
  consent: Consent;
}

export async function refuseInvitationUseCase(
  input: RefuseInvitationInput,
): Promise<RefuseInvitationOutput> {
  const { consent, invitation } = getContainer();

  // 1. Verify consent state
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 2. Update consent to REFUSED
  const updated = await consent.updateStatus(input.consentId, ConsentStatus.REFUSED, {
    refusedAt: new Date().toISOString(),
  });

  // 3. Mark invitation as used (no further action possible)
  await invitation.markAsUsed(input.invitationId);

  return { consent: updated };
}
```

---

## Task 9: Update use case barrel exports

**Files:**
- Modify: `src/application/usecases/consent/index.ts`
- Modify: `src/application/index.ts`

- [ ] **Step 1: Replace `src/application/usecases/consent/index.ts` content**

```typescript
export { createConsentUseCase } from './createConsentUseCase';
export type { CreateConsentInput, CreateConsentOutput } from './createConsentUseCase';

export { createInvitationUseCase } from './createInvitationUseCase';
export type { CreateInvitationInput, CreateInvitationOutput } from './createInvitationUseCase';

export { joinInvitationUseCase } from './joinInvitationUseCase';
export type { JoinInvitationInput, JoinInvitationOutput } from './joinInvitationUseCase';

export { acceptInvitationUseCase } from './acceptInvitationUseCase';
export type { AcceptInvitationInput, AcceptInvitationOutput } from './acceptInvitationUseCase';

export { refuseInvitationUseCase } from './refuseInvitationUseCase';
export type { RefuseInvitationInput, RefuseInvitationOutput } from './refuseInvitationUseCase';
```

- [ ] **Step 2: Update `src/application/index.ts`**

Replace the existing `export { ... } from './usecases/consent';` line with:

```typescript
export {
  createConsentUseCase,
  createInvitationUseCase,
  joinInvitationUseCase,
  acceptInvitationUseCase,
  refuseInvitationUseCase,
} from './usecases/consent';
```

---

## Task 10: Update CreateConsentScreen to use shareCode

**Files:**
- Modify: `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx`

- [ ] **Step 1: Add shareCode state**

In the component, add a new state next to `createdInvitation`:

```typescript
const [shareCode, setShareCode] = useState<string | null>(null);
```

- [ ] **Step 2: Update handleSend to capture shareCode**

In `handleSend`, after `addConsent(result.consent);`, add:

```typescript
setShareCode(result.shareCode);
```

The full block becomes:

```typescript
addConsent(result.consent);
setCreatedConsent(result.consent);
setCreatedInvitation(result.invitation);
setShareCode(result.shareCode);
```

- [ ] **Step 3: Update handleShare and handleCopyCode**

Replace `handleShare`:

```typescript
const handleShare = async () => {
  if (!shareCode) return;
  await Share.share({
    message: t('createConsent.shareMessage', { code: shareCode }),
  });
};
```

Replace `handleCopyCode`:

```typescript
const handleCopyCode = async () => {
  if (!shareCode) return;
  await Clipboard.setStringAsync(shareCode);
  setCodeCopied(true);
  setTimeout(() => setCodeCopied(false), 2000);
};
```

- [ ] **Step 4: Update QR value**

Find the `<QRCode ... />` element. Change:

```typescript
value={createdConsent.secureCode}
```

to:

```typescript
value={shareCode ?? createdConsent.secureCode}
```

- [ ] **Step 5: Update success view condition**

Find the line `if (createdConsent && createdInvitation) {` and change to:

```typescript
if (createdConsent && createdInvitation && shareCode) {
```

- [ ] **Step 6: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 11: Add i18n keys (FR + EN)

**Files:**
- Modify: `src/infrastructure/i18n/locales/fr.json`
- Modify: `src/infrastructure/i18n/locales/en.json`

- [ ] **Step 1: Add `joinInvitation` section + extensions to fr.json**

In `src/infrastructure/i18n/locales/fr.json`, after the `"createConsent": { ... }` block, ADD a new top-level section:

```json
"joinInvitation": {
  "title": "Rejoindre une invitation",
  "subtitle": "Saisissez le code reçu ou scannez le QR code partagé par l'initiateur.",
  "codeLabel": "Code d'invitation",
  "codePlaceholder": "JLV-2026-XXXX-XXXX#...",
  "scanButton": "Scanner le QR code",
  "submitButton": "Continuer",
  "cameraPermission": "Autorisation caméra requise pour scanner.",
  "cameraPermissionDeniedMessage": "Vous pouvez activer l'accès caméra dans les réglages, ou saisir le code manuellement.",
  "errorInvalidFormat": "Format de code invalide. Le format attendu est JLV-YYYY-XXXX-XXXX#clé.",
  "errorNotFound": "Cette invitation est introuvable. Vérifiez le code.",
  "errorExpired": "Cette invitation a expiré.",
  "errorAlreadyUsed": "Cette invitation a déjà été utilisée.",
  "errorDecryptFailed": "Impossible de déchiffrer l'énoncé. La clé est invalide.",
  "errorConsentNotPending": "Ce consentement n'est plus en attente de réponse."
},
```

In the same file, inside the `"invitation": { ... }` block, ADD these keys (after the existing keys, before the closing brace):

```json
"receiverPseudonymLabel": "Votre pseudonyme",
"receiverPseudonymPlaceholder": "Choisissez un pseudonyme pour cette acceptation",
"acceptSuccess": "Vous avez accepté librement.",
"refuseSuccess": "Vous avez refusé l'invitation.",
"errorPseudonymInvalid": "Le pseudonyme doit contenir 3 à 30 caractères.",
"errorAcceptFailed": "Impossible d'accepter. Veuillez réessayer.",
"errorRefuseFailed": "Impossible de refuser. Veuillez réessayer."
```

In the `"home": { ... }` block, ADD:

```json
"joinInvitation": "Rejoindre une invitation"
```

- [ ] **Step 2: Add the same structure to en.json with English values**

In `src/infrastructure/i18n/locales/en.json`, after `"createConsent": { ... }`, ADD:

```json
"joinInvitation": {
  "title": "Join an invitation",
  "subtitle": "Enter the code you received or scan the QR code shared by the initiator.",
  "codeLabel": "Invitation code",
  "codePlaceholder": "JLV-2026-XXXX-XXXX#...",
  "scanButton": "Scan QR code",
  "submitButton": "Continue",
  "cameraPermission": "Camera permission required to scan.",
  "cameraPermissionDeniedMessage": "You can enable camera access in settings, or enter the code manually.",
  "errorInvalidFormat": "Invalid code format. Expected format is JLV-YYYY-XXXX-XXXX#key.",
  "errorNotFound": "This invitation cannot be found. Check the code.",
  "errorExpired": "This invitation has expired.",
  "errorAlreadyUsed": "This invitation has already been used.",
  "errorDecryptFailed": "Unable to decrypt the statement. The key is invalid.",
  "errorConsentNotPending": "This consent is no longer awaiting a response."
},
```

In the `"invitation": { ... }` block, ADD:

```json
"receiverPseudonymLabel": "Your pseudonym",
"receiverPseudonymPlaceholder": "Choose a pseudonym for this acceptance",
"acceptSuccess": "You freely accepted.",
"refuseSuccess": "You refused the invitation.",
"errorPseudonymInvalid": "Pseudonym must be 3-30 characters.",
"errorAcceptFailed": "Unable to accept. Please try again.",
"errorRefuseFailed": "Unable to refuse. Please try again."
```

In the `"home": { ... }` block, ADD:

```json
"joinInvitation": "Join an invitation"
```

- [ ] **Step 3: Verify FR/EN parity**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" node -e "
const fr = require('./src/infrastructure/i18n/locales/fr.json');
const en = require('./src/infrastructure/i18n/locales/en.json');
const getKeys = (obj, prefix='') => Object.keys(obj).reduce((acc, k) => {
  const key = prefix ? prefix+'.'+k : k;
  if (typeof obj[k] === 'object') return [...acc, ...getKeys(obj[k], key)];
  return [...acc, key];
}, []);
const frKeys = getKeys(fr).sort();
const enKeys = getKeys(en).sort();
const missingEn = frKeys.filter(k => !enKeys.includes(k));
const missingFr = enKeys.filter(k => !frKeys.includes(k));
if (missingEn.length) console.log('Missing in EN:', missingEn);
if (missingFr.length) console.log('Missing in FR:', missingFr);
if (!missingEn.length && !missingFr.length) console.log('OK: parity. Total:', frKeys.length);
"
```

Expected: `OK: parity. Total: <number>`.

---

## Task 12: Create JoinInvitationScreen

**Files:**
- Create: `src/presentation/screens/JoinInvitation/JoinInvitationScreen.tsx`
- Create: `src/presentation/screens/JoinInvitation/index.ts`

- [ ] **Step 1: Create the screen**

Create `src/presentation/screens/JoinInvitation/JoinInvitationScreen.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { joinInvitationUseCase } from '../../../application';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type JoinNav = NativeStackNavigationProp<HomeStackParamList, 'JoinInvitation'>;

export function JoinInvitationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<JoinNav>();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const submit = async (shareCode: string) => {
    setIsSubmitting(true);
    try {
      const result = await joinInvitationUseCase({ shareCode });
      navigation.replace('InvitationReceived', {
        consent: result.consent,
        invitation: result.invitation,
        decryptedStatement: result.decryptedStatement,
        decryptedConditions: result.decryptedConditions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const errorKeyMap: Record<string, string> = {
        INVALID_FORMAT: 'joinInvitation.errorInvalidFormat',
        CONSENT_NOT_FOUND: 'joinInvitation.errorNotFound',
        CONSENT_NOT_PENDING: 'joinInvitation.errorConsentNotPending',
        INVITATION_USED: 'joinInvitation.errorAlreadyUsed',
        INVITATION_EXPIRED: 'joinInvitation.errorExpired',
        DECRYPT_FAILED: 'joinInvitation.errorDecryptFailed',
      };
      const key = errorKeyMap[message] ?? 'errors.generic';
      Alert.alert(t('common.error'), t(key));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!code.trim()) return;
    submit(code.trim());
  };

  const handleScanPress = async () => {
    if (!permission) return;
    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          t('joinInvitation.cameraPermission'),
          t('joinInvitation.cameraPermissionDeniedMessage'),
        );
        return;
      }
    }
    setScannerOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScannerOpen(false);
    setCode(data);
    submit(data);
  };

  return (
    <ScreenWrapper>
      <Header title={t('joinInvitation.title')} showBack />

      <View style={styles.content}>
        <Text style={styles.subtitle}>{t('joinInvitation.subtitle')}</Text>

        <Input
          label={t('joinInvitation.codeLabel')}
          placeholder={t('joinInvitation.codePlaceholder')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          testID="join-code-input"
        />

        <Button
          title={t('joinInvitation.scanButton')}
          variant="secondary"
          onPress={handleScanPress}
          testID="join-scan-btn"
        />

        <Button
          title={t('joinInvitation.submitButton')}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!code.trim() || isSubmitting}
          testID="join-submit-btn"
        />
      </View>

      <Modal visible={scannerOpen} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerFooter}>
            <Button
              title={t('common.cancel')}
              variant="ghost"
              onPress={() => setScannerOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  camera: {
    flex: 1,
  },
  scannerFooter: {
    padding: spacing.lg,
    backgroundColor: colors.background.card,
  },
});
```

- [ ] **Step 2: Create barrel export**

Create `src/presentation/screens/JoinInvitation/index.ts`:

```typescript
export { JoinInvitationScreen } from './JoinInvitationScreen';
```

---

## Task 13: Update MainTabNavigator types and route

**Files:**
- Modify: `src/presentation/components/navigation/MainTabNavigator.tsx`

- [ ] **Step 1: Add type imports at top**

Add this import at the top of `src/presentation/components/navigation/MainTabNavigator.tsx`, after the existing screen imports:

```typescript
import { JoinInvitationScreen } from '../../screens/JoinInvitation';
import type { Consent, Invitation } from '../../../domain/entities';
```

- [ ] **Step 2: Update HomeStackParamList**

Replace the existing `HomeStackParamList` type with:

```typescript
export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    invitation: Invitation;
    decryptedStatement: string;
    decryptedConditions?: string;
  };
  Confirmation: { consentId: string };
  Profile: undefined;
};
```

- [ ] **Step 3: Add JoinInvitation screen to HomeStackNavigator**

In the `HomeStackNavigator` function, add a new screen entry after the `Home` screen:

```typescript
<HomeStack.Screen name="JoinInvitation" component={JoinInvitationScreen} />
```

The full navigator becomes:

```typescript
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="JoinInvitation" component={JoinInvitationScreen} />
      <HomeStack.Screen name="Confirmation" component={ConfirmationScreen} />
      <HomeStack.Screen
        name="InvitationReceived"
        component={InvitationReceivedScreen}
      />
      <HomeStack.Screen name="Profile" component={ProfileScreen} />
    </HomeStack.Navigator>
  );
}
```

---

## Task 14: Add "Rejoindre" button on HomeScreen

**Files:**
- Modify: `src/presentation/screens/Home/HomeScreen.tsx`

- [ ] **Step 1: Add the button**

In `src/presentation/screens/Home/HomeScreen.tsx`, locate the existing CTA `<View style={styles.cta}>` block:

```typescript
{/* CTA */}
<View style={styles.cta}>
  <Button
    title={t('home.newConsent')}
    onPress={() =>
      navigation.getParent()?.navigate('CreateTab')
    }
    testID="home-new-consent-btn"
  />
</View>
```

Replace with:

```typescript
{/* CTA */}
<View style={styles.cta}>
  <Button
    title={t('home.newConsent')}
    onPress={() =>
      navigation.getParent()?.navigate('CreateTab')
    }
    testID="home-new-consent-btn"
  />
  <Button
    title={t('home.joinInvitation')}
    variant="secondary"
    onPress={() => navigation.navigate('JoinInvitation')}
    testID="home-join-invitation-btn"
  />
</View>
```

- [ ] **Step 2: Update CTA style for spacing**

In the `styles` object at the bottom of the file, replace the `cta` style:

```typescript
cta: {
  marginBottom: spacing['2xl'],
},
```

With:

```typescript
cta: {
  gap: spacing.sm,
  marginBottom: spacing['2xl'],
},
```

---

## Task 15: Wire InvitationReceivedScreen to use cases

**Files:**
- Modify: `src/presentation/screens/InvitationReceived/InvitationReceivedScreen.tsx`

- [ ] **Step 1: Replace the entire file**

Replace `src/presentation/screens/InvitationReceived/InvitationReceivedScreen.tsx` with:

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  acceptInvitationUseCase,
  refuseInvitationUseCase,
} from '../../../application';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Card, Button, Input } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'InvitationReceived'>;
type Rt = RouteProp<HomeStackParamList, 'InvitationReceived'>;

const LEVEL_LABEL_KEYS: Record<string, string> = {
  light: 'createConsent.levelLight',
  moderate: 'createConsent.levelModerate',
  intimate: 'createConsent.levelIntimate',
  custom: 'createConsent.levelCustom',
};

function durationLabel(minutes: number): string {
  if (minutes <= 60) return 'createConsent.duration1h';
  if (minutes <= 180) return 'createConsent.duration3h';
  if (minutes <= 360) return 'createConsent.duration6h';
  if (minutes <= 720) return 'createConsent.duration12h';
  return 'createConsent.duration24h';
}

export function InvitationReceivedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const updateConsent = useConsentStore((s) => s.updateConsent);
  const addConsent = useConsentStore((s) => s.addConsent);

  const { consent, invitation, decryptedStatement, decryptedConditions } = route.params;

  const [receiverPseudonym, setReceiverPseudonym] = useState(user?.pseudonym ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    if (receiverPseudonym.trim().length < 3) {
      Alert.alert(t('common.error'), t('invitation.errorPseudonymInvalid'));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await acceptInvitationUseCase({
        consentId: consent.id,
        invitationId: invitation.id,
        receiverId: user.id,
        receiverPseudonym: receiverPseudonym.trim(),
      });
      // Add to local store (receiver may not have it yet)
      addConsent(result.consent);
      updateConsent(result.consent.id, result.consent);
      navigation.replace('Confirmation', { consentId: result.consent.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_PSEUDONYM') {
        Alert.alert(t('common.error'), t('invitation.errorPseudonymInvalid'));
      } else {
        Alert.alert(t('common.error'), t('invitation.errorAcceptFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsure = () => {
    Alert.alert('', t('invitation.unsureMessage'));
  };

  const handleRefuse = async () => {
    setIsSubmitting(true);
    try {
      await refuseInvitationUseCase({
        consentId: consent.id,
        invitationId: invitation.id,
      });
      Alert.alert('', t('invitation.refuseSuccess'), [
        { text: t('common.continue'), onPress: () => navigation.navigate('Home') },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('invitation.errorRefuseFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper scrollable={false} padding>
      <View style={styles.container}>
        <Card variant="gold" style={styles.card}>
          <Text style={styles.from}>{t('invitation.from')}</Text>
          <Text style={styles.pseudo}>{consent.initiatorPseudonym}</Text>

          <View style={styles.statementBox}>
            <Text style={styles.statement}>{decryptedStatement}</Text>
          </View>

          {decryptedConditions ? (
            <View style={styles.conditionsBox}>
              <Text style={styles.conditions}>{decryptedConditions}</Text>
            </View>
          ) : null}

          <View style={styles.meta}>
            <Text style={styles.metaItem}>
              {t('invitation.level')} : {t(LEVEL_LABEL_KEYS[consent.level] ?? 'createConsent.levelCustom')}
            </Text>
            <Text style={styles.metaItem}>
              {t('invitation.duration')} : {t(durationLabel(consent.durationMinutes))}
            </Text>
          </View>

          <Input
            label={t('invitation.receiverPseudonymLabel')}
            placeholder={t('invitation.receiverPseudonymPlaceholder')}
            value={receiverPseudonym}
            onChangeText={setReceiverPseudonym}
            autoCapitalize="none"
            testID="invite-receiver-pseudonym-input"
          />

          <View style={styles.actions}>
            <Button
              title={t('invitation.accept')}
              onPress={handleAccept}
              loading={isSubmitting}
              disabled={isSubmitting}
              testID="invite-accept-btn"
            />
            <Button
              title={t('invitation.unsure')}
              variant="secondary"
              onPress={handleUnsure}
              testID="invite-unsure-btn"
            />
            <Button
              title={t('invitation.refuse')}
              variant="danger"
              onPress={handleRefuse}
              loading={isSubmitting}
              disabled={isSubmitting}
              testID="invite-refuse-btn"
            />
          </View>
        </Card>

        <Text style={styles.disclaimer}>{t('invitation.disclaimer')}</Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    padding: spacing['2xl'],
    alignItems: 'stretch',
    gap: spacing.md,
  },
  from: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
  pseudo: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
  },
  statementBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  statement: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  conditionsBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  conditions: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  metaItem: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  disclaimer: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
    maxWidth: 280,
  },
});
```

---

## Task 16: Wire ConfirmationScreen to real data

**Files:**
- Modify: `src/presentation/screens/Confirmation/ConfirmationScreen.tsx`

- [ ] **Step 1: Replace the entire file**

Replace `src/presentation/screens/Confirmation/ConfirmationScreen.tsx` with:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Card, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Rt = RouteProp<HomeStackParamList, 'Confirmation'>;

const LEVEL_LABEL_KEYS: Record<string, string> = {
  light: 'createConsent.levelLight',
  moderate: 'createConsent.levelModerate',
  intimate: 'createConsent.levelIntimate',
  custom: 'createConsent.levelCustom',
};

function formatDate(date: Date | undefined, locale: string): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ConfirmationScreen() {
  const { t, i18n } = useTranslation();
  const route = useRoute<Rt>();
  const consent = useConsentStore((s) =>
    s.consents.find((c) => c.id === route.params.consentId),
  );

  const handleWithdraw = () => {
    Alert.alert(
      t('confirmation.withdraw'),
      t('confirmation.withdrawConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            // Sprint 4: withdrawConsentUseCase
            Alert.alert('', t('confirmation.withdrawSuccess'));
          },
        },
      ],
    );
  };

  if (!consent) {
    return (
      <ScreenWrapper>
        <Header title="" showBack />
        <View style={styles.center}>
          <Text style={styles.title}>{t('errors.consentNotFound')}</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Header title="" showBack />

      <View style={styles.center}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>{'✓'}</Text>
        </View>
        <Text style={styles.title}>{t('confirmation.title')}</Text>
        <Text style={styles.subtitle}>{t('confirmation.subtitle')}</Text>
      </View>

      <Card variant="success" style={styles.detailsCard}>
        <DetailRow
          label={t('confirmation.initiator')}
          value={consent.initiatorPseudonym}
        />
        <DetailRow
          label={t('confirmation.partner')}
          value={consent.receiverPseudonym ?? '—'}
        />
        <DetailRow
          label={t('confirmation.level')}
          value={t(LEVEL_LABEL_KEYS[consent.level] ?? 'createConsent.levelCustom')}
        />
        <DetailRow
          label={t('confirmation.timestamp')}
          value={formatDate(consent.acceptedAt, i18n.language)}
        />
        <DetailRow
          label={t('confirmation.expires')}
          value={formatDate(consent.expiresAt, i18n.language)}
        />

        <View style={styles.codeBox}>
          <Text style={styles.code}>{consent.secureCode}</Text>
        </View>
      </Card>

      <View style={styles.withdrawContainer}>
        <Button
          title={t('confirmation.withdraw')}
          variant="danger"
          onPress={handleWithdraw}
          testID="confirm-withdraw-btn"
        />
      </View>

      <View style={{ height: 40 }} />
    </ScreenWrapper>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.semantic.successMuted,
    borderWidth: 2,
    borderColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 36,
    color: colors.semantic.success,
    fontWeight: '700',
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  detailsCard: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  codeBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  code: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.base,
    color: colors.gold.DEFAULT,
    letterSpacing: 2,
  },
  withdrawContainer: {
    marginTop: spacing['2xl'],
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  value: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
});
```

---

## Task 17: Wire Realtime in App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add realtime subscription**

Locate the existing `useEffect` that handles `restoreSessionUseCase` + `onAuthStateChange`. After it, add a new `useEffect`:

```typescript
  // Realtime: subscribe to consent changes for the authenticated user
  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const subscription = consentRepository.subscribeToUserConsents(
      user.id,
      (updated) => {
        const store = useConsentStore.getState();
        const existing = store.consents.find((c) => c.id === updated.id);
        if (existing) {
          store.updateConsent(updated.id, updated);
        } else {
          store.addConsent(updated);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [/* re-subscribe when user changes */]);
```

- [ ] **Step 2: Add useConsentStore import and dependency**

The `useEffect` above references `useAuthStore` and `useConsentStore`. Verify `useConsentStore` is imported. If not, update the existing import line:

Change:
```typescript
import { useAuthStore } from './src/presentation/hooks';
```

To:
```typescript
import { useAuthStore, useConsentStore } from './src/presentation/hooks';
```

- [ ] **Step 3: Make subscription react to auth state changes**

Replace the just-added `useEffect` with a version that subscribes to the auth store directly so it re-runs on sign-in/sign-out:

```typescript
  // Realtime: subscribe to consent changes for the authenticated user
  useEffect(() => {
    const unsubAuth = useAuthStore.subscribe((state, prevState) => {
      const user = state.user;
      const prevUser = prevState.user;

      // User signed out
      if (prevUser && !user) {
        currentSubscription?.unsubscribe();
        currentSubscription = null;
      }
      // User signed in (or changed)
      if (user && user.id !== prevUser?.id) {
        currentSubscription?.unsubscribe();
        currentSubscription = consentRepository.subscribeToUserConsents(
          user.id,
          (updated) => {
            const store = useConsentStore.getState();
            const existing = store.consents.find((c) => c.id === updated.id);
            if (existing) {
              store.updateConsent(updated.id, updated);
            } else {
              store.addConsent(updated);
            }
          },
        );
      }
    });

    // Bootstrap: if user is already set on mount, subscribe immediately
    let currentSubscription: { unsubscribe: () => void } | null = null;
    const initialUser = useAuthStore.getState().user;
    if (initialUser) {
      currentSubscription = consentRepository.subscribeToUserConsents(
        initialUser.id,
        (updated) => {
          const store = useConsentStore.getState();
          const existing = store.consents.find((c) => c.id === updated.id);
          if (existing) {
            store.updateConsent(updated.id, updated);
          } else {
            store.addConsent(updated);
          }
        },
      );
    }

    return () => {
      unsubAuth();
      currentSubscription?.unsubscribe();
    };
  }, []);
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 18: Final verification

- [ ] **Step 1: Verify Clean Architecture boundaries**

Run:
```bash
grep -r "from.*infrastructure" /Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/src/application/ 2>/dev/null && echo "VIOLATION" || echo "OK: application clean"
```

Expected: `OK: application clean`.

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -30
```

Expected: no errors.

- [ ] **Step 3: Verify i18n parity**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" node -e "
const fr = require('./src/infrastructure/i18n/locales/fr.json');
const en = require('./src/infrastructure/i18n/locales/en.json');
const getKeys = (obj, prefix='') => Object.keys(obj).reduce((acc, k) => {
  const key = prefix ? prefix+'.'+k : k;
  if (typeof obj[k] === 'object') return [...acc, ...getKeys(obj[k], key)];
  return [...acc, key];
}, []);
const fr2 = getKeys(fr).sort();
const en2 = getKeys(en).sort();
console.log('FR:', fr2.length, 'EN:', en2.length, fr2.length === en2.length ? 'OK' : 'MISMATCH');
"
```

Expected: `FR: <n> EN: <n> OK`.
