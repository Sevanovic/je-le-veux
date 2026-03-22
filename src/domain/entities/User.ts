import { SupportedLanguage } from '../enums';

/**
 * Entité utilisateur — couche Domain pure, aucune dépendance infrastructure.
 */
export interface User {
  readonly id: string;
  readonly pseudonym: string;
  readonly email: string;
  readonly publicKey: string;
  readonly preferredLanguage: SupportedLanguage;
  readonly isAgeVerified: boolean;
  readonly createdAt: Date;
  readonly avatarUrl?: string;
}

/**
 * Données minimales pour créer un nouvel utilisateur.
 */
export interface CreateUserDTO {
  pseudonym: string;
  email: string;
  publicKey: string;
  preferredLanguage: SupportedLanguage;
}

/**
 * Valide qu'un pseudonyme respecte les contraintes métier.
 * - Entre 3 et 30 caractères
 * - Lettres, chiffres, underscores et tirets uniquement
 */
export function isValidPseudonym(pseudonym: string): boolean {
  const regex = /^[a-zA-Z0-9_\-\u00C0-\u024F]{3,30}$/;
  return regex.test(pseudonym);
}
