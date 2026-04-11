// Zustand store for user profile and preferences.
// Persisted to MMKV. Updates widget data on goal changes.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import { calculateDailyGoal } from '../utils/waterCalculator';
import type { TimeOfDay, UserProfile } from '../types';

interface UserActions {
  completeOnboarding: (profile: Omit<UserProfile, 'onboardingComplete' | 'dailyGoal' | 'remindersEnabled'>) => void;
  updateProfile: (updates: { name?: string; weight?: number; age?: number }) => void;
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
      },

      updateProfile: (updates) => {
        const current = get();
        const weight = updates.weight ?? current.weight;
        const age = updates.age ?? current.age;
        const goal = calculateDailyGoal(weight, age);
        set({ ...updates, dailyGoal: goal });
        // Update widget goal — read consumed from water store (canonical source)
        const { useWaterStore } = require('./useWaterStore');
        const { consumed, lastLoggedAt } = useWaterStore.getState();
        writeWidgetData(goal, consumed, lastLoggedAt);
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
        wakeUpTime: state.wakeUpTime,
        sleepTime: state.sleepTime,
        remindersEnabled: state.remindersEnabled,
        onboardingComplete: state.onboardingComplete,
        dailyGoal: state.dailyGoal,
      }),
    },
  ),
);
