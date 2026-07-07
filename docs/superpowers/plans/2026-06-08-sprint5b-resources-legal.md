# Sprint 5b — Resources + Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver detailed content for the 4 existing Resources cards, ship the 3 legal pages (Terms, Privacy Policy, Legal Mentions), and gate sign-up on explicit terms acceptance with DB tracking.

**Architecture:** A typed `ContentRegistry` lists 7 documents as ordered blocks (heading, paragraph, bullet, phone, email, link). A single `ContentScreen` rendered as a modal at the RootNavigator level handles all 7 documents. Sign-up requires a checkbox, writes `terms_accepted_at` to `profiles`.

**Tech Stack:** React Navigation modal presentation, react-i18next, Supabase ALTER TABLE migration, expo-linking (already a dep via expo) for `Linking.openURL`.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/005_terms_acceptance.sql` | Add `profiles.terms_accepted_at` column + index |
| Modify | `src/domain/entities/User.ts` | Add `termsAcceptedAt?: Date` |
| Modify | `src/infrastructure/auth/AuthService.ts` | Map `termsAcceptedAt` in `getProfile` + `updateProfile` |
| Modify | `src/application/usecases/auth/signUpUseCase.ts` | Require `termsAccepted`, persist `termsAcceptedAt` |
| Create | `src/application/usecases/auth/acceptTermsUseCase.ts` | Re-acceptance use case for future versioning |
| Modify | `src/application/usecases/auth/index.ts` | Export new use case |
| Modify | `src/application/index.ts` | Export new use case |
| Create | `src/presentation/content/types.ts` | ContentBlock, ContentDocument, ContentKey types |
| Create | `src/presentation/content/registry.ts` | 7 documents as block lists |
| Create | `src/presentation/content/index.ts` | Barrel |
| Create | `src/presentation/components/content/ContentRenderer.tsx` | Block-by-block renderer with Linking handlers |
| Create | `src/presentation/components/ui/CheckboxRow.tsx` | Custom checkbox (RN has none) |
| Modify | `src/presentation/components/index.ts` | Export ContentRenderer + CheckboxRow |
| Create | `src/presentation/screens/Content/ContentScreen.tsx` | Modal screen reading contentKey from route |
| Create | `src/presentation/screens/Content/index.ts` | Barrel |
| Modify | `src/presentation/components/navigation/RootNavigator.tsx` | Add Content modal route at root level |
| Modify | `src/presentation/screens/Resources/ResourcesScreen.tsx` | Wire 4 cards to Content modal |
| Modify | `src/presentation/screens/Profile/ProfileScreen.tsx` | Add Legal section card |
| Modify | `src/presentation/screens/Auth/AuthScreen.tsx` | Add terms checkbox + inline links, block submit when unchecked |
| Modify | `src/infrastructure/i18n/locales/fr.json` | Full content + extensions to existing sections |
| Modify | `src/infrastructure/i18n/locales/en.json` | Mirror (parity) |

---

## Task 1: Supabase migration — terms_accepted_at

**Files:** Create `supabase/migrations/005_terms_acceptance.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 5b : Traçabilité acceptation CGU (RGPD)
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Index pour audits RGPD (récupérer rapidement les utilisateurs
-- ayant accepté les CGU avant/après une date donnée)
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at
  ON public.profiles(terms_accepted_at);
```

- [ ] **Step 2: Apply migration manually**

Open Supabase Dashboard → SQL Editor → paste contents → Run.

Expected: column added, index created. No errors.

---

## Task 2: Domain entity extension

**Files:** Modify `src/domain/entities/User.ts`

- [ ] **Step 1: Add `termsAcceptedAt` to User**

Find the `User` interface. Add a new optional field:

```typescript
export interface User {
  // ...existing fields stay unchanged
  termsAcceptedAt?: Date;
}
```

Place the new field after the existing `createdAt` field for consistency.

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: errors about AuthService not yet handling the new field — fine (fixed in Task 3).

---

## Task 3: AuthService mapping

**Files:** Modify `src/infrastructure/auth/AuthService.ts`

- [ ] **Step 1: Update `getProfile` to read `terms_accepted_at`**

Find the `getProfile` method. In the returned object literal, add:

```typescript
      termsAcceptedAt: data.terms_accepted_at ? new Date(data.terms_accepted_at) : undefined,
```

Place it after the existing `createdAt: new Date(data.created_at),` line.

- [ ] **Step 2: Update `updateProfile` to map `termsAcceptedAt` → `terms_accepted_at`**

Find the `updateProfile` method. In the conditional mapping block (currently mapping `pseudonym`, `preferredLanguage`, etc.), add:

```typescript
    if (updates.termsAcceptedAt !== undefined) {
      mapped.terms_accepted_at = updates.termsAcceptedAt instanceof Date
        ? updates.termsAcceptedAt.toISOString()
        : updates.termsAcceptedAt;
    }
```

Place it after the existing `avatarUrl` mapping.

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to AuthService.

---

## Task 4: signUpUseCase enforces terms + acceptTermsUseCase

**Files:**
- Modify `src/application/usecases/auth/signUpUseCase.ts`
- Create `src/application/usecases/auth/acceptTermsUseCase.ts`

- [ ] **Step 1: Replace `signUpUseCase` content**

```typescript
import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import type { User } from '../../../domain/entities';
import type { SupportedLanguage } from '../../../domain/enums';

export interface SignUpInput {
  email: string;
  password: string;
  pseudonym: string;
  preferredLanguage: SupportedLanguage;
  termsAccepted: boolean;
}

export interface SignUpOutput {
  user: User;
}

/**
 * Use case: Sign up a new user.
 *
 * Orchestrates:
 * 1. Validate inputs (pseudonym, email, password, terms)
 * 2. Create auth account via IAuthService
 * 3. Generate E2E key pair via ICryptoService
 * 4. Store secret key locally via ISecureStorageService
 * 5. Send public key + terms acceptance timestamp to user profile
 * 6. Return complete user profile
 */
