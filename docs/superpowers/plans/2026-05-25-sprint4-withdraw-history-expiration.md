# Sprint 4 — Withdraw, Detail, Expiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let either party withdraw an active consent, surface a dedicated detail view reachable from Home and History, and auto-transition stale ACTIVE consents to EXPIRED lazily on each fetch.

**Architecture:** New `withdrawConsentUseCase` mutates status to WITHDRAWN with metadata. `loadUserConsentsUseCase` gains lazy expiration logic that flips stale ACTIVE → EXPIRED on each load. A new `ConsentDetailScreen` reachable from both HomeStack and a new HistoryStack uses a shared `ConsentDetailsCard` component (extracted from ConfirmationScreen) to render details, with status-specific banners.

**Tech Stack:** React Native + Expo, Zustand, Supabase, TweetNaCl (existing), react-navigation 7

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/application/usecases/consent/withdrawConsentUseCase.ts` | Validate party + active, update status to WITHDRAWN with metadata |
| Modify | `src/application/usecases/consent/loadUserConsentsUseCase.ts` | Add lazy expiration step |
| Modify | `src/application/usecases/consent/index.ts` | Export new use case |
| Modify | `src/application/index.ts` | Export new use case |
| Create | `src/presentation/components/consent/ConsentDetailsCard.tsx` | Shared card: details rows + decrypted statement + code, internal decryption flow |
| Modify | `src/presentation/components/index.ts` | Export `ConsentDetailsCard` |
| Create | `src/presentation/screens/ConsentDetail/utils.ts` | `formatRemainingTime` helper |
| Create | `src/presentation/screens/ConsentDetail/ConsentDetailScreen.tsx` | Detail screen: status-specific banner + card + withdraw button |
| Create | `src/presentation/screens/ConsentDetail/index.ts` | Barrel |
| Modify | `src/presentation/components/navigation/MainTabNavigator.tsx` | Add `ConsentDetail` to HomeStack, create HistoryStack |
| Modify | `src/presentation/screens/Confirmation/ConfirmationScreen.tsx` | Wire real withdraw + reuse `ConsentDetailsCard` |
| Modify | `src/presentation/screens/History/HistoryScreen.tsx` | Wire `handlePress` to ConsentDetail |
| Modify | `src/presentation/screens/Home/HomeScreen.tsx` | Change card target from Confirmation to ConsentDetail |
| Modify | `src/infrastructure/i18n/locales/fr.json` | New keys (common, confirmation, consentDetail) |
| Modify | `src/infrastructure/i18n/locales/en.json` | New keys (parity) |

---

## Task 1: withdrawConsentUseCase

**Files:** Create `src/application/usecases/consent/withdrawConsentUseCase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface WithdrawConsentInput {
  consentId: string;
  userId: string;
}

export interface WithdrawConsentOutput {
  consent: Consent;
}

/**
 * Withdraw an active consent. Either party (initiator or receiver) may revoke.
 * Sets status to WITHDRAWN with timestamp and the withdrawing user's id.
 */
export async function withdrawConsentUseCase(
  input: WithdrawConsentInput,
): Promise<WithdrawConsentOutput> {
  const { consent } = getContainer();

  // 1. Fetch consent
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }

  // 2. Must be currently active
  if (existing.status !== ConsentStatus.ACTIVE) {
    throw new Error('CONSENT_NOT_ACTIVE');
  }

  // 3. User must be a party to the consent
  const isParty =
    input.userId === existing.initiatorId ||
    input.userId === existing.receiverId;
  if (!isParty) {
    throw new Error('NOT_PARTY');
  }

  // 4. Update to WITHDRAWN
  const updated = await consent.updateStatus(input.consentId, ConsentStatus.WITHDRAWN, {
    withdrawnAt: new Date().toISOString(),
    withdrawnBy: input.userId,
  });

  return { consent: updated };
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors related to this file.

---

## Task 2: Add lazy expiration to loadUserConsentsUseCase

**Files:** Modify `src/application/usecases/consent/loadUserConsentsUseCase.ts`

- [ ] **Step 1: Replace file content**

