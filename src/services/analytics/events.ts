// Event catalog — single source of truth.
// See docs/superpowers/specs/2026-04-21-mixpanel-analytics-design.md §Event catalog.

// -------- Event names (tuple → type) --------

export const EVENT_NAMES = [
  'App Opened',
  'App Foregrounded',
  'App Backgrounded',
  'Screen Viewed',
  'Onboarding Started',
  // NOTE: Onboarding is single-screen today — see docs/analytics.md Known gaps
  // for reintroducing 'Onboarding Step Completed' if multi-step onboarding ships.
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
      'name' | 'weight_kg' | 'daily_goal_ml' | 'wake_time' | 'sleep_time' | 'activity_level' | 'climate',
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
  /** User's display name. Sent for corporate user-identification needs.
   * NOTE: this is PII — retention/GDPR/CCPA implications apply. See docs/analytics.md. */
  name?: string;
};

// -------- Runtime allowlist for Profile Updated values --------

export const PROFILE_UPDATE_ALLOWED_FIELDS = [
  'name',
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
