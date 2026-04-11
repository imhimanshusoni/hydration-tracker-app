// Pure function to calculate daily water goal in ml.
// Formula: weight (kg) * 35ml, reduced by 10% if age > 55.

export function calculateDailyGoal(weight: number, age: number): number {
  const base = weight * 35;
  const adjusted = age > 55 ? base * 0.9 : base;
  return Math.round(adjusted);
}
