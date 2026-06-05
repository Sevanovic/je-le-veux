import AsyncStorage from '@react-native-async-storage/async-storage';
import { getContainer } from '../../interfaces/container';

export interface DeleteAccountInput {
  userId: string;
  typedPseudonym: string;
  currentPseudonym: string;
}

/**
 * Permanently delete the current user account (GDPR).
 *
 * Sequence:
 *   1. Verify the typed pseudonym matches the current one.
 *   2. Call auth.deleteCurrentAccount() — Supabase RPC that wipes
 *      auth.users and cascades to profile, consents, invitations.
 *   3. Best-effort clear secureStorage (jeleveux.* keys + session index).
 *   4. Best-effort clear AsyncStorage.
 *   5. signOut() defensively in case the session lingers.
 *
 * Errors: PSEUDONYM_MISMATCH, RPC_FAILED.
 */
export async function deleteAccountUseCase(
  input: DeleteAccountInput,
): Promise<void> {
  const { auth, secureStorage } = getContainer();

  if (input.typedPseudonym.trim() !== input.currentPseudonym) {
    throw new Error('PSEUDONYM_MISMATCH');
  }

  try {
    await auth.deleteCurrentAccount();
  } catch {
    throw new Error('RPC_FAILED');
  }

  try {
    await secureStorage.clearAll();
  } catch {
    // best-effort
  }
  try {
    await AsyncStorage.clear();
  } catch {
    // best-effort
  }
  try {
    await auth.signOut();
  } catch {
    // best-effort
  }
}
