// Zustand store for user profile and preferences.
// Persisted to MMKV. Updates widget data on goal changes.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import { calculateDailyGoal } from '../utils/waterCalculator';
import type { TimeOfDay, UserProfile, Gender, ActivityLevel, ClimatePreference } from '../types';

interface UserActions {
  completeOnboarding: (profile: Omit<UserProfile, 'onboardingComplete' | 'dailyGoal' | 'remindersEnabled'>) => void;
  updateProfile: (updates: {
    name?: string;
    weight?: number;
    age?: number;
    gender?: Gender;
    activityLevel?: ActivityLevel;
    climatePreference?: ClimatePreference;
  }) => void;
  updateSchedule: (updates: { wakeUpTime?: TimeOfDay; sleepTime?: TimeOfDay }) => void;
  setRemindersEnabled: (enabled: boolean) => void;
}

type UserState = UserProfile & UserActions;

const DEFAULT_WAKE: TimeOfDay = { hour: 7, minute: 0 };
const DEFAULT_SLEEP: TimeOfDay = { hour: 23, minute: 0 };

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      name: '',
      weight: 70,
      age: 25,
      gender: 'other' as Gender,
      activityLevel: 'moderate' as ActivityLevel,
      climatePreference: 'temperate' as ClimatePreference,
      wakeUpTime: DEFAULT_WAKE,
      sleepTime: DEFAULT_SLEEP,
      remindersEnabled: true,
      onboardingComplete: false,
      dailyGoal: 2450,

      completeOnboarding: (profile) => {
        const goal = calculateDailyGoal(profile.weight, profile.age);
        set({
          ...profile,
          dailyGoal: goal,
          remindersEnabled: true,
          onboardingComplete: true,
        });
        // Write widget data with fresh goal, 0 consumed
        writeWidgetData(goal, 0, null);
        // Trigger smart goal recalculation
        const { useGoalStore } = require('./useGoalStore');
        useGoalStore.getState().recalculateMorningGoal();
      },

      updateProfile: (updates) => {
        const current = get();
        const weight = updates.weight ?? current.weight;
        const age = updates.age ?? current.age;
        const goal = calculateDailyGoal(weight, age);
        set({ ...updates, dailyGoal: goal });
        // Trigger smart goal recalculation (handles widget data after async completion)
        const { useGoalStore } = require('./useGoalStore');
        useGoalStore.getState().recalculateMorningGoal();
      },

      updateSchedule: (updates) => {
        set(updates);
      },

      setRemindersEnabled: (enabled) => {
        set({ remindersEnabled: enabled });
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        name: state.name,
        weight: state.weight,
        age: state.age,
        gender: state.gender,
        activityLevel: state.activityLevel,
        climatePreference: state.climatePreference,
        wakeUpTime: state.wakeUpTime,
        sleepTime: state.sleepTime,
        remindersEnabled: state.remindersEnabled,
        onboardingComplete: state.onboardingComplete,
        dailyGoal: state.dailyGoal,
      }),
    },
  ),
);
