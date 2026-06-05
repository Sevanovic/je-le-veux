import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { checkBiometricLockUseCase } from '../../../application';
import { Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

/**
 * Full-screen lock rendered above the navigator when biometrics are enabled
 * and the user has not yet authenticated this session.
 * Auto-triggers the prompt on mount; offers a manual retry button.
 */
export function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const tryUnlock = async () => {
    setErrorKey(null);
    setIsAuthenticating(true);
    try {
      const result = await checkBiometricLockUseCase(t('biometricLock.title'));
      if (!result.locked) {
        onUnlock();
        return;
      }
      if (result.error === 'CANCELLED') setErrorKey('biometricLock.errorCancelled');
      else setErrorKey('biometricLock.errorFailed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    void tryUnlock();
    // run once on mount; user can retry manually
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>{t('biometricLock.title')}</Text>
        <Text style={styles.subtitle}>{t('biometricLock.subtitle')}</Text>
        {errorKey ? <Text style={styles.error}>{t(errorKey)}</Text> : null}
        <Button
          title={t('biometricLock.unlockButton')}
          onPress={tryUnlock}
          loading={isAuthenticating}
          disabled={isAuthenticating}
          testID="biometric-unlock-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  inner: {
    gap: spacing.lg,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.semantic.danger,
    textAlign: 'center',
  },
});
