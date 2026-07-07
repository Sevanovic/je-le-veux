import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../../hooks';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ContentScreen } from '../../screens/Content';
import type { ContentKey } from '../../content';
import { colors } from '../../theme';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Content: { contentKey: ContentKey };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navigateur racine.
 * - Auth ou Main selon l'état d'authentification.
 * - Content présenté en modal au-dessus, accessible depuis n'importe quel
 *   sous-stack via navigation.navigate('Content', { contentKey: ... }).
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
      <Stack.Screen
        name="Content"
        component={ContentScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
