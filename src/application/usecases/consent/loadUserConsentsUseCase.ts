import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface LoadUserConsentsInput {
  userId: string;
}

export interface LoadUserConsentsOutput {
  consents: Consent[];
}

/**
 * Fetch all consents where the user is initiator OR receiver.
 *
 * Lazy expiration: any ACTIVE consent whose `expiresAt` is in the past is
 * transitioned to EXPIRED in the DB before returning. This keeps the DB
 * status truthful without requiring a cron — the next client open does
 * the work for everyone, and Realtime propagates the change.
 */
export async function loadUserConsentsUseCase(
  input: LoadUserConsentsInput,
): Promise<LoadUserConsentsOutput> {
  const { consent } = getContainer();
  const consents = await consent.findByUserId(input.userId);

  const now = new Date();
  const expiredCandidates = consents.filter(
    (c) =>
      c.status === ConsentStatus.ACTIVE &&
      c.expiresAt instanceof Date &&
      c.expiresAt < now,
  );

  if (expiredCandidates.length === 0) {
    return { consents };
  }

  const updated = await Promise.all(
    expiredCandidates.map((c) =>
      consent.updateStatus(c.id, ConsentStatus.EXPIRED),
    ),
  );

  const byId = new Map(updated.map((c) => [c.id, c]));
  const merged = consents.map((c) => byId.get(c.id) ?? c);

  return { consents: merged };
}
