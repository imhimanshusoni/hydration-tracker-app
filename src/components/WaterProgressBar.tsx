// Hero progress ring — the centerpiece of the home screen.
// Thick teal arc on deep navy with layered depth rings.
// Displays consumed/goal in liters with percentage below.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { AppTheme } from '../theme';

interface WaterProgressBarProps {
  consumed: number;
  dailyGoal: number;
  theme: AppTheme;
}

const SIZE = 260;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Outer decorative ring dimensions
const OUTER_STROKE = 2;
const OUTER_RADIUS = RADIUS + STROKE_WIDTH / 2 + 8;

// Inner decorative ring
const INNER_STROKE = 1;
const INNER_RADIUS = RADIUS - STROKE_WIDTH / 2 - 10;

export function WaterProgressBar({ consumed, dailyGoal, theme }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const percentage = Math.round(progress * 100);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Svg width={SIZE + 24} height={SIZE + 24} viewBox={`-12 -12 ${SIZE + 24} ${SIZE + 24}`}>
        <Defs>
          <LinearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.accent} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.accentSecondary} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Outermost decorative ring — barely visible border */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={OUTER_RADIUS}
          stroke={theme.border}
          strokeWidth={OUTER_STROKE}
          fill="none"
          opacity={0.4}
        />

        {/* Background track — thick, very dark */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.border}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          opacity={0.5}
        />

        {/* Progress arc — teal-to-blue gradient */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#progressGrad)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />

        {/* Inner decorative ring */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={INNER_RADIUS}
          stroke={theme.border}
          strokeWidth={INNER_STROKE}
          fill="none"
          opacity={0.25}
        />
      </Svg>

      {/* Center text overlay */}
      <View style={styles.textContainer}>
        <Text style={[styles.consumedValue, { color: theme.text }]}>
          {consumedL}
        </Text>
        <View style={styles.goalRow}>
          <Text style={[styles.goalSlash, { color: theme.textSecondary }]}>/ </Text>
          <Text style={[styles.goalValue, { color: theme.textSecondary }]}>{goalL} L</Text>
        </View>
        <View style={[styles.percentageBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.percentageText, { color: theme.accent }]}>
            {percentage}%
          </Text>
        </View>
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
  consumedValue: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: -1,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: -4,
  },
  goalSlash: {
    fontSize: 16,
    fontWeight: '300',
  },
  goalValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  percentageBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
