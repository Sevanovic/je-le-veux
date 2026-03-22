import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../../hooks';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { colors } from '../../theme';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navigateur racine.
 * Redirige vers Auth ou Main selon l'état d'authentification.
 *
 * Sprint 1 : auth complète via Supabase.
 * Condition : age vérifié + onboarding terminé + authentifié.
 */
export function RootNavigator() {
  const { isAuthenticated, isAgeVerified, hasCompletedOnboarding } =
    useAuthStore();

  const showMain = isAuthenticated && isAgeVerified && hasCompletedOnboarding;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
      }}
    >
      {showMain ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
