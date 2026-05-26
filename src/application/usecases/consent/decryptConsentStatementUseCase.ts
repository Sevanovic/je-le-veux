import { getContainer } from '../../interfaces/container';
import type { Consent } from '../../../domain/entities';

export interface DecryptConsentStatementInput {
  consent: Consent;
}

export interface DecryptConsentStatementOutput {
  /** Decrypted statement, or null when the local session key is missing on this device. */
  statement: string | null;
  /** Decrypted conditions if present and decryptable. */
  conditions?: string;
}

/**
 * Decrypt a consent's statement (and conditions) using the session key
 * persisted locally for that consent.
 *
 * Both initiator (via createConsentUseCase) and receiver (via acceptInvitationUseCase)
 * persist the session key under `jeleveux.session.<consentId>` in SecureStore.
 *
 * Returns `statement: null` when the key is unavailable on this device
 * (e.g. fresh sign-in on a new device). Callers should fall back to a
 * neutral "unavailable on this device" message.
 */
export async function decryptConsentStatementUseCase(
  input: DecryptConsentStatementInput,
): Promise<DecryptConsentStatementOutput> {
  const { crypto, secureStorage } = getContainer();

  const sessionKey = await secureStorage.get(`jeleveux.session.${input.consent.id}`);
  if (!sessionKey) {
    return { statement: null };
  }

  let statement: string;
  try {
    statement = await crypto.decryptSymmetric(input.consent.encryptedStatement, sessionKey);
  } catch {
    return { statement: null };
  }

  let conditions: string | undefined;
  if (input.consent.encryptedConditions) {
    try {
      conditions = await crypto.decryptSymmetric(input.consent.encryptedConditions, sessionKey);
    } catch {
      // Statement decrypted but conditions failed — log no, return partial
      conditions = undefined;
    }
  }

  return { statement, conditions };
}
