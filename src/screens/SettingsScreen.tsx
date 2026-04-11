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

import React, { useState, useCallback, useEffect } from 'react';
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
import { useGoalStore } from '../store/useGoalStore';
import { scheduleReminders, cancelAllReminders } from '../utils/notificationScheduler';
import { requestHealthPermissions, checkHealthPermissions } from '../utils/healthService';
import type { TimeOfDay, Gender, ActivityLevel, ClimatePreference } from '../types';
import { Fonts } from '../fonts';

function timeToString(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function SettingsScreen() {
  const theme = getTheme(null);
  const insets = useSafeAreaInsets();

  const name = useUserStore((s) => s.name);
  const weight = useUserStore((s) => s.weight);
  const age = useUserStore((s) => s.age);
  const gender = useUserStore((s) => s.gender);
  const activityLevel = useUserStore((s) => s.activityLevel);
  const climatePreference = useUserStore((s) => s.climatePreference);
  const wakeUpTime = useUserStore((s) => s.wakeUpTime);
  const sleepTime = useUserStore((s) => s.sleepTime);
  const remindersEnabled = useUserStore((s) => s.remindersEnabled);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const updateSchedule = useUserStore((s) => s.updateSchedule);
  const setRemindersEnabled = useUserStore((s) => s.setRemindersEnabled);

  const effectiveGoal = useGoalStore((s) => s.effectiveGoal);
  const baseGoal = useGoalStore((s) => s.baseGoal);
  const weatherBonus = useGoalStore((s) => s.weatherBonus);
  const activityBonus = useGoalStore((s) => s.activityBonus);
  const activityBump = useGoalStore((s) => s.activityBump);

  const consumed = useWaterStore((s) => s.consumed);

  const [nameText, setNameText] = useState(name);
  const [weightText, setWeightText] = useState(String(weight));
  const [ageText, setAgeText] = useState(String(age));
  const [showWakePicker, setShowWakePicker] = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);

  useEffect(() => {
    checkHealthPermissions().then(setHealthConnected);
  }, []);

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
    }
  }, [parsedWeight, weight, updateProfile]);

  const handleAgeBlur = useCallback(() => {
    if (!isNaN(parsedAge) && parsedAge >= 12 && parsedAge <= 100 && parsedAge !== age) {
      updateProfile({ age: parsedAge });
    }
  }, [parsedAge, age, updateProfile]);

  function handleWakeTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowWakePicker(Platform.OS === 'ios');
    if (date) {
      const newWake: TimeOfDay = { hour: date.getHours(), minute: date.getMinutes() };
      updateSchedule({ wakeUpTime: newWake });
      scheduleReminders(newWake, sleepTime, consumed, effectiveGoal, remindersEnabled);
    }
  }

  function handleSleepTimeChange(_event: DateTimePickerEvent, date?: Date) {
    setShowSleepPicker(Platform.OS === 'ios');
    if (date) {
      const newSleep: TimeOfDay = { hour: date.getHours(), minute: date.getMinutes() };
      updateSchedule({ sleepTime: newSleep });
      scheduleReminders(wakeUpTime, newSleep, consumed, effectiveGoal, remindersEnabled);
    }
  }

  function handleReminderToggle(value: boolean) {
    setRemindersEnabled(value);
    if (value) {
      scheduleReminders(wakeUpTime, sleepTime, consumed, effectiveGoal, true);
    } else {
      cancelAllReminders();
    }
  }

  function makeTimeDate(t: TimeOfDay): Date {
    const d = new Date();
    d.setHours(t.hour, t.minute, 0, 0);
    return d;
  }

  const goalL = (effectiveGoal / 1000).toFixed(1);
  const baseL = (baseGoal / 1000).toFixed(1);
  const weatherL = (weatherBonus / 1000).toFixed(1);
  const activityTotalL = ((activityBonus + activityBump) / 1000).toFixed(1);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Text style={[styles.pageTitle, { color: theme.text }]}>Settings</Text>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

      {/* Profile card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Profile</Text>

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

        {/* Gender */}
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</Text>
        <View style={styles.pillRow}>
          {(['male', 'female', 'other'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.pill,
                {
                  backgroundColor: gender === g ? theme.accent : theme.background,
                  borderColor: gender === g ? theme.accent : theme.border,
                },
              ]}
              onPress={() => updateProfile({ gender: g })}
            >
              <Text style={[styles.pillText, { color: gender === g ? '#FFFFFF' : theme.text }]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity Level */}
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Activity Level</Text>
        <View style={styles.pillRow}>
          {(['sedentary', 'moderate', 'active'] as const).map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.pill,
                {
                  backgroundColor: activityLevel === a ? theme.accent : theme.background,
                  borderColor: activityLevel === a ? theme.accent : theme.border,
                },
              ]}
              onPress={() => updateProfile({ activityLevel: a })}
            >
              <Text style={[styles.pillText, { color: activityLevel === a ? '#FFFFFF' : theme.text }]}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>

      {/* Smart Goal — elevated as its own section */}
      <View style={[styles.goalCard, { backgroundColor: theme.surfaceElevated }]}>
        <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>Your daily goal</Text>
        <Text style={[styles.goalValue, { color: theme.text }]}>{goalL} L</Text>
        <Text style={[styles.goalBreakdown, { color: theme.textSecondary }]}>
          Base {baseL}L + Weather +{weatherL}L + Activity +{activityTotalL}L
        </Text>
      </View>

      {/* Environment card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Environment</Text>

        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Climate Preference</Text>
        <View style={styles.pillGrid}>
          {(['cold', 'temperate', 'hot', 'tropical'] as const).map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.pillSmall,
                {
                  backgroundColor: climatePreference === c ? theme.accent : theme.background,
                  borderColor: climatePreference === c ? theme.accent : theme.border,
                },
              ]}
              onPress={() => updateProfile({ climatePreference: c })}
            >
              <Text style={[styles.pillTextSmall, { color: climatePreference === c ? '#FFFFFF' : theme.text }]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>

      {/* Health card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Health</Text>
        <Text style={[styles.toggleDesc, { color: theme.textSecondary, marginBottom: 12 }]}>
          {healthConnected
            ? 'Tracking activity to auto-adjust your water goal'
            : 'Connect to track activity and auto-adjust your water goal'}
        </Text>
        {healthConnected ? (
          <View style={[styles.healthConnectedRow]}>
            <View style={[styles.healthDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.healthConnectedText, { color: '#4CAF50' }]}>Connected</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.healthButton, { backgroundColor: healthConnecting ? theme.border : theme.accent }]}
            onPress={async () => {
              if (healthConnecting) return;
              setHealthConnecting(true);
              const granted = await requestHealthPermissions();
              setHealthConnected(granted);
              setHealthConnecting(false);
            }}
            activeOpacity={0.7}
            disabled={healthConnecting}
          >
            <Text style={styles.healthButtonText}>
              {healthConnecting ? 'Connecting...' : 'Connect Health'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reminders card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Reminders</Text>

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

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
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
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    paddingTop: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  // Cards
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
    marginBottom: 16,
  },

  // Fields
  fieldLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.medium,
    marginTop: 4,
  },

  // Goal
  goalCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  goalLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 36,
    fontFamily: Fonts.light,
    letterSpacing: -1,
  },
  goalBreakdown: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillSmall: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillTextSmall: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.semiBold,
  },
  toggleDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.light,
    letterSpacing: 1,
  },

  // Health
  healthButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  healthButtonText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  healthConnectedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthConnectedText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },

});
