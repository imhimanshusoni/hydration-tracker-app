# Mixpanel Analytics Integration

## Context

The Water Reminder app currently has no product analytics. Decisions about which features to build (health sync vs weather, goal celebration, streak mechanics) have been made on intuition because there's no usage signal to inform them. This spec integrates Mixpanel as the product-analytics layer so those decisions can become evidence-based: which events actually drive retention, which flows users complete, which reminders land versus get dismissed.

The app is local-first: no backend, no login, profile stored in MMKV. That shapes almost every identification and privacy decision below.

This spec also folds in a product change: the **streak + `Goal Met` threshold drops from 100% to 80% of the daily goal**. See §Streak threshold (v2). This is bundled here because (a) it's the first real use case the analytics taxonomy will need to measure, and (b) the `streak_rule_version` super property is the mechanism that lets us interpret historical data once the threshold changes — it belongs with the analytics integration, not separately.

## Goals

- A centralized, strongly-typed analytics service that prevents typos and wrong property shapes at compile time.
- Every profile field mirrored to both Mixpanel super properties *and* people properties, and re-synced on every profile edit (see `feedback_analytics_design.md`).
- Privacy by default: no backend account, no IDFA, no name/email sent, explicit user-controlled opt-out.
- Zero import-time side effects beyond singleton construction; all network/init behavior is explicit.
- Works across iOS foreground, iOS background, and the Android background JS VM (which is a fresh instance).

## Non-goals

