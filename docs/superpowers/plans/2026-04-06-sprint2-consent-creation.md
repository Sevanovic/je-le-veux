# Sprint 2 — Create Consent & Invitations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a user to create an E2E-encrypted consent and share an invitation via secure code + QR code.

**Architecture:** Clean Architecture with DI. Use cases orchestrate domain + infra via `getContainer()`. Repositories implement domain interfaces with Supabase. Screen connects to use cases, never to infra directly. Statement encrypted with initiator's own key (Approach B).

**Tech Stack:** React Native + Expo, TypeScript strict, Supabase, TweetNaCl.js, Zustand, react-native-qrcode-svg, react-i18next

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/infrastructure/repositories/ConsentRepository.ts` | IConsentRepository Supabase implementation |
| Create | `src/infrastructure/repositories/InvitationRepository.ts` | IInvitationRepository Supabase implementation |
| Create | `src/application/usecases/consent/createConsentUseCase.ts` | Validate, encrypt, create consent + invitation |
| Create | `src/application/usecases/consent/createInvitationUseCase.ts` | Regenerate invitation for existing consent |
| Create | `src/application/usecases/consent/index.ts` | Barrel export |
| Modify | `src/application/interfaces/container.ts` | Add consent + invitation to ServiceContainer |
| Modify | `src/application/interfaces/index.ts` | Re-export getContainer (no change needed, already exported) |
| Modify | `src/application/index.ts` | Export new use cases |
| Modify | `src/infrastructure/index.ts` | Export new repositories |
| Modify | `App.tsx` | Wire repositories into DI container |
| Modify | `src/infrastructure/i18n/locales/fr.json` | Add new i18n keys |
| Modify | `src/infrastructure/i18n/locales/en.json` | Add new i18n keys |
| Modify | `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx` | Connect use case + success view with QR |

---

## Task 0: Extend CreateConsentDTO with secureCode

**Files:**
- Modify: `src/domain/entities/Consent.ts`

The existing `CreateConsentDTO` lacks a `secureCode` field. The use case generates the code and needs to pass it to the repository. Add it to the DTO.

- [ ] **Step 1: Add secureCode to CreateConsentDTO**

In `src/domain/entities/Consent.ts`, update the `CreateConsentDTO` interface:

```typescript
export interface CreateConsentDTO {
  initiatorId: string;
  initiatorPseudonym: string;
  secureCode: string;
  statement: string;
  level: ConsentLevel;
  durationMinutes: number;
  conditions?: string;
  receiverPublicKey?: string;
}
```

The only change is adding `secureCode: string;` after `initiatorPseudonym`.

- [ ] **Step 2: Commit**

```bash
git add src/domain/entities/Consent.ts
git commit -m "feat(sprint2): add secureCode to CreateConsentDTO"
```

---

## Task 1: ConsentRepository

**Files:**
- Create: `src/infrastructure/repositories/ConsentRepository.ts`

- [ ] **Step 1: Create ConsentRepository**

```typescript
// src/infrastructure/repositories/ConsentRepository.ts
import { supabase } from '../api/supabase';
import type { IConsentRepository } from '../../domain/interfaces';
import type { Consent, CreateConsentDTO } from '../../domain/entities';
import type { ConsentStatus } from '../../domain/enums';

function toEntity(row: Record<string, unknown>): Consent {
  return {
    id: row.id as string,
    secureCode: row.secure_code as string,
    initiatorId: row.initiator_id as string,
    initiatorPseudonym: row.initiator_pseudonym as string,
    receiverId: (row.receiver_id as string) ?? undefined,
    receiverPseudonym: (row.receiver_pseudonym as string) ?? undefined,
    encryptedStatement: row.encrypted_statement as string,
    level: row.level as Consent['level'],
    status: row.status as Consent['status'],
    durationMinutes: row.duration_minutes as number,
    encryptedConditions: (row.encrypted_conditions as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at as string) : undefined,
    withdrawnBy: (row.withdrawn_by as string) ?? undefined,
    refusedAt: row.refused_at ? new Date(row.refused_at as string) : undefined,
  };
}

