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

      getCurrentStreak: () => {
        const { snapshots } = get();
        let streak = 0;
        const today = new Date();
        for (let i = 1; i <= MAX_AGE_DAYS; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const snap = snapshots[dateStr];
          if (!snap || !snap.goalMet) break;
          streak++;
        }
        return streak;
      },

      getLast7Days: () => {
        const { snapshots } = get();
        const result: (DailySnapshot | null)[] = [];
        const today = new Date();
        for (let i = 6; i >= 1; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push(snapshots[dateStr] ?? null);
        }
        result.push(null); // Today placeholder
        return result;
      },
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
