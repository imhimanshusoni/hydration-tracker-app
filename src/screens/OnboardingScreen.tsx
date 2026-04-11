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
import type { TimeOfDay, Gender, ActivityLevel } from '../types';
import { requestNotificationPermission } from '../utils/notificationScheduler';
import { requestHealthPermissions } from '../utils/healthService';
import { Fonts } from '../fonts';

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
  const [gender, setGender] = useState<Gender>('other');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
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
      gender,
      activityLevel,
      climatePreference: 'temperate',
      wakeUpTime,
      sleepTime,
    });
    // Fire-and-forget health permissions request
    requestHealthPermissions();
  }, [isValid, name, weight, age, gender, activityLevel, wakeUpTime, sleepTime, completeOnboarding]);

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

      {/* Gender */}
      <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
      <View style={styles.pillRow}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[
              styles.pill,
              {
                backgroundColor: gender === g ? theme.accent : theme.surface,
                borderColor: gender === g ? theme.accent : theme.border,
              },
            ]}
            onPress={() => setGender(g)}
          >
            <Text
              style={[
                styles.pillText,
                { color: gender === g ? '#FFFFFF' : theme.text },
              ]}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity Level */}
      <Text style={[styles.label, { color: theme.text }]}>Activity Level</Text>
      <View style={styles.pillRow}>
        {([
          { key: 'sedentary' as const, desc: 'Desk job, little exercise' },
          { key: 'moderate' as const, desc: 'Some regular exercise' },
          { key: 'active' as const, desc: 'Daily intense exercise' },
        ]).map(({ key, desc }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.pill,
              styles.activityPill,
              {
                backgroundColor: activityLevel === key ? theme.accent : theme.surface,
                borderColor: activityLevel === key ? theme.accent : theme.border,
              },
            ]}
            onPress={() => setActivityLevel(key)}
          >
            <Text
              style={[
                styles.pillText,
                { color: activityLevel === key ? '#FFFFFF' : theme.text },
              ]}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
            <Text
              style={[
                styles.pillDesc,
                { color: activityLevel === key ? 'rgba(255,255,255,0.7)' : theme.textSecondary },
              ]}
            >
              {desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
  heading: { fontSize: 28, fontFamily: Fonts.bold, marginBottom: 8 },
  subheading: { fontSize: 16, fontFamily: Fonts.regular, marginBottom: 32 },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 4 },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  activityPill: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pillText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  pillDesc: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    marginTop: 2,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontFamily: Fonts.bold },
});
