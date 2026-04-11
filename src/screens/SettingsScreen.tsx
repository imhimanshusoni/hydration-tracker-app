// Settings screen: edit profile (name, weight, age) and reminders (times, toggle).
// Changes to weight/age recalculate goal. Changes to schedule reschedule notifications.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
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
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

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
  const weightError = weightText && (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 200)
    ? 'Weight must be 30\u2013200 kg' : null;
  const ageError = ageText && (isNaN(parsedAge) || parsedAge < 12 || parsedAge > 100)
    ? 'Age must be 12\u2013100' : null;

  const handleNameBlur = useCallback(() => {
    const trimmed = nameText.trim();
    if (trimmed.length > 0 && trimmed !== name) {
      updateProfile({ name: trimmed });
    }
  }, [nameText, name, updateProfile]);

  const handleWeightBlur = useCallback(() => {
    if (!isNaN(parsedWeight) && parsedWeight >= 30 && parsedWeight <= 200 && parsedWeight !== weight) {
      updateProfile({ weight: parsedWeight });
      // Reschedule with new goal
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
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile</Text>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        value={nameText}
        onChangeText={setNameText}
        onBlur={handleNameBlur}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Weight (kg)</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: weightError ? theme.error : theme.border, backgroundColor: theme.surface }]}
        value={weightText}
        onChangeText={setWeightText}
        onBlur={handleWeightBlur}
        keyboardType="numeric"
      />
      {weightError && <Text style={[styles.errorText, { color: theme.error }]}>{weightError}</Text>}

      <Text style={[styles.label, { color: theme.textSecondary }]}>Age</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: ageError ? theme.error : theme.border, backgroundColor: theme.surface }]}
        value={ageText}
        onChangeText={setAgeText}
        onBlur={handleAgeBlur}
        keyboardType="numeric"
      />
      {ageError && <Text style={[styles.errorText, { color: theme.error }]}>{ageError}</Text>}

      <Text style={[styles.goalText, { color: theme.textSecondary }]}>
        Daily goal: {goalL} L
      </Text>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Reminders</Text>

      <View style={styles.reminderRow}>
        <Text style={[styles.reminderLabel, { color: theme.text }]}>Enable reminders</Text>
        <Switch
          value={remindersEnabled}
          onValueChange={handleReminderToggle}
          trackColor={{ true: theme.accent }}
        />
      </View>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Wake-up time</Text>
      <TouchableOpacity
        style={[styles.timeButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={() => setShowWakePicker(true)}
      >
        <Text style={{ color: theme.text, fontSize: 16 }}>{timeToString(wakeUpTime)}</Text>
      </TouchableOpacity>
      {showWakePicker && (
        <DateTimePicker
          value={makeTimeDate(wakeUpTime)}
          mode="time"
          is24Hour
          onChange={handleWakeTimeChange}
        />
      )}

      <Text style={[styles.label, { color: theme.textSecondary }]}>Sleep time</Text>
      <TouchableOpacity
        style={[styles.timeButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={() => setShowSleepPicker(true)}
      >
        <Text style={{ color: theme.text, fontSize: 16 }}>{timeToString(sleepTime)}</Text>
      </TouchableOpacity>
      {showSleepPicker && (
        <DateTimePicker
          value={makeTimeDate(sleepTime)}
          mode="time"
          is24Hour
          onChange={handleSleepTimeChange}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: { fontSize: 12, marginTop: 4 },
  goalText: { fontSize: 14, marginTop: 12 },
  divider: { height: 1, marginVertical: 24 },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderLabel: { fontSize: 16 },
  timeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
