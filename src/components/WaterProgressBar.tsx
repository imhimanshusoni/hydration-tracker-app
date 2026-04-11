// Circular progress ring showing water consumed vs daily goal.
// Uses react-native-svg for the ring. Accepts consumed/goal in ml.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { AppTheme } from '../theme';

interface WaterProgressBarProps {
  consumed: number; // ml
  dailyGoal: number; // ml
  theme: AppTheme;
}

const SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WaterProgressBar({ consumed, dailyGoal, theme }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1); // Clamp ring at 100%, but show real percentage in text
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const percentage = Math.round(progress * 100);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.border}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.accent}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.amount, { color: theme.text }]}>
          {consumedL} / {goalL} L
        </Text>
        <Text style={[styles.percentage, { color: theme.textSecondary }]}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
  },
  percentage: {
    fontSize: 16,
    marginTop: 4,
  },
});
