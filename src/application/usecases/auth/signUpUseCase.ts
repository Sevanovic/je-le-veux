import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import type { User } from '../../../domain/entities';
import type { SupportedLanguage } from '../../../domain/enums';

export interface SignUpInput {
  email: string;
  password: string;
  pseudonym: string;
  preferredLanguage: SupportedLanguage;
}

export interface SignUpOutput {
  user: User;
}

/**
 * Use case: Sign up a new user.
 *
 * Orchestrates:
 * 1. Validate pseudonym format (domain rule)
 * 2. Create auth account via IAuthService
 * 3. Generate E2E key pair via ICryptoService
 * 4. Store secret key locally via ISecureStorageService
 * 5. Send public key to user profile
 * 6. Return complete user profile
 *
 * The presentation layer calls this instead of touching infrastructure directly.
 */
export async function signUpUseCase(input: SignUpInput): Promise<SignUpOutput> {
  const { auth, crypto, secureStorage } = getContainer();

  // 1. Domain validation
  if (!isValidPseudonym(input.pseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }

  if (!input.email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }

  if (input.password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT');
  }

  // 2. Create account
  const { userId } = await auth.signUp({
    email: input.email,
    password: input.password,
    pseudonym: input.pseudonym,
    preferredLanguage: input.preferredLanguage,
  });

  // 3. Generate E2E key pair
  const keyPair = await crypto.generateKeyPair();

  // 4. Store secret key locally (never sent to server)
  try {
    await secureStorage.save('jeleveux.secret_key', keyPair.secretKey);
    await secureStorage.save('jeleveux.public_key', keyPair.publicKey);
  } catch {
    // SecureStore may fail on web — non-blocking
  }

  // 5. Send public key to profile
  await auth.updateProfile(userId, {
    publicKey: keyPair.publicKey,
  } as Partial<User>);

  // 6. Fetch and return complete profile
  const profile = await auth.getProfile(userId);
  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return { user: profile };
}
