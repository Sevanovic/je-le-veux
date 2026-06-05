import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import type { User } from '../../../domain/entities';

export interface UpdatePseudonymInput {
  userId: string;
  currentPseudonym: string;
  newPseudonym: string;
}

export interface UpdatePseudonymOutput {
  user: User;
}

/**
 * Update the user's pseudonym on the profile row.
 *
 * Existing consents keep their snapshot pseudonyms unchanged — the new
 * value will appear only on future consents.
 *
 * Errors:
 *   INVALID_PSEUDONYM  -> regex / length validation failed
 *   PSEUDONYM_TAKEN    -> Supabase UNIQUE constraint hit
 *   UPDATE_FAILED      -> generic Supabase error
 *   PROFILE_NOT_FOUND  -> shouldn't happen but guard anyway
 */
export async function updatePseudonymUseCase(
  input: UpdatePseudonymInput,
): Promise<UpdatePseudonymOutput> {
  const { auth } = getContainer();

  const trimmed = input.newPseudonym.trim();

  // No-op when value unchanged: still return current profile for store sync.
  if (trimmed === input.currentPseudonym) {
    const current = await auth.getProfile(input.userId);
    if (!current) throw new Error('PROFILE_NOT_FOUND');
    return { user: current };
  }

  if (!isValidPseudonym(trimmed)) {
    throw new Error('INVALID_PSEUDONYM');
  }

  try {
    await auth.updateProfile(input.userId, { pseudonym: trimmed });
  } catch (e) {
    const msg = (e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? '';
    if (String(msg).includes('23505') || String(msg).toLowerCase().includes('duplicate')) {
      throw new Error('PSEUDONYM_TAKEN');
    }
    throw new Error('UPDATE_FAILED');
  }

  const updated = await auth.getProfile(input.userId);
  if (!updated) throw new Error('PROFILE_NOT_FOUND');
  return { user: updated };
}
