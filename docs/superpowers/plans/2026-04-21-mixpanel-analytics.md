# Mixpanel Analytics + 80% Streak Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Mixpanel analytics into the Water Reminder RN app with a strongly-typed event catalog, and simultaneously drop the `Goal Met` / streak-continuation threshold from 100% → 80% of daily goal (tagged via `streak_rule_version: 'v2_80pct'` super property).

**Architecture:** A functional analytics service at `src/services/analytics/` with split init entry points (foreground emits `App Opened`, background doesn't), a memoized init promise, bounded pre-init queue, mapped-type event catalog, runtime PII guard, and `syncUserProfile` / `syncSessionProperties` that write to both Mixpanel super properties and people properties. Threshold change lives in `useWaterStore.GOAL_MET_THRESHOLD = 0.8` and a new `goalMetFiredToday` day-scoped flag enforces the `Goal Met` XOR `Day Ended Below Goal` invariant across mid-day `Smart Goal Recalculated`.

**Tech Stack:** React Native 0.85 • React 19 • TypeScript strict • Zustand v5 with persist middleware • MMKV • React Navigation v7 • Notifee • Jest (`@react-native/jest-preset`) • `mixpanel-react-native` v3 • `react-native-config`

**Spec:** `docs/superpowers/specs/2026-04-21-mixpanel-analytics-design.md` (commit `a00b016`)

---

## Ordering & phase boundaries

Phases are numbered by dependency. Phase 1 (threshold change) is shippable standalone — all existing tests pass after it without any analytics code. Phase 2 builds the analytics service in isolation (pure module, no app wiring). Phase 3 wires the service into the app shell. Phase 4 emits events from features/stores. Phase 5 documents. Phase 6 verifies. A subagent executing this plan can commit per task; a CI failure at any commit means halt and fix, not continue.

**File structure (created or modified):**

```
# New
src/services/analytics/index.ts
src/services/analytics/client.ts
src/services/analytics/events.ts
src/services/analytics/screenTracking.ts
src/services/analytics/privacy.ts
src/services/analytics/__tests__/client.test.ts
src/services/analytics/__tests__/events.contract.test.ts
src/services/analytics/__tests__/screenTracking.test.ts
src/services/analytics/__tests__/privacy.test.ts
__mocks__/mixpanel-react-native.js
docs/analytics.md

# Modified
src/config.ts
__mocks__/react-native-config.js
src/store/useWaterStore.ts
src/store/useUserStore.ts
src/store/useGoalStore.ts
src/utils/healthService.ts
src/utils/weatherService.ts
src/screens/OnboardingScreen.tsx
src/screens/HomeScreen.tsx
src/components/WeeklyChart.tsx
App.tsx
index.js
__tests__/waterStoreArchive.test.ts
__tests__/useHistoryStore.test.ts
package.json           # mixpanel-react-native dep
ios/Podfile.lock       # pod install side-effect
```

---

# Phase 0 — Dependencies & configuration

## Task 1: Install `mixpanel-react-native` and run `pod install`

**Files:**
- Modify: `package.json` (dependency added by npm)
- Modify: `ios/Podfile.lock` (CocoaPods side-effect)

- [ ] **Step 1: Install the package**

Run: `npm i mixpanel-react-native`

Expected: `package.json` gains `"mixpanel-react-native": "^3.x.x"` under `dependencies`. No errors.

- [ ] **Step 2: Install iOS pods**

Run: `cd ios && pod install && cd ..`

Expected: CocoaPods output shows `Installing Mixpanel-swift`. `ios/Podfile.lock` updates. No errors.

- [ ] **Step 3: Verify Android autolinking recognizes the module**

Run: `npx react-native config | grep -A3 '"mixpanel-react-native"'`

Expected: JSON block showing the module's Android config resolved with a non-null `sourceDir`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock
git commit -m "chore: add mixpanel-react-native dependency"
```

---

## Task 2: Add `MIXPANEL_TOKEN` + `MIXPANEL_SERVER_URL` to `src/config.ts`

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add the exports**

Replace the contents of `src/config.ts` with:

```ts
// App configuration constants

import Config from 'react-native-config';

export const OPENWEATHERMAP_API_KEY = Config.OPENWEATHERMAP_API_KEY ?? '';

export const MIXPANEL_TOKEN = Config.MIXPANEL_TOKEN ?? '';

// Empty ≡ use Mixpanel's default (US) endpoint. EU projects set this in .env:
//   MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com
export const MIXPANEL_SERVER_URL = (Config.MIXPANEL_SERVER_URL ?? '').trim() || undefined;

export const MIN_GOAL_ML = 1500;
export const MAX_GOAL_ML = 5000;
export const ACTIVITY_BUMP_INTERVAL_MIN = 30;
export const ACTIVITY_BUMP_ML = 350;
```

- [ ] **Step 2: Confirm TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: exit code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: expose MIXPANEL_TOKEN and MIXPANEL_SERVER_URL in config"
```

---

## Task 3: Update `__mocks__/react-native-config.js` with `MIXPANEL_TOKEN`

**Files:**
- Modify: `__mocks__/react-native-config.js`

- [ ] **Step 1: Add the stub**

Replace the contents of `__mocks__/react-native-config.js` with:

```js
export default {
  OPENWEATHERMAP_API_KEY: 'test-key',
  MIXPANEL_TOKEN: 'test-token',
  MIXPANEL_SERVER_URL: '',
};
```

- [ ] **Step 2: Run existing tests to confirm no regression**

Run: `npm test`

Expected: all existing tests pass (no test depends on MIXPANEL_TOKEN yet).

- [ ] **Step 3: Commit**

```bash
git add __mocks__/react-native-config.js
git commit -m "test: stub MIXPANEL_TOKEN in react-native-config mock"
```

---

## Task 3.5: Install `react-native-device-info`

**Files:**
- Modify: `package.json`
- Modify: `ios/Podfile.lock`

`baseEventProps()` needs real `app_version` and `build_number` values — not hardcoded strings. `react-native-device-info` exposes `getVersion()` and `getBuildNumber()` with no config required.

- [ ] **Step 1: Install**

Run: `npm i react-native-device-info`

Expected: adds to `package.json`, no errors.

- [ ] **Step 2: Pod install**

Run: `cd ios && pod install && cd ..`

Expected: CocoaPods installs `RNDeviceInfo`. `ios/Podfile.lock` updates.

- [ ] **Step 3: Add Jest mock**

Create `__mocks__/react-native-device-info.js`:

```js
module.exports = {
  getVersion: jest.fn(() => '1.3.2'),
  getBuildNumber: jest.fn(() => '7'),
};
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock __mocks__/react-native-device-info.js
git commit -m "chore: add react-native-device-info for app version + build number"
```

---

## Task 4: Create `__mocks__/mixpanel-react-native.js`

**Files:**
- Create: `__mocks__/mixpanel-react-native.js`

- [ ] **Step 1: Create the mock**

Create `__mocks__/mixpanel-react-native.js` with:

```js
// Jest mock for mixpanel-react-native. All methods are jest.fn() spies so tests can
// assert calls without a native module. The People sub-API is a fresh spied object
// per call to getPeople() so .set / .increment / etc. are tracked.

const peopleInstance = {
  set: jest.fn(),
  setOnce: jest.fn(),
  increment: jest.fn(),
  append: jest.fn(),
  union: jest.fn(),
  remove: jest.fn(),
  unset: jest.fn(),
  trackCharge: jest.fn(),
  deleteUser: jest.fn(),
};

class Mixpanel {
  constructor(token, trackAutomaticEvents) {
    this.token = token;
    this.trackAutomaticEvents = trackAutomaticEvents;
  }
  init = jest.fn().mockResolvedValue(undefined);
  setLoggingEnabled = jest.fn();
  track = jest.fn();
  identify = jest.fn().mockResolvedValue(undefined);
  alias = jest.fn().mockResolvedValue(undefined);
  reset = jest.fn().mockResolvedValue(undefined);
  flush = jest.fn().mockResolvedValue(undefined);
  timeEvent = jest.fn();
  eventElapsedTime = jest.fn().mockResolvedValue(0);
  registerSuperProperties = jest.fn();
  registerSuperPropertiesOnce = jest.fn();
  getSuperProperties = jest.fn().mockResolvedValue({});
  unregisterSuperProperty = jest.fn();
  clearSuperProperties = jest.fn();
  optInTracking = jest.fn();
  optOutTracking = jest.fn();
  hasOptedOutTracking = jest.fn().mockResolvedValue(false);
  getDistinctId = jest.fn().mockResolvedValue('mock-distinct-id');
  getDeviceId = jest.fn().mockResolvedValue('mock-device-id');
  getPeople = jest.fn(() => peopleInstance);
}

// Tests can reset spies between cases by importing __resetMocks and calling it in beforeEach.
function __resetMocks() {
  [
    peopleInstance.set, peopleInstance.setOnce, peopleInstance.increment, peopleInstance.append,
    peopleInstance.union, peopleInstance.remove, peopleInstance.unset, peopleInstance.trackCharge,
    peopleInstance.deleteUser,
  ].forEach((fn) => fn.mockClear());
}

module.exports = { Mixpanel, __resetMocks };
```

- [ ] **Step 2: Verify Jest discovers the mock**

Run: `npx jest --listTests 2>&1 | head`

Expected: exit 0; Jest lists the test files without error.

- [ ] **Step 3: Commit**

```bash
git add __mocks__/mixpanel-react-native.js
git commit -m "test: add mixpanel-react-native jest mock"
```

---

# Phase 1 — 80% threshold product change (no analytics wiring)

## Task 5: Add `GOAL_MET_THRESHOLD` constant + `goalMetFiredToday` field to `useWaterStore`

**Files:**
- Modify: `src/types/index.ts:48-54` (add `goalMetFiredToday` to `WaterDay`)
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Add `goalMetFiredToday` to the `WaterDay` type**

In `src/types/index.ts`, replace:

```ts
export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
  goalCelebratedToday: boolean;
}
```

with:

```ts
export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
  goalCelebratedToday: boolean;
  // Fires exactly once per day when consumption strict-crosses GOAL_MET_THRESHOLD
  // of effectiveGoal. Gates analytics Goal Met emission (see analytics spec
  // 2026-04-21-mixpanel-analytics-design.md §Day-boundary invariant).
  goalMetFiredToday: boolean;
}
```

- [ ] **Step 2: Add the constant + field to `useWaterStore`**

At the top of `src/store/useWaterStore.ts`, below the imports, add:

```ts
// Fraction of effectiveGoal that counts as "goal met" for analytics Goal Met
// emission and streak continuation. Changing this value requires bumping
// streak_rule_version in src/services/analytics/events.ts in the same commit —
// the string-literal union makes a mismatch a compile error.
export const GOAL_MET_THRESHOLD = 0.8;
```

Then in the `create(persist(...))` state block, add `goalMetFiredToday: false,` immediately below `goalCelebratedToday: false,`. Also add `goalMetFiredToday: state.goalMetFiredToday,` to the `partialize` return object.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/store/useWaterStore.ts
git commit -m "feat: add GOAL_MET_THRESHOLD constant and goalMetFiredToday flag"
```

---

## Task 6: Write the failing test for `logWater` 80% strict-cross gating of `goalMetFiredToday`

**Files:**
- Modify: `__tests__/waterStoreArchive.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/waterStoreArchive.test.ts` (above the final closing line if any, or at end of file):

```ts
describe('goalMetFiredToday flag (80% threshold)', () => {
  beforeEach(() => {
    useWaterStore.setState({
      consumed: 0,
      lastLoggedAt: null,
      lastLogAmount: null,
      date: '',
      goalCelebratedToday: false,
      goalMetFiredToday: false,
    });
    useGoalStore.setState({ effectiveGoal: 2800, lastActiveMinutes: 30, weatherBonus: 200 });
  });

  it('sets goalMetFiredToday to true on strict-cross of 80% (2800 * 0.8 = 2240)', () => {
    useWaterStore.setState({ consumed: 2200 });
    useWaterStore.getState().logWater(100); // 2300 >= 2240, prev 2200 < 2240
    expect(useWaterStore.getState().goalMetFiredToday).toBe(true);
  });

  it('does not set goalMetFiredToday at 79% (2211 / 2800 = 0.789)', () => {
    useWaterStore.setState({ consumed: 2100 });
    useWaterStore.getState().logWater(100); // 2200, below 2240
    expect(useWaterStore.getState().goalMetFiredToday).toBe(false);
  });

  it('does not re-fire goalMetFiredToday once set (second crossing attempt)', () => {
    useWaterStore.setState({ consumed: 2300, goalMetFiredToday: true });
    useWaterStore.getState().logWater(500);
    // Flag was true, stays true — not toggled or re-emitted
    expect(useWaterStore.getState().goalMetFiredToday).toBe(true);
  });

  it('resets goalMetFiredToday on midnight reset', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    useWaterStore.setState({
      consumed: 2500,
      date: yesterdayStr,
      goalMetFiredToday: true,
    });
    useWaterStore.getState().checkMidnightReset();
    expect(useWaterStore.getState().goalMetFiredToday).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest __tests__/waterStoreArchive.test.ts -t 'goalMetFiredToday'`

Expected: multiple FAIL — `logWater` doesn't yet toggle `goalMetFiredToday`, and `checkMidnightReset` doesn't yet reset it.

---

## Task 7: Implement `goalMetFiredToday` strict-cross in `logWater`

**Files:**
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Update `logWater` with the 80% strict-cross check**

In `src/store/useWaterStore.ts`, replace the existing `logWater` implementation:

```ts
logWater: (amount) => {
  const now = new Date().toISOString();
  const prevConsumed = get().consumed;
  const newConsumed = prevConsumed + amount;
  const wasCelebrated = get().goalCelebratedToday;
  const wasGoalMetFired = get().goalMetFiredToday;

  set({
    consumed: newConsumed,
    lastLoggedAt: now,
    lastLogAmount: amount,
  });

  const { useGoalStore } = require('./useGoalStore');
  const { effectiveGoal } = useGoalStore.getState();
  writeWidgetData(effectiveGoal, newConsumed, now);

  // Celebration animation: fires on first 100% crossing (unchanged — UX decision,
  // orthogonal to analytics 80% threshold).
  if (!wasCelebrated && newConsumed >= effectiveGoal) {
    set({ goalCelebratedToday: true });
  }

  // Goal Met analytics flag: strict-cross of 80% of effectiveGoal, once per day.
  // See analytics spec §Day-boundary invariant and §Goal Met strict-cross semantics.
  const threshold = GOAL_MET_THRESHOLD * effectiveGoal;
  if (!wasGoalMetFired && prevConsumed < threshold && newConsumed >= threshold) {
    set({ goalMetFiredToday: true });
  }
},
```

- [ ] **Step 2: Run the strict-cross tests to confirm pass (midnight-reset test still fails)**

Run: `npx jest __tests__/waterStoreArchive.test.ts -t 'goalMetFiredToday'`

Expected: the three `logWater`-related tests PASS; the `resets goalMetFiredToday on midnight reset` test still FAILs.

---

## Task 8: Reset `goalMetFiredToday` in `checkMidnightReset` + update `goalMet` to 80% threshold

**Files:**
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Update `checkMidnightReset`**

In `src/store/useWaterStore.ts`, replace the existing `checkMidnightReset` implementation with:

```ts
checkMidnightReset: () => {
  const today = getTodayDate();
  const state = get();
  if (state.date !== today && state.date !== '') {
    const { useHistoryStore } = require('./useHistoryStore');
    const { useGoalStore } = require('./useGoalStore');
    const goalState = useGoalStore.getState();
    const threshold = GOAL_MET_THRESHOLD * goalState.effectiveGoal;
    useHistoryStore.getState().archiveDay({
      date: state.date,
      consumed: state.consumed,
      effectiveGoal: goalState.effectiveGoal,
      // 80% threshold: streak continuation and historical "goal met" share
      // GOAL_MET_THRESHOLD. See analytics spec §Streak threshold (v2).
      goalMet: state.consumed >= threshold,
      activeMinutes: goalState.lastActiveMinutes,
      weatherBonus: goalState.weatherBonus,
    });

    set({
      consumed: 0,
      lastLoggedAt: null,
      lastLogAmount: null,
      date: today,
      goalCelebratedToday: false,
      goalMetFiredToday: false,
    });
    const goalStore = useGoalStore.getState();
    goalStore.resetDaily();
    goalStore.recalculateMorningGoal();
  }
},
```

- [ ] **Step 2: Run all water-store tests**

Run: `npx jest __tests__/waterStoreArchive.test.ts`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/store/useWaterStore.ts __tests__/waterStoreArchive.test.ts
git commit -m "feat: emit goal met at 80% strict-cross with day-scoped flag"
```

---

## Task 9: Update existing 100%-threshold tests to match new 80% streak rule

**Files:**
- Modify: `__tests__/waterStoreArchive.test.ts` (the first `describe('checkMidnightReset archives previous day')`)
- Modify: `__tests__/useHistoryStore.test.ts`

- [ ] **Step 1: Fix the `archives yesterday data` test for the new threshold**

In `__tests__/waterStoreArchive.test.ts`, find:

```ts
expect(snapshots[yesterdayStr].goalMet).toBe(false);
```

and replace with:

```ts
// Under v2_80pct: 2500 / 2800 = 0.893 > 0.8, so goalMet is now true.
expect(snapshots[yesterdayStr].goalMet).toBe(true);
```

Also add a new test immediately after:

```ts
it('archives goalMet=false when consumed below 80% of effectiveGoal', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  useWaterStore.setState({
    consumed: 2000, // 2000 / 2800 = 0.714, below 0.8
    date: yesterdayStr,
  });
  useGoalStore.setState({ effectiveGoal: 2800, lastActiveMinutes: 0, weatherBonus: 0 });

  useWaterStore.getState().checkMidnightReset();

  const { snapshots } = useHistoryStore.getState();
  expect(snapshots[yesterdayStr].goalMet).toBe(false);
});
```

- [ ] **Step 2: Run `waterStoreArchive.test.ts` — confirm all pass**

Run: `npx jest __tests__/waterStoreArchive.test.ts`

Expected: all tests PASS.

- [ ] **Step 3: Review `useHistoryStore.test.ts` for any threshold assumptions**

Read `__tests__/useHistoryStore.test.ts`. The `makeSnapshot` helper uses `goalMet: consumed >= goal` (100%). Existing streak tests pass because they hand-craft values where `consumed >= goal` is equivalent under both thresholds. No edit needed there — the streak tests test the streak-computation logic on pre-computed snapshots, not the archive threshold.

Run: `npx jest __tests__/useHistoryStore.test.ts`

Expected: all tests PASS (no changes required).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add __tests__/waterStoreArchive.test.ts
git commit -m "test: update archive tests for 80% streak threshold"
```

---

# Phase 2 — Analytics service (isolated, no app wiring yet)

## Task 10: Create `events.ts` — `EVENT_NAMES`, `EventMap`, `BaseEventProps`, `SuperProperties`, `TrackArgs`, `PROFILE_UPDATE_ALLOWED_FIELDS`

**Files:**
- Create: `src/services/analytics/events.ts`

- [ ] **Step 1: Create the events module**

Create `src/services/analytics/events.ts`:

```ts
// Event catalog — single source of truth.
// See docs/superpowers/specs/2026-04-21-mixpanel-analytics-design.md §Event catalog.

import type { UserProfile } from '../../types';

// -------- Event names (tuple → type) --------

export const EVENT_NAMES = [
  'App Opened',
  'App Foregrounded',
  'App Backgrounded',
  'Screen Viewed',
  'Onboarding Started',
  'Onboarding Completed',
  'Water Logged',
  'Log Undone',
  'Goal Met',
  'Day Streak Continued',
  'Day Streak Broken',
  'Day Ended Below Goal',
  'Smart Goal Recalculated',
  'Weather Fetch Failed',
  'Reminders Toggled',
  'Reminder Delivered',
  'Reminder Tapped',
  'Health Permission Prompted',
  'Health Permission Result',
  'Activity Sync Completed',
  'Profile Updated',
  'History Viewed',
] as const;

export type EventName = typeof EVENT_NAMES[number];

// -------- Base props merged into every event --------

export type BaseEventProps = {
  app_version: string;
  build_number: string;
};

// -------- Event → props mapping --------

export type EventMap = {
  'App Opened': { days_since_install: number; session_source: 'cold' | 'notification_tap' | 'deep_link' };
  'App Foregrounded': { background_duration_sec: number };
  'App Backgrounded': { foreground_duration_sec: number };
  'Screen Viewed': { screen_name: string; previous_screen: string | null };
  'Onboarding Started': never;
  'Onboarding Completed': { duration_sec: number };
  'Water Logged': {
    amount_ml: number;
    source: 'quick' | 'custom' | 'suggested';
    /** Device local hour, 0–23. NOT UNIQUE WITHIN A DAY on DST fall-back — the 1:00–2:00
     * local hour occurs twice on transition day; pair with event timestamp for ordering. */
    local_hour: number;
    pct_of_goal_after: number;
    is_first_log_of_day: boolean;
  };
  'Log Undone': { amount_ml: number; time_since_log_sec: number };
  'Goal Met': { goal_ml: number; consumed_ml: number };
  'Day Streak Continued': { streak_days: number; goal_ml: number; consumed_ml: number };
  'Day Streak Broken': { previous_streak_days: number; goal_ml: number; consumed_ml: number };
  'Day Ended Below Goal': {
    goal_ml: number;
    consumed_ml: number;
    pct_of_goal: number;
    /** True iff consumed_ml >= 0.8 * goal_ml under v2_80pct. Always false when this event
     * fires in v2 (XOR invariant), but kept typed so future version changes can slice. */
    streak_threshold_met: boolean;
  };
  'Smart Goal Recalculated': {
    base_ml: number;
    weather_bump_ml: number;
    activity_bump_ml: number;
    effective_goal_ml: number;
    reason: 'app_open' | 'morning' | 'activity_sync' | 'weather_refresh';
  };
  'Weather Fetch Failed': { error_code: string; fallback_used: 'climate' | 'none' };
  'Reminders Toggled': { enabled: boolean };
  'Reminder Delivered': { scheduled_hour: number; consumed_ml: number; goal_ml: number };
  'Reminder Tapped': { scheduled_hour: number };
  'Health Permission Prompted': { platform: 'healthkit' | 'health_connect' };
  'Health Permission Result': { platform: 'healthkit' | 'health_connect'; granted: boolean };
  'Activity Sync Completed': { active_minutes: number; bump_ml: number };
  'Profile Updated': {
    fields_changed: string[];
    values: Partial<Record<
      'weight_kg' | 'daily_goal_ml' | 'wake_time' | 'sleep_time' | 'activity_level' | 'climate',
      string | number
    >>;
  };
  'History Viewed': { entry_point: 'chart_tap' | 'chart_long_press' };
};

// -------- Conditional tuple for track() --------

// The [EventMap[K]] brackets prevent TypeScript from *distributing* the `extends never`
// check over a union type. Without the brackets, `K extends keyof EventMap` would be
// distributed, and `Foo | never` would reduce to `Foo` — silently losing the
// no-props variant. The bracket wrapping forces TS to evaluate the constraint as a
// tuple, preserving the distinction between `never` and any other props shape.
type HasProps<K extends EventName> = [EventMap[K]] extends [never] ? false : true;

export type TrackArgs<K extends EventName> =
  HasProps<K> extends true
    ? [name: K, props: EventMap[K]]
    : [name: K];

// -------- Super properties (also tag every event) --------

export type SuperProperties = BaseEventProps & {
  platform: 'ios' | 'android';
  days_since_install: number;
  current_streak_days: number;
  has_health_permission: boolean;
  /** Version tag for streak + Goal Met threshold logic. Typed as a string-literal
   * union specifically so TypeScript fails to compile if GOAL_MET_THRESHOLD (or the
   * streak-continuation predicate) changes without bumping this tag — the type
   * *forces* the invariant. Changing the threshold requires widening the union
   * (e.g. 'v2_80pct' | 'v3_90pct') and updating every call site. */
  streak_rule_version: 'v2_80pct';
  activity_level?: 'sedentary' | 'moderate' | 'active';
  climate?: 'cold' | 'temperate' | 'hot' | 'tropical';
  daily_goal_ml?: number;
  wake_time?: string;
  sleep_time?: string;
  weight_kg?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
};

// -------- Runtime allowlist for Profile Updated values --------

export const PROFILE_UPDATE_ALLOWED_FIELDS = [
  'weight_kg',
  'daily_goal_ml',
  'wake_time',
  'sleep_time',
  'activity_level',
  'climate',
] as const;

export type ProfileUpdateAllowedField = typeof PROFILE_UPDATE_ALLOWED_FIELDS[number];

// Helper used by both the runtime filter and the contract test.
export function filterProfileUpdateValues(
  values: Record<string, unknown>,
): Partial<Record<ProfileUpdateAllowedField, string | number>> {
  const allowed = new Set<string>(PROFILE_UPDATE_ALLOWED_FIELDS);
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (allowed.has(k)) filtered[k] = v;
  }
  return filtered as Partial<Record<ProfileUpdateAllowedField, string | number>>;
}
```

Note: `UserProfile` import is currently unused but kept for future use when the profile-to-super-property mapper lives here. Remove if unused at compile time.

- [ ] **Step 2: If `UserProfile` is unused at this point, drop the import**

If TypeScript warns about an unused import, remove the `import type { UserProfile } from '../../types';` line. (The mapper lives in `client.ts` in Task 14.)

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/services/analytics/events.ts
git commit -m "feat(analytics): add event catalog and super-property types"
```

---

## Task 11: Write the events contract test

**Files:**
- Create: `src/services/analytics/__tests__/events.contract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/analytics/__tests__/events.contract.test.ts`:

```ts
import {
  EVENT_NAMES,
  PROFILE_UPDATE_ALLOWED_FIELDS,
  filterProfileUpdateValues,
  type EventMap,
} from '../events';

// Sample concrete props for each event so the contract test can iterate *keys*.
// Keep this in sync with EventMap — the test asserts that every event name has a
// sample, which catches drift when new events are added without updating the
// contract test.
const SAMPLE_PROPS: { [K in keyof EventMap]: EventMap[K] extends never ? null : Record<string, unknown> } = {
  'App Opened': { days_since_install: 0, session_source: 'cold' },
  'App Foregrounded': { background_duration_sec: 0 },
  'App Backgrounded': { foreground_duration_sec: 0 },
  'Screen Viewed': { screen_name: 'Home', previous_screen: null },
  'Onboarding Started': null as never,
  'Onboarding Completed': { duration_sec: 0 },
  'Water Logged': { amount_ml: 0, source: 'quick', local_hour: 0, pct_of_goal_after: 0, is_first_log_of_day: true },
  'Log Undone': { amount_ml: 0, time_since_log_sec: 0 },
  'Goal Met': { goal_ml: 0, consumed_ml: 0 },
  'Day Streak Continued': { streak_days: 0, goal_ml: 0, consumed_ml: 0 },
  'Day Streak Broken': { previous_streak_days: 0, goal_ml: 0, consumed_ml: 0 },
  'Day Ended Below Goal': { goal_ml: 0, consumed_ml: 0, pct_of_goal: 0, streak_threshold_met: false },
  'Smart Goal Recalculated': { base_ml: 0, weather_bump_ml: 0, activity_bump_ml: 0, effective_goal_ml: 0, reason: 'app_open' },
  'Weather Fetch Failed': { error_code: '', fallback_used: 'climate' },
  'Reminders Toggled': { enabled: true },
  'Reminder Delivered': { scheduled_hour: 0, consumed_ml: 0, goal_ml: 0 },
  'Reminder Tapped': { scheduled_hour: 0 },
  'Health Permission Prompted': { platform: 'healthkit' },
  'Health Permission Result': { platform: 'healthkit', granted: true },
  'Activity Sync Completed': { active_minutes: 0, bump_ml: 0 },
  'Profile Updated': { fields_changed: [], values: {} },
  'History Viewed': { entry_point: 'chart_tap' },
};

const TITLE_CASE = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const RESERVED_MIXPANEL_KEYS = new Set([
  'distinct_id', 'time', '$insert_id', '$user_id', '$device_id',
  '$identified_id', '$current_url', '$lib_version',
]);

describe('events contract', () => {
  it('every event name is Title Case', () => {
    for (const name of EVENT_NAMES) {
      expect(name).toMatch(TITLE_CASE);
    }
  });

  it('no event name is a Mixpanel reserved key or mp_reserved_*', () => {
    for (const name of EVENT_NAMES) {
      expect(RESERVED_MIXPANEL_KEYS.has(name)).toBe(false);
      expect(name.startsWith('mp_reserved_')).toBe(false);
    }
  });

  it('every property key is snake_case', () => {
    for (const [name, props] of Object.entries(SAMPLE_PROPS)) {
      if (props === null) continue; // never-props event
      for (const key of Object.keys(props)) {
        expect(key).toMatch(SNAKE_CASE);
        expect(RESERVED_MIXPANEL_KEYS.has(key)).toBe(false);
        expect(key.startsWith('mp_reserved_')).toBe(false);
      }
    }
  });

  it('SAMPLE_PROPS covers every EVENT_NAMES entry (prevents drift)', () => {
    for (const name of EVENT_NAMES) {
      expect(Object.prototype.hasOwnProperty.call(SAMPLE_PROPS, name)).toBe(true);
    }
  });

  it('PROFILE_UPDATE_ALLOWED_FIELDS matches Profile Updated.values keys', () => {
    // The EventMap['Profile Updated'].values type has keys defined via Partial<Record<...>>.
    // We assert that the runtime allowlist and the values in SAMPLE_PROPS stay in sync by
    // checking filterProfileUpdateValues() drops unknown keys and preserves allowed ones.
    const input = {
      weight_kg: 70,
      daily_goal_ml: 2800,
      wake_time: '07:00',
      sleep_time: '23:00',
      activity_level: 'moderate',
      climate: 'temperate',
      name: 'Leak Test', // must be dropped
      email: 'leak@example.com', // must be dropped
    };
    const filtered = filterProfileUpdateValues(input);
    expect(Object.keys(filtered).sort()).toEqual([...PROFILE_UPDATE_ALLOWED_FIELDS].sort());
    expect(filtered).not.toHaveProperty('name');
    expect(filtered).not.toHaveProperty('email');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/services/analytics/__tests__/events.contract.test.ts`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics/__tests__/events.contract.test.ts
git commit -m "test(analytics): add events contract test"
```

---

## Task 12: Create `privacy.ts` (dev-only PII guard)

**Files:**
- Create: `src/services/analytics/privacy.ts`

- [ ] **Step 1: Create the module**

Create `src/services/analytics/privacy.ts`:

```ts
// Dev-only PII guard. Warns (never blocks) on suspicious keys or values.
// Zero cost in release via __DEV__ gating.

const PII_KEY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /email/i, reason: 'email in property key' },
  { re: /phone/i, reason: 'phone in property key' },
  { re: /password/i, reason: 'password in property key' },
  { re: /^name$/i, reason: 'raw name in property key' },
];

const EMAIL_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function checkPii(eventName: string, props?: Record<string, unknown>): void {
  if (!__DEV__ || !props) return;
  for (const [key, value] of Object.entries(props)) {
    for (const { re, reason } of PII_KEY_PATTERNS) {
      if (re.test(key)) {
        // eslint-disable-next-line no-console
        console.warn(`[analytics] possible PII in "${eventName}": ${reason} (key="${key}")`);
      }
    }
    if (typeof value === 'string' && EMAIL_VALUE_RE.test(value)) {
      // eslint-disable-next-line no-console
      console.warn(`[analytics] possible PII in "${eventName}": email-like string in "${key}"`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/analytics/privacy.ts
git commit -m "feat(analytics): add dev-only PII guard"
```

---

## Task 13: Write failing tests for `privacy.ts`

**Files:**
- Create: `src/services/analytics/__tests__/privacy.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/services/analytics/__tests__/privacy.test.ts`:

```ts
import { checkPii } from '../privacy';

describe('checkPii (dev-only PII guard)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns on email-ish key', () => {
    checkPii('Test Event', { user_email: 'x' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('email in property key'));
  });

  it('warns on phone key', () => {
    checkPii('Test Event', { phone_number: '555' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('phone in property key'));
  });

  it('warns on password key', () => {
    checkPii('Test Event', { user_password: 'hunter2' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('password in property key'));
  });

  it('warns on raw name key', () => {
    checkPii('Test Event', { name: 'Alice' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('raw name in property key'));
  });

  it('does not warn on name-like but compound key (e.g. "activity_level")', () => {
    checkPii('Test Event', { activity_level: 'moderate', daily_goal_ml: 2800 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns on email-like string value', () => {
    checkPii('Test Event', { contact: 'user@example.com' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('email-like string'));
  });

  it('silent on clean props', () => {
    checkPii('Water Logged', { amount_ml: 250, source: 'quick', is_first_log_of_day: true });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('silent when props is undefined', () => {
    checkPii('Onboarding Started');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/services/analytics/__tests__/privacy.test.ts`

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics/__tests__/privacy.test.ts
git commit -m "test(analytics): add PII guard tests"
```

---

## Task 14: Create `client.ts` — `Mixpanel` singleton, `doInit`, `initAnalytics`, `initAnalyticsForBackground`, pre-init queue, `track`, `flush`, `reset`, `setLoggingEnabled`, `identify`, `alias`, `timeEvent`, `registerSuperProperties`, `incrementProperty`, `syncUserProfile`, `syncSessionProperties`, `optIn`, `optOut`, `hasOptedOut`

**Files:**
- Create: `src/services/analytics/client.ts`

This task is large because it builds the service body. The test task that follows breaks coverage into discrete assertions. If you'd rather split this into sub-tasks before committing, that's reasonable — the commit boundary here is "full client.ts compiles and type-checks; tests added in Task 15".

- [ ] **Step 1: Create the client module**

Create `src/services/analytics/client.ts`:

```ts
// Analytics client: wraps mixpanel-react-native v3 with a memoized init,
// bounded pre-init queue, and the public API surface exported from ./index.ts.
// See docs/superpowers/specs/2026-04-21-mixpanel-analytics-design.md.

import { Platform } from 'react-native';
import { Mixpanel } from 'mixpanel-react-native';
import DeviceInfo from 'react-native-device-info';
import { mmkv } from '../../store/mmkv';
import { MIXPANEL_TOKEN, MIXPANEL_SERVER_URL } from '../../config';
import {
  type EventName,
  type EventMap,
  type SuperProperties,
  type TrackArgs,
  PROFILE_UPDATE_ALLOWED_FIELDS,
  filterProfileUpdateValues,
} from './events';
import { checkPii } from './privacy';

// ----- Module singletons -----

const mixpanel = new Mixpanel(MIXPANEL_TOKEN, false); // auto-events OFF

let initPromise: Promise<void> | null = null;
let initialized = false;

// ----- Pre-init queue -----

type QueuedCall =
  | { kind: 'track'; name: EventName; props?: Record<string, unknown> }
  | { kind: 'identify'; distinctId: string }
  | { kind: 'timeEvent'; name: EventName }
  | { kind: 'registerSuperProperties'; props: Partial<SuperProperties> }
  | { kind: 'incrementProperty'; prop: string; by: number }
  | { kind: 'syncUserProfile'; profile: Record<string, unknown> }
  | { kind: 'syncSessionProperties' };

const QUEUE_CAP = 50;
const QUEUE_TIMEOUT_MS = 10_000;
let queue: QueuedCall[] = [];
let queueTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
let queueOverflowWarned = false;

function enqueue(call: QueuedCall): void {
  if (queue.length >= QUEUE_CAP) {
    queue.shift();
    if (__DEV__ && !queueOverflowWarned) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] pre-init queue overflow — oldest events dropped');
      queueOverflowWarned = true;
    }
  }
  queue.push(call);
  if (queueTimeoutHandle === null) {
    queueTimeoutHandle = setTimeout(() => {
      // Drain without dispatching — local in-memory discard, does NOT flip MMKV opt-out.
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] pre-init queue 10s timeout — drained without dispatching');
      }
      queue = [];
      queueOverflowWarned = false;
      queueTimeoutHandle = null;
    }, QUEUE_TIMEOUT_MS);
  }
}

function clearQueueTimer(): void {
  if (queueTimeoutHandle !== null) {
    clearTimeout(queueTimeoutHandle);
    queueTimeoutHandle = null;
  }
}

export function drainPreInitQueue(opts: { discard: boolean }): void {
  clearQueueTimer();
  const toFlush = queue;
  queue = [];
  queueOverflowWarned = false;
  if (opts.discard) return;
  for (const call of toFlush) dispatch(call);
}

// Uses raw mixpanel instance methods (not the public `track` / `identify` / etc.
// exports) because during queue drainage `initialized` is still false — the
// public API would re-enqueue, causing infinite recursion. This function runs
// only from the init path after `mixpanel.init()` resolves but before
// `initialized = true` is set.
function dispatch(call: QueuedCall): void {
  switch (call.kind) {
    case 'track': {
      const merged = { ...baseEventProps(), ...(call.props ?? {}) };
      mixpanel.track(call.name, merged);
      break;
    }
    case 'identify':
      mixpanel.identify(call.distinctId);
      break;
    case 'timeEvent':
      mixpanel.timeEvent(call.name);
      break;
    case 'registerSuperProperties':
      mixpanel.registerSuperProperties(call.props);
      break;
    case 'incrementProperty':
      mixpanel.getPeople().increment(call.prop, call.by);
      break;
    case 'syncUserProfile':
      applySyncUserProfile(call.profile);
      break;
    case 'syncSessionProperties':
      applySyncSessionProperties();
      break;
  }
}

// ----- Base / session props -----

function baseEventProps(): { app_version: string; build_number: string } {
  return {
    app_version: DeviceInfo.getVersion(),
    build_number: DeviceInfo.getBuildNumber(),
  };
}

function installedAt(): number {
  const existing = mmkv.getNumber('analytics:installedAt');
  if (existing && existing > 0) return existing;
  const now = Date.now();
  mmkv.set('analytics:installedAt', now);
  return now;
}

function daysSinceInstall(): number {
  return Math.floor((Date.now() - installedAt()) / 86_400_000);
}

function currentStreakDays(): number {
  const { useHistoryStore } = require('../../store/useHistoryStore');
  return useHistoryStore.getState().getCurrentStreak();
}

// getHealthPermissionStatus lives in healthService; we read it lazily to avoid a cycle.
function hasHealthPermission(): boolean {
  try {
    const { getHealthPermissionStatus } = require('../../utils/healthService');
    return getHealthPermissionStatus();
  } catch {
    return false;
  }
}

// ----- Init -----

async function doInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const optedOut = mmkv.getBoolean('analytics:optedOut') ?? false;

    // Touch installedAt to write it if missing (side-effect of the getter).
    installedAt();

    await mixpanel.init(optedOut, undefined, MIXPANEL_SERVER_URL);
    mixpanel.setLoggingEnabled(__DEV__);

    drainPreInitQueue({ discard: optedOut });

    applySyncSessionProperties();

    const { useUserStore } = require('../../store/useUserStore');
    if (useUserStore.getState().onboardingComplete) {
      applySyncUserProfile(mapUserProfileToSuperProps(useUserStore.getState()));
    }

    initialized = true;
  })();
  return initPromise;
}

export async function initAnalytics(): Promise<void> {
  await doInit();
  track('App Opened', {
    days_since_install: daysSinceInstall(),
    session_source: 'cold',
  });
}

export async function initAnalyticsForBackground(): Promise<void> {
  await doInit();
  // no App Opened — background entry
}

// ----- Sync helpers -----

function mapUserProfileToSuperProps(
  p: {
    weight: number;
    age: number;
    gender: 'male' | 'female' | 'other';
    activityLevel: 'sedentary' | 'moderate' | 'active';
    climatePreference: 'cold' | 'temperate' | 'hot' | 'tropical';
    wakeUpTime: { hour: number; minute: number };
    sleepTime: { hour: number; minute: number };
    dailyGoal: number;
  },
): Record<string, unknown> {
  const fmt = (t: { hour: number; minute: number }) =>
    `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  return {
    weight_kg: p.weight,
    age: p.age,
    gender: p.gender,
    activity_level: p.activityLevel,
    climate: p.climatePreference,
    wake_time: fmt(p.wakeUpTime),
    sleep_time: fmt(p.sleepTime),
    daily_goal_ml: p.dailyGoal,
  };
}

function applySyncUserProfile(profile: Record<string, unknown>): void {
  mixpanel.registerSuperProperties(profile);
  mixpanel.getPeople().set(profile);
}

function applySyncSessionProperties(): void {
  const props: Partial<SuperProperties> = {
    app_version: baseEventProps().app_version,
    build_number: baseEventProps().build_number,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    days_since_install: daysSinceInstall(),
    current_streak_days: currentStreakDays(),
    has_health_permission: hasHealthPermission(),
    streak_rule_version: 'v2_80pct',
  };
  mixpanel.registerSuperProperties(props);
}

// ----- Public API -----

export function track<K extends EventName>(...args: TrackArgs<K>): void {
  const name = args[0];
  // `args` shape: [name] for never-props, [name, props] otherwise.
  const props = args.length > 1 ? (args[1] as Record<string, unknown>) : undefined;

  // Profile Updated runtime allowlist — drop disallowed fields before dispatch.
  let finalProps = props;
  if (name === 'Profile Updated' && props) {
    const raw = props as { fields_changed: string[]; values: Record<string, unknown> };
    finalProps = {
      fields_changed: raw.fields_changed,
      values: filterProfileUpdateValues(raw.values ?? {}),
    };
  }

  if (__DEV__) checkPii(name, finalProps);

  if (!initialized) {
    enqueue({ kind: 'track', name, props: finalProps });
    return;
  }
  const merged = { ...baseEventProps(), ...(finalProps ?? {}) };
  mixpanel.track(name, merged);
}

export async function identify(distinctId: string): Promise<void> {
  if (!initialized) { enqueue({ kind: 'identify', distinctId }); return; }
  await mixpanel.identify(distinctId);
}

export async function alias(alias: string, distinctId?: string): Promise<void> {
  await doInit();
  await mixpanel.alias(alias, distinctId);
}

export function timeEvent<K extends EventName>(name: K): void {
  if (!initialized) { enqueue({ kind: 'timeEvent', name }); return; }
  mixpanel.timeEvent(name);
}

export function registerSuperProperties(props: Partial<SuperProperties>): void {
  if (!initialized) { enqueue({ kind: 'registerSuperProperties', props }); return; }
  mixpanel.registerSuperProperties(props);
}

export function incrementProperty(prop: string, by = 1): void {
  if (!initialized) { enqueue({ kind: 'incrementProperty', prop, by }); return; }
  mixpanel.getPeople().increment(prop, by);
}

export function syncUserProfile(
  profile: Parameters<typeof mapUserProfileToSuperProps>[0],
): void {
  const mapped = mapUserProfileToSuperProps(profile);
  if (!initialized) { enqueue({ kind: 'syncUserProfile', profile: mapped }); return; }
  applySyncUserProfile(mapped);
}

export function syncSessionProperties(): void {
  if (!initialized) { enqueue({ kind: 'syncSessionProperties' }); return; }
  applySyncSessionProperties();
}

// ----- Opt-out plumbing -----

export async function optOut(): Promise<void> {
  await doInit();
  await mixpanel.flush(); // LOAD-BEARING: optOutTracking deletes unflushed events
  mmkv.set('analytics:optedOut', true);
  mixpanel.optOutTracking();
  await mixpanel.reset();
  // resetScreenTrackingState is called from the Settings toggle site, not here —
  // see screenTracking.ts and opt-in flow.
}

export function optIn(): void {
  mmkv.delete('analytics:optedOut');
  mixpanel.optInTracking();
  syncSessionProperties();
  const { useUserStore } = require('../../store/useUserStore');
  if (useUserStore.getState().onboardingComplete) {
    syncUserProfile(useUserStore.getState());
  }
  const { resetScreenTrackingState } = require('./screenTracking');
  resetScreenTrackingState();
}

export async function hasOptedOut(): Promise<boolean> {
  return (mmkv.getBoolean('analytics:optedOut') ?? false);
}

export async function reset(): Promise<void> {
  await doInit();
  await mixpanel.reset();
}

export async function flush(): Promise<void> {
  await doInit();
  await mixpanel.flush();
}

// ----- Test-only reset hook -----
// Not exported from index.ts. Tests import directly from './client'.
export function __resetForTests(): void {
  initPromise = null;
  initialized = false;
  queue = [];
  queueOverflowWarned = false;
  clearQueueTimer();
}
```

- [ ] **Step 2: Check `src/store/mmkv.ts` exports `mmkv`**

Run: `grep -n "export" src/store/mmkv.ts`

If `mmkv` isn't exported, add `export { mmkv }` (or adjust the import in `client.ts` to match the actual export name — likely `zustandStorage` and a raw MMKV instance). Read the file to confirm:

Run: `cat src/store/mmkv.ts`

Adjust the import line at the top of `client.ts` to match the real exported name. The analytics module needs direct MMKV access for:
- `analytics:optedOut` (boolean)
- `analytics:installedAt` (number)

If only `zustandStorage` is exported, export the raw MMKV instance as well from `src/store/mmkv.ts` (add `export const mmkv = <the instance>`) and import from there.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`

Expected: exit 0. If errors, fix imports / type references inline.

- [ ] **Step 4: Commit**

```bash
git add src/services/analytics/client.ts src/store/mmkv.ts
git commit -m "feat(analytics): add client with split init and pre-init queue"
```

---

## Task 15: Write `client.test.ts`

**Files:**
- Create: `src/services/analytics/__tests__/client.test.ts`

- [ ] **Step 1: Create the test file with init + concurrency + queue + App Opened assertions**

Create `src/services/analytics/__tests__/client.test.ts`:

```ts
import { Mixpanel, __resetMocks } from 'mixpanel-react-native';

// Minimal mmkv test shim — attached via jest.mock to avoid the real MMKV native module.
const mmkvStore: Record<string, unknown> = {};
jest.mock('../../../store/mmkv', () => ({
  mmkv: {
    getBoolean: (k: string) => mmkvStore[k] as boolean | undefined,
    set: (k: string, v: unknown) => { mmkvStore[k] = v; },
    delete: (k: string) => { delete mmkvStore[k]; },
    getNumber: (k: string) => mmkvStore[k] as number | undefined,
  },
  zustandStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  writeWidgetData: jest.fn(),
}));

jest.mock('../../../store/useUserStore', () => ({
  useUserStore: {
    getState: () => ({
      onboardingComplete: false,
      name: '', weight: 70, age: 25, gender: 'other',
      activityLevel: 'moderate', climatePreference: 'temperate',
      wakeUpTime: { hour: 7, minute: 0 }, sleepTime: { hour: 23, minute: 0 },
      dailyGoal: 2800,
    }),
  },
}));

jest.mock('../../../store/useHistoryStore', () => ({
  useHistoryStore: { getState: () => ({ getCurrentStreak: () => 0 }) },
}));

jest.mock('../../../utils/healthService', () => ({
  getHealthPermissionStatus: () => false,
}));

import {
  initAnalytics,
  initAnalyticsForBackground,
  track,
  optOut,
  optIn,
  hasOptedOut,
  syncUserProfile,
  syncSessionProperties,
  __resetForTests,
} from '../client';

function getMixpanelInstance(): jest.Mocked<Mixpanel> {
  // The Mixpanel class is constructed once at module load — grab the latest instance
  // by inspecting the mock's constructor calls.
  const ctor = Mixpanel as unknown as jest.Mock;
  return ctor.mock.instances[ctor.mock.instances.length - 1];
}

describe('analytics client', () => {
  beforeEach(() => {
    __resetForTests();
    __resetMocks();
    for (const k of Object.keys(mmkvStore)) delete mmkvStore[k];
    (Mixpanel as unknown as jest.Mock).mock.instances.forEach((inst) => {
      (inst.init as jest.Mock).mockClear();
      (inst.track as jest.Mock).mockClear();
      (inst.registerSuperProperties as jest.Mock).mockClear();
      (inst.optOutTracking as jest.Mock).mockClear();
      (inst.optInTracking as jest.Mock).mockClear();
      (inst.flush as jest.Mock).mockClear();
      (inst.reset as jest.Mock).mockClear();
    });
  });

  describe('init', () => {
    it('runs doInit exactly once across concurrent initAnalytics calls', async () => {
      await Promise.all([initAnalytics(), initAnalytics(), initAnalytics()]);
      expect(getMixpanelInstance().init).toHaveBeenCalledTimes(1);
    });

    it('initAnalytics emits App Opened', async () => {
      await initAnalytics();
      const mp = getMixpanelInstance();
      const trackCalls = mp.track.mock.calls.filter(([name]) => name === 'App Opened');
      expect(trackCalls).toHaveLength(1);
    });

    it('initAnalyticsForBackground does NOT emit App Opened', async () => {
      await initAnalyticsForBackground();
      const mp = getMixpanelInstance();
      const trackCalls = mp.track.mock.calls.filter(([name]) => name === 'App Opened');
      expect(trackCalls).toHaveLength(0);
    });

    it('background-then-foreground still emits exactly one App Opened', async () => {
      await initAnalyticsForBackground();
      await initAnalytics();
      const mp = getMixpanelInstance();
      const trackCalls = mp.track.mock.calls.filter(([name]) => name === 'App Opened');
      expect(trackCalls).toHaveLength(1);
    });

    it('analytics:installedAt is written on first init', async () => {
      expect(mmkvStore['analytics:installedAt']).toBeUndefined();
      await initAnalytics();
      expect(typeof mmkvStore['analytics:installedAt']).toBe('number');
    });
  });

  describe('pre-init queue', () => {
    it('queues events before init and flushes them in FIFO order', async () => {
      track('Onboarding Started');
      track('Water Logged', {
        amount_ml: 250, source: 'quick', local_hour: 10,
        pct_of_goal_after: 0.1, is_first_log_of_day: true,
      });
      await initAnalytics();
      const mp = getMixpanelInstance();
      const names = mp.track.mock.calls.map(([n]) => n);
      expect(names).toEqual(['Onboarding Started', 'Water Logged', 'App Opened']);
    });

    it('opted-out at init discards queue without dispatch', async () => {
      mmkvStore['analytics:optedOut'] = true;
      track('Water Logged', {
        amount_ml: 250, source: 'quick', local_hour: 10,
        pct_of_goal_after: 0.1, is_first_log_of_day: true,
      });
      await initAnalytics();
      const mp = getMixpanelInstance();
      expect(mp.track).not.toHaveBeenCalled();
    });

    it('10s timeout drains the queue without dispatch and without flipping optOut', async () => {
      jest.useFakeTimers();
      try {
        track('Onboarding Started');
        jest.advanceTimersByTime(10_001);
        // queue should now be empty; no optOutTracking call
      } finally {
        jest.useRealTimers();
      }
      // Complete init — should not find any queued event
      await initAnalytics();
      const mp = getMixpanelInstance();
      const onboardingCalls = mp.track.mock.calls.filter(([n]) => n === 'Onboarding Started');
      expect(onboardingCalls).toHaveLength(0);
      expect(mp.optOutTracking).not.toHaveBeenCalled();
      expect(mmkvStore['analytics:optedOut']).toBeUndefined();
    });
  });

  describe('opt-out / opt-in', () => {
    it('optOut order: flush → MMKV set → optOutTracking → reset', async () => {
      await initAnalytics();
      const mp = getMixpanelInstance();
      const order: string[] = [];
      (mp.flush as jest.Mock).mockImplementation(async () => { order.push('flush'); });
      (mp.optOutTracking as jest.Mock).mockImplementation(() => { order.push('optOutTracking'); });
      (mp.reset as jest.Mock).mockImplementation(async () => { order.push('reset'); });

      const mmkvSet = jest.spyOn(require('../../../store/mmkv').mmkv, 'set');
      mmkvSet.mockImplementation((k: string) => { if (k === 'analytics:optedOut') order.push('mmkv'); });

      await optOut();

      expect(order).toEqual(['flush', 'mmkv', 'optOutTracking', 'reset']);
    });

    it('optIn order: MMKV delete → optInTracking → syncSessionProperties (via registerSuperProperties)', async () => {
      mmkvStore['analytics:optedOut'] = true;
      await initAnalytics();
      const mp = getMixpanelInstance();
      mp.registerSuperProperties.mockClear();

      optIn();

      expect(mmkvStore['analytics:optedOut']).toBeUndefined();
      expect(mp.optInTracking).toHaveBeenCalled();
      expect(mp.registerSuperProperties).toHaveBeenCalledWith(
        expect.objectContaining({ streak_rule_version: 'v2_80pct' }),
      );
    });

    it('hasOptedOut reads MMKV', async () => {
      mmkvStore['analytics:optedOut'] = true;
      expect(await hasOptedOut()).toBe(true);
      delete mmkvStore['analytics:optedOut'];
      expect(await hasOptedOut()).toBe(false);
    });
  });

  describe('syncUserProfile + syncSessionProperties', () => {
    it('syncUserProfile calls registerSuperProperties AND people.set with mapped fields', async () => {
      await initAnalytics();
      const mp = getMixpanelInstance();
      mp.registerSuperProperties.mockClear();
      (mp.getPeople() as any).set.mockClear();

      syncUserProfile({
        weight: 75, age: 30, gender: 'male', activityLevel: 'active',
        climatePreference: 'hot', wakeUpTime: { hour: 6, minute: 30 },
        sleepTime: { hour: 22, minute: 15 }, dailyGoal: 3100,
      });

      expect(mp.registerSuperProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          weight_kg: 75, age: 30, gender: 'male',
          activity_level: 'active', climate: 'hot',
          wake_time: '06:30', sleep_time: '22:15',
          daily_goal_ml: 3100,
        }),
      );
      expect((mp.getPeople() as any).set).toHaveBeenCalled();
    });

    it('syncSessionProperties writes streak_rule_version v2_80pct', async () => {
      await initAnalytics();
      const mp = getMixpanelInstance();
      mp.registerSuperProperties.mockClear();

      syncSessionProperties();

      expect(mp.registerSuperProperties).toHaveBeenCalledWith(
        expect.objectContaining({ streak_rule_version: 'v2_80pct' }),
      );
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/services/analytics/__tests__/client.test.ts`

Expected: all PASS. If a test fails, read the message, fix the assertion or the client code (don't skip failures).

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics/__tests__/client.test.ts
git commit -m "test(analytics): client init, queue, opt-out, and sync behavior"
```

---

## Task 16: Create `screenTracking.ts` + tests

**Files:**
- Create: `src/services/analytics/screenTracking.ts`
- Create: `src/services/analytics/__tests__/screenTracking.test.ts`

- [ ] **Step 1: Create the module**

Create `src/services/analytics/screenTracking.ts`:

```ts
import type { NavigationState, PartialState } from '@react-navigation/native';
import { track } from './client';

let previousScreen: string | null = null;
let lastScreenName: string | null = null;
let lastScreenAt = 0;
const SAME_ROUTE_DEDUP_MS = 500;

function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | null {
  if (!state) return null;
  const index = (state as NavigationState).index ?? 0;
  const route = state.routes?.[index];
  if (!route) return null;
  if ('state' in route && route.state) {
    return getActiveRouteName(route.state as NavigationState);
  }
  return route.name ?? null;
}

export function onNavigationStateChange(
  state: NavigationState | PartialState<NavigationState> | undefined,
  nowFn: () => number = () => Date.now(),
): void {
  const current = getActiveRouteName(state);
  if (!current) return;
  const now = nowFn();
  if (current === lastScreenName && now - lastScreenAt < SAME_ROUTE_DEDUP_MS) return;
  if (current === lastScreenName) return;
  track('Screen Viewed', { screen_name: current, previous_screen: previousScreen });
  previousScreen = current;
  lastScreenName = current;
  lastScreenAt = now;
}

export function resetScreenTrackingState(): void {
  previousScreen = null;
  lastScreenName = null;
  lastScreenAt = 0;
}
```

- [ ] **Step 2: Create the test file**

Create `src/services/analytics/__tests__/screenTracking.test.ts`:

```ts
jest.mock('../client', () => ({ track: jest.fn() }));

import { track } from '../client';
import { onNavigationStateChange, resetScreenTrackingState } from '../screenTracking';

const mockTrack = track as unknown as jest.Mock;

function state(name: string): any {
  return { index: 0, routes: [{ name }] };
}

describe('screenTracking', () => {
  beforeEach(() => {
    resetScreenTrackingState();
    mockTrack.mockClear();
  });

  it('fires once per distinct route', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('dedups identical consecutive routes any time', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Home'), () => 5000);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('dedups rapid same-route within 500ms', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Home'), () => 1100);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('first event has previous_screen: null (cold start)', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    expect(mockTrack).toHaveBeenCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Home', previous_screen: null }),
    );
  });

  it('previous_screen chains correctly', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    expect(mockTrack).toHaveBeenLastCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Settings', previous_screen: 'Home' }),
    );
  });

  it('resetScreenTrackingState returns to cold-start state', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    resetScreenTrackingState();
    onNavigationStateChange(state('Settings'), () => 3000);
    expect(mockTrack).toHaveBeenLastCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Settings', previous_screen: null }),
    );
  });

  it('handles nested nav state (tabs inside stack)', () => {
    const nested = { index: 0, routes: [{ name: 'Root', state: { index: 0, routes: [{ name: 'Home' }] } }] };
    onNavigationStateChange(nested, () => 1000);
    expect(mockTrack).toHaveBeenCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Home' }),
    );
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/services/analytics/__tests__/screenTracking.test.ts`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/analytics/screenTracking.ts src/services/analytics/__tests__/screenTracking.test.ts
git commit -m "feat(analytics): screen tracking with rapid same-route dedup"
```

---

## Task 17: Create `index.ts` re-exports

**Files:**
- Create: `src/services/analytics/index.ts`

- [ ] **Step 1: Create `index.ts`**

Create `src/services/analytics/index.ts`:

```ts
export {
  initAnalytics,
  initAnalyticsForBackground,
  track,
  identify,
  alias,
  timeEvent,
  registerSuperProperties,
  incrementProperty,
  syncUserProfile,
  syncSessionProperties,
  optIn,
  optOut,
  hasOptedOut,
  reset,
  flush,
} from './client';

export { onNavigationStateChange, resetScreenTrackingState } from './screenTracking';

export type { EventName, EventMap, SuperProperties, TrackArgs, BaseEventProps } from './events';
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics/index.ts
git commit -m "feat(analytics): public API index"
```

---

# Phase 3 — Wire the service into the app shell

## Task 17.5: Attach `hour` to scheduled notification payloads

**Files:**
- Modify: `src/utils/notificationScheduler.ts`

`Reminder Delivered` / `Reminder Tapped` events carry `scheduled_hour`. Today the scheduler encodes the hour only in the notification ID (`water-reminder-{hour}`); `notification.data` is empty. Adding `data: { hour }` to every scheduled notification is the clean solution and doesn't affect existing consumers (the ID still works for cancel-by-prefix).

- [ ] **Step 1: Attach `data.hour` to each trigger notification**

In `src/utils/notificationScheduler.ts`, inside `scheduleReminders` replace the `createTriggerNotification` call with:

```ts
await notifee.createTriggerNotification(
  {
    id: `${NOTIFICATION_ID_PREFIX}${hour}`,
    title: 'Water Reminder',
    body: `Time to drink water! You've had ${consumedL}L of ${goalL}L today.`,
    data: { hour: String(hour) },
    android: {
      channelId: CHANNEL_ID,
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'water_drop.wav',
      interruptionLevel: 'timeSensitive',
      foregroundPresentationOptions: {
        sound: true,
        banner: true,
        list: true,
        badge: true,
      },
    },
  },
  trigger,
);
```

Notifee's `data` field requires string values (native bridge constraint), hence `String(hour)`. Parsed back to a number in the handler via `parseInt`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/utils/notificationScheduler.ts
git commit -m "feat(reminders): attach hour to notification data payload"
```

---

## Task 18: Initialize analytics from `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add init + onStateChange + AppState listener**

Edit `App.tsx`. Replace the imports + `App` function with:

```tsx
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useUserStore } from './src/store/useUserStore';
import { useWaterStore } from './src/store/useWaterStore';
import { useGoalStore } from './src/store/useGoalStore';
import { scheduleReminders } from './src/utils/notificationScheduler';
import { HomeIcon, SettingsIcon } from './src/components/TabIcons';
import { Fonts } from './src/fonts';
import {
  initAnalytics,
  initAnalyticsForBackground,
  onNavigationStateChange,
  track,
} from './src/services/analytics';

const Tab = createBottomTabNavigator();

function MainTabs() {
  // unchanged body — keep as-is from existing file
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

  // Analytics init — fire once on mount.
  useEffect(() => {
    initAnalytics();
  }, []);

  // Notifee foreground handler: log Reminder Delivered / Tapped.
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.DELIVERED) {
        await initAnalyticsForBackground();
        const consumed = useWaterStore.getState().consumed;
        const goal = useGoalStore.getState().effectiveGoal;
        const scheduledHour = parseReminderHour(detail.notification?.data);
        track('Reminder Delivered', {
          scheduled_hour: scheduledHour,
          consumed_ml: consumed,
          goal_ml: goal,
        });
      } else if (type === EventType.PRESS) {
        await initAnalyticsForBackground();
        const scheduledHour = parseReminderHour(detail.notification?.data);
        track('Reminder Tapped', { scheduled_hour: scheduledHour });
      }
    });
    return unsubscribe;
  }, []);

  // AppState — App Foregrounded / Backgrounded.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundStartRef = useRef<number | null>(null);
  const foregroundStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      const now = Date.now();
      if (prev.match(/inactive|background/) && next === 'active') {
        const bgSec = backgroundStartRef.current
          ? Math.round((now - backgroundStartRef.current) / 1000)
          : 0;
        foregroundStartRef.current = now;
        track('App Foregrounded', { background_duration_sec: bgSec });
      } else if (next.match(/inactive|background/) && prev === 'active') {
        const fgSec = Math.round((now - foregroundStartRef.current) / 1000);
        backgroundStartRef.current = now;
        track('App Backgrounded', { foreground_duration_sec: fgSec });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
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
        <NavigationContainer onStateChange={onNavigationStateChange}>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <OnboardingScreen />
      )}
    </SafeAreaProvider>
  );
}

function parseReminderHour(data: unknown): number {
  if (!data || typeof data !== 'object') return -1;
  const h = (data as Record<string, unknown>).hour;
  const n = typeof h === 'string' ? parseInt(h, 10) : typeof h === 'number' ? h : NaN;
  return Number.isFinite(n) ? n : -1;
}

export default App;
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: exit 0. If `parseReminderHour` complains about data shape, the above typeguard is defensive enough — verify.

- [ ] **Step 3: Run `App.test.tsx` to confirm render still works**

Run: `npx jest __tests__/App.test.tsx`

Expected: PASS (the test mocks native modules; analytics singleton is instantiated but its `init` is mocked).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: wire analytics init, nav tracking, AppState, and Notifee foreground handler"
```

---

## Task 19: Update the Notifee background handler in `index.js`

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Replace the existing handler**

Replace the contents of `index.js` with:

```js
/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { useWaterStore } from './src/store/useWaterStore';
import { useGoalStore } from './src/store/useGoalStore';
import {
  initAnalyticsForBackground,
  track,
  flush,
} from './src/services/analytics';

// Android may spin up a fresh JS VM for the background handler. Analytics init
// and Zustand persist rehydration must complete before reading store state.
//
// persist.rehydrate() is LOAD-BEARING on fresh VMs, not merely defensive:
// useWaterStore uses createJSONStorage(() => zustandStorage), whose interface
// is async. Even though MMKV itself is synchronous, the persist middleware
// schedules hydration asynchronously (microtask). Calling useWaterStore.getState()
// immediately after module load returns the initial defaults, not the persisted
// values. Awaiting rehydrate() is the only way to guarantee persisted state
// is loaded before we read consumed / goal.
//
// iOS typically runs this in the foreground VM, where rehydration completed
// during app startup and initAnalyticsForBackground() is a cheap no-op (memoized
// promise). The rehydrate() await is still safe there — Zustand treats repeat
// calls as idempotent.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.DELIVERED && type !== EventType.PRESS) return;

  await initAnalyticsForBackground();

  if (type === EventType.DELIVERED) {
    // Rehydrate before reading persisted state in fresh VMs (Android).
    await useWaterStore.persist.rehydrate();
    const consumed = useWaterStore.getState().consumed;
    const goal = useGoalStore.getState().effectiveGoal;
    const scheduledHour = parseReminderHour(detail.notification?.data);
    track('Reminder Delivered', {
      scheduled_hour: scheduledHour,
      consumed_ml: consumed,
      goal_ml: goal,
    });
    await flush();
    return;
  }

  // PRESS
  const scheduledHour = parseReminderHour(detail.notification?.data);
  track('Reminder Tapped', { scheduled_hour: scheduledHour });
  await flush();
});

function parseReminderHour(data) {
  if (!data || typeof data !== 'object') return -1;
  const h = data.hour;
  const n = typeof h === 'string' ? parseInt(h, 10) : typeof h === 'number' ? h : NaN;
  return Number.isFinite(n) ? n : -1;
}

AppRegistry.registerComponent(appName, () => App);
```

- [ ] **Step 2: Verify `useWaterStore.persist.rehydrate` exists**

Zustand v5 exposes `.persist.rehydrate()` on stores created with the persist middleware. Confirm by reading the Zustand persist docs if needed, or by running:

```bash
node -e "const s = require('./src/store/useWaterStore'); console.log(typeof s.useWaterStore.persist.rehydrate);"
```

Expected output: `function`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add index.js
git commit -m "feat: wire Notifee background handler to analytics with rehydrate"
```

---

# Phase 4 — Event emission per feature

## Task 20: Emit `Water Logged`, `Goal Met`, `Log Undone` from `useWaterStore`

**Files:**
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Emit events from `logWater` and `undoLastLog`**

In `src/store/useWaterStore.ts`, add at the top (with other imports):

```ts
import { track } from '../services/analytics';
```

Then replace the `logWater` implementation again (this supersedes Task 7 — adds the emissions):

```ts
logWater: (amount, source) => {
  const now = new Date().toISOString();
  const prevConsumed = get().consumed;
  const newConsumed = prevConsumed + amount;
  const wasCelebrated = get().goalCelebratedToday;
  const wasGoalMetFired = get().goalMetFiredToday;

  set({
    consumed: newConsumed,
    lastLoggedAt: now,
    lastLogAmount: amount,
  });

  const { useGoalStore } = require('./useGoalStore');
  const { effectiveGoal } = useGoalStore.getState();
  writeWidgetData(effectiveGoal, newConsumed, now);

  if (!wasCelebrated && newConsumed >= effectiveGoal) {
    set({ goalCelebratedToday: true });
  }

  const threshold = GOAL_MET_THRESHOLD * effectiveGoal;
  const crossedThreshold = !wasGoalMetFired && prevConsumed < threshold && newConsumed >= threshold;
  if (crossedThreshold) {
    set({ goalMetFiredToday: true });
  }

  track('Water Logged', {
    amount_ml: amount,
    source: source ?? 'quick',
    local_hour: new Date().getHours(),
    pct_of_goal_after: effectiveGoal > 0 ? newConsumed / effectiveGoal : 0,
    is_first_log_of_day: prevConsumed === 0,
  });

  if (crossedThreshold) {
    track('Goal Met', {
      goal_ml: effectiveGoal,
      consumed_ml: newConsumed,
    });
  }
},
```

**Signature change required.** `useWaterStore.logWater(amount)` has no `source` argument today. Widen it: `logWater(amount: number, source?: 'quick' | 'custom' | 'suggested')` and default to `'quick'` in the body. Update both call sites:

- `src/screens/HomeScreen.tsx`: quick-log button taps pass `'quick'`.
- `src/components/LogWaterModal.tsx`: custom-amount submit passes `'custom'`.

- [ ] **Step 2: Update `WaterActions` interface**

Replace the `logWater` entry in the `WaterActions` interface:

```ts
logWater: (amount: number, source?: 'quick' | 'custom' | 'suggested') => void;
```

- [ ] **Step 3: Find and update call sites**

Run: `grep -rn "logWater(" src/`

For each call site, pass an explicit source. Quick-log buttons: `'quick'`. LogWaterModal custom amount: `'custom'`. If any site logs a suggested/auto value, use `'suggested'`.

- [ ] **Step 4: Emit `Log Undone` from `undoLastLog`**

In `undoLastLog`, replace:

```ts
undoLastLog: () => {
  const { lastLogAmount, lastLoggedAt, consumed } = get();
  if (lastLogAmount === null) return;
  const timeSinceLogSec = lastLoggedAt
    ? Math.max(0, Math.round((Date.now() - new Date(lastLoggedAt).getTime()) / 1000))
    : 0;
  const newConsumed = Math.max(0, consumed - lastLogAmount);
  set({
    consumed: newConsumed,
    lastLogAmount: null,
    lastLoggedAt: null,
  });
  const { useGoalStore } = require('./useGoalStore');
  const { effectiveGoal } = useGoalStore.getState();
  writeWidgetData(effectiveGoal, newConsumed, null);

  track('Log Undone', {
    amount_ml: lastLogAmount,
    time_since_log_sec: timeSinceLogSec,
  });
},
```

- [ ] **Step 5: Mock analytics in the water-store test**

In `__tests__/waterStoreArchive.test.ts`, at the top of the `jest.mock` block area, add:

```ts
jest.mock('../src/services/analytics', () => ({
  track: jest.fn(),
  initAnalytics: jest.fn().mockResolvedValue(undefined),
  initAnalyticsForBackground: jest.fn().mockResolvedValue(undefined),
}));
```

Then run: `npm test`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/useWaterStore.ts src/screens/HomeScreen.tsx src/components/LogWaterModal.tsx __tests__/waterStoreArchive.test.ts
git commit -m "feat: emit Water Logged, Goal Met, Log Undone from water store"
```

---

## Task 21: Emit `Day Streak Continued`/`Broken` and `Day Ended Below Goal` from midnight reset

**Files:**
- Modify: `src/store/useWaterStore.ts`

- [ ] **Step 1: Update `checkMidnightReset` to emit streak + end-of-day events**

In `src/store/useWaterStore.ts`, replace `checkMidnightReset` with:

```ts
// Computes the streak as of the day before yesterday, i.e. *excluding* the day
// about to be archived. Required because useHistoryStore.getCurrentStreak()
// starts at day -1 (yesterday), and yesterday's snapshot does not exist yet
// at this point — so getCurrentStreak would always return 0 here. By starting
// at i=2, we read the streak that existed BEFORE the day being archived.
function computeStreakExcludingYesterday(
  snapshots: Record<string, { goalMet: boolean }>,
): number {
  let streak = 0;
  const today = new Date();
  for (let i = 2; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const snap = snapshots[key];
    if (!snap || !snap.goalMet) break;
    streak++;
  }
  return streak;
}

// ... inside the store definition:
checkMidnightReset: () => {
  const today = getTodayDate();
  const state = get();
  if (state.date === today || state.date === '') return;

  const { useHistoryStore } = require('./useHistoryStore');
  const { useGoalStore } = require('./useGoalStore');
  const goalState = useGoalStore.getState();
  const threshold = GOAL_MET_THRESHOLD * goalState.effectiveGoal;
  const goalMet = state.consumed >= threshold;

  // Prior streak = streak excluding the day being archived.
  const priorStreak = computeStreakExcludingYesterday(useHistoryStore.getState().snapshots);

  useHistoryStore.getState().archiveDay({
    date: state.date,
    consumed: state.consumed,
    effectiveGoal: goalState.effectiveGoal,
    goalMet,
    activeMinutes: goalState.lastActiveMinutes,
    weatherBonus: goalState.weatherBonus,
  });

  // New streak = streak after adding yesterday's snapshot. If goalMet: priorStreak + 1.
  // If not goalMet: 0 (the chain broke).
  const newStreak = goalMet ? priorStreak + 1 : 0;

  // Goal-status event (XOR).
  if (!state.goalMetFiredToday && !goalMet) {
    track('Day Ended Below Goal', {
      goal_ml: goalState.effectiveGoal,
      consumed_ml: state.consumed,
      pct_of_goal: goalState.effectiveGoal > 0 ? state.consumed / goalState.effectiveGoal : 0,
      streak_threshold_met: goalMet, // always false in this branch under v2
    });
  }
  // If goalMetFiredToday was true OR goal was met at midnight without strict-cross,
  // we emit no goal-status event. See analytics spec §Day-boundary invariant.

  // Streak events (orthogonal — can accompany Day Ended Below Goal).
  if (goalMet) {
    track('Day Streak Continued', {
      streak_days: newStreak,
      goal_ml: goalState.effectiveGoal,
      consumed_ml: state.consumed,
    });
  } else if (priorStreak > 0) {
    track('Day Streak Broken', {
      previous_streak_days: priorStreak,
      goal_ml: goalState.effectiveGoal,
      consumed_ml: state.consumed,
    });
  }

  set({
    consumed: 0,
    lastLoggedAt: null,
    lastLogAmount: null,
    date: today,
    goalCelebratedToday: false,
    goalMetFiredToday: false,
  });
  const goalStore = useGoalStore.getState();
  goalStore.resetDaily();
  goalStore.recalculateMorningGoal();
},
```

- [ ] **Step 2: Add tests**

In `__tests__/waterStoreArchive.test.ts`, add a new `describe` block:

```ts
describe('midnight event emission', () => {
  const { track } = require('../src/services/analytics');
  const mockTrack = track as jest.Mock;

  beforeEach(() => {
    mockTrack.mockClear();
    useWaterStore.setState({
      consumed: 0, lastLoggedAt: null, lastLogAmount: null,
      date: '', goalCelebratedToday: false, goalMetFiredToday: false,
    });
    useGoalStore.setState({ effectiveGoal: 2800, lastActiveMinutes: 0, weatherBonus: 0 });
    useHistoryStore.setState({ snapshots: {} });
  });

  function setYesterday(consumed: number, goalMetFiredToday: boolean) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    useWaterStore.setState({ consumed, date: yesterdayStr, goalMetFiredToday });
  }

  it('emits Day Streak Continued when archived day meets 80%', () => {
    setYesterday(2300, true); // 2300 / 2800 = 0.82 > 0.8
    useWaterStore.getState().checkMidnightReset();
    const called = mockTrack.mock.calls.find(([n]) => n === 'Day Streak Continued');
    expect(called).toBeDefined();
  });

  it('emits Day Ended Below Goal when below 80% and goalMetFiredToday false', () => {
    setYesterday(2000, false); // 2000 / 2800 = 0.71
    useWaterStore.getState().checkMidnightReset();
    const below = mockTrack.mock.calls.find(([n]) => n === 'Day Ended Below Goal');
    expect(below).toBeDefined();
    expect(below![1]).toMatchObject({ streak_threshold_met: false });
  });

  it('does NOT emit Day Ended Below Goal when goalMetFiredToday was true (even if consumed drifted below)', () => {
    // Hypothetical: user hit 80%, then undid logs pushing below 80%. Flag stays true.
    setYesterday(2200, true);
    useWaterStore.getState().checkMidnightReset();
    const below = mockTrack.mock.calls.find(([n]) => n === 'Day Ended Below Goal');
    expect(below).toBeUndefined();
  });

  it('emits Day Streak Broken alongside Day Ended Below Goal when prior streak > 0', () => {
    // Prior streak is read via computeStreakExcludingYesterday, which iterates
    // starting at day -2 (skipping the day being archived at -1). Seed -2, -3, -4
    // as goalMet:true to produce priorStreak = 3. Do NOT seed day -1; the midnight
    // handler archives it with goalMet:false in this test.
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    useHistoryStore.setState({ snapshots: {
      [fmt(daysAgo(2))]: { date: fmt(daysAgo(2)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
      [fmt(daysAgo(3))]: { date: fmt(daysAgo(3)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
      [fmt(daysAgo(4))]: { date: fmt(daysAgo(4)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
    }});
    setYesterday(1500, false); // below 80%
    useWaterStore.getState().checkMidnightReset();
    const broken = mockTrack.mock.calls.find(([n]) => n === 'Day Streak Broken');
    const below = mockTrack.mock.calls.find(([n]) => n === 'Day Ended Below Goal');
    expect(broken).toBeDefined();
    expect(broken![1]).toMatchObject({ previous_streak_days: 3 });
    expect(below).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/waterStoreArchive.test.ts`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/useWaterStore.ts __tests__/waterStoreArchive.test.ts
git commit -m "feat: emit Day Streak Continued/Broken and Day Ended Below Goal at midnight"
```

---

## Task 22: Emit `Profile Updated` + call `syncUserProfile` from `useUserStore`

**Files:**
- Modify: `src/store/useUserStore.ts`

- [ ] **Step 1: Add imports + emit from `updateProfile`**

In `src/store/useUserStore.ts`, add imports:

```ts
import { track, syncUserProfile } from '../services/analytics';
```

Replace `updateProfile` with:

```ts
updateProfile: (updates) => {
  const current = get();
  const weight = updates.weight ?? current.weight;
  const age = updates.age ?? current.age;
  const goal = calculateDailyGoal(weight, age);
  set({ ...updates, dailyGoal: goal });

  // Map field changes for the Profile Updated event — only non-PII fields, and NAME IS EXCLUDED.
  const fields_changed: string[] = [];
  const values: Record<string, string | number> = {};
  if (updates.weight !== undefined) { fields_changed.push('weight_kg'); values.weight_kg = updates.weight; }
  if (updates.age !== undefined) { fields_changed.push('age'); /* age is not in allowlist */ }
  if (updates.activityLevel !== undefined) { fields_changed.push('activity_level'); values.activity_level = updates.activityLevel; }
  if (updates.climatePreference !== undefined) { fields_changed.push('climate'); values.climate = updates.climatePreference; }
  if (updates.gender !== undefined) { fields_changed.push('gender'); /* gender not in allowlist */ }
  if (updates.name !== undefined) { fields_changed.push('name'); /* name is PII; always dropped from values */ }

  track('Profile Updated', { fields_changed, values });

  syncUserProfile(get());

  const { useGoalStore } = require('./useGoalStore');
  useGoalStore.getState().recalculateMorningGoal();
},
```

Replace `updateSchedule` with:

```ts
updateSchedule: (updates) => {
  set(updates);
  const fields_changed: string[] = [];
  const values: Record<string, string> = {};
  const fmt = (t: { hour: number; minute: number }) =>
    `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  if (updates.wakeUpTime) { fields_changed.push('wake_time'); values.wake_time = fmt(updates.wakeUpTime); }
  if (updates.sleepTime) { fields_changed.push('sleep_time'); values.sleep_time = fmt(updates.sleepTime); }
  track('Profile Updated', { fields_changed, values });
  syncUserProfile(get());
},
```

Replace `setRemindersEnabled` with:

```ts
setRemindersEnabled: (enabled) => {
  set({ remindersEnabled: enabled });
  track('Reminders Toggled', { enabled });
},
```

Replace `completeOnboarding` with:

```ts
completeOnboarding: (profile) => {
  const goal = calculateDailyGoal(profile.weight, profile.age);
  set({
    ...profile,
    dailyGoal: goal,
    remindersEnabled: true,
    onboardingComplete: true,
  });
  writeWidgetData(goal, 0, null);

  syncUserProfile(get());

  const { useGoalStore } = require('./useGoalStore');
  useGoalStore.getState().recalculateMorningGoal();
},
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all PASS. If `App.test.tsx` or existing tests error because analytics module isn't mocked, add this to the test file's top:

```ts
jest.mock('../src/services/analytics', () => ({
  track: jest.fn(),
  syncUserProfile: jest.fn(),
  syncSessionProperties: jest.fn(),
  initAnalytics: jest.fn().mockResolvedValue(undefined),
  initAnalyticsForBackground: jest.fn().mockResolvedValue(undefined),
  onNavigationStateChange: jest.fn(),
  resetScreenTrackingState: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 4: Commit**

```bash
git add src/store/useUserStore.ts __tests__
git commit -m "feat: emit Profile Updated / Reminders Toggled and sync profile on edits"
```

---

## Task 23: Emit `Smart Goal Recalculated` from `useGoalStore`

**Files:**
- Modify: `src/store/useGoalStore.ts`

- [ ] **Step 1: Add import + emit at end of `recalculateMorningGoal` and `applyActivityBump`**

Add at the top of `src/store/useGoalStore.ts`:

```ts
import { track } from '../services/analytics';
```

At the end of `recalculateMorningGoal` (after `writeWidgetData(...)`), add:

```ts
track('Smart Goal Recalculated', {
  base_ml: result.baseGoal,
  weather_bump_ml: result.weatherBonus,
  activity_bump_ml: result.activityBonus + result.activityBump,
  effective_goal_ml: result.effectiveGoal,
  reason: 'morning',
});
```

In `applyActivityBump`, after the `set(...)` call that updates `effectiveGoal`, add:

```ts
track('Smart Goal Recalculated', {
  base_ml: current.baseGoal ?? 0,
  weather_bump_ml: current.weatherBonus,
  activity_bump_ml: result.activityBonus + result.activityBump,
  effective_goal_ml: result.effectiveGoal,
  reason: 'activity_sync',
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/store/useGoalStore.ts
git commit -m "feat: emit Smart Goal Recalculated on morning + activity paths"
```

---

## Task 24: Emit `Weather Fetch Failed` from `weatherService`

**Files:**
- Modify: `src/utils/weatherService.ts`

- [ ] **Step 1: Emit on failure paths**

Add at the top of `src/utils/weatherService.ts`:

```ts
import { track } from '../services/analytics';
```

Modify `fetchCurrentWeather` so the failure returns emit `Weather Fetch Failed`:

```ts
export async function fetchCurrentWeather(): Promise<{ /* …unchanged… */ } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      track('Weather Fetch Failed', { error_code: 'location_denied', fallback_used: 'climate' });
      return null;
    }

    const coords = await getCurrentPosition();
    if (!coords) {
      track('Weather Fetch Failed', { error_code: 'no_location', fallback_used: 'climate' });
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${OPENWEATHERMAP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      track('Weather Fetch Failed', { error_code: `http_${response.status}`, fallback_used: 'climate' });
      return null;
    }

    const data = await response.json();
    return {
      tempC: data.main.temp,
      feelsLikeC: data.main.feels_like,
      humidity: data.main.humidity,
      conditionCode: data.weather[0].id,
      conditionMain: data.weather[0].main,
      description: data.weather[0].description,
      cityName: data.name ?? null,
    };
  } catch (e) {
    track('Weather Fetch Failed', { error_code: 'exception', fallback_used: 'climate' });
    return null;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/utils/weatherService.ts
git commit -m "feat: emit Weather Fetch Failed on all failure paths"
```

---

## Task 25: Add `getHealthPermissionStatus()` cache + emit health events from `healthService`

**Files:**
- Modify: `src/utils/healthService.ts`

- [ ] **Step 1: Add the module-scope cache and getter**

At the top of `src/utils/healthService.ts`, after the imports, add:

```ts
import { track, syncSessionProperties } from '../services/analytics';

// Module-scope cached boolean — written by permission-prompt + status-check paths.
// Read synchronously by analytics syncSessionProperties() and never prompts natively.
let healthPermissionCache = false;

export function getHealthPermissionStatus(): boolean {
  return healthPermissionCache;
}

function updateHealthPermissionCache(granted: boolean): void {
  const changed = healthPermissionCache !== granted;
  healthPermissionCache = granted;
  if (changed) syncSessionProperties();
}
```

- [ ] **Step 2: Emit on prompt paths**

Replace `requestHealthPermissions` with:

```ts
export async function requestHealthPermissions(): Promise<boolean> {
  const platform = Platform.OS === 'ios' ? ('healthkit' as const) : ('health_connect' as const);
  track('Health Permission Prompted', { platform });
  let granted = false;
  if (Platform.OS === 'ios') granted = await iosRequestPermissions();
  else if (Platform.OS === 'android') granted = await androidRequestPermissions();
  updateHealthPermissionCache(granted);
  track('Health Permission Result', { platform, granted });
  return granted;
}
```

Update `checkHealthPermissions` (silent status check, no prompt, no event):

```ts
export async function checkHealthPermissions(): Promise<boolean> {
  let granted = false;
  if (Platform.OS === 'ios') {
    granted = await iosRequestPermissions(); // HealthKit treats this as silent when already prompted
  } else if (Platform.OS === 'android') {
    try {
      const { initialize, getGrantedPermissions } = require('react-native-health-connect');
      const isInitialized = await initialize();
      if (isInitialized) {
        const granted_perms = await getGrantedPermissions();
        const needed = ['ActiveCaloriesBurned', 'ExerciseSession'];
        granted = needed.every((rt) =>
          granted_perms.some((p: { recordType: string; accessType: string }) =>
            p.recordType === rt && p.accessType === 'read',
          ),
        );
      }
    } catch {
      granted = false;
    }
  }
  updateHealthPermissionCache(granted);
  return granted;
}
```

- [ ] **Step 3: Emit `Activity Sync Completed`**

Replace `getTodayActiveMinutes`:

```ts
export async function getTodayActiveMinutes(): Promise<number> {
  let minutes = 0;
  if (Platform.OS === 'ios') minutes = await iosGetActiveMinutes();
  else if (Platform.OS === 'android') minutes = await androidGetActiveMinutes();
  // bump_ml mirrors what the goal formula will add (350ml per 30min). Recomputed
  // downstream, so we emit bump_ml = 0 here — let the goal-recalculated event report the applied bump.
  track('Activity Sync Completed', { active_minutes: minutes, bump_ml: 0 });
  return minutes;
}
```

- [ ] **Step 4: Type-check + tests**

Run: `npx tsc --noEmit && npm test`

Expected: exit 0 + all pass. If existing tests fail because analytics is not mocked in their setup, add the mock (see Task 22 Step 3 pattern).

- [ ] **Step 5: Commit**

```bash
git add src/utils/healthService.ts
git commit -m "feat: emit health permission events; expose cached getHealthPermissionStatus()"
```

---

## Task 26: Emit `Onboarding Started` + `Onboarding Completed` from `OnboardingScreen`

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Add imports + emit events**

In `src/screens/OnboardingScreen.tsx`, add near the top:

```ts
import { track } from '../services/analytics';
```

Add an effect + update `handleSubmit`:

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
// …existing imports…

export function OnboardingScreen() {
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    track('Onboarding Started');
  }, []);

  // …existing state and handlers…

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    await requestNotificationPermission();
    completeOnboarding({
      name: name.trim(),
      weight,
      age,
      gender,
      activityLevel,
      climatePreference: 'temperate',
      wakeUpTime,
      sleepTime,
    });
    track('Onboarding Completed', {
      duration_sec: Math.round((Date.now() - mountedAtRef.current) / 1000),
    });
  }, [isValid, name, weight, age, gender, activityLevel, wakeUpTime, sleepTime, completeOnboarding]);

  // …unchanged JSX…
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: emit Onboarding Started on mount, Onboarding Completed on submit"
```

---

## Task 27: Emit `History Viewed` from `WeeklyChart` tap / long-press

**Files:**
- Modify: `src/components/WeeklyChart.tsx`
- Potentially: `src/screens/HomeScreen.tsx` (if chart is wrapped there)

- [ ] **Step 1: Read the existing component**

Run: `grep -n "onPress\|onLongPress\|TouchableOpacity\|Pressable" src/components/WeeklyChart.tsx`

This tells you whether the chart already has a press surface. If it does, add the analytics call inside the existing handler. If it doesn't, wrap the chart's root View in a `Pressable` with `onPress` + `onLongPress`.

- [ ] **Step 2: Add the event emission**

Add at the top:

```ts
import { track } from '../services/analytics';
```

Inside the root `Pressable` (or existing onPress handler), add:

```tsx
<Pressable
  onPress={() => track('History Viewed', { entry_point: 'chart_tap' })}
  onLongPress={() => track('History Viewed', { entry_point: 'chart_long_press' })}
>
  {/* existing chart SVG content */}
</Pressable>
```

If the root is already a `Pressable`, just add the onLongPress callback and the track calls inside the existing handlers.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/WeeklyChart.tsx
git commit -m "feat: emit History Viewed on chart tap/long-press"
```

---

# Phase 5 — Documentation

## Task 28: Create `docs/analytics.md`

**Files:**
- Create: `docs/analytics.md`

- [ ] **Step 1: Write the doc**

Create `docs/analytics.md`:

```markdown
# Analytics

## What Mixpanel tracks in Water Reminder

- Lifecycle: `App Opened`, `App Foregrounded`, `App Backgrounded`, `Screen Viewed`
- Onboarding: `Onboarding Started`, `Onboarding Completed`
- Hydration: `Water Logged`, `Log Undone`, `Goal Met`, `Day Streak Continued`, `Day Streak Broken`, `Day Ended Below Goal`
- Goal engine: `Smart Goal Recalculated`, `Weather Fetch Failed`
- Reminders: `Reminders Toggled`, `Reminder Delivered`, `Reminder Tapped`
- Health: `Health Permission Prompted`, `Health Permission Result`, `Activity Sync Completed`
- Profile: `Profile Updated` (no PII — name is always dropped)
- History: `History Viewed`

Super properties on every event: `app_version`, `build_number`, `platform`, `days_since_install`, `current_streak_days`, `has_health_permission`, `streak_rule_version`, plus user profile fields once onboarding completes.

## How to add a new event

1. Add the event name as a new string literal to `EVENT_NAMES` in `src/services/analytics/events.ts`.
2. Add the property shape to `EventMap` in the same file (use `never` for events with no properties).
3. Add a matching entry to `SAMPLE_PROPS` in `src/services/analytics/__tests__/events.contract.test.ts`.
4. Call `track('Event Name', { …props })` from the emission site.

## How to add a new user profile field

1. Add the field to `UserProfile` in `src/types/index.ts` and to the zustand store.
2. Add the matching key to `SuperProperties` in `src/services/analytics/events.ts`.
3. Non-PII only: add the key to `PROFILE_UPDATE_ALLOWED_FIELDS` in the same file.
4. Update `mapUserProfileToSuperProps()` in `src/services/analytics/client.ts` to translate the store field name to the Mixpanel key (e.g. `weight` → `weight_kg`).
5. Call `syncUserProfile(store)` from the edit path (usually already wired via `useUserStore.updateProfile`).

## PII rules

Never send `name`, emails, phones, or freeform user text. The dev-only PII guard in `src/services/analytics/privacy.ts` warns (but does not block) on suspicious keys or email-like string values. The `Profile Updated` event uses the runtime allowlist `PROFILE_UPDATE_ALLOWED_FIELDS` — any other key is silently dropped before dispatch.

## Opt-out posture

**No user-facing opt-out toggle ships today.** The code-level `optOut()` / `optIn()` / `hasOptedOut()` API exists in `src/services/analytics` so a Settings row can be wired later without re-architecting. Rationale: anonymous distinct IDs, no PII, no IDFA, local-first data model — the privacy posture is high by construction.

MMKV key: `analytics:optedOut`. Undefined ≡ opted-in. The init flow reads this and passes it to `mixpanel.init(optedOut)`. If set to true before init, the pre-init queue is discarded without dispatching.

If a UI toggle is introduced later, also re-add an `Analytics Opted Out` event to the catalog (dropped here because there's no firing site today).

## `streak_rule_version`

Current value: `'v2_80pct'`. This means `Goal Met` and streak continuation both fire at **80% of the daily goal**, not 100%.

The version tag is typed as a string-literal union in `SuperProperties`. This is intentional: TypeScript refuses to build if the constant `GOAL_MET_THRESHOLD` changes in `useWaterStore.ts` without also widening the `streak_rule_version` union (e.g. `'v2_80pct' | 'v3_90pct'`) and setting the correct tag. The type *forces* the invariant.

**When to bump the tag:** any time `GOAL_MET_THRESHOLD` or the `goalMet` predicate in `useHistoryStore`/`useWaterStore` changes. No historical migration is performed — data prior to a bump retains its original version tag in Mixpanel, so queries can slice by version to distinguish semantics.

## Debugging

`setLoggingEnabled(__DEV__)` is called during init. Events stream to the Metro logs in development builds.

To verify events from a dev build, filter Metro console output for `Mixpanel` or run with `npx react-native log-android` / `npx react-native log-ios`.

## Known gaps (tracked for follow-up)

These are deliberate omissions today — surfaced here so they don't become invisible tech debt:

- **`Goal Met` has no `log_count` or `time_to_goal_sec` properties.** The store does not track per-day log count or first-log-of-day timestamp. When those fields are added to `useWaterStore`, extend the `Goal Met` event payload in `EventMap` and the emission site. No version bump is needed because adding optional properties is additive.
- **`Activity Sync Completed.bump_ml` is always 0.** The goal formula computes the bump inside `useGoalStore.applyActivityBump`, not in `healthService.getTodayActiveMinutes`. The analytics emission lives in the wrong layer to know the bump value. Either move the emission into `useGoalStore.applyActivityBump` (preferred) or plumb the computed bump back through the health service.
- **Per-step onboarding events are not emitted.** The onboarding is a single-screen form; `Onboarding Step Completed` was dropped from the catalog entirely. If multi-step onboarding ships later, re-add the event to `EVENT_NAMES`/`EventMap` and wire per-step emissions.
- **`scheduled_hour = -1` sentinel.** If a Notifee event delivers without `data.hour` (e.g. a notification scheduled before the `data` payload change in Task 17.5), `parseReminderHour` returns `-1`. Treat as "hour unknown" in Mixpanel queries; this becomes non-zero only after users update to the new build.
- **No opt-out UI.** The code-level `optOut` / `optIn` / `hasOptedOut` API exists but no Settings toggle ships today. See the "Opt-out posture" section above.
```

- [ ] **Step 2: Commit**

```bash
git add docs/analytics.md
git commit -m "docs: add docs/analytics.md"
```

---

# Phase 6 — Verification

## Task 29: Full test suite + type check

- [ ] **Step 1: Run TypeScript + tests + lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

Expected: all three exit 0.

If anything fails, fix inline — do not skip.

- [ ] **Step 2: If anything was fixed, commit**

```bash
git add -A
git commit -m "fix: resolve verification failures from analytics integration"
```

(skip if nothing changed)

---

## Task 30: Manual smoke-test checklist (no commit)

This step is verification-only. Ask the human to confirm before declaring the plan complete. No code change.

- [ ] **Step 1: Ensure `.env` has a real `MIXPANEL_TOKEN`**

Run: `grep MIXPANEL_TOKEN .env 2>/dev/null || echo "MIXPANEL_TOKEN missing from .env"`

If missing, the human must add `MIXPANEL_TOKEN=<their-token>` before running the app.

- [ ] **Step 2: Start the app on one platform**

Run (iOS): `npm run ios` or (Android): `npm run android`

- [ ] **Step 3: Walk through the checklist and tick each item in Mixpanel's Live View**

In the Mixpanel project's Live View, confirm:

- [ ] On cold start, exactly one `App Opened` fires with `days_since_install` ≥ 0 and `streak_rule_version = v2_80pct` as a super property on every event
- [ ] Onboarding flow fires `Onboarding Started` → `Onboarding Completed` in order
- [ ] Logging water fires `Water Logged` with the expected `amount_ml`, `source`, `local_hour`, `pct_of_goal_after`, `is_first_log_of_day`
- [ ] Crossing 80% of the daily goal (e.g. log to push past `0.8 * effectiveGoal`) fires `Goal Met` exactly once; logging more on the same day does not re-fire
- [ ] Undoing a log fires `Log Undone`
- [ ] Backgrounding and foregrounding the app fires `App Backgrounded` then `App Foregrounded`
- [ ] Tapping the weekly chart fires `History Viewed`
- [ ] Editing any profile field fires `Profile Updated` with the expected `fields_changed` and `values` (name is dropped if changed)
- [ ] Toggling reminders fires `Reminders Toggled`
- [ ] When a notification is delivered with the app in foreground, `Reminder Delivered` fires with `consumed_ml` and `goal_ml`
- [ ] When a notification is delivered with the app backgrounded/killed (Android), `Reminder Delivered` still fires (verify in Mixpanel after returning to the app; allow up to 60 seconds for the background flush to reach the server)
- [ ] Allowing Health permission fires `Health Permission Prompted` then `Health Permission Result` with `granted: true`
- [ ] **Split-init end-to-end:** force-stop the Android app, wait for a scheduled reminder to fire while the app is not running, and confirm in Mixpanel that `Reminder Delivered` was emitted but NO `App Opened` fired from that background wakeup. Only the next cold-start of the app UI should emit `App Opened`.
- [ ] No event has a property value containing an email or the user's `name`

- [ ] **Step 4: Report results to the human reviewer**

If every box is ticked, the plan is complete. If any item fails, capture the event name and observed property shape, and open a follow-up task describing the mismatch.

---

# Self-review (from the writing-plans skill)

**Spec coverage — every section maps to at least one task:**
- §Identification model → Tasks 14, 22, 26 (syncUserProfile from onboarding + updateProfile)
- §File layout → Tasks 10–17 (all files created)
- §Public API → Tasks 14, 17
- §Init (memoized + split entry points + Android VM) → Tasks 14, 18, 19
- §Init sequence → Task 14
- §days_since_install cold-start-only → Task 14 (documented in code comment; no refresh wired)
- §MIXPANEL_SERVER_URL handling → Task 2
- §Pre-init queue → Task 14, asserted in Task 15
- §Event catalog → Task 10
- §Conditional tuple comment → Task 10
- §Super properties type → Task 10
- §Profile-update runtime allowlist → Tasks 10, 22
- §Screen tracking → Task 16
- §Store / call-site integration → Tasks 20–27
- §goalMetFiredToday flag → Tasks 5–8, 20, 21
- §Streak threshold (v2) → Tasks 5–8
- §Day-boundary invariant → Task 21
- §Opt-out flow → Task 14 (API), Task 15 (tests) — no UI wired per spec
- §Privacy / PII guard → Tasks 12, 13, 22
- §Health-permission signal & onboarding → Task 25
- §Onboarding has no health-permission step → Task 10 (enum excludes it), Task 26
- §Notifee DELIVERED / PRESS wiring → Tasks 17.5, 18, 19
- §Dependencies / platform config → Tasks 1–4 (plus 3.5 for `react-native-device-info`)
- §Testing (client, events.contract, screenTracking, privacy, 80% threshold) → Tasks 11, 13, 15, 16, 8, 21
- §docs/analytics.md outline → Task 28

**Placeholder scan:** no `TBD`, `TODO`, or `implement later`. Deferred fields are surfaced explicitly in `docs/analytics.md` → Known gaps (Task 28): `Goal Met.log_count` / `time_to_goal_sec`, `Activity Sync Completed.bump_ml`, per-step onboarding events, opt-out UI, `scheduled_hour = -1` sentinel. Each is a documented product choice, not a silent gap.

**Type consistency:** `syncUserProfile`, `syncSessionProperties`, `initAnalytics`, `initAnalyticsForBackground`, `track`, `EventMap`, `EventName`, `SuperProperties`, `TrackArgs`, `EVENT_NAMES`, `PROFILE_UPDATE_ALLOWED_FIELDS`, `GOAL_MET_THRESHOLD`, `goalMetFiredToday`, `getHealthPermissionStatus`, `onNavigationStateChange`, `resetScreenTrackingState`, `drainPreInitQueue`, `computeStreakExcludingYesterday` — all reference the same names everywhere they appear. `Onboarding Step Completed` was removed from the catalog, so no code path references it.
