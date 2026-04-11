// Zustand store for daily water consumption tracking.
// Persisted to MMKV. Handles logging, undo, and midnight reset.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import { useUserStore } from './useUserStore';
import type { WaterDay } from '../types';

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface WaterActions {
  logWater: (amount: number) => void;
  undoLastLog: () => void;
  checkMidnightReset: () => void;
}

type WaterState = WaterDay & WaterActions;

export const useWaterStore = create<WaterState>()(
  persist(
    (set, get) => ({
      consumed: 0,
      lastLoggedAt: null,
      lastLogAmount: null,
      date: getTodayDate(),

      logWater: (amount) => {
        const now = new Date().toISOString();
        const newConsumed = get().consumed + amount;
        set({
          consumed: newConsumed,
          lastLoggedAt: now,
          lastLogAmount: amount,
        });
        const { dailyGoal } = useUserStore.getState();
        writeWidgetData(dailyGoal, newConsumed, now);
      },

      undoLastLog: () => {
        const { lastLogAmount, consumed } = get();
        if (lastLogAmount === null) return;
        const newConsumed = Math.max(0, consumed - lastLogAmount);
        const lastLogged = get().lastLoggedAt;
        set({
          consumed: newConsumed,
          lastLogAmount: null,
        });
        const { dailyGoal } = useUserStore.getState();
        writeWidgetData(dailyGoal, newConsumed, lastLogged);
      },

      checkMidnightReset: () => {
        const today = getTodayDate();
        if (get().date !== today) {
          set({
            consumed: 0,
            lastLoggedAt: null,
            lastLogAmount: null,
            date: today,
          });
          const { dailyGoal } = useUserStore.getState();
          writeWidgetData(dailyGoal, 0, null);
        }
      },
    }),
    {
      name: 'water-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        consumed: state.consumed,
        lastLoggedAt: state.lastLoggedAt,
        lastLogAmount: state.lastLogAmount,
        date: state.date,
      }),
    },
  ),
);
