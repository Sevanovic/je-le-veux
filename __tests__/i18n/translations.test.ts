import fr from '../../src/infrastructure/i18n/locales/fr.json';
import en from '../../src/infrastructure/i18n/locales/en.json';

/**
 * Test critique : vérifie que les fichiers de traduction FR et EN
 * ont exactement les mêmes clés. Aucune clé manquante tolérée.
 *
 * Ce test empêche les régressions i18n lors de l'ajout de nouvelles
 * fonctionnalités : si un développeur ajoute une clé en FR mais oublie
 * l'EN (ou inversement), le test échoue.
 */

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n translation files', () => {
  const frKeys = getAllKeys(fr);
  const enKeys = getAllKeys(en);

  test('FR and EN have the same number of keys', () => {
    expect(frKeys.length).toBe(enKeys.length);
  });

  test('every FR key exists in EN', () => {
    const missingInEN = frKeys.filter((key) => !enKeys.includes(key));
    if (missingInEN.length > 0) {
      fail(`Keys present in FR but missing in EN:\n${missingInEN.join('\n')}`);
    }
  });

  test('every EN key exists in FR', () => {
    const missingInFR = enKeys.filter((key) => !frKeys.includes(key));
    if (missingInFR.length > 0) {
      fail(`Keys present in EN but missing in FR:\n${missingInFR.join('\n')}`);
    }
  });

  test('no empty values in FR', () => {
    const emptyKeys = frKeys.filter((key) => {
      const parts = key.split('.');
      let current: unknown = fr;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      return typeof current === 'string' && current.trim() === '';
    });
    if (emptyKeys.length > 0) {
      fail(`Empty values in FR:\n${emptyKeys.join('\n')}`);
    }
  });

  test('no empty values in EN', () => {
    const emptyKeys = enKeys.filter((key) => {
      const parts = key.split('.');
      let current: unknown = en;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      return typeof current === 'string' && current.trim() === '';
    });
    if (emptyKeys.length > 0) {
      fail(`Empty values in EN:\n${emptyKeys.join('\n')}`);
    }
  });

  test('interpolation variables match between FR and EN', () => {
    const interpolationRegex = /\{\{(\w+)\}\}/g;
    const mismatches: string[] = [];

    for (const key of frKeys) {
      const parts = key.split('.');
      let frValue: unknown = fr;
      let enValue: unknown = en;
      for (const part of parts) {
        frValue = (frValue as Record<string, unknown>)?.[part];
        enValue = (enValue as Record<string, unknown>)?.[part];
      }

      if (typeof frValue === 'string' && typeof enValue === 'string') {
        const frVars = [...frValue.matchAll(interpolationRegex)]
          .map((m) => m[1])
          .sort();
        const enVars = [...enValue.matchAll(interpolationRegex)]
          .map((m) => m[1])
          .sort();

        if (JSON.stringify(frVars) !== JSON.stringify(enVars)) {
          mismatches.push(
            `${key}: FR has {{${frVars.join(', ')}}} but EN has {{${enVars.join(', ')}}}`,
          );
        }
      }
    }

    if (mismatches.length > 0) {
      fail(
        `Interpolation variable mismatches:\n${mismatches.join('\n')}`,
      );
    }
  });
});
