// ⚠️ This polyfill MUST be the very first import.
// Provides crypto.getRandomValues() required by TweetNaCl (E2E encryption).
import 'react-native-get-random-values';

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Infrastructure — imported ONLY here for DI container wiring
import { initI18n } from './src/infrastructure/i18n';
import { authService } from './src/infrastructure/auth/AuthService';
import { cryptoService } from './src/infrastructure/crypto/CryptoService';
import { secureStorage } from './src/infrastructure/storage/SecureStorageService';
import { biometricService } from './src/infrastructure/biometrics/BiometricService';
import { consentRepository } from './src/infrastructure/repositories/ConsentRepository';
import { invitationRepository } from './src/infrastructure/repositories/InvitationRepository';

// Application layer
import {
  initContainer,
  restoreSessionUseCase,
  loadUserConsentsUseCase,
  checkBiometricLockUseCase,
} from './src/application';

// Presentation layer
import { useAuthStore, useConsentStore } from './src/presentation/hooks';
import { RootNavigator } from './src/presentation/components/navigation/RootNavigator';
import { BiometricLockScreen } from './src/presentation/screens/BiometricLock';
import { colors } from './src/presentation/theme';

// Prevent native splash screen from hiding automatically
SplashScreen.preventAutoHideAsync();

/**
 * Application entry point — Je Le Veux.
 *
 * Startup sequence:
 * 1. Wire DI container (infrastructure → application)
 * 2. Initialize i18n (detect phone language or saved preference)
 * 3. Restore session via restoreSessionUseCase
 * 4. Listen for auth state changes
 * 5. Hide native splash screen
 * 6. Render navigation
 *
 * This is the ONLY file that imports from Infrastructure directly.
 * All other Presentation files go through the Application layer.
 */
export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const { setUser, setAgeVerified, setOnboardingCompleted, setLoading } =
    useAuthStore();

  const [fontsLoaded] = useFonts({});

  // 1. Wire DI container on first render
  useEffect(() => {
    initContainer({
      auth: authService,
      crypto: cryptoService,
      secureStorage: secureStorage,
      consent: consentRepository,
      invitation: invitationRepository,
      biometric: biometricService,
    });
  }, []);

  // 2. Initialize i18n
  useEffect(() => {
    async function prepare() {
      try {
        await initI18n();
      } catch (e) {
        console.warn('[i18n] Initialization error:', e);
      } finally {
        setI18nReady(true);
      }
    }
    prepare();
  }, []);

  // 3. Restore session via use case + listen for auth changes
  useEffect(() => {
    async function restore() {
      try {
        const result = await restoreSessionUseCase();

        if (result.isAgeVerified) setAgeVerified(true);
        if (result.hasCompletedOnboarding) setOnboardingCompleted(true);
        if (result.user) {
          setUser(result.user);
          // Hydrate consents from Supabase so they survive JS reload / app restart
          try {
            const { consents } = await loadUserConsentsUseCase({ userId: result.user.id });
            useConsentStore.getState().setConsents(consents);
          } catch (e) {
            console.warn('[consents] Initial load failed:', e);
          }
        }
      } catch {
        // No session — user needs to sign in
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }

    restore();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const subscription = authService.onAuthStateChange(
      async (event, userId) => {
        if (event === 'SIGNED_IN' && userId) {
          const profile = await authService.getProfile(userId);
          if (profile) {
            setUser(profile);
            try {
              const { consents } = await loadUserConsentsUseCase({ userId: profile.id });
              useConsentStore.getState().setConsents(consents);
            } catch (e) {
              console.warn('[consents] Load on sign-in failed:', e);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          useConsentStore.getState().setConsents([]);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 4. Realtime: subscribe to consent changes for the authenticated user.
  // Re-subscribes whenever the auth user changes (sign-in / sign-out).
  useEffect(() => {
    let currentSubscription: { unsubscribe: () => void } | null = null;

    const subscribe = (userId: string) => {
      currentSubscription?.unsubscribe();
      currentSubscription = consentRepository.subscribeToUserConsents(
        userId,
        (updated) => {
          const store = useConsentStore.getState();
          const existing = store.consents.find((c) => c.id === updated.id);
          if (existing) {
            store.updateConsent(updated.id, updated);
          } else {
            store.addConsent(updated);
          }
        },
      );
    };

    const initialUser = useAuthStore.getState().user;
    if (initialUser) {
      subscribe(initialUser.id);
    }

    const unsubAuth = useAuthStore.subscribe((state, prevState) => {
      const user = state.user;
      const prevUser = prevState.user;

      if (prevUser && !user) {
        currentSubscription?.unsubscribe();
        currentSubscription = null;
      }
      if (user && user.id !== prevUser?.id) {
        subscribe(user.id);
      }
    });

    return () => {
      unsubAuth();
      currentSubscription?.unsubscribe();
    };
  }, []);

  // 5. Biometric lock at startup + on foreground after >5min idle.
  useEffect(() => {
    const FIVE_MIN_MS = 5 * 60 * 1000;
    let lastBackgroundedAt: number | null = null;

    const runCheck = async () => {
      try {
        const result = await checkBiometricLockUseCase();
        setIsLocked(result.locked);
      } catch {
        setIsLocked(false);
      } finally {
        setBiometricChecked(true);
      }
    };

    // Initial check (cold start)
    void runCheck();

    // Foreground after >5min idle
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt = Date.now();
        return;
      }
      if (next === 'active' && lastBackgroundedAt !== null) {
        const idle = Date.now() - lastBackgroundedAt;
        lastBackgroundedAt = null;
        if (idle >= FIVE_MIN_MS) {
          void runCheck();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const isReady = i18nReady && authChecked && biometricChecked;

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root} onLayout={onLayoutRootView}>
          {isLocked ? (
            <BiometricLockScreen onUnlock={() => setIsLocked(false)} />
          ) : (
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});
