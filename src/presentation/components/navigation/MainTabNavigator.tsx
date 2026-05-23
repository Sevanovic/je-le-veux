import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../../screens/Home/HomeScreen';
import { CreateConsentScreen } from '../../screens/CreateConsent/CreateConsentScreen';
import { HistoryScreen } from '../../screens/History/HistoryScreen';
import { ResourcesScreen } from '../../screens/Resources/ResourcesScreen';
import { ProfileScreen } from '../../screens/Profile/ProfileScreen';
import { ConfirmationScreen } from '../../screens/Confirmation/ConfirmationScreen';
import { InvitationReceivedScreen } from '../../screens/InvitationReceived/InvitationReceivedScreen';
import { JoinInvitationScreen } from '../../screens/JoinInvitation';
import type { Consent, Invitation } from '../../../domain/entities';
import { colors, typography, spacing, borderRadius } from '../../theme';

// ── Types ──
export type MainTabParamList = {
  HomeTab: undefined;
  CreateTab: undefined;
  HistoryTab: undefined;
  ResourcesTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  JoinInvitation: undefined;
  InvitationReceived: {
    consent: Consent;
    invitation: Invitation;
    decryptedStatement: string;
    decryptedConditions?: string;
  };
  Confirmation: { consentId: string };
  Profile: undefined;
};

// ── Stack navigators inside tabs ──
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="JoinInvitation" component={JoinInvitationScreen} />
      <HomeStack.Screen name="Confirmation" component={ConfirmationScreen} />
      <HomeStack.Screen
        name="InvitationReceived"
        component={InvitationReceivedScreen}
      />
      <HomeStack.Screen name="Profile" component={ProfileScreen} />
    </HomeStack.Navigator>
  );
}

// ── Tab icons (SVG-free, using simple text shapes) ──
interface TabIconProps {
  focused: boolean;
  label: string;
}

function TabIcon({ focused, label }: TabIconProps) {
  const icons: Record<string, string> = {
    home: '\u2302',
    create: '\u271A',
    history: '\u29D6',
    resources: '\u2139',
  };

  return (
    <View style={tabStyles.iconContainer}>
      <Text
        style={[
          tabStyles.icon,
          { color: focused ? colors.gold.DEFAULT : colors.text.muted },
        ]}
      >
        {icons[label] ?? '\u25CF'}
      </Text>
    </View>
  );
}

// ── Tab navigator ──
const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarActiveTintColor: colors.gold.DEFAULT,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: tabStyles.label,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: t('navigation.home'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="home" />
          ),
        }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateConsentScreen}
        options={{
          tabBarLabel: t('navigation.create'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="create" />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: t('navigation.history'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="history" />
          ),
        }}
      />
      <Tab.Screen
        name="ResourcesTab"
        component={ResourcesScreen}
        options={{
          tabBarLabel: t('navigation.resources'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="resources" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    height: 80,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: 10,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  icon: {
    fontSize: 20,
  },
});
