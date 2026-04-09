# Sprint 2 — Create Consent & Invitations

> Design spec for Sprint 2 of Je Le Veux.
> Approved 2026-04-06.

## Goal

Allow a user to create a consent, encrypt it E2E, generate a secure code, and share an invitation via QR code or native share sheet.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| E2E encryption timing | **Encrypt immediately with initiator's own key (Approach B)** | Statement never stored in plaintext on server. Initiator can always re-read. Re-encrypt for receiver at acceptance (Sprint 3). |
| Invitation sharing | **Secure code + QR code (Approach B)** | No external dependency (no domain, no deep link config). Receiver enters code manually or scans QR. Deep links deferred to Sprint 7. |
| Success UI | **Conditional state on CreateConsentScreen** | No new screen needed. Toggle between form and success view. |

## Architecture

### Data Flow

```
CreateConsentScreen (form submit)
  -> createConsentUseCase()
    -> getContainer() -> { crypto, secureStorage, consent, invitation }
    -> Validate inputs (domain rules)
    -> secureStorage.get('jeleveux.secret_key') + secureStorage.get('jeleveux.public_key')
    -> crypto.encrypt(statement, initiatorPublicKey, initiatorSecretKey)
    -> crypto.encrypt(conditions, ...) if present
    -> generateSecureCode() -> JLV-YYYY-XXXX-XXXX
    -> consent.create(dto) -> INSERT Supabase
    -> invitation.create(consentId) -> INSERT invitation (TTL 24h)
    -> Return { consent, invitation }
  -> Zustand: addConsent()
  -> Show success view with QR + share
```

### DI Container Extension

```typescript
interface ServiceContainer {
  auth: IAuthService;
  crypto: ICryptoService;
  secureStorage: ISecureStorageService;
  consent: IConsentRepository;      // NEW
  invitation: IInvitationRepository; // NEW
}
```

Wired in `App.tsx` with `ConsentRepository` and `InvitationRepository` instances.

## Use Cases

### createConsentUseCase

**Input:**
```typescript
interface CreateConsentInput {
  initiatorId: string;
  initiatorPseudonym: string;
  statement: string;
  level: ConsentLevel;
  durationMinutes: number;
  conditions?: string;
}
```

**Steps:**
1. Validate: pseudonym valid (`isValidPseudonym`), statement non-empty, level in enum, duration > 0
2. Retrieve initiator's public key and secret key from SecureStore
3. Encrypt statement with initiator's own public key
4. If conditions present, encrypt conditions the same way
5. Generate secure code via `generateSecureCode()`
6. `consent.create(dto)` — INSERT into Supabase `consents` table
7. `invitation.create(consentId)` — INSERT invitation with 24h TTL, `inviteLink` = secureCode
8. Return `{ consent, invitation }`

**Errors:** `INVALID_STATEMENT`, `INVALID_LEVEL`, `INVALID_DURATION`, `MISSING_KEYS`, `CREATION_FAILED`

### createInvitationUseCase

For regenerating an expired invitation on an existing PENDING consent.

**Input:** `{ consentId: string, userId: string }`

**Steps:**
1. `consent.findById(consentId)` — verify exists and belongs to user
2. Verify consent status is PENDING
3. `invitation.create(consentId)` — new invitation, 24h TTL
4. Return `{ invitation }`

**Errors:** `CONSENT_NOT_FOUND`, `NOT_OWNER`, `CONSENT_NOT_PENDING`, `CREATION_FAILED`

## Repositories

### ConsentRepository (implements IConsentRepository)

Supabase implementation. Maps camelCase entity fields to snake_case DB columns.

| Method | SQL equivalent |
|--------|---------------|
| `create(dto)` | INSERT into `consents` |
| `findById(id)` | SELECT WHERE id = ? |
| `findBySecureCode(code)` | SELECT WHERE secure_code = ? |
| `findByUserId(userId)` | SELECT WHERE initiator_id = ? ORDER BY created_at DESC |
| `findByStatus(userId, status)` | SELECT WHERE initiator_id = ? AND status = ? |
| `updateStatus(id, status, metadata?)` | UPDATE SET status = ?, ...metadata |
| `delete(id)` | DELETE WHERE id = ? |

Private helpers: `toEntity(row)` and `toRow(dto)` for mapping.

### InvitationRepository (implements IInvitationRepository)

| Method | SQL equivalent |
|--------|---------------|
| `create(consentId)` | INSERT with inviteLink = consent's secureCode, expiresAt = now + 24h |
| `findByLink(link)` | SELECT WHERE invite_link = ? |
| `findByConsentId(consentId)` | SELECT WHERE consent_id = ? |
| `markAsUsed(id)` | UPDATE SET is_used = true |

## CreateConsentScreen Updates

### Form (existing, no changes)
- Pseudonym, statement, level (chips), duration (chips), conditions (optional)

### New: Template chips
- 6 predefined templates displayed above the statement field
- Tapping a template pre-fills the statement text
- Templates: intimate, massage, photo, discussion, activity, custom

### New: Submit logic
- Calls `createConsentUseCase()` with form data + user info from Zustand auth store
- Loading state on button during async operation
- Error handling via Alert with i18n messages

### New: Success state
- Conditional rendering: form vs success view
- Success view shows:
  - Success title + message
  - Secure code (JLV-YYYY-XXXX-XXXX) large and copiable (Clipboard API)
  - QR code via `react-native-qrcode-svg` encoding the secure code
  - "Share" button using React Native `Share.share()` API
  - "Back to home" button navigating to HomeScreen

## i18n Keys

New keys under `createConsent`:
- Error messages: `errorInvalidStatement`, `errorMissingKeys`, `errorCreationFailed`
- Success view: `successTitle`, `successMessage`, `secureCodeLabel`, `shareButton`, `shareMessage`, `copyCode`, `codeCopied`, `backToHome`
- Templates: `templateIntimate`, `templateMassage`, `templatePhoto`, `templateDiscussion`, `templateActivity`, `templateCustom`

All keys added to both `fr.json` and `en.json`.

## Files

### New files
- `src/application/usecases/consent/createConsentUseCase.ts`
- `src/application/usecases/consent/createInvitationUseCase.ts`
- `src/application/usecases/consent/index.ts`
- `src/infrastructure/repositories/ConsentRepository.ts`
- `src/infrastructure/repositories/InvitationRepository.ts`

### Modified files
- `src/application/interfaces/container.ts` — extend ServiceContainer
- `App.tsx` — wire new repositories
- `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx` — connect use case + success view
- `src/infrastructure/i18n/locales/fr.json` — new keys
- `src/infrastructure/i18n/locales/en.json` — new keys

## Out of Scope (deferred)

- Deep links / universal links (Sprint 7)
- Receiver acceptance flow (Sprint 3)
- Re-encryption for receiver (Sprint 3)
- Consent withdrawal (Sprint 4)
- Consent expiration cron (Sprint 4)
- Push notifications (Sprint 5)
