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

  // 2. Retrieve initiator's keys from secure storage
  const publicKey = await secureStorage.get('jeleveux.public_key');
  const secretKey = await secureStorage.get('jeleveux.secret_key');

  if (!publicKey || !secretKey) {
    throw new Error('MISSING_KEYS');
  }

  // 3. Encrypt statement with initiator's own public key (Approach B)
  const encryptedStatement = await crypto.encrypt(
    input.statement,
    publicKey,
    secretKey,
  );

  // 4. Encrypt conditions if present
  let encryptedConditions: string | undefined;
  if (input.conditions?.trim()) {
    encryptedConditions = await crypto.encrypt(
      input.conditions,
      publicKey,
      secretKey,
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

  // 7. Create invitation
  const createdInvitation = await invitation.create(createdConsent.id);

  return { consent: createdConsent, invitation: createdInvitation };
}
