// Step 3 — activity level. Full-width vertical option rows so the
// descriptions stay readable at large type. Plain-language labels map
// to the existing ActivityLevel enum values; persistence is unchanged.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts } from '../../../fonts';
import type { AppTheme } from '../../../theme';
import type { ActivityLevel } from '../../../types';
import { COPY } from '../copy';

interface ActivityStepProps {
  theme: AppTheme;
  activityLevel: ActivityLevel;
  onChangeActivity: (level: ActivityLevel) => void;
}

export function ActivityStep({
  theme,
  activityLevel,
  onChangeActivity,
}: ActivityStepProps) {
  return (
    <View style={styles.stack}>
      {COPY.activity.options.map((option) => {
        const selected = activityLevel === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.row,
              {
                backgroundColor: selected ? theme.surfaceElevated : theme.surface,
                borderColor: selected ? theme.accent : theme.border,
              },
            ]}
            onPress={() => onChangeActivity(option.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.title,
                { color: selected ? theme.accent : theme.text },
              ]}
            >
              {option.title}
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  row: {
    minHeight: 64,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 3,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
  },
  description: {
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
});