```typescript
import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface LoadUserConsentsInput {
  userId: string;
}

export interface LoadUserConsentsOutput {
  consents: Consent[];
}

/**
 * Fetch all consents where the user is initiator OR receiver.
 *
 * Lazy expiration: any ACTIVE consent whose `expiresAt` is in the past is
 * transitioned to EXPIRED in the DB before returning. This keeps the DB
 * status truthful without requiring a cron — the next client open does
 * the work for everyone, and Realtime propagates the change.
 */
export async function loadUserConsentsUseCase(
  input: LoadUserConsentsInput,
): Promise<LoadUserConsentsOutput> {
  const { consent } = getContainer();
  const consents = await consent.findByUserId(input.userId);

  const now = new Date();
  const expiredCandidates = consents.filter(
    (c) =>
      c.status === ConsentStatus.ACTIVE &&
      c.expiresAt instanceof Date &&
      c.expiresAt < now,
  );

  if (expiredCandidates.length === 0) {
    return { consents };
  }

  const updated = await Promise.all(
    expiredCandidates.map((c) =>
      consent.updateStatus(c.id, ConsentStatus.EXPIRED),
    ),
  );

  const byId = new Map(updated.map((c) => [c.id, c]));
  const merged = consents.map((c) => byId.get(c.id) ?? c);

  return { consents: merged };
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 3: Update barrel exports

**Files:**
- Modify `src/application/usecases/consent/index.ts`
- Modify `src/application/index.ts`

- [ ] **Step 1: Update `src/application/usecases/consent/index.ts`**

Append at the end of the file:

```typescript
export { withdrawConsentUseCase } from './withdrawConsentUseCase';
export type { WithdrawConsentInput, WithdrawConsentOutput } from './withdrawConsentUseCase';
```

- [ ] **Step 2: Update `src/application/index.ts`**

Replace the existing block:

```typescript
export {
  createConsentUseCase,
  createInvitationUseCase,
  joinInvitationUseCase,
  acceptInvitationUseCase,
  refuseInvitationUseCase,
  decryptConsentStatementUseCase,
  loadUserConsentsUseCase,
} from './usecases/consent';
```

with:

```typescript
export {
  createConsentUseCase,
  createInvitationUseCase,
  joinInvitationUseCase,
  acceptInvitationUseCase,
  refuseInvitationUseCase,
  decryptConsentStatementUseCase,
  loadUserConsentsUseCase,
  withdrawConsentUseCase,
} from './usecases/consent';
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 4: Create ConsentDetailsCard shared component

**Files:** Create `src/presentation/components/consent/ConsentDetailsCard.tsx`

- [ ] **Step 1: Write the file**

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { decryptConsentStatementUseCase } from '../../../application';
import type { Consent } from '../../../domain/entities';
import { Card } from '../ui/Card';
import { colors, typography, spacing, borderRadius } from '../../theme';

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

interface ConsentDetailsCardProps {
  consent: Consent;
  variant?: 'default' | 'gold' | 'success' | 'danger';
}

/**
 * Shared details card used by ConfirmationScreen and ConsentDetailScreen.
 * Owns the decryption of the statement/conditions via decryptConsentStatementUseCase.
 */
