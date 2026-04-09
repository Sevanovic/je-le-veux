import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Invitation } from '../../../domain/entities';

export interface CreateInvitationInput {
  consentId: string;
  userId: string;
}

export interface CreateInvitationOutput {
  invitation: Invitation;
}

export async function createInvitationUseCase(
  input: CreateInvitationInput,
): Promise<CreateInvitationOutput> {
  const { consent, invitation } = getContainer();

  // 1. Verify consent exists and belongs to user
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }

  if (existing.initiatorId !== input.userId) {
    throw new Error('NOT_OWNER');
  }

  // 2. Verify consent is still pending
  if (existing.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Create new invitation
  const createdInvitation = await invitation.create(input.consentId);

  return { invitation: createdInvitation };
}
