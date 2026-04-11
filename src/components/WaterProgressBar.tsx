// Hero progress ring with water-fill interior.
//
// The ring itself is a cerulean arc. Inside it, a subtle gradient
// "fills" from the bottom proportional to progress — giving a sense
// of a vessel filling with water. At 0% the interior is nearly empty
// (just a faint floor reflection). At 100% it's full.
//
// The consumed value is large and ultralight (Poppins Thin 52pt).
// Goal is shown smaller beneath. No competing percentage badge —
// the fill level IS the percentage, communicated visually.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Rect,
} from 'react-native-svg';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';

interface WaterProgressBarProps {
  consumed: number;
  dailyGoal: number;
  theme: AppTheme;
}

const SIZE = 250;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WaterProgressBar({ consumed, dailyGoal, theme }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  // Water fill height — the inner circle fills from bottom
  const innerRadius = RADIUS - STROKE_WIDTH / 2 - 6;
  const fillHeight = innerRadius * 2 * clampedProgress;
  const fillY = SIZE / 2 + innerRadius - fillHeight;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.accentSecondary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.accent} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="fillGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={theme.accent} stopOpacity="0.2" />
            <Stop offset="0.6" stopColor={theme.accentSecondary} stopOpacity="0.08" />
            <Stop offset="1" stopColor={theme.accentSecondary} stopOpacity="0" />
          </LinearGradient>
          {/* Clip the fill to the inner circle */}
          <ClipPath id="innerClip">
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={innerRadius} />
          </ClipPath>
        </Defs>

        {/* Background track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.ringTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        {/* Water fill inside the ring — a rectangle clipped to circle */}
        <Rect
          x={SIZE / 2 - innerRadius}
          y={fillY}
          width={innerRadius * 2}
          height={fillHeight}
          fill="url(#fillGrad)"
          clipPath="url(#innerClip)"
        />

        {/* Subtle floor line at the water level when there's some progress */}
        {clampedProgress > 0.01 && clampedProgress < 0.99 && (
          <Rect
            x={SIZE / 2 - innerRadius * 0.7}
            y={fillY}
            width={innerRadius * 1.4}
            height={1.5}
            fill={theme.accent}
            opacity={0.25}
            clipPath="url(#innerClip)"
            rx={1}
          />
        )}

        {/* Progress arc */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#arcGrad)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      {/* Center text overlay */}
      <View style={styles.textContainer}>
        <Text style={[styles.consumedValue, { color: theme.text }]}>
          {consumedL}
        </Text>
        <Text style={[styles.goalText, { color: theme.textSecondary }]}>
          of {goalL} L
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
  consumedValue: {
    fontSize: 52,
    fontFamily: Fonts.thin,
    letterSpacing: -2,
  },
  goalText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    marginTop: -2,
  },
});
