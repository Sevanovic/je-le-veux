import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../components/navigation/AuthNavigator';
import { useAuthStore } from '../../hooks';
import { secureStorage, STORAGE_KEYS } from '../../../infrastructure';
import { Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideData {
  key: string;
  titleKey: string;
  descriptionKey: string;
  emoji: string;
}

const SLIDES: SlideData[] = [
  {
    key: '1',
    titleKey: 'onboarding.step1Title',
    descriptionKey: 'onboarding.step1Description',
    emoji: '\u{1F91D}', // 🤝
  },
  {
    key: '2',
    titleKey: 'onboarding.step2Title',
    descriptionKey: 'onboarding.step2Description',
    emoji: '\u{1F512}', // 🔒
  },
  {
    key: '3',
    titleKey: 'onboarding.step3Title',
    descriptionKey: 'onboarding.step3Description',
    emoji: '\u{2696}', // ⚖
  },
];

type OnboardingNav = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;

/**
 * Écran d'onboarding — 3 étapes éducatives sur le consentement.
 * Swipable horizontalement avec indicateurs de pagination.
 * Entièrement bilingue FR/EN.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<OnboardingNav>();
  const { setOnboardingCompleted } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleComplete = async () => {
    try {
      await secureStorage.save(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    } catch {
      // SecureStore peut échouer sur le web — pas bloquant
    }
    setOnboardingCompleted(true);
    navigation.navigate('Login');
  };

  const handleNext = () => {
    if (isLastSlide) {
      handleComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item }: { item: SlideData }) => (
    <View style={styles.slide}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.slideDescription}>{t(item.descriptionKey)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Skip button */}
      {!isLastSlide && (
        <View style={styles.skipContainer}>
          <Button
            title={t('onboarding.skip')}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={handleSkip}
            testID="onboarding-skip-btn"
          />
        </View>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Action button */}
      <View style={styles.buttonContainer}>
        <Button
          title={isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')}
          onPress={handleNext}
          testID="onboarding-next-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  skipContainer: {
    position: 'absolute',
    top: spacing['6xl'],
    right: spacing['2xl'],
    zIndex: 10,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing['3xl'],
  },
  slideTitle: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  slideDescription: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing['3xl'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  dotActive: {
    backgroundColor: colors.gold.DEFAULT,
    width: 24,
  },
  dotInactive: {
    backgroundColor: colors.text.muted,
  },
  buttonContainer: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['5xl'],
  },
});
