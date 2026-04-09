# Je Le Veux — Rapport de modifications

> Ce fichier trace toutes les modifications du projet, sprint par sprint.
> Dernière mise à jour : 22 mars 2026

---

## État actuel du projet

| Élément | Statut |
|---------|--------|
| Sprint 0 — Fondations | ✅ Terminé |
| Sprint 1 — Auth | 🔧 En cours (tests inscription) |
| Supabase | ✅ Projet créé, .env configuré, SQL exécuté |
| i18n FR/EN | ✅ Fonctionnel |
| Navigation | ✅ Splash → Age → Onboarding → Login → Home |
| Chiffrement E2E | ✅ Fix PRNG appliqué |
| Fonts custom | ⏳ Reporté au Sprint 7 |

---

## Sprint 0 — Fondations et infrastructure

### Fichiers créés (structure initiale)

```
App.tsx
app.json
package.json
tsconfig.json
jest.config.js
eslint.config.mjs
.prettierrc
.gitignore
.env.example
README.md

src/domain/
  entities/User.ts, Consent.ts, Invitation.ts, index.ts
  enums/ConsentLevel.ts, ConsentStatus.ts, SupportedLanguage.ts, index.ts
  interfaces/repositories.ts, index.ts
  index.ts

src/infrastructure/
  api/supabase.ts
  crypto/CryptoService.ts
  storage/SecureStorageService.ts
  i18n/index.ts, locales/fr.json, locales/en.json
  index.ts

src/presentation/
  theme/index.ts
  hooks/useStore.ts, index.ts
  components/
    ui/Button.tsx, Input.tsx, Card.tsx, Chip.tsx, LanguageSelector.tsx
    layout/ScreenWrapper.tsx, Header.tsx
    consent/StatusBadge.tsx, ConsentCard.tsx
    navigation/RootNavigator.tsx, AuthNavigator.tsx, MainTabNavigator.tsx, index.ts
    index.ts
  screens/
    Splash/SplashScreen.tsx
    AgeVerification/AgeVerificationScreen.tsx
    Onboarding/OnboardingScreen.tsx
    Home/HomeScreen.tsx
    CreateConsent/CreateConsentScreen.tsx
    InvitationReceived/InvitationReceivedScreen.tsx
    Confirmation/ConfirmationScreen.tsx
    History/HistoryScreen.tsx
    Resources/ResourcesScreen.tsx
    Profile/ProfileScreen.tsx

assets/images/icon.png, splash.png, adaptive-icon.png, favicon.png

__tests__/
  domain/entities.test.ts
  i18n/translations.test.ts
```

### Bugs corrigés pendant le Sprint 0

| Bug | Cause | Fix | Fichiers modifiés |
|-----|-------|-----|-------------------|
| npm ERESOLVE react-test-renderer | v19 incompatible avec React 18 | Pin react-test-renderer@18.3.1 | `package.json` |
| expo-asset not found | Dépendance implicite manquante | Ajout expo-asset + expo-constants | `package.json` |
| expo-router crash | Pas de file-based routing | Main → `node_modules/expo/AppEntry.js`, retrait expo-router | `package.json`, `app.json` |
| Supabase invalid URL crash | URL placeholder au démarrage | Client placeholder gracieux | `src/infrastructure/api/supabase.ts` |
| Fonts crash au bundle | require() échoue si fichiers absents | useFonts() sans fichiers requis | `App.tsx` |
| SecureStore invalid key | `@` et `:` interdits | Clés format `jeleveux.xxx` | `src/infrastructure/storage/SecureStorageService.ts`, `src/infrastructure/i18n/index.ts` |
| Bloqué après "C'est parti" | isAuthenticated toujours false | Condition Sprint 0 : age + onboarding seulement | `src/presentation/components/navigation/RootNavigator.tsx` |
| SecureStore échoue sur web | Pas de Keychain en navigateur | try/catch autour des appels save() | `AgeVerificationScreen.tsx`, `OnboardingScreen.tsx` |

---

## Sprint 1 — Onboarding et authentification

### Fichiers créés

```
supabase/migrations/001_initial_schema.sql
src/infrastructure/auth/AuthService.ts
src/presentation/screens/Auth/AuthScreen.tsx
src/presentation/screens/Auth/SetupProfileScreen.tsx
__tests__/infrastructure/auth.test.ts
.env.example
```

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `App.tsx` | Ajout polyfill `react-native-get-random-values` (1er import), restauration session Supabase, listener onAuthStateChange, restauration age/onboarding depuis SecureStore |
| `package.json` | Ajout `expo-crypto`, `react-native-get-random-values@1.11.0`, retrait `expo-router` |
| `app.json` | Retrait `expo-router` des plugins, retrait supabaseUrl/Key des extra, ajout `newArchEnabled: true` |
| `src/infrastructure/api/supabase.ts` | Lecture depuis `process.env.EXPO_PUBLIC_*` au lieu de `app.json extra`, retrait import `expo-constants` |
| `src/infrastructure/index.ts` | Export du AuthService |
| `src/presentation/components/navigation/RootNavigator.tsx` | Condition auth réactivée : `isAuthenticated && isAgeVerified && hasCompletedOnboarding` |
| `src/presentation/components/navigation/AuthNavigator.tsx` | Ajout écrans Login et SetupProfile |
| `src/presentation/components/navigation/index.ts` | Export des nouveaux écrans |
| `src/presentation/screens/Onboarding/OnboardingScreen.tsx` | Navigation vers Login après "C'est parti" |
| `src/presentation/screens/Profile/ProfileScreen.tsx` | Logout via `authService.signOut()` |
| `src/presentation/screens/Auth/AuthScreen.tsx` | Fix iOS autofill : `textContentType="none"` + `autoComplete="off"` sur les champs password |

