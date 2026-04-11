// Water goal calculation engine.
// Supports both the legacy simple formula and the new smart multi-factor formula.

import type { Gender, ActivityLevel, ClimatePreference } from '../types';
import {
  MIN_GOAL_ML,
  MAX_GOAL_ML,
  ACTIVITY_BUMP_INTERVAL_MIN,
  ACTIVITY_BUMP_ML,
} from '../config';

export interface GoalCalculationInput {
  weight: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  weatherBonusMl: number;
  activeMinutesToday: number;
}

export interface GoalCalculationResult {
  baseGoal: number;
  activityBonus: number;
  weatherBonus: number;
  activityBump: number;
  effectiveGoal: number;
}

const GENDER_MULTIPLIER: Record<Gender, number> = {
  male: 1.0,
  female: 0.9,
  other: 1.0,
};

const ACTIVITY_BONUS: Record<ActivityLevel, number> = {
  sedentary: 0,
  moderate: 350,
  active: 700,
};

export function calculateSmartGoal(input: GoalCalculationInput): GoalCalculationResult {
  const rawBase = input.weight * 35;
  const genderMul = GENDER_MULTIPLIER[input.gender];
  const ageMul = input.age > 55 ? 0.9 : 1.0;
  const baseGoal = Math.round(rawBase * genderMul * ageMul);

  const activityBonus = ACTIVITY_BONUS[input.activityLevel];
  const weatherBonus = input.weatherBonusMl;
  const activityBump =
    Math.floor(input.activeMinutesToday / ACTIVITY_BUMP_INTERVAL_MIN) * ACTIVITY_BUMP_ML;

  const raw = baseGoal + activityBonus + weatherBonus + activityBump;
  const effectiveGoal = Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, raw));

  return { baseGoal, activityBonus, weatherBonus, activityBump, effectiveGoal };
}

export function getWeatherBonusFromTemp(tempC: number): number {
  if (tempC < 15) return 0;
  if (tempC < 25) return 200;
  if (tempC < 35) return 500;
  return 750;
}

export function getWeatherBonusFromClimate(climate: ClimatePreference): number {
  const map: Record<ClimatePreference, number> = {
    cold: 0,
    temperate: 200,
    hot: 500,
    tropical: 750,
  };
  return map[climate];
}

// Legacy formula — kept for backward compatibility.
export function calculateDailyGoal(weight: number, age: number): number {
  const base = weight * 35;
  const adjusted = age > 55 ? base * 0.9 : base;
  return Math.round(adjusted);
}
