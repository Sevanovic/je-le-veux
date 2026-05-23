import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  acceptInvitationUseCase,
  refuseInvitationUseCase,
} from '../../../application';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Card, Button, Input } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'InvitationReceived'>;
type Rt = RouteProp<HomeStackParamList, 'InvitationReceived'>;

const LEVEL_LABEL_KEYS: Record<string, string> = {
  light: 'createConsent.levelLight',
  moderate: 'createConsent.levelModerate',
  intimate: 'createConsent.levelIntimate',
  custom: 'createConsent.levelCustom',
};

function durationLabel(minutes: number): string {
  if (minutes <= 60) return 'createConsent.duration1h';
  if (minutes <= 180) return 'createConsent.duration3h';
  if (minutes <= 360) return 'createConsent.duration6h';
  if (minutes <= 720) return 'createConsent.duration12h';
  return 'createConsent.duration24h';
}

export function InvitationReceivedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const updateConsent = useConsentStore((s) => s.updateConsent);
  const addConsent = useConsentStore((s) => s.addConsent);

  const { consent, invitation, decryptedStatement, decryptedConditions } = route.params;

  const [receiverPseudonym, setReceiverPseudonym] = useState(user?.pseudonym ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    if (receiverPseudonym.trim().length < 3) {
      Alert.alert(t('common.error'), t('invitation.errorPseudonymInvalid'));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await acceptInvitationUseCase({
        consentId: consent.id,
        invitationId: invitation.id,
        receiverId: user.id,
        receiverPseudonym: receiverPseudonym.trim(),
      });
      addConsent(result.consent);
      updateConsent(result.consent.id, result.consent);
      navigation.replace('Confirmation', { consentId: result.consent.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_PSEUDONYM') {
        Alert.alert(t('common.error'), t('invitation.errorPseudonymInvalid'));
      } else {
        Alert.alert(t('common.error'), t('invitation.errorAcceptFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsure = () => {
    Alert.alert('', t('invitation.unsureMessage'));
  };

  const handleRefuse = async () => {
    setIsSubmitting(true);
    try {
      await refuseInvitationUseCase({
        consentId: consent.id,
        invitationId: invitation.id,
      });
      Alert.alert('', t('invitation.refuseSuccess'), [
        { text: t('common.continue'), onPress: () => navigation.navigate('Home') },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('invitation.errorRefuseFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper scrollable={false} padding>
      <View style={styles.container}>
        <Card variant="gold" style={styles.card}>
          <Text style={styles.from}>{t('invitation.from')}</Text>
          <Text style={styles.pseudo}>{consent.initiatorPseudonym}</Text>

          <View style={styles.statementBox}>
            <Text style={styles.statement}>{decryptedStatement}</Text>
          </View>

          {decryptedConditions ? (
            <View style={styles.conditionsBox}>
              <Text style={styles.conditions}>{decryptedConditions}</Text>
            </View>
          ) : null}

          <View style={styles.meta}>
            <Text style={styles.metaItem}>
              {t('invitation.level')} : {t(LEVEL_LABEL_KEYS[consent.level] ?? 'createConsent.levelCustom')}
            </Text>
            <Text style={styles.metaItem}>
              {t('invitation.duration')} : {t(durationLabel(consent.durationMinutes))}
            </Text>
          </View>

          <Input
            label={t('invitation.receiverPseudonymLabel')}
            placeholder={t('invitation.receiverPseudonymPlaceholder')}
            value={receiverPseudonym}
            onChangeText={setReceiverPseudonym}
            autoCapitalize="none"
            testID="invite-receiver-pseudonym-input"
          />

          <View style={styles.actions}>
            <Button
              title={t('invitation.accept')}
              onPress={handleAccept}
              loading={isSubmitting}
              disabled={isSubmitting}
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
              loading={isSubmitting}
              disabled={isSubmitting}
              testID="invite-refuse-btn"
            />
          </View>
        </Card>

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
    padding: spacing['2xl'],
    alignItems: 'stretch',
    gap: spacing.md,
  },
  from: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
  pseudo: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
  },
  statementBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  statement: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  conditionsBox: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  conditions: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  metaItem: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
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
