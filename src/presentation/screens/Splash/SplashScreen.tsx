import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../components/navigation/AuthNavigator';
import { Button } from '../../components';
import { colors, typography, spacing } from '../../theme';

type SplashNav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

/**
 * Écran Splash — premier écran de l'application.
 * Logo animé (deux cœurs entrelacés), nom de l'app, bouton d'entrée.
 * Tous les textes passent par i18n.
 */
export function SplashScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<SplashNav>();

  // Animations
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(16);
  const subtitleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const heartPulse = useSharedValue(1);

  useEffect(() => {
    // Séquence d'animation d'entrée
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    logoScale.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) }),
    );
    titleOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    subtitleOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    buttonOpacity.value = withDelay(1200, withTiming(1, { duration: 500 }));

    // Pulsation continue des cœurs
    heartPulse.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value * heartPulse.value },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Logo — deux cœurs entrelacés */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Text style={styles.heartSilver}>{'\u2665'}</Text>
        <Text style={styles.heartGold}>{'\u2665'}</Text>
      </Animated.View>

      {/* Titre */}
      <Animated.View style={titleStyle}>
        <Text style={styles.title}>{t('common.appName')}</Text>
      </Animated.View>

      {/* Sous-titre */}
      <Animated.View style={subtitleStyle}>
        <Text style={styles.subtitle}>{t('splash.subtitle')}</Text>
      </Animated.View>

      {/* Bouton d'entrée */}
      <Animated.View style={[styles.buttonContainer, buttonStyle]}>
        <Button
          title={t('splash.enter')}
          onPress={() => navigation.navigate('AgeVerification')}
          testID="splash-enter-btn"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  heartSilver: {
    fontSize: 56,
    color: colors.silver.DEFAULT,
    marginRight: -12,
  },
  heartGold: {
    fontSize: 56,
    color: colors.gold.DEFAULT,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize['3xl'],
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    marginTop: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
  },
});
