// Step 4 — day schedule: wake-up and sleep times via the shared
// TimePickerSheet bottom sheet.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts } from '../../../fonts';
import type { AppTheme } from '../../../theme';
import type { TimeOfDay } from '../../../types';
import { TimePickerSheet } from '../../../components/TimePickerSheet';
import { COPY } from '../copy';

interface ScheduleStepProps {
  theme: AppTheme;
  wakeUpTime: TimeOfDay;
  onChangeWakeUp: (time: TimeOfDay) => void;
  sleepTime: TimeOfDay;
  onChangeSleep: (time: TimeOfDay) => void;
  timeError: string | null;
}

function timeToString(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function ScheduleStep({
  theme,
  wakeUpTime,
  onChangeWakeUp,
  sleepTime,
  onChangeSleep,
  timeError,
}: ScheduleStepProps) {
  const [wakeSheetVisible, setWakeSheetVisible] = useState(false);
  const [sleepSheetVisible, setSleepSheetVisible] = useState(false);

  return (
    <View style={styles.stack}>
      <View>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          {COPY.schedule.wakeLabel}
        </Text>
        <TouchableOpacity
          style={[
            styles.timeButton,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
          onPress={() => setWakeSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeValue, { color: theme.text }]}>
            {timeToString(wakeUpTime)}
          </Text>
        </TouchableOpacity>
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          {COPY.schedule.sleepLabel}
        </Text>
        <TouchableOpacity
          style={[
            styles.timeButton,
            {
              borderColor: timeError ? theme.error : theme.border,
              backgroundColor: theme.surface,
            },
          ]}
          onPress={() => setSleepSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeValue, { color: theme.text }]}>
            {timeToString(sleepTime)}
          </Text>
        </TouchableOpacity>
        {timeError && (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {timeError}
          </Text>
        )}
      </View>

      <TimePickerSheet
        visible={wakeSheetVisible}
        title="Wake-up time"
        value={wakeUpTime}
        onClose={() => setWakeSheetVisible(false)}
        onConfirm={(t) => {
          onChangeWakeUp(t);
          setWakeSheetVisible(false);
        }}
        theme={theme}
      />
      <TimePickerSheet
        visible={sleepSheetVisible}
        title="Sleep time"
        value={sleepTime}
        onClose={() => setSleepSheetVisible(false)}
        onConfirm={(t) => {
          onChangeSleep(t);
          setSleepSheetVisible(false);
        }}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  fieldLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  timeButton: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  timeValue: {
    fontSize: 24,
    fontFamily: Fonts.light,
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 6,
  },
});
