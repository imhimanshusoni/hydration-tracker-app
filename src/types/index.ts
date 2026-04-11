// Shared TypeScript types for Water Reminder app

export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface UserProfile {
  name: string;
  weight: number; // kg, 30-200
  age: number; // 12-100
  wakeUpTime: TimeOfDay;
  sleepTime: TimeOfDay;
  remindersEnabled: boolean;
  onboardingComplete: boolean;
  dailyGoal: number; // ml
}

export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
}
