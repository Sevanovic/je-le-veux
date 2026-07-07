# Sprint 5b — Resources content + Legal pages

> Design spec for Sprint 5b of Je Le Veux (companion to 5a which delivered Profile + GDPR).
> Approved 2026-06-08.

## Goal

Wire ResourcesScreen cards to detailed content screens, deliver legally-required pages (Terms, Privacy Policy, Legal Mentions) reachable from Profile and Auth, and enforce explicit terms acceptance at signup with DB tracking.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Legal pages access | Profile + Auth (sign-up screen) | Stores require legal access before account creation. |
| Content rendering | Generic ContentScreen + data registry | DRY. One screen handles all 7 documents. New documents = new registry entry. |
| Helpline coverage | FR + EN with language-aware lists | Practical 80% coverage. FR: 3919, 17, SOS. EN: RAINN (US), Refuge (UK), international note. |
| Legal content depth | Full text written, juridically-reviewable | Real content based on app facts (E2E, RGPD, Supabase). Lawyer reviews/refines later. |
| Terms acceptance | Mandatory checkbox at sign-up + DB timestamp tracking | Cohérence thématique (a consent app demands explicit consent). RGPD-defensive. |
| Navigation pattern | Modal route at RootNavigator level | Single Content route reachable from any stack (no duplication). |

## Architecture

### Navigation structure

```
RootNavigator (NativeStackNavigator)
├── Auth | Main (conditional based on auth state)         <- existing
└── Content { contentKey: ContentKey }  (presentation: 'modal')   <- NEW
```

Any screen calls `navigation.navigate('Content', { contentKey: 'terms' })` — React Navigation walks up to the root navigator that owns the Content route.

### ContentRegistry

A typed map of ContentDocuments. Each document is an ordered list of typed blocks. Text content is i18n keys; structure is TypeScript code.

```typescript
type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; textKey: string }
  | { type: 'paragraph'; textKey: string }
  | { type: 'bullet'; textKey: string }
  | { type: 'phone'; labelKey: string; number: string }
  | { type: 'email'; labelKey: string; address: string }
  | { type: 'link'; labelKey: string; url: string };

interface ContentDocument {
  titleKey: string;
  lastUpdatedISO: string;
  blocks: ContentBlock[];
}

type ContentKey =
  | 'consent' | 'legalFramework' | 'helpline' | 'privacy'
  | 'terms' | 'privacyPolicy' | 'legalMentions';
```

### Rendering pipeline

```
Resources card OR Profile link OR Auth link
  -> navigation.navigate('Content', { contentKey })
  -> ContentScreen
    -> doc = CONTENT_REGISTRY[contentKey]
    -> <Header title={t(doc.titleKey)} showClose />
    -> <ContentRenderer blocks={doc.blocks} />
    -> Footer: t('content.lastUpdated', { date: doc.lastUpdatedISO })
```

ContentRenderer iterates blocks, renders each with proper style. `phone`/`email`/`link` blocks use `Linking.openURL` on tap (tel:, mailto:, https:).

### Terms acceptance flow

```
AuthScreen (sign-up form)
  -> Checkbox "I accept Terms + Privacy Policy"
  -> Both link words tappable -> open Content modal
  -> Sign-up button disabled until checkbox checked
  -> Tap sign-up -> signUpUseCase({ ...inputs, termsAccepted: true })
    -> If termsAccepted !== true -> throw TERMS_NOT_ACCEPTED (defense-in-depth)
    -> Create account via Supabase
    -> auth.updateProfile(userId, { termsAcceptedAt: new Date() })
    -> Return user with termsAcceptedAt populated
```

## Data Model

### Domain entity extension

```typescript
// src/domain/entities/User.ts
export interface User {
  // ...existing
  termsAcceptedAt?: Date;
}
```

### Supabase migration `005_terms_acceptance.sql`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at
  ON public.profiles(terms_accepted_at);
```

### AuthService mapping

- `updateProfile` maps `termsAcceptedAt` -> `terms_accepted_at` (ISO string)
- `getProfile` reads `terms_accepted_at` -> `termsAcceptedAt` (Date | undefined)

## Use Cases

### signUpUseCase (MODIFIED)

Add `termsAccepted: boolean` to input. New error `TERMS_NOT_ACCEPTED`.

After successful `auth.signUp` + key generation + profile publicKey update:
- `auth.updateProfile(userId, { termsAcceptedAt: new Date() })`
- Return profile (which now includes `termsAcceptedAt`)

### acceptTermsUseCase (NEW, for future re-acceptance flows)

Input: `{ userId: string }`. Output: `{ user: User }`.

```typescript
const { auth } = getContainer();
await auth.updateProfile(input.userId, { termsAcceptedAt: new Date() });
const user = await auth.getProfile(input.userId);
if (!user) throw new Error('PROFILE_NOT_FOUND');
return { user };
```

Used later if T&C change and we need to prompt existing users to re-accept. Not used in 5b directly but the use case exists.

## Components

### ContentRenderer

`src/presentation/components/content/ContentRenderer.tsx`

Props: `{ blocks: ContentBlock[] }`. Maps each block to a styled view. Phone/email/link blocks are TouchableOpacity that invoke `Linking.openURL`.

### ContentScreen

`src/presentation/screens/Content/ContentScreen.tsx`

Reads `route.params.contentKey`, looks up doc in registry. Header with title + close button. ContentRenderer in scrollable body. Footer "Last updated: <date>".

Modal-friendly: uses `Header showClose` instead of `showBack`.

### CheckboxRow (NEW small component)

`src/presentation/components/ui/CheckboxRow.tsx`

Custom checkbox (RN has none natively). Square with golden border, checkmark when checked. Used in AuthScreen for terms acceptance.

Props: `{ checked: boolean; onToggle: () => void; children: React.ReactNode }`. Children allow inline `<Text>` with tappable links.

## Screens

### ResourcesScreen (MODIFIED)

- Each of 4 cards wires its "En savoir plus →" link to `navigation.navigate('Content', { contentKey })`.
- contentKey mapping: card index 0 -> consent, 1 -> legalFramework, 2 -> helpline, 3 -> privacy.
- Use `useNavigation` typed on `RootStackParamList`.

### ProfileScreen (MODIFIED)

Add a new Card "Légal" before the logout button:

```typescript
<Card style={styles.section}>
  <Text style={styles.sectionLabel}>{t('profile.legal')}</Text>
  <View style={styles.legalRows}>
    <TouchableOpacity onPress={() => rootNav.navigate('Content', { contentKey: 'terms' })}>
      <Text style={styles.legalLink}>{t('profile.terms')} →</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => rootNav.navigate('Content', { contentKey: 'privacyPolicy' })}>
      <Text style={styles.legalLink}>{t('profile.privacyPolicy')} →</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => rootNav.navigate('Content', { contentKey: 'legalMentions' })}>
      <Text style={styles.legalLink}>{t('profile.legalMentions')} →</Text>
    </TouchableOpacity>
  </View>