export class ConsentRepository implements IConsentRepository {
  async create(dto: CreateConsentDTO): Promise<Consent> {
    const { data, error } = await supabase
      .from('consents')
      .insert({
        initiator_id: dto.initiatorId,
        initiator_pseudonym: dto.initiatorPseudonym,
        encrypted_statement: dto.statement,
        level: dto.level,
        duration_minutes: dto.durationMinutes,
        encrypted_conditions: dto.conditions ?? null,
        secure_code: dto.secureCode,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return toEntity(data);
  }

  async findById(id: string): Promise<Consent | null> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? toEntity(data) : null;
  }

  async findBySecureCode(code: string): Promise<Consent | null> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('secure_code', code)
      .maybeSingle();

    if (error) throw error;
    return data ? toEntity(data) : null;
  }

  async findByUserId(userId: string): Promise<Consent[]> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('initiator_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toEntity);
  }

  async findByStatus(userId: string, status: ConsentStatus): Promise<Consent[]> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('initiator_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toEntity);
  }

  async updateStatus(
    id: string,
    status: ConsentStatus,
    metadata?: Record<string, unknown>,
  ): Promise<Consent> {
    const updates: Record<string, unknown> = { status };
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        // Convert camelCase to snake_case for DB
        const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        updates[snakeKey] = value;
      });
    }

    const { data, error } = await supabase
      .from('consents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('consents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const consentRepository = new ConsentRepository();
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "ConsentRepository" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/ConsentRepository.ts
git commit -m "feat(sprint2): add ConsentRepository — Supabase implementation of IConsentRepository"
```

---

## Task 2: InvitationRepository

**Files:**
- Create: `src/infrastructure/repositories/InvitationRepository.ts`

- [ ] **Step 1: Create InvitationRepository**

```typescript
// src/infrastructure/repositories/InvitationRepository.ts
import { supabase } from '../api/supabase';
import type { IInvitationRepository } from '../../domain/interfaces';
import type { Invitation } from '../../domain/entities';
import { INVITATION_TTL_HOURS } from '../../domain/entities';

function toEntity(row: Record<string, unknown>): Invitation {
  return {
    id: row.id as string,
    consentId: row.consent_id as string,
    inviteLink: row.invite_link as string,
    createdAt: new Date(row.created_at as string),
    expiresAt: new Date(row.expires_at as string),
    isUsed: row.is_used as boolean,
  };
}

export class InvitationRepository implements IInvitationRepository {
  async create(consentId: string): Promise<Invitation> {
    // Fetch the consent's secure code to use as invite link
    const { data: consent, error: consentError } = await supabase
      .from('consents')
      .select('secure_code')
      .eq('id', consentId)
      .single();

    if (consentError) throw consentError;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        consent_id: consentId,
        invite_link: consent.secure_code,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
      .select()
      .single();

    if (error) throw error;
    return toEntity(data);
  }

  async findByLink(link: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('invite_link', link)
      .maybeSingle();

    if (error) throw error;
    return data ? toEntity(data) : null;
  }

  async findByConsentId(consentId: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('consent_id', consentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? toEntity(data) : null;
  }

  async markAsUsed(id: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ is_used: true })
      .eq('id', id);

    if (error) throw error;
  }
}

export const invitationRepository = new InvitationRepository();
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "InvitationRepository" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/InvitationRepository.ts
git commit -m "feat(sprint2): add InvitationRepository — Supabase implementation of IInvitationRepository"
```

---

## Task 3: Extend DI Container + Exports

**Files:**
- Modify: `src/application/interfaces/container.ts`
- Modify: `src/infrastructure/index.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Extend ServiceContainer interface**

In `src/application/interfaces/container.ts`, add the two repository types to the import and interface:

