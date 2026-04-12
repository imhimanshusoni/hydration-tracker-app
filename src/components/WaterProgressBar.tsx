// Hero progress ring with water-fill interior and goal celebration.
//
// When `celebrate` prop transitions to true, two amber ripple rings
// expand outward from the progress arc and the consumed number
// glows amber briefly. Animation fires once per prop change.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
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
  celebrate?: boolean;
}

const SIZE = 250;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2; // 119
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const RIPPLE_COLOR = '#F0A050'; // warm amber

export function WaterProgressBar({ consumed, dailyGoal, theme, celebrate }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  const innerRadius = RADIUS - STROKE_WIDTH / 2 - 6;
  const fillHeight = innerRadius * 2 * clampedProgress;
  const fillY = SIZE / 2 + innerRadius - fillHeight;

  // Celebration animation values
  const ripple1Scale = useRef(new Animated.Value(1)).current;
  const ripple1Opacity = useRef(new Animated.Value(0)).current;
  const ripple2Scale = useRef(new Animated.Value(0.9)).current;
  const ripple2Opacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const hasCelebrated = useRef(false);

  useEffect(() => {
    if (celebrate && !hasCelebrated.current) {
      hasCelebrated.current = true;

      // Reset values
      ripple1Scale.setValue(1);
      ripple1Opacity.setValue(0.5);
      ripple2Scale.setValue(0.9);
      ripple2Opacity.setValue(0.35);
      glowOpacity.setValue(0);

      // Double-pulse ripple with 150ms stagger
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(ripple1Scale, {
            toValue: 1.4,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple1Opacity, {
            toValue: 0,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ripple2Scale, {
            toValue: 1.3,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple2Opacity, {
            toValue: 0,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Number glow: fade in amber, hold, fade out
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [celebrate, ripple1Scale, ripple1Opacity, ripple2Scale, ripple2Opacity, glowOpacity]);

  // Ripple ring dimensions — positioned around the SVG ring's outer edge
  const rippleSize = (RADIUS + STROKE_WIDTH / 2) * 2;
  const rippleOffset = (SIZE - rippleSize) / 2;

  return (
    <View style={styles.container}>
      {/* Ripple rings (behind the SVG) */}
      <Animated.View
        style={[
          styles.rippleRing,
          {
            width: rippleSize,
            height: rippleSize,
            borderRadius: rippleSize / 2,
            borderColor: RIPPLE_COLOR,
            top: rippleOffset,
            left: rippleOffset,
            opacity: ripple1Opacity,
            transform: [{ scale: ripple1Scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.rippleRing,
          {
            width: rippleSize,
            height: rippleSize,
            borderRadius: rippleSize / 2,
            borderColor: RIPPLE_COLOR,
            top: rippleOffset,
            left: rippleOffset,
            opacity: ripple2Opacity,
            transform: [{ scale: ripple2Scale }],
          },
        ]}
      />

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
          <ClipPath id="innerClip">
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={innerRadius} />
          </ClipPath>
        </Defs>

        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.ringTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        <Rect
          x={SIZE / 2 - innerRadius}
          y={fillY}
          width={innerRadius * 2}
          height={fillHeight}
          fill="url(#fillGrad)"
          clipPath="url(#innerClip)"
        />

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
        <View>
          <Text style={[styles.consumedValue, { color: theme.text }]}>
            {consumedL}
          </Text>
          {/* Amber glow overlay — same position, animated opacity */}
          <Animated.Text
            style={[
              styles.consumedValue,
              styles.glowOverlay,
              { color: RIPPLE_COLOR, opacity: glowOpacity },
            ]}
          >
            {consumedL}
          </Animated.Text>
        </View>
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
    width: SIZE,
    height: SIZE,
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
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  goalText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    marginTop: -2,
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 2,
  },
});
