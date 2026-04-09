import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../hooks';
import {
  signUpUseCase,
  signInUseCase,
  sendMagicLinkUseCase,
} from '../../../application';
import { getCurrentLanguage } from '../../../infrastructure/i18n';
import { ScreenWrapper, Input, Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

type AuthMode = 'signIn' | 'signUp';

/**
 * Authentication screen — Login / Sign up / Magic link.
 * Fully bilingual FR/EN.
 *
 * This screen only interacts with the Application layer (use cases).
 * It never imports infrastructure services directly.
 */
export function AuthScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSignUp = mode === 'signUp';

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.includes('@')) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (password.length < 8) {
      newErrors.password = t('auth.passwordTooShort');
    }
    if (isSignUp && password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }
    if (isSignUp && pseudonym.length < 3) {
      newErrors.pseudonym = t('errors.pseudonymInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /**
   * Map domain error codes to user-facing i18n messages.
   */
  function handleError(error: unknown): void {
    if (!(error instanceof Error)) {
      Alert.alert(t('common.error'), t('errors.generic'));
      return;
    }

    const errorMap: Record<string, () => void> = {
      PSEUDONYM_TAKEN: () => setErrors({ pseudonym: t('errors.pseudonymTaken') }),
      INVALID_PSEUDONYM: () => setErrors({ pseudonym: t('errors.pseudonymInvalid') }),
      INVALID_EMAIL: () => setErrors({ email: t('auth.invalidEmail') }),
      PASSWORD_TOO_SHORT: () => setErrors({ password: t('auth.passwordTooShort') }),
    };

    const handler = errorMap[error.message];
    if (handler) {
      handler();
    } else {
      Alert.alert(t('common.error'), error.message);
    }
  }

  async function handleSignIn() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { user } = await signInUseCase({ email, password });
      setUser(user);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { user } = await signUpUseCase({
        email,
        password,
        pseudonym,
        preferredLanguage: getCurrentLanguage(),
      });
      setUser(user);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.includes('@')) {
      setErrors({ email: t('auth.invalidEmail') });
      return;
    }
    setIsLoading(true);
    try {
      await sendMagicLinkUseCase(email);
      Alert.alert('', t('auth.magicLinkSent'));
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScreenWrapper scrollable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.hearts}>{'\u2665  \u2665'}</Text>
          <Text style={styles.title}>{t('common.appName')}</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {isSignUp && (
            <Input
              label={t('createConsent.pseudonym')}
              placeholder={t('createConsent.pseudonymPlaceholder')}
              value={pseudonym}
              onChangeText={(v) => {
                setPseudonym(v);
                setErrors((e) => ({ ...e, pseudonym: '' }));
              }}
              autoCapitalize="none"
              error={errors.pseudonym}
              testID="auth-pseudonym-input"
            />
          )}

          <Input
            label={t('auth.email')}
            placeholder="email@exemple.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrors((e) => ({ ...e, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            testID="auth-email-input"
          />

          <Input
            label={t('auth.password')}
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrors((e) => ({ ...e, password: '' }));
            }}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            error={errors.password}
            testID="auth-password-input"
          />

          {isSignUp && (
            <Input
              label={t('auth.confirmPassword')}
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setErrors((e) => ({ ...e, confirmPassword: '' }));
              }}
              secureTextEntry
              textContentType="none"
              autoComplete="off"
              error={errors.confirmPassword}
              testID="auth-confirm-password-input"
            />
          )}

          <Button
            title={isSignUp ? t('auth.signUp') : t('auth.signIn')}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            loading={isLoading}
            testID="auth-submit-btn"
          />

          {!isSignUp && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {t('auth.orContinueWith')}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                title={t('auth.magicLink')}
                variant="secondary"
                onPress={handleMagicLink}
                loading={isLoading}
                testID="auth-magic-link-btn"
              />
            </>
          )}
        </View>

        {/* Toggle sign in / sign up */}
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => {
            setMode(isSignUp ? 'signIn' : 'signUp');
            setErrors({});
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? t('auth.signIn') : t('auth.signUp')}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  hearts: {
    fontSize: 36,
    color: colors.gold.DEFAULT,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize['2xl'],
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.medium,
  },
  dividerText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  toggle: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
  },
  toggleText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
  },
});
