import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../../screens/Splash/SplashScreen';
import { AgeVerificationScreen } from '../../screens/AgeVerification/AgeVerificationScreen';
import { OnboardingScreen } from '../../screens/Onboarding/OnboardingScreen';
import { AuthScreen } from '../../screens/Auth/AuthScreen';
import { SetupProfileScreen } from '../../screens/Auth/SetupProfileScreen';
import { colors } from '../../theme';

export type AuthStackParamList = {
  Splash: undefined;
  AgeVerification: undefined;
  Onboarding: undefined;
  Login: undefined;
  SetupProfile: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Navigateur d'authentification.
 * Parcours : Splash → Vérification d'âge → Onboarding → Login → (SetupProfile)
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={AuthScreen} />
      <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
    </Stack.Navigator>
  );
}
