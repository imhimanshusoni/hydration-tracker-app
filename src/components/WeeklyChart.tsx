// 7-day mini bar chart.
// Shows rolling last 7 days. Today's bar is amber and updates live.
// Hidden until 2+ days of history exist.

import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useHistoryStore, computeLast7Days } from '../store/useHistoryStore';
import { useWaterStore } from '../store/useWaterStore';
import { useGoalStore } from '../store/useGoalStore';
import type { AppTheme } from '../theme';
import type { DailySnapshot } from '../types';
import { Fonts } from '../fonts';
import { track } from '../services/analytics';

const MAX_BAR_HEIGHT = 80;
const MIN_BAR_HEIGHT = 12;
const STUB_HEIGHT = 2;
const BAR_RADIUS = 10;
const CHART_PADDING_TOP = 16;

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDayInitial(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return DAY_INITIALS[d.getDay()];
}

function getBarHeight(consumed: number, goal: number): number {
  if (consumed === 0 || goal === 0) return STUB_HEIGHT;
  const ratio = Math.min(1, consumed / goal);
  return Math.max(MIN_BAR_HEIGHT, ratio * MAX_BAR_HEIGHT);
}

interface WeeklyChartProps {
  theme: AppTheme;
}

export function WeeklyChart({ theme }: WeeklyChartProps) {
  const snapshots = useHistoryStore((s) => s.snapshots);
  const consumed = useWaterStore((s) => s.consumed);
  const effectiveGoal = useGoalStore((s) => s.effectiveGoal);

  const last7 = useMemo(() => computeLast7Days(snapshots), [snapshots]);

  // Count non-null past entries (exclude today at index 6)
  const pastDaysWithData = last7.slice(0, 6).filter((d) => d !== null).length;
  if (pastDaysWithData < 2) return null;

  // Build today's live entry
  const todayEntry: DailySnapshot = {
    date: '',
    consumed,
    effectiveGoal,
    goalMet: effectiveGoal > 0 && consumed >= effectiveGoal,
    activeMinutes: 0,
    weatherBonus: 0,
  };

  const entries = [...last7.slice(0, 6), todayEntry];

  return (
    <Pressable
      style={styles.container}
      onPress={() => track('History Viewed', { entry_point: 'chart_tap' })}
      onLongPress={() => track('History Viewed', { entry_point: 'chart_long_press' })}
    >
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        Last 7 days
      </Text>
      <View style={styles.chartRow}>
        {entries.map((entry, index) => {
          const isToday = index === 6;
          const daysAgo = 6 - index;
          const dayInitial = getDayInitial(daysAgo);

          return (
            <View key={index} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <BarItem
                  entry={entry}
                  isToday={isToday}
                  theme={theme}
                />
              </View>
              <Text
                style={[
                  styles.dayInitial,
                  {
                    color: isToday ? theme.accentWarm : theme.textSecondary,
                    fontFamily: isToday ? Fonts.semiBold : Fonts.regular,
                  },
                ]}
              >
                {dayInitial}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

interface BarItemProps {
  entry: DailySnapshot | null;
  isToday: boolean;
  theme: AppTheme;
}

function BarItem({ entry, isToday, theme }: BarItemProps) {
  const height = entry ? getBarHeight(entry.consumed, entry.effectiveGoal) : STUB_HEIGHT;
  const animatedHeight = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (isToday) {
      Animated.timing(animatedHeight, {
        toValue: height,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      animatedHeight.setValue(height);
    }
  }, [height, isToday, animatedHeight]);

  let fill: string;
  let opacity = 1;

  if (isToday) {
    fill = theme.accentWarm;
  } else if (!entry) {
    fill = theme.accent;
    opacity = 0.3;
  } else if (entry.goalMet) {
    fill = theme.accent;
  } else {
    fill = theme.accent;
    opacity = 0.6;
  }

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: animatedHeight,
          backgroundColor: fill,
          opacity,
          borderTopLeftRadius: BAR_RADIUS,
          borderTopRightRadius: BAR_RADIUS,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    marginBottom: CHART_PADDING_TOP,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '60%',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    height: MAX_BAR_HEIGHT,
  },
  bar: {
    width: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dayInitial: {
    fontSize: 12,
    marginTop: 8,
  },
});
