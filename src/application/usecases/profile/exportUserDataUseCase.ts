import { getContainer } from '../../interfaces/container';
import type { Consent } from '../../../domain/entities';

export interface ExportUserDataInput {
  userId: string;
}

export interface ExportUserDataOutput {
  /** JSON string ready to be written to a file. */
  json: string;
  /** Suggested filename, e.g. `jeleveux-export-2026-06-05.json`. */
  filename: string;
}

interface ConsentExport {
  id: string;
  secureCode: string;
  status: string;
  level: string;
  durationMinutes: number;
  createdAt: string;
  acceptedAt: string | null;
  expiresAt: string | null;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
  refusedAt: string | null;
  role: 'initiator' | 'receiver';
  counterpartyPseudonym: string | null;
  statement: string | null;
  statementDecryptStatus: 'decrypted' | 'key_unavailable_on_this_device';
  conditions: string | null;
  conditionsDecryptStatus: 'decrypted' | 'absent' | 'key_unavailable_on_this_device';
}

function isoOrNull(d: Date | undefined): string | null {
  return d ? d.toISOString() : null;
}

async function tryDecrypt(
  ciphertext: string,
  sessionKey: string | null,
  decrypt: (ct: string, key: string) => Promise<string>,
): Promise<string | null> {
  if (!sessionKey) return null;
  try {
    return await decrypt(ciphertext, sessionKey);
  } catch {
    return null;
  }
}

async function buildConsentExport(
  consent: Consent,
  userId: string,
  sessionKey: string | null,
  decrypt: (ct: string, key: string) => Promise<string>,
): Promise<ConsentExport> {
  const role: 'initiator' | 'receiver' =
    consent.initiatorId === userId ? 'initiator' : 'receiver';
  const counterpartyPseudonym =
    role === 'initiator'
      ? consent.receiverPseudonym ?? null
      : consent.initiatorPseudonym;

  const statementText = await tryDecrypt(consent.encryptedStatement, sessionKey, decrypt);
  const statementDecryptStatus: ConsentExport['statementDecryptStatus'] =
    statementText !== null ? 'decrypted' : 'key_unavailable_on_this_device';

  let conditions: string | null = null;
  let conditionsDecryptStatus: ConsentExport['conditionsDecryptStatus'] = 'absent';
  if (consent.encryptedConditions) {
    conditions = await tryDecrypt(consent.encryptedConditions, sessionKey, decrypt);
    conditionsDecryptStatus =
      conditions !== null ? 'decrypted' : 'key_unavailable_on_this_device';
  }

  return {
    id: consent.id,
    secureCode: consent.secureCode,
    status: consent.status,
    level: consent.level,
    durationMinutes: consent.durationMinutes,
    createdAt: consent.createdAt.toISOString(),
    acceptedAt: isoOrNull(consent.acceptedAt),
    expiresAt: isoOrNull(consent.expiresAt),
    withdrawnAt: isoOrNull(consent.withdrawnAt),
    withdrawnBy: consent.withdrawnBy ?? null,
    refusedAt: isoOrNull(consent.refusedAt),
    role,
    counterpartyPseudonym,
    statement: statementText,
    statementDecryptStatus,
    conditions,
    conditionsDecryptStatus,
  };
}

/**
 * Build a JSON snapshot of the user's profile + all consents.
 * Decrypts statements/conditions when the session key is available locally.
 */
export async function exportUserDataUseCase(
  input: ExportUserDataInput,
): Promise<ExportUserDataOutput> {
  const { auth, consent: consentRepo, secureStorage, crypto } = getContainer();

  const profile = await auth.getProfile(input.userId);
  if (!profile) throw new Error('PROFILE_NOT_FOUND');

  const consents = await consentRepo.findByUserId(input.userId);

  const consentExports: ConsentExport[] = [];
  for (const c of consents) {
    const sessionKey = await secureStorage.get(`jeleveux.session.${c.id}`);
    consentExports.push(
      await buildConsentExport(c, input.userId, sessionKey, (ct, k) =>
        crypto.decryptSymmetric(ct, k),
      ),
    );
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    profile: {
      id: profile.id,
      pseudonym: profile.pseudonym,
      email: profile.email,
      publicKey: profile.publicKey,
      preferredLanguage: profile.preferredLanguage,
      isAgeVerified: profile.isAgeVerified,
      createdAt: profile.createdAt.toISOString(),
    },
    consents: consentExports,
  };

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `jeleveux-export-${yyyy}-${mm}-${dd}.json`;

  return {
    json: JSON.stringify(payload, null, 2),
    filename,
  };
}
