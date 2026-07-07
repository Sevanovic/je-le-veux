import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface CheckboxRowProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Custom checkbox row. React Native has no native Checkbox component;
 * this draws a square with a gold border + golden checkmark when checked.
 * Children render to the right of the checkbox — typically inline Text
 * with tappable spans (links).
 */
export function CheckboxRow({ checked, onToggle, children, testID }: CheckboxRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={[styles.box, checked && styles.boxChecked]}
        testID={testID}
      >
        {checked ? <Text style={styles.mark}>✓</Text> : null}
      </TouchableOpacity>
      <View style={styles.textContainer}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.silver.dark,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    borderColor: colors.gold.DEFAULT,
    backgroundColor: colors.gold.muted,
  },
  mark: {
    fontSize: 14,
    color: colors.gold.DEFAULT,
    fontFamily: typography.fontFamily.bodyMedium,
    lineHeight: 16,
  },
  textContainer: {
    flex: 1,
  },
});
