import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { useConsentStore } from '../../hooks';
import { ConsentStatus } from '../../../domain/enums';
import { ScreenWrapper, Button, Card, ConsentCard } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

/**
 * Écran principal — Dashboard avec statistiques et historique récent.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeNav>();
  const { consents, getByStatus } = useConsentStore();

  const activeCount = getByStatus(ConsentStatus.ACTIVE).length;
  const expiredCount = getByStatus(ConsentStatus.EXPIRED).length;
  const withdrawnCount = getByStatus(ConsentStatus.WITHDRAWN).length;

  const recentConsents = consents.slice(0, 5);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{t('home.greeting')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatar}
          accessibilityLabel={t('profile.title')}
        >
          <Text style={styles.avatarText}>{'JV'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <StatCard value={activeCount} label={t('home.active')} />
        <StatCard value={expiredCount} label={t('home.expired')} />
        <StatCard value={withdrawnCount} label={t('home.withdrawn')} />
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Button
          title={t('home.newConsent')}
          onPress={() =>
            navigation.getParent()?.navigate('CreateTab')
          }
          testID="home-new-consent-btn"
        />
      </View>

      {/* Recent history */}
      <Text style={styles.sectionTitle}>
        {t('home.recentHistory')}
      </Text>

      {recentConsents.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('home.noConsents')}</Text>
          <Text style={styles.emptySubtext}>{t('home.startFirst')}</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {recentConsents.map((consent) => (
            <ConsentCard
              key={consent.id}
              consent={consent}
              onPress={(c) =>
                navigation.navigate('Confirmation', { consentId: c.id })
              }
            />
          ))}
        </View>
      )}

      {/* Bottom padding for tab bar */}
      <View style={{ height: 100 }} />
    </ScreenWrapper>
  );
}

// ── Stat Card sub-component ──
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  greeting: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1.5,
    borderColor: colors.gold.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bodySemiBold,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing['2xl'],
  },
  cta: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm + 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.goldSubtle,
  },
  value: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize['2xl'],
    color: colors.gold.DEFAULT,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
