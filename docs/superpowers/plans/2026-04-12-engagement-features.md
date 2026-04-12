# Engagement Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add streak counter, 7-day history chart, and Health Connect active-minutes display to the home screen, backed by a new history store that archives daily snapshots.

**Architecture:** New `useHistoryStore` (Zustand + MMKV) persists rolling 30-day snapshots keyed by date. `useWaterStore.checkMidnightReset()` archives yesterday before zeroing. Two new components (`StreakCounter`, `WeeklyChart`) and a contextual-line swap in `HomeScreen` surface the data. No new dependencies.

**Tech Stack:** React Native, Zustand v5, MMKV, react-native-svg (existing), React Native Animated API

**Spec:** `docs/superpowers/specs/2026-04-12-engagement-features-design.md`

---

### Task 1: Add DailySnapshot type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the DailySnapshot interface**

Add at the end of `src/types/index.ts`:

```typescript
export interface DailySnapshot {
  date: string; // "YYYY-MM-DD"
  consumed: number; // ml, final value at end of day
  effectiveGoal: number; // ml, effective goal at time of archive
  goalMet: boolean; // consumed >= effectiveGoal
  activeMinutes: number; // from Health Connect/HealthKit
  weatherBonus: number; // ml
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to DailySnapshot

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add DailySnapshot type for history tracking"
```

---

### Task 2: Create useHistoryStore with archiveDay and pruning

**Files:**
- Create: `src/store/useHistoryStore.ts`
- Test: `__tests__/useHistoryStore.test.ts`

- [ ] **Step 1: Write failing tests for archiveDay and pruneOldEntries**

Create `__tests__/useHistoryStore.test.ts`:

```typescript
import { useHistoryStore } from '../src/store/useHistoryStore';

jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    createMMKV: () => ({
      set: jest.fn((key: string, value: string) => { store[key] = value; }),
      getString: jest.fn((key: string) => store[key] ?? null),
      remove: jest.fn((key: string) => { delete store[key]; }),
    }),
  };
});

function makeSnapshot(date: string, consumed: number, goal: number) {
  return {
    date,
    consumed,
    effectiveGoal: goal,
    goalMet: consumed >= goal,
    activeMinutes: 0,
    weatherBonus: 0,
  };
}

beforeEach(() => {
  // Reset store state between tests
  useHistoryStore.setState({ snapshots: {} });
});

describe('archiveDay', () => {
  it('stores a snapshot keyed by date', () => {
    const snap = makeSnapshot('2026-04-10', 2500, 2800);
    useHistoryStore.getState().archiveDay(snap);

    const { snapshots } = useHistoryStore.getState();
    expect(snapshots['2026-04-10']).toEqual(snap);
  });

  it('overwrites existing snapshot for same date', () => {
    const snap1 = makeSnapshot('2026-04-10', 1000, 2800);
    const snap2 = makeSnapshot('2026-04-10', 2500, 2800);

    useHistoryStore.getState().archiveDay(snap1);
    useHistoryStore.getState().archiveDay(snap2);

    const { snapshots } = useHistoryStore.getState();
    expect(snapshots['2026-04-10'].consumed).toBe(2500);
  });
});

describe('pruneOldEntries', () => {
  it('removes entries older than 30 days', () => {
    const today = new Date();
    const day31Ago = new Date(today);
    day31Ago.setDate(today.getDate() - 31);
    const oldDate = day31Ago.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const recentDate = yesterday.toISOString().split('T')[0];

    // Directly set snapshots to include an old entry
    useHistoryStore.setState({
      snapshots: {
        [oldDate]: makeSnapshot(oldDate, 2000, 2800),
        [recentDate]: makeSnapshot(recentDate, 2500, 2800),
      },
    });

    useHistoryStore.getState().pruneOldEntries();

    const { snapshots } = useHistoryStore.getState();
    expect(snapshots[oldDate]).toBeUndefined();
    expect(snapshots[recentDate]).toBeDefined();
  });

  it('keeps entries exactly 30 days old', () => {
    const today = new Date();
    const day30Ago = new Date(today);
    day30Ago.setDate(today.getDate() - 30);
    const date30 = day30Ago.toISOString().split('T')[0];

    useHistoryStore.setState({
      snapshots: {
        [date30]: makeSnapshot(date30, 2000, 2800),
      },
    });

    useHistoryStore.getState().pruneOldEntries();

    const { snapshots } = useHistoryStore.getState();
    expect(snapshots[date30]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/useHistoryStore.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useHistoryStore with archiveDay and pruneOldEntries**

Create `src/store/useHistoryStore.ts`:

```typescript
// Zustand store for historical daily snapshots.
// Persisted to MMKV. Rolling 30-day retention.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './mmkv';
import type { DailySnapshot } from '../types';

