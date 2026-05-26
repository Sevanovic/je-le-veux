import { getContainer } from '../../interfaces/container';
import { isValidPseudonym } from '../../../domain/entities';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface AcceptInvitationInput {
  consentId: string;
  invitationId: string;
  receiverId: string;
  receiverPseudonym: string;
  /** Session key from the shareCode — persisted locally so receiver can re-read the statement later. */
  sessionKey: string;
}

export interface AcceptInvitationOutput {
  consent: Consent;
}

export async function acceptInvitationUseCase(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationOutput> {
  const { consent, invitation, secureStorage } = getContainer();

  // 1. Validate pseudonym
  if (!isValidPseudonym(input.receiverPseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }

  // 2. Verify consent state
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Compute timestamps
  const acceptedAt = new Date();
  const expiresAt = new Date(acceptedAt.getTime() + existing.durationMinutes * 60_000);

  // 4. Update consent to ACTIVE
  const updated = await consent.updateStatus(input.consentId, ConsentStatus.ACTIVE, {
    receiverId: input.receiverId,
    receiverPseudonym: input.receiverPseudonym,
    acceptedAt: acceptedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  // 5. Mark invitation as used
  await invitation.markAsUsed(input.invitationId);

  // 6. Persist session key locally so receiver can re-read the statement on future sessions
  try {
    await secureStorage.save(`jeleveux.session.${updated.id}`, input.sessionKey);
  } catch {
    // SecureStore failure is non-blocking — receiver can fall back to keeping the shareCode
  }

  return { consent: updated };
}
