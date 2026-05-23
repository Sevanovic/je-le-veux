import { getContainer } from '../../interfaces/container';
import { isValidPseudonym, generateSecureCode } from '../../../domain/entities';
import type { Consent, Invitation } from '../../../domain/entities';
import type { ConsentLevel } from '../../../domain/enums';

export interface CreateConsentInput {
  initiatorId: string;
  initiatorPseudonym: string;
  statement: string;
  level: ConsentLevel;
  durationMinutes: number;
  conditions?: string;
}

export interface CreateConsentOutput {
  consent: Consent;
  invitation: Invitation;
  /** Format: `JLV-YYYY-XXXX-XXXX#<sessionKey>`. To be encoded in QR / shared. */
  shareCode: string;
}

export async function createConsentUseCase(
  input: CreateConsentInput,
): Promise<CreateConsentOutput> {
  const { crypto, secureStorage, consent, invitation } = getContainer();

  // 1. Domain validation
  if (!isValidPseudonym(input.initiatorPseudonym)) {
    throw new Error('INVALID_PSEUDONYM');
  }
  if (!input.statement.trim()) {
    throw new Error('INVALID_STATEMENT');
  }
  if (input.durationMinutes <= 0) {
    throw new Error('INVALID_DURATION');
  }

  // 2. Generate a random session key (symmetric, 32 bytes)
  const sessionKey = await crypto.generateSymmetricKey();

  // 3. Encrypt statement with the session key
  const encryptedStatement = await crypto.encryptSymmetric(
    input.statement,
    sessionKey,
  );

  // 4. Encrypt conditions if present
  let encryptedConditions: string | undefined;
  if (input.conditions?.trim()) {
    encryptedConditions = await crypto.encryptSymmetric(
      input.conditions,
      sessionKey,
    );
  }

  // 5. Generate secure code
  const secureCode = generateSecureCode();

  // 6. Create consent in DB
  const createdConsent = await consent.create({
    initiatorId: input.initiatorId,
    initiatorPseudonym: input.initiatorPseudonym,
    secureCode,
    statement: encryptedStatement,
    level: input.level,
    durationMinutes: input.durationMinutes,
    conditions: encryptedConditions,
  });

  // 7. Persist session key locally so initiator can re-read later
  try {
    await secureStorage.save(`jeleveux.session.${createdConsent.id}`, sessionKey);
  } catch {
    // SecureStore failure is non-blocking — initiator can recover via shareCode if they kept it
  }

  // 8. Create invitation
  const createdInvitation = await invitation.create(createdConsent.id);

  // 9. Build shareCode for out-of-band sharing
  const shareCode = `${secureCode}#${sessionKey}`;

  return { consent: createdConsent, invitation: createdInvitation, shareCode };
}