interface HistoryState {
  snapshots: Record<string, DailySnapshot>;
  archiveDay: (snapshot: DailySnapshot) => void;
  pruneOldEntries: () => void;
  getCurrentStreak: () => number;
  getLast7Days: () => (DailySnapshot | null)[];
}

const MAX_AGE_DAYS = 30;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      snapshots: {},

      archiveDay: (snapshot) => {
        set((state) => ({
          snapshots: { ...state.snapshots, [snapshot.date]: snapshot },
        }));
        get().pruneOldEntries();
      },

      pruneOldEntries: () => {
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - MAX_AGE_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        set((state) => {
          const pruned: Record<string, DailySnapshot> = {};
          for (const [date, snap] of Object.entries(state.snapshots)) {
            if (date >= cutoffStr) {
              pruned[date] = snap;
            }
          }
          return { snapshots: pruned };
        });
      },

      getCurrentStreak: () => {
        const { snapshots } = get();
        let streak = 0;
        const today = new Date();
        // Walk backwards from yesterday
        for (let i = 1; i <= MAX_AGE_DAYS; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const snap = snapshots[dateStr];
          if (!snap || !snap.goalMet) break;
          streak++;
        }
        return streak;
      },

      getLast7Days: () => {
        const { snapshots } = get();
        const result: (DailySnapshot | null)[] = [];
        const today = new Date();
        // Days -6 through -1 (past 6 days from snapshots)
        for (let i = 6; i >= 1; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push(snapshots[dateStr] ?? null);
        }
        // Today (index 6) — null placeholder, caller builds live entry
        result.push(null);
        return result;
      },
    }),
    {
      name: 'history-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        snapshots: state.snapshots,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/useHistoryStore.test.ts --no-coverage`
Expected: PASS — all archiveDay and pruneOldEntries tests green

- [ ] **Step 5: Commit**

```bash
git add src/store/useHistoryStore.ts __tests__/useHistoryStore.test.ts
git commit -m "feat: add useHistoryStore with archiveDay and pruning"
```

---

### Task 3: Add getCurrentStreak and getLast7Days tests

**Files:**
- Modify: `__tests__/useHistoryStore.test.ts`

- [ ] **Step 1: Add streak calculation tests**

Append to `__tests__/useHistoryStore.test.ts`:

```typescript
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

describe('getCurrentStreak', () => {
  it('returns 0 when no history', () => {
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(0);
  });

  it('returns 0 when yesterday goal was not met', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 1000, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(0);
  });

  it('returns 1 when only yesterday goal was met', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });

  it('counts consecutive days backwards', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        [daysAgo(2)]: makeSnapshot(daysAgo(2), 2900, 2800),
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(3);
  });

  it('stops at first missed day', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        [daysAgo(2)]: makeSnapshot(daysAgo(2), 1000, 2800), // not met
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });

  it('stops at gap (missing day)', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        // daysAgo(2) missing
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });
});

describe('getLast7Days', () => {
  it('returns 7 entries', () => {
    const result = useHistoryStore.getState().getLast7Days();
    expect(result).toHaveLength(7);
  });

  it('returns null for days with no data', () => {
    const result = useHistoryStore.getState().getLast7Days();
    // All nulls when no history
    result.forEach((entry) => {
      expect(entry).toBeNull();
    });
  });

  it('returns snapshot data for days that have history', () => {
    const yesterdayDate = daysAgo(1);
    useHistoryStore.setState({
      snapshots: {
        [yesterdayDate]: makeSnapshot(yesterdayDate, 2500, 2800),
      },
    });

    const result = useHistoryStore.getState().getLast7Days();
    // Yesterday is index 5 (6 days ago=0, 5 days ago=1, ... 1 day ago=5, today=6)
    expect(result[5]).not.toBeNull();
    expect(result[5]!.consumed).toBe(2500);
    // Today (index 6) is always null — caller builds live entry
    expect(result[6]).toBeNull();
  });

  it('places snapshots at correct indices', () => {
    const threeDaysAgoDate = daysAgo(3);
    useHistoryStore.setState({
      snapshots: {
        [threeDaysAgoDate]: makeSnapshot(threeDaysAgoDate, 2000, 2800),
      },
    });

    const result = useHistoryStore.getState().getLast7Days();
    // 3 days ago = index 3 (6-ago=0, 5-ago=1, 4-ago=2, 3-ago=3)
    expect(result[3]).not.toBeNull();
    expect(result[3]!.date).toBe(threeDaysAgoDate);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/useHistoryStore.test.ts --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 3: Commit**

```bash
git add __tests__/useHistoryStore.test.ts
git commit -m "test: add streak and getLast7Days tests for history store"
```

---

### Task 4: Wire archive trigger into midnight reset

**Files:**
- Modify: `src/store/useWaterStore.ts:57-73`

- [ ] **Step 1: Write test for archive-on-reset behavior**

Create `__tests__/waterStoreArchive.test.ts`:

```typescript
import { useWaterStore } from '../src/store/useWaterStore';
import { useHistoryStore } from '../src/store/useHistoryStore';
import { useGoalStore } from '../src/store/useGoalStore';

jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    createMMKV: () => ({
      set: jest.fn((key: string, value: string) => { store[key] = value; }),
      getString: jest.fn((key: string) => store[key] ?? null),
      remove: jest.fn((key: string) => { delete store[key]; }),
    }),
  };
});

