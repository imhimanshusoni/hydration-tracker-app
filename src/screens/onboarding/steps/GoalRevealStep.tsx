// Final screen — the personalized goal, glasses-first.
// Bare centered composition on the background (no card, no confetti):
// greeting, big Thin glass count, exact ml/L line, one-sentence
// explanation, and the 250 ml anchor line. Calm fade + rise on mount.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '../../../fonts';
import type { AppTheme } from '../../../theme';
import { formatGlassesShort, formatMlOrL } from '../../../utils/volumeFormat';
import { COPY } from '../copy';

interface GoalRevealStepProps {
  theme: AppTheme;
  name: string;
  goalMl: number;
  onStart: () => void;
}

export function GoalRevealStep({ theme, name, goalMl, onStart }: GoalRevealStepProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const mlText = `${goalMl.toLocaleString()} ml (${formatMlOrL(goalMl)})`;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 12,
        },
      ]}
    >
      <Animated.View style={[styles.center, { opacity, transform: [{ translateY }] }]}>
        <Text style={[styles.greeting, { color: theme.textSecondary }]}>
          {COPY.reveal.greeting(name)}
        </Text>
        <Text style={[styles.heroNumber, { color: theme.text }]}>
          {formatGlassesShort(goalMl)}
        </Text>
        <Text style={[styles.unitLabel, { color: theme.textSecondary }]}>
          {COPY.reveal.unitLabel}
        </Text>
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>
          {COPY.reveal.secondary(mlText)}
        </Text>
        <Text style={[styles.explanation, { color: theme.textSecondary }]}>
          {COPY.reveal.explanation}
        </Text>
        <Text style={[styles.anchor, { color: theme.textSecondary }]}>
          {COPY.reveal.anchor}
        </Text>
      </Animated.View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: theme.accent }]}
        onPress={onStart}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>{COPY.reveal.cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 18,
    fontFamily: Fonts.regular,
    marginBottom: 20,
  },
  heroNumber: {
    fontSize: 80,
    fontFamily: Fonts.thin,
    letterSpacing: -3,
    lineHeight: 88,
  },
  unitLabel: {
    fontSize: 18,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  secondary: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    marginTop: 14,
    opacity: 0.8,
  },
  explanation: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 23,
    paddingHorizontal: 12,
  },
  anchor: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
  },
  cta: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
});
