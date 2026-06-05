import { getContainer } from '../../interfaces/container';

export interface ToggleNotificationsInput {
  enabled: boolean;
}

export interface ToggleNotificationsOutput {
  enabled: boolean;
}

/**
 * Persist the notifications-enabled flag.
 * No permission is requested and no service is wired yet — the flag
 * will be consumed by push infrastructure in Sprint 6.
 */
export async function toggleNotificationsUseCase(
  input: ToggleNotificationsInput,
): Promise<ToggleNotificationsOutput> {
  const { secureStorage } = getContainer();
  await secureStorage.save('jeleveux.notifications', input.enabled ? 'true' : 'false');
  return { enabled: input.enabled };
}