export function ConsentDetailsCard({ consent, variant = 'default' }: ConsentDetailsCardProps) {
  const { t, i18n } = useTranslation();

  const [statement, setStatement] = useState<string | null>(null);
  const [conditions, setConditions] = useState<string | undefined>(undefined);
  const [statementLoaded, setStatementLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await decryptConsentStatementUseCase({ consent });
      if (cancelled) return;
      setStatement(result.statement);
      setConditions(result.conditions);
      setStatementLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [consent.id, consent.encryptedStatement, consent.encryptedConditions]);

  return (
    <Card variant={variant} style={styles.card}>
      <DetailRow label={t('confirmation.initiator')} value={consent.initiatorPseudonym} />
      <DetailRow label={t('confirmation.partner')} value={consent.receiverPseudonym ?? '—'} />
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

      {statementLoaded ? (
        <View style={styles.statementBox}>
          <Text style={styles.statementLabel}>{t('confirmation.statement')}</Text>
          <Text style={styles.statementText}>
            {statement ?? t('confirmation.statementUnavailable')}
          </Text>
          {conditions ? (
            <>
              <Text style={[styles.statementLabel, styles.conditionsLabel]}>
                {t('confirmation.conditions')}
              </Text>
              <Text style={styles.conditionsText}>{conditions}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.codeBox}>
        <Text style={styles.code}>{consent.secureCode}</Text>
      </View>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  rowValue: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  statementBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  statementLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  conditionsLabel: {
    marginTop: spacing.md,
  },
  statementText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
  },
  conditionsText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    lineHeight: 20,
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
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 5: Export ConsentDetailsCard from components barrel

**Files:** Modify `src/presentation/components/index.ts`

- [ ] **Step 1: Add the export**

After the existing line `export { ConsentCard } from './consent/ConsentCard';`, add:

```typescript
export { ConsentDetailsCard } from './consent/ConsentDetailsCard';
```

The final block in that file should read:

```typescript
// Consent Components
export { StatusBadge } from './consent/StatusBadge';
export { ConsentCard } from './consent/ConsentCard';
export { ConsentDetailsCard } from './consent/ConsentDetailsCard';
```

---

## Task 6: Create ConsentDetail utils

**Files:** Create `src/presentation/screens/ConsentDetail/utils.ts`

- [ ] **Step 1: Write the file**

```typescript
import type { TFunction } from 'i18next';

/**
 * Format remaining minutes into a human-readable string:
 *  - 0 or less   → "Expired"
 *  - < 60 min    → "Expires in X minutes"
 *  - whole hour  → "Expires in N hours"
 *  - otherwise   → "Expires in Nh Mm"
 */
export function formatRemainingTime(minutes: number, t: TFunction): string {
  if (minutes <= 0) return t('history.expired');
  if (minutes < 60) return t('common.expiresInMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (remainingMin === 0) return t('common.expiresInHours', { count: hours });
  return t('common.expiresInHoursMinutes', { hours, minutes: remainingMin });
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -10
```

Expected: no errors.

---

## Task 7: Create ConsentDetailScreen

**Files:**
- Create `src/presentation/screens/ConsentDetail/ConsentDetailScreen.tsx`
- Create `src/presentation/screens/ConsentDetail/index.ts`

- [ ] **Step 1: Write `ConsentDetailScreen.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  withdrawConsentUseCase,
} from '../../../application';
import { ConsentStatus } from '../../../domain/enums';
import { remainingMinutes } from '../../../domain/entities';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Button, ConsentDetailsCard } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { formatRemainingTime } from './utils';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ConsentDetail'>;
type Rt = RouteProp<HomeStackParamList, 'ConsentDetail'>;

function formatDateOnly(date: Date | undefined, locale: string): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ConsentDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const updateConsent = useConsentStore((s) => s.updateConsent);
  const consent = useConsentStore((s) =>
    s.consents.find((c) => c.id === route.params.consentId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!consent) {
    return (
      <ScreenWrapper>
        <Header title="" showBack />
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('consentDetail.notFound')}</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const isParty =
    user !== null &&
    (consent.initiatorId === user.id || consent.receiverId === user.id);
  const canWithdraw = consent.status === ConsentStatus.ACTIVE && isParty;

  const title = ((): string => {
    switch (consent.status) {
      case ConsentStatus.ACTIVE:
        return t('consentDetail.titleActive');
      case ConsentStatus.WITHDRAWN:
        return t('consentDetail.titleWithdrawn');
      case ConsentStatus.EXPIRED:
        return t('consentDetail.titleExpired');
      case ConsentStatus.REFUSED:
        return t('consentDetail.titleRefused');
      default:
        return t('consentDetail.titleActive');
    }
  })();

  const handleWithdraw = () => {
    Alert.alert(t('confirmation.withdraw'), t('confirmation.withdrawConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setIsSubmitting(true);
          try {
            const result = await withdrawConsentUseCase({
              consentId: consent.id,
              userId: user.id,
            });
            updateConsent(result.consent.id, result.consent);
            Alert.alert('', t('confirmation.withdrawSuccess'));
          } catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (message === 'CONSENT_NOT_ACTIVE') {
              Alert.alert(t('common.error'), t('confirmation.errorNotActive'));
            } else if (message === 'NOT_PARTY') {
              Alert.alert(t('common.error'), t('confirmation.errorNotParty'));
            } else {
              Alert.alert(t('common.error'), t('confirmation.errorWithdrawFailed'));
            }
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  // Status banner
  const renderBanner = () => {
    if (consent.status === ConsentStatus.ACTIVE) {
      const minutes = remainingMinutes(consent);
      return (
        <View style={[styles.banner, styles.bannerActive]}>
          <Text style={styles.bannerText}>{formatRemainingTime(minutes, t)}</Text>
        </View>
      );
    }
    if (consent.status === ConsentStatus.WITHDRAWN) {
      const who =
        consent.withdrawnBy === consent.initiatorId
          ? consent.initiatorPseudonym
          : consent.receiverPseudonym ?? '—';
      return (
        <View style={[styles.banner, styles.bannerWithdrawn]}>
          <Text style={styles.bannerText}>
            {t('consentDetail.withdrawnBy', {
              pseudo: who,
              date: formatDateOnly(consent.withdrawnAt, i18n.language),
            })}
          </Text>
        </View>
      );
    }
    if (consent.status === ConsentStatus.EXPIRED) {
      return (
        <View style={[styles.banner, styles.bannerNeutral]}>
          <Text style={styles.bannerText}>
            {t('consentDetail.expiredAt', {
              date: formatDateOnly(consent.expiresAt, i18n.language),
            })}
          </Text>
        </View>
      );
    }
    if (consent.status === ConsentStatus.REFUSED) {
      return (
        <View style={[styles.banner, styles.bannerNeutral]}>
          <Text style={styles.bannerText}>
            {t('consentDetail.refusedAt', {
              date: formatDateOnly(consent.refusedAt, i18n.language),
            })}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <ScreenWrapper>
      <Header title={title} showBack />

      {renderBanner()}

      <ConsentDetailsCard
        consent={consent}
        variant={consent.status === ConsentStatus.WITHDRAWN ? 'danger' : 'default'}
      />

      {canWithdraw ? (
        <View style={styles.withdrawContainer}>
          <Button
            title={t('consentDetail.withdrawButton')}
            variant="danger"
            onPress={handleWithdraw}
            loading={isSubmitting}
            disabled={isSubmitting}
            testID="detail-withdraw-btn"
          />
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['3xl'],
  },
  notFound: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
  },
  banner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  bannerActive: {
    backgroundColor: colors.semantic.successMuted,
    borderWidth: 1,
    borderColor: colors.semantic.success,
  },
  bannerWithdrawn: {
    backgroundColor: colors.semantic.dangerMuted,
    borderWidth: 1,
    borderColor: colors.semantic.danger,
  },
  bannerNeutral: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  bannerText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    textAlign: 'center',
  },
  withdrawContainer: {
    marginTop: spacing['2xl'],
  },
});
```

- [ ] **Step 2: Write `index.ts`**

```typescript
export { ConsentDetailScreen } from './ConsentDetailScreen';
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors. (The `HomeStackParamList` reference to `ConsentDetail` will be added in Task 8 — if Task 8 hasn't been done yet, this will show a missing key. That's OK — Task 8 fixes it.)

---

## Task 8: Update MainTabNavigator (routes + HistoryStack)

**Files:** Modify `src/presentation/components/navigation/MainTabNavigator.tsx`

- [ ] **Step 1: Add imports**

Below the existing screen imports, add:

```typescript
import { ConsentDetailScreen } from '../../screens/ConsentDetail';
```

- [ ] **Step 2: Add `ConsentDetail` to `HomeStackParamList`**

Replace:

```typescript
export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    invitation: Invitation;
    decryptedStatement: string;
    decryptedConditions?: string;
    sessionKey: string;
  };
  Confirmation: { consentId: string };
  Profile: undefined;
};
```

with:

```typescript
export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    invitation: Invitation;
    decryptedStatement: string;
    decryptedConditions?: string;
    sessionKey: string;
  };
  Confirmation: { consentId: string };
  ConsentDetail: { consentId: string };
  Profile: undefined;
};

