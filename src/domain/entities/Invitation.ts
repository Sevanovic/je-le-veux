/**
 * Entité Invitation — lien entre l'initiateur et le destinataire.
 */
export interface Invitation {
  readonly id: string;
  readonly consentId: string;
  readonly inviteLink: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly isUsed: boolean;
}

/**
 * Durée de vie d'une invitation non utilisée : 24 heures.
 */
export const INVITATION_TTL_HOURS = 24;

/**
 * Vérifie si une invitation est encore valide.
 */
export function isInvitationValid(invitation: Invitation): boolean {
  if (invitation.isUsed) return false;
  return new Date() < invitation.expiresAt;
}
