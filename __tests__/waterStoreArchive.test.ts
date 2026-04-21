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

    useWaterStore.getState().checkMidnightReset();

    const { snapshots } = useHistoryStore.getState();
    expect(snapshots[yesterdayStr]).toBeDefined();
    expect(snapshots[yesterdayStr].consumed).toBe(2500);
    expect(snapshots[yesterdayStr].effectiveGoal).toBe(2800);
    // Under v2_80pct: 2500 / 2800 = 0.893 > 0.8, so goalMet is true.
    expect(snapshots[yesterdayStr].goalMet).toBe(true);
    expect(snapshots[yesterdayStr].activeMinutes).toBe(45);
    expect(snapshots[yesterdayStr].weatherBonus).toBe(200);

    expect(useWaterStore.getState().consumed).toBe(0);
  });

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
    setYesterday(2300, true);
    useWaterStore.getState().checkMidnightReset();
    const called = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Streak Continued');
    expect(called).toBeDefined();
  });

  it('Day Streak Continued carries the new streak length (3 after 2 prior goal-met days)', () => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    useHistoryStore.setState({ snapshots: {
      [fmt(daysAgo(2))]: { date: fmt(daysAgo(2)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
      [fmt(daysAgo(3))]: { date: fmt(daysAgo(3)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
    }});
    setYesterday(2400, true);
    useWaterStore.getState().checkMidnightReset();
    const continued = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Streak Continued');
    expect(continued).toBeDefined();
    expect(continued![1]).toMatchObject({ streak_days: 3 });
  });

  it('emits Day Ended Below Goal when below 80% and goalMetFiredToday false', () => {
    setYesterday(2000, false);
    useWaterStore.getState().checkMidnightReset();
    const below = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Ended Below Goal');
    expect(below).toBeDefined();
    expect(below![1]).toMatchObject({ streak_threshold_met: false });
  });

  it('does NOT emit Day Ended Below Goal when goalMetFiredToday was true', () => {
    setYesterday(2200, true);
    useWaterStore.getState().checkMidnightReset();
    const below = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Ended Below Goal');
    expect(below).toBeUndefined();
  });

  it('emits Day Streak Broken alongside Day Ended Below Goal when prior streak > 0', () => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    useHistoryStore.setState({ snapshots: {
      [fmt(daysAgo(2))]: { date: fmt(daysAgo(2)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
      [fmt(daysAgo(3))]: { date: fmt(daysAgo(3)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
      [fmt(daysAgo(4))]: { date: fmt(daysAgo(4)), consumed: 2500, effectiveGoal: 2800, goalMet: true, activeMinutes: 0, weatherBonus: 0 },
    }});
    setYesterday(1500, false);
    useWaterStore.getState().checkMidnightReset();
    const broken = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Streak Broken');
    const below = mockTrack.mock.calls.find(([n]: [string]) => n === 'Day Ended Below Goal');
    expect(broken).toBeDefined();
    expect(broken![1]).toMatchObject({ previous_streak_days: 3 });
    expect(below).toBeDefined();
  });
});

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