export async function signUpUseCase(input: SignUpInput): Promise<SignUpOutput> {
  const { auth, crypto, secureStorage } = getContainer();

  // 1. Domain validation
  if (!isValidPseudonym(input.pseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }
  if (!input.email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }
  if (input.password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT');
  }
  if (!input.termsAccepted) {
    throw new Error('TERMS_NOT_ACCEPTED');
  }

  // 2. Create account
  const { userId } = await auth.signUp({
    email: input.email,
    password: input.password,
    pseudonym: input.pseudonym,
    preferredLanguage: input.preferredLanguage,
  });

  // 3. Generate E2E key pair
  const keyPair = await crypto.generateKeyPair();

  // 4. Store secret key locally (never sent to server)
  try {
    await secureStorage.save('jeleveux.secret_key', keyPair.secretKey);
    await secureStorage.save('jeleveux.public_key', keyPair.publicKey);
  } catch {
    // SecureStore may fail on web — non-blocking
  }

  // 5. Send public key + terms acceptance to profile
  await auth.updateProfile(userId, {
    publicKey: keyPair.publicKey,
    termsAcceptedAt: new Date(),
  } as Partial<User>);

  // 6. Fetch and return complete profile
  const profile = await auth.getProfile(userId);
  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return { user: profile };
}
```

- [ ] **Step 2: Create `acceptTermsUseCase`**

Create `src/application/usecases/auth/acceptTermsUseCase.ts`:

```typescript
import { getContainer } from '../../interfaces/container';
import type { User } from '../../../domain/entities';

export interface AcceptTermsInput {
  userId: string;
}

export interface AcceptTermsOutput {
  user: User;
}

/**
 * Record that the user has accepted the current Terms version.
 * Used at sign-up (called indirectly via signUpUseCase) and exposed
 * for future re-acceptance flows when Terms change.
 */
export async function acceptTermsUseCase(
  input: AcceptTermsInput,
): Promise<AcceptTermsOutput> {
  const { auth } = getContainer();

  await auth.updateProfile(input.userId, { termsAcceptedAt: new Date() } as Partial<User>);

  const user = await auth.getProfile(input.userId);
  if (!user) throw new Error('PROFILE_NOT_FOUND');
  return { user };
}
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: errors about `AuthScreen.tsx` (won't have `termsAccepted` argument yet — fixed in Task 13). No other errors.

---

## Task 5: Auth use case barrel + application barrel

**Files:**
- Modify `src/application/usecases/auth/index.ts`
- Modify `src/application/index.ts`

- [ ] **Step 1: Add to auth barrel**

In `src/application/usecases/auth/index.ts`, after the existing exports, ADD:

```typescript
export { acceptTermsUseCase } from './acceptTermsUseCase';
export type { AcceptTermsInput, AcceptTermsOutput } from './acceptTermsUseCase';
```

- [ ] **Step 2: Add to application barrel**

In `src/application/index.ts`, find the existing auth export block:

```typescript
export {
  signUpUseCase,
  signInUseCase,
  sendMagicLinkUseCase,
  signOutUseCase,
  restoreSessionUseCase,
} from './usecases/auth';
```

Replace with:

```typescript
export {
  signUpUseCase,
  signInUseCase,
  sendMagicLinkUseCase,
  signOutUseCase,
  restoreSessionUseCase,
  acceptTermsUseCase,
} from './usecases/auth';
```

---

## Task 6: ContentRegistry — types + registry + barrel

**Files:**
- Create `src/presentation/content/types.ts`
- Create `src/presentation/content/registry.ts`
- Create `src/presentation/content/index.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
/**
 * Block-level content types used by the ContentRegistry and ContentRenderer.
 * All text comes from i18n via textKey/labelKey; structure (block ordering
 * and type) is TypeScript code.
 */
export type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; textKey: string }
  | { type: 'paragraph'; textKey: string }
  | { type: 'bullet'; textKey: string }
  | { type: 'phone'; labelKey: string; number: string }
  | { type: 'email'; labelKey: string; address: string }
  | { type: 'link'; labelKey: string; url: string };

export interface ContentDocument {
  titleKey: string;
  /** ISO date (YYYY-MM-DD) of last edit, shown in the footer. */
  lastUpdatedISO: string;
  blocks: ContentBlock[];
}

export type ContentKey =
  | 'consent'
  | 'legalFramework'
  | 'helpline'
  | 'privacy'
  | 'terms'
  | 'privacyPolicy'
  | 'legalMentions';
```

- [ ] **Step 2: Write `registry.ts`**

```typescript
import type { ContentDocument, ContentKey } from './types';

const LAST_UPDATED = '2026-06-08';

export const CONTENT_REGISTRY: Record<ContentKey, ContentDocument> = {
  consent: {
    titleKey: 'content.consent.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.consent.intro' },
      { type: 'heading', level: 2, textKey: 'content.consent.flerrTitle' },
      { type: 'bullet', textKey: 'content.consent.flerrFree' },
      { type: 'bullet', textKey: 'content.consent.flerrInformed' },
      { type: 'bullet', textKey: 'content.consent.flerrExplicit' },
      { type: 'bullet', textKey: 'content.consent.flerrRevocable' },
      { type: 'bullet', textKey: 'content.consent.flerrRenewable' },
      { type: 'heading', level: 2, textKey: 'content.consent.importantTitle' },
      { type: 'paragraph', textKey: 'content.consent.importantBody' },
    ],
  },

  legalFramework: {
    titleKey: 'content.legalFramework.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.legalFramework.intro' },
      { type: 'heading', level: 2, textKey: 'content.legalFramework.frenchLawTitle' },
      { type: 'paragraph', textKey: 'content.legalFramework.frenchLawBody' },
      { type: 'paragraph', textKey: 'content.legalFramework.frenchLawArticle' },
      { type: 'heading', level: 2, textKey: 'content.legalFramework.importantTitle' },
      { type: 'paragraph', textKey: 'content.legalFramework.importantBody' },
    ],
  },

  helpline: {
    titleKey: 'content.helpline.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.helpline.intro' },

      { type: 'heading', level: 2, textKey: 'content.helpline.frTitle' },
      { type: 'phone', labelKey: 'content.helpline.fr3919', number: '3919' },
      { type: 'phone', labelKey: 'content.helpline.frPolice', number: '17' },
      { type: 'phone', labelKey: 'content.helpline.frSos', number: '116006' },

      { type: 'heading', level: 2, textKey: 'content.helpline.enTitle' },
      { type: 'phone', labelKey: 'content.helpline.usRainn', number: '+18006564673' },
      { type: 'phone', labelKey: 'content.helpline.ukRefuge', number: '+448082000247' },

      { type: 'paragraph', textKey: 'content.helpline.internationalNote' },
    ],
  },

  privacy: {
    titleKey: 'content.privacy.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.privacy.intro' },
      { type: 'heading', level: 2, textKey: 'content.privacy.e2eTitle' },
      { type: 'paragraph', textKey: 'content.privacy.e2eBody' },
      { type: 'heading', level: 2, textKey: 'content.privacy.storageTitle' },
      { type: 'paragraph', textKey: 'content.privacy.storageBody' },
      { type: 'heading', level: 2, textKey: 'content.privacy.rightsTitle' },
      { type: 'paragraph', textKey: 'content.privacy.rightsBody' },
    ],
  },

  terms: {
    titleKey: 'content.terms.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.terms.preamble' },

      { type: 'heading', level: 2, textKey: 'content.terms.objectTitle' },
      { type: 'paragraph', textKey: 'content.terms.objectBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.eligibilityTitle' },
      { type: 'paragraph', textKey: 'content.terms.eligibilityBody' },
      { type: 'bullet', textKey: 'content.terms.eligibilityBullet1' },
      { type: 'bullet', textKey: 'content.terms.eligibilityBullet2' },

      { type: 'heading', level: 2, textKey: 'content.terms.accountTitle' },
      { type: 'paragraph', textKey: 'content.terms.accountBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.serviceTitle' },
      { type: 'paragraph', textKey: 'content.terms.serviceBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.conductTitle' },
      { type: 'paragraph', textKey: 'content.terms.conductBody' },
      { type: 'bullet', textKey: 'content.terms.conductBullet1' },
      { type: 'bullet', textKey: 'content.terms.conductBullet2' },
      { type: 'bullet', textKey: 'content.terms.conductBullet3' },

      { type: 'heading', level: 2, textKey: 'content.terms.liabilityTitle' },
      { type: 'paragraph', textKey: 'content.terms.liabilityBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.ipTitle' },
      { type: 'paragraph', textKey: 'content.terms.ipBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.terminationTitle' },
      { type: 'paragraph', textKey: 'content.terms.terminationBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.changesTitle' },
      { type: 'paragraph', textKey: 'content.terms.changesBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.jurisdictionTitle' },
      { type: 'paragraph', textKey: 'content.terms.jurisdictionBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.contactTitle' },
      { type: 'email', labelKey: 'content.terms.contactEmail', address: 'contact@jeleveux.app' },
    ],
  },

  privacyPolicy: {
    titleKey: 'content.privacyPolicy.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.privacyPolicy.preamble' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.controllerTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.controllerBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.dataTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.dataBody' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet1' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet2' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet3' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet4' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.purposeTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.purposeBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.basisTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.basisBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.retentionTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.retentionBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.sharingTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.sharingBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.rightsTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.rightsBody' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsAccess' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsRectify' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsErasure' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsPortability' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsOppose' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.securityTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.securityBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.contactTitle' },
      { type: 'email', labelKey: 'content.privacyPolicy.contactEmail', address: 'privacy@jeleveux.app' },
    ],
  },

  legalMentions: {
    titleKey: 'content.legalMentions.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'heading', level: 2, textKey: 'content.legalMentions.editorTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.editorBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.directorTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.directorBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.hostTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.hostBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.contactTitle' },
      { type: 'email', labelKey: 'content.legalMentions.contactEmail', address: 'contact@jeleveux.app' },
    ],
  },
};

export function getContentDocument(key: ContentKey): ContentDocument {
  return CONTENT_REGISTRY[key];
}
```

- [ ] **Step 3: Write `index.ts`**

```typescript
export type { ContentBlock, ContentDocument, ContentKey } from './types';
export { CONTENT_REGISTRY, getContentDocument } from './registry';
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to content.

---

## Task 7: ContentRenderer component

**Files:**
- Create `src/presentation/components/content/ContentRenderer.tsx`

- [ ] **Step 1: Write the component**

```typescript
import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ContentBlock } from '../../content/types';
import { colors, typography, spacing } from '../../theme';

interface ContentRendererProps {
  blocks: ContentBlock[];
}

/**
 * Renders an ordered list of typed content blocks. Phone/email/link blocks
 * become tappable using Linking.openURL with tel:, mailto:, and https: schemes.
 */
export function ContentRenderer({ blocks }: ContentRendererProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const styleForLevel =
              block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
            return (
              <Text key={idx} style={styleForLevel}>
                {t(block.textKey)}
              </Text>
            );
          }
          case 'paragraph':
            return (
              <Text key={idx} style={styles.paragraph}>
                {t(block.textKey)}
              </Text>
            );
          case 'bullet':
            return (
              <View key={idx} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>•</Text>
                <Text style={styles.bulletText}>{t(block.textKey)}</Text>
              </View>
            );
          case 'phone':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(`tel:${block.number}`)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.number}</Text>
              </TouchableOpacity>
            );
          case 'email':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(`mailto:${block.address}`)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.address}</Text>
              </TouchableOpacity>
            );
          case 'link':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(block.url)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.url}</Text>
              </TouchableOpacity>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  h1: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  h2: {
    fontFamily: typography.fontFamily.displayMedium,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  h3: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  paragraph: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  bulletMark: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: 8,
  },
  actionLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  actionValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    color: colors.gold.DEFAULT,
  },
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to ContentRenderer.

