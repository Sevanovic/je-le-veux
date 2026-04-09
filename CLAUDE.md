# CLAUDE.md — Je Le Veux

> This file is the single source of truth for Claude Code.
> Read it entirely before any task. Update it after each sprint.

## Project overview

**Je Le Veux** is a mobile-first consent application allowing two adults to establish mutual, explicit, free, and revocable consent before an intimate or personal interaction.

- **Platform:** React Native + Expo SDK 52
- **Language:** TypeScript strict mode
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Encryption:** TweetNaCl.js — E2E Curve25519-XSalsa20-Poly1305
- **State management:** Zustand
- **Navigation:** React Navigation 7 (native stack + bottom tabs)
- **i18n:** react-i18next + expo-localization (FR + EN, auto-detect phone language)

## Architecture — Clean Architecture (4 layers)

```
src/
├── domain/              # Pure business logic, ZERO external dependencies
│   ├── entities/        # User, Consent, Invitation (with domain functions)
│   ├── enums/           # ConsentLevel, ConsentStatus, SupportedLanguage
│   └── interfaces/      # Contracts: IAuthService, ICryptoService, IConsentRepository...
│
├── application/         # Use cases — orchestrate domain + infra via DI
│   ├── interfaces/      # DI container (initContainer / getContainer)
│   └── usecases/auth/   # signUpUseCase, signInUseCase, restoreSessionUseCase...
│
├── infrastructure/      # Concrete implementations of domain interfaces
│   ├── api/             # Supabase client (supabase.ts)
│   ├── auth/            # AuthService implements IAuthService
│   ├── crypto/          # CryptoService implements ICryptoService (TweetNaCl)
│   ├── storage/         # SecureStorageService (expo-secure-store)
│   └── i18n/            # i18next config + locales/fr.json + locales/en.json
│
└── presentation/        # UI — React Native screens and components
    ├── screens/         # 10 screens (see below)
    ├── components/      # ui/, layout/, consent/, navigation/
    ├── hooks/           # Zustand stores (useAuthStore, useConsentStore, useSettingsStore)
    └── theme/           # Design tokens (colors, typography, spacing)
```

### Dependency rules (STRICT)

```
✅ Presentation → Application → Domain
✅ Infrastructure implements Domain interfaces
✅ App.tsx is the ONLY file importing Infrastructure (DI boundary)
❌ Presentation must NEVER import from Infrastructure
❌ Application must NEVER import from Infrastructure
❌ Domain must NEVER import from anything external
```

### Verification command
```bash
# Must return ZERO results:
grep -r "from.*infrastructure" src/presentation/
grep -r "from.*infrastructure" src/application/
```

## DI container

Wired in `App.tsx` at startup:
```typescript
initContainer({
  auth: authService,       // from infrastructure/auth/AuthService
  crypto: cryptoService,   // from infrastructure/crypto/CryptoService
  secureStorage: secureStorage, // from infrastructure/storage/SecureStorageService
});
```

Use cases access services via `getContainer()`:
```typescript
const { auth, crypto, secureStorage } = getContainer();
```

## Screens (10 total)

| Screen | Path | Status |
|--------|------|--------|
| Splash | screens/Splash/SplashScreen.tsx | ✅ Done |
| Age Verification | screens/AgeVerification/AgeVerificationScreen.tsx | ✅ Done |
| Onboarding (3 slides) | screens/Onboarding/OnboardingScreen.tsx | ✅ Done |
| Login / Sign up | screens/Auth/AuthScreen.tsx | ✅ Done |
| Setup Profile | screens/Auth/SetupProfileScreen.tsx | ✅ Done |
| Home (dashboard) | screens/Home/HomeScreen.tsx | ✅ Shell |
| Create Consent | screens/CreateConsent/CreateConsentScreen.tsx | ⏳ Sprint 2 |
| Invitation Received | screens/InvitationReceived/InvitationReceivedScreen.tsx | ⏳ Sprint 3 |
| Confirmation | screens/Confirmation/ConfirmationScreen.tsx | ⏳ Sprint 3 |
| History | screens/History/HistoryScreen.tsx | ⏳ Sprint 4 |
| Resources | screens/Resources/ResourcesScreen.tsx | ✅ Shell |
| Profile | screens/Profile/ProfileScreen.tsx | ✅ Done |

## Navigation flow

```
RootNavigator
├── Auth (when NOT authenticated)
│   ├── Splash
│   ├── AgeVerification
│   ├── Onboarding
│   ├── Login
│   └── SetupProfile
└── Main (when authenticated + age verified + onboarding done)
    └── BottomTabs
        ├── HomeTab → Home, Confirmation, InvitationReceived, Profile
        ├── CreateTab → CreateConsent
        ├── HistoryTab → History
        └── ResourcesTab → Resources
```

## Database schema (Supabase)

Defined in `supabase/migrations/001_initial_schema.sql`.

