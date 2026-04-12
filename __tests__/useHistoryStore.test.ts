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