---

## Task 8: CheckboxRow component

**Files:**
- Create `src/presentation/components/ui/CheckboxRow.tsx`

- [ ] **Step 1: Write the component**

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface CheckboxRowProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Custom checkbox row. React Native has no native Checkbox component;
 * this draws a square with a gold border + golden checkmark when checked.
 * Children render to the right of the checkbox — typically inline Text
 * with tappable spans (links).
 */
export function CheckboxRow({ checked, onToggle, children, testID }: CheckboxRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={[styles.box, checked && styles.boxChecked]}
        testID={testID}
      >
        {checked ? <Text style={styles.mark}>✓</Text> : null}
      </TouchableOpacity>
      <View style={styles.textContainer}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.silver.dark,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    borderColor: colors.gold.DEFAULT,
    backgroundColor: colors.gold.muted,
  },
  mark: {
    fontSize: 14,
    color: colors.gold.DEFAULT,
    fontFamily: typography.fontFamily.bodyMedium,
    lineHeight: 16,
  },
  textContainer: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 9: Components barrel — export new components

**Files:** Modify `src/presentation/components/index.ts`

- [ ] **Step 1: Add exports**

Add after the existing `LanguageSelector` export:

```typescript
export { CheckboxRow } from './ui/CheckboxRow';
```

Add at the end of the file:

