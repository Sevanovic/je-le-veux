// ⚠️ This polyfill MUST be the very first import.
// Provides crypto.getRandomValues() required by TweetNaCl (E2E encryption).
import 'react-native-get-random-values';

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { consentRepository } from './src/infrastructure/repositories/ConsentRepository';
import { invitationRepository } from './src/infrastructure/repositories/InvitationRepository';

// Application layer
import { initContainer, restoreSessionUseCase } from './src/application';

// Presentation layer
import { useAuthStore, useConsentStore } from './src/presentation/hooks';
import { RootNavigator } from './src/presentation/components/navigation/RootNavigator';
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
        if (result.user) setUser(result.user);
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
          if (profile) setUser(profile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
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

  const isReady = i18nReady && authChecked;

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
        <NavigationContainer>
          <View style={styles.root} onLayout={onLayoutRootView}>
            <RootNavigator />
          </View>
        </NavigationContainer>
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
