import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SupportedLanguage } from '../../../domain/enums';
import { changeLanguage } from '../../../infrastructure/i18n';
import { useSettingsStore } from '../../hooks';
import { colors, borderRadius, typography, spacing } from '../../theme';

/**
 * Sélecteur de langue FR/EN.
 * Affiché dans l'écran Profil.
 * Change la langue en temps réel et persiste le choix.
 */
export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useSettingsStore();

  const currentLang = i18n.language as SupportedLanguage;

  const handleChange = async (lang: SupportedLanguage) => {
    if (lang === currentLang) return;
    await changeLanguage(lang);
    setLanguage(lang);
  };

  const languages: Array<{ code: SupportedLanguage; label: string }> = [
    { code: SupportedLanguage.FRENCH, label: t('profile.languageFr') },
    { code: SupportedLanguage.ENGLISH, label: t('profile.languageEn') },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('profile.language')}</Text>
      <View style={styles.options}>
        {languages.map(({ code, label }) => {
          const isActive = currentLang === code;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => handleChange(code)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              style={[styles.option, isActive && styles.optionActive]}
            >
              <Text
                style={[styles.optionText, isActive && styles.optionTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
  },
  optionActive: {
    borderColor: colors.gold.DEFAULT,
    backgroundColor: colors.gold.muted,
  },
  optionText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  optionTextActive: {
    color: colors.gold.DEFAULT,
    fontFamily: typography.fontFamily.bodyMedium,
  },
});
