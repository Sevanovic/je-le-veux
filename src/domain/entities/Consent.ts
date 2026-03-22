import { ConsentLevel, ConsentStatus } from '../enums';

/**
 * Entité Consentement — l'objet métier central de l'application.
 * Représente un accord mutuel entre deux adultes.
 *
 * Principes FLERR : Libre, Éclairé, Explicite, Révocable, Renouvelable.
 */
export interface Consent {
  readonly id: string;

  /** Code unique affiché à l'utilisateur (ex: JLV-2026-A7F3-X9K2) */
  readonly secureCode: string;

  /** ID de l'initiateur du consentement */
  readonly initiatorId: string;
  readonly initiatorPseudonym: string;

  /** ID du destinataire (null tant que l'invitation n'est pas acceptée) */
  readonly receiverId?: string;
  readonly receiverPseudonym?: string;

  /** Énoncé chiffré du consentement (E2E) */
  readonly encryptedStatement: string;

  /** Niveau de consentement choisi */
  readonly level: ConsentLevel;

  /** Statut actuel dans le cycle de vie */
  readonly status: ConsentStatus;

  /** Durée de validité en minutes */
  readonly durationMinutes: number;

  /** Conditions supplémentaires (chiffrées) */
  readonly encryptedConditions?: string;

  /** Horodatages du cycle de vie */
  readonly createdAt: Date;
  readonly acceptedAt?: Date;
  readonly expiresAt?: Date;
  readonly withdrawnAt?: Date;
  readonly withdrawnBy?: string;
  readonly refusedAt?: Date;
}

/**
 * Données nécessaires pour créer un nouveau consentement.
 */
export interface CreateConsentDTO {
  initiatorId: string;
  initiatorPseudonym: string;
  statement: string;
  level: ConsentLevel;
  durationMinutes: number;
  conditions?: string;
  receiverPublicKey?: string;
}

/**
 * Génère un code sécurisé unique au format JLV-YYYY-XXXX-XXXX.
 */
export function generateSecureCode(): string {
  const year = new Date().getFullYear();
  const hex = () =>
    Math.random().toString(16).substring(2, 6).toUpperCase();
  return `JLV-${year}-${hex()}-${hex()}`;
}

/**
 * Vérifie si un consentement est encore actif (non expiré, non retiré).
 */
export function isConsentActive(consent: Consent): boolean {
  if (consent.status !== ConsentStatus.ACTIVE) return false;
  if (!consent.expiresAt) return false;
  return new Date() < consent.expiresAt;
}

/**
 * Vérifie si un consentement peut être retiré.
 */
export function isWithdrawable(consent: Consent): boolean {
  return consent.status === ConsentStatus.ACTIVE && isConsentActive(consent);
}

/**
 * Calcule le temps restant avant expiration en minutes.
 * Retourne 0 si déjà expiré.
 */
export function remainingMinutes(consent: Consent): number {
  if (!consent.expiresAt) return 0;
  const diff = consent.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 60000));
}
