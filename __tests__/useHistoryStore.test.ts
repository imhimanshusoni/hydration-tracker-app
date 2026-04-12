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

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

describe('getCurrentStreak', () => {
  it('returns 0 when no history', () => {
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(0);
  });

  it('returns 0 when yesterday goal was not met', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 1000, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(0);
  });

  it('returns 1 when only yesterday goal was met', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });

  it('counts consecutive days backwards', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        [daysAgo(2)]: makeSnapshot(daysAgo(2), 2900, 2800),
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(3);
  });

  it('stops at first missed day', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        [daysAgo(2)]: makeSnapshot(daysAgo(2), 1000, 2800),
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });

  it('stops at gap (missing day)', () => {
    useHistoryStore.setState({
      snapshots: {
        [daysAgo(1)]: makeSnapshot(daysAgo(1), 3000, 2800),
        [daysAgo(3)]: makeSnapshot(daysAgo(3), 2800, 2800),
      },
    });
    expect(useHistoryStore.getState().getCurrentStreak()).toBe(1);
  });
});

describe('getLast7Days', () => {
  it('returns 7 entries', () => {
    const result = useHistoryStore.getState().getLast7Days();
    expect(result).toHaveLength(7);
  });

  it('returns null for days with no data', () => {
    const result = useHistoryStore.getState().getLast7Days();
    result.forEach((entry) => {
      expect(entry).toBeNull();
    });
  });

  it('returns snapshot data for days that have history', () => {
    const yesterdayDate = daysAgo(1);
    useHistoryStore.setState({
      snapshots: {
        [yesterdayDate]: makeSnapshot(yesterdayDate, 2500, 2800),
      },
    });
    const result = useHistoryStore.getState().getLast7Days();
    expect(result[5]).not.toBeNull();
    expect(result[5]!.consumed).toBe(2500);
    expect(result[6]).toBeNull();
  });

  it('places snapshots at correct indices', () => {
    const threeDaysAgoDate = daysAgo(3);
    useHistoryStore.setState({
      snapshots: {
        [threeDaysAgoDate]: makeSnapshot(threeDaysAgoDate, 2000, 2800),
      },
    });
    const result = useHistoryStore.getState().getLast7Days();
    expect(result[3]).not.toBeNull();
    expect(result[3]!.date).toBe(threeDaysAgoDate);
  });
});
