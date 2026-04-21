// Root app component.
// Conditional navigation: onboarding screen if not completed,
// bottom tab navigator (Home, Settings) otherwise.

import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useUserStore } from './src/store/useUserStore';
import { useWaterStore } from './src/store/useWaterStore';
import { useGoalStore } from './src/store/useGoalStore';
import { scheduleReminders } from './src/utils/notificationScheduler';
import { HomeIcon, SettingsIcon } from './src/components/TabIcons';
import { Fonts } from './src/fonts';
import {
  initAnalytics,
  initAnalyticsForBackground,
  onNavigationStateChange,
  track,
} from './src/services/analytics';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B9FE3',
        tabBarInactiveTintColor: '#7A8BA8',
        tabBarStyle: {
          backgroundColor: '#060B18',
          borderTopColor: '#1B2D45',
          borderTopWidth: 1,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Fonts.semiBold,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function parseReminderHour(data: unknown): number {
  if (!data || typeof data !== 'object') return -1;
  const h = (data as Record<string, unknown>).hour;
  const n = typeof h === 'string' ? parseInt(h, 10) : typeof h === 'number' ? h : NaN;
  return Number.isFinite(n) ? n : -1;
}

function App() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.DELIVERED) {
        await initAnalyticsForBackground();
        const consumed = useWaterStore.getState().consumed;
        const goal = useGoalStore.getState().effectiveGoal;
        const scheduledHour = parseReminderHour(detail.notification?.data);
        track('Reminder Delivered', {
          scheduled_hour: scheduledHour,
          consumed_ml: consumed,
          goal_ml: goal,
        });
      } else if (type === EventType.PRESS) {
        await initAnalyticsForBackground();
        const scheduledHour = parseReminderHour(detail.notification?.data);
        track('Reminder Tapped', { scheduled_hour: scheduledHour });
      }
    });
    return unsubscribe;
  }, []);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundStartRef = useRef<number | null>(null);
  const foregroundStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      const now = Date.now();
      if (prev.match(/inactive|background/) && next === 'active') {
        const bgSec = backgroundStartRef.current
          ? Math.round((now - backgroundStartRef.current) / 1000)
          : 0;
        foregroundStartRef.current = now;
        track('App Foregrounded', { background_duration_sec: bgSec });
      } else if (next.match(/inactive|background/) && prev === 'active') {
        const fgSec = Math.round((now - foregroundStartRef.current) / 1000);
        backgroundStartRef.current = now;
        track('App Backgrounded', { foreground_duration_sec: fgSec });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
      useGoalStore.getState().recalculateMorningGoal().then(() => {
        const { effectiveGoal } = useGoalStore.getState();
        scheduleReminders(wakeUpTime, sleepTime, consumed, effectiveGoal, remindersEnabled);
      });
    }
  }, [onboardingComplete]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#060B18" />
      {onboardingComplete ? (
        <NavigationContainer onStateChange={onNavigationStateChange}>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <OnboardingScreen />
      )}
    </SafeAreaProvider>
  );
}

export default App;
