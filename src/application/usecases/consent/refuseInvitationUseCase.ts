import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface RefuseInvitationInput {
  consentId: string;
  invitationId: string;
}

export interface RefuseInvitationOutput {
  consent: Consent;
}

export async function refuseInvitationUseCase(
  input: RefuseInvitationInput,
): Promise<RefuseInvitationOutput> {
  const { consent, invitation } = getContainer();

  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  const updated = await consent.updateStatus(input.consentId, ConsentStatus.REFUSED, {
    refusedAt: new Date().toISOString(),
  });

  await invitation.markAsUsed(input.invitationId);

  return { consent: updated };
}
