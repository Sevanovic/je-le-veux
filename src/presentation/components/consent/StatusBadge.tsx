import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ConsentStatus } from '../../../domain/enums';
import { colors, borderRadius, typography, spacing } from '../../theme';

interface StatusBadgeProps {
  status: ConsentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  const config: Record<
    ConsentStatus,
    { bg: string; text: string; label: string }
  > = {
    [ConsentStatus.ACTIVE]: {
      bg: colors.semantic.successMuted,
      text: colors.semantic.success,
      label: t('home.active'),
    },
    [ConsentStatus.PENDING]: {
      bg: colors.semantic.infoMuted,
      text: colors.semantic.info,
      label: t('common.loading'),
    },
    [ConsentStatus.EXPIRED]: {
      bg: colors.gold.muted,
      text: colors.gold.light,
      label: t('home.expired'),
    },
    [ConsentStatus.WITHDRAWN]: {
      bg: colors.semantic.dangerMuted,
      text: colors.semantic.danger,
      label: t('home.withdrawn'),
    },
    [ConsentStatus.REFUSED]: {
      bg: colors.semantic.dangerMuted,
      text: colors.semantic.danger,
      label: t('invitation.refuse'),
    },
  };

  const { bg, text, label } = config[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.xl,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
  },
});
