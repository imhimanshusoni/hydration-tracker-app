# Goal Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subtle double-pulse amber ripple animation on the progress ring when the user's daily water consumption reaches their goal for the first time that day.

**Architecture:** A `goalCelebratedToday` boolean in `useWaterStore` tracks whether the celebration has fired today. When `logWater()` crosses the goal threshold and the flag is false, it sets the flag. The `WaterProgressBar` component accepts a `celebrate` prop — when it flips to true, two concentric amber rings expand outward from the progress arc and the consumed number glows amber briefly. The HomeScreen detects the transition and passes it down.

**Tech Stack:** React Native Animated API (useNativeDriver for transforms/opacity), existing react-native-svg ring.

**Design Spec:** `docs/superpowers/specs/2026-04-13-goal-celebration-design.md`

---

## Task 1: Add `goalCelebratedToday` to useWaterStore

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Add the field to the WaterDay type**

In `src/types/index.ts`, add `goalCelebratedToday` to `WaterDay`:

```typescript
export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
  goalCelebratedToday: boolean; // true after first goal crossing today
}
```

- [ ] **Step 2: Add the field to useWaterStore state and partialize**

In `src/store/useWaterStore.ts`:

Add `goalCelebratedToday: false` to the initial state (after `date: getTodayDate()`):

```typescript
      consumed: 0,
      lastLoggedAt: null,
      lastLogAmount: null,
      date: getTodayDate(),
      goalCelebratedToday: false,
```

In `logWater()`, after `writeWidgetData(...)`, add the goal-crossing check:

```typescript
      logWater: (amount) => {
        const now = new Date().toISOString();
        const newConsumed = get().consumed + amount;
        const wasCelebrated = get().goalCelebratedToday;
        set({
          consumed: newConsumed,
          lastLoggedAt: now,
          lastLogAmount: amount,
        });
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, now);

        // Fire celebration on first goal crossing today
        if (!wasCelebrated && newConsumed >= effectiveGoal) {
          set({ goalCelebratedToday: true });
        }
      },
```

In `checkMidnightReset()`, add `goalCelebratedToday: false` to the reset set call:

```typescript
          set({
            consumed: 0,
            lastLoggedAt: null,
            lastLogAmount: null,
            date: today,
            goalCelebratedToday: false,
          });
```

In `partialize`, add `goalCelebratedToday`:

```typescript
      partialize: (state) => ({
        consumed: state.consumed,
        lastLoggedAt: state.lastLoggedAt,
        lastLogAmount: state.lastLogAmount,
        date: state.date,
        goalCelebratedToday: state.goalCelebratedToday,
      }),
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/store/useWaterStore.ts
git commit -m "feat: add goalCelebratedToday flag to water store

Tracks whether the goal celebration has fired today.
Set on first goal crossing in logWater, reset at midnight.
Persisted to survive app restarts."
```

---

## Task 2: Add celebration animation to WaterProgressBar

**Files:**
- Modify: `src/components/WaterProgressBar.tsx`

- [ ] **Step 1: Add the celebrate prop and animation logic**

Replace the entire `src/components/WaterProgressBar.tsx` with:

