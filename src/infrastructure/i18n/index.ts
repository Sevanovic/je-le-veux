import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportedLanguage,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
} from '../../domain/enums';
import fr from './locales/fr.json';
import en from './locales/en.json';

const LANGUAGE_STORAGE_KEY = 'jeleveux.language';

/**
 * Détecte la langue à utiliser :
 * 1. Langue sauvegardée par l'utilisateur (choix manuel dans le profil)
 * 2. Langue du téléphone (expo-localization)
 * 3. Français par défaut
 */
async function detectLanguage(): Promise<SupportedLanguage> {
  try {
    // 1. Choix utilisateur persisté
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) {
      return stored;
    }

    // 2. Langue du téléphone
    const deviceLocales = Localization.getLocales();
    if (deviceLocales.length > 0) {
      const deviceLang = deviceLocales[0]?.languageCode;
      if (deviceLang && isSupportedLanguage(deviceLang)) {
        return deviceLang;
      }
    }
  } catch {
    // Fallback silencieux
  }

  // 3. Défaut
  return DEFAULT_LANGUAGE;
}

/**
 * Change la langue de l'application et persiste le choix.
 * Appelé depuis le sélecteur de langue du profil.
 */
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

/**
 * Retourne la langue actuellement active.
 */
export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.language;
  return isSupportedLanguage(current) ? current : DEFAULT_LANGUAGE;
}

/**
 * Initialise i18next avec les ressources FR/EN.
 * Doit être appelé une seule fois au démarrage de l'app.
 */
export async function initI18n(): Promise<void> {
  const detectedLang = await detectLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: detectedLang,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React Native gère l'échappement
    },
    react: {
      useSuspense: false, // Évite les problèmes avec React Native
    },
    // Pas de backend — toutes les traductions sont bundlées
    // Cela garantit un fonctionnement offline
  });
}

export default i18n;
