import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenWrapper, Card } from '../../components';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import type { ContentKey } from '../../content';
import { colors, typography, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Écran Ressources — contenu éducatif, cadre légal, lignes d'écoute.
 * Tout le contenu est bilingue via i18n.
 * Chaque carte ouvre une ContentScreen modale via le RootNavigator.
 */
export function ResourcesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();

  const resources: Array<{ titleKey: string; descKey: string; contentKey: ContentKey }> = [
    {
      titleKey: 'resources.whatIsConsent',
      descKey: 'resources.whatIsConsentDesc',
      contentKey: 'consent',
    },
    {
      titleKey: 'resources.legalFramework',
      descKey: 'resources.legalFrameworkDesc',
      contentKey: 'legalFramework',
    },
    {
      titleKey: 'resources.helpline',
      descKey: 'resources.helplineDesc',
      contentKey: 'helpline',
    },
    {
      titleKey: 'resources.privacy',
      descKey: 'resources.privacyDesc',
      contentKey: 'privacy',
    },
  ];

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>{t('resources.title')}</Text>
      </View>

      <View style={styles.list}>
        {resources.map((res) => (
          <Card key={res.contentKey}>
            <Text style={styles.cardTitle}>{t(res.titleKey)}</Text>
            <Text style={styles.cardDesc}>{t(res.descKey)}</Text>
            <TouchableOpacity
              style={styles.link}
              onPress={() => navigation.navigate('Content', { contentKey: res.contentKey })}
              testID={`resource-link-${res.contentKey}`}
            >
              <Text style={styles.linkText}>
                {t('resources.learnMore')} {'→'}
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
