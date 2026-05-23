import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { ConsentLevel } from '../../../domain/enums';
import type { Consent, Invitation } from '../../../domain/entities';
import { createConsentUseCase } from '../../../application';
import { useAuthStore, useConsentStore } from '../../hooks';
import { ScreenWrapper, Header, Input, Button, Chip } from '../../components';
import { colors, typography, spacing } from '../../theme';

const DURATION_OPTIONS = [
  { key: '60', labelKey: 'createConsent.duration1h' },
  { key: '180', labelKey: 'createConsent.duration3h' },
  { key: '360', labelKey: 'createConsent.duration6h' },
  { key: '720', labelKey: 'createConsent.duration12h' },
  { key: '1440', labelKey: 'createConsent.duration24h' },
];

const LEVEL_OPTIONS = [
  { level: ConsentLevel.LIGHT, labelKey: 'createConsent.levelLight' },
  { level: ConsentLevel.MODERATE, labelKey: 'createConsent.levelModerate' },
  { level: ConsentLevel.INTIMATE, labelKey: 'createConsent.levelIntimate' },
  { level: ConsentLevel.CUSTOM, labelKey: 'createConsent.levelCustom' },
];

const TEMPLATE_KEYS = [
  'templateIntimate',
  'templateMassage',
  'templatePhoto',
  'templateDiscussion',
  'templateActivity',
  'templateCustom',
] as const;

export function CreateConsentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const addConsent = useConsentStore((s) => s.addConsent);

  // Form state
  const [pseudonym, setPseudonym] = useState(user?.pseudonym ?? '');
  const [statement, setStatement] = useState('');
  const [level, setLevel] = useState<ConsentLevel>(ConsentLevel.LIGHT);
  const [duration, setDuration] = useState('360');
  const [conditions, setConditions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state
  const [createdConsent, setCreatedConsent] = useState<Consent | null>(null);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const canSubmit = pseudonym.trim().length >= 3 && statement.trim().length > 0;

  const handleSend = async () => {
    if (!canSubmit || !user) return;
    setIsSubmitting(true);
    try {
      const result = await createConsentUseCase({
        initiatorId: user.id,
        initiatorPseudonym: pseudonym.trim(),
        statement: statement.trim(),
        level,
        durationMinutes: parseInt(duration, 10),
        conditions: conditions.trim() || undefined,
      });

      addConsent(result.consent);
      setCreatedConsent(result.consent);
      setCreatedInvitation(result.invitation);
      setShareCode(result.shareCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_STATEMENT') {
        Alert.alert(t('common.error'), t('createConsent.errorInvalidStatement'));
      } else if (message === 'MISSING_KEYS') {
        Alert.alert(t('common.error'), t('createConsent.errorMissingKeys'));
      } else {
        Alert.alert(t('common.error'), t('createConsent.errorCreationFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!shareCode) return;
    await Share.share({
      message: t('createConsent.shareMessage', { code: shareCode }),
    });
  };

  const handleCopyCode = async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleBackToHome = () => {
    navigation.getParent()?.navigate('HomeTab');
  };

  const handleSelectTemplate = (templateKey: string) => {
    if (templateKey !== 'templateCustom') {
      setStatement(t(`createConsent.${templateKey}`));
    }
  };

  // Success View
  if (createdConsent && createdInvitation && shareCode) {
    return (
      <ScreenWrapper>
        <Header title={t('createConsent.successTitle')} />
        <View style={styles.successContainer}>
          <Text style={styles.successMessage}>
            {t('createConsent.successMessage')}
          </Text>

          <Text style={styles.secureCodeLabel}>
            {t('createConsent.secureCodeLabel')}
          </Text>
          <Text style={styles.secureCode}>{createdConsent.secureCode}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={shareCode}
              size={200}
              backgroundColor={colors.background.card}
              color={colors.gold.DEFAULT}
            />
          </View>

          <Button
            title={codeCopied ? t('createConsent.codeCopied') : t('createConsent.copyCode')}
            onPress={handleCopyCode}
            variant="secondary"
            testID="copy-code-btn"
          />

          <Button
            title={t('createConsent.shareButton')}
            onPress={handleShare}
            testID="share-btn"
          />

          <Button
            title={t('createConsent.backToHome')}
            onPress={handleBackToHome}
            variant="ghost"
            testID="back-home-btn"
          />
        </View>
      </ScreenWrapper>
    );
  }

  // Form View
  return (
    <ScreenWrapper>
      <Header title={t('createConsent.title')} showBack />

      <View style={styles.form}>
        {/* Pseudonym */}
        <Input
          label={t('createConsent.pseudonym')}
          placeholder={t('createConsent.pseudonymPlaceholder')}
          value={pseudonym}
          onChangeText={setPseudonym}
          autoCapitalize="none"
          testID="create-pseudonym-input"
        />

        {/* Templates */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.templates')}</Text>
          <View style={styles.chips}>
            {TEMPLATE_KEYS.map((key) => (
              <Chip
                key={key}
                label={t(`createConsent.${key}`).substring(0, 30) + '...'}
                selected={false}
                onPress={() => handleSelectTemplate(key)}
                testID={`template-${key}`}
              />
            ))}
          </View>
        </View>

        {/* Statement */}
        <Input
          label={t('createConsent.statement')}
          placeholder={t('createConsent.statementPlaceholder')}
          value={statement}
          onChangeText={setStatement}
          multiline
          numberOfLines={4}
          style={styles.textarea}
          testID="create-statement-input"
        />

        {/* Level */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.level')}</Text>
          <View style={styles.chips}>
            {LEVEL_OPTIONS.map(({ level: l, labelKey }) => (
              <Chip
                key={l}
                label={t(labelKey)}
                selected={level === l}
                onPress={() => setLevel(l)}
                testID={`create-level-${l}`}
              />
            ))}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('createConsent.duration')}</Text>
          <View style={styles.chips}>
            {DURATION_OPTIONS.map(({ key, labelKey }) => (
              <Chip
                key={key}
                label={t(labelKey)}
                selected={duration === key}
                onPress={() => setDuration(key)}
                testID={`create-duration-${key}`}
              />
            ))}
          </View>
        </View>

        {/* Conditions */}
        <Input
          label={t('createConsent.conditions')}
          placeholder={t('createConsent.conditionsPlaceholder')}
          value={conditions}
          onChangeText={setConditions}
          multiline
          numberOfLines={2}
          style={styles.textareaSmall}
        />

        {/* Submit */}
        <Button
          title={t('createConsent.send')}
          onPress={handleSend}
          loading={isSubmitting}
          disabled={!canSubmit}
          testID="create-send-btn"
        />
      </View>

      <View style={{ height: 100 }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textareaSmall: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  successContainer: {
    gap: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  successMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  secureCodeLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  secureCode: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: colors.gold.DEFAULT,
    letterSpacing: 2,
    textAlign: 'center',
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    alignItems: 'center',
  },
});
