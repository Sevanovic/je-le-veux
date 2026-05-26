# Sprint 4 — Withdraw, History detail, Auto-expiration

> Design spec for Sprint 4 of Je Le Veux.
> Approved 2026-05-25.

## Goal

Let either party revoke an active consent at any time, surface the full lifecycle of any consent via a dedicated detail screen reachable from History and Home, and transition stale ACTIVE consents to EXPIRED lazily on each fetch.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who can withdraw | Both parties (initiator OR receiver) | FLERR principle: consent is revocable by anyone involved, at any time. |
| Expiration strategy | Lazy server-side on `loadUserConsentsUseCase` | No cron needed. DB source of truth. Realtime propagates the EXPIRED update to the other party. |
| Remaining time display | Static at render (computed from `remainingMinutes()`) | MVP. Live counter deferred to Sprint 7. |
| Realtime on withdraw | Silent UI update (Zustand + Realtime) | Store-driven; the screen reflects the new state without alert. Toast/push deferred to Sprint 5. |
| Detail screen | New `ConsentDetailScreen` separate from `ConfirmationScreen` | Confirmation = post-acceptance celebration. Detail = neutral view of any consent across its lifecycle. Shared content via extracted `ConsentDetailsCard`. |

## Architecture

### Flow 1 — Withdraw consent
```
ConfirmationScreen | ConsentDetailScreen (status ACTIVE)
  -> Tap "Withdraw" -> Alert confirm
  -> withdrawConsentUseCase({ consentId, userId })
    -> consent.findById(consentId)
    -> Verify status === ACTIVE and userId is initiator or receiver
    -> consent.updateStatus(id, WITHDRAWN, { withdrawnAt, withdrawnBy })
  -> Zustand updateConsent + navigation back
  -> Realtime pushes the UPDATE to the other party (already wired in App.tsx)
```

### Flow 2 — Lazy expiration on load
```
App startup / sign-in -> loadUserConsentsUseCase(userId)
  -> consent.findByUserId() -> consents
  -> Filter: expired = consents.filter(c => c.status === ACTIVE && c.expiresAt && c.expiresAt < now)
  -> If any: Promise.all(expired.map(c => consent.updateStatus(c.id, EXPIRED)))
  -> Patch local list with updated entities
  -> Realtime propagates the EXPIRED update to the other party
```

### Flow 3 — Detail view
```
HistoryScreen.ConsentCard.onPress | HomeScreen.ConsentCard.onPress
  -> navigation.navigate('ConsentDetail', { consentId })
  -> ConsentDetailScreen reads consent from useConsentStore by consentId
  -> Renders <ConsentDetailsCard> + status-specific banner + Withdraw button if ACTIVE
```

## Use Cases

### withdrawConsentUseCase (NEW)
**Input:** `{ consentId: string, userId: string }`
**Output:** `{ consent: Consent }`

**Steps:**
1. `consent.findById(consentId)` — else throw `CONSENT_NOT_FOUND`
2. Verify `existing.status === ConsentStatus.ACTIVE` — else throw `CONSENT_NOT_ACTIVE`
3. Verify `userId === existing.initiatorId || userId === existing.receiverId` — else throw `NOT_PARTY`
4. `consent.updateStatus(consentId, WITHDRAWN, { withdrawnAt: now.toISOString(), withdrawnBy: userId })`
5. Return `{ consent: updated }`

**Errors:** `CONSENT_NOT_FOUND`, `CONSENT_NOT_ACTIVE`, `NOT_PARTY`, `UPDATE_FAILED`

### loadUserConsentsUseCase (MODIFIED)
Add lazy expiration logic after `findByUserId`:

```typescript
const consents = await consent.findByUserId(input.userId);
const now = new Date();
const expired = consents.filter(
  (c) => c.status === ConsentStatus.ACTIVE && c.expiresAt && c.expiresAt < now,
);
if (expired.length > 0) {
  const updated = await Promise.all(
    expired.map((c) => consent.updateStatus(c.id, ConsentStatus.EXPIRED)),
  );
  const byId = new Map(updated.map((c) => [c.id, c]));
  return { consents: consents.map((c) => byId.get(c.id) ?? c) };
}
return { consents };
```

## Repositories

No changes to `IConsentRepository` or `ConsentRepository`. The existing `updateStatus` and `findByUserId` cover the new flows.

The existing RLS policy `"Users can update own consents"` (`auth.uid() = initiator_id OR auth.uid() = receiver_id`) covers withdraw operations server-side. No migration needed.

## Components

### ConsentDetailsCard (NEW shared component)
**File:** `src/presentation/components/consent/ConsentDetailsCard.tsx`

Reusable details card containing:
- Initiator pseudo, partner pseudo (or `—` if none)
- Level (translated via `LEVEL_LABEL_KEYS`)
- Timestamps (createdAt, acceptedAt if any, expiresAt if any) formatted via `Intl.DateTimeFormat`
- Decrypted statement (via `decryptConsentStatementUseCase`)
- Decrypted conditions (if present)
- Secure code in mono font

Used by both `ConfirmationScreen` and `ConsentDetailScreen`. Each parent screen wraps it with its own header/banner.

