// Onboarding form: collects name, weight, age, wake-up time, sleep time.
// Calculates daily goal and saves to user store on submit.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import type { TimeOfDay } from '../types';
import { requestNotificationPermission } from '../utils/notificationScheduler';

function timeToString(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  const [name, setName] = useState('');
  const [weightText, setWeightText] = useState('');
  const [ageText, setAgeText] = useState('');
  const [wakeUpTime, setWakeUpTime] = useState<TimeOfDay>({ hour: 7, minute: 0 });
  const [sleepTime, setSleepTime] = useState<TimeOfDay>({ hour: 23, minute: 0 });
  const [showWakePicker, setShowWakePicker] = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);

  const weight = parseInt(weightText, 10);
  const age = parseInt(ageText, 10);

  // Validation
  const weightError = weightText && (isNaN(weight) || weight < 30 || weight > 200)
    ? 'Weight must be 30\u2013200 kg' : null;
  const ageError = ageText && (isNaN(age) || age < 12 || age > 100)
    ? 'Age must be 12\u2013100' : null;
  const timeError = wakeUpTime.hour >= sleepTime.hour && wakeUpTime.minute >= sleepTime.minute
    ? 'Wake-up must be before sleep time' : null;

  const isValid =
    name.trim().length > 0 &&
    !isNaN(weight) && weight >= 30 && weight <= 200 &&
    !isNaN(age) && age >= 12 && age <= 100 &&
    (wakeUpTime.hour < sleepTime.hour ||
      (wakeUpTime.hour === sleepTime.hour && wakeUpTime.minute < sleepTime.minute));

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    await requestNotificationPermission();
    completeOnboarding({
      name: name.trim(),
      weight,
      age,
      wakeUpTime,
      sleepTime,
    });
  }, [isValid, name, weight, age, wakeUpTime, sleepTime, completeOnboarding]);

  function handleWakeTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowWakePicker(Platform.OS === 'ios');
    if (date) {
      setWakeUpTime({ hour: date.getHours(), minute: date.getMinutes() });
    }
  }

  function handleSleepTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowSleepPicker(Platform.OS === 'ios');
    if (date) {
      setSleepTime({ hour: date.getHours(), minute: date.getMinutes() });
    }
  }

  function makeTimeDate(t: TimeOfDay): Date {
    const d = new Date();
    d.setHours(t.hour, t.minute, 0, 0);
    return d;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: theme.text }]}>Welcome!</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Let's set up your water goal.
      </Text>

      {/* Name */}
      <Text style={[styles.label, { color: theme.text }]}>Name</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Weight */}
      <Text style={[styles.label, { color: theme.text }]}>Weight (kg)</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: weightError ? theme.error : theme.border, backgroundColor: theme.surface }]}
        value={weightText}
        onChangeText={setWeightText}
        placeholder="e.g. 70"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
      />
      {weightError && <Text style={[styles.errorText, { color: theme.error }]}>{weightError}</Text>}

      {/* Age */}
      <Text style={[styles.label, { color: theme.text }]}>Age</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: ageError ? theme.error : theme.border, backgroundColor: theme.surface }]}
        value={ageText}
        onChangeText={setAgeText}
        placeholder="e.g. 25"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
      />
      {ageError && <Text style={[styles.errorText, { color: theme.error }]}>{ageError}</Text>}

      {/* Wake-up time */}
      <Text style={[styles.label, { color: theme.text }]}>Wake-up time</Text>
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

      {/* Sleep time */}
      <Text style={[styles.label, { color: theme.text }]}>Sleep time</Text>
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

      {timeError && <Text style={[styles.errorText, { color: theme.error }]}>{timeError}</Text>}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: isValid ? theme.accent : theme.border }]}
        onPress={handleSubmit}
        disabled={!isValid}
      >
        <Text style={[styles.submitText, { color: isValid ? '#FFFFFF' : theme.textSecondary }]}>
          Get Started
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subheading: { fontSize: 16, marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: { fontSize: 12, marginTop: 4 },
  submitButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700' },
});
