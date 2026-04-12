// Zustand store for historical daily snapshots.
// Persisted to MMKV. Rolling 30-day retention.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './mmkv';
import type { DailySnapshot } from '../types';

interface HistoryState {
  snapshots: Record<string, DailySnapshot>;
  archiveDay: (snapshot: DailySnapshot) => void;
  pruneOldEntries: () => void;
  getCurrentStreak: () => number;
  getLast7Days: () => (DailySnapshot | null)[];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Standalone functions for use in components with useMemo (avoids new-reference-per-render)
export function computeCurrentStreak(snapshots: Record<string, DailySnapshot>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 1; i <= MAX_AGE_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const snap = snapshots[formatDate(d)];
    if (!snap || !snap.goalMet) break;
    streak++;
  }
  return streak;
}

export function computeLast7Days(snapshots: Record<string, DailySnapshot>): (DailySnapshot | null)[] {
  const result: (DailySnapshot | null)[] = [];
  const today = new Date();
  for (let i = 6; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push(snapshots[formatDate(d)] ?? null);
  }
  result.push(null); // Today placeholder
  return result;
}

const MAX_AGE_DAYS = 30;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      snapshots: {},

      archiveDay: (snapshot) => {
        set((state) => ({
          snapshots: { ...state.snapshots, [snapshot.date]: snapshot },
        }));
        get().pruneOldEntries();
      },

      pruneOldEntries: () => {
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - MAX_AGE_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        set((state) => {
          const pruned: Record<string, DailySnapshot> = {};
          for (const [date, snap] of Object.entries(state.snapshots)) {
            if (date >= cutoffStr) {
              pruned[date] = snap;
            }
          }
          return { snapshots: pruned };
        });
      },

      getCurrentStreak: () => computeCurrentStreak(get().snapshots),

      getLast7Days: () => computeLast7Days(get().snapshots),
    }),
    {
      name: 'history-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        snapshots: state.snapshots,
      }),
    },
  ),
);
