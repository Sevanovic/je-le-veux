import { getContainer } from '../../interfaces/container';
import type { User } from '../../../domain/entities';

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInOutput {
  user: User;
}

/**
 * Use case: Sign in an existing user.
 *
 * Orchestrates:
 * 1. Validate input format
 * 2. Authenticate via IAuthService
 * 3. Fetch user profile
 * 4. Return complete user
 */
export async function signInUseCase(input: SignInInput): Promise<SignInOutput> {
  const { auth } = getContainer();

  if (!input.email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }

  if (input.password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT');
  }

  const { userId } = await auth.signIn({
    email: input.email,
    password: input.password,
  });

  const profile = await auth.getProfile(userId);
  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return { user: profile };
}
