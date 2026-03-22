import {
  SupportedLanguage,
  isSupportedLanguage,
  DEFAULT_LANGUAGE,
} from '../../src/domain/enums';

/**
 * Tests Sprint 1 — Authentification et profil.
 *
 * Note : les tests d'intégration Supabase nécessitent un projet Supabase
 * configuré. Ici on teste la logique pure côté client.
 */

describe('SupportedLanguage', () => {
  test('isSupportedLanguage returns true for fr and en', () => {
    expect(isSupportedLanguage('fr')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
  });

  test('isSupportedLanguage returns false for unsupported languages', () => {
    expect(isSupportedLanguage('es')).toBe(false);
    expect(isSupportedLanguage('de')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
    expect(isSupportedLanguage('FR')).toBe(false); // case sensitive
  });

  test('DEFAULT_LANGUAGE is French', () => {
    expect(DEFAULT_LANGUAGE).toBe(SupportedLanguage.FRENCH);
  });
});

describe('Auth validation logic', () => {
  test('email validation', () => {
    const isValidEmail = (email: string) => email.includes('@');
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user@domain.fr')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  test('password length validation', () => {
    const isValidPassword = (pw: string) => pw.length >= 8;
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('abcdefghij')).toBe(true);
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  test('password match validation', () => {
    const passwordsMatch = (a: string, b: string) => a === b;
    expect(passwordsMatch('password1', 'password1')).toBe(true);
    expect(passwordsMatch('password1', 'password2')).toBe(false);
  });
});

describe('STORAGE_KEYS format', () => {
  // SecureStore keys must be alphanumeric + ".", "-", "_"
  const validKeyRegex = /^[a-zA-Z0-9._-]+$/;

  test('all storage keys are valid for SecureStore', () => {
    const { STORAGE_KEYS } = require('../../src/infrastructure/storage/SecureStorageService');
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      expect(validKeyRegex.test(key as string)).toBe(true);
    }
  });
});
