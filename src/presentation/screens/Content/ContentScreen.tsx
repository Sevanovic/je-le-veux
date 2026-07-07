import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { getContentDocument, type ContentKey } from '../../content';
import { Header, ContentRenderer } from '../../components';
import type { RootStackParamList } from '../../components/navigation/RootNavigator';
import { colors, typography, spacing } from '../../theme';

type Rt = RouteProp<RootStackParamList, 'Content'>;

export function ContentScreen() {
  const { t } = useTranslation();
  const route = useRoute<Rt>();
  const doc = getContentDocument(route.params.contentKey as ContentKey);

  return (
    <View style={styles.root}>
      <Header
        title={t(doc.titleKey)}
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ContentRenderer blocks={doc.blocks} />

        <Text style={styles.footer}>
          {t('content.lastUpdated', { date: doc.lastUpdatedISO })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  footer: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing['2xl'],
    textAlign: 'center',
  },
});
