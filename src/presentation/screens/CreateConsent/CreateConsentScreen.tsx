import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ConsentLevel } from '../../../domain/enums';
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

/**
 * Écran de création d'un nouveau consentement.
 * Formulaire : pseudonyme, énoncé, niveau, durée, conditions.
 */
export function CreateConsentScreen() {
  const { t } = useTranslation();
  const [pseudonym, setPseudonym] = useState('');
  const [statement, setStatement] = useState('');
  const [level, setLevel] = useState<ConsentLevel>(ConsentLevel.LIGHT);
  const [duration, setDuration] = useState('360');
  const [conditions, setConditions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = pseudonym.trim().length >= 3 && statement.trim().length > 0;

  const handleSend = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      // TODO Sprint 2 : appeler le use case CreateConsent
      // avec chiffrement E2E de l'énoncé
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title={t('createConsent.title')} showBack />

      <View style={styles.form}>
        {/* Pseudonyme */}
        <Input
          label={t('createConsent.pseudonym')}
          placeholder={t('createConsent.pseudonymPlaceholder')}
          value={pseudonym}
          onChangeText={setPseudonym}
          autoCapitalize="none"
          testID="create-pseudonym-input"
        />

        {/* Énoncé */}
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

        {/* Niveau */}
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

        {/* Durée */}
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
});
