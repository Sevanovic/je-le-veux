import { getContainer } from '../../interfaces/container';
import type { User } from '../../../domain/entities';

export interface RestoreSessionOutput {
  user: User | null;
  isAgeVerified: boolean;
  hasCompletedOnboarding: boolean;
}

/**
 * Use case: Restore user session at app startup.
 *
 * Orchestrates:
 * 1. Check SecureStore for age verification and onboarding flags
 * 2. Check for existing Supabase session
 * 3. If session exists, fetch profile
 * 4. Return complete state for the auth store
 */
export async function restoreSessionUseCase(): Promise<RestoreSessionOutput> {
  const { auth, secureStorage } = getContainer();

  let isAgeVerified = false;
  let hasCompletedOnboarding = false;

  // 1. Restore local flags
  try {
    const ageFlag = await secureStorage.get('jeleveux.age_verified');
    isAgeVerified = ageFlag === 'true';

    const onboardingFlag = await secureStorage.get('jeleveux.onboarding_done');
    hasCompletedOnboarding = onboardingFlag === 'true';
  } catch {
    // SecureStore may fail on web — non-blocking
  }

  // 2. Check for existing session
  let user: User | null = null;
  try {
    const session = await auth.getSession();
    if (session) {
      user = await auth.getProfile(session.userId);
    }
  } catch {
    // No session — user needs to sign in
  }

  return { user, isAgeVerified, hasCompletedOnboarding };
}
