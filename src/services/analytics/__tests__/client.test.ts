import { Mixpanel } from 'mixpanel-react-native';
// __resetMocks lives on the jest manual mock; require to bypass type check.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __resetMocks } = require('mixpanel-react-native');

// Minimal mmkv test shim — attached via jest.mock to avoid the real MMKV native module.
const mmkvStore: Record<string, unknown> = {};
jest.mock('../../../store/mmkv', () => ({
  mmkv: {
    getBoolean: (k: string) => mmkvStore[k] as boolean | undefined,
    set: (k: string, v: unknown) => { mmkvStore[k] = v; },
    remove: (k: string) => { delete mmkvStore[k]; },
    getNumber: (k: string) => mmkvStore[k] as number | undefined,
    getString: (k: string) => mmkvStore[k] as string | undefined,
  },
  storage: {},
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

jest.mock('../screenTracking', () => ({
  resetScreenTrackingState: jest.fn(),
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
  // The Mixpanel class is constructed exactly once at module load (singleton in
  // client.ts). Always instance[0].
  const ctor = Mixpanel as unknown as jest.Mock;
  return ctor.mock.instances[0] as unknown as jest.Mocked<Mixpanel>;
}

describe('analytics client', () => {
  beforeEach(() => {
    __resetForTests();
    __resetMocks();
    for (const k of Object.keys(mmkvStore)) delete mmkvStore[k];
    const mp = getMixpanelInstance();
    if (mp) {
      (mp.init as jest.Mock).mockClear();
      (mp.track as jest.Mock).mockClear();
      (mp.registerSuperProperties as jest.Mock).mockClear();
      (mp.optOutTracking as jest.Mock).mockClear();
      (mp.optInTracking as jest.Mock).mockClear();
      (mp.flush as jest.Mock).mockClear();
      (mp.reset as jest.Mock).mockClear();
      (mp.setLoggingEnabled as jest.Mock).mockClear();
    }
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
      // App Opened still fires from initAnalytics, but the queued Water Logged is dropped.
      const waterCalls = mp.track.mock.calls.filter(([n]) => n === 'Water Logged');
      expect(waterCalls).toHaveLength(0);
    });

    it('10s timeout drains the queue without dispatch and without flipping optOut', async () => {
      jest.useFakeTimers();
      try {
        track('Onboarding Started');
        jest.advanceTimersByTime(10_001);
      } finally {
        jest.useRealTimers();
      }
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

      const mmkvMod = require('../../../store/mmkv');
      const origSet = mmkvMod.mmkv.set;
      mmkvMod.mmkv.set = (k: string, v: unknown) => {
        if (k === 'analytics:optedOut') order.push('mmkv');
        mmkvStore[k] = v;
      };

      try {
        await optOut();
      } finally {
        mmkvMod.mmkv.set = origSet;
      }

      expect(order).toEqual(['flush', 'mmkv', 'optOutTracking', 'reset']);
    });

    it('optIn: MMKV remove → optInTracking → syncSessionProperties', async () => {
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
      const people = mp.getPeople() as any;
      people.set.mockClear();

      syncUserProfile({
        name: 'Android Test',
        weight: 75, age: 30, gender: 'male', activityLevel: 'active',
        climatePreference: 'hot', wakeUpTime: { hour: 6, minute: 30 },
        sleepTime: { hour: 22, minute: 15 }, dailyGoal: 3100,
      });

      expect(mp.registerSuperProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Android Test',
          weight_kg: 75, age: 30, gender: 'male',
          activity_level: 'active', climate: 'hot',
          wake_time: '06:30', sleep_time: '22:15',
          daily_goal_ml: 3100,
        }),
      );
      // People.set receives the reserved $name too (drives the Users-tab title).
      expect(people.set).toHaveBeenCalledWith(
        expect.objectContaining({ $name: 'Android Test', name: 'Android Test' }),
      );
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
