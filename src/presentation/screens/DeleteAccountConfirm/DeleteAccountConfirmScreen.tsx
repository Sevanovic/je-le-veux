import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { deleteAccountUseCase } from '../../../application';
import { useAuthStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

export function DeleteAccountConfirmScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const current = user?.pseudonym ?? '';
  const [typed, setTyped] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canDelete = typed.trim() === current && current.length > 0 && !isSubmitting;

  const handleDelete = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await deleteAccountUseCase({
        userId: user.id,
        typedPseudonym: typed,
        currentPseudonym: current,
      });
      // RootNavigator detects user = null and shows Auth flow
      logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setIsSubmitting(false);
      if (message === 'PSEUDONYM_MISMATCH') {
        Alert.alert(t('common.error'), t('deleteAccount.errorMismatch'));
      } else {
        Alert.alert(t('common.error'), t('deleteAccount.errorFailed'));
      }
    }
  };

  return (
    <ScreenWrapper>
      <Header title={t('deleteAccount.title')} showBack />

      <View style={styles.body}>
        <Text style={styles.warningTitle}>{t('deleteAccount.warningTitle')}</Text>
        <Text style={styles.warningSubtitle}>{t('deleteAccount.warningSubtitle')}</Text>

        <View style={styles.bullets}>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence1')}</Text>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence2')}</Text>
          <Text style={styles.bullet}>• {t('deleteAccount.consequence3')}</Text>
        </View>

        <Text style={styles.typePrompt}>
          {t('deleteAccount.typePseudonymHint', { pseudo: current })}
        </Text>

        <Input
          label={t('deleteAccount.typePseudonymLabel')}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          testID="delete-typed-pseudonym-input"
        />

        <Button
          title={t('deleteAccount.confirmButton')}
          variant="danger"
          onPress={handleDelete}
          loading={isSubmitting}
          disabled={!canDelete}
          testID="delete-confirm-btn"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  warningTitle: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.lg,
    color: colors.semantic.danger,
  },
  warningSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  bullets: {
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
    padding: spacing.md,
    borderRadius: 12,
  },
  bullet: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  typePrompt: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
});