iOS ATT prompt (Mixpanel with anonymous distinct IDs + no IDFA doesn't need it — re-enable path documented). Mixpanel Groups (no B2B). Session Replay. Feature flags / remote config. Sentry-style crash breadcrumbs. Server-side event proxy.

## Identification model

**Anonymous-only.** The app has no login/logout, so we never call `identify()` with a business user ID. Mixpanel's auto-generated distinct ID is used as-is.

On onboarding completion and on every subsequent profile edit, `syncUserProfile(profile)` is called. It internally:

1. `mixpanel.registerSuperProperties(profile)` — tags all future events with the profile fields, so event-level Mixpanel queries ("conversion for users with daily goal > 3L") don't need to join through people profiles.
2. `mixpanel.getPeople().set(profile)` — keeps user-level segments accurate for Mixpanel features that operate on profiles.

Both halves are required. Profile edits without re-syncing both sides drift from reality immediately.

System-derived session metadata (platform, `days_since_install`, `current_streak_days`, `has_health_permission`, `streak_rule_version`) is written separately via `syncSessionProperties()`. The split is important: `syncSessionProperties()` is safe to call without a user profile (e.g. on cold start before onboarding completes, or from the Android background VM), while `syncUserProfile()` requires a profile object.

Distinct ID is reset in only one situation: opt-out (see §Opt-out flow). The ID regenerates on app reinstall — that's an accepted analytics limitation of the local-first model.

## File layout

```
src/services/analytics/
  index.ts            public API (top-level functions — imported directly; no hook wrapper, see below)
  client.ts           Mixpanel singleton, init, memoized init promise, pre-init queue, lifecycle glue
  events.ts           EVENT_NAMES tuple, EventMap, BaseEventProps, SuperProperties, TrackArgs, PROFILE_UPDATE_ALLOWED_FIELDS
  screenTracking.ts   onStateChange handler, 500ms same-route dedup, resetScreenTrackingState()
  privacy.ts          dev-only PII guard
  __tests__/
    client.test.ts
    events.contract.test.ts
    screenTracking.test.ts
    privacy.test.ts

docs/analytics.md                         usage guide + "how to add an event"
__mocks__/mixpanel-react-native.js        jest mock with spied class methods
__mocks__/react-native-config.js          add MIXPANEL_TOKEN stub
src/config.ts                             export MIXPANEL_TOKEN, MIXPANEL_SERVER_URL
```

## Public API

```ts
export function initAnalytics(): Promise<void>;
export function track<K extends EventName>(...args: TrackArgs<K>): void;
export function identify(distinctId: string): Promise<void>;
export function alias(alias: string, distinctId?: string): Promise<void>;
export function syncUserProfile(profile: UserProfile): void;
export function syncSessionProperties(): void;
export function incrementProperty(prop: string, by?: number): void;
export function timeEvent<K extends EventName>(name: K): void;
export function registerSuperProperties(props: Partial<SuperProperties>): void;
export function optIn(): void;
export function optOut(): void;
export function hasOptedOut(): Promise<boolean>;
export function reset(): Promise<void>;
export function flush(): Promise<void>;
```

`syncUserProfile` is the only public way to tag **user-entered** profile fields — it unconditionally calls both `registerSuperProperties` and `people.set`. `syncSessionProperties` is the counterpart for **system-derived** fields (platform, days_since_install, streak count, health permission, streak_rule_version) and only writes super properties (these are not user-level facts that belong on people profiles).

### No `useAnalytics()` hook

The originally planned `useAnalytics()` hook is dropped. Components import `track`, `timeEvent`, etc. directly from `src/services/analytics`. Rationale: the hook would have been a pure re-export with no reactive state (these functions are fire-and-forget and never affect render output), which is exactly the anti-pattern of "hooks that aren't hooks." The only thing that could justify a hook is reactive opt-out state — and since no opt-out UI ships today (see §Opt-out flow), there's nothing to subscribe to. If a Settings opt-out row is added later, either: (a) read `hasOptedOut()` in a one-shot effect and store in local state, or (b) reintroduce `useAnalytics()` then with genuine subscription behavior. Both are cheap and don't require reshaping the service surface.

## Initialization

### Memoized module-scope promise

`initAnalytics()` returns a memoized `Promise<void>` held at module scope. Any concurrent caller receives the same promise; the actual init work runs exactly once per JS VM lifetime. This prevents a concurrent-init race where (for example) `App.tsx`'s mount effect and the Notifee background handler both invoke `initAnalytics()` simultaneously.

```ts
// client.ts sketch
let initPromise: Promise<void> | null = null;
export function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}
```

### Android background VM

The Android Notifee background handler runs in a **separate JS VM**. Module state — including `initPromise` — is not shared with the foreground VM. The background VM initializes Mixpanel independently by awaiting its own `initAnalytics()`. The Mixpanel native SDK handles token-level dedup across JS instances (the native layer is a single process-wide singleton keyed by project token), so two JS-side inits don't double-send events.

**`App Opened` is gated on the foreground init path only.** A boolean `isForegroundInit` flag is passed internally; the background init skips the `App Opened` emission. Without this gate, every backgrounded notification delivery on Android would fire a spurious `App Opened`.

### Init sequence (foreground)

```
 1. optedOut = MMKV.getBoolean('analytics:optedOut') ?? false   // undefined ⇒ opted-in
 2. installedAt = MMKV.getNumber('analytics:installedAt')
    if (!installedAt) { installedAt = Date.now(); MMKV.set('analytics:installedAt', installedAt) }
 3. days_since_install = Math.floor((Date.now() - installedAt) / 86_400_000)
 4. mixpanel = new Mixpanel(MIXPANEL_TOKEN, false)                // auto-events OFF
 5. serverURL = (Config.MIXPANEL_SERVER_URL ?? '').trim() || undefined   // empty ⇒ US default
 6. await mixpanel.init(optedOut, undefined, serverURL)
 7. mixpanel.setLoggingEnabled(__DEV__)
 8. if optedOut: drop the pre-init queue (discard without dispatching)
    else: drainPreInitQueue()                                    // see §Pre-init queue
 9. syncSessionProperties()                                      // platform, days_since_install, streak, health perm, streak_rule_version
10. if (useUserStore.getState().onboardingComplete) {
      syncUserProfile(useUserStore.getState().profile)           // user-entered fields
    }
11. (foreground only) track('App Opened', { days_since_install, session_source })
12. initialized = true
```

**`analytics:installedAt` MMKV key survives opt-out and reset.** The opt-out sequence deletes `analytics:optedOut`, and `mixpanel.reset()` clears Mixpanel-side state, but the install timestamp is our own MMKV key owned by the analytics module — we deliberately do not touch it in either path. This keeps `days_since_install` monotonic across opt-out cycles and Mixpanel distinct-ID regenerations. It is wiped only on app uninstall, which is correct (a reinstall is genuinely a new install).

**Why steps 9 and 10 are split:**
- `syncSessionProperties()` writes only super properties that are **system-derived** — `platform`, `days_since_install`, `current_streak_days`, `has_health_permission`, `app_version`, `build_number`, `streak_rule_version`. Safe to call without a user profile.
- `syncUserProfile(profile)` writes **user-entered** fields — activity level, climate, daily goal, weight, age, gender, wake/sleep times — to both super properties and `people.set`.

Both are called on cold start because `mixpanel.reset()` clears super properties and a fresh install has none. Splitting them lets the background VM (which has no user profile context) call `syncSessionProperties()` alone without side-effects on user data.

### `days_since_install` is cold-start-only (intentional tradeoff)

`days_since_install` is computed once at `initAnalytics()` and written to super properties. It is **not** refreshed on `App Foregrounded`.

**What this means:** a session that starts at 11:55 PM on day N and continues past midnight to 12:05 AM on day N+1 will tag all events in that foregrounded session with `days_since_install = N`. Events sent after the user next backgrounds-then-foregrounds (or cold-starts) will correctly tag `N+1`.

**Why not refresh on foreground:** the bias is small (same-session midnight crossings are rare, and off-by-one on the day bucket for at most one session is noise-level for retention analysis). The alternative — recompute on every `App Foregrounded` and `registerSuperProperties` mid-session — adds a native call and a super-property rewrite to every resume for a property that's mostly static within a session. Not worth the overhead.

**When to revisit:** if cohort analysis needs day-level precision for long-session users (e.g. you see a suspiciously high day-0 retention because users leave the app open overnight), add a `App Foregrounded` handler that re-reads `installedAt` and calls `registerSuperProperties({ days_since_install })` if the value changed. The change is additive and doesn't require schema migration.

### `MIXPANEL_SERVER_URL` handling

Guard against empty strings, not just `undefined`. `react-native-config` returns `""` for unset keys in some configurations. Pattern:

```ts
const serverURL = (Config.MIXPANEL_SERVER_URL ?? '').trim() || undefined;
```

`undefined` makes `mixpanel.init()` fall back to its built-in US endpoint. EU users set `MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com` in `.env`.

## Pre-init queue

Calls to `track`, `identify`, `syncUserProfile`, `syncSessionProperties`, `timeEvent`, `registerSuperProperties`, `incrementProperty` made before `initPromise` resolves are queued in memory.

Bounds:

- **Capacity:** 50 entries. Overflow is FIFO (oldest dropped). One `console.warn` per overflow burst in `__DEV__`.
- **Timeout:** 10 seconds from first enqueue. If init hasn't resolved by then, the queue is drained without dispatching — the same behavior as the opted-out-at-init path, reusing `drainPreInitQueue()`'s discard branch. This does NOT flip the MMKV opt-out state; it's a timeout safeguard that drops the batch of events that piled up while init hung. A `console.warn` fires in `__DEV__`. Subsequent pre-init calls re-enter the same queueing behavior (fresh 10s window).
- **Opted-out at init:** `drainPreInitQueue()` discards entries without dispatching; no events are sent; Mixpanel is still initialized so the toggle-back-on path works without a re-init.

### Naming

The internal function that drains this queue is named `drainPreInitQueue()`. The term **flush** is reserved throughout the codebase for `mixpanel.flush()` — the SDK operation that uploads queued events to Mixpanel's servers. Mixing the two terms made the original draft confusing; the separation is enforced in code, tests, and docs.

`optIn` / `optOut` are **never** queued — they update MMKV immediately and are mirrored to Mixpanel after init resolves.

## Event catalog

### Single source of truth

`events.ts` exports a `const EVENT_NAMES` tuple. `EventMap` is keyed by `typeof EVENT_NAMES[number]`. The contract test iterates this tuple directly — there is no parallel array to keep in sync.

```ts
// src/services/analytics/events.ts

export const EVENT_NAMES = [
  'App Opened',
  'App Foregrounded',
  'App Backgrounded',
  'Screen Viewed',
  'Onboarding Started',
  'Onboarding Step Completed',
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

export type BaseEventProps = {
  app_version: string;
  build_number: string;
};

export type EventMap = {
  'App Opened': { days_since_install: number; session_source: 'cold' | 'notification_tap' | 'deep_link' };
  'App Foregrounded': { background_duration_sec: number };
  'App Backgrounded': { foreground_duration_sec: number };
  'Screen Viewed': { screen_name: string; previous_screen: string | null };
  'Onboarding Started': never;
  'Onboarding Step Completed': { step_name: 'profile' | 'schedule' | 'climate' | 'health_permission' };
  'Onboarding Completed': { duration_sec: number };
  'Water Logged': {
    amount_ml: number;
    source: 'quick' | 'custom' | 'suggested';
    /** Device local hour, 0–23. NOT UNIQUE WITHIN A DAY on DST fall-back — the 1:00–2:00 local hour occurs twice on the
     * transition day, so two events with local_hour=1 on the same calendar day is expected; pair with the event timestamp
     * (Mixpanel's `time` property) for ordering. Buckets ("morning/afternoon/evening" or any other split) are computed
     * downstream in Mixpanel rather than on-device so the analyst can redefine boundaries without shipping an app update. */
    local_hour: number;
    pct_of_goal_after: number;
    is_first_log_of_day: boolean;
  };
  'Log Undone': { amount_ml: number; time_since_log_sec: number };
  'Goal Met': { goal_ml: number; consumed_ml: number; log_count: number; time_to_goal_sec: number };
  'Day Streak Continued': { streak_days: number; goal_ml: number; consumed_ml: number };
  'Day Streak Broken': { previous_streak_days: number; goal_ml: number; consumed_ml: number };
  'Day Ended Below Goal': {
    goal_ml: number;
    consumed_ml: number;
    pct_of_goal: number;
    /** True iff consumed_ml >= GOAL_MET_THRESHOLD * goal_ml. Under v2 (80%) this can never be true
     * when Day Ended Below Goal fires — the invariant would fail. The field exists so that if the
     * threshold changes again (e.g. v3 at 90%), historical queries can still slice by whether
     * the user crossed the current-version threshold that day. */
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
    values: Partial<Pick<UserProfile,
      'weight_kg' | 'daily_goal_ml' | 'wake_time' | 'sleep_time' | 'activity_level' | 'climate'
    >>;
    // `name` is intentionally excluded — PII
  };
  'History Viewed': { entry_point: 'chart_tap' | 'chart_long_press' };
};
```

### Conditional tuple for `track()`

```ts
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
```

Call sites:
- `track('Onboarding Started')` — no second arg
- `track('Water Logged', { amount_ml: 250, source: 'quick', … })` — props required

### Super properties type

```ts
export type SuperProperties = BaseEventProps & {
  platform: 'ios' | 'android';
  days_since_install: number;
  current_streak_days: number;
  has_health_permission: boolean;
  /** Version tag for streak + Goal Met threshold logic. Typed as a string-literal union specifically
   * so TypeScript fails to compile if GOAL_MET_THRESHOLD (or the streak-continuation predicate)
   * changes without bumping this tag — the type *forces* the invariant. Adding a new threshold
   * requires widening the union (e.g. 'v2_80pct' | 'v3_90pct') and setting the correct tag at every
   * call site, so the compiler refuses to build a drifted state. Current value 'v2_80pct' = 80% of
   * daily goal. See §Streak threshold (v2). */
  streak_rule_version: 'v2_80pct';
  activity_level?: 'low' | 'moderate' | 'high';
  climate?: 'cold' | 'temperate' | 'hot' | 'tropical';
  daily_goal_ml?: number;
  wake_time?: string;
  sleep_time?: string;
  weight_kg?: number;
  age?: number;
  gender?: string;
};

// UserProfile type is imported from existing src/types/index.ts — this spec does not redefine it.
// If future fields are added there, decide per-field: non-PII → add to PROFILE_UPDATE_ALLOWED_FIELDS
// and SuperProperties. PII → leave out of both (see §Privacy / PII guard).
```

### Profile-update runtime allowlist

TypeScript's `Pick` protects compile-time property shapes, but nothing stops a careless call site from force-casting or mutating the object before `track`. A runtime allowlist is the second line of defense against PII leaks into `Profile Updated.values`:

```ts
// events.ts
export const PROFILE_UPDATE_ALLOWED_FIELDS = [
  'weight_kg',
  'daily_goal_ml',
  'wake_time',
  'sleep_time',
  'activity_level',
  'climate',
] as const;
```

Applied inside the `track()` call site for `'Profile Updated'`: before dispatch, `values` is filtered to keys present in this tuple. Anything else (notably `name`, or any field a future contributor adds to `UserProfile`) is dropped with a `console.warn` in `__DEV__`. The TS type and the runtime list must stay in sync — a unit test asserts equivalence.

## Screen tracking

```ts
// src/services/analytics/screenTracking.ts
let previousScreen: string | null = null;
let lastScreenName: string | null = null;
let lastScreenAt = 0;
const SAME_ROUTE_DEDUP_MS = 500;

export function onNavigationStateChange(state: NavigationState | undefined) {
  const current = getActiveRouteName(state);
  if (!current) return;
  const now = Date.now();
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

Wired once in `App.tsx`: `<NavigationContainer onStateChange={onNavigationStateChange}>`.

Semantics:
- `previous_screen` is `null` on the first `Screen Viewed` after **cold start** (module-scope init).
- Rapid same-route taps (tab re-press, hot reload double-fire) within 500ms are deduplicated.
- Identical consecutive routes (any time) are deduplicated — only genuine navigations emit.
- `resetScreenTrackingState()` is exported for use in the opt-in sequence, so a user who toggles analytics back on during a session starts with a clean `previous_screen = null` (not leaking pre-opt-out navigation context into the new distinct ID).

## Store / call-site integration

| Event | Emitter |
|---|---|
| `App Opened` | end of foreground `initAnalytics()` |
| `App Foregrounded` / `App Backgrounded` | AppState listener wired alongside init |
| `Screen Viewed` | `onNavigationStateChange` |
| `Onboarding Started` / `Step Completed` / `Completed` | `OnboardingScreen` (mount / per-step / finish) |
| `Water Logged`, `Goal Met`, `Log Undone` | `useWaterStore.logWater`, `useWaterStore.undoLog` |
| `Day Streak Continued` / `Broken`, `Day Ended Below Goal` | midnight-reset path in `useWaterStore` / `useHistoryStore.archiveDay` |
| `Smart Goal Recalculated` | `useGoalStore.recalculateMorningGoal` |
| `Weather Fetch Failed` | `utils/weatherService.ts` catch |
| `Profile Updated` + `syncUserProfile` | `useUserStore.updateProfile` |
| `Reminders Toggled` | `useUserStore` reminders toggle |
| `Reminder Delivered` / `Reminder Tapped` | Notifee foreground + background handlers |
| `Health Permission Prompted` / `Result`, `Activity Sync Completed` | `utils/healthService.ts` |
| `History Viewed` | `WeeklyChart` onPress / onLongPress |

### `goalMetFiredToday` flag on `useWaterStore`

Adding a day-scoped `goalMetFiredToday: boolean` field in `useWaterStore` (persisted via `partialize`, reset at midnight alongside `consumed`). It is flipped true the moment `Goal Met` fires and gates both re-emission attempts and the midnight handler.

**Why it's required:** Without it, `Smart Goal Recalculated` can break the XOR invariant. Consider: user drinks 2400 ml against a 3000 ml goal (80% threshold = 2400 ml). `Goal Met` fires on the log that crossed 2400. Later that day, weather cools and `Smart Goal Recalculated` lowers `effectiveGoal` to 2800 ml (new 80% threshold = 2240 ml). The user drinks another 100 ml (now 2500 ml); under naive strict-cross `prev < 2240 && next >= 2240` is false (already crossed), so no re-fire — good. But if `Smart Goal Recalculated` had *raised* the goal to 4000 ml mid-day and the user then logged past the new 80% (3200 ml), naive strict-cross would fire `Goal Met` a second time for the same day. The flag prevents that. The midnight handler also reads the flag to decide whether to emit `Day Ended Below Goal`:

```
if (goalMetFiredToday) {
  // Goal Met already fired this day — XOR preserved; emit nothing.
} else if (consumed >= GOAL_MET_THRESHOLD * effectiveGoal) {
  // Goal is met at midnight but Goal Met never fired mid-day (e.g. goal lowered
  // after consumption already exceeded new threshold). Still no event — "met at midnight
  // without a strict-cross event" is semantically a goal-change artifact, not an achievement.
} else {
  track('Day Ended Below Goal', { … });
}
```

The flag must be in the same `partialize` list as `consumed` so it survives app restarts within the same day.

## Streak threshold (v2)

The streak + `Goal Met` threshold is **80% of daily goal**, not 100%. Defined as a single source-of-truth constant in `useWaterStore`:

```ts
export const GOAL_MET_THRESHOLD = 0.8;
```

Used in exactly two places: the `Goal Met` strict-cross check (§Day-boundary invariant) and the streak-continuation check (`useHistoryStore.archiveDay`). **Do not duplicate the `0.8` literal anywhere.** The `streak_rule_version: 'v2_80pct'` super property is the cross-reference — it must be bumped (to `'v3_…'`, etc.) any time this constant changes.

**No historical migration.** All days archived before this spec ships are treated as v1 (100% threshold). There is no backfill; Mixpanel queries distinguish by `streak_rule_version`. Pre-existing MMKV streak counters continue their current value — the first v2-era archive either continues or breaks that streak under the new rule.

## Day-boundary invariant

At each midnight reset, **exactly one of `Goal Met` (mid-day) or `Day Ended Below Goal` (at midnight) is associated with the closed day. Never both.** The `goalMetFiredToday` flag (see §Store / call-site integration) is the mechanism that enforces XOR across mid-day goal changes.

### `Goal Met` — strict-cross semantics

`Goal Met` fires **only** on a log write where:

```
prev < GOAL_MET_THRESHOLD * effectiveGoal
&& next >= GOAL_MET_THRESHOLD * effectiveGoal
&& !goalMetFiredToday
```

`prev` and `next` are the consumption values before and after the log.

`Goal Met` does **not** fire from any other code path:
- Not from `Smart Goal Recalculated`, even if the recalculation lowers `effectiveGoal` such that the existing `consumed` now satisfies `consumed >= GOAL_MET_THRESHOLD * effectiveGoal`. A goal change is not a user achievement.
- Not a second time the same day — the `goalMetFiredToday` flag gates it.
- Not from undo/redo that re-crosses the threshold — strict-cross already gates this because `undoLog` moves backwards.

### Midnight handler

```
if (goalMetFiredToday) {
  // Goal Met already fired mid-day — XOR preserved, emit no goal-status event.
} else if (consumed >= GOAL_MET_THRESHOLD * effectiveGoal) {
  // Met at midnight without a strict-cross event — almost always means the goal was
  // lowered mid-day after consumption already exceeded it. Semantically a goal-change
  // artifact, not an achievement; emit no goal-status event.
  //
  // IMPORTANT: this branch does NOT suppress streak events. `Day Streak Continued`
  // still fires per §Streak events (orthogonal) because the archived day meets the
  // threshold — the streak counter should continue regardless of how the user got
  // there. Only the Goal Met / Day Ended Below Goal XOR is suppressed.
} else {
  track('Day Ended Below Goal', {
    goal_ml, consumed_ml,
    pct_of_goal: consumed_ml / goal_ml,
    streak_threshold_met: consumed_ml >= GOAL_MET_THRESHOLD * goal_ml,  // computed at call site
  });
}
```

### Streak events (orthogonal)

Same `GOAL_MET_THRESHOLD` constant gates streak continuation:

- archived day met threshold (`consumed_ml >= GOAL_MET_THRESHOLD * goal_ml`) → `Day Streak Continued { streak_days: newStreak }`
- archived day missed threshold AND prior streak > 0 → `Day Streak Broken { previous_streak_days }` (fires alongside `Day Ended Below Goal`)
- archived day missed threshold AND no prior streak → no streak event (just `Day Ended Below Goal`)

## Opt-out flow

MMKV key: `analytics:optedOut`. **Undefined ≡ opted-in.** Documented in `privacy.ts` and `docs/analytics.md`.

### No user-facing opt-out toggle ships today

The `optOut()` / `optIn()` / `hasOptedOut()` code-level API exists, but **no Settings row, onboarding consent step, or other UI is included in this spec**. Rationale: this app is local-first with anonymous distinct IDs, no PII sent, no IDFA usage, no backend account. The privacy posture is already high by construction; a toggle without a privacy deficit to toggle against is UX clutter. The API is kept so a Settings row can be wired later with no re-architecting — only a component and one call site per button.

No `Analytics Opted Out` event exists in the catalog (removed from `EVENT_NAMES` / `EventMap`) because with no UI there is no place to fire it. If a toggle is added later, the implementer decides whether to reintroduce the event.

### Opt-out sequence (API-level — invokable from tests or future UI)

```
1. await mixpanel.flush()                            // LOAD-BEARING — see below
2. MMKV.set('analytics:optedOut', true)
3. mixpanel.optOutTracking()                         // deletes any remaining unflushed data
4. await mixpanel.reset()                            // new distinct ID for any future opt-in
```

### Opt-in sequence (API-level)

```
1. MMKV.delete('analytics:optedOut')                 // undefined ⇒ opted-in
2. mixpanel.optInTracking()                          // native SDK internally tracks opt-in
3. syncSessionProperties()                           // platform, days_since_install, streak, health perm, streak_rule_version
4. syncUserProfile(currentUserProfile)               // user-entered fields
5. resetScreenTrackingState()                        // previous_screen cleared — new session, new identity
```

Step 5 ensures the first `Screen Viewed` emitted after opt-in has `previous_screen: null`, matching cold-start semantics. Without it, the new distinct ID's first nav event would carry a `previous_screen` value attributed to the opted-out session that just ended — a weird cross-identity data point.

### `flush()` is load-bearing (NOT best-effort)

Per `mixpanel-react-native` v3 docs: **`optOutTracking()` deletes events and people updates that haven't been flushed.** The SDK's own guidance is "Use flush() before calling this method if you want to send all the queues to Mixpanel before." This makes step 1 load-bearing, not a courtesy:

- Any events accumulated during the current session that haven't yet uploaded (Mixpanel batches uploads — they don't go one-per-call) will be **destroyed** by step 3 if step 1 is skipped.
- On flaky networks, `flush()` can fail to reach the server before step 3 runs; that's an acceptable degraded outcome (events lost to the network), but skipping the flush entirely guarantees data loss on every opt-out regardless of network.
- On Android, process death between steps 1 and 3 remains a risk, but minimizing the window (steps 2 and 3 are synchronous after the flush await) keeps it small.

The sequence `flush → persist MMKV → optOutTracking → reset` is required in this order — do not reorder for "simplicity."

## Privacy / PII guard

### No user-facing opt-out toggle ships today

The code-level `optOut()` / `optIn()` / `hasOptedOut()` API exists so a Settings row can be wired later without re-architecting. **Rationale:** anonymous distinct IDs, no PII, no IDFA, local-first data model — there is no backend account to link, no cross-site ID, and no personally identifying property on any event. A toggle without a privacy deficit to toggle against is UX clutter; adding one later is a component + one-line binding. If/when a toggle is added, reintroduce an `Analytics Opted Out` event to the catalog at the same time.

### PII guard (dev-only, cost-free in release via `__DEV__` gating)

- **Key patterns:** `/email|phone|password|^name$/i`
- **Value patterns:** email-like `[^\s@]+@[^\s@]+\.[^\s@]+` in any string property
- **Behavior:** `console.warn` only, never blocks

Explicit allowlists:
- `Profile Updated.values` filtered at call time against `PROFILE_UPDATE_ALLOWED_FIELDS` (see §Event catalog).
- `Profile Updated.fields_changed` is an array of field *names* only — name-strings like `"weight_kg"` are not PII.

## Health-permission signal & onboarding

### `has_health_permission` super property

Derived from `utils/healthService.ts`. The service must export a synchronous `getHealthPermissionStatus(): boolean` that returns a **module-scope cached boolean** — not a fresh native query. The cache is maintained by the existing permission-prompt flow: whenever the service prompts for or checks permissions (both of which are already async), it writes the result into the module-scope variable. `getHealthPermissionStatus()` is a pure getter over that variable.

A synchronous signature is required because `syncSessionProperties()` is synchronous and is called from init + opt-in + permission-change paths. Making those async just to await a native query every time would complicate every call site for no functional win — the cached value is as fresh as the last native interaction, which is what we want to report.

If this function does not yet exist in `healthService.ts`, add it as part of this spec's implementation. The existing permission prompt + status APIs already produce the boolean; this adds one module-scope variable and a getter that reads it.

- `syncSessionProperties()` calls `getHealthPermissionStatus()` at init time and on opt-in.
- `healthService` writes the cache and calls `syncSessionProperties()` whenever the permission changes — i.e. after `Health Permission Result` fires.

### Onboarding `health_permission` step

`Onboarding Step Completed { step_name: 'health_permission' }` fires **regardless of grant outcome** — the user completed the step by answering the prompt, whether they granted or denied. The grant outcome is captured separately via `Health Permission Result { granted: boolean }`. Implementers must not conditionally skip the `Step Completed` emission on denial.

Verify during implementation that `OnboardingScreen` actually has a health-permission step; if the current onboarding skips straight from profile → schedule → finish without a health prompt, remove `'health_permission'` from the step_name enum and drop this event.

## Notifee DELIVERED / PRESS wiring

Both foreground and background handlers need `EventType.DELIVERED` and `EventType.PRESS` cases. **Both must be wired** — missing the foreground case means reminders only emit `Reminder Delivered` when the app is backgrounded (an undercount bias toward heavy users).

### Foreground (`notifee.onForegroundEvent` in `App.tsx` or a top-level hook)

```
switch (type) {
  case EventType.DELIVERED:
    await initAnalytics();                // idempotent via memoized promise
    track('Reminder Delivered', { scheduled_hour, consumed_ml, goal_ml });
    break;
  case EventType.PRESS:
    await initAnalytics();
    track('Reminder Tapped', { scheduled_hour });
    break;
}
```

### Background (`notifee.onBackgroundEvent` in `index.js`)

Android spins up a fresh JS VM for the background handler. Required pattern:

```
switch (type) {
  case EventType.DELIVERED:
    await initAnalytics();                // initializes this VM's Mixpanel
    track('Reminder Delivered', { scheduled_hour, consumed_ml, goal_ml });
    await flush();                        // VM may be torn down immediately after return
    break;
  case EventType.PRESS:
    await initAnalytics();
    track('Reminder Tapped', { scheduled_hour });
    await flush();
    break;
}
```

Explicit `break;` statements matter here — copy-paste of these cases into an existing switch that already has a fallthrough pattern would silently double-fire `Reminder Tapped` on every `Reminder Delivered` without them.

`flush()` at the end is important on Android — without it the event sits in the SDK's in-memory queue and is lost when the background VM exits.

## Dependencies / platform config

- `npm i mixpanel-react-native` (v3.x)
- `cd ios && pod install` — autolinking covers the native module
- Android: autolinking via `@react-native-community/cli` (already present)
- `src/config.ts`: export `MIXPANEL_TOKEN` and `MIXPANEL_SERVER_URL` (empty-string-safe)
- `.env` (user-owned): `MIXPANEL_TOKEN=...`; optional `MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com`
- `__mocks__/react-native-config.js`: add `MIXPANEL_TOKEN: 'test-token'`
- `__mocks__/mixpanel-react-native.js`: new file — `Mixpanel` class with spied methods (`init`, `track`, `identify`, `reset`, `flush`, `getPeople`, `optInTracking`, `optOutTracking`, `hasOptedOutTracking`, `registerSuperProperties`, `timeEvent`, `setLoggingEnabled`)
- `jest.config.js`: no change expected (full module mock sidesteps transformIgnorePatterns)

## Testing

Unit tests only — no native module interaction.

### `client.test.ts`

These tests exercise the analytics module's public API directly — no UI path is involved because no opt-out UI ships. Tests call `optOut()` / `optIn()` as function invocations from the test body.

- `initAnalytics()` resolves once; concurrent callers receive the same promise (spy on `Mixpanel#init` called exactly once for N concurrent `initAnalytics()` calls)
- Foreground init emits `App Opened`; background init does not
- `analytics:installedAt` MMKV key is written on first init and is preserved across `optOut()` and `reset()` cycles
- `drainPreInitQueue()`: 50-event cap with FIFO overflow; 10s timeout discards; queued events dispatch in FIFO order post-init
- 10s timeout path does NOT flip `analytics:optedOut` in MMKV (regression test for the pre-init-queue wording fix)
- Opted-out at init → queue discarded via `drainPreInitQueue()`, no `track` spy calls
- `optOut()` invokes: `mixpanel.flush()` → MMKV true → `optOutTracking()` → `reset()`, in order (flush is load-bearing — asserted via call-order spy)
- `optIn()` invokes: MMKV delete → `optInTracking()` → `syncSessionProperties()` → `syncUserProfile()` → `resetScreenTrackingState()`, in order
- `syncUserProfile(p)` calls both `registerSuperProperties(p)` AND `getPeople().set(p)`
- `syncSessionProperties()` writes `streak_rule_version: 'v2_80pct'` and does not touch user-entered fields
- Empty `MIXPANEL_SERVER_URL` passes `undefined` to `mixpanel.init` (US default)

### `useWaterStore` / `useHistoryStore` tests (new assertions for the 80% threshold)

Existing `__tests__/waterStoreArchive.test.ts` and `__tests__/useHistoryStore.test.ts` will need updates — any test asserting streak or goal-met behavior at 100% must be updated to 80%. New assertions to add:

- `Goal Met` fires on strict-cross of 80% (`prev < 0.8 * goal && next >= 0.8 * goal`), not at 79% or 100%
- `Goal Met` does NOT fire a second time when `Smart Goal Recalculated` changes `effectiveGoal` mid-day — `goalMetFiredToday` flag gates re-emission
- `Goal Met` does NOT fire when `Smart Goal Recalculated` lowers the goal such that existing `consumed` now satisfies `consumed >= 0.8 * newGoal` without a new log crossing
- Midnight handler: `consumed >= 0.8 * goal` on the archived day → `Day Streak Continued`, and `Day Ended Below Goal` is NOT emitted
- Midnight handler: `consumed < 0.8 * goal` → `Day Ended Below Goal` IS emitted with `streak_threshold_met: false`
- `goalMetFiredToday` survives persistence (`partialize`) and is reset at midnight alongside `consumed`

Behavioral coverage is sufficient here — a test that greps for the literal `0.8` outside the constant definition would only catch accidental duplication, which the 80%/100% behavioral tests already surface; it would also flake any time an unrelated `0.8` is introduced elsewhere (e.g. opacity values, timing multipliers). The behavioral tests are the contract; the constant is an implementation choice.

### `events.contract.test.ts`

Iterates `EVENT_NAMES` (the single source of truth). Asserts:

- Every event name matches `/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/` (Title Case, space-separated)
- Every property key across all event types matches `/^[a-z][a-z0-9_]*$/` (snake_case)
- No event name or property key is a Mixpanel reserved key: `['distinct_id', 'time', '$insert_id', '$user_id', '$device_id', '$identified_id', '$current_url', '$lib_version']` and any `mp_reserved_*` pattern
- `PROFILE_UPDATE_ALLOWED_FIELDS` keys equal `EventMap['Profile Updated']['values']` keys exactly (TS type ↔ runtime list sync)

### `screenTracking.test.ts`

- Fires once per distinct route
- Dedups same-route within 500ms (tab re-press)
- Dedups any identical consecutive route regardless of time
- `previous_screen` chain is correct
- `previous_screen === null` on first event after cold start
- `resetScreenTrackingState()` returns all state to cold-start values

### `privacy.test.ts`

- Warns for PII-like keys (`email`, `phone`, `password`, `name`)
- Warns for email-like string values in any property
- Silent on clean props
- Silent when `__DEV__` is false

## `docs/analytics.md` outline

1. What Mixpanel tracks — user-facing summary
2. How to add a new event — add to `EVENT_NAMES` tuple; add prop shape to `EventMap`; call `track('X', { … })`
3. How to add a new profile field — add to `UserProfile` + `SuperProperties` + (if non-PII) `PROFILE_UPDATE_ALLOWED_FIELDS`; call `syncUserProfile(profile)` from the edit path
4. PII rules — never send `name`, emails, phones, freeform user text
5. Opt-out posture — "**No user-facing opt-out toggle ships today; the code-level `optOut()` / `optIn()` / `hasOptedOut()` API exists so a Settings row can be wired later without re-architecting. Rationale: anonymous distinct IDs, no PII, no IDFA, local-first data model.**" Document the MMKV key `analytics:optedOut` (undefined ≡ opted-in), init-time opt-out read, and opted-out-at-init queue-discard behavior. Note that reintroducing a UI toggle means also reintroducing an `Analytics Opted Out` event in the catalog.
6. `streak_rule_version` super property — **required documentation.** State the current rule: "`Goal Met` and streak continuation both fire at 80% of daily goal; the `streak_rule_version` super property is set to `v2_80pct`." Explain that this property MUST be bumped (`v3_…`, `v4_…`, etc.) any time `GOAL_MET_THRESHOLD` or the streak-continuation predicate in `useHistoryStore` changes — otherwise Mixpanel queries cannot distinguish historical semantics from current. Note the type-level invariant: `streak_rule_version` is a string-literal union so changing the constant without widening the union is a compile error. No backfill is performed on threshold changes; data prior to a version bump is interpreted under its own version's rules.
7. Debugging — `setLoggingEnabled(__DEV__)` streams events to the Metro logs

## Out of scope (re-enable paths documented)

- **iOS ATT.** Add `NSUserTrackingUsageDescription` to `Info.plist` and call `ATTrackingManager.requestTrackingAuthorization` if/when attribution SDKs (Adjust, Branch) are added — they collect IDFA, which requires ATT. Mixpanel's anonymous distinct IDs alone do not.
- **EU residency.** Set `MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com` in `.env` and no code change is needed.
- **Session Replay, Feature flags, Groups, Sentry breadcrumbs** — separate specs if/when needed.
