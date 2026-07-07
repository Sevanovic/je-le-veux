import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ContentBlock } from '../../content/types';
import { colors, typography, spacing } from '../../theme';

interface ContentRendererProps {
  blocks: ContentBlock[];
}

/**
 * Renders an ordered list of typed content blocks. Phone/email/link blocks
 * become tappable using Linking.openURL with tel:, mailto:, and https: schemes.
 */
export function ContentRenderer({ blocks }: ContentRendererProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const styleForLevel =
              block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
            return (
              <Text key={idx} style={styleForLevel}>
                {t(block.textKey)}
              </Text>
            );
          }
          case 'paragraph':
            return (
              <Text key={idx} style={styles.paragraph}>
                {t(block.textKey)}
              </Text>
            );
          case 'bullet':
            return (
              <View key={idx} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>•</Text>
                <Text style={styles.bulletText}>{t(block.textKey)}</Text>
              </View>
            );
          case 'phone':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(`tel:${block.number}`)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.number}</Text>
              </TouchableOpacity>
            );
          case 'email':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(`mailto:${block.address}`)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.address}</Text>
              </TouchableOpacity>
            );
          case 'link':
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => Linking.openURL(block.url)}
                style={styles.actionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{t(block.labelKey)}</Text>
                <Text style={styles.actionValue}>{block.url}</Text>
              </TouchableOpacity>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  h1: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  h2: {
    fontFamily: typography.fontFamily.displayMedium,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  h3: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  paragraph: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  bulletMark: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.gold.DEFAULT,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: 8,
  },
  actionLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  actionValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    color: colors.gold.DEFAULT,
  },
});
