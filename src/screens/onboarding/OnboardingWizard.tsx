// Multi-step onboarding wizard, one question per screen.
// Owns the full draft profile and step index in local state so Back
// preserves entries. Replaces the old single-screen OnboardingScreen.
//
// Steps: name → body (weight/age/gender) → activity → schedule → goal reveal.
// The goal shown on the reveal comes from the same calculateSmartGoal call
// (with the climate-based weather bonus) that completeOnboarding stores,
// so the number the user sees equals the stored dailyGoal.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';

import { getTheme } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import type { ActivityLevel, Gender, TimeOfDay } from '../../types';
import { requestNotificationPermission } from '../../utils/notificationScheduler';
import {
  calculateSmartGoal,
  getWeatherBonusFromClimate,
} from '../../utils/waterCalculator';
import { track } from '../../services/analytics';
import { COPY } from './copy';
import { WizardScaffold } from './WizardScaffold';
import { NameStep } from './steps/NameStep';
import { BodyStep } from './steps/BodyStep';
import { ActivityStep } from './steps/ActivityStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { GoalRevealStep } from './steps/GoalRevealStep';

const STEP_NAMES = ['name', 'body', 'activity', 'schedule'] as const;
const INPUT_STEP_COUNT = STEP_NAMES.length;
const REVEAL_INDEX = INPUT_STEP_COUNT; // 4

function minutesOf(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

export function OnboardingWizard() {
  const theme = getTheme(null);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  const mountedAtRef = useRef<number>(Date.now());
  const stepEnteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    track('Onboarding Started');
  }, []);

  const [stepIndex, setStepIndex] = useState(0);

  // Draft profile
  const [name, setName] = useState('');
  const [weightText, setWeightText] = useState('');
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [wakeUpTime, setWakeUpTime] = useState<TimeOfDay>({ hour: 7, minute: 0 });
  const [sleepTime, setSleepTime] = useState<TimeOfDay>({ hour: 23, minute: 0 });

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

  // Validation
  const weight = parseInt(weightText, 10);
  const age = parseInt(ageText, 10);
  const weightValid = !isNaN(weight) && weight >= 30 && weight <= 200;
  const ageValid = !isNaN(age) && age >= 12 && age <= 100;
  const weightError =
    weightText.length > 0 && !weightValid ? COPY.body.weightError : null;
  const ageError = ageText.length > 0 && !ageValid ? COPY.body.ageError : null;
  const timeError =
    minutesOf(wakeUpTime) >= minutesOf(sleepTime) ? COPY.schedule.timeError : null;

  const stepValid = [
    name.trim().length > 0,
    weightValid && ageValid && gender !== null,
    true, // activity always has a selection
    !timeError,
  ][stepIndex] ?? true;

  // Goal — identical inputs to what completeOnboarding stores (B4).
  const goalMl =
    gender !== null && weightValid && ageValid
      ? calculateSmartGoal({
          weight,
          age,
          gender,
          activityLevel,
          weatherBonusMl: getWeatherBonusFromClimate('temperate'),
          activeMinutesToday: 0,
        }).effectiveGoal
      : 0;

  const next = useCallback(async () => {
    track('Onboarding Step Completed', {
      step: stepIndex + 1,
      step_name: STEP_NAMES[stepIndex],
      duration_sec: Math.max(
        0,
        Math.round((Date.now() - stepEnteredAtRef.current) / 1000),
      ),
    });
    if (stepIndex === INPUT_STEP_COUNT - 1) {
      // Leaving the schedule step: ask for notification permission before
      // the reveal (preserves the pre-wizard permission timing).
      await requestNotificationPermission();
    }
    stepEnteredAtRef.current = Date.now();
    setStepIndex((i) => i + 1);
  }, [stepIndex]);

  const back = useCallback(() => {
    stepEnteredAtRef.current = Date.now();
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Android hardware back navigates the wizard; default (background app) on step 0.
  // No back from the reveal screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex > 0 && stepIndex < REVEAL_INDEX) {
        back();
        return true;
      }
      return stepIndex === REVEAL_INDEX; // swallow on reveal, default on step 0
    });
    return () => sub.remove();
  }, [stepIndex, back]);

  const handleStart = useCallback(() => {
    if (gender === null) return;
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
    name,
    weight,
    age,
    gender,
    activityLevel,
    wakeUpTime,
    sleepTime,
    completeOnboarding,
  ]);

  if (stepIndex === REVEAL_INDEX) {
    return (
      <GoalRevealStep
        theme={theme}
        name={name.trim()}
        goalMl={goalMl}
        onStart={handleStart}
      />
    );
  }

  const stepContent = [
    <NameStep key="name" theme={theme} name={name} onChangeName={setName} />,
    <BodyStep
      key="body"
      theme={theme}
      weightText={weightText}
      onChangeWeight={setWeightText}
      weightError={weightError}
      ageText={ageText}
      onChangeAge={setAgeText}
      ageError={ageError}
      gender={gender}
      onChangeGender={setGender}
    />,
    <ActivityStep
      key="activity"
      theme={theme}
      activityLevel={activityLevel}
      onChangeActivity={setActivityLevel}
    />,
    <ScheduleStep
      key="schedule"
      theme={theme}
      wakeUpTime={wakeUpTime}
      onChangeWakeUp={setWakeUpTime}
      sleepTime={sleepTime}
      onChangeSleep={setSleepTime}
      timeError={timeError}
    />,
  ][stepIndex];

  const headings = [COPY.name, COPY.body, COPY.activity, COPY.schedule][stepIndex];
  // Only steps with text inputs hide the footer behind the keyboard.
  const hasTextInput = stepIndex === 0 || stepIndex === 1;

  return (
    <WizardScaffold
      theme={theme}
      stepIndex={stepIndex}
      totalSteps={INPUT_STEP_COUNT}
      heading={headings.heading}
      helper={headings.helper}
      onBack={stepIndex > 0 ? back : undefined}
      onContinue={next}
      continueDisabled={!stepValid}
      hideFooter={hasTextInput && keyboardVisible}
    >
      {stepContent}
    </WizardScaffold>
  );
}
