# Smart Hydration Engine — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Problem

The WaterReminder app currently calculates a daily water goal using a simple formula: `weight(kg) * 35ml`, with a 10% reduction for users over 55. This doesn't account for gender, real activity levels, or environmental conditions — all of which significantly affect hydration needs. Users get a static goal that never adapts to their day.

## Goal

Transform the static goal into a smart, dynamic hydration target that:
- Incorporates gender, activity level, and weather into the base calculation
- Auto-adjusts throughout the day when significant physical activity is detected
- Fetches real weather data with a manual fallback
- Communicates goal changes to the user via subtle toasts

## Architecture: Monolithic Goal Service

A single `HydrationGoalService` pattern using a dedicated Zustand store (`useGoalStore`). It computes the morning goal from profile + weather, then applies activity bumps intra-day.

### Formula

```
Step 1 — Base with multipliers:
  rawBase = weight(kg) * 35ml
  genderMultiplier: male → 1.0, female → 0.9, other → 1.0
  ageMultiplier:    age > 55 → 0.9, else → 1.0
  baseGoal = rawBase * genderMultiplier * ageMultiplier

Step 2 — Additive bonuses:
  activityBonus:  sedentary → +0ml, moderate → +350ml, active → +700ml
  weatherBonus:   <15°C → +0ml, 15-25°C → +200ml, 25-35°C → +500ml, >35°C → +750ml
  activityBump:   floor(todayActiveMinutes / 30) * 350ml (intra-day, from health data)

Step 3 — Final:
  effectiveGoal = baseGoal + activityBonus + weatherBonus + activityBump
  Clamped: min 1500ml, max 5000ml
```

## Types

### New types in `src/types/index.ts`

```ts
type Gender = 'male' | 'female' | 'other';
type ActivityLevel = 'sedentary' | 'moderate' | 'active';
type ClimatePreference = 'cold' | 'temperate' | 'hot' | 'tropical';

// Added to UserProfile:
//   gender: Gender
//   activityLevel: ActivityLevel
//   climatePreference: ClimatePreference

interface DailyGoalState {
  baseGoal: number;
  weatherBonus: number;
  activityBonus: number;
  effectiveGoal: number;
  lastWeatherCheck: string | null;
  weatherSource: 'api' | 'manual' | null;
}
```

## Store Architecture

### `useUserStore` (existing, extended)

- Adds `gender`, `activityLevel`, `climatePreference` fields
- `completeOnboarding` and `updateProfile` updated to include new fields
- `dailyGoal` field remains as the static base (for backward compat with widget), but the UI reads from `useGoalStore.effectiveGoal`

### `useGoalStore` (new) — `src/store/useGoalStore.ts`

Owns `DailyGoalState`. Key methods:
- `recalculateMorningGoal()` — runs on app open after midnight reset. Fetches weather, reads profile, queries health data, computes effectiveGoal.
- `applyActivityBump(activeMinutes: number)` — called when health data shows increased activity. Updates activityBonus and effectiveGoal.
- Persisted to MMKV. Resets daily alongside water store.

### `useWaterStore` (existing, modified)

- Progress calculations (`consumed / goal`) now read from `useGoalStore.effectiveGoal`
- `checkMidnightReset` triggers `useGoalStore.recalculateMorningGoal()`
- Widget data writes use the effective goal

## Data Flow

### Morning (app open after midnight reset)

```
App opens → checkMidnightReset()
  ↓ (if new day)
  Reset consumed to 0
  ↓
  recalculateMorningGoal()
    ├── Read user profile (weight, age, gender, activityLevel)
    ├── Fetch weather via weatherService (or use climatePreference fallback)
    ├── Query healthService for today's active minutes
    └── Compute effectiveGoal = base + weather + activity
  ↓
  Update progress ring, widget data
```

### Mid-day activity bump

```
AppState becomes 'active' → healthService.getTodayActiveMinutes()
  ↓ (if increased since last check)
  applyActivityBump(newMinutes)
    ├── Compute new activityBonus
    ├── Update effectiveGoal (only goes up, never down)
    ├── Show toast: "Goal adjusted to X.XL — you've been active!"
    └── Update widget data
```

## Health Integration

### Platforms

- **iOS:** `react-native-health` — reads HealthKit active energy burned and exercise minutes
- **Android:** `react-native-health-connect` — reads Health Connect exercise sessions and active calories

### Service: `src/utils/healthService.ts`

Platform-abstracted service:
- `requestHealthPermissions(): Promise<boolean>`
- `getTodayActiveMinutes(): Promise<number>`

Uses `Platform.select` internally. Graceful fallback: if permissions denied, the `activityLevel` from the user profile serves as the static baseline.

### Permission flow

After onboarding completes → request health permissions. Optional — app works fully with static activity level if denied.

## Weather Integration

### Service: `src/utils/weatherService.ts`

- `fetchTodayWeather(): Promise<{ tempC: number; humidity: number } | null>`
- `getWeatherBonus(tempC: number): number`

### API

OpenWeatherMap free tier (`/weather?lat=X&lon=Y&units=metric`). 1000 calls/day free.

