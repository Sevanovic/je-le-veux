import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper, Card, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

/**
 * Écran d'invitation reçue.
 * Affiche les détails du consentement proposé avec 3 options :
 * Accepter / Pas sûr(e) / Refuser
 */
export function InvitationReceivedScreen() {
  const { t } = useTranslation();

  // TODO Sprint 3 : récupérer l'invitation depuis les params de navigation
  // et déchiffrer l'énoncé

  const handleAccept = () => {
    // TODO Sprint 3 : use case AcceptConsent
  };

  const handleUnsure = () => {
    Alert.alert('', t('invitation.unsureMessage'));
  };

  const handleRefuse = () => {
    // TODO Sprint 3 : use case RefuseConsent
  };

  return (
    <ScreenWrapper scrollable={false} padding>
      <View style={styles.container}>
        <Card variant="gold" style={styles.card}>
          {/* De qui */}
          <Text style={styles.from}>{t('invitation.from')}</Text>
          <Text style={styles.pseudo}>{'Coeur_Vaillant'}</Text>

          {/* Énoncé */}
          <View style={styles.statementBox}>
            <Text style={styles.statement}>
              {'[Énoncé chiffré — déchiffré au Sprint 3]'}
            </Text>
          </View>

          {/* Metadata */}
          <View style={styles.meta}>
            <Text style={styles.metaItem}>
              {t('invitation.level')} : {t('createConsent.levelModerate')}
            </Text>
            <Text style={styles.metaItem}>
              {t('invitation.duration')} : {t('createConsent.duration6h')}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t('invitation.accept')}
              onPress={handleAccept}
              testID="invite-accept-btn"
            />
            <Button
              title={t('invitation.unsure')}
              variant="secondary"
              onPress={handleUnsure}
              testID="invite-unsure-btn"
            />
            <Button
              title={t('invitation.refuse')}
              variant="danger"
              onPress={handleRefuse}
              testID="invite-refuse-btn"
            />
          </View>
        </Card>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t('invitation.disclaimer')}</Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    padding: spacing['3xl'],
    alignItems: 'center',
  },
  from: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  pseudo: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statementBox: {
    width: '100%',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  statement: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  metaItem: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  actions: {
    width: '100%',
    gap: spacing.sm + 2,
    marginTop: spacing['2xl'],
  },
  disclaimer: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
    maxWidth: 280,
  },
});
