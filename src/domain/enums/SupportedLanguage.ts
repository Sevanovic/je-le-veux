/**
 * Langues supportées par l'application.
 * Extensible pour les futures versions (es, de, pt...).
 */
export enum SupportedLanguage {
  FRENCH = 'fr',
  ENGLISH = 'en',
}

export const DEFAULT_LANGUAGE = SupportedLanguage.FRENCH;

/**
 * Vérifie si une chaîne correspond à une langue supportée.
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return Object.values(SupportedLanguage).includes(lang as SupportedLanguage);
}
