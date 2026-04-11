import {
  calculateDailyGoal,
  calculateSmartGoal,
  getWeatherBonusFromTemp,
  getWeatherBonusFromClimate,
} from '../src/utils/waterCalculator';

describe('calculateDailyGoal (legacy)', () => {
  it('returns weight * 35 for age <= 55', () => {
    expect(calculateDailyGoal(70, 30)).toBe(2450);
  });

  it('returns weight * 35 * 0.9 for age > 55', () => {
    expect(calculateDailyGoal(80, 60)).toBe(2520);
  });

  it('returns integer result even with fractional calculation', () => {
    expect(calculateDailyGoal(65, 56)).toBe(2048);
  });

  it('handles boundary age of exactly 55', () => {
    expect(calculateDailyGoal(70, 55)).toBe(2450);
  });

  it('handles minimum valid weight', () => {
    expect(calculateDailyGoal(30, 20)).toBe(1050);
  });

  it('handles maximum valid weight with age reduction', () => {
    expect(calculateDailyGoal(200, 100)).toBe(6300);
  });
});

describe('calculateSmartGoal', () => {
  it('computes correct goal for male, sedentary, no weather, no activity', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'male',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    expect(result.baseGoal).toBe(2450);
    expect(result.activityBonus).toBe(0);
    expect(result.weatherBonus).toBe(0);
    expect(result.activityBump).toBe(0);
    expect(result.effectiveGoal).toBe(2450);
  });

  it('applies female gender multiplier (0.9)', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'female',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    // 70 * 35 * 0.9 = 2205
    expect(result.baseGoal).toBe(2205);
    expect(result.effectiveGoal).toBe(2205);
  });

  it('applies age multiplier for age > 55', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 60,
      gender: 'male',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    // 70 * 35 * 0.9 = 2205
    expect(result.baseGoal).toBe(2205);
  });

  it('stacks gender and age multipliers', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 60,
      gender: 'female',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    // 70 * 35 * 0.9 * 0.9 = 1984.5 → 1985
    expect(result.baseGoal).toBe(1985);
  });

  it('adds moderate activity bonus', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'male',
      activityLevel: 'moderate',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    expect(result.activityBonus).toBe(350);
    expect(result.effectiveGoal).toBe(2800);
  });

  it('adds active activity bonus', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'male',
      activityLevel: 'active',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    expect(result.activityBonus).toBe(700);
    expect(result.effectiveGoal).toBe(3150);
  });

  it('adds weather bonus', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'female',
      activityLevel: 'moderate',
      weatherBonusMl: 500,
      activeMinutesToday: 0,
    });
    expect(result.weatherBonus).toBe(500);
    // base 2205 + activity 350 + weather 500 = 3055
    expect(result.effectiveGoal).toBe(3055);
  });

  it('computes activity bump correctly for 30-min blocks', () => {
    const result0 = calculateSmartGoal({
      weight: 70, age: 25, gender: 'male', activityLevel: 'sedentary',
      weatherBonusMl: 0, activeMinutesToday: 0,
    });
    expect(result0.activityBump).toBe(0);

    const result29 = calculateSmartGoal({
      weight: 70, age: 25, gender: 'male', activityLevel: 'sedentary',
      weatherBonusMl: 0, activeMinutesToday: 29,
    });
    expect(result29.activityBump).toBe(0);

    const result30 = calculateSmartGoal({
      weight: 70, age: 25, gender: 'male', activityLevel: 'sedentary',
      weatherBonusMl: 0, activeMinutesToday: 30,
    });
    expect(result30.activityBump).toBe(350);

    const result60 = calculateSmartGoal({
      weight: 70, age: 25, gender: 'male', activityLevel: 'sedentary',
      weatherBonusMl: 0, activeMinutesToday: 60,
    });
    expect(result60.activityBump).toBe(700);

    const result91 = calculateSmartGoal({
      weight: 70, age: 25, gender: 'male', activityLevel: 'sedentary',
      weatherBonusMl: 0, activeMinutesToday: 91,
    });
    expect(result91.activityBump).toBe(1050);
  });

  it('clamps to minimum 1500ml', () => {
    const result = calculateSmartGoal({
      weight: 30,
      age: 60,
      gender: 'female',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    // 30 * 35 * 0.9 * 0.9 = 850.5 → 851, but clamped to 1500
    expect(result.effectiveGoal).toBe(1500);
  });

  it('clamps to maximum 5000ml', () => {
    const result = calculateSmartGoal({
      weight: 200,
      age: 25,
      gender: 'male',
      activityLevel: 'active',
      weatherBonusMl: 750,
      activeMinutesToday: 120,
    });
    // 200*35=7000 + 700 + 750 + 1400 = 9850, clamped to 5000
    expect(result.effectiveGoal).toBe(5000);
  });

  it('other gender uses multiplier 1.0', () => {
    const result = calculateSmartGoal({
      weight: 70,
      age: 25,
      gender: 'other',
      activityLevel: 'sedentary',
      weatherBonusMl: 0,
      activeMinutesToday: 0,
    });
    expect(result.baseGoal).toBe(2450);
  });
});

describe('getWeatherBonusFromTemp', () => {
  it('returns 0 for cold weather (< 15°C)', () => {
    expect(getWeatherBonusFromTemp(10)).toBe(0);
    expect(getWeatherBonusFromTemp(14.9)).toBe(0);
  });

  it('returns 200 for mild weather (15-25°C)', () => {
    expect(getWeatherBonusFromTemp(15)).toBe(200);
    expect(getWeatherBonusFromTemp(20)).toBe(200);
    expect(getWeatherBonusFromTemp(24.9)).toBe(200);
  });

  it('returns 500 for warm weather (25-35°C)', () => {
    expect(getWeatherBonusFromTemp(25)).toBe(500);
    expect(getWeatherBonusFromTemp(30)).toBe(500);
    expect(getWeatherBonusFromTemp(34.9)).toBe(500);
  });

  it('returns 750 for hot weather (>= 35°C)', () => {
    expect(getWeatherBonusFromTemp(35)).toBe(750);
    expect(getWeatherBonusFromTemp(40)).toBe(750);
  });
});

describe('getWeatherBonusFromClimate', () => {
  it('returns correct bonus for each climate preference', () => {
    expect(getWeatherBonusFromClimate('cold')).toBe(0);
    expect(getWeatherBonusFromClimate('temperate')).toBe(200);
    expect(getWeatherBonusFromClimate('hot')).toBe(500);
    expect(getWeatherBonusFromClimate('tropical')).toBe(750);
  });
});
