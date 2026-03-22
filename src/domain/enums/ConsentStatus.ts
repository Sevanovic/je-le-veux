/**
 * Statuts possibles d'un consentement tout au long de son cycle de vie.
 */
export enum ConsentStatus {
  /** Invitation envoyée, en attente de réponse */
  PENDING = 'pending',
  /** Les deux parties ont accepté */
  ACTIVE = 'active',
  /** La durée de validité est dépassée */
  EXPIRED = 'expired',
  /** Retiré volontairement par l'une des parties */
  WITHDRAWN = 'withdrawn',
  /** Refusé par le destinataire */
  REFUSED = 'refused',
}
