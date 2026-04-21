// Streak counter — amber dot + "N day streak" text.
// Hidden when streak is 0. Includes today if goal is met.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useHistoryStore, computeCurrentStreak } from '../store/useHistoryStore';
import { useWaterStore, GOAL_MET_THRESHOLD } from '../store/useWaterStore';
import { useGoalStore } from '../store/useGoalStore';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';

interface StreakCounterProps {
  theme: AppTheme;
}

export function StreakCounter({ theme }: StreakCounterProps) {
  const snapshots = useHistoryStore((s) => s.snapshots);
  const consumed = useWaterStore((s) => s.consumed);
  const effectiveGoal = useGoalStore((s) => s.effectiveGoal);

  const historicalStreak = useMemo(() => computeCurrentStreak(snapshots), [snapshots]);

  // Match the archive/streak-continuation threshold (80%) so the live display
  // agrees with what will be written to history at midnight. Using 100% here
  // would under-report the streak today, then over-correct tomorrow.
  const todayMet = effectiveGoal > 0 && consumed >= GOAL_MET_THRESHOLD * effectiveGoal;
  const streak = historicalStreak + (todayMet ? 1 : 0);

  if (streak === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: theme.accentWarm }]} />
      <Text style={[styles.text, { color: theme.accentWarm }]}>
        {streak} day streak
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
});