jest.mock('react-native-health', () => ({
  __esModule: true,
  default: {
    initHealthKit: jest.fn((_p: unknown, cb: (err: string | null) => void) => cb(null)),
    getAppleExerciseTime: jest.fn((_o: unknown, cb: (err: object | null, r: Array<{value: number}>) => void) => cb(null, [])),
    Constants: { Permissions: { ActiveEnergyBurned: 'ActiveEnergyBurned', AppleExerciseTime: 'AppleExerciseTime' } },
  },
}));

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  getSdkStatus: jest.fn().mockResolvedValue(1),
  requestPermission: jest.fn().mockResolvedValue([]),
  readRecords: jest.fn().mockResolvedValue({ records: [] }),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 1, SDK_UNAVAILABLE: 2 },
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: { getCurrentPosition: jest.fn(), requestAuthorization: jest.fn().mockResolvedValue('granted') },
}));

jest.mock('react-native-config', () => ({ OPENWEATHERMAP_API_KEY: '' }));

beforeEach(() => {
  useWaterStore.setState({ consumed: 0, lastLoggedAt: null, lastLogAmount: null, date: '' });
  useGoalStore.setState({ effectiveGoal: 2800, lastActiveMinutes: 30, weatherBonus: 200 });
  useHistoryStore.setState({ snapshots: {} });
});

