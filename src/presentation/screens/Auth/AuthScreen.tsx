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
import { authService } from '../../../infrastructure';
import { getCurrentLanguage } from '../../../infrastructure';
import { cryptoService } from '../../../infrastructure';
import { secureStorage, STORAGE_KEYS } from '../../../infrastructure';
import { isValidPseudonym } from '../../../domain/entities';
import { SupportedLanguage } from '../../../domain/enums';
import { ScreenWrapper, Input, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

type AuthMode = 'signIn' | 'signUp';

/**
 * Écran d'authentification — Login / Inscription / Magic Link.
 * Entièrement bilingue FR/EN.
 *
 * Flux inscription :
 * 1. Email + password + pseudonyme
 * 2. Génération paire de clés E2E (TweetNaCl)
 * 3. Stockage clé secrète dans SecureStore
 * 4. Envoi clé publique au profil Supabase
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

  // ── Validation ──
  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.includes('@')) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (password.length < 8) {
      newErrors.password = t('auth.passwordTooShort');
    }
    if (isSignUp) {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = t('auth.passwordMismatch');
      }
      if (!isValidPseudonym(pseudonym)) {
        newErrors.pseudonym = t('errors.pseudonymInvalid');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Sign In ──
  async function handleSignIn() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { session } = await authService.signIn({ email, password });
      if (session?.user) {
        const profile = await authService.getProfile(session.user.id);
        if (profile) {
          setUser(profile);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('errors.generic');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Sign Up ──
  async function handleSignUp() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const lang = getCurrentLanguage();

      // 1. Créer le compte
      const { session } = await authService.signUp({
        email,
        password,
        pseudonym,
        preferredLanguage: lang,
      });

      // 2. Générer la paire de clés E2E
      const keyPair = await cryptoService.generateKeyPair();

      // 3. Stocker la clé secrète localement (jamais envoyée au serveur)
      try {
        await secureStorage.save(STORAGE_KEYS.SECRET_KEY, keyPair.secretKey);
        await secureStorage.save(STORAGE_KEYS.PUBLIC_KEY, keyPair.publicKey);
      } catch {
        // SecureStore peut échouer sur le web
      }

      // 4. Envoyer la clé publique au profil
      if (session?.user) {
        await authService.updateProfile(session.user.id, {
          publicKey: keyPair.publicKey,
        });

        const profile = await authService.getProfile(session.user.id);
        if (profile) {
          setUser(profile);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PSEUDONYM_TAKEN') {
        setErrors({ pseudonym: t('errors.pseudonymTaken') });
      } else {
        const msg = error instanceof Error ? error.message : t('errors.generic');
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Magic Link ──
  async function handleMagicLink() {
    if (!email.includes('@')) {
      setErrors({ email: t('auth.invalidEmail') });
      return;
    }
    setIsLoading(true);
    try {
      await authService.sendMagicLink(email);
      Alert.alert('', t('auth.magicLinkSent'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('errors.generic');
      Alert.alert(t('common.error'), msg);
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
          {/* Pseudonym (sign up only) */}
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

          {/* Email */}
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

          {/* Password */}
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

          {/* Confirm password (sign up only) */}
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

          {/* Submit button */}
          <Button
            title={isSignUp ? t('auth.signUp') : t('auth.signIn')}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            loading={isLoading}
            testID="auth-submit-btn"
          />

          {/* Magic link (sign in only) */}
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
            {isSignUp
              ? t('auth.signIn')
              : t('auth.signUp')}
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