```typescript
// Content rendering
export { ContentRenderer } from './content/ContentRenderer';
```

---

## Task 10: ContentScreen

**Files:**
- Create `src/presentation/screens/Content/ContentScreen.tsx`
- Create `src/presentation/screens/Content/index.ts`

- [ ] **Step 1: Write the screen**

```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getContentDocument, type ContentKey } from '../../content';
import { Header, ContentRenderer } from '../../components';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import { colors, typography, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Content'>;
type Rt = RouteProp<RootStackParamList, 'Content'>;

export function ContentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const doc = getContentDocument(route.params.contentKey as ContentKey);

  return (
    <View style={styles.root}>
      <Header
        title={t(doc.titleKey)}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ContentRenderer blocks={doc.blocks} />

        <Text style={styles.footer}>
          {t('content.lastUpdated', { date: doc.lastUpdatedISO })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  footer: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing['2xl'],
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Write barrel**

Create `src/presentation/screens/Content/index.ts`:

```typescript
export { ContentScreen } from './ContentScreen';
```

- [ ] **Step 3: Verify compilation**

Expected to fail until Task 11 (RootNavigator updates the param list). That's OK.

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: only error should be about `RootStackParamList` not yet having `Content`.

---

## Task 11: RootNavigator — add Content modal route

**Files:** Modify `src/presentation/components/navigation/RootNavigator.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../../hooks';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ContentScreen } from '../../screens/Content';
import type { ContentKey } from '../../content';
import { colors } from '../../theme';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Content: { contentKey: ContentKey };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navigateur racine.
 * - Auth ou Main selon l'état d'authentification.
 * - Content présenté en modal au-dessus, accessible depuis n'importe quel
 *   sous-stack via navigation.navigate('Content', { contentKey: ... }).
 */
