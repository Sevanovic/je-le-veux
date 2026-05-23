import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Card, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Rt = RouteProp<HomeStackParamList, 'Confirmation'>;

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

export function ConfirmationScreen() {
  const { t, i18n } = useTranslation();
  const route = useRoute<Rt>();
  const consent = useConsentStore((s) =>
    s.consents.find((c) => c.id === route.params.consentId),
  );

  const handleWithdraw = () => {
    Alert.alert(
      t('confirmation.withdraw'),
      t('confirmation.withdrawConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            // Sprint 4: withdrawConsentUseCase
            Alert.alert('', t('confirmation.withdrawSuccess'));
          },
        },
      ],
    );
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

      <Card variant="success" style={styles.detailsCard}>
        <DetailRow
          label={t('confirmation.initiator')}
          value={consent.initiatorPseudonym}
        />
        <DetailRow
          label={t('confirmation.partner')}
          value={consent.receiverPseudonym ?? '—'}
        />
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

        <View style={styles.codeBox}>
          <Text style={styles.code}>{consent.secureCode}</Text>
        </View>
      </Card>

      <View style={styles.withdrawContainer}>
        <Button
          title={t('confirmation.withdraw')}
          variant="danger"
          onPress={handleWithdraw}
          testID="confirm-withdraw-btn"
        />
      </View>

      <View style={{ height: 40 }} />
    </ScreenWrapper>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
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
  detailsCard: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
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
  withdrawContainer: {
    marginTop: spacing['2xl'],
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  value: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
});
