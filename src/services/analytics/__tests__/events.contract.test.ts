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
    for (const [, props] of Object.entries(SAMPLE_PROPS)) {
      if (props === null) continue;
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
    const input = {
      weight_kg: 70,
      daily_goal_ml: 2800,
      wake_time: '07:00',
      sleep_time: '23:00',
      activity_level: 'moderate',
      climate: 'temperate',
      name: 'Leak Test',
      email: 'leak@example.com',
    };
    const filtered = filterProfileUpdateValues(input);
    expect(Object.keys(filtered).sort()).toEqual([...PROFILE_UPDATE_ALLOWED_FIELDS].sort());
    expect(filtered).not.toHaveProperty('name');
    expect(filtered).not.toHaveProperty('email');
  });
});
