import * as LocalAuthentication from 'expo-local-authentication';
import type { IBiometricService } from '../../domain/interfaces';

/**
 * Biometric authentication service wrapping expo-local-authentication.
 *
 * Used by the biometric lock at app startup and by the Profile toggle
 * to verify hardware availability before enabling the lock.
 */
export class BiometricService implements IBiometricService {
  async isAvailable(): Promise<boolean> {
    return LocalAuthentication.hasHardwareAsync();
  }

  async isEnrolled(): Promise<boolean> {
    return LocalAuthentication.isEnrolledAsync();
  }

  async authenticate(reason?: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? 'Authenticate',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }
}

export const biometricService = new BiometricService();
