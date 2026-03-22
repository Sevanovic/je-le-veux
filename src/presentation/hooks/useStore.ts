import { create } from 'zustand';
import { SupportedLanguage } from '../../domain/enums';
import { ConsentStatus } from '../../domain/enums';
import type { Consent } from '../../domain/entities';
import type { User } from '../../domain/entities';

// ══════════════════════════════════════════════
// AUTH STORE
// ══════════════════════════════════════════════
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAgeVerified: boolean;
  hasCompletedOnboarding: boolean;
  setUser: (user: User | null) => void;
  setAgeVerified: (verified: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAgeVerified: false,
  hasCompletedOnboarding: false,
  setUser: (user) =>
    set({ user, isAuthenticated: user !== null, isLoading: false }),
  setAgeVerified: (isAgeVerified) => set({ isAgeVerified }),
  setOnboardingCompleted: (hasCompletedOnboarding) =>
    set({ hasCompletedOnboarding }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isAgeVerified: false,
      hasCompletedOnboarding: false,
    }),
}));

// ══════════════════════════════════════════════
// CONSENT STORE
// ══════════════════════════════════════════════
interface ConsentState {
  consents: Consent[];
  activeConsents: Consent[];
  isLoading: boolean;
  setConsents: (consents: Consent[]) => void;
  addConsent: (consent: Consent) => void;
  updateConsent: (id: string, updates: Partial<Consent>) => void;
  removeConsent: (id: string) => void;
  setLoading: (loading: boolean) => void;
  getByStatus: (status: ConsentStatus) => Consent[];
}

export const useConsentStore = create<ConsentState>((set, get) => ({
  consents: [],
  activeConsents: [],
  isLoading: false,
  setConsents: (consents) =>
    set({
      consents,
      activeConsents: consents.filter(
        (c) => c.status === ConsentStatus.ACTIVE,
      ),
    }),
  addConsent: (consent) =>
    set((state) => {
      const consents = [consent, ...state.consents];
      return {
        consents,
        activeConsents: consents.filter(
          (c) => c.status === ConsentStatus.ACTIVE,
        ),
      };
    }),
  updateConsent: (id, updates) =>
    set((state) => {
      const consents = state.consents.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      );
      return {
        consents,
        activeConsents: consents.filter(
          (c) => c.status === ConsentStatus.ACTIVE,
        ),
      };
    }),
  removeConsent: (id) =>
    set((state) => {
      const consents = state.consents.filter((c) => c.id !== id);
      return {
        consents,
        activeConsents: consents.filter(
          (c) => c.status === ConsentStatus.ACTIVE,
        ),
      };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  getByStatus: (status) => get().consents.filter((c) => c.status === status),
}));

// ══════════════════════════════════════════════
// SETTINGS STORE
// ══════════════════════════════════════════════
type ThemeMode = 'dark' | 'light' | 'system';

interface SettingsState {
  language: SupportedLanguage;
  themeMode: ThemeMode;
  biometricsEnabled: boolean;
  notificationsEnabled: boolean;
  setLanguage: (language: SupportedLanguage) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setBiometrics: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: SupportedLanguage.FRENCH,
  themeMode: 'dark',
  biometricsEnabled: false,
  notificationsEnabled: true,
  setLanguage: (language) => set({ language }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setBiometrics: (biometricsEnabled) => set({ biometricsEnabled }),
  setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
}));
