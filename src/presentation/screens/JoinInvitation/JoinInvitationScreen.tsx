import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { joinInvitationUseCase } from '../../../application';
import { ScreenWrapper, Header, Input, Button } from '../../components';
import type { HomeStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type JoinNav = NativeStackNavigationProp<HomeStackParamList, 'JoinInvitation'>;

export function JoinInvitationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<JoinNav>();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const submit = async (shareCode: string) => {
    setIsSubmitting(true);
    try {
      const result = await joinInvitationUseCase({ shareCode });
      navigation.replace('InvitationReceived', {
        consent: result.consent,
        invitation: result.invitation,
        decryptedStatement: result.decryptedStatement,
        decryptedConditions: result.decryptedConditions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const errorKeyMap: Record<string, string> = {
        INVALID_FORMAT: 'joinInvitation.errorInvalidFormat',
        CONSENT_NOT_FOUND: 'joinInvitation.errorNotFound',
        CONSENT_NOT_PENDING: 'joinInvitation.errorConsentNotPending',
        INVITATION_USED: 'joinInvitation.errorAlreadyUsed',
        INVITATION_EXPIRED: 'joinInvitation.errorExpired',
        DECRYPT_FAILED: 'joinInvitation.errorDecryptFailed',
      };
      const key = errorKeyMap[message] ?? 'errors.generic';
      Alert.alert(t('common.error'), t(key));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!code.trim()) return;
    submit(code.trim());
  };

  const handleScanPress = async () => {
    if (!permission) return;
    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          t('joinInvitation.cameraPermission'),
          t('joinInvitation.cameraPermissionDeniedMessage'),
        );
        return;
      }
    }
    setScannerOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScannerOpen(false);
    setCode(data);
    submit(data);
  };

  return (
    <ScreenWrapper>
      <Header title={t('joinInvitation.title')} showBack />

      <View style={styles.content}>
        <Text style={styles.subtitle}>{t('joinInvitation.subtitle')}</Text>

        <Input
          label={t('joinInvitation.codeLabel')}
          placeholder={t('joinInvitation.codePlaceholder')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          testID="join-code-input"
        />

        <Button
          title={t('joinInvitation.scanButton')}
          variant="secondary"
          onPress={handleScanPress}
          testID="join-scan-btn"
        />

        <Button
          title={t('joinInvitation.submitButton')}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!code.trim() || isSubmitting}
          testID="join-submit-btn"
        />
      </View>

      <Modal visible={scannerOpen} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerFooter}>
            <Button
              title={t('common.cancel')}
              variant="ghost"
              onPress={() => setScannerOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  camera: {
    flex: 1,
  },
  scannerFooter: {
    padding: spacing.lg,
    backgroundColor: colors.background.card,
  },
});
