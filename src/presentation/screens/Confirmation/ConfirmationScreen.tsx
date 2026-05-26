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
