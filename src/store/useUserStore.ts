// Zustand store for user profile and preferences.
// Persisted to MMKV. Updates widget data on goal changes.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import { calculateDailyGoal } from '../utils/waterCalculator';
import type { TimeOfDay, UserProfile, Gender, ActivityLevel, ClimatePreference } from '../types';
import { track, syncUserProfile } from '../services/analytics';

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
        writeWidgetData(goal, 0, null);

        syncUserProfile(get());

        const { useGoalStore } = require('./useGoalStore');
        useGoalStore.getState().recalculateMorningGoal();
      },

      updateProfile: (updates) => {
        const current = get();
        const weight = updates.weight ?? current.weight;
        const age = updates.age ?? current.age;
        const goal = calculateDailyGoal(weight, age);
        set({ ...updates, dailyGoal: goal });

        const fields_changed: string[] = [];
        const values: Record<string, string | number> = {};
        if (updates.weight !== undefined) { fields_changed.push('weight_kg'); values.weight_kg = updates.weight; }
        if (updates.age !== undefined) { fields_changed.push('age'); /* age not in allowlist */ }
        if (updates.activityLevel !== undefined) { fields_changed.push('activity_level'); values.activity_level = updates.activityLevel; }
        if (updates.climatePreference !== undefined) { fields_changed.push('climate'); values.climate = updates.climatePreference; }
        if (updates.gender !== undefined) { fields_changed.push('gender'); /* gender not in allowlist */ }
        if (updates.name !== undefined) { fields_changed.push('name'); values.name = updates.name; }
        // daily_goal_ml recomputed — track as changed when weight/age changed
        if (updates.weight !== undefined || updates.age !== undefined) {
          fields_changed.push('daily_goal_ml');
          values.daily_goal_ml = goal;
        }

        track('Profile Updated', { fields_changed, values });
        syncUserProfile(get());

        const { useGoalStore } = require('./useGoalStore');
        useGoalStore.getState().recalculateMorningGoal();
      },

      updateSchedule: (updates) => {
        set(updates);
        const fields_changed: string[] = [];
        const values: Record<string, string> = {};
        const fmt = (t: TimeOfDay) =>
          `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
        if (updates.wakeUpTime) { fields_changed.push('wake_time'); values.wake_time = fmt(updates.wakeUpTime); }
        if (updates.sleepTime) { fields_changed.push('sleep_time'); values.sleep_time = fmt(updates.sleepTime); }
        track('Profile Updated', { fields_changed, values });
        syncUserProfile(get());
      },

      setRemindersEnabled: (enabled) => {
        set({ remindersEnabled: enabled });
        track('Reminders Toggled', { enabled });
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
