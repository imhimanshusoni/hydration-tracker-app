// Root app component.
// Conditional navigation: onboarding screen if not completed,
// bottom tab navigator (Home, Settings) otherwise.

import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useUserStore } from './src/store/useUserStore';
import { useWaterStore } from './src/store/useWaterStore';
import { scheduleReminders } from './src/utils/notificationScheduler';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function App() {
  const colorScheme = useColorScheme();
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
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
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
