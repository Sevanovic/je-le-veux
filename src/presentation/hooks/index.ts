export { useAuthStore, useConsentStore, useSettingsStore } from './useStore';

/**
 * Re-export useTranslation pour un import uniforme.
 * Usage : import { useAppTranslation } from '@presentation/hooks';
 *
 * Le hook retourne { t, i18n } comme react-i18next,
 * mais on peut y ajouter de la logique custom si nécessaire.
 */
export { useTranslation as useAppTranslation } from 'react-i18next';
