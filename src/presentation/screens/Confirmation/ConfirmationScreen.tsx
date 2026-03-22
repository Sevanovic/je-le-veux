import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper, Header, Card, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

/**
 * Écran de confirmation — les deux parties ont accepté.
 * Affiche l'horodatage, le code sécurisé et le bouton de retrait.
 */
export function ConfirmationScreen() {
  const { t } = useTranslation();

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
            // TODO Sprint 4 : use case WithdrawConsent
            Alert.alert('', t('confirmation.withdrawSuccess'));
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <Header title="" showBack />

      {/* Success icon */}
      <View style={styles.center}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>{'\u2713'}</Text>
        </View>

        <Text style={styles.title}>{t('confirmation.title')}</Text>
        <Text style={styles.subtitle}>{t('confirmation.subtitle')}</Text>
      </View>

      {/* Details card */}
      <Card variant="success" style={styles.detailsCard}>
        <DetailRow
          label={t('confirmation.initiator')}
          value="Coeur_Vaillant"
        />
        <DetailRow
          label={t('confirmation.partner')}
          value="Etoile_du_Soir"
        />
        <DetailRow
          label={t('confirmation.level')}
          value={t('createConsent.levelModerate')}
        />
        <DetailRow
          label={t('confirmation.timestamp')}
          value="18/03/2026 14:32"
        />
        <DetailRow
          label={t('confirmation.expires')}
          value="18/03/2026 20:32"
        />

        {/* Secure code */}
        <View style={styles.codeBox}>
          <Text style={styles.code}>{'JLV-2026-A7F3-X9K2'}</Text>
        </View>
      </Card>

      {/* Withdraw button */}
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