export type HistoryStackParamList = {
  History: undefined;
  ConsentDetail: { consentId: string };
};
```

- [ ] **Step 3: Add ConsentDetail screen to HomeStackNavigator**

In `function HomeStackNavigator()`, add a new screen after `Confirmation`:

```typescript
<HomeStack.Screen name="Home" component={HomeScreen} />
<HomeStack.Screen name="JoinInvitation" component={JoinInvitationScreen} />
<HomeStack.Screen name="Confirmation" component={ConfirmationScreen} />
<HomeStack.Screen name="ConsentDetail" component={ConsentDetailScreen} />
<HomeStack.Screen
  name="InvitationReceived"
  component={InvitationReceivedScreen}
/>
<HomeStack.Screen name="Profile" component={ProfileScreen} />
```

- [ ] **Step 4: Add HistoryStackNavigator**

After `HomeStackNavigator` function, add:

```typescript
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <HistoryStack.Screen name="History" component={HistoryScreen} />
      <HistoryStack.Screen name="ConsentDetail" component={ConsentDetailScreen} />
    </HistoryStack.Navigator>
  );
}
```

- [ ] **Step 5: Wire HistoryTab to the stack navigator**

In `MainTabNavigator`, replace:

```typescript
<Tab.Screen
  name="HistoryTab"
  component={HistoryScreen}
  options={{
    tabBarLabel: t('navigation.history'),
    tabBarIcon: ({ focused }) => (
      <TabIcon focused={focused} label="history" />
    ),
  }}