### Helper: formatRemainingTime
**File:** `src/presentation/screens/ConsentDetail/utils.ts`

```typescript
export function formatRemainingTime(minutes: number, t: TFunction): string {
  if (minutes <= 0) return t('history.expired');
  if (minutes < 60) return t('common.expiresInMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (remainingMin === 0) return t('common.expiresInHours', { count: hours });
  return t('common.expiresInHoursMinutes', { hours, minutes: remainingMin });
}
```

Consumes `remainingMinutes()` from the Consent domain entity.

## Screens

### ConsentDetailScreen (NEW)
**File:** `src/presentation/screens/ConsentDetail/ConsentDetailScreen.tsx`

- Route param: `{ consentId: string }`
- Reads consent from Zustand store
- Header title is status-dependent (`consentDetail.titleActive`, `consentDetail.titleWithdrawn`, etc.)
- Status banner:
  - ACTIVE: green band showing `formatRemainingTime(remainingMinutes(consent), t)`
  - WITHDRAWN: red band "Retiré par {pseudo} le {date}" using `withdrawnBy` (resolved to pseudo from initiator/receiver) and `withdrawnAt`
  - EXPIRED: neutral band "Expiré le {date}" using `expiresAt`
  - REFUSED: neutral band "Refusé le {date}" using `refusedAt`
- Body: `<ConsentDetailsCard consent={consent} />`
- Footer: Withdraw button if `consent.status === ACTIVE` AND user is party (`initiatorId === user.id || receiverId === user.id`)

### ConfirmationScreen (MODIFIED)
- Replace placeholder withdraw with real call to `withdrawConsentUseCase`
- Success: `updateConsent` in store + navigation back to Home
- Failure: Alert with i18n error message
- Only show withdraw button if `consent.status === ACTIVE`
- Use `<ConsentDetailsCard>` for the details section instead of inline rendering (refactor for DRY)

### HistoryScreen (MODIFIED)
- Wire `handlePress` to `navigation.navigate('ConsentDetail', { consentId: consent.id })`
- No other changes (filters already work via `getByStatus`)

### HomeScreen (MODIFIED)
- Change ConsentCard `onPress` from `Confirmation` to `ConsentDetail` (clicking a card from home goes to the neutral detail view, not the celebration screen)

## Navigation

### MainTabNavigator (MODIFIED)
- Add `ConsentDetail` to `HomeStackParamList`
- Add new `HistoryStackParamList` with `History` and `ConsentDetail`
- Create `HistoryStackNavigator` component wrapping HistoryScreen + ConsentDetailScreen
- Replace direct `HistoryScreen` component on `HistoryTab` with `HistoryStackNavigator`
- Add `<HomeStack.Screen name="ConsentDetail" component={ConsentDetailScreen} />` to `HomeStackNavigator`

## i18n Keys

### New keys under `common`
- `expiresInMinutes` (pluralized with `{{count}}`)
- `expiresInHours` (pluralized with `{{count}}`)
- `expiresInHoursMinutes` (with `{{hours}}` and `{{minutes}}`)

### New keys under `confirmation`
- `errorWithdrawFailed`
- `errorNotActive`
- `errorNotParty`

### New section `consentDetail`
- `titleActive`, `titleWithdrawn`, `titleExpired`, `titleRefused`
- `withdrawnBy` (with `{{pseudo}}` and `{{date}}`)
- `expiredAt`, `refusedAt`
- `notFound`
- `withdrawButton`

All keys in both `fr.json` and `en.json`, parity enforced.

## Files

### New files
- `src/application/usecases/consent/withdrawConsentUseCase.ts`
- `src/presentation/screens/ConsentDetail/ConsentDetailScreen.tsx`
- `src/presentation/screens/ConsentDetail/index.ts`
- `src/presentation/screens/ConsentDetail/utils.ts`
- `src/presentation/components/consent/ConsentDetailsCard.tsx`

### Modified files
- `src/application/usecases/consent/loadUserConsentsUseCase.ts` — add lazy expiration logic
- `src/application/usecases/consent/index.ts` — export new use case
- `src/application/index.ts` — export new use case
- `src/presentation/components/consent/index.ts` (or `src/presentation/components/index.ts`) — export `ConsentDetailsCard`
- `src/presentation/components/navigation/MainTabNavigator.tsx` — `HistoryStackParamList`, `HistoryStackNavigator`, add `ConsentDetail` to HomeStack
- `src/presentation/screens/Confirmation/ConfirmationScreen.tsx` — wire withdraw, reuse `ConsentDetailsCard`
- `src/presentation/screens/History/HistoryScreen.tsx` — wire `handlePress`
- `src/presentation/screens/Home/HomeScreen.tsx` — change card target to `ConsentDetail`
- `src/infrastructure/i18n/locales/fr.json` — new keys
- `src/infrastructure/i18n/locales/en.json` — new keys

## Out of Scope (deferred)

- Live countdown ticker (Sprint 7)
- Push notification on withdraw (Sprint 5)
- pg_cron for expiration when no client opens the app (Sprint 6)
- Detailed event timeline on detail screen (later, if needed)