**Tables:**
- `profiles` — linked to auth.users via FK, auto-created by trigger
- `consents` — the core table, E2E encrypted statements
- `invitations` — invite links with TTL

**All tables have RLS enabled** with policies restricting access to own data.

## i18n rules

- **NEVER hardcode strings** — always use `t('key')`
- Translation files: `src/infrastructure/i18n/locales/fr.json` and `en.json`
- Both files must have IDENTICAL keys (tested by `npm run test:i18n`)
- Auto-detect phone language at first launch, manual switch in Profile
- Persisted in AsyncStorage under key `jeleveux.language`

## Security rules

- E2E encryption: secret key NEVER leaves the device (stored in SecureStore)
- Public key sent to Supabase profile for other users to encrypt messages
- SecureStore keys format: `jeleveux.xxx` (alphanumeric + `.` + `_` + `-` only)
- Supabase anon key is public (security = RLS), loaded via `app.config.ts` + `.env`
- `service_role` key must NEVER appear in client code
- `react-native-get-random-values` must be the FIRST import in App.tsx

## Environment variables

```bash
# .env (gitignored — never commit)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Loaded by: dotenv → app.config.ts → Constants.expoConfig.extra → supabase.ts
```

## Design tokens (from logo)

| Token | Hex | Usage |
|-------|-----|-------|
| Gold | #C9A84C | Primary actions, trust |
| Gold Light | #E8D48B | Accents, gradients |
| Silver | #B8B8B8 | Secondary elements |
| Dark BG | #0F0F12 | Primary background |
| Card BG | #1A1A20 | Cards and surfaces |
| Success | #5DCAA5 | Active consent |
| Danger | #E24B4A | Withdraw, refuse |

## Code conventions

- **Comments:** English only (French only in fr.json translations)
- **File naming:** PascalCase for components/screens, camelCase for utils/hooks
- **Exports:** barrel files (index.ts) in every directory
- **Tests:** `__tests__/` mirroring src structure
- **No `any`:** TypeScript strict mode enforced
- **No hardcoded colors:** always use theme tokens
- **No hardcoded strings:** always use `t('key')`

## Sprint status

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Foundations + Architecture + i18n | ✅ Done |
| 1 | Auth (Supabase + login/signup) | ✅ Done |
| Refactoring | Clean Architecture (DI + use cases) | ✅ Done |
| **2** | **Create consent + invitations + QR** | **⏳ Next** |
| 3 | Receive invitation + accept/refuse + confirmation | Planned |
| 4 | Withdraw + history + auto-expiration | Planned |
| 5 | Resources + legal + profile + GDPR | Planned |
| 6 | Security audit + performance + accessibility | Planned |
| 7 | Beta testing + polish + animations | Planned |
| 8 | Store submission + go-to-market | Planned |

## Sprint 2 — what to build next

### Goal
Allow a user to create a consent, customize it, and send an invitation via link or QR code.

### Tasks
1. **CreateConsentUseCase** — validate inputs, encrypt statement with TweetNaCl, generate secure code (JLV-YYYY-XXXX-XXXX), store in Supabase
2. **CreateInvitationUseCase** — generate unique invite link + QR code, set 24h TTL
3. **ConsentRepository** — implements IConsentRepository for Supabase
4. **InvitationRepository** — implements IInvitationRepository for Supabase
5. **CreateConsentScreen** — wire the existing form UI to the use case
6. **QR Code generation** — react-native-qrcode-svg (already in package.json)
7. **Share invitation** — expo-sharing for native share sheet
8. **Consent templates** — 6-8 predefined templates in FR/EN
9. **Tests** — unit tests for use cases + i18n for new keys

### New files expected
```
src/application/usecases/consent/createConsentUseCase.ts
src/application/usecases/consent/createInvitationUseCase.ts
src/application/usecases/consent/index.ts
src/infrastructure/repositories/ConsentRepository.ts
src/infrastructure/repositories/InvitationRepository.ts
```

### Files to modify
```
src/presentation/screens/CreateConsent/CreateConsentScreen.tsx
src/infrastructure/i18n/locales/fr.json (new template keys)
src/infrastructure/i18n/locales/en.json (new template keys)
src/application/index.ts (export new use cases)
src/infrastructure/index.ts (export new repositories)
src/application/interfaces/container.ts (add consent + invitation repos)
```

## Known issues

- Custom fonts not loaded (using system fonts) — deferred to Sprint 7
- Supabase pauses free-tier projects after inactivity — restart from dashboard
- iOS autofill on password fields — fixed with `textContentType="none"`

## Useful commands

```bash
npm start                    # Start Expo dev server
npm test                     # Run all tests
npm run test:i18n            # Verify FR/EN key parity
npm run type-check           # TypeScript check
npm run lint                 # ESLint
npx expo start --clear       # Clear cache and restart
```
