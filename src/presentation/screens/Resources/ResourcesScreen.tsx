import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper, Card } from '../../components';
import { colors, typography, spacing } from '../../theme';

/**
 * Écran Ressources — contenu éducatif, cadre légal, lignes d'écoute.
 * Tout le contenu est bilingue via i18n.
 */
export function ResourcesScreen() {
  const { t } = useTranslation();

  const resources = [
    {
      titleKey: 'resources.whatIsConsent',
      descKey: 'resources.whatIsConsentDesc',
    },
    {
      titleKey: 'resources.legalFramework',
      descKey: 'resources.legalFrameworkDesc',
    },
    {
      titleKey: 'resources.helpline',
      descKey: 'resources.helplineDesc',
    },
    {
      titleKey: 'resources.privacy',
      descKey: 'resources.privacyDesc',
    },
  ];

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>{t('resources.title')}</Text>
      </View>

      <View style={styles.list}>
        {resources.map((res, idx) => (
          <Card key={idx}>
            <Text style={styles.cardTitle}>{t(res.titleKey)}</Text>
            <Text style={styles.cardDesc}>{t(res.descKey)}</Text>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>
                {t('resources.learnMore')} {'\u2192'}
              </Text>
            </TouchableOpacity>
          </Card>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
  },
  list: {
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  cardDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  link: {
    marginTop: spacing.sm + 2,
  },
  linkText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.gold.DEFAULT,
  },
});
