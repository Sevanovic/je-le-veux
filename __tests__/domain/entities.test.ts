import {
  generateSecureCode,
  isConsentActive,
  isWithdrawable,
  remainingMinutes,
  isValidPseudonym,
} from '../../src/domain/entities';
import { ConsentStatus, ConsentLevel } from '../../src/domain/enums';
import type { Consent } from '../../src/domain/entities';

// ── Helper ──
function makeConsent(overrides: Partial<Consent> = {}): Consent {
  return {
    id: 'test-id',
    secureCode: 'JLV-2026-ABCD-1234',
    initiatorId: 'user-1',
    initiatorPseudonym: 'TestUser',
    encryptedStatement: 'encrypted-data',
    level: ConsentLevel.MODERATE,
    status: ConsentStatus.ACTIVE,
    durationMinutes: 360,
    createdAt: new Date(),
    acceptedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000), // +1h
    ...overrides,
  };
}

describe('generateSecureCode', () => {
  test('matches format JLV-YYYY-XXXX-XXXX', () => {
    const code = generateSecureCode();
    expect(code).toMatch(/^JLV-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  test('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, generateSecureCode));
    expect(codes.size).toBe(100);
  });
});

describe('isConsentActive', () => {
  test('returns true for active consent with future expiry', () => {
    expect(isConsentActive(makeConsent())).toBe(true);
  });

  test('returns false for expired consent', () => {
    expect(
      isConsentActive(
        makeConsent({ expiresAt: new Date(Date.now() - 1000) }),
      ),
    ).toBe(false);
  });

  test('returns false for withdrawn consent', () => {
    expect(
      isConsentActive(makeConsent({ status: ConsentStatus.WITHDRAWN })),
    ).toBe(false);
  });
});

describe('isWithdrawable', () => {
  test('returns true for active consent', () => {
    expect(isWithdrawable(makeConsent())).toBe(true);
  });

  test('returns false for already withdrawn consent', () => {
    expect(
      isWithdrawable(makeConsent({ status: ConsentStatus.WITHDRAWN })),
    ).toBe(false);
  });
});

describe('remainingMinutes', () => {
  test('returns positive minutes for future expiry', () => {
    const consent = makeConsent({
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    const remaining = remainingMinutes(consent);
    expect(remaining).toBeGreaterThanOrEqual(29);
    expect(remaining).toBeLessThanOrEqual(30);
  });

  test('returns 0 for past expiry', () => {
    expect(
      remainingMinutes(makeConsent({ expiresAt: new Date(Date.now() - 1000) })),
    ).toBe(0);
  });
});

describe('isValidPseudonym', () => {
  test('accepts valid pseudonyms', () => {
    expect(isValidPseudonym('Coeur_Vaillant')).toBe(true);
    expect(isValidPseudonym('user-123')).toBe(true);
    expect(isValidPseudonym('Étoile')).toBe(true);
    expect(isValidPseudonym('abc')).toBe(true);
  });

  test('rejects invalid pseudonyms', () => {
    expect(isValidPseudonym('ab')).toBe(false); // too short
    expect(isValidPseudonym('a'.repeat(31))).toBe(false); // too long
    expect(isValidPseudonym('has spaces')).toBe(false);
    expect(isValidPseudonym('special@char')).toBe(false);
  });
});
