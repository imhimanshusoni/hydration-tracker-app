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

// Computes the streak as of the day before yesterday, i.e. *excluding* the day
// about to be archived. Required because useHistoryStore.getCurrentStreak()
// starts at day -1 (yesterday), and yesterday's snapshot does not exist yet
// at this point — so getCurrentStreak would always return 0 here. By starting
// at i=2, we read the streak that existed BEFORE the day being archived.
function computeStreakExcludingYesterday(
  snapshots: Record<string, { goalMet: boolean }>,
): number {
  let streak = 0;
  const today = new Date();
  for (let i = 2; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const snap = snapshots[key];
    if (!snap || !snap.goalMet) break;
    streak++;
  }
  return streak;
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
        const goalMet = state.consumed >= threshold;

        // Prior streak = streak excluding the day being archived.
        const priorStreak = computeStreakExcludingYesterday(
          useHistoryStore.getState().snapshots,
        );

        useHistoryStore.getState().archiveDay({
          date: state.date,
          consumed: state.consumed,
          effectiveGoal: goalState.effectiveGoal,
          goalMet,
          activeMinutes: goalState.lastActiveMinutes,
          weatherBonus: goalState.weatherBonus,
        });

        // New streak: if archived day met goal, priorStreak + 1; else 0.
        const newStreak = goalMet ? priorStreak + 1 : 0;

        // Goal-status event (XOR).
        if (!state.goalMetFiredToday && !goalMet) {
          track('Day Ended Below Goal', {
            goal_ml: goalState.effectiveGoal,
            consumed_ml: state.consumed,
            pct_of_goal: goalState.effectiveGoal > 0 ? state.consumed / goalState.effectiveGoal : 0,
            streak_threshold_met: goalMet, // always false in this branch under v2
          });
        }

        // Streak events (orthogonal — can accompany Day Ended Below Goal).
        if (goalMet) {
          track('Day Streak Continued', {
            streak_days: newStreak,
            goal_ml: goalState.effectiveGoal,
            consumed_ml: state.consumed,
          });
        } else if (priorStreak > 0) {
          track('Day Streak Broken', {
            previous_streak_days: priorStreak,
            goal_ml: goalState.effectiveGoal,
            consumed_ml: state.consumed,
          });
        }

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
