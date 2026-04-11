// Zustand store for daily water consumption tracking.
// Persisted to MMKV. Handles logging, undo, and midnight reset.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
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
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, now);
      },

      undoLastLog: () => {
        const { lastLogAmount, consumed } = get();
        if (lastLogAmount === null) return;
        const newConsumed = Math.max(0, consumed - lastLogAmount);
        set({
          consumed: newConsumed,
          lastLogAmount: null,
          lastLoggedAt: null,
        });
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, null);
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
          // Reset and recalculate the smart goal for the new day.
          // recalculateMorningGoal handles widget data write after async completion.
          const { useGoalStore } = require('./useGoalStore');
          const goalStore = useGoalStore.getState();
          goalStore.resetDaily();
          goalStore.recalculateMorningGoal();
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