</Card>
```

### AuthScreen (MODIFIED)

- New state `termsAccepted: boolean` (default false)
- `<CheckboxRow>` above the sign-up button containing the legal text + inline tappable links
- Sign-up button: `disabled={!canSubmit || !termsAccepted}`
- `handleSignUp` passes `termsAccepted: true` to use case

Note: AuthScreen handles BOTH sign-in and sign-up modes. The checkbox only appears in sign-up mode.

### RootNavigator (MODIFIED)

Currently a simple conditional render between AuthNavigator and MainTabNavigator. Restructure to a `NativeStackNavigator` with three screens:
- Auth (conditional)
- Main (conditional)
- Content (modal)

The conditional auth/main switch uses React Navigation's standard "group" or conditional Screens pattern. NavigationContainer remains in App.tsx; the new RootNavigator owns the stack.

## i18n Keys

### New top-level `content` section

For each of 7 documents, a sub-section with:
- `title`
- 5-30 body keys (depending on document complexity)

Approximate counts:
- `content.consent.*` — ~15 keys (educational, with FLERR breakdown)
- `content.legalFramework.*` — ~10 keys (French law overview, disclaimer)
- `content.helpline.*` — ~12 keys (FR + EN helpline lists, intro, international note)
- `content.privacy.*` — ~10 keys (E2E explanation, storage, RGPD rights)
- `content.terms.*` — ~35 keys (CGU full text: object, eligibility, account, content, conduct, liability, IP, termination, jurisdiction, contact)
- `content.privacyPolicy.*` — ~35 keys (collected data, purpose, legal basis, retention, sharing, RGPD rights, contact, cookies)
- `content.legalMentions.*` — ~10 keys (editor, contact, host, publication director)

Plus `content.lastUpdated` with `{{date}}` interpolation.

### Extensions to existing sections

- `profile.legal` (section label), `profile.terms`, `profile.privacyPolicy`, `profile.legalMentions`
- `auth.termsAcceptancePrefix`, `auth.termsLink`, `auth.termsAcceptanceMiddle`, `auth.privacyPolicyLink`, `auth.errorTermsNotAccepted`

All new keys mirrored in `fr.json` and `en.json` with parity enforced.

## Files

### New files
- `supabase/migrations/005_terms_acceptance.sql`
- `src/presentation/content/types.ts`
- `src/presentation/content/registry.ts`
- `src/presentation/content/index.ts`
- `src/presentation/components/content/ContentRenderer.tsx`
- `src/presentation/components/ui/CheckboxRow.tsx`
- `src/presentation/screens/Content/ContentScreen.tsx`
- `src/presentation/screens/Content/index.ts`
- `src/application/usecases/auth/acceptTermsUseCase.ts`

### Modified files
- `src/domain/entities/User.ts` — add `termsAcceptedAt?: Date`
- `src/infrastructure/auth/AuthService.ts` — map `termsAcceptedAt` in `updateProfile` and `getProfile`
- `src/application/usecases/auth/signUpUseCase.ts` — require `termsAccepted`, set `termsAcceptedAt` after creation
- `src/application/usecases/auth/index.ts` — export `acceptTermsUseCase`
- `src/application/index.ts` — export `acceptTermsUseCase`
- `src/presentation/components/index.ts` — export `ContentRenderer`, `CheckboxRow`
- `src/presentation/components/navigation/RootNavigator.tsx` — restructure to NativeStackNavigator with modal Content route
- `src/presentation/screens/Resources/ResourcesScreen.tsx` — wire cards to Content modal
- `src/presentation/screens/Profile/ProfileScreen.tsx` — add Legal section card
- `src/presentation/screens/Auth/AuthScreen.tsx` — add terms checkbox + tappable links
- `src/infrastructure/i18n/locales/fr.json` — new content section + extensions
- `src/infrastructure/i18n/locales/en.json` — parity

## Out of Scope (deferred)

- Re-acceptance flow when terms version changes (acceptTermsUseCase exists but no version-tracking yet — later sprint when needed)
- Cookies/tracking consent banner (we don't use cookies/tracking; only RGPD-relevant data is detailed in privacyPolicy)
- Multi-region helpline switcher (just FR + EN for now)
- Markdown / rich text rendering (block-typed structure covers our needs)
- A/B between dark/light versions of legal pages (only dark for now)
