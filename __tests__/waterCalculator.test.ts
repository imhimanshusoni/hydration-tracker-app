import { calculateDailyGoal } from '../src/utils/waterCalculator';

describe('calculateDailyGoal', () => {
  it('returns weight * 35 for age <= 55', () => {
    expect(calculateDailyGoal(70, 30)).toBe(2450);
  });

  it('returns weight * 35 * 0.9 for age > 55', () => {
    // 80 * 35 = 2800, * 0.9 = 2520
    expect(calculateDailyGoal(80, 60)).toBe(2520);
  });

  it('returns integer result even with fractional calculation', () => {
    // 65 * 35 = 2275, * 0.9 = 2047.5 → 2048
    expect(calculateDailyGoal(65, 56)).toBe(2048);
  });

  it('handles boundary age of exactly 55', () => {
    // Age 55 is NOT > 55, so no reduction
    expect(calculateDailyGoal(70, 55)).toBe(2450);
  });

  it('handles minimum valid weight', () => {
    expect(calculateDailyGoal(30, 20)).toBe(1050);
  });

  it('handles maximum valid weight with age reduction', () => {
    // 200 * 35 = 7000, * 0.9 = 6300
    expect(calculateDailyGoal(200, 100)).toBe(6300);
  });
});
