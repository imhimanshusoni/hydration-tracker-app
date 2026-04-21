// Zustand store for daily water consumption tracking.
// Persisted to MMKV. Handles logging, undo, and midnight reset.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import type { WaterDay } from '../types';
import { track } from '../services/analytics';

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
  logWater: (amount: number, source?: 'quick' | 'custom' | 'suggested') => void;
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

      logWater: (amount, source) => {
        const now = new Date().toISOString();
        const prevConsumed = get().consumed;
        const newConsumed = prevConsumed + amount;
        const wasCelebrated = get().goalCelebratedToday;
        const wasGoalMetFired = get().goalMetFiredToday;
        set({
          consumed: newConsumed,
          lastLoggedAt: now,
          lastLogAmount: amount,
        });
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, now);
        // Celebration animation: fires on first 100% crossing (UX decision,
        // orthogonal to analytics 80% threshold).
        if (!wasCelebrated && newConsumed >= effectiveGoal) {
          set({ goalCelebratedToday: true });
        }
        // Goal Met analytics flag: strict-cross of 80% of effectiveGoal, once per day.
        const threshold = GOAL_MET_THRESHOLD * effectiveGoal;
        const crossedThreshold =
          !wasGoalMetFired && prevConsumed < threshold && newConsumed >= threshold;
        if (crossedThreshold) {
          set({ goalMetFiredToday: true });
        }

        track('Water Logged', {
          amount_ml: amount,
          source: source ?? 'quick',
          local_hour: new Date().getHours(),
          pct_of_goal_after: effectiveGoal > 0 ? newConsumed / effectiveGoal : 0,
          is_first_log_of_day: prevConsumed === 0,
        });

        if (crossedThreshold) {
          track('Goal Met', {
            goal_ml: effectiveGoal,
            consumed_ml: newConsumed,
          });
        }
      },

      undoLastLog: () => {
        const { lastLogAmount, consumed, lastLoggedAt } = get();
        if (lastLogAmount === null) return;
        const timeSinceLogSec = lastLoggedAt
          ? Math.max(0, Math.round((Date.now() - new Date(lastLoggedAt).getTime()) / 1000))
          : 0;
        const newConsumed = Math.max(0, consumed - lastLogAmount);
        set({
          consumed: newConsumed,
          lastLogAmount: null,
          lastLoggedAt: null,
        });
        const { useGoalStore } = require('./useGoalStore');
        const { effectiveGoal } = useGoalStore.getState();
        writeWidgetData(effectiveGoal, newConsumed, null);

        track('Log Undone', {
          amount_ml: lastLogAmount,
          time_since_log_sec: timeSinceLogSec,
        });
      },

      checkMidnightReset: () => {
        const today = getTodayDate();
        const state = get();
        if (state.date === today || state.date === '') return;

        const { useHistoryStore } = require('./useHistoryStore');
        const { useGoalStore } = require('./useGoalStore');
        const goalState = useGoalStore.getState();
        const threshold = GOAL_MET_THRESHOLD * goalState.effectiveGoal;
        useHistoryStore.getState().archiveDay({
          date: state.date,
          consumed: state.consumed,
          effectiveGoal: goalState.effectiveGoal,
          // 80% threshold: streak continuation and historical "goal met"
          // share GOAL_MET_THRESHOLD.
          goalMet: state.consumed >= threshold,
          activeMinutes: goalState.lastActiveMinutes,
          weatherBonus: goalState.weatherBonus,
        });

        set({
          consumed: 0,
          lastLoggedAt: null,
          lastLogAmount: null,
          date: today,
          goalCelebratedToday: false,
          goalMetFiredToday: false,
        });
        const goalStore = useGoalStore.getState();
        goalStore.resetDaily();
        goalStore.recalculateMorningGoal();
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
