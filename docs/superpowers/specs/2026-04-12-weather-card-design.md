# Weather Card — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Problem

The app already calls the OpenWeatherMap API each morning to calculate weather-based hydration adjustments, but the weather data is invisible to the user. Since we're paying the API cost anyway, surfacing this data as a beautiful card on the HomeScreen gives users useful context and makes the "smart" goal feel tangible.

## Goal

Add an adaptive weather card to the HomeScreen that displays current weather conditions with custom SVG icons and condition-driven gradient backgrounds. The card sits above the progress ring and shows temperature, feels-like temp, humidity, and weather condition.

## Data Layer Changes

### New type in `src/types/index.ts`

```ts
interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  conditionCode: number;     // OWM weather code (200-804)
  conditionMain: string;     // "Clear", "Clouds", "Rain", "Snow", "Thunderstorm", "Drizzle", "Mist"
  description: string;       // "clear sky", "light rain", etc.
}
```

### `weatherService.ts` changes

`fetchCurrentWeather()` returns `WeatherData | null` instead of `{ tempC: number; humidity: number } | null`.

Extract additional fields from the OWM response:
- `main.feels_like` → `feelsLikeC`
- `weather[0].id` → `conditionCode`
- `weather[0].main` → `conditionMain`
- `weather[0].description` → `description`

### `useGoalStore` changes

Replace `lastTemp: number | null` with `weatherData: WeatherData | null`. The `recalculateMorningGoal` method stores the full `WeatherData` object. Goal calculation reads `weatherData.tempC` for the bonus computation (no logic change).

## WeatherCard Component

### File: `src/components/WeatherCard.tsx`

### Layout

```
┌──────────────────────────────────────────┐
│  [SVG Icon]   Clear Sky          28°C    │
│               Feels like 31°C    💧 65%  │
└──────────────────────────────────────────┘
```

- **Left (48x48):** Custom SVG weather icon from `WeatherIcons.tsx`
- **Center column:**
  - Line 1: Condition description in title case (e.g., "Clear Sky"), `Fonts.semiBold`, `fontSize: 14`
  - Line 2: "Feels like X°C", `Fonts.regular`, `fontSize: 12`, `theme.textSecondary`
- **Right column (right-aligned):**
  - Line 1: Temperature in large text (e.g., "28°C"), `Fonts.bold`, `fontSize: 22`
  - Line 2: Humidity with small drop icon (e.g., "65%"), `Fonts.regular`, `fontSize: 12`, `theme.textSecondary`

### Card styling

- `borderRadius: 16` (matches quick-log buttons)
- `paddingVertical: 14`, `paddingHorizontal: 16`
- No visible border — gradient background provides visual distinction
- `overflow: 'hidden'` for gradient clipping
- `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 12`

### Adaptive gradient background

SVG `LinearGradient` rendered as an absolutely-positioned background layer (same pattern as `WaterProgressBar`). Gradient direction: left → right.

| `conditionMain` | Left color | Right color | Mood |
|-----------------|------------|-------------|------|
| Clear (tempC > 30) | `#2D1810` | `#1A1020` | warm amber tint |
| Clear (tempC <= 30) | `#0D1B2A` | `#132840` | default surface |
| Clouds | `#141E2E` | `#1A2838` | cool gray-blue |
| Rain, Drizzle | `#0A1628` | `#0D2040` | deep blue |
| Thunderstorm | `#150D20` | `#1A1030` | purple-dark |
| Snow | `#1A2030` | `#202838` | cold silver |
| Mist, Fog, Haze | `#141820` | `#1A2028` | muted gray |

All gradients are subtle dark tints that feel cohesive with the `#060B18` background.

### Empty state

When `weatherData` is null (no API data yet, permissions denied, API failure), the card does not render. No skeleton, no placeholder. HomeScreen looks exactly as before.

### Placement

Between the greeting header and the progress ring section in `HomeScreen.tsx`. Added inside the ScrollView content area.

## Custom SVG Weather Icons

### File: `src/components/WeatherIcons.tsx`

7 icons, all accepting `size` prop (default 48), drawn using `react-native-svg`:

| Name | Visual | Primary color |
|------|--------|---------------|
| `SunIcon` | Circle with 8 short rays | `#F0A050` (amber) |
| `CloudIcon` | Two overlapping rounded cloud shapes | `#7A8BA8` (textSecondary) |
| `PartlyCloudyIcon` | Small sun peeking behind a cloud | Amber sun, gray cloud |
| `RainIcon` | Cloud with 3 diagonal drops below | Gray cloud, `#3B9FE3` (cerulean) drops |
| `ThunderstormIcon` | Cloud with lightning bolt | Gray cloud, `#F0A050` (amber) bolt |
| `SnowIcon` | Cloud with 3 small circles below | Gray cloud, `#F0F4F8` (white) dots |
| `MistIcon` | Three horizontal wavy lines | `#7A8BA8` at varying opacity (0.4, 0.6, 0.8) |

### Condition code mapping

```ts
function getWeatherIcon(conditionCode: number): React.ComponentType<{ size?: number }>
```

- 200-299 → ThunderstormIcon
- 300-399 → RainIcon
- 500-599 → RainIcon
- 600-699 → SnowIcon
- 700-799 → MistIcon
- 800 → SunIcon
- 801 → PartlyCloudyIcon
- 802-804 → CloudIcon

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `WeatherData` interface |
| `src/utils/weatherService.ts` | Return `WeatherData` with expanded fields |
| `src/store/useGoalStore.ts` | Replace `lastTemp` with `weatherData: WeatherData \| null` |
| `src/screens/HomeScreen.tsx` | Import and render `WeatherCard` above progress ring |
| `src/screens/SettingsScreen.tsx` | Update any `lastTemp` references to `weatherData?.tempC` |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/WeatherCard.tsx` | Weather card component with adaptive gradient |
| `src/components/WeatherIcons.tsx` | 7 custom SVG weather icons |

## No New Dependencies

Uses existing `react-native-svg` for icons and gradient background.

## Testing

### Manual verification

- Weather card renders above the progress ring with correct data
- Card disappears when weather data is null (mock by invalidating API key)
- Gradient changes based on weather condition (test by mocking different condition codes)
- Icons display correctly for each condition category
- Card typography matches the app's design system (Poppins fonts, theme colors)
- Card looks good on different screen sizes
- Goal calculation still works correctly with the expanded weather data
