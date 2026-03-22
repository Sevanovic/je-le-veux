import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Consent } from '../../../domain/entities';
import { Card } from '../ui/Card';
import { StatusBadge } from './StatusBadge';
import { colors, typography, spacing } from '../../theme';

interface ConsentCardProps {
  consent: Consent;
  onPress: (consent: Consent) => void;
}

export function ConsentCard({ consent, onPress }: ConsentCardProps) {
  const { t } = useTranslation();

  const partnerPseudo =
    consent.receiverPseudonym || consent.initiatorPseudonym;

  return (
    <Card
      onPress={() => onPress(consent)}
      testID={`consent-card-${consent.id}`}
    >
      <View style={styles.top}>
        <Text style={styles.pseudo}>
          {t('history.with')} {partnerPseudo}
        </Text>
        <StatusBadge status={consent.status} />
      </View>
      <Text style={styles.detail}>{consent.secureCode}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pseudo: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  detail: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
});
