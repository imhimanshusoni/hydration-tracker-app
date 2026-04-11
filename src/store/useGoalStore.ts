// Zustand store for dynamic daily goal state.
// Persisted to MMKV. Handles morning recalculation and intra-day activity bumps.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import {
  calculateSmartGoal,
  getWeatherBonusFromTemp,
  getWeatherBonusFromClimate,
} from '../utils/waterCalculator';
import { fetchCurrentWeather } from '../utils/weatherService';
import { getTodayActiveMinutes } from '../utils/healthService';
import type { DailyGoalState, WeatherData } from '../types';

interface GoalActions {
  recalculateMorningGoal: () => Promise<void>;
  applyActivityBump: (newActiveMinutes: number) => void;
  resetDaily: () => void;
  clearToast: () => void;
}

type GoalState = DailyGoalState & {
  goalAdjustmentToast: string | null;
} & GoalActions;

const INITIAL_STATE: DailyGoalState & { goalAdjustmentToast: string | null } = {
  baseGoal: 2450,
  weatherBonus: 0,
  activityBonus: 350,
  activityBump: 0,
  effectiveGoal: 2800,
  lastWeatherCheck: null,
  weatherSource: null,
  lastActiveMinutes: 0,
  weatherData: null,
  goalAdjustmentToast: null,
};

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      recalculateMorningGoal: async () => {
        const { useUserStore } = require('./useUserStore');
        const profile = useUserStore.getState();

        // Fetch weather (fallback to manual climate preference)
        let weatherBonus: number;
        let weatherSource: 'api' | 'manual';
        let storedWeatherData: WeatherData | null = null;

        const weather = await fetchCurrentWeather();
        if (weather) {
          weatherBonus = getWeatherBonusFromTemp(weather.tempC);
          weatherSource = 'api';
          storedWeatherData = weather;
        } else {
          weatherBonus = getWeatherBonusFromClimate(profile.climatePreference);
          weatherSource = 'manual';
        }

        // Query today's active minutes
        const activeMinutes = await getTodayActiveMinutes();

        const result = calculateSmartGoal({
          weight: profile.weight,
          age: profile.age,
          gender: profile.gender,
          activityLevel: profile.activityLevel,
          weatherBonusMl: weatherBonus,
          activeMinutesToday: activeMinutes,
        });

        const today = new Date().toISOString().split('T')[0];

        set({
          baseGoal: result.baseGoal,
          weatherBonus: result.weatherBonus,
          activityBonus: result.activityBonus,
          activityBump: result.activityBump,
          effectiveGoal: result.effectiveGoal,
          lastWeatherCheck: today,
          weatherSource,
          lastActiveMinutes: activeMinutes,
          weatherData: storedWeatherData,
        });

        // Sync widget
        const { useWaterStore } = require('./useWaterStore');
        const { consumed, lastLoggedAt } = useWaterStore.getState();
        writeWidgetData(result.effectiveGoal, consumed, lastLoggedAt);
      },

      applyActivityBump: (newActiveMinutes: number) => {
        const current = get();
        if (newActiveMinutes <= current.lastActiveMinutes) return;

        const { useUserStore } = require('./useUserStore');
        const profile = useUserStore.getState();

        const result = calculateSmartGoal({
          weight: profile.weight,
          age: profile.age,
          gender: profile.gender,
          activityLevel: profile.activityLevel,
          weatherBonusMl: current.weatherBonus,
          activeMinutesToday: newActiveMinutes,
        });

        // Goal only goes up
        if (result.effectiveGoal <= current.effectiveGoal) {
          set({ lastActiveMinutes: newActiveMinutes });
          return;
        }

        const goalL = (result.effectiveGoal / 1000).toFixed(1);
        set({
          activityBump: result.activityBump,
          effectiveGoal: result.effectiveGoal,
          lastActiveMinutes: newActiveMinutes,
          goalAdjustmentToast: `Goal adjusted to ${goalL}L \u2014 you've been active!`,
        });

        // Sync widget
        const { useWaterStore } = require('./useWaterStore');
        const { consumed, lastLoggedAt } = useWaterStore.getState();
        writeWidgetData(result.effectiveGoal, consumed, lastLoggedAt);
      },

      resetDaily: () => {
        set({
          baseGoal: 0,
          weatherBonus: 0,
          activityBonus: 0,
          activityBump: 0,
          effectiveGoal: 0,
          lastWeatherCheck: null,
          weatherSource: null,
          lastActiveMinutes: 0,
          weatherData: null,
          goalAdjustmentToast: null,
        });
      },

      clearToast: () => {
        set({ goalAdjustmentToast: null });
      },
    }),
    {
      name: 'goal-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        baseGoal: state.baseGoal,
        weatherBonus: state.weatherBonus,
        activityBonus: state.activityBonus,
        activityBump: state.activityBump,
        effectiveGoal: state.effectiveGoal,
        lastWeatherCheck: state.lastWeatherCheck,
        weatherSource: state.weatherSource,
        lastActiveMinutes: state.lastActiveMinutes,
        weatherData: state.weatherData,
      }),
    },
  ),
);
