import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../components/navigation/AuthNavigator';
import { useAuthStore } from '../../hooks';
import { secureStorage, STORAGE_KEYS } from '../../../infrastructure';
import { Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

type AgeNav = NativeStackNavigationProp<AuthStackParamList, 'AgeVerification'>;

/**
 * Écran de vérification d'âge — 18+ obligatoire.
 * Le choix est persisté dans le secure storage.
 */
export function AgeVerificationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<AgeNav>();
  const { setAgeVerified } = useAuthStore();

  const handleConfirm = async () => {
    try {
      await secureStorage.save(STORAGE_KEYS.AGE_VERIFIED, 'true');
    } catch {
      // SecureStore peut échouer sur le web — pas bloquant
    }
    setAgeVerified(true);
    navigation.navigate('Onboarding');
  };

  const handleDeny = () => {
    Alert.alert(t('common.error'), t('ageVerification.denied'));
  };

  return (
    <View style={styles.container}>
      {/* Icône 18+ */}
      <View style={styles.icon}>
        <Text style={styles.iconText}>{'18+'}</Text>
      </View>

      {/* Titre */}
      <Text style={styles.title}>{t('ageVerification.title')}</Text>

      {/* Description */}
      <Text style={styles.description}>
        {t('ageVerification.description')}
      </Text>

      {/* Boutons */}
      <View style={styles.buttons}>
        <Button
          title={t('ageVerification.deny')}
          variant="secondary"
          onPress={handleDeny}
          testID="age-deny-btn"
        />
        <Button
          title={t('ageVerification.confirm')}
          onPress={handleConfirm}
          testID="age-confirm-btn"
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
    paddingHorizontal: spacing['4xl'],
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.gold.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: 28,
    color: colors.gold.DEFAULT,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing['2xl'],
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing['3xl'],
  },
});
