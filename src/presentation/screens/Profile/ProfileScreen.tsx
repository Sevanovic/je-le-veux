import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  ScreenWrapper,
  Header,
  Card,
  Button,
  LanguageSelector,
} from '../../components';
import { useAuthStore, useSettingsStore } from '../../hooks';
import {
  signOutUseCase,
  toggleBiometricsUseCase,
  toggleNotificationsUseCase,
  exportUserDataUseCase,
} from '../../../application';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import { colors, typography, spacing, borderRadius } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Profile'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const setBiometrics = useSettingsStore((s) => s.setBiometrics);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotifications = useSettingsStore((s) => s.setNotifications);

  const [isExporting, setIsExporting] = useState(false);

  const handleBiometricsToggle = async (value: boolean) => {
    try {
      await toggleBiometricsUseCase({ enabled: value });
      setBiometrics(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'HARDWARE_UNAVAILABLE') {
        Alert.alert(t('common.error'), t('profile.biometricsUnavailable'));
      } else if (message === 'NOT_ENROLLED') {
        Alert.alert(t('common.error'), t('profile.biometricsNotEnrolled'));
      } else {
        Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
      }
      // Switch will revert because state was not updated
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      await toggleNotificationsUseCase({ enabled: value });
      setNotifications(value);
    } catch {
      Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const { json, filename } = await exportUserDataUseCase({ userId: user.id });
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: t('profile.exportData'),
        });
      } else {
        Alert.alert('', t('profile.exportSuccess'));
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUseCase();
    } catch {
      // logout locally even if Supabase signOut fails
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
        <Text style={styles.pseudonym}>{user?.pseudonym ?? '—'}</Text>
      </View>

      {/* Identity */}
      <Card style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.pseudonym')}</Text>
            <Text style={styles.settingDesc}>{user?.pseudonym ?? '—'}</Text>
          </View>
          <Button
            title={t('profile.editPseudonym')}
            variant="ghost"
            onPress={() => navigation.navigate('EditPseudonym')}
            testID="profile-edit-pseudonym-btn"
          />
        </View>
      </Card>

      {/* Language */}
      <Card style={styles.section}>
        <LanguageSelector />
      </Card>

      {/* Security */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.security')}</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.biometrics')}</Text>
            <Text style={styles.settingDesc}>{t('profile.biometricsDesc')}</Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={handleBiometricsToggle}
            testID="profile-biometrics-switch"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.settingTitle}>{t('profile.notifications')}</Text>
            <Text style={styles.settingDesc}>{t('profile.notificationsDesc')}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            testID="profile-notifications-switch"
          />
        </View>
      </Card>

      {/* My data (GDPR) */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.myData')}</Text>
        <View style={styles.dataActions}>
          <Button
            title={t('profile.exportData')}
            variant="secondary"
            onPress={handleExport}
            loading={isExporting}
            disabled={isExporting}
            testID="profile-export-btn"
          />
          <Button
            title={t('profile.deleteAccount')}
            variant="danger"
            onPress={() => navigation.navigate('DeleteAccountConfirm')}
            testID="profile-delete-btn"
          />
        </View>
      </Card>

      {/* Legal */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.legal')}</Text>
        <View style={styles.legalRows}>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'terms' })}
            style={styles.legalRow}
            testID="profile-terms-link"
          >
            <Text style={styles.legalLink}>{t('profile.terms')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'privacyPolicy' })}
            style={styles.legalRow}
            testID="profile-privacy-link"
          >
            <Text style={styles.legalLink}>{t('profile.privacyPolicy')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as unknown as RootNav).navigate('Content', { contentKey: 'legalMentions' })}
            style={styles.legalRow}
            testID="profile-mentions-link"
          >
            <Text style={styles.legalLink}>{t('profile.legalMentions')}</Text>
            <Text style={styles.legalArrow}>{'→'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Sign out */}
      <View style={styles.signoutContainer}>
        <Button
          title={t('profile.logout')}
          variant="secondary"
          onPress={handleLogout}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
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
  dataActions: {
    gap: spacing.md,
  },
  signoutContainer: {
    marginTop: spacing.lg,
  },
  legalRows: {
    gap: 0,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  legalLink: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  legalArrow: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
  },
});
