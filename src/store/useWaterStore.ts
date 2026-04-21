// Zustand store for daily water consumption tracking.
// Persisted to MMKV. Handles logging, undo, and midnight reset.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import type { WaterDay } from '../types';

// Fraction of effectiveGoal that counts as "goal met" for analytics Goal Met
// emission and streak continuation. Changing this value requires bumping
// streak_rule_version in src/services/analytics/events.ts in the same commit —
// the string-literal union makes a mismatch a compile error.
export const GOAL_MET_THRESHOLD = 0.8;

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
      goalCelebratedToday: false,
      goalMetFiredToday: false,

      logWater: (amount) => {
        const now = new Date().toISOString();
        const newConsumed = get().consumed + amount;
        const wasCelebrated = get().goalCelebratedToday;
        set({
          consumed: newConsumed,
          lastLoggedAt: now,
          lastLogAmount: amount,
        });
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, now);
        // Fire celebration on first goal crossing today
        if (!wasCelebrated && newConsumed >= effectiveGoal) {
          set({ goalCelebratedToday: true });
        }
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
        const state = get();
        if (state.date !== today && state.date !== '') {
          // Archive yesterday's data before resetting
          const { useHistoryStore } = require('./useHistoryStore');
          const { useGoalStore } = require('./useGoalStore');
          const goalState = useGoalStore.getState();
          useHistoryStore.getState().archiveDay({
            date: state.date,
            consumed: state.consumed,
            effectiveGoal: goalState.effectiveGoal,
            goalMet: state.consumed >= goalState.effectiveGoal,
            activeMinutes: goalState.lastActiveMinutes,
            weatherBonus: goalState.weatherBonus,
          });

          set({
            consumed: 0,
            lastLoggedAt: null,
            lastLogAmount: null,
            date: today,
            goalCelebratedToday: false,
          });
          // Reset and recalculate the smart goal for the new day.
          // recalculateMorningGoal handles widget data write after async completion.
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
        goalCelebratedToday: state.goalCelebratedToday,
        goalMetFiredToday: state.goalMetFiredToday,
      }),
    },
  ),
);
