import { getContainer } from '../../interfaces/container';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';

export interface WithdrawConsentInput {
  consentId: string;
  userId: string;
}

export interface WithdrawConsentOutput {
  consent: Consent;
}

/**
 * Withdraw an active consent. Either party (initiator or receiver) may revoke.
 * Sets status to WITHDRAWN with timestamp and the withdrawing user's id.
 */
export async function withdrawConsentUseCase(
  input: WithdrawConsentInput,
): Promise<WithdrawConsentOutput> {
  const { consent } = getContainer();

  // 1. Fetch consent
  const existing = await consent.findById(input.consentId);
  if (!existing) {
    throw new Error('CONSENT_NOT_FOUND');
  }

  // 2. Must be currently active
  if (existing.status !== ConsentStatus.ACTIVE) {
    throw new Error('CONSENT_NOT_ACTIVE');
  }

  // 3. User must be a party to the consent
  const isParty =
    input.userId === existing.initiatorId ||
    input.userId === existing.receiverId;
  if (!isParty) {
    throw new Error('NOT_PARTY');
  }

  // 4. Update to WITHDRAWN
  const updated = await consent.updateStatus(input.consentId, ConsentStatus.WITHDRAWN, {
    withdrawnAt: new Date().toISOString(),
    withdrawnBy: input.userId,
  });

  return { consent: updated };
}