### Bugs corrigés pendant le Sprint 1

| Bug | Cause | Fix | Fichiers modifiés |
|-----|-------|-----|-------------------|
| "no PRNG" à l'inscription | TweetNaCl sans crypto.getRandomValues | Polyfill `react-native-get-random-values` en 1er import | `App.tsx`, `package.json` |
| npm ERESOLVE get-random-values | v2 exige RN 0.81+ | Pin à v1.11.0 | `package.json` |
| iOS "Automatic Strong Password" | Autofill détecte les champs password | `textContentType="none"` + `autoComplete="off"` | `AuthScreen.tsx` |
| "email rate limit exceeded" | Trop de tentatives d'inscription Supabase | ⚠️ Pas un bug code — désactiver confirm email en dev | Dashboard Supabase |
| Variables Supabase commitées | Clés dans app.json | Migration vers .env + process.env.EXPO_PUBLIC_* | `app.json`, `supabase.ts`, `.env.example` |

---

## Conventions du projet

### Variables d'environnement
- `.env.example` → commité (template sans valeurs)
- `.env` → gitignored (valeurs réelles)
- Préfixe `EXPO_PUBLIC_` pour les variables accessibles côté client
- La clé anon Supabase est publique par design (sécurité = RLS)
- La service_role key ne doit JAMAIS apparaître côté client

### Clés SecureStore
- Format : `jeleveux.nom_de_la_cle` (alphanumérique + `.` + `_` + `-`)
- Jamais de `@` ou `:` (interdit par expo-secure-store)

### i18n
- Aucune chaîne en dur : tout passe par `t('key')`
- Fichiers : `src/infrastructure/i18n/locales/fr.json` et `en.json`
- Test de parité : `npm run test:i18n`
- Détection auto langue téléphone, changement manuel dans le profil

### Architecture
- Domain → no external dependencies
- Application → depends on Domain only, receives infra via DI container
- Infrastructure → implements Domain interfaces
- Presentation → calls Application use cases only (never Infrastructure)
- App.tsx is the ONLY file that imports Infrastructure (for DI wiring)

### Imports critiques
- `react-native-get-random-values` DOIT être le 1er import de App.tsx
- `react-native-url-polyfill/auto` DOIT être importé avant Supabase

---

## Refactoring — Clean Architecture (post Sprint 1)

### Problem
Presentation layer (screens) was importing Infrastructure directly (authService, cryptoService, secureStorage). This violates the dependency rule: Presentation should only know about the Application layer.

### Solution
Introduced the Application layer with:
- **DI Container** — wires Infrastructure implementations to Domain interfaces
- **Use Cases** — orchestrate business logic, called by Presentation
- **Error codes** — domain-level error strings mapped to i18n in Presentation

### New files created

```
src/application/
  index.ts
  interfaces/
    container.ts              — DI container (initContainer / getContainer)
    index.ts
  usecases/auth/
    signUpUseCase.ts          — validate + create account + generate E2E keys + store locally
    signInUseCase.ts          — validate + authenticate + fetch profile
    sendMagicLinkUseCase.ts   — validate email + send OTP
    signOutUseCase.ts         — delegate to IAuthService
    restoreSessionUseCase.ts  — restore SecureStore flags + Supabase session
    index.ts
```

### Files modified

| File | Change |
|------|--------|
| `App.tsx` | Imports infra ONLY for DI wiring via `initContainer()`. Uses `restoreSessionUseCase` instead of direct infra calls. Auth state listener uses `authService.onAuthStateChange` (acceptable since App.tsx is the DI boundary). Comments → English. |
| `src/domain/interfaces/repositories.ts` | Added `IAuthService` interface. All comments → English. |
| `src/domain/interfaces/index.ts` | Export `IAuthService`. |
| `src/infrastructure/auth/AuthService.ts` | Now `implements IAuthService`. Simplified return types (`{ userId }` instead of raw Supabase objects). Comments → English. |
| `src/presentation/screens/Auth/AuthScreen.tsx` | Replaced all `authService.*` / `cryptoService.*` / `secureStorage.*` calls with `signUpUseCase` / `signInUseCase` / `sendMagicLinkUseCase`. Added centralized `handleError()` mapping domain errors to i18n. Comments → English. |
| `src/presentation/screens/Profile/ProfileScreen.tsx` | Replaced `authService.signOut()` with `signOutUseCase()`. Comments → English. |

### Dependency flow (after refactoring)

```
App.tsx (DI boundary)
  │
  ├── imports Infrastructure (ONLY here)
  ├── calls initContainer({ auth, crypto, secureStorage })
  └── calls restoreSessionUseCase()

Presentation (screens, components)
  │
  └── imports Application (use cases)
        │
        └── calls getContainer() → gets Domain interfaces
              │
              └── Domain interfaces implemented by Infrastructure
```

### Verification checklist
- [ ] `grep -r "from.*infrastructure" src/presentation/` should return ZERO results
- [ ] `grep -r "from.*infrastructure" src/application/` should return ZERO results
- [ ] Only `App.tsx` imports from `src/infrastructure/`
