import { getContainer } from '../../interfaces/container';

export interface CheckBiometricLockOutput {
  locked: boolean;
  error?: 'CANCELLED' | 'FAILED' | 'UNAVAILABLE';
}

/**
 * Decide whether the app should be locked behind biometric auth.
 *
 * - If biometrics disabled (flag absent or 'false') -> not locked.
 * - If biometrics enabled but hardware unavailable -> locked + error.
 * - If biometrics enabled and authentication succeeds -> not locked.
 * - If biometrics enabled and authentication fails -> locked + error.
 */
export async function checkBiometricLockUseCase(
  reason?: string,
): Promise<CheckBiometricLockOutput> {
  const { secureStorage, biometric } = getContainer();

  const flag = await secureStorage.get('jeleveux.biometrics');
  if (flag !== 'true') {
    return { locked: false };
  }

  const available = await biometric.isAvailable();
  if (!available) {
    return { locked: true, error: 'UNAVAILABLE' };
  }

  const ok = await biometric.authenticate(reason);
  if (ok) return { locked: false };

  return { locked: true, error: 'FAILED' };
}
