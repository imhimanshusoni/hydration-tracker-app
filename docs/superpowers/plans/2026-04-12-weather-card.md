# Weather Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beautiful, adaptive weather card to the HomeScreen that shows current conditions using custom SVG icons and condition-driven gradient backgrounds.

**Architecture:** Expand the existing weather API response to capture condition data, store it in `useGoalStore`, and render a new `WeatherCard` component above the progress ring. SVG icons and gradients use the existing `react-native-svg` dependency.

**Tech Stack:** React Native, TypeScript, react-native-svg, Zustand, OpenWeatherMap API

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Add `WeatherData` interface |
| `src/utils/weatherService.ts` | Modify | Return expanded `WeatherData` from API |
| `src/store/useGoalStore.ts` | Modify | Replace `lastTemp` with `weatherData: WeatherData \| null` |
| `src/components/WeatherIcons.tsx` | Create | 7 custom SVG weather icons + condition-code mapper |
| `src/components/WeatherCard.tsx` | Create | Weather card with adaptive gradient background |
| `src/screens/HomeScreen.tsx` | Modify | Render `WeatherCard` above progress ring |
| `__tests__/waterCalculator.test.ts` | Modify | Verify existing tests still pass after data layer changes |

---

### Task 1: Add WeatherData type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the WeatherData interface after DailyGoalState**

Add this after the `DailyGoalState` interface in `src/types/index.ts`:

```ts
export interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  conditionCode: number;
  conditionMain: string;
  description: string;
}
```

- [ ] **Step 2: Update DailyGoalState to use WeatherData**

In `src/types/index.ts`, replace the `lastTemp: number | null;` field in `DailyGoalState` with:

```ts
  weatherData: WeatherData | null;
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Type errors in `useGoalStore.ts` (references to `lastTemp`). This is expected — we'll fix it in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add WeatherData type, replace lastTemp in DailyGoalState"
```

---

### Task 2: Expand weatherService return type

**Files:**
- Modify: `src/utils/weatherService.ts`

- [ ] **Step 1: Update fetchCurrentWeather to return WeatherData**

Replace the return type and the JSON extraction in `fetchCurrentWeather()`. The full updated function:

```ts
export async function fetchCurrentWeather(): Promise<{
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  conditionCode: number;
  conditionMain: string;
  description: string;
} | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const coords = await getCurrentPosition();
    if (!coords) return null;

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${OPENWEATHERMAP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      tempC: data.main.temp,
      feelsLikeC: data.main.feels_like,
      humidity: data.main.humidity,
      conditionCode: data.weather[0].id,
      conditionMain: data.weather[0].main,
      description: data.weather[0].description,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/weatherService.ts
git commit -m "feat: expand weatherService to return full weather condition data"
```

---

### Task 3: Update useGoalStore to store WeatherData

**Files:**
- Modify: `src/store/useGoalStore.ts`

- [ ] **Step 1: Update imports**

Add `WeatherData` to the type import:

```ts
import type { DailyGoalState, WeatherData } from '../types';
```

- [ ] **Step 2: Update INITIAL_STATE**

Replace `lastTemp: null,` with `weatherData: null,` in the `INITIAL_STATE` object.

- [ ] **Step 3: Update recalculateMorningGoal**

In `recalculateMorningGoal`, replace the `lastTemp` variable logic:

Old:
```ts
let lastTemp: number | null = null;
// ...
lastTemp = weather.tempC;
// ...
set({ ..., lastTemp });
```

New:
```ts
let weatherData: WeatherData | null = null;
// ...
if (weather) {
  weatherBonus = getWeatherBonusFromTemp(weather.tempC);
  weatherSource = 'api';
  weatherData = weather;
} else {
  // ...
}
// ...
set({ ..., weatherData });
```

The full `set()` call replaces `lastTemp,` with `weatherData,`.

- [ ] **Step 4: Update resetDaily**

Replace `lastTemp: null,` with `weatherData: null,` in the `resetDaily` method.

- [ ] **Step 5: Update partialize**

Replace `lastTemp: state.lastTemp,` with `weatherData: state.weatherData,` in the `partialize` config.

- [ ] **Step 6: Run type check and tests**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: All pass — no other files reference `lastTemp` anymore.

- [ ] **Step 7: Commit**

```bash
git add src/store/useGoalStore.ts
git commit -m "feat: store full WeatherData in goal store instead of just lastTemp"
```

