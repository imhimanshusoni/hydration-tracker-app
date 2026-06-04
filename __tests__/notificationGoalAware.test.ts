// Goal-aware reminder scheduling: once the daily goal hits 100%, the rest of
// today's reminders are suppressed (anchored to tomorrow) while the DAILY
// repeats keep firing on subsequent days without reopening the app.

import { useWaterStore, isDailyGoalMet } from '../src/store/useWaterStore';
import { useGoalStore } from '../src/store/useGoalStore';
import { useUserStore } from '../src/store/useUserStore';
import { scheduleReminders } from '../src/utils/notificationScheduler';

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

jest.mock('@kingstinct/react-native-healthkit', () => ({
  requestAuthorization: jest.fn().mockResolvedValue(true),
  queryQuantitySamples: jest.fn().mockResolvedValue([]),
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

jest.mock('../src/services/analytics', () => ({
  track: jest.fn(),
  initAnalytics: jest.fn().mockResolvedValue(undefined),
  initAnalyticsForBackground: jest.fn().mockResolvedValue(undefined),
  syncUserProfile: jest.fn(),
  syncSessionProperties: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  EventType: { DELIVERED: 3, PRESS: 1, DISMISSED: 0, ACTION_PRESS: 2 },
}));

const notifee = require('@notifee/react-native').default;
const mockCreateTrigger = notifee.createTriggerNotification as jest.Mock;

const WAKE = { hour: 8, minute: 0 };
const SLEEP = { hour: 22, minute: 0 };
const HOUR_COUNT = SLEEP.hour - WAKE.hour + 1; // 15

// Fixed clock: 12:30 local — hours 8-12 are past, 13-22 are future.
// Only Date is faked so async flushing via real setTimeout still works.
const FIXED_NOW = new Date(2026, 5, 4, 12, 30, 0, 0);

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Drains the fire-and-forget scheduleReminders() chain (mocked notifee
// resolves in microtasks, so one macrotask tick is enough).
function flushAsync(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function scheduledTriggers(): { id: string; timestamp: number }[] {
  return mockCreateTrigger.mock.calls.map(([notif, trigger]) => ({
    id: notif.id,
    timestamp: trigger.timestamp,
  }));
}

function isTomorrow(timestamp: number): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(timestamp).getDate() === tomorrow.getDate();
}

beforeEach(() => {
  jest.useFakeTimers({
    now: FIXED_NOW,
    doNotFake: [
      'setTimeout', 'setInterval', 'setImmediate',
      'clearTimeout', 'clearInterval', 'clearImmediate',
      'queueMicrotask', 'nextTick', 'hrtime', 'performance',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback',
    ],
  });
  mockCreateTrigger.mockClear();
  (notifee.cancelAllNotifications as jest.Mock).mockClear();
  useWaterStore.setState({
    consumed: 0,
    lastLoggedAt: null,
    lastLogAmount: null,
    date: getTodayStr(),
    goalCelebratedToday: false,
    goalMetFiredToday: false,
  });
  useGoalStore.setState({ effectiveGoal: 2800, lastActiveMinutes: 0, weatherBonus: 0 });
  useUserStore.setState({ wakeUpTime: WAKE, sleepTime: SLEEP, remindersEnabled: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isDailyGoalMet', () => {
  it('is false below the goal', () => {
    useWaterStore.setState({ consumed: 2799 });
    expect(isDailyGoalMet()).toBe(false);
  });

  it('is true at and above the goal', () => {
    useWaterStore.setState({ consumed: 2800 });
    expect(isDailyGoalMet()).toBe(true);
    useWaterStore.setState({ consumed: 3000 });
    expect(isDailyGoalMet()).toBe(true);
  });

  it('is false when effectiveGoal is 0', () => {
    useGoalStore.setState({ effectiveGoal: 0 });
    useWaterStore.setState({ consumed: 500 });
    expect(isDailyGoalMet()).toBe(false);
  });
});

describe('scheduleReminders anchoring', () => {
  it('anchors ALL hours to tomorrow when goal is met (suppressed today, back tomorrow)', async () => {
    useWaterStore.setState({ consumed: 2800 });

    await scheduleReminders(WAKE, SLEEP, true);

    const triggers = scheduledTriggers();
    // All hours still scheduled — suppressed, not cancelled, so DAILY repeats
    // resume tomorrow even if the app is never reopened.
    expect(triggers).toHaveLength(HOUR_COUNT);
    for (const t of triggers) {
      expect(t.timestamp).toBeGreaterThan(Date.now());
      expect(isTomorrow(t.timestamp)).toBe(true);
    }
  });

  it('keeps pre-fix behavior when goal is not met: future hours today, past hours tomorrow', async () => {
    useWaterStore.setState({ consumed: 1000 });

    await scheduleReminders(WAKE, SLEEP, true);

    const triggers = scheduledTriggers();
    expect(triggers).toHaveLength(HOUR_COUNT);
    for (const t of triggers) {
      const hour = Number(t.id.replace('water-reminder-', ''));
      if (hour <= 12) {
        // 8:00-12:00 are past 12:30 → tomorrow (Android requirement)
        expect(isTomorrow(t.timestamp)).toBe(true);
      } else {
        // 13:00-22:00 are still ahead today
        expect(isTomorrow(t.timestamp)).toBe(false);
        expect(t.timestamp).toBeGreaterThan(Date.now());
      }
    }
  });
});

describe('store-triggered rescheduling', () => {
  it('logWater crossing 100% reschedules with all hours suppressed to tomorrow', async () => {
    useWaterStore.setState({ consumed: 2700 });

    useWaterStore.getState().logWater(200); // 2900 >= 2800, first crossing
    await flushAsync();

    const triggers = scheduledTriggers();
    expect(triggers).toHaveLength(HOUR_COUNT);
    expect(triggers.every(t => isTomorrow(t.timestamp))).toBe(true);
  });

  it('logWater after goal already celebrated does NOT reschedule again', async () => {
    useWaterStore.setState({ consumed: 2900, goalCelebratedToday: true });

    useWaterStore.getState().logWater(100);
    await flushAsync();

    expect(mockCreateTrigger).not.toHaveBeenCalled();
  });

  it('logWater below the goal does NOT reschedule', async () => {
    useWaterStore.getState().logWater(250); // 250 < 2800
    await flushAsync();

    expect(mockCreateTrigger).not.toHaveBeenCalled();
  });

  it('undoLastLog dropping below goal restores today\'s remaining reminders', async () => {
    useWaterStore.setState({
      consumed: 2900,
      goalCelebratedToday: true,
      lastLogAmount: 300,
      lastLoggedAt: new Date().toISOString(),
    });

    useWaterStore.getState().undoLastLog(); // 2600 < 2800
    await flushAsync();

    const triggers = scheduledTriggers();
    expect(triggers).toHaveLength(HOUR_COUNT);
    // Future hours are anchored back to today again.
    const futureToday = triggers.filter(t => !isTomorrow(t.timestamp));
    expect(futureToday.length).toBe(SLEEP.hour - 12); // hours 13-22
  });

  it('undoLastLog staying at/above goal does NOT reschedule', async () => {
    useWaterStore.setState({
      consumed: 3200,
      goalCelebratedToday: true,
      lastLogAmount: 100,
      lastLoggedAt: new Date().toISOString(),
    });

    useWaterStore.getState().undoLastLog(); // 3100 >= 2800
    await flushAsync();

    expect(mockCreateTrigger).not.toHaveBeenCalled();
  });

  it('midnight reset clears goal-met state so the new day schedules normally', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    useWaterStore.setState({
      consumed: 3000,
      date: yesterdayStr,
      goalCelebratedToday: true,
    });
    expect(isDailyGoalMet()).toBe(true);

    useWaterStore.getState().checkMidnightReset();

    expect(isDailyGoalMet()).toBe(false);
    expect(useWaterStore.getState().goalCelebratedToday).toBe(false);
  });
});
