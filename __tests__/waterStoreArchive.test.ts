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
    expect(snapshots[yesterdayStr].goalMet).toBe(false);
    expect(snapshots[yesterdayStr].activeMinutes).toBe(45);
    expect(snapshots[yesterdayStr].weatherBonus).toBe(200);

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