### Location

`react-native-geolocation-service` for device coordinates. Permission requested on first morning goal calculation.

### Fallback

If location denied or API fails → use `climatePreference` from user profile:
- cold → 0ml bonus
- temperate → 200ml bonus
- hot → 500ml bonus
- tropical → 750ml bonus

### Caching

Weather result cached for the day in `useGoalStore.lastWeatherCheck`. No re-fetch until next midnight reset.

### Config: `src/config.ts`

Stores the OpenWeatherMap API key as a constant.

## UI Changes

### Onboarding Screen (`src/screens/OnboardingScreen.tsx`)

Two new fields added after the existing name/weight/age inputs, before wake/sleep time:

1. **Gender selector** — 3 horizontal pill buttons: Male | Female | Other
2. **Activity level selector** — 3 horizontal pill buttons: Sedentary | Moderate | Active, each with a one-line description underneath

Climate preference defaults to "temperate" (editable in settings, not onboarding).

### Home Screen (`src/screens/HomeScreen.tsx`)

- Progress ring reads from `useGoalStore.effectiveGoal` instead of `useUserStore.dailyGoal`
- New **goal adjustment toast** (warm amber accent, same style as undo toast): "Goal adjusted to X.XL — you've been active!" Auto-dismisses after 4 seconds.
- On `AppState` change to active: check health data for activity bumps

### Settings Screen (`src/screens/SettingsScreen.tsx`)

Extended Profile card:
- Gender picker (pill buttons)
- Activity level picker (pill buttons)

New "Environment" card:
- Climate preference picker: Cold | Temperate | Hot | Tropical
- "Today's weather" label: "Auto (28°C)" or "Manual (Hot)"
- Location permission status

Updated Goal display:
- Shows `effectiveGoal` from `useGoalStore`
- Full breakdown: "Base 2.5L + Weather +0.5L + Activity +0.35L = 3.35L"

## New Dependencies

| Package | Purpose |
|---------|---------|
| `react-native-health` | HealthKit (iOS) |
| `react-native-health-connect` | Health Connect (Android) |
| `react-native-geolocation-service` | Device location for weather |

## Native Permissions

| Permission | iOS | Android |
|------------|-----|---------|
| Health data | HealthKit entitlement + `NSHealthShareUsageDescription` | Health Connect permission in AndroidManifest |
| Location | `NSLocationWhenInUseUsageDescription` | `ACCESS_COARSE_LOCATION` |

Both are optional — app works with static profile data if denied.

## Existing User Migration

Users who already completed onboarding won't have the new profile fields. The store defaults handle this:

- `gender` defaults to `'other'` (multiplier 1.0 — no change to existing goal)
- `activityLevel` defaults to `'moderate'` (closest to the current static formula)
- `climatePreference` defaults to `'temperate'`

These defaults are applied at the Zustand store level via the initial state. Existing persisted data from MMKV will be merged with these defaults automatically by Zustand's `persist` middleware — missing keys get the initial values. No explicit migration step is needed.

On first app open after the update, `recalculateMorningGoal()` runs and computes the new effectiveGoal with these defaults, which should be close to the user's previous static goal.

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add Gender, ActivityLevel, ClimatePreference types; extend UserProfile; add DailyGoalState |
| `src/utils/waterCalculator.ts` | Replace simple formula with full calculation accepting config object |
| `src/store/useUserStore.ts` | Add gender, activityLevel, climatePreference fields; update completeOnboarding/updateProfile |
| `src/store/useWaterStore.ts` | Read effectiveGoal from useGoalStore; trigger morning recalculation |
| `src/screens/OnboardingScreen.tsx` | Add gender and activity level selectors |
| `src/screens/HomeScreen.tsx` | Read from useGoalStore; add goal adjustment toast; check health on AppState |
| `src/screens/SettingsScreen.tsx` | Add gender, activity, climate pickers; goal breakdown display; environment card |

## Files to Create

| File | Purpose |
|------|---------|
| `src/store/useGoalStore.ts` | Dynamic daily goal state (Zustand + MMKV) |
| `src/utils/healthService.ts` | Platform-abstracted health data access |
| `src/utils/weatherService.ts` | Weather API + geolocation |
| `src/config.ts` | OpenWeatherMap API key |

## Testing

### Unit tests (extend `__tests__/waterCalculator.test.ts`)

- All gender/activity/age/weather combinations
- Clamp boundaries (min 1500ml, max 5000ml)
- Activity bump calculation (30min increments)
- Weather bonus mapping for each temperature range

### Store tests

- Mock healthService and weatherService
- Verify `recalculateMorningGoal` produces correct effectiveGoal
- Verify `applyActivityBump` updates effectiveGoal and triggers toast state

### Manual verification

- Run onboarding with new fields → verify goal reflects all factors
- Edit settings → verify goal recalculates
- Simulate weather API failure → verify fallback to climate preference
- Check progress ring shows effectiveGoal, not static baseGoal
- Verify goal adjustment toast appears and auto-dismisses
