import { getContainer } from '../../interfaces/container';
import type { User } from '../../../domain/entities';

export interface AcceptTermsInput {
  userId: string;
}

export interface AcceptTermsOutput {
  user: User;
}

/**
 * Record that the user has accepted the current Terms version.
 * Used at sign-up (called indirectly via signUpUseCase) and exposed
 * for future re-acceptance flows when Terms change.
 */
export async function acceptTermsUseCase(
  input: AcceptTermsInput,
): Promise<AcceptTermsOutput> {
  const { auth } = getContainer();

  await auth.updateProfile(input.userId, { termsAcceptedAt: new Date() } as Partial<User>);

  const user = await auth.getProfile(input.userId);
  if (!user) throw new Error('PROFILE_NOT_FOUND');
  return { user };
}
