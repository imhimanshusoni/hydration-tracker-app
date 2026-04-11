# Fix: react-native-config Android Integration for Weather API Key

## Problem

The weather feature fails silently on all devices (emulator and real) because `react-native-config` was installed as an npm dependency but never wired into the Android native build. The required `dotenv.gradle` plugin line is missing from `android/app/build.gradle`.

**Impact:** `Config.OPENWEATHERMAP_API_KEY` returns `undefined` at runtime, falls back to `''`, and every OpenWeatherMap API call returns 401 Unauthorized. The weather card never appears, and the app falls back to manual climate preference for goal calculation.

**Root cause:** During the migration from a hardcoded API key to `.env` (commit `7a27b28`), the JS-side code and `.env` file were set up correctly, but the Gradle plugin required to inject `.env` values into the native layer was never added.

## Changes

### 1. Add dotenv.gradle to Android build

**File:** `android/app/build.gradle`

Add after the existing `apply plugin` lines (around line 3):

```gradle
apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

### 2. Add API key validation in weatherService

**File:** `src/utils/weatherService.ts`

Add an early return with a diagnostic log if the API key is empty:

```typescript
if (!OPENWEATHERMAP_API_KEY) {
  console.log('[Weather] API key missing — check .env and react-native-config setup');
  return null;
}
```

This goes at the top of `fetchCurrentWeather()`, before the permission check.

## Files Modified

- `android/app/build.gradle` — 1 line added
- `src/utils/weatherService.ts` — 4 lines added

## Verification

1. Rebuild: `cd android && rm -rf app/.cxx && ./gradlew assembleRelease`
2. Install on device: `adb install app/build/outputs/apk/release/app-release.apk`
3. Check logs: `adb logcat | grep Weather` — expect `[Weather] success:` with city and temperature
4. Visual: Weather card appears on home screen with real location data
5. Negative test: Rename `.env` to `.env.bak`, rebuild, confirm `[Weather] API key missing` log appears
