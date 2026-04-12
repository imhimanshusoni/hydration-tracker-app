# Water Reminder

A smart hydration tracking app for Android and iOS that adapts your daily water goal based on weather, activity, and personal profile.

## Features

- **Smart daily goal** — calculates your target based on weight, age, gender, activity level, and real-time weather data via OpenWeatherMap
- **Intra-day activity adjustments** — integrates with Apple HealthKit (iOS) and Health Connect (Android) to bump your goal when you exercise
- **Streak tracking** — tracks consecutive days you've met your goal with a live counter that updates the moment you hit 100%
- **7-day history chart** — rolling bar chart showing your hydration pattern over the past week
- **Hourly reminders** — smart notifications between your wake-up and sleep times, reflecting current progress
- **Dark-mode UI** — premium design with a deep navy base, cerulean water accents, and warm amber highlights

## Tech Stack

- React Native 0.85 / React 19
- Zustand v5 (state management)
- MMKV (encrypted persistence)
- react-native-svg (progress ring, charts)
- Notifee (notifications)
- react-native-health / react-native-health-connect (health data)
- OpenWeatherMap API (weather-based goal adjustment)

## Getting Started

### Prerequisites

- Node.js >= 22.11
- React Native CLI environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- Xcode (iOS) / Android Studio (Android)

### Install

```sh
npm install
```

### iOS

```sh
bundle install
bundle exec pod install
npm run ios
```

### Android

```sh
npm run android
```

### Environment

Create a `.env` file in the project root:

```
OPENWEATHERMAP_API_KEY=your_api_key_here
```

## Project Structure

```
src/
  components/     UI components (WaterProgressBar, WeatherCard, StreakCounter, WeeklyChart, etc.)
  screens/        HomeScreen, SettingsScreen, OnboardingScreen
  store/          Zustand stores (useWaterStore, useGoalStore, useHistoryStore, useUserStore)
  utils/          waterCalculator, weatherService, healthService, notificationScheduler
  types/          Shared TypeScript interfaces
  theme.ts        Design system tokens
  fonts.ts        Poppins font family mappings
  config.ts       App constants
```

## Testing

```sh
npm test
```

## Version

1.2.0
