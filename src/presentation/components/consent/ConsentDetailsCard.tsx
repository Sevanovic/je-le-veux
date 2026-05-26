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
