import { getContainer } from '../../interfaces/container';

/**
 * Use case: Sign out the current user.
 *
 * Delegates to IAuthService. The presentation layer
 * is responsible for clearing local state (Zustand store).
 */
export async function signOutUseCase(): Promise<void> {
  const { auth } = getContainer();
  await auth.signOut();
}
