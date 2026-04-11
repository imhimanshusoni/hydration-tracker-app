// Root app component.
// Conditional navigation: onboarding screen if not completed,
// bottom tab navigator (Home, Settings) otherwise.

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useUserStore } from './src/store/useUserStore';
import { useWaterStore } from './src/store/useWaterStore';
import { scheduleReminders } from './src/utils/notificationScheduler';
import { HomeIcon, SettingsIcon } from './src/components/TabIcons';
import { Fonts } from './src/fonts';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00C9B8',
        tabBarInactiveTintColor: '#8899BB',
        tabBarStyle: {
          backgroundColor: '#0A0F1E',
          borderTopColor: '#1A2A4A',
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

function App() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  // Schedule initial notifications on app start (if onboarded)
  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, dailyGoal, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
      scheduleReminders(wakeUpTime, sleepTime, consumed, dailyGoal, remindersEnabled);
    }
  }, [onboardingComplete]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />
      {onboardingComplete ? (
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <OnboardingScreen />
      )}
    </SafeAreaProvider>
  );
}

export default App;