```typescript
// src/application/interfaces/container.ts
import type {
  IAuthService,
  ICryptoService,
  ISecureStorageService,
  IConsentRepository,
  IInvitationRepository,
} from '../../domain/interfaces';

interface ServiceContainer {
  auth: IAuthService;
  crypto: ICryptoService;
  secureStorage: ISecureStorageService;
  consent: IConsentRepository;
  invitation: IInvitationRepository;
}

let container: ServiceContainer | null = null;

export function initContainer(services: ServiceContainer): void {
  container = services;
}

export function getContainer(): ServiceContainer {
  if (!container) {
    throw new Error(
      'Service container not initialized. Call initContainer() in App.tsx before rendering.',
    );
  }
  return container;
}
```

- [ ] **Step 2: Export repositories from infrastructure/index.ts**

Add to `src/infrastructure/index.ts`:

```typescript
export {
  consentRepository,
  ConsentRepository,
} from './repositories/ConsentRepository';
export {
  invitationRepository,
  InvitationRepository,
} from './repositories/InvitationRepository';
```

- [ ] **Step 3: Wire repositories in App.tsx**

In `App.tsx`, add imports and wire:

Add to imports:
```typescript
import { consentRepository } from './src/infrastructure/repositories/ConsentRepository';
import { invitationRepository } from './src/infrastructure/repositories/InvitationRepository';
```

Update `initContainer` call:
```typescript
initContainer({
  auth: authService,
  crypto: cryptoService,
  secureStorage: secureStorage,
  consent: consentRepository,
  invitation: invitationRepository,
});
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/application/interfaces/container.ts src/infrastructure/index.ts App.tsx
git commit -m "feat(sprint2): extend DI container with consent + invitation repositories"
```

---

## Task 4: createConsentUseCase

**Files:**
- Create: `src/application/usecases/consent/createConsentUseCase.ts`

- [ ] **Step 1: Create createConsentUseCase**

```typescript
// src/application/usecases/consent/createConsentUseCase.ts
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

  // 2. Retrieve initiator's keys from secure storage
  const publicKey = await secureStorage.get('jeleveux.public_key');
  const secretKey = await secureStorage.get('jeleveux.secret_key');

  if (!publicKey || !secretKey) {
    throw new Error('MISSING_KEYS');
  }

  // 3. Encrypt statement with initiator's own public key (Approach B)
  const encryptedStatement = await crypto.encrypt(
    input.statement,
    publicKey,
    secretKey,
  );

  // 4. Encrypt conditions if present
  let encryptedConditions: string | undefined;
  if (input.conditions?.trim()) {
    encryptedConditions = await crypto.encrypt(
      input.conditions,
      publicKey,
      secretKey,
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

  // 7. Create invitation
  const createdInvitation = await invitation.create(createdConsent.id);

  return { consent: createdConsent, invitation: createdInvitation };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "createConsentUseCase" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/application/usecases/consent/createConsentUseCase.ts
git commit -m "feat(sprint2): add createConsentUseCase — validate, encrypt, store consent + invitation"
```

---

## Task 5: createInvitationUseCase

**Files:**
- Create: `src/application/usecases/consent/createInvitationUseCase.ts`

- [ ] **Step 1: Create createInvitationUseCase**

```typescript
// src/application/usecases/consent/createInvitationUseCase.ts
import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Invitation } from '../../../domain/entities';

export interface CreateInvitationInput {
  consentId: string;
  userId: string;
}

export interface CreateInvitationOutput {
  invitation: Invitation;
}

export async function createInvitationUseCase(
  input: CreateInvitationInput,
): Promise<CreateInvitationOutput> {
  const { consent, invitation } = getContainer();

  // 1. Verify consent exists and belongs to user
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }

  if (existing.initiatorId !== input.userId) {
    throw new Error('NOT_OWNER');
  }

  // 2. Verify consent is still pending
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Create new invitation
  const createdInvitation = await invitation.create(input.consentId);

  return { invitation: createdInvitation };
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// src/application/usecases/consent/index.ts
export { createConsentUseCase } from './createConsentUseCase';
export type { CreateConsentInput, CreateConsentOutput } from './createConsentUseCase';

export { createInvitationUseCase } from './createInvitationUseCase';
export type { CreateInvitationInput, CreateInvitationOutput } from './createInvitationUseCase';
```