describe('checkMidnightReset archives previous day', () => {
  it('archives yesterday data before resetting', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    // Simulate "yesterday" state
    useWaterStore.setState({
      consumed: 2500,
      lastLoggedAt: yesterday.toISOString(),
      lastLogAmount: 250,
      date: yesterdayStr,
    });

    useGoalStore.setState({
      effectiveGoal: 2800,
      lastActiveMinutes: 45,
      weatherBonus: 200,
    });

    // Trigger midnight reset
    useWaterStore.getState().checkMidnightReset();

    // Verify archive happened
    const { snapshots } = useHistoryStore.getState();
    expect(snapshots[yesterdayStr]).toBeDefined();
    expect(snapshots[yesterdayStr].consumed).toBe(2500);
    expect(snapshots[yesterdayStr].effectiveGoal).toBe(2800);
    expect(snapshots[yesterdayStr].goalMet).toBe(false); // 2500 < 2800
    expect(snapshots[yesterdayStr].activeMinutes).toBe(45);
    expect(snapshots[yesterdayStr].weatherBonus).toBe(200);

    // Verify reset happened
    expect(useWaterStore.getState().consumed).toBe(0);
  });

  it('does not archive when date has not changed', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useWaterStore.setState({
      consumed: 1500,
      date: todayStr,
    });

    useWaterStore.getState().checkMidnightReset();

    const { snapshots } = useHistoryStore.getState();
    expect(Object.keys(snapshots)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/waterStoreArchive.test.ts --no-coverage`
Expected: FAIL — archive not happening yet

- [ ] **Step 3: Modify checkMidnightReset to archive before reset**

In `src/store/useWaterStore.ts`, replace the `checkMidnightReset` method (lines 57-73):

```typescript
      checkMidnightReset: () => {
        const today = getTodayDate();
        const state = get();
        if (state.date !== today) {
          // Archive yesterday's data before resetting
          const { useHistoryStore } = require('./useHistoryStore');
          const { useGoalStore } = require('./useGoalStore');
          const goalState = useGoalStore.getState();
          useHistoryStore.getState().archiveDay({
            date: state.date,
            consumed: state.consumed,
            effectiveGoal: goalState.effectiveGoal,
            goalMet: state.consumed >= goalState.effectiveGoal,
            activeMinutes: goalState.lastActiveMinutes,
            weatherBonus: goalState.weatherBonus,
          });

          set({
            consumed: 0,
            lastLoggedAt: null,
            lastLogAmount: null,
            date: today,
          });
          // Reset and recalculate the smart goal for the new day.
          // recalculateMorningGoal handles widget data write after async completion.
          const goalStore = useGoalStore.getState();
          goalStore.resetDaily();
          goalStore.recalculateMorningGoal();
        }
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/waterStoreArchive.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `npx jest --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 6: Commit**

```bash
git add src/store/useWaterStore.ts __tests__/waterStoreArchive.test.ts
git commit -m "feat: archive daily snapshot on midnight reset"
```

---

### Task 5: Create StreakCounter component

**Files:**
- Create: `src/components/StreakCounter.tsx`

- [ ] **Step 1: Create the StreakCounter component**

Create `src/components/StreakCounter.tsx`:

```tsx
// Streak counter — amber dot + "N day streak" text.
// Hidden when streak is 0. Includes today if goal is met.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useHistoryStore } from '../store/useHistoryStore';
import { useWaterStore } from '../store/useWaterStore';
import { useGoalStore } from '../store/useGoalStore';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';

interface StreakCounterProps {
  theme: AppTheme;
}

export function StreakCounter({ theme }: StreakCounterProps) {
  const historicalStreak = useHistoryStore((s) => s.getCurrentStreak());
  const consumed = useWaterStore((s) => s.consumed);
  const effectiveGoal = useGoalStore((s) => s.effectiveGoal);

  const todayMet = effectiveGoal > 0 && consumed >= effectiveGoal;
  const streak = historicalStreak + (todayMet ? 1 : 0);

  if (streak === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: theme.accentWarm }]} />
      <Text style={[styles.text, { color: theme.accentWarm }]}>
        {streak} day streak
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/StreakCounter.tsx
git commit -m "feat: add StreakCounter component"
```

---

### Task 6: Create WeeklyChart component

**Files:**
- Create: `src/components/WeeklyChart.tsx`

- [ ] **Step 1: Create the WeeklyChart component**

Create `src/components/WeeklyChart.tsx`:

```tsx
// 7-day mini bar chart using SVG.
// Shows rolling last 7 days. Today's bar is amber and updates live.
// Hidden until 2+ days of history exist.

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useHistoryStore } from '../store/useHistoryStore';
import { useWaterStore } from '../store/useWaterStore';
import { useGoalStore } from '../store/useGoalStore';
import type { AppTheme } from '../theme';
import type { DailySnapshot } from '../types';
import { Fonts } from '../fonts';

const MAX_BAR_HEIGHT = 80;
const MIN_BAR_HEIGHT = 12;
const STUB_HEIGHT = 2;
const BAR_RADIUS = 10;
const CHART_PADDING_TOP = 16;

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDayInitial(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return DAY_INITIALS[d.getDay()];
}

function getBarHeight(consumed: number, goal: number): number {
  if (consumed === 0 || goal === 0) return STUB_HEIGHT;
  const ratio = Math.min(1, consumed / goal);
  return Math.max(MIN_BAR_HEIGHT, ratio * MAX_BAR_HEIGHT);
}

interface WeeklyChartProps {
  theme: AppTheme;
}

export function WeeklyChart({ theme }: WeeklyChartProps) {
  const last7 = useHistoryStore((s) => s.getLast7Days());
  const consumed = useWaterStore((s) => s.consumed);
  const effectiveGoal = useGoalStore((s) => s.effectiveGoal);

  // Count non-null past entries (exclude today at index 6)
  const pastDaysWithData = last7.slice(0, 6).filter((d) => d !== null).length;
  if (pastDaysWithData < 2) return null;

  // Build today's live entry
  const todayEntry: DailySnapshot = {
    date: '',
    consumed,
    effectiveGoal,
    goalMet: effectiveGoal > 0 && consumed >= effectiveGoal,
    activeMinutes: 0,
    weatherBonus: 0,
  };

  const entries = [...last7.slice(0, 6), todayEntry];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        Last 7 days
      </Text>
      <View style={styles.chartRow}>
        {entries.map((entry, index) => {
          const isToday = index === 6;
          const daysAgo = 6 - index;
          const dayInitial = getDayInitial(daysAgo);

          return (
            <View key={index} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <BarItem
                  entry={entry}
                  isToday={isToday}
                  theme={theme}
                />
              </View>
              <Text
                style={[
                  styles.dayInitial,
                  {
                    color: isToday ? theme.accentWarm : theme.textSecondary,
                    fontFamily: isToday ? Fonts.semiBold : Fonts.regular,
                  },
                ]}
              >
                {dayInitial}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface BarItemProps {
  entry: DailySnapshot | null;
  isToday: boolean;
  theme: AppTheme;
}

function BarItem({ entry, isToday, theme }: BarItemProps) {
  const height = entry ? getBarHeight(entry.consumed, entry.effectiveGoal) : STUB_HEIGHT;
  const animatedHeight = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (isToday) {
      Animated.timing(animatedHeight, {
        toValue: height,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      animatedHeight.setValue(height);
    }
  }, [height, isToday, animatedHeight]);

  let fill: string;
  let opacity = 1;

  if (isToday) {
    fill = theme.accentWarm;
  } else if (!entry) {
    fill = theme.accent;
    opacity = 0.3;
  } else if (entry.goalMet) {
    fill = theme.accent;
  } else {
    fill = theme.accent;
    opacity = 0.6;
  }

  // SVG bar rendered with Animated wrapper for today's height transition
  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: animatedHeight,
          backgroundColor: fill,
          opacity,
          borderTopLeftRadius: BAR_RADIUS,
          borderTopRightRadius: BAR_RADIUS,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    marginBottom: CHART_PADDING_TOP,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '60%',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    height: MAX_BAR_HEIGHT,
  },
  bar: {
    width: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dayInitial: {
    fontSize: 12,
    marginTop: 8,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/WeeklyChart.tsx
git commit -m "feat: add WeeklyChart component with animated today bar"
```

---

### Task 7: Integrate new components into HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `src/screens/HomeScreen.tsx`, after the existing imports:

```typescript
import { StreakCounter } from '../components/StreakCounter';
import { WeeklyChart } from '../components/WeeklyChart';
import { useGoalStore as useGoalStoreHook } from '../store/useGoalStore';
```

Note: `useGoalStore` is already imported. The `useGoalStoreHook` alias is not needed — we'll use the existing import to read `lastActiveMinutes` and `activityBump`.

Actually, simplify: just add these two imports after the existing import block:

```typescript
import { StreakCounter } from '../components/StreakCounter';
import { WeeklyChart } from '../components/WeeklyChart';
```

- [ ] **Step 2: Add active minutes selectors**

In the `HomeScreen` component body, after the existing `useGoalStore` selectors (around line 71), add:

```typescript
  const lastActiveMinutes = useGoalStore((s) => s.lastActiveMinutes);
  const activityBump = useGoalStore((s) => s.activityBump);
```

- [ ] **Step 3: Replace the motivational text with contextual line**

Replace the motivational text block (lines 187-190):

```tsx
        {/* Motivational text below ring */}
        <Text style={[styles.motivation, { color: theme.textSecondary }]}>
          {getMotivation(progress)}
        </Text>
```

With:

```tsx
        {/* Streak counter — hidden when 0 */}
        <StreakCounter theme={theme} />

        {/* Contextual line: active minutes (if available) or motivational text */}
        {lastActiveMinutes > 0 && activityBump > 0 ? (
          <Text style={[styles.motivation, { color: theme.textSecondary }]}>
            {lastActiveMinutes} min active{'\u2009\u00B7\u2009'}
            <Text style={{ color: theme.accent, fontFamily: Fonts.medium }}>
              +{activityBump}ml
            </Text>
          </Text>
        ) : (
          <Text style={[styles.motivation, { color: theme.textSecondary }]}>
            {getMotivation(progress)}
          </Text>
        )}
```

- [ ] **Step 4: Add WeeklyChart after quick-log buttons**

After the quick-log buttons `</View>` (after line 213) and before the last-log section, add:

```tsx
        {/* 7-day history chart — hidden until 2+ days of data */}
        <WeeklyChart theme={theme} />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Run all tests**

Run: `npx jest --no-coverage`
Expected: PASS — no regressions

- [ ] **Step 7: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: integrate streak, active minutes, and chart into home screen"
```

---

### Task 8: Manual verification and polish

**Files:**
- Possibly modify: `src/screens/HomeScreen.tsx`, `src/components/WeeklyChart.tsx`, `src/components/StreakCounter.tsx`

- [ ] **Step 1: Start the dev server and build**

Run: `npx react-native start --reset-cache` (in one terminal)
Run: `npx react-native run-ios` or `npx react-native run-android` (in another)

Verify the app builds and launches without errors.

- [ ] **Step 2: Test fresh state (day 1)**

On first launch with no history:
- Streak counter should NOT be visible (streak is 0)
- Active minutes line should show motivational text (no activity data yet)
- Weekly chart should NOT be visible (0 days of history)
- Hero ring, quick-log buttons, and last-log should work as before

- [ ] **Step 3: Test logging and live today update**

Log enough water to reach 100% of goal:
- Streak counter should appear showing "1 day streak" the moment consumed >= effectiveGoal
- If chart is visible (needs 2+ days), today's amber bar should grow with each log
- Active minutes line should show activity data if Health Connect is connected, otherwise motivational text

- [ ] **Step 4: Test with simulated history data**

Temporarily add test data in `useHistoryStore` to simulate 7 days of history (can be done via React DevTools or a temporary debug button). Verify:
- Chart shows 7 bars with correct colors (full blue = met, dim blue = not met, amber = today)
- Streak counter shows correct count
- Empty days show as 2px stubs

- [ ] **Step 5: Verify spacing and visual rhythm**

Check that:
- Streak counter is centered below the ring with 8px margin below
- Contextual line (active minutes or motivational text) is centered
- Chart has 24px top margin, 16px label-to-bar gap, 12px below day initials
- No layout shifts when streak appears/disappears
- Scrolling works smoothly on small devices (iPhone SE)

- [ ] **Step 6: Use impeccable skill for final polish**

Run `/impeccable:polish` on the home screen to verify spacing, alignment, consistency, and detail quality. Fix any issues found.

- [ ] **Step 7: Run full test suite one final time**

Run: `npx jest --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 8: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: polish engagement features layout and spacing"
```
