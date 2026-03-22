import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, typography, spacing } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, { height: number; fontSize: number }> = {
    sm: { height: 36, fontSize: typography.fontSize.sm },
    md: { height: 44, fontSize: typography.fontSize.md },
    lg: { height: 52, fontSize: typography.fontSize.base },
  };

  const { height, fontSize } = sizeStyles[size];

  // Primary uses gold gradient
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        testID={testID}
        accessibilityLabel={accessibilityLabel || title}
        accessibilityRole="button"
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={
            isDisabled
              ? [colors.background.elevated, colors.background.elevated]
              : [colors.gold.DEFAULT, colors.gold.light, colors.gold.DEFAULT]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            { height, borderRadius: borderRadius.lg },
            isDisabled && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.background.primary} size="small" />
          ) : (
            <>
              {icon}
              <Text
                style={[
                  styles.primaryText,
                  { fontSize },
                  isDisabled && styles.disabledText,
                ]}
              >
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Other variants
  const variantStyles: Record<
    Exclude<ButtonVariant, 'primary'>,
    { bg: string; border: string; text: string }
  > = {
    secondary: {
      bg: colors.transparent,
      border: colors.silver.dark,
      text: colors.silver.DEFAULT,
    },
    danger: {
      bg: colors.transparent,
      border: colors.semantic.danger + '4D', // 30% opacity
      text: colors.semantic.danger,
    },
    ghost: {
      bg: colors.transparent,
      border: colors.transparent,
      text: colors.text.secondary,
    },
  };

  const vs = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      style={[
        styles.container,
        {
          height,
          borderRadius: borderRadius.lg,
          backgroundColor: vs.bg,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: vs.border,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { fontSize, color: vs.text }]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  fullWidth: {
    width: '100%',
  },
  primaryText: {
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.background.primary,
  },
  text: {
    fontFamily: typography.fontFamily.bodyMedium,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.text.muted,
  },
});