---

### Task 4: Create Weather SVG Icons

**Files:**
- Create: `src/components/WeatherIcons.tsx`

- [ ] **Step 1: Create WeatherIcons.tsx with all 7 icons and the mapper**

Create `src/components/WeatherIcons.tsx` with the following content:

```tsx
import React from 'react';
import Svg, { Circle, Path, Line, Ellipse } from 'react-native-svg';

interface IconProps {
  size?: number;
}

export function SunIcon({ size = 48 }: IconProps) {
  const c = size / 2;
  const r = size * 0.18;
  const rayLen = size * 0.1;
  const rayStart = r + size * 0.06;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="#F0A050" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <Line
            key={angle}
            x1={c + Math.cos(rad) * rayStart}
            y1={c + Math.sin(rad) * rayStart}
            x2={c + Math.cos(rad) * (rayStart + rayLen)}
            y2={c + Math.sin(rad) * (rayStart + rayLen)}
            stroke="#F5BB70"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function CloudShape({ cx, cy, scale, color }: { cx: number; cy: number; scale: number; color: string }) {
  return (
    <>
      <Ellipse cx={cx} cy={cy} rx={12 * scale} ry={8 * scale} fill={color} />
      <Ellipse cx={cx - 8 * scale} cy={cy + 2 * scale} rx={8 * scale} ry={6 * scale} fill={color} />
      <Ellipse cx={cx + 8 * scale} cy={cy + 2 * scale} rx={9 * scale} ry={6 * scale} fill={color} />
    </>
  );
}

export function CloudIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <CloudShape cx={24} cy={20} scale={1} color="#7A8BA8" />
    </Svg>
  );
}

export function PartlyCloudyIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={18} cy={16} r={7} fill="#F0A050" />
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <Line
            key={angle}
            x1={18 + Math.cos(rad) * 9}
            y1={16 + Math.sin(rad) * 9}
            x2={18 + Math.cos(rad) * 12}
            y2={16 + Math.sin(rad) * 12}
            stroke="#F5BB70"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })}
      <CloudShape cx={28} cy={24} scale={0.9} color="#7A8BA8" />
    </Svg>
  );
}

export function RainIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <CloudShape cx={24} cy={18} scale={0.95} color="#7A8BA8" />
      <Line x1={18} y1={30} x2={16} y2={36} stroke="#3B9FE3" strokeWidth={2} strokeLinecap="round" />
      <Line x1={24} y1={30} x2={22} y2={36} stroke="#3B9FE3" strokeWidth={2} strokeLinecap="round" />
      <Line x1={30} y1={30} x2={28} y2={36} stroke="#3B9FE3" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ThunderstormIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <CloudShape cx={24} cy={16} scale={0.95} color="#7A8BA8" />
      <Path d="M24 26 L21 33 L25 33 L22 40" stroke="#F0A050" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function SnowIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <CloudShape cx={24} cy={18} scale={0.95} color="#7A8BA8" />
      <Circle cx={18} cy={32} r={2} fill="#F0F4F8" />
      <Circle cx={24} cy={35} r={2} fill="#F0F4F8" />
      <Circle cx={30} cy={32} r={2} fill="#F0F4F8" />
    </Svg>
  );
}

export function MistIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Line x1={10} y1={18} x2={38} y2={18} stroke="#7A8BA8" strokeWidth={2.5} strokeLinecap="round" opacity={0.4} />
      <Line x1={12} y1={24} x2={36} y2={24} stroke="#7A8BA8" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      <Line x1={10} y1={30} x2={38} y2={30} stroke="#7A8BA8" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

export function getWeatherIcon(conditionCode: number): React.ComponentType<IconProps> {
  if (conditionCode >= 200 && conditionCode < 300) return ThunderstormIcon;
  if (conditionCode >= 300 && conditionCode < 600) return RainIcon;
  if (conditionCode >= 600 && conditionCode < 700) return SnowIcon;
  if (conditionCode >= 700 && conditionCode < 800) return MistIcon;
  if (conditionCode === 800) return SunIcon;
  if (conditionCode === 801) return PartlyCloudyIcon;
  return CloudIcon;
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/WeatherIcons.tsx
git commit -m "feat: add 7 custom SVG weather icons with condition code mapper"
```

---

### Task 5: Create WeatherCard component

**Files:**
- Create: `src/components/WeatherCard.tsx`