/>
```

with:

```typescript
<Tab.Screen
  name="HistoryTab"
  component={HistoryStackNavigator}
  options={{
    tabBarLabel: t('navigation.history'),
    tabBarIcon: ({ focused }) => (
      <TabIcon focused={focused} label="history" />
    ),
  }}
/>
```

- [ ] **Step 6: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 9: Refactor ConfirmationScreen (wire withdraw + reuse card)

**Files:** Modify `src/presentation/screens/Confirmation/ConfirmationScreen.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { withdrawConsentUseCase } from '../../../application';
import { ConsentStatus } from '../../../domain/enums';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Button, ConsentDetailsCard } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Confirmation'>;
type Rt = RouteProp<HomeStackParamList, 'Confirmation'>;

export function ConfirmationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const updateConsent = useConsentStore((s) => s.updateConsent);
  const consent = useConsentStore((s) =>
    s.consents.find((c) => c.id === route.params.consentId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isParty =
    user !== null &&
    consent !== undefined &&
    (consent.initiatorId === user.id || consent.receiverId === user.id);
  const canWithdraw =
    consent !== undefined && consent.status === ConsentStatus.ACTIVE && isParty;

  const handleWithdraw = () => {
    Alert.alert(t('confirmation.withdraw'), t('confirmation.withdrawConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!user || !consent) return;
          setIsSubmitting(true);
          try {
            const result = await withdrawConsentUseCase({
              consentId: consent.id,
              userId: user.id,
            });
            updateConsent(result.consent.id, result.consent);
            Alert.alert('', t('confirmation.withdrawSuccess'), [
              { text: t('common.continue'), onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (message === 'CONSENT_NOT_ACTIVE') {
              Alert.alert(t('common.error'), t('confirmation.errorNotActive'));
            } else if (message === 'NOT_PARTY') {
              Alert.alert(t('common.error'), t('confirmation.errorNotParty'));
            } else {
              Alert.alert(t('common.error'), t('confirmation.errorWithdrawFailed'));
            }
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
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

      <ConsentDetailsCard consent={consent} variant="success" />

      {canWithdraw ? (
        <View style={styles.withdrawContainer}>
          <Button
            title={t('confirmation.withdraw')}
            variant="danger"
            onPress={handleWithdraw}
            loading={isSubmitting}
            disabled={isSubmitting}
            testID="confirm-withdraw-btn"
          />
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScreenWrapper>
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
  withdrawContainer: {
    marginTop: spacing['2xl'],
  },
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 10: Wire HistoryScreen onPress

**Files:** Modify `src/presentation/screens/History/HistoryScreen.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';
import { useConsentStore } from '../../hooks';
import { ScreenWrapper, Chip, ConsentCard } from '../../components';
import type { HistoryStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type FilterTab = 'all' | ConsentStatus.ACTIVE | ConsentStatus.EXPIRED | ConsentStatus.WITHDRAWN;
type Nav = NativeStackNavigationProp<HistoryStackParamList, 'History'>;

export function HistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { consents, getByStatus } = useConsentStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filters: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: t('history.all') },
    { key: ConsentStatus.ACTIVE, label: t('history.active') },
    { key: ConsentStatus.EXPIRED, label: t('history.expired') },
    { key: ConsentStatus.WITHDRAWN, label: t('history.withdrawn') },
  ];

  const filteredConsents =
    activeFilter === 'all' ? consents : getByStatus(activeFilter as ConsentStatus);

  const handlePress = (consent: Consent) => {
    navigation.navigate('ConsentDetail', { consentId: consent.id });
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('history.title')}</Text>
      </View>

      <View style={styles.filters}>
        {filters.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            selected={activeFilter === key}
            onPress={() => setActiveFilter(key)}
          />
        ))}
      </View>

      <FlatList
        data={filteredConsents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConsentCard consent={item} onPress={handlePress} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('history.noHistory')}</Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  list: {
    gap: spacing.sm + 2,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing['6xl'],
  },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
  },
});
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 11: Update HomeScreen card target

**Files:** Modify `src/presentation/screens/Home/HomeScreen.tsx`

- [ ] **Step 1: Change ConsentCard navigation target**

Find the line:

```typescript
navigation.navigate('Confirmation', { consentId: c.id })
```

Replace with:

```typescript
navigation.navigate('ConsentDetail', { consentId: c.id })
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -20
```

Expected: no errors.

---

## Task 12: Add i18n keys (FR + EN)

**Files:**
- Modify `src/infrastructure/i18n/locales/fr.json`
- Modify `src/infrastructure/i18n/locales/en.json`

- [ ] **Step 1: Add keys to `common` section (FR)**

Inside the `"common"` block in `fr.json`, after `"noResults"`, ADD:

```json
"expiresInMinutes_one": "Expire dans {{count}} minute",
"expiresInMinutes_other": "Expire dans {{count}} minutes",
"expiresInHours_one": "Expire dans {{count}} heure",
"expiresInHours_other": "Expire dans {{count}} heures",
"expiresInHoursMinutes": "Expire dans {{hours}}h{{minutes}}"
```

- [ ] **Step 2: Add keys to `common` section (EN)**

Inside the `"common"` block in `en.json`, after `"noResults"`, ADD:

```json
"expiresInMinutes_one": "Expires in {{count}} minute",
"expiresInMinutes_other": "Expires in {{count}} minutes",
"expiresInHours_one": "Expires in {{count}} hour",
"expiresInHours_other": "Expires in {{count}} hours",
"expiresInHoursMinutes": "Expires in {{hours}}h{{minutes}}"
```

- [ ] **Step 3: Extend `confirmation` section (FR)**

Inside the `"confirmation"` block in `fr.json`, after the existing `"statementUnavailable"` key, ADD:

```json
"errorWithdrawFailed": "Impossible de retirer. Veuillez réessayer.",
"errorNotActive": "Ce consentement n'est plus actif.",
"errorNotParty": "Vous n'êtes pas partie à ce consentement."
```

- [ ] **Step 4: Extend `confirmation` section (EN)**

Inside the `"confirmation"` block in `en.json`, after `"statementUnavailable"`, ADD:

```json
"errorWithdrawFailed": "Unable to withdraw. Please try again.",
"errorNotActive": "This consent is no longer active.",
"errorNotParty": "You are not a party to this consent."
```

- [ ] **Step 5: Add `consentDetail` section (FR)**

In `fr.json`, after the `"confirmation"` block (before `"history"`), ADD a new top-level section:

```json
"consentDetail": {
  "titleActive": "Consentement actif",
  "titleWithdrawn": "Consentement retiré",
  "titleExpired": "Consentement expiré",
  "titleRefused": "Consentement refusé",
  "withdrawnBy": "Retiré par {{pseudo}} le {{date}}",
  "expiredAt": "Expiré le {{date}}",
  "refusedAt": "Refusé le {{date}}",
  "notFound": "Consentement introuvable.",
  "withdrawButton": "Retirer mon consentement"
},
```

- [ ] **Step 6: Add `consentDetail` section (EN)**

In `en.json`, same position, ADD:

```json
"consentDetail": {
  "titleActive": "Active consent",
  "titleWithdrawn": "Withdrawn consent",
  "titleExpired": "Expired consent",
  "titleRefused": "Refused consent",
  "withdrawnBy": "Withdrawn by {{pseudo}} on {{date}}",
  "expiredAt": "Expired on {{date}}",
  "refusedAt": "Refused on {{date}}",
  "notFound": "Consent not found.",
  "withdrawButton": "Withdraw my consent"
},
```

- [ ] **Step 7: Verify FR/EN parity**

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

Expected: `OK total: <number>` (the count will be ~205+).

---

## Task 13: Final verification

- [ ] **Step 1: Verify Clean Architecture boundaries**

Run:
```bash
grep -r "from.*infrastructure" /Users/sevanovic/Documents/PROJECTS/Xcode/je-le-veux/src/application/ 2>/dev/null && echo "VIOLATION" || echo "OK: application clean"
```

Expected: `OK: application clean`.

- [ ] **Step 2: Verify full TypeScript compilation**

Run:
```bash
PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH" npx tsc --noEmit 2>&1 | grep -v __tests__ | head -30
```

Expected: no output (no errors).

- [ ] **Step 3: Verify i18n parity**

Run the same parity command from Task 12 Step 7.

Expected: `OK total: <number>`.
