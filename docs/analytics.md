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
- **`scheduled_hour = -1` sentinel.** If a Notifee event delivers without `data.hour` (e.g. a notification scheduled before the `data` payload change shipped), `parseReminderHour` returns `-1`. Treat as "hour unknown" in Mixpanel queries; this becomes non-zero only after users update to the new build.
- **No opt-out UI.** The code-level API exists but no Settings toggle ships today. See the "Opt-out posture" section above.
