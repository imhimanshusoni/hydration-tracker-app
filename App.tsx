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
import { useGoalStore } from './src/store/useGoalStore';
import { scheduleReminders } from './src/utils/notificationScheduler';
import { HomeIcon, SettingsIcon } from './src/components/TabIcons';
import { Fonts } from './src/fonts';

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

function App() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  // Schedule initial notifications and recalculate smart goal on app start
  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
      // Recalculate smart goal for today (weather + activity)
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
