# Water Reminder

A smart hydration tracking app for Android and iOS that adapts your daily water goal based on weather, activity, and personal profile.

## Screenshots

<!-- Add screenshots here -->

## Features

### Smart Hydration Engine
- **Personalized daily goal** — calculates your target from weight, age, gender, and activity level using a multi-factor formula
- **Weather-aware adjustments** — fetches real-time weather via OpenWeatherMap and increases your goal in hot/humid conditions
- **Activity-based bumps** — integrates with Apple HealthKit (iOS) and Health Connect (Android) to add hydration when you exercise (+25ml per 10 active minutes)
- **Climate fallback** — when weather data is unavailable, uses your climate preference (cold/temperate/hot/tropical) to estimate adjustments

### Tracking & Logging
- **Quick-log buttons** — tap 150ml, 250ml, or 500ml to log instantly
- **Custom amount** — enter any amount from 50–1000ml
- **Undo** — 5-second undo toast after every log
- **Midnight auto-reset** — consumption resets to zero at midnight, previous day is archived

### Progress & Engagement
- **Circular progress ring** — hero UI element with water-fill effect that rises as you drink
- **Goal celebration** — subtle double-pulse amber ripple animation when you hit your daily goal for the first time
- **Streak counter** — tracks consecutive days you've met your goal, updates live
- **7-day history chart** — rolling bar chart showing consumption vs goal for the past week
- **Motivational copy** — contextual messages that change with your progress level

### Notifications
- **Hourly reminders** — scheduled between your wake-up and sleep times
- **Live progress in notifications** — each reminder shows current consumption vs goal
- **Reschedules on every log** — notification messages always reflect current intake

### Design
- **Premium dark mode** — deep navy base (`#060B18`) with cerulean blue and warm amber accents
- **Poppins typography** — 6 weights from Thin (hero numbers) to Bold (titles)
- **Custom SVG tab icons** — water drop and gear icons matching the theme
- **System-aware status bar** — always light content on dark background

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.85 / React 19 |
| Language | TypeScript (strict mode) |
| State | Zustand v5 with persist middleware |
| Storage | react-native-mmkv (MMKV) |
| Navigation | React Navigation v7 (bottom tabs) |
| Notifications | Notifee |
| Graphics | react-native-svg |
| Health (iOS) | @kingstinct/react-native-healthkit |
| Health (Android) | react-native-health-connect |
| Weather | OpenWeatherMap API |
| Typography | Poppins (bundled) |

## Getting Started

### Prerequisites

- Node.js >= 22.11
- React Native CLI environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- Xcode 15+ (iOS) / Android Studio (Android)
- CocoaPods (iOS)

### Install

```sh
git clone https://github.com/imhimanshusoni/hydration-tracker-app.git
cd hydration-tracker-app
npm install
```

### Environment

Create a `.env` file in the project root:

```
OPENWEATHERMAP_API_KEY=your_api_key_here
```

Get a free API key at [openweathermap.org](https://openweathermap.org/api).

### iOS

```sh
cd ios && pod install && cd ..
npm run ios
```

### Android

```sh
npm run android
```

To build a release AAB for Play Store:

```sh
npm run android:release
```

The AAB will be at `android/app/build/outputs/bundle/release/app-release.aab`.

**Prerequisites:** `android/keystore.properties` must exist (gitignored) with the release keystore credentials. See `docs/RELEASING.md` for one-time setup. Without it, the `release` buildType falls back to debug signing — fine for local testing, rejected by Play Store.

## Project Structure

```
src/
  screens/
    OnboardingScreen.tsx    First-run setup (name, weight, age, schedule)
    HomeScreen.tsx          Main screen (ring, logging, chart, streak)
    SettingsScreen.tsx      Profile editing, reminders, health connect
  components/
    WaterProgressBar.tsx    Circular progress ring with water-fill + celebration
    LogWaterModal.tsx       Bottom-sheet modal for logging water
    WeatherCard.tsx         Live weather conditions card
    WeeklyChart.tsx         7-day consumption bar chart
    StreakCounter.tsx        Consecutive goal-met day counter
    TabIcons.tsx            Custom SVG tab bar icons
    WeatherIcons.tsx        Weather condition SVG icon map
  store/
    useWaterStore.ts        Daily consumption, logging, undo, midnight reset
    useUserStore.ts         Profile, schedule, preferences
    useGoalStore.ts         Smart goal calculation (base + weather + activity)
    useHistoryStore.ts      30-day rolling snapshot archive
    mmkv.ts                 MMKV instance, Zustand adapter, widget keys
  utils/
    waterCalculator.ts      Goal formula engine (multi-factor)
    notificationScheduler.ts  Notifee scheduling between wake/sleep
    weatherService.ts       OpenWeatherMap API + geolocation
    healthService.ts        HealthKit / Health Connect abstraction
  types/
    index.ts                Shared TypeScript interfaces
  theme.ts                  Design system color tokens
  fonts.ts                  Poppins font family mappings
  config.ts                 App constants and API keys
```

## Testing

```sh
npm test
```

Tests cover:
- Water calculator formula (boundary cases, age reduction)
- History store (archiving, pruning, streak calculation, 7-day query)
- Water store (midnight reset triggers archive)
- App render (with native module mocks)

## Widget Support (Planned)

The app writes widget-readable MMKV keys (`widget:dailyGoal`, `widget:consumed`, `widget:lastLogged`) on every store change. These are raw MMKV reads — no Zustand dependency — so a future native Android widget can access them directly.

## Version

1.4.0

## License

Private project.