export function RootNavigator() {
  const { isAuthenticated, isAgeVerified, hasCompletedOnboarding } =
    useAuthStore();

  const showMain = isAuthenticated && isAgeVerified && hasCompletedOnboarding;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
      }}
    >
      {showMain ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
      <Stack.Screen
        name="Content"
        component={ContentScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to RootNavigator or ContentScreen.

---

## Task 12: ResourcesScreen — wire cards to Content modal

**Files:** Modify `src/presentation/screens/Resources/ResourcesScreen.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenWrapper, Card } from '../../components';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import type { ContentKey } from '../../content';
import { colors, typography, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Écran Ressources — contenu éducatif, cadre légal, lignes d'écoute.
 * Tout le contenu est bilingue via i18n.
 * Chaque carte ouvre une ContentScreen modale via le RootNavigator.
 */
export function ResourcesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();

  const resources: Array<{ titleKey: string; descKey: string; contentKey: ContentKey }> = [
    {
      titleKey: 'resources.whatIsConsent',
      descKey: 'resources.whatIsConsentDesc',
      contentKey: 'consent',
    },
    {
      titleKey: 'resources.legalFramework',
      descKey: 'resources.legalFrameworkDesc',
      contentKey: 'legalFramework',
    },
    {
      titleKey: 'resources.helpline',
      descKey: 'resources.helplineDesc',
      contentKey: 'helpline',
    },
    {
      titleKey: 'resources.privacy',
      descKey: 'resources.privacyDesc',
      contentKey: 'privacy',
    },
  ];

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>{t('resources.title')}</Text>
      </View>

      <View style={styles.list}>
        {resources.map((res) => (
          <Card key={res.contentKey}>
            <Text style={styles.cardTitle}>{t(res.titleKey)}</Text>
            <Text style={styles.cardDesc}>{t(res.descKey)}</Text>
            <TouchableOpacity
              style={styles.link}
              onPress={() => navigation.navigate('Content', { contentKey: res.contentKey })}
              testID={`resource-link-${res.contentKey}`}
            >
              <Text style={styles.linkText}>
                {t('resources.learnMore')} {'→'}
              </Text>
            </TouchableOpacity>
          </Card>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
  },
  list: {
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  cardDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  link: {
    marginTop: spacing.sm + 2,
  },
  linkText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.gold.DEFAULT,
  },
});
```

- [ ] **Step 2: Verify compilation**

Expected: no errors.

---

## Task 13: ProfileScreen — Legal section

**Files:** Modify `src/presentation/screens/Profile/ProfileScreen.tsx`

- [ ] **Step 1: Update navigation typing**

Find the existing `type Nav = NativeStackNavigationProp<HomeStackParamList, 'Profile'>;` line.

Add the import for RootStackParamList (at the top with the other imports):

```typescript
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
```

After the existing `type Nav = ...` line, add:

```typescript
type RootNav = NativeStackNavigationProp<RootStackParamList>;
```

- [ ] **Step 2: Insert Legal card**

Find the existing "My data" Card block. After its closing `</Card>` and BEFORE the `Sign out` block, INSERT:

```typescript
      {/* Legal */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.legal')}</Text>
        <View style={styles.legalRows}>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'terms' })}
            style={styles.legalRow}
            testID="profile-terms-link"
          >
            <Text style={styles.legalLink}>{t('profile.terms')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'privacyPolicy' })}
            style={styles.legalRow}
            testID="profile-privacy-link"
          >
            <Text style={styles.legalLink}>{t('profile.privacyPolicy')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'legalMentions' })}
            style={styles.legalRow}
            testID="profile-mentions-link"
          >
            <Text style={styles.legalLink}>{t('profile.legalMentions')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
        </View>
      </Card>
```

Add `TouchableOpacity` to the existing `react-native` import if not already there.

- [ ] **Step 3: Add styles**

In the `styles` StyleSheet at the bottom, add (after the existing styles):

```typescript
  legalRows: {
    gap: 0,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  legalLink: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  legalArrow: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
  },
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 14: AuthScreen — terms checkbox + tappable links

**Files:** Modify `src/presentation/screens/Auth/AuthScreen.tsx`

- [ ] **Step 1: Add imports**

After the existing import lines, add:

```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import { CheckboxRow } from '../../components';
```

- [ ] **Step 2: Add state + navigation hook**

Inside the `AuthScreen` function, after the existing `const [errors, setErrors] = useState<...>({});` line, add:

```typescript
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

- [ ] **Step 3: Update `handleSignUp` to pass termsAccepted**

Find:
```typescript
      const { user } = await signUpUseCase({
        email,
        password,
        pseudonym,
        preferredLanguage: getCurrentLanguage(),
      });
```

Replace with:
```typescript
      const { user } = await signUpUseCase({
        email,
        password,
        pseudonym,
        preferredLanguage: getCurrentLanguage(),
        termsAccepted,
      });
```

- [ ] **Step 4: Add TERMS_NOT_ACCEPTED handler**

In `handleError`, find the `errorMap` object and add a new entry:

```typescript
      TERMS_NOT_ACCEPTED: () => Alert.alert(t('common.error'), t('auth.errorTermsNotAccepted')),
```

- [ ] **Step 5: Render checkbox before sign-up button**

Find the existing `<Button title={isSignUp ? t('auth.signUp') : t('auth.signIn')}` block.

Immediately BEFORE that button, ADD (only when `isSignUp` is true):

```typescript
          {isSignUp && (
            <CheckboxRow
              checked={termsAccepted}
              onToggle={() => setTermsAccepted(!termsAccepted)}
              testID="auth-terms-checkbox"
            >
              <Text style={styles.termsText}>
                {t('auth.termsAcceptancePrefix')}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('Content', { contentKey: 'terms' })}
                >
                  {t('auth.termsLink')}
                </Text>
                {t('auth.termsAcceptanceMiddle')}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('Content', { contentKey: 'privacyPolicy' })}
                >
                  {t('auth.privacyPolicyLink')}
                </Text>
              </Text>
            </CheckboxRow>
          )}
```

- [ ] **Step 6: Disable sign-up button when terms not accepted**

Find the existing submit Button. Change to:

```typescript
          <Button
            title={isSignUp ? t('auth.signUp') : t('auth.signIn')}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            loading={isLoading}
            disabled={isSignUp && !termsAccepted}
            testID="auth-submit-btn"
          />
```

- [ ] **Step 7: Add terms styles**

In the `styles` StyleSheet, add:

```typescript
  termsText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.gold.DEFAULT,
    fontFamily: typography.fontFamily.bodyMedium,
  },
```

- [ ] **Step 8: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 15: i18n keys (FR)

**Files:** Modify `src/infrastructure/i18n/locales/fr.json`

- [ ] **Step 1: Extend `auth` section**

Inside the `"auth"` block, after the existing `"passwordMismatch"` key, ADD:

```json
"termsAcceptancePrefix": "J'accepte les ",
"termsLink": "Conditions Générales d'Utilisation",
"termsAcceptanceMiddle": " et la ",
"privacyPolicyLink": "Politique de confidentialité",
"errorTermsNotAccepted": "Vous devez accepter les CGU et la Politique de confidentialité."
```

- [ ] **Step 2: Extend `profile` section**

Inside the `"profile"` block, after the existing `"errorUpdateFailed"` key, ADD:

```json
"legal": "Légal",
"terms": "Conditions Générales d'Utilisation",
"privacyPolicy": "Politique de confidentialité",
"legalMentions": "Mentions légales"
```

- [ ] **Step 3: Add new top-level `content` section**

After the existing `"biometricLock"` block, ADD a new top-level section:

```json
"content": {
  "lastUpdated": "Dernière mise à jour : {{date}}",

  "consent": {
    "title": "Qu'est-ce que le consentement ?",
    "intro": "Le consentement est un accord entre deux personnes adultes pour partager un moment, une activité, une expérience. Il doit être donné en pleine conscience, sans pression ni contrainte.",
    "flerrTitle": "Les 5 principes FLERR",
    "flerrFree": "Libre : donné sans pression, menace, ni manipulation.",
    "flerrInformed": "Éclairé : chaque partie comprend ce à quoi elle consent.",
    "flerrExplicit": "Explicite : exprimé clairement, pas supposé ni présumé.",
    "flerrRevocable": "Révocable : peut être retiré à tout instant, sans justification.",
    "flerrRenewable": "Renouvelable : un consentement passé ne vaut pas pour l'avenir.",
    "importantTitle": "Important",
    "importantBody": "Cette application est un outil de communication entre adultes consentants. Elle ne remplace pas la communication verbale, l'écoute mutuelle, ni le cadre juridique applicable."
  },

  "legalFramework": {
    "title": "Cadre juridique",
    "intro": "En France, le consentement est une notion centrale du droit pénal. Son absence caractérise certaines infractions graves (agression sexuelle, viol).",
    "frenchLawTitle": "Droit français",
    "frenchLawBody": "L'article 222-22 du Code pénal définit l'agression sexuelle comme « toute atteinte sexuelle commise avec violence, contrainte, menace ou surprise », c'est-à-dire en l'absence de consentement.",
    "frenchLawArticle": "Depuis la loi du 21 avril 2021, tout acte sexuel sur un mineur de moins de 15 ans par un majeur est qualifié de viol ou d'agression sexuelle, sans avoir à prouver l'absence de consentement.",
    "importantTitle": "Cette application n'est pas une preuve juridique",
    "importantBody": "Un consentement enregistré dans Je Le Veux ne constitue pas une preuve opposable devant un tribunal. Le consentement peut être retiré à tout moment, y compris pendant l'interaction. En cas de doute ou de situation d'urgence, contactez immédiatement les autorités ou une ligne d'écoute."
  },

  "helpline": {
    "title": "Lignes d'écoute et soutien",
    "intro": "Si vous ou un proche êtes en situation de détresse, n'hésitez pas à appeler. Ces services sont gratuits, anonymes et confidentiels.",
    "frTitle": "France",
    "fr3919": "3919 — Violences Femmes Info",
    "frPolice": "17 — Police-Secours",
    "frSos": "116 006 — Aide aux victimes",
    "enTitle": "International (anglophone)",
    "usRainn": "RAINN (États-Unis)",
    "ukRefuge": "Refuge (Royaume-Uni)",
    "internationalNote": "En dehors de ces pays, contactez les services d'urgence locaux ou une association d'aide aux victimes proche de chez vous."
  },

  "privacy": {
    "title": "Sécurité et confidentialité",
    "intro": "Je Le Veux est conçue pour protéger votre vie privée par défaut. Voici comment.",
    "e2eTitle": "Chiffrement de bout en bout",
    "e2eBody": "L'énoncé de chaque consentement est chiffré avec une clé de session générée localement, jamais transmise au serveur. Seules les personnes ayant le code de partage peuvent déchiffrer le contenu. Notre équipe et nos hébergeurs ne peuvent pas lire vos énoncés.",
    "storageTitle": "Stockage minimal",
    "storageBody": "Nous ne stockons que ce qui est strictement nécessaire au fonctionnement de l'application : votre pseudonyme, votre adresse e-mail (pour l'authentification), votre clé publique, et les métadonnées des consentements (niveau, durée, statut). Aucun contenu en clair, aucun tracking, aucune publicité.",
    "rightsTitle": "Vos droits",
    "rightsBody": "Vous pouvez à tout moment exporter toutes vos données au format JSON depuis l'écran Profil, ou supprimer définitivement votre compte. Ces droits sont conformes au RGPD (articles 15, 16, 17, 20)."
  },

  "terms": {
    "title": "Conditions Générales d'Utilisation",
    "preamble": "Les présentes Conditions Générales d'Utilisation (« CGU ») encadrent l'utilisation de l'application mobile Je Le Veux (« l'Application »). En créant un compte, vous reconnaissez avoir lu et accepté ces CGU dans leur intégralité.",

    "objectTitle": "1. Objet",
    "objectBody": "L'Application Je Le Veux est un outil de communication permettant à deux personnes majeures de formaliser un accord mutuel, libre et explicite avant une interaction. Elle ne se substitue à aucun cadre juridique, ni à la communication verbale, ni au consentement effectif qui doit être maintenu pendant toute la durée de l'interaction.",

    "eligibilityTitle": "2. Éligibilité",
    "eligibilityBody": "L'utilisation de l'Application est réservée :",
    "eligibilityBullet1": "Aux personnes physiques majeures (18 ans révolus).",
    "eligibilityBullet2": "À un usage strictement personnel et non commercial.",

    "accountTitle": "3. Compte utilisateur",
    "accountBody": "Vous êtes seul responsable de la confidentialité de vos identifiants. Vous vous engagez à fournir des informations exactes lors de l'inscription et à maintenir ces informations à jour. Vous pouvez à tout moment supprimer votre compte depuis l'écran Profil.",

    "serviceTitle": "4. Fonctionnement du service",
    "serviceBody": "L'Application permet de créer un consentement, de l'envoyer à une autre personne via un code sécurisé, et de recevoir l'acceptation ou le refus de cette personne. Tous les contenus échangés sont chiffrés de bout en bout : nous ne pouvons pas accéder à leur contenu en clair.",

    "conductTitle": "5. Engagements de l'utilisateur",
    "conductBody": "En utilisant l'Application, vous vous engagez à :",
    "conductBullet1": "Respecter les autres utilisateurs et ne pas utiliser l'Application à des fins de harcèlement, de menace ou de contrainte.",
    "conductBullet2": "Ne pas créer de consentement frauduleux ou de mauvaise foi.",
    "conductBullet3": "Respecter le caractère révocable et renouvelable du consentement : un consentement formalisé dans l'Application ne dispense pas de la communication continue avec l'autre partie.",

    "liabilityTitle": "6. Responsabilité",
    "liabilityBody": "L'éditeur ne saurait être tenu responsable des usages faits de l'Application par les utilisateurs, ni de l'absence de respect d'un consentement par l'une des parties. L'Application est un outil de communication ; elle ne garantit ni le respect effectif du consentement, ni sa valeur probatoire devant une juridiction.",

    "ipTitle": "7. Propriété intellectuelle",
    "ipBody": "L'ensemble des éléments de l'Application (interface, design, code source, marque) est protégé par le droit de la propriété intellectuelle. Toute reproduction, distribution, ou exploitation commerciale sans autorisation expresse est interdite.",

    "terminationTitle": "8. Résiliation",
    "terminationBody": "Vous pouvez supprimer votre compte à tout moment, ce qui entraîne la suppression définitive de toutes vos données. Nous nous réservons le droit de suspendre ou supprimer un compte en cas de manquement grave aux présentes CGU.",

    "changesTitle": "9. Évolution des CGU",
    "changesBody": "Nous pouvons modifier les présentes CGU. Toute modification substantielle vous sera notifiée dans l'Application avec une demande de ré-acceptation.",

    "jurisdictionTitle": "10. Droit applicable et juridiction",
    "jurisdictionBody": "Les présentes CGU sont régies par le droit français. Tout litige sera soumis à la juridiction des tribunaux français compétents.",

    "contactTitle": "11. Contact",
    "contactEmail": "Nous écrire"
  },

  "privacyPolicy": {
    "title": "Politique de confidentialité",
    "preamble": "La présente Politique de confidentialité décrit comment Je Le Veux collecte, utilise, et protège vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD).",

    "controllerTitle": "1. Responsable de traitement",
    "controllerBody": "Le responsable de traitement est l'éditeur de l'Application Je Le Veux. Vous pouvez le contacter à l'adresse indiquée en fin de document.",

    "dataTitle": "2. Données collectées",
    "dataBody": "Nous collectons uniquement les données strictement nécessaires :",
    "dataBullet1": "Votre adresse e-mail (pour l'authentification).",
    "dataBullet2": "Votre pseudonyme (visible des autres utilisateurs avec qui vous interagissez).",
    "dataBullet3": "Votre clé publique de chiffrement (pour permettre le déchiffrement local).",
    "dataBullet4": "Les métadonnées de vos consentements (niveau, durée, statut, horodatages) — jamais leur contenu en clair.",

    "purposeTitle": "3. Finalités du traitement",
    "purposeBody": "Vos données sont utilisées pour : authentifier votre accès au service, permettre l'échange de consentements entre utilisateurs, assurer la sécurité et la conformité juridique du service. Nous n'utilisons jamais vos données à des fins publicitaires ou de profilage.",

    "basisTitle": "4. Base légale",
    "basisBody": "Le traitement de vos données repose sur l'exécution du contrat (l'utilisation de l'Application après acceptation des CGU) et sur votre consentement explicite donné lors de l'inscription.",

    "retentionTitle": "5. Durée de conservation",
    "retentionBody": "Vos données sont conservées tant que votre compte est actif. Vous pouvez le supprimer à tout moment depuis l'écran Profil — cette suppression est immédiate et irréversible.",

    "sharingTitle": "6. Partage avec des tiers",
    "sharingBody": "Nous ne partageons aucune donnée avec des tiers à des fins commerciales. Seul notre hébergeur (Supabase, situé en Europe) traite techniquement vos données pour assurer le fonctionnement du service.",

    "rightsTitle": "7. Vos droits",
    "rightsBody": "Conformément au RGPD, vous disposez des droits suivants :",
    "rightsAccess": "Droit d'accès : exporter toutes vos données au format JSON.",
    "rightsRectify": "Droit de rectification : modifier votre pseudonyme à tout moment.",
    "rightsErasure": "Droit à l'effacement : supprimer définitivement votre compte.",
    "rightsPortability": "Droit à la portabilité : récupérer vos données dans un format lisible.",
    "rightsOppose": "Droit d'opposition : nous contacter pour toute opposition au traitement.",

    "securityTitle": "8. Sécurité",
    "securityBody": "Toutes les communications avec nos serveurs sont chiffrées (TLS). Les énoncés de consentement sont chiffrés de bout en bout avant transmission : nous n'avons techniquement pas accès à leur contenu.",

    "contactTitle": "9. Contact",
    "contactEmail": "Nous contacter"
  },

  "legalMentions": {
    "title": "Mentions légales",

    "editorTitle": "Éditeur",
    "editorBody": "Je Le Veux est édité à titre personnel. Pour toute question relative à l'édition, utilisez l'adresse de contact ci-dessous.",

    "directorTitle": "Directeur de publication",
    "directorBody": "Le directeur de publication est l'éditeur de l'Application.",

    "hostTitle": "Hébergeur",
    "hostBody": "L'Application est hébergée par Supabase (Singapore Pte. Ltd.), avec une infrastructure située en Europe.",

    "contactTitle": "Contact",
    "contactEmail": "Nous écrire"
  }
}
```

The new section goes AFTER the `"biometricLock"` closing `}`. Don't forget the comma after the previous block.

---

## Task 16: i18n keys (EN parity)

**Files:** Modify `src/infrastructure/i18n/locales/en.json`

- [ ] **Step 1: Extend `auth` section**

Inside `"auth"`, after `"passwordMismatch"`, ADD:

```json
"termsAcceptancePrefix": "I accept the ",
"termsLink": "Terms of Service",
"termsAcceptanceMiddle": " and the ",
"privacyPolicyLink": "Privacy Policy",
"errorTermsNotAccepted": "You must accept the Terms and Privacy Policy."
```

- [ ] **Step 2: Extend `profile` section**

Inside `"profile"`, after `"errorUpdateFailed"`, ADD:

```json
"legal": "Legal",
"terms": "Terms of Service",
"privacyPolicy": "Privacy Policy",
"legalMentions": "Legal notices"
```

- [ ] **Step 3: Add `content` section**

After the `"biometricLock"` block, ADD:

```json
"content": {
  "lastUpdated": "Last updated: {{date}}",

  "consent": {
    "title": "What is consent?",
    "intro": "Consent is an agreement between two adults to share a moment, an activity, an experience. It must be given consciously, without pressure or coercion.",
    "flerrTitle": "The 5 FLERR principles",
    "flerrFree": "Free: given without pressure, threat, or manipulation.",
    "flerrInformed": "Informed: each party understands what they are consenting to.",
    "flerrExplicit": "Explicit: expressed clearly, not assumed or presumed.",
    "flerrRevocable": "Revocable: can be withdrawn at any moment, without justification.",
    "flerrRenewable": "Renewable: past consent does not apply to the future.",
    "importantTitle": "Important",
    "importantBody": "This app is a communication tool between consenting adults. It does not replace verbal communication, mutual listening, or any applicable legal framework."
  },

  "legalFramework": {
    "title": "Legal framework",
    "intro": "In France and most jurisdictions, consent is central to criminal law. Its absence characterizes serious offenses such as sexual assault and rape.",
    "frenchLawTitle": "French law",
    "frenchLawBody": "Article 222-22 of the French Penal Code defines sexual assault as 'any sexual attack committed with violence, coercion, threat, or surprise' — meaning, in the absence of consent.",
    "frenchLawArticle": "Since the law of April 21, 2021, any sexual act by an adult on a minor under 15 is qualified as rape or sexual assault, without needing to prove the absence of consent.",
    "importantTitle": "This app is not legal proof",
    "importantBody": "A consent recorded in Je Le Veux does not constitute admissible evidence in court. Consent can be withdrawn at any time, including during the interaction. In case of doubt or emergency, contact your local authorities or a helpline immediately."
  },

  "helpline": {
    "title": "Helplines and support",
    "intro": "If you or someone you know is in distress, please call. These services are free, anonymous, and confidential.",
    "frTitle": "France",
    "fr3919": "3919 — Violences Femmes Info",
    "frPolice": "17 — Police emergency",
    "frSos": "116 006 — Victim assistance",
    "enTitle": "International (English-speaking)",
    "usRainn": "RAINN (United States)",
    "ukRefuge": "Refuge (United Kingdom)",
    "internationalNote": "Outside these countries, contact local emergency services or a victim support organization near you."
  },

  "privacy": {
    "title": "Security and privacy",
    "intro": "Je Le Veux is designed to protect your privacy by default. Here is how.",
    "e2eTitle": "End-to-end encryption",
    "e2eBody": "Each consent statement is encrypted with a session key generated locally, never transmitted to our server. Only those with the share code can decrypt the content. Our team and our hosts cannot read your statements.",
    "storageTitle": "Minimal storage",
    "storageBody": "We only store what is strictly necessary for the app to function: your pseudonym, your email (for authentication), your public key, and consent metadata (level, duration, status). No plaintext content, no tracking, no advertising.",
    "rightsTitle": "Your rights",
    "rightsBody": "You can export all your data as JSON from the Profile screen, or permanently delete your account at any time. These rights comply with GDPR (articles 15, 16, 17, 20)."
  },

  "terms": {
    "title": "Terms of Service",
    "preamble": "These Terms of Service ('Terms') govern your use of the mobile application Je Le Veux (the 'App'). By creating an account, you acknowledge that you have read and accepted these Terms in full.",

    "objectTitle": "1. Purpose",
    "objectBody": "The Je Le Veux App is a communication tool that allows two adults to formalize a mutual, free, and explicit agreement before an interaction. It does not substitute for any legal framework, nor for verbal communication, nor for the effective consent that must be maintained throughout the interaction.",

    "eligibilityTitle": "2. Eligibility",
    "eligibilityBody": "Use of the App is reserved for:",
    "eligibilityBullet1": "Adult individuals (18 years or older).",
    "eligibilityBullet2": "Strictly personal, non-commercial use.",

    "accountTitle": "3. User account",
    "accountBody": "You are solely responsible for the confidentiality of your credentials. You agree to provide accurate information at registration and to keep it up to date. You can delete your account at any time from the Profile screen.",

    "serviceTitle": "4. How the service works",
    "serviceBody": "The App lets you create a consent, send it to another person via a secure code, and receive their acceptance or refusal. All exchanged content is end-to-end encrypted: we cannot access its plaintext.",

    "conductTitle": "5. User commitments",
    "conductBody": "By using the App, you agree to:",
    "conductBullet1": "Respect other users and not use the App for harassment, threats, or coercion.",
    "conductBullet2": "Not create fraudulent or bad-faith consents.",
    "conductBullet3": "Respect the revocable and renewable nature of consent: a consent formalized in the App does not replace ongoing communication with the other party.",

    "liabilityTitle": "6. Liability",
    "liabilityBody": "The publisher cannot be held responsible for users' use of the App, nor for any failure of one party to respect a consent. The App is a communication tool; it does not guarantee the effective respect of consent, nor its evidentiary value before any court.",

    "ipTitle": "7. Intellectual property",
    "ipBody": "All elements of the App (interface, design, source code, trademark) are protected by intellectual property law. Any reproduction, distribution, or commercial use without express authorization is prohibited.",

    "terminationTitle": "8. Termination",
    "terminationBody": "You can delete your account at any time, which results in the permanent deletion of all your data. We reserve the right to suspend or delete an account in case of serious breach of these Terms.",

    "changesTitle": "9. Changes to the Terms",
    "changesBody": "We may modify these Terms. Any substantial change will be notified to you in the App with a re-acceptance request.",

    "jurisdictionTitle": "10. Governing law and jurisdiction",
    "jurisdictionBody": "These Terms are governed by French law. Any dispute will be submitted to the competent French courts.",

    "contactTitle": "11. Contact",
    "contactEmail": "Email us"
  },

  "privacyPolicy": {
    "title": "Privacy Policy",
    "preamble": "This Privacy Policy describes how Je Le Veux collects, uses, and protects your personal data, in compliance with the General Data Protection Regulation (GDPR).",

    "controllerTitle": "1. Data controller",
    "controllerBody": "The data controller is the publisher of the Je Le Veux App. You can contact them at the address listed at the end of this document.",

    "dataTitle": "2. Data collected",
    "dataBody": "We collect only what is strictly necessary:",
    "dataBullet1": "Your email address (for authentication).",
    "dataBullet2": "Your pseudonym (visible to other users you interact with).",
    "dataBullet3": "Your public encryption key (to enable local decryption).",
    "dataBullet4": "Your consents' metadata (level, duration, status, timestamps) — never their plaintext content.",

    "purposeTitle": "3. Processing purposes",
    "purposeBody": "Your data is used to: authenticate your access, allow consent exchanges between users, and ensure the security and legal compliance of the service. We never use your data for advertising or profiling.",

    "basisTitle": "4. Legal basis",
    "basisBody": "Processing your data is based on the performance of the contract (your use of the App after accepting the Terms) and on your explicit consent at registration.",

    "retentionTitle": "5. Retention period",
    "retentionBody": "Your data is kept as long as your account is active. You can delete it at any time from the Profile screen — deletion is immediate and irreversible.",

    "sharingTitle": "6. Sharing with third parties",
    "sharingBody": "We do not share any data with third parties for commercial purposes. Only our host (Supabase, based in Europe) technically processes your data to operate the service.",

    "rightsTitle": "7. Your rights",
    "rightsBody": "Under GDPR, you have the following rights:",
    "rightsAccess": "Right of access: export all your data as JSON.",
    "rightsRectify": "Right of rectification: modify your pseudonym at any time.",
    "rightsErasure": "Right to erasure: permanently delete your account.",
    "rightsPortability": "Right to portability: retrieve your data in a readable format.",
    "rightsOppose": "Right to object: contact us with any objection to processing.",

    "securityTitle": "8. Security",
    "securityBody": "All communications with our servers are encrypted (TLS). Consent statements are end-to-end encrypted before transmission: we technically do not have access to their content.",

    "contactTitle": "9. Contact",
    "contactEmail": "Contact us"
  },

  "legalMentions": {
    "title": "Legal notices",

    "editorTitle": "Publisher",
    "editorBody": "Je Le Veux is published in a personal capacity. For any publication-related question, use the contact address below.",

    "directorTitle": "Publication director",
    "directorBody": "The publication director is the App's publisher.",

    "hostTitle": "Host",
    "hostBody": "The App is hosted by Supabase (Singapore Pte. Ltd.), with infrastructure located in Europe.",

    "contactTitle": "Contact",
    "contactEmail": "Email us"
  }
}
```

- [ ] **Step 4: Verify FR/EN parity**

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

Expected: `OK total: <number>` (around 370-380).

---

## Task 17: Final verification

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

Expected: no output (no errors).

- [ ] **Step 3: Verify i18n parity**

Re-run the parity check from Task 16 Step 4.

Expected: `OK total: <number>`.
