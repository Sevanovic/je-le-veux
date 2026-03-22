# Je Le Veux

**Consentement mutuel, libre et explicite.**

Application mobile-first permettant à deux adultes d'établir un consentement mutuel explicite, libre et révocable avant une interaction intime ou personnelle.

---

## Quick start

### Prérequis

- Node.js 20+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS : Xcode 15+ (pour simulateur)
- Android : Android Studio + émulateur

### Installation

```bash
# Cloner le repo
git clone <repo-url>
cd je-le-veux

# Installer les dépendances
npm install

# Télécharger les fonts (à placer dans assets/fonts/)
# - PlayfairDisplay-Regular.ttf
# - PlayfairDisplay-Medium.ttf
# - PlayfairDisplay-Bold.ttf
# - DMSans-Regular.ttf
# - DMSans-Medium.ttf
# - DMSans-SemiBold.ttf
# - DMSans-Bold.ttf
# - SpaceMono-Regular.ttf

# Configurer Supabase
# Éditer app.json > extra > supabaseUrl et supabaseAnonKey
```

### Lancer l'application

```bash
# Démarrer le serveur de dev
npm start

# Sur iOS
npm run ios

# Sur Android
npm run android
```

### Tests

```bash
# Tous les tests
npm test

# Tests i18n uniquement (vérifie la parité FR/EN)
npm run test:i18n

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## Architecture

Clean Architecture en 4 couches :

```
src/
├── domain/              # Couche métier pure (aucune dépendance)
│   ├── entities/        # User, Consent, Invitation
│   ├── enums/           # ConsentLevel, ConsentStatus, SupportedLanguage
│   └── interfaces/      # Contrats (IConsentRepository, ICryptoService...)
│
├── application/         # Use cases et logique applicative
│   ├── usecases/        # CreateConsent, AcceptConsent, WithdrawConsent...
│   ├── services/        # Orchestration
│   └── interfaces/      # Ports applicatifs
│
├── infrastructure/      # Implémentations concrètes
│   ├── api/             # Client Supabase
│   ├── crypto/          # Chiffrement E2E (TweetNaCl)
│   ├── storage/         # Secure storage (Keychain/Keystore)
│   ├── i18n/            # Configuration i18next + locales FR/EN
│   └── notifications/   # Expo Notifications
│
└── presentation/        # Interface utilisateur
    ├── screens/         # Écrans de l'application
    ├── components/      # Composants réutilisables (ui, layout, consent, navigation)
    ├── hooks/           # Zustand stores + hooks custom
    └── theme/           # Design tokens (colors, typography, spacing)
```

### Règle fondamentale

Les dépendances vont de l'extérieur vers l'intérieur :
- `presentation` → `application` → `domain` ✅
- `domain` → `infrastructure` ❌ INTERDIT

### Internationalisation (i18n)

- **Détection automatique** : lit la langue du téléphone au 1er lancement
- **Changement manuel** : sélecteur FR/EN dans le profil
- **Persistance** : le choix survit aux redémarrages (AsyncStorage)
- **Règle** : aucune chaîne en dur dans le code — tout passe par `t('key')`
- **Test** : `npm run test:i18n` vérifie que FR et EN ont les mêmes clés

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React Native + Expo SDK 52 |
| Langage | TypeScript strict |
| State | Zustand |
| Navigation | React Navigation 7 |
| i18n | react-i18next + expo-localization |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Chiffrement | TweetNaCl.js (Curve25519-XSalsa20-Poly1305) |
| Stockage sécurisé | expo-secure-store |
| CI/CD | GitHub Actions + EAS Build |
| Tests | Jest + React Native Testing Library |

---

## Palette de couleurs (logo)

| Token | Hex | Usage |
|-------|-----|-------|
| Gold | `#C9A84C` | Actions primaires, confiance |
| Gold Light | `#E8D48B` | Accents, dégradés |
| Silver | `#B8B8B8` | Éléments secondaires |
| Dark BG | `#0F0F12` | Fond principal |
| Card BG | `#1A1A20` | Cartes et surfaces |

---

## Sprints

| Sprint | Focus | Statut |
|--------|-------|--------|
| 0 | Fondations + Architecture + i18n | ✅ En cours |
| 1 | Onboarding + Authentification | ⏳ Prochain |
| 2 | Création de consentement | |
| 3 | Réception + Confirmation | |
| 4 | Retrait + Historique | |
| 5 | Ressources + Profil + Légal | |
| 6 | Sécurité + Performance | |
| 7 | Beta + Polish | |
| 8 | Lancement stores | |

---

## Licence

Propriétaire — © 2026 Je Le Veux. Tous droits réservés.
