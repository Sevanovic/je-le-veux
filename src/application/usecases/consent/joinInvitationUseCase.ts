import { getContainer } from '../../interfaces/container';
import { isInvitationValid } from '../../../domain/entities';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent, Invitation } from '../../../domain/entities';

export interface JoinInvitationInput {
  /** Format: `JLV-YYYY-XXXX-XXXX#<sessionKey>` */
  shareCode: string;
}

export interface JoinInvitationOutput {
  consent: Consent;
  invitation: Invitation;
  decryptedStatement: string;
  decryptedConditions?: string;
}

const SECURE_CODE_REGEX = /^JLV-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

export async function joinInvitationUseCase(
  input: JoinInvitationInput,
): Promise<JoinInvitationOutput> {
  const { crypto, consent, invitation } = getContainer();

  // 1. Parse shareCode
  const trimmed = input.shareCode.trim();
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex < 0) {
    throw new Error('INVALID_FORMAT');
  }
  const secureCode = trimmed.slice(0, hashIndex);
  const sessionKey = trimmed.slice(hashIndex + 1);

  if (!SECURE_CODE_REGEX.test(secureCode) || !sessionKey) {
    throw new Error('INVALID_FORMAT');
  }

  // 2. Fetch consent
  const foundConsent = await consent.findBySecureCode(secureCode);
  if (!foundConsent) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (foundConsent.status !== ConsentStatus.PENDING) {
    throw new Error('CONSENT_NOT_PENDING');
  }

  // 3. Fetch invitation
  const foundInvitation = await invitation.findByLink(secureCode);
  if (!foundInvitation) {
    throw new Error('CONSENT_NOT_FOUND');
  }
  if (foundInvitation.isUsed) {
    throw new Error('INVITATION_USED');
  }
  if (!isInvitationValid(foundInvitation)) {
    throw new Error('INVITATION_EXPIRED');
  }

  // 4. Decrypt statement
  let decryptedStatement: string;
  try {
    decryptedStatement = await crypto.decryptSymmetric(
      foundConsent.encryptedStatement,
      sessionKey,
    );
  } catch {
    throw new Error('DECRYPT_FAILED');
  }

  // 5. Decrypt conditions if present
  let decryptedConditions: string | undefined;
  if (foundConsent.encryptedConditions) {
    try {
      decryptedConditions = await crypto.decryptSymmetric(
        foundConsent.encryptedConditions,
        sessionKey,
      );
    } catch {
      throw new Error('DECRYPT_FAILED');
    }
  }

  return {
    consent: foundConsent,
    invitation: foundInvitation,
    decryptedStatement,
    decryptedConditions,
  };
}
