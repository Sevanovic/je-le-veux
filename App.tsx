import 'react-native-get-random-values';
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initI18n } from './src/infrastructure/i18n';
import { authService } from './src/infrastructure';
import { secureStorage, STORAGE_KEYS } from './src/infrastructure';
import { useAuthStore } from './src/presentation/hooks';
import { RootNavigator } from './src/presentation/components/navigation/RootNavigator';
import { colors } from './src/presentation/theme';

// Empêche le splash screen natif de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

/**
 * Point d'entrée de l'application Je Le Veux.
 *
 * Séquence de démarrage :
 * 1. Initialiser i18n (détection langue téléphone ou choix sauvegardé)
 * 2. Restaurer la session Supabase si elle existe
 * 3. Restaurer l'état age/onboarding depuis SecureStore
 * 4. Masquer le splash screen natif
 * 5. Afficher la navigation
 */
export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { setUser, setAgeVerified, setOnboardingCompleted, setLoading } =
    useAuthStore();

  // Fonts
  const [fontsLoaded] = useFonts({});

  // Init i18n
  useEffect(() => {
    async function prepare() {
      try {
        await initI18n();
      } catch (e) {
        console.warn('i18n initialization error:', e);
      } finally {
        setI18nReady(true);
      }
    }
    prepare();
  }, []);

  // Restore auth session + local state
  useEffect(() => {
    async function restoreSession() {
      try {
        // Restaurer age/onboarding depuis SecureStore
        try {
          const ageVerified = await secureStorage.get(STORAGE_KEYS.AGE_VERIFIED);
          if (ageVerified === 'true') setAgeVerified(true);

          const onboardingDone = await secureStorage.get(STORAGE_KEYS.ONBOARDING_COMPLETED);
          if (onboardingDone === 'true') setOnboardingCompleted(true);
        } catch {
          // SecureStore peut échouer sur le web
        }

        // Restaurer la session Supabase
        const session = await authService.getSession();
        if (session?.user) {
          const profile = await authService.getProfile(session.user.id);
          if (profile) {
            setUser(profile);
          }
        }
      } catch {
        // Pas de session — l'utilisateur devra se connecter
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }

    restoreSession();

    // Écouter les changements d'auth (login, logout, token refresh)
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const typedSession = session as { user?: { id: string } };
          if (typedSession.user) {
            const profile = await authService.getProfile(typedSession.user.id);
            if (profile) setUser(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
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
