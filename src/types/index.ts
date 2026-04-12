// Shared TypeScript types for Water Reminder app

export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'moderate' | 'active';
export type ClimatePreference = 'cold' | 'temperate' | 'hot' | 'tropical';

export interface UserProfile {
  name: string;
  weight: number; // kg, 30-200
  age: number; // 12-100
  gender: Gender;
  activityLevel: ActivityLevel;
  climatePreference: ClimatePreference;
  wakeUpTime: TimeOfDay;
  sleepTime: TimeOfDay;
  remindersEnabled: boolean;
  onboardingComplete: boolean;
  dailyGoal: number; // ml
}

export interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  conditionCode: number;
  conditionMain: string;
  description: string;
  cityName: string | null;
}

export interface DailyGoalState {
  baseGoal: number;
  weatherBonus: number;
  activityBonus: number;
  activityBump: number;
  effectiveGoal: number;
  lastWeatherCheck: string | null;
  weatherSource: 'api' | 'manual' | null;
  lastActiveMinutes: number;
  weatherData: WeatherData | null;
}

export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
  goalCelebratedToday: boolean;
}

export interface DailySnapshot {
  date: string; // "YYYY-MM-DD"
  consumed: number; // ml, final value at end of day
  effectiveGoal: number; // ml, effective goal at time of archive
  goalMet: boolean; // consumed >= effectiveGoal
  activeMinutes: number; // from Health Connect/HealthKit
  weatherBonus: number; // ml
}
