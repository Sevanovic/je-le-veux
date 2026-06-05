import { getContainer } from '../../interfaces/container';

export interface ToggleBiometricsInput {
  enabled: boolean;
}

export interface ToggleBiometricsOutput {
  enabled: boolean;
}

/**
 * Persist the biometrics-enabled flag.
 * When enabling, verifies the device actually has biometric hardware
 * and at least one enrolled credential, else throws.
 *
 * Errors: HARDWARE_UNAVAILABLE, NOT_ENROLLED.
 */
export async function toggleBiometricsUseCase(
  input: ToggleBiometricsInput,
): Promise<ToggleBiometricsOutput> {
  const { secureStorage, biometric } = getContainer();

  if (input.enabled) {
    const available = await biometric.isAvailable();
    if (!available) {
      throw new Error('HARDWARE_UNAVAILABLE');
    }
    const enrolled = await biometric.isEnrolled();
    if (!enrolled) {
      throw new Error('NOT_ENROLLED');
    }
  }

  await secureStorage.save('jeleveux.biometrics', input.enabled ? 'true' : 'false');
  return { enabled: input.enabled };
}