- [ ] **Step 3: Update application barrel export**

In `src/application/index.ts`, add:

```typescript
export {
  createConsentUseCase,
  createInvitationUseCase,
} from './usecases/consent';
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/application/usecases/consent/ src/application/index.ts
git commit -m "feat(sprint2): add createInvitationUseCase + barrel exports"
```

---

## Task 6: i18n — New Keys

**Files:**
- Modify: `src/infrastructure/i18n/locales/fr.json`
- Modify: `src/infrastructure/i18n/locales/en.json`

- [ ] **Step 1: Add French keys**

Add these keys inside the `"createConsent"` section of `fr.json`, after the existing `"useTemplate"` key:

```json
"templateIntimate": "Je consens librement à un moment intime partagé avec respect mutuel.",
"templateMassage": "Je consens librement à recevoir/donner un massage dans un cadre bienveillant.",
"templatePhoto": "Je consens librement à être photographié(e) dans le cadre défini ensemble.",
"templateDiscussion": "Je consens librement à une discussion ouverte et confidentielle sur un sujet sensible.",
"templateActivity": "Je consens librement à participer à cette activité dans les conditions définies.",
"templateCustom": "Rédigez votre propre énoncé de consentement.",
"errorInvalidStatement": "L'énoncé du consentement ne peut pas être vide.",
"errorMissingKeys": "Clés de chiffrement introuvables. Veuillez vous reconnecter.",
"errorCreationFailed": "Impossible de créer le consentement. Veuillez réessayer.",
"successTitle": "Invitation envoyée !",
"successMessage": "Partagez ce code avec votre partenaire pour qu'il/elle puisse rejoindre le consentement.",
"secureCodeLabel": "Code sécurisé",
"shareButton": "Partager l'invitation",
"shareMessage": "Rejoins mon consentement sur Je Le Veux avec le code : {{code}}",
"copyCode": "Copier le code",
"codeCopied": "Code copié !",
"backToHome": "Retour à l'accueil"
```

- [ ] **Step 2: Add English keys**

Add these keys inside the `"createConsent"` section of `en.json`, after the existing `"useTemplate"` key:

```json
"templateIntimate": "I freely consent to a shared intimate moment with mutual respect.",
"templateMassage": "I freely consent to receiving/giving a massage in a caring setting.",
"templatePhoto": "I freely consent to being photographed within the agreed framework.",
"templateDiscussion": "I freely consent to an open and confidential discussion on a sensitive topic.",
"templateActivity": "I freely consent to participating in this activity under the defined conditions.",
"templateCustom": "Write your own consent statement.",
"errorInvalidStatement": "The consent statement cannot be empty.",
"errorMissingKeys": "Encryption keys not found. Please sign in again.",
"errorCreationFailed": "Unable to create consent. Please try again.",
"successTitle": "Invitation sent!",
"successMessage": "Share this code with your partner so they can join the consent.",
"secureCodeLabel": "Secure code",
"shareButton": "Share invitation",
"shareMessage": "Join my consent on Je Le Veux with the code: {{code}}",
"copyCode": "Copy code",
"codeCopied": "Code copied!",
"backToHome": "Back to home"
```

- [ ] **Step 3: Verify key parity**

Run: `npm run test:i18n 2>&1 || echo "Check output above"`

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/i18n/locales/fr.json src/infrastructure/i18n/locales/en.json
git commit -m "feat(sprint2): add i18n keys for consent templates, errors, and success view"
```

---

## Task 7: CreateConsentScreen — Connect Use Case + Success View

**Files:**
- Modify: `src/presentation/screens/CreateConsent/CreateConsentScreen.tsx`

- [ ] **Step 1: Rewrite CreateConsentScreen with use case integration + success view**

Replace the entire file content with:

```typescript
// src/presentation/screens/CreateConsent/CreateConsentScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Share, Clipboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { ConsentLevel } from '../../../domain/enums';
import type { Consent, Invitation } from '../../../domain/entities';
import { createConsentUseCase } from '../../../application';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button, Chip } from '../../components';
import { colors, typography, spacing } from '../../theme';

