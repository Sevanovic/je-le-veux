import { getContainer } from '../../interfaces/container';

/**
 * Use case: Send a magic link for passwordless authentication.
 *
 * Validates email format then delegates to IAuthService.
 */
export async function sendMagicLinkUseCase(email: string): Promise<void> {
  const { auth } = getContainer();

  if (!email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }

  await auth.sendMagicLink(email);
}
