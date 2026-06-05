import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { updatePseudonymUseCase } from '../../../application';
import { isValidPseudonym } from '../../../domain/entities';
import { useAuthStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'EditPseudonym'>;

export function EditPseudonymScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const current = user?.pseudonym ?? '';
  const [value, setValue] = useState(current);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = value.trim();
  const isValid = isValidPseudonym(trimmed);
  const isDifferent = trimmed !== current;
  const canSave = isValid && isDifferent && !isSubmitting;

  const handleSave = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const result = await updatePseudonymUseCase({
        userId: user.id,
        currentPseudonym: current,
        newPseudonym: trimmed,
      });
      setUser(result.user);
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_PSEUDONYM') {
        Alert.alert(t('common.error'), t('profile.errorPseudonymInvalid'));
      } else if (message === 'PSEUDONYM_TAKEN') {
        Alert.alert(t('common.error'), t('profile.errorPseudonymTaken'));
      } else {
        Alert.alert(t('common.error'), t('profile.errorUpdateFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title={t('profile.editPseudonymTitle')} showBack />

      <View style={styles.body}>
        <Text style={styles.note}>{t('profile.editPseudonymNote')}</Text>

        <Input
          label={t('profile.pseudonym')}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          testID="edit-pseudonym-input"
        />

        {!isValid && trimmed.length > 0 ? (
          <Text style={styles.errorText}>
            {t('profile.errorPseudonymInvalid')}
          </Text>
        ) : null}

        <Button
          title={t('common.save')}
          onPress={handleSave}
          loading={isSubmitting}
          disabled={!canSave}
          testID="edit-pseudonym-save-btn"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  note: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.semantic.danger,
  },
});
