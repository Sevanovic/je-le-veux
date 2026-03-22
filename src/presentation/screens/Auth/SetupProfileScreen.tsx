import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../hooks';
import { authService } from '../../../infrastructure';
import { isValidPseudonym } from '../../../domain/entities';
import { ScreenWrapper, Input, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

/**
 * Écran de configuration du profil — affiché après inscription
 * si le pseudonyme est encore le temporaire (user_XXXXXXXX).
 */
export function SetupProfileScreen() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [pseudonym, setPseudonym] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!isValidPseudonym(pseudonym)) {
      setError(t('errors.pseudonymInvalid'));
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      await authService.updateProfile(user.id, { pseudonym });
      setUser({ ...user, pseudonym });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        setError(t('errors.pseudonymTaken'));
      } else {
        Alert.alert(t('common.error'), t('errors.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper scrollable={false} padding>
      <View style={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{'\u270C'}</Text>
        </View>

        <Text style={styles.title}>{t('profile.pseudonym')}</Text>
        <Text style={styles.description}>
          {t('createConsent.pseudonymPlaceholder')}
        </Text>

        <View style={styles.form}>
          <Input
            label={t('profile.pseudonym')}
            placeholder={t('createConsent.pseudonymPlaceholder')}
            value={pseudonym}
            onChangeText={(v) => {
              setPseudonym(v);
              setError('');
            }}
            autoCapitalize="none"
            error={error}
            testID="setup-pseudonym-input"
          />

          <Button
            title={t('common.save')}
            onPress={handleSave}
            loading={isLoading}
            disabled={pseudonym.length < 3}
            testID="setup-save-btn"
          />
        </View>
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  avatarEmoji: {
    fontSize: 36,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  description: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing['3xl'],
  },
  form: {
    width: '100%',
    gap: spacing.lg,
  },
});
