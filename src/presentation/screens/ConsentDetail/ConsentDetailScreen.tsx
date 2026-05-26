import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { withdrawConsentUseCase } from '../../../application';
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
