import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'gold' | 'success' | 'danger';
  testID?: string;
}

export function Card({
  children,
  onPress,
  style,
  variant = 'default',
  testID,
}: CardProps) {
  const borderColors: Record<string, string> = {
    default: colors.border.goldSubtle,
    gold: colors.border.goldLight,
    success: colors.semantic.successMuted,
    danger: colors.semantic.dangerMuted,
  };

  const content = (
    <View
      style={[
        styles.card,
        { borderColor: borderColors[variant] },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
});
