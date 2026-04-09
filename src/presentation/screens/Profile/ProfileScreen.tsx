import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenWrapper,
  Header,
  Card,
  Button,
  LanguageSelector,
} from '../../components';
import { useAuthStore } from '../../hooks';
import { signOutUseCase } from '../../../application';
import { colors, typography, spacing, borderRadius } from '../../theme';

/**
 * Profile screen — pseudonym, language selector, security, logout.
 * Language changes are instant thanks to react-i18next.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // TODO Sprint 5: DeleteAccountUseCase (GDPR)
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    try {
      await signOutUseCase();
    } catch {
      // Logout locally even if Supabase call fails
    }
    logout();
  };

  return (
    <ScreenWrapper>
      <Header title={t('profile.title')} showBack />

      {/* Avatar + pseudo */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.pseudonym?.substring(0, 2).toUpperCase() ?? 'JV'}
          </Text>
        </View>
        <Text style={styles.pseudonym}>
          {user?.pseudonym ?? 'Utilisateur'}
        </Text>
      </View>

      {/* Language selector */}
      <Card style={styles.section}>
        <LanguageSelector />
      </Card>

      {/* Security */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.security')}</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>
              {t('profile.biometrics')}
            </Text>
            <Text style={styles.settingDesc}>
              {t('profile.biometricsDesc')}
            </Text>
          </View>
        </View>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>
              {t('profile.notifications')}
            </Text>
            <Text style={styles.settingDesc}>
              {t('profile.notificationsDesc')}
            </Text>
          </View>
        </View>
      </Card>

      {/* Danger zone */}
      <View style={styles.dangerZone}>
        <Button
          title={t('profile.logout')}
          variant="secondary"
          onPress={handleLogout}
        />
        <Button
          title={t('profile.deleteAccount')}
          variant="danger"
          onPress={handleDeleteAccount}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing['2xl'],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 2,
    borderColor: colors.gold.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.gold.DEFAULT,
  },
  pseudonym: {
    fontFamily: typography.fontFamily.displayMedium,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  settingTitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  settingDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  dangerZone: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