- [ ] **Step 1: Create WeatherCard.tsx**

Create `src/components/WeatherCard.tsx` with the full component:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useGoalStore } from '../store/useGoalStore';
import { getWeatherIcon } from './WeatherIcons';
import { Fonts } from '../fonts';
import type { AppTheme } from '../theme';

// Small drop icon for humidity display
function HumidityDrop() {
  return (
    <Svg width={10} height={12} viewBox="0 0 10 12">
      <Svg width={10} height={12} viewBox="0 0 10 12">
        {/* Use a Path for a small drop shape */}
      </Svg>
    </Svg>
  );
}

interface GradientColors {
  left: string;
  right: string;
}

function getGradientForCondition(conditionMain: string, tempC: number): GradientColors {
  switch (conditionMain) {
    case 'Clear':
      return tempC > 30
        ? { left: '#2D1810', right: '#1A1020' }
        : { left: '#0D1B2A', right: '#132840' };
    case 'Clouds':
      return { left: '#141E2E', right: '#1A2838' };
    case 'Rain':
    case 'Drizzle':
      return { left: '#0A1628', right: '#0D2040' };
    case 'Thunderstorm':
      return { left: '#150D20', right: '#1A1030' };
    case 'Snow':
      return { left: '#1A2030', right: '#202838' };
    case 'Mist':
    case 'Fog':
    case 'Haze':
    case 'Smoke':
    case 'Dust':
    case 'Sand':
    case 'Ash':
    case 'Squall':
    case 'Tornado':
      return { left: '#141820', right: '#1A2028' };
    default:
      return { left: '#0D1B2A', right: '#132840' };
  }
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface WeatherCardProps {
  theme: AppTheme;
}

export function WeatherCard({ theme }: WeatherCardProps) {
  const weatherData = useGoalStore((s) => s.weatherData);

  if (!weatherData) return null;

  const Icon = getWeatherIcon(weatherData.conditionCode);
  const gradient = getGradientForCondition(weatherData.conditionMain, weatherData.tempC);

  return (
    <View style={styles.card}>
      {/* SVG gradient background */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="weatherBg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={gradient.left} />
            <Stop offset="1" stopColor={gradient.right} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#weatherBg)" />
      </Svg>

      {/* Content */}
      <View style={styles.iconContainer}>
        <Icon size={48} />
      </View>

      <View style={styles.centerColumn}>
        <Text style={[styles.condition, { color: theme.text }]}>
          {toTitleCase(weatherData.description)}
        </Text>
        <Text style={[styles.feelsLike, { color: theme.textSecondary }]}>
          Feels like {Math.round(weatherData.feelsLikeC)}°C
        </Text>
      </View>

      <View style={styles.rightColumn}>
        <Text style={[styles.temp, { color: theme.text }]}>
          {Math.round(weatherData.tempC)}°C
        </Text>
        <Text style={[styles.humidity, { color: theme.textSecondary }]}>
          {weatherData.humidity}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
  },
  centerColumn: {
    flex: 1,
  },
  condition: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  feelsLike: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  temp: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  humidity: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/WeatherCard.tsx
git commit -m "feat: add WeatherCard component with adaptive gradient background"
```

---

### Task 6: Add WeatherCard to HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Import WeatherCard**

Add this import near the top of `HomeScreen.tsx`, after the existing component imports:

```ts
import { WeatherCard } from '../components/WeatherCard';
```

- [ ] **Step 2: Render the card between header and ring**

In the JSX, find this section:

```tsx
        {/* Hero progress ring with water fill */}
        <View style={styles.ringSection}>
```

Insert the `WeatherCard` right before it:

```tsx
        {/* Weather card */}
        <WeatherCard theme={theme} />

        {/* Hero progress ring with water fill */}
        <View style={styles.ringSection}>
```

- [ ] **Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: render WeatherCard on HomeScreen above progress ring"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: All tests pass, no type errors.

- [ ] **Step 2: Build and test on device**

Run the app on a device or emulator. Verify:
- Weather card appears above the progress ring
- Card shows temperature, feels-like, humidity, and condition
- Gradient background adapts to condition
- SVG icon matches the weather condition
- Card disappears when weather data is unavailable
- Goal calculation still works correctly
- Existing tests still pass

- [ ] **Step 3: Final commit if any adjustments**

```bash
git add -A
git commit -m "chore: final weather card adjustments"
```
