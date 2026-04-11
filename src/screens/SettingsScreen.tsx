// Settings screen — Premium dark-mode card-based layout.
//
// Design decisions:
// - Grouped into bordered cards (Profile, Reminders) for visual hierarchy
// - Section headers use uppercase tracking for a refined instrument-panel feel
// - Input fields have subtle surface backgrounds with border accents
// - Goal display uses the teal accent as a highlighted badge
// - Toggle uses custom track colors matching the theme
// - Time buttons show time in a monospaced style for precision feel
// - All touch targets 48pt+ for iOS HIG compliance

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { useWaterStore } from '../store/useWaterStore';
import { scheduleReminders, cancelAllReminders } from '../utils/notificationScheduler';
import type { TimeOfDay } from '../types';

function timeToString(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function SettingsScreen() {
  const theme = getTheme(null);
  const insets = useSafeAreaInsets();

  const name = useUserStore((s) => s.name);
  const weight = useUserStore((s) => s.weight);
  const age = useUserStore((s) => s.age);
  const wakeUpTime = useUserStore((s) => s.wakeUpTime);
  const sleepTime = useUserStore((s) => s.sleepTime);
  const remindersEnabled = useUserStore((s) => s.remindersEnabled);
  const dailyGoal = useUserStore((s) => s.dailyGoal);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const updateSchedule = useUserStore((s) => s.updateSchedule);
  const setRemindersEnabled = useUserStore((s) => s.setRemindersEnabled);

  const consumed = useWaterStore((s) => s.consumed);

  const [nameText, setNameText] = useState(name);
  const [weightText, setWeightText] = useState(String(weight));
  const [ageText, setAgeText] = useState(String(age));
  const [showWakePicker, setShowWakePicker] = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);

  const parsedWeight = parseInt(weightText, 10);
  const parsedAge = parseInt(ageText, 10);
  const weightError =
    weightText && (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 200)
      ? 'Weight must be 30\u2013200 kg'
      : null;
  const ageError =
    ageText && (isNaN(parsedAge) || parsedAge < 12 || parsedAge > 100)
      ? 'Age must be 12\u2013100'
      : null;

  const handleNameBlur = useCallback(() => {
    const trimmed = nameText.trim();
    if (trimmed.length > 0 && trimmed !== name) {
      updateProfile({ name: trimmed });
    }
  }, [nameText, name, updateProfile]);

  const handleWeightBlur = useCallback(() => {
    if (!isNaN(parsedWeight) && parsedWeight >= 30 && parsedWeight <= 200 && parsedWeight !== weight) {
      updateProfile({ weight: parsedWeight });
      const newGoal = useUserStore.getState().dailyGoal;
      scheduleReminders(wakeUpTime, sleepTime, consumed, newGoal, remindersEnabled);
    }
  }, [parsedWeight, weight, updateProfile, wakeUpTime, sleepTime, consumed, remindersEnabled]);

  const handleAgeBlur = useCallback(() => {
    if (!isNaN(parsedAge) && parsedAge >= 12 && parsedAge <= 100 && parsedAge !== age) {
      updateProfile({ age: parsedAge });
      const newGoal = useUserStore.getState().dailyGoal;
      scheduleReminders(wakeUpTime, sleepTime, consumed, newGoal, remindersEnabled);
    }
  }, [parsedAge, age, updateProfile, wakeUpTime, sleepTime, consumed, remindersEnabled]);

  function handleWakeTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowWakePicker(Platform.OS === 'ios');
    if (date) {
      const newWake: TimeOfDay = { hour: date.getHours(), minute: date.getMinutes() };
      updateSchedule({ wakeUpTime: newWake });
      scheduleReminders(newWake, sleepTime, consumed, dailyGoal, remindersEnabled);
    }
  }

  function handleSleepTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowSleepPicker(Platform.OS === 'ios');
    if (date) {
      const newSleep: TimeOfDay = { hour: date.getHours(), minute: date.getMinutes() };
      updateSchedule({ sleepTime: newSleep });
      scheduleReminders(wakeUpTime, newSleep, consumed, dailyGoal, remindersEnabled);
    }
  }

  function handleReminderToggle(value: boolean) {
    setRemindersEnabled(value);
    if (value) {
      scheduleReminders(wakeUpTime, sleepTime, consumed, dailyGoal, true);
    } else {
      cancelAllReminders();
    }
  }

  function makeTimeDate(t: TimeOfDay): Date {
    const d = new Date();
    d.setHours(t.hour, t.minute, 0, 0);
    return d;
  }

  const goalL = (dailyGoal / 1000).toFixed(1);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Page title */}
      <Text style={[styles.pageTitle, { color: theme.text }]}>Settings</Text>

      {/* Profile card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PROFILE</Text>

        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
          value={nameText}
          onChangeText={setNameText}
          onBlur={handleNameBlur}
          placeholderTextColor={theme.textSecondary}
        />

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Weight (kg)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: weightError ? theme.error : theme.border,
                },
              ]}
              value={weightText}
              onChangeText={setWeightText}
              onBlur={handleWeightBlur}
              keyboardType="numeric"
            />
            {weightError && <Text style={[styles.errorText, { color: theme.error }]}>{weightError}</Text>}
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Age</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: ageError ? theme.error : theme.border,
                },
              ]}
              value={ageText}
              onChangeText={setAgeText}
              onBlur={handleAgeBlur}
              keyboardType="numeric"
            />
            {ageError && <Text style={[styles.errorText, { color: theme.error }]}>{ageError}</Text>}
          </View>
        </View>

        {/* Goal display */}
        <View style={[styles.goalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>Daily goal</Text>
          <View style={[styles.goalBadge, { backgroundColor: theme.background, borderColor: theme.accent }]}>
            <Text style={[styles.goalValue, { color: theme.accent }]}>{goalL} L</Text>
          </View>
        </View>
      </View>

      {/* Reminders card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>REMINDERS</Text>

        <View style={styles.toggleRow}>
          <View>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>Hourly reminders</Text>
            <Text style={[styles.toggleDesc, { color: theme.textSecondary }]}>
              Between wake-up and sleep time
            </Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.timeRow, { borderTopColor: theme.border }]}>
          <View style={styles.timeField}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Wake-up</Text>
            <TouchableOpacity
              style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => setShowWakePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeValue, { color: theme.text }]}>{timeToString(wakeUpTime)}</Text>
            </TouchableOpacity>
            {showWakePicker && (
              <DateTimePicker
                value={makeTimeDate(wakeUpTime)}
                mode="time"
                is24Hour
                onChange={handleWakeTimeChange}
              />
            )}
          </View>

          <View style={[styles.timeDivider, { backgroundColor: theme.border }]} />

          <View style={styles.timeField}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Sleep</Text>
            <TouchableOpacity
              style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => setShowSleepPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeValue, { color: theme.text }]}>{timeToString(sleepTime)}</Text>
            </TouchableOpacity>
            {showSleepPicker && (
              <DateTimePicker
                value={makeTimeDate(sleepTime)}
                mode="time"
                is24Hour
                onChange={handleSleepTimeChange}
              />
            )}
          </View>
        </View>
      </View>

      {/* App info */}
      <Text style={[styles.appInfo, { color: theme.textSecondary }]}>
        Water Reminder v1.0
      </Text>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingTop: 16,
    marginBottom: 24,
  },

  // Cards
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },

  // Goal
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 16,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  goalValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },

  // Time fields
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeDivider: {
    width: 1,
    height: 60,
    marginTop: 20,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1,
  },

  // Footer
  appInfo: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 16,
    letterSpacing: 0.3,
  },
});
