import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConsentStatus } from '../../../domain/enums';
import type { Consent } from '../../../domain/entities';
import { useConsentStore } from '../../hooks';
import { ScreenWrapper, Chip, ConsentCard } from '../../components';
import type { HistoryStackParamList } from '../../components/navigation/MainTabNavigator';
import { colors, typography, spacing } from '../../theme';

type FilterTab = 'all' | ConsentStatus.ACTIVE | ConsentStatus.EXPIRED | ConsentStatus.WITHDRAWN;
type Nav = NativeStackNavigationProp<HistoryStackParamList, 'History'>;

export function HistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { consents, getByStatus } = useConsentStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filters: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: t('history.all') },
    { key: ConsentStatus.ACTIVE, label: t('history.active') },
    { key: ConsentStatus.EXPIRED, label: t('history.expired') },
    { key: ConsentStatus.WITHDRAWN, label: t('history.withdrawn') },
  ];

  const filteredConsents =
    activeFilter === 'all' ? consents : getByStatus(activeFilter as ConsentStatus);

  const handlePress = (consent: Consent) => {
    navigation.navigate('ConsentDetail', { consentId: consent.id });
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('history.title')}</Text>
      </View>

      <View style={styles.filters}>
        {filters.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            selected={activeFilter === key}
            onPress={() => setActiveFilter(key)}
          />
        ))}
      </View>

      <FlatList
        data={filteredConsents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConsentCard consent={item} onPress={handlePress} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('history.noHistory')}</Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.displayBold,
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  list: {
    gap: spacing.sm + 2,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing['6xl'],
  },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
  },
});
