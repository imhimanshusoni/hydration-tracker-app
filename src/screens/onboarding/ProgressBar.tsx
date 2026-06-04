// Thin segmented progress bar for the onboarding wizard.
// One segment per input step; filled through the current step.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AppTheme } from '../../theme';

interface ProgressBarProps {
  current: number; // 0-based index of the current step
  total: number;
  theme: AppTheme;
}

export function ProgressBar({ current, total, theme }: ProgressBarProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: i <= current ? theme.accent : theme.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
