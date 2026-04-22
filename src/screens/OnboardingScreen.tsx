// Onboarding — aligned with the post-revamp design system.
// Single-screen form grouped into cards (About you / Your day), with a
// live goal-preview hero that updates as fields change. Sticky footer CTA
// keeps Get Started visible above the keyboard. Time pickers use the
// shared TimePickerSheet bottom sheet.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '../fonts';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import type { ActivityLevel, Gender, TimeOfDay } from '../types';
import { requestNotificationPermission } from '../utils/notificationScheduler';
import { track } from '../services/analytics';
import {
  KEYBOARD_ACCESSORY_ID,
  KEYBOARD_ACCESSORY_ID_ALT,
} from '../components/KeyboardDoneAccessory';
import { TimePickerSheet } from '../components/TimePickerSheet';
import { calculateSmartGoal } from '../utils/waterCalculator';

const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, little exercise',
  moderate: 'Some regular exercise',
  active: 'Daily intense exercise',
};

const TEMPERATE_BONUS_ML = 200;

function timeToString(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

function minutesOf(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

export function OnboardingScreen() {
  const theme = getTheme(null);
  const insets = useSafeAreaInsets();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    track('Onboarding Started');
  }, []);

  const [name, setName] = useState('');
  const [weightText, setWeightText] = useState('');
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [wakeUpTime, setWakeUpTime] = useState<TimeOfDay>({ hour: 7, minute: 0 });
  const [sleepTime, setSleepTime] = useState<TimeOfDay>({ hour: 23, minute: 0 });
  const [wakeSheetVisible, setWakeSheetVisible] = useState(false);
  const [sleepSheetVisible, setSleepSheetVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const weight = parseInt(weightText, 10);
  const age = parseInt(ageText, 10);

  const weightValid = !isNaN(weight) && weight >= 30 && weight <= 200;
  const ageValid = !isNaN(age) && age >= 12 && age <= 100;
  const weightError =
    weightText.length > 0 && !weightValid ? 'Weight must be 30–200 kg' : null;
  const ageError =
    ageText.length > 0 && !ageValid ? 'Age must be 12–100' : null;
  const timeError =
    minutesOf(wakeUpTime) >= minutesOf(sleepTime)
      ? 'Wake-up must be before sleep time'
      : null;

  const isPreviewReady = weightValid && ageValid && gender !== null;

  const preview = useMemo(() => {
    if (!isPreviewReady || gender === null) return null;
    return calculateSmartGoal({
      weight,
      age,
      gender,
      activityLevel,
      weatherBonusMl: TEMPERATE_BONUS_ML,
      activeMinutesToday: 0,
    });
  }, [isPreviewReady, weight, age, gender, activityLevel]);

  const isValid =
    name.trim().length > 0 &&
    weightValid &&
    ageValid &&
    gender !== null &&
    !timeError;

  const handleSubmit = useCallback(async () => {
    if (!isValid || gender === null) return;
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
    track('Onboarding Completed', {
      duration_sec: Math.max(
        0,
        Math.round((Date.now() - mountedAtRef.current) / 1000),
      ),
    });
  }, [
    isValid,
    name,
    weight,
    age,
    gender,
    activityLevel,
    wakeUpTime,
    sleepTime,
    completeOnboarding,
  ]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.header}>
          <Text style={[styles.heading, { color: theme.text }]}>Welcome.</Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>
            A few basics so we can build your hydration plan.
          </Text>
        </View>

        {/* Live goal-preview card */}
        <View
          style={[
            styles.goalCard,
            { backgroundColor: theme.surfaceElevated },
          ]}
        >
          <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
            YOUR DAILY TARGET
          </Text>
          {preview ? (
            <>
              <View style={styles.goalValueRow}>
                <Text style={[styles.goalValue, { color: theme.text }]}>
                  {preview.effectiveGoal.toLocaleString()}
                </Text>
                <Text style={[styles.goalUnit, { color: theme.textSecondary }]}>
                  ml
                </Text>
              </View>
              <Text
                style={[styles.goalBreakdown, { color: theme.textSecondary }]}
              >
                base {preview.baseGoal.toLocaleString()}
                {'  ·  '}activity +{preview.activityBonus}
                {'  ·  '}climate +{preview.weatherBonus}
              </Text>
            </>
          ) : (
            <Text
              style={[styles.goalPlaceholder, { color: theme.textSecondary }]}
            >
              Fill in your details below
            </Text>
          )}
        </View>

        {/* About you card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            ABOUT YOU
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.background,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="done"
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Weight (kg)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: weightError ? theme.error : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
                value={weightText}
                onChangeText={setWeightText}
                placeholder="e.g. 70"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                maxLength={3}
              />
              {weightError && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {weightError}
                </Text>
              )}
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Age
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: ageError ? theme.error : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
                value={ageText}
                onChangeText={setAgeText}
                placeholder="e.g. 25"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID_ALT}
                maxLength={3}
              />
              {ageError && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {ageError}
                </Text>
              )}
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Gender
          </Text>
          <View style={styles.pillRow}>
            {(['male', 'female', 'other'] as const).map((g) => {
              const selected = gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? theme.accent : theme.background,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Activity level
          </Text>
          <View style={styles.pillRow}>
            {(['sedentary', 'moderate', 'active'] as const).map((k) => {
              const selected = activityLevel === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? theme.accent : theme.background,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => setActivityLevel(k)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.activityHint, { color: theme.textSecondary }]}>
            {ACTIVITY_DESCRIPTIONS[activityLevel]}
          </Text>
        </View>

        {/* Your day card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            YOUR DAY
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Wake-up
              </Text>
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
                onPress={() => setWakeSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeValue, { color: theme.text }]}>
                  {timeToString(wakeUpTime)}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timeField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Sleep
              </Text>
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  {
                    borderColor: timeError ? theme.error : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
                onPress={() => setSleepSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeValue, { color: theme.text }]}>
                  {timeToString(sleepTime)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {timeError && (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {timeError}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer CTA — hidden while keyboard is open so it doesn't
          float a disabled button over the form. The Done accessory becomes
          the sole element above the keyboard. Reappears when keyboard
          dismisses. */}
      {!keyboardVisible && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <Text style={[styles.footerHint, { color: theme.textSecondary }]}>
            We'll use this to build your hydration plan.
          </Text>
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: isValid ? theme.accent : theme.surface,
                borderColor: isValid ? theme.accent : theme.border,
              },
            ]}
            onPress={handleSubmit}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.submitText,
                { color: isValid ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TimePickerSheet
        visible={wakeSheetVisible}
        title="Wake-up time"
        value={wakeUpTime}
        onClose={() => setWakeSheetVisible(false)}
        onConfirm={(t) => {
          setWakeUpTime(t);
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
          setSleepTime(t);
          setSleepSheetVisible(false);
        }}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  // Header
  header: { paddingTop: 16, marginBottom: 20 },
  heading: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    letterSpacing: 0.2,
    marginTop: 6,
  },

  // Goal preview card
  goalCard: {
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  goalLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  goalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  goalValue: {
    fontSize: 40,
    fontFamily: Fonts.light,
    letterSpacing: -1,
  },
  goalUnit: {
    fontSize: 16,
    fontFamily: Fonts.light,
    marginLeft: 6,
  },
  goalBreakdown: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 10,
  },
  goalPlaceholder: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    marginTop: 4,
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
  activityHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // Time fields
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
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

  // Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  footerHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
});