const DURATION_OPTIONS = [
  { key: '60', labelKey: 'createConsent.duration1h' },
  { key: '180', labelKey: 'createConsent.duration3h' },
  { key: '360', labelKey: 'createConsent.duration6h' },
  { key: '720', labelKey: 'createConsent.duration12h' },
  { key: '1440', labelKey: 'createConsent.duration24h' },
];

const LEVEL_OPTIONS = [
  { level: ConsentLevel.LIGHT, labelKey: 'createConsent.levelLight' },
  { level: ConsentLevel.MODERATE, labelKey: 'createConsent.levelModerate' },
  { level: ConsentLevel.INTIMATE, labelKey: 'createConsent.levelIntimate' },
  { level: ConsentLevel.CUSTOM, labelKey: 'createConsent.levelCustom' },
];

const TEMPLATE_KEYS = [
  'templateIntimate',
  'templateMassage',
  'templatePhoto',
  'templateDiscussion',
  'templateActivity',
  'templateCustom',
] as const;

export function CreateConsentScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const addConsent = useConsentStore((s) => s.addConsent);

  // Form state
  const [pseudonym, setPseudonym] = useState(user?.pseudonym ?? '');
  const [statement, setStatement] = useState('');
  const [level, setLevel] = useState<ConsentLevel>(ConsentLevel.LIGHT);
  const [duration, setDuration] = useState('360');
  const [conditions, setConditions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state
  const [createdConsent, setCreatedConsent] = useState<Consent | null>(null);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const canSubmit = pseudonym.trim().length >= 3 && statement.trim().length > 0;

  const handleSend = async () => {
    if (!canSubmit || !user) return;
    setIsSubmitting(true);
    try {
      const result = await createConsentUseCase({
        initiatorId: user.id,
        initiatorPseudonym: pseudonym.trim(),
        statement: statement.trim(),
        level,
        durationMinutes: parseInt(duration, 10),
        conditions: conditions.trim() || undefined,
      });

      addConsent(result.consent);
      setCreatedConsent(result.consent);
      setCreatedInvitation(result.invitation);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_STATEMENT') {
        Alert.alert(t('common.error'), t('createConsent.errorInvalidStatement'));
      } else if (message === 'MISSING_KEYS') {
        Alert.alert(t('common.error'), t('createConsent.errorMissingKeys'));
      } else {
        Alert.alert(t('common.error'), t('createConsent.errorCreationFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!createdConsent) return;
    await Share.share({
      message: t('createConsent.shareMessage', { code: createdConsent.secureCode }),
    });
  };

  const handleCopyCode = () => {
    if (!createdConsent) return;
    Clipboard.setString(createdConsent.secureCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleBackToHome = () => {
    navigation.navigate('Home');
  };

  const handleSelectTemplate = (templateKey: string) => {
    const templateText = t(`createConsent.${templateKey}`);
    if (templateKey !== 'templateCustom') {
      setStatement(templateText);
    }
  };

  // ── Success View ──
  if (createdConsent && createdInvitation) {
    return (
      <ScreenWrapper>
        <Header title={t('createConsent.successTitle')} />
        <View style={styles.successContainer}>
          <Text style={styles.successMessage}>
            {t('createConsent.successMessage')}
          </Text>

          <Text style={styles.secureCodeLabel}>
            {t('createConsent.secureCodeLabel')}
          </Text>
          <Text style={styles.secureCode}>{createdConsent.secureCode}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={createdConsent.secureCode}
              size={200}
              backgroundColor={colors.background.card}
              color={colors.gold.primary}
            />
          </View>

          <Button
            title={codeCopied ? t('createConsent.codeCopied') : t('createConsent.copyCode')}
            onPress={handleCopyCode}
            testID="copy-code-btn"
          />

          <Button
            title={t('createConsent.shareButton')}
            onPress={handleShare}
            testID="share-btn"
          />

          <Button
            title={t('createConsent.backToHome')}
            onPress={handleBackToHome}
            variant="secondary"
            testID="back-home-btn"
          />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Form View ──
  return (
    <ScreenWrapper>
      <Header title={t('createConsent.title')} showBack />

      <View style={styles.form}>
        {/* Pseudonym */}
        <Input
          label={t('createConsent.pseudonym')}
          placeholder={t('createConsent.pseudonymPlaceholder')}
          value={pseudonym}
          onChangeText={setPseudonym}
          autoCapitalize="none"
          testID="create-pseudonym-input"
        />

        {/* Templates */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.templates')}</Text>
          <View style={styles.chips}>
            {TEMPLATE_KEYS.map((key) => (
              <Chip
                key={key}
                label={t(`createConsent.${key}`).substring(0, 30) + '...'}
                selected={false}
                onPress={() => handleSelectTemplate(key)}
                testID={`template-${key}`}
              />
            ))}
          </View>
        </View>

        {/* Statement */}
        <Input
          label={t('createConsent.statement')}
          placeholder={t('createConsent.statementPlaceholder')}
          value={statement}
          onChangeText={setStatement}
          multiline
          numberOfLines={4}
          style={styles.textarea}
          testID="create-statement-input"
        />

        {/* Level */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.level')}</Text>
          <View style={styles.chips}>
            {LEVEL_OPTIONS.map(({ level: l, labelKey }) => (
              <Chip
                key={l}
                label={t(labelKey)}
                selected={level === l}
                onPress={() => setLevel(l)}
                testID={`create-level-${l}`}
              />
            ))}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.duration')}</Text>
          <View style={styles.chips}>
            {DURATION_OPTIONS.map(({ key, labelKey }) => (
              <Chip
                key={key}
                label={t(labelKey)}
                selected={duration === key}
                onPress={() => setDuration(key)}
                testID={`create-duration-${key}`}
              />
            ))}
          </View>
        </View>

        {/* Conditions */}
        <Input
          label={t('createConsent.conditions')}
          placeholder={t('createConsent.conditionsPlaceholder')}
          value={conditions}
          onChangeText={setConditions}
          multiline
          numberOfLines={2}
          style={styles.textareaSmall}
        />

        {/* Submit */}
        <Button
          title={t('createConsent.send')}
          onPress={handleSend}
          loading={isSubmitting}
          disabled={!canSubmit}
          testID="create-send-btn"
        />
      </View>

      <View style={{ height: 100 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textareaSmall: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  successContainer: {
    gap: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  successMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  secureCodeLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  secureCode: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xxl,
    color: colors.gold.primary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    alignItems: 'center',
  },
});
```

**Important notes for the implementer:**
- `Clipboard` is imported from `react-native`. If the project uses `@react-native-clipboard/clipboard` instead, adjust the import.
- The `Button` component may or may not have a `variant` prop. Check `src/presentation/components/ui/Button.tsx`. If not, use a second style or just remove `variant="secondary"`.
- The `navigation` prop typing uses a simple inline type. If the project has typed navigation (e.g., `NativeStackNavigationProp`), match the existing pattern from other screens.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Fix any type errors**

Check the Button component for `variant` prop, check Clipboard import, check navigation typing. Adjust as needed based on compilation output.

- [ ] **Step 4: Commit**

```bash
git add src/presentation/screens/CreateConsent/CreateConsentScreen.tsx
git commit -m "feat(sprint2): connect CreateConsentScreen to use case + add success view with QR"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Verify Clean Architecture boundaries**

```bash
grep -r "from.*infrastructure" src/presentation/ && echo "VIOLATION FOUND" || echo "OK: No boundary violations"
grep -r "from.*infrastructure" src/application/ && echo "VIOLATION FOUND" || echo "OK: No boundary violations"
```

Both commands should print the "OK" message.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: no errors.

- [ ] **Step 3: Verify i18n key parity**

Run: `npm run test:i18n`

Expected: FR and EN have identical keys.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(sprint2): address compilation and boundary issues"
```