```tsx
// Hero progress ring with water-fill interior and goal celebration.
//
// When `celebrate` prop transitions to true, two amber ripple rings
// expand outward from the progress arc and the consumed number
// glows amber briefly. Animation fires once per prop change.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Rect,
} from 'react-native-svg';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';

interface WaterProgressBarProps {
  consumed: number;
  dailyGoal: number;
  theme: AppTheme;
  celebrate?: boolean;
}

const SIZE = 250;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2; // 119
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const RIPPLE_COLOR = '#F0A050'; // warm amber

export function WaterProgressBar({ consumed, dailyGoal, theme, celebrate }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  const innerRadius = RADIUS - STROKE_WIDTH / 2 - 6;
  const fillHeight = innerRadius * 2 * clampedProgress;
  const fillY = SIZE / 2 + innerRadius - fillHeight;

  // Celebration animation values
  const ripple1Scale = useRef(new Animated.Value(1)).current;
  const ripple1Opacity = useRef(new Animated.Value(0)).current;
  const ripple2Scale = useRef(new Animated.Value(0.9)).current;
  const ripple2Opacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const hasCelebrated = useRef(false);

  useEffect(() => {
    if (celebrate && !hasCelebrated.current) {
      hasCelebrated.current = true;

      // Reset values
      ripple1Scale.setValue(1);
      ripple1Opacity.setValue(0.5);
      ripple2Scale.setValue(0.9);
      ripple2Opacity.setValue(0.35);
      glowOpacity.setValue(0);

      // Double-pulse ripple with 150ms stagger
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(ripple1Scale, {
            toValue: 1.4,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple1Opacity, {
            toValue: 0,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ripple2Scale, {
            toValue: 1.3,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple2Opacity, {
            toValue: 0,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Number glow: fade in amber, hold, fade out
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [celebrate, ripple1Scale, ripple1Opacity, ripple2Scale, ripple2Opacity, glowOpacity]);

  // Ripple ring dimensions — positioned around the SVG ring's outer edge
  const rippleSize = (RADIUS + STROKE_WIDTH / 2) * 2;
  const rippleOffset = (SIZE - rippleSize) / 2;

  return (
    <View style={styles.container}>
      {/* Ripple rings (behind the SVG) */}
      <Animated.View
        style={[
          styles.rippleRing,
          {
            width: rippleSize,
            height: rippleSize,
            borderRadius: rippleSize / 2,
            borderColor: RIPPLE_COLOR,
            top: rippleOffset,
            left: rippleOffset,
            opacity: ripple1Opacity,
            transform: [{ scale: ripple1Scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.rippleRing,
          {
            width: rippleSize,
            height: rippleSize,
            borderRadius: rippleSize / 2,
            borderColor: RIPPLE_COLOR,
            top: rippleOffset,
            left: rippleOffset,
            opacity: ripple2Opacity,
            transform: [{ scale: ripple2Scale }],
          },
        ]}
      />

      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.accentSecondary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.accent} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="fillGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={theme.accent} stopOpacity="0.2" />
            <Stop offset="0.6" stopColor={theme.accentSecondary} stopOpacity="0.08" />
            <Stop offset="1" stopColor={theme.accentSecondary} stopOpacity="0" />
          </LinearGradient>
          <ClipPath id="innerClip">
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={innerRadius} />
          </ClipPath>
        </Defs>

        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.ringTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        <Rect
          x={SIZE / 2 - innerRadius}
          y={fillY}
          width={innerRadius * 2}
          height={fillHeight}
          fill="url(#fillGrad)"
          clipPath="url(#innerClip)"
        />

        {clampedProgress > 0.01 && clampedProgress < 0.99 && (
          <Rect
            x={SIZE / 2 - innerRadius * 0.7}
            y={fillY}
            width={innerRadius * 1.4}
            height={1.5}
            fill={theme.accent}
            opacity={0.25}
            clipPath="url(#innerClip)"
            rx={1}
          />
        )}

        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#arcGrad)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      {/* Center text overlay */}
      <View style={styles.textContainer}>
        <View>
          <Text style={[styles.consumedValue, { color: theme.text }]}>
            {consumedL}
          </Text>
          {/* Amber glow overlay — same position, animated opacity */}
          <Animated.Text
            style={[
              styles.consumedValue,
              styles.glowOverlay,
              { color: RIPPLE_COLOR, opacity: glowOpacity },
            ]}
          >
            {consumedL}
          </Animated.Text>
        </View>
        <Text style={[styles.goalText, { color: theme.textSecondary }]}>
          of {goalL} L
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  consumedValue: {
    fontSize: 52,
    fontFamily: Fonts.thin,
    letterSpacing: -2,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  goalText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    marginTop: -2,
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 2,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WaterProgressBar.tsx
git commit -m "feat: add goal celebration animation to progress ring

Double-pulse amber ripple expanding from the ring edge +
consumed number glows amber for 2 seconds. Triggered by
celebrate prop. Uses native-driver animations for 60fps."
```

---

## Task 3: Wire celebration trigger in HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add celebration detection and pass to WaterProgressBar**

In `HomeScreen.tsx`, add a ref to track the previous `goalCelebratedToday` value and detect the false→true transition.

Add these near the other store selectors (around line 83):

```typescript
  const goalCelebratedToday = useWaterStore(s => s.goalCelebratedToday);
```

Add a ref and state to detect the transition (near the other refs, around line 89):

```typescript
  const [triggerCelebration, setTriggerCelebration] = useState(false);
  const prevCelebratedRef = useRef(goalCelebratedToday);
```

Add a useEffect to detect the false→true transition:

```typescript
  // Detect goal celebration transition (false → true)
  useEffect(() => {
    if (goalCelebratedToday && !prevCelebratedRef.current) {
      setTriggerCelebration(true);
    }
    prevCelebratedRef.current = goalCelebratedToday;
  }, [goalCelebratedToday]);
```

Update the `WaterProgressBar` render to pass the celebrate prop:

```tsx
          <WaterProgressBar
            consumed={consumed}
            dailyGoal={effectiveGoal}
            theme={theme}
            celebrate={triggerCelebration}
          />
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: wire celebration trigger from store to progress ring

Detects goalCelebratedToday false→true transition and passes
celebrate prop to WaterProgressBar."
```

---

## Task 4: Verify end-to-end

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Run tests**

Run: `npx jest`
Expected: all tests pass

- [ ] **Step 3: Build and test on device**

Run: `npx react-native run-android`

Manual test:
1. Log water until just below the goal
2. Log enough to cross the goal
3. Verify: two amber ripple rings expand from the progress arc
4. Verify: the consumed number glows amber, then fades back to white
5. Log more water — verify: no repeat celebration
6. Kill and reopen the app — verify: no replay
7. (Optional) Clear app data or wait for midnight reset, then verify celebration fires again next day

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify goal celebration works end-to-end"
```

---

## Verification Summary

| Test | Expected |
|------|----------|
| Log that crosses goal | Double amber ripple + number glow |
| Subsequent logs after goal met | No animation |
| App kill + reopen after goal met | No animation replay |
| Midnight reset + next day goal crossing | Animation fires again |
| `npx tsc --noEmit` | Zero errors |
| `npx jest` | All tests pass |
