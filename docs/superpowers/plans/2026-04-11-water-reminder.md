# Water Reminder App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully local React Native water tracking app with hourly reminders, circular progress UI, and widget-ready architecture.

**Architecture:** Two Zustand stores (user profile + daily water) persisted to MMKV. Standalone notification scheduler reschedules on every consumption change for accurate messages. Conditional navigation gates onboarding vs main tabs. Widget-readable MMKV keys written via store subscriptions.

**Tech Stack:** React Native 0.85, TypeScript strict, React Navigation v7 (bottom tabs), Zustand v5 with persist middleware, react-native-mmkv, Notifee (local notifications), react-native-svg (progress ring).

**Design Spec:** `docs/superpowers/specs/2026-04-11-water-reminder-design.md`

---

## Task 0: Install Dependencies & Project Setup

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/types/index.ts`

- [ ] **Step 1: Install all required packages**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder
npm install zustand react-native-mmkv @notifee/react-native @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-svg @react-native-community/datetimepicker
```

Expected: packages added to `package.json` dependencies, no errors.

- [ ] **Step 2: Install iOS pods**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder/ios && pod install
```

Expected: Pod installation succeeds.

- [ ] **Step 3: Enable strict TypeScript**

Edit `tsconfig.json` — add `"strict": true` to `compilerOptions`:

```json
{
  "extends": "@react-native/typescript-config",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/node_modules", "**/Pods"]
}
```

- [ ] **Step 4: Create shared types**

Create `src/types/index.ts`:

```typescript
// Shared TypeScript types for Water Reminder app

export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface UserProfile {
  name: string;
  weight: number; // kg, 30-200
  age: number; // 12-100
  wakeUpTime: TimeOfDay;
  sleepTime: TimeOfDay;
  remindersEnabled: boolean;
  onboardingComplete: boolean;
  dailyGoal: number; // ml
}

export interface WaterDay {
  consumed: number; // ml, cumulative for current day
  lastLoggedAt: string | null; // ISO timestamp
  lastLogAmount: number | null; // ml, for undo
  date: string; // YYYY-MM-DD
}
```

- [ ] **Step 5: Create directory structure**

Run:
```bash
mkdir -p src/screens src/components src/store src/utils src/types
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: install dependencies and set up project structure

Add zustand, react-native-mmkv, notifee, react-navigation,
react-native-screens, react-native-svg, datetimepicker.
Enable strict TypeScript. Create src directory structure and shared types."
```

---

## Task 1: Water Calculator Utility

**Files:**
- Create: `src/utils/waterCalculator.ts`
- Create: `__tests__/waterCalculator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/waterCalculator.test.ts`:

```typescript
import { calculateDailyGoal } from '../src/utils/waterCalculator';

describe('calculateDailyGoal', () => {
  it('returns weight * 35 for age <= 55', () => {
    expect(calculateDailyGoal(70, 30)).toBe(2450);
  });

  it('returns weight * 35 * 0.9 for age > 55', () => {
    // 80 * 35 = 2800, * 0.9 = 2520
    expect(calculateDailyGoal(80, 60)).toBe(2520);
  });

  it('returns integer result even with fractional calculation', () => {
    // 65 * 35 = 2275, * 0.9 = 2047.5 → 2048
    expect(calculateDailyGoal(65, 56)).toBe(2048);
  });

  it('handles boundary age of exactly 55', () => {
    // Age 55 is NOT > 55, so no reduction
    expect(calculateDailyGoal(70, 55)).toBe(2450);
  });

  it('handles minimum valid weight', () => {
    expect(calculateDailyGoal(30, 20)).toBe(1050);
  });

  it('handles maximum valid weight with age reduction', () => {
    // 200 * 35 = 7000, * 0.9 = 6300
    expect(calculateDailyGoal(200, 100)).toBe(6300);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx jest __tests__/waterCalculator.test.ts`

Expected: FAIL — `Cannot find module '../src/utils/waterCalculator'`

- [ ] **Step 3: Write implementation**

Create `src/utils/waterCalculator.ts`:

```typescript
// Pure function to calculate daily water goal in ml.
// Formula: weight (kg) * 35ml, reduced by 10% if age > 55.

export function calculateDailyGoal(weight: number, age: number): number {
  const base = weight * 35;
  const adjusted = age > 55 ? base * 0.9 : base;
  return Math.round(adjusted);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx jest __tests__/waterCalculator.test.ts`

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/waterCalculator.ts __tests__/waterCalculator.test.ts
git commit -m "feat: add water calculator utility with tests"
```

---

## Task 2: MMKV Storage Setup & Zustand Stores

**Files:**
- Create: `src/store/mmkv.ts`
- Create: `src/store/useUserStore.ts`
- Create: `src/store/useWaterStore.ts`

- [ ] **Step 1: Create MMKV instance and Zustand storage adapter**

Create `src/store/mmkv.ts`:

```typescript
// MMKV storage instance and Zustand adapter.
// Also provides direct MMKV access for widget-readable keys.

import { createMMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

export const storage = createMMKV();

// Zustand-compatible storage adapter
export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    storage.set(name, value);
  },
  getItem: (name) => {
    return storage.getString(name) ?? null;
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};

// Widget-readable MMKV keys — written directly so native widgets
// can read them without going through Zustand's JSON serialization.
export function writeWidgetData(dailyGoal: number, consumed: number, lastLogged: string | null) {
  storage.set('widget:dailyGoal', dailyGoal);
  storage.set('widget:consumed', consumed);
  if (lastLogged) {
    storage.set('widget:lastLogged', lastLogged);
  } else {
    storage.remove('widget:lastLogged');
  }
}
```

- [ ] **Step 2: Create user store**

Create `src/store/useUserStore.ts`:

```typescript
// Zustand store for user profile and preferences.
// Persisted to MMKV. Updates widget data on goal changes.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData, storage as mmkv } from './mmkv';
import { calculateDailyGoal } from '../utils/waterCalculator';
import type { TimeOfDay, UserProfile } from '../types';

interface UserActions {
  completeOnboarding: (profile: Omit<UserProfile, 'onboardingComplete' | 'dailyGoal' | 'remindersEnabled'>) => void;
  updateProfile: (updates: { name?: string; weight?: number; age?: number }) => void;
  updateSchedule: (updates: { wakeUpTime?: TimeOfDay; sleepTime?: TimeOfDay }) => void;
  setRemindersEnabled: (enabled: boolean) => void;
}

type UserState = UserProfile & UserActions;

const DEFAULT_WAKE: TimeOfDay = { hour: 7, minute: 0 };
const DEFAULT_SLEEP: TimeOfDay = { hour: 23, minute: 0 };

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      name: '',
      weight: 70,
      age: 25,
      wakeUpTime: DEFAULT_WAKE,
      sleepTime: DEFAULT_SLEEP,
      remindersEnabled: true,
      onboardingComplete: false,
      dailyGoal: 2450,

      completeOnboarding: (profile) => {
        const goal = calculateDailyGoal(profile.weight, profile.age);
        set({
          ...profile,
          dailyGoal: goal,
          remindersEnabled: true,
          onboardingComplete: true,
        });
        // Write widget data with fresh goal, 0 consumed
        writeWidgetData(goal, 0, null);
      },

      updateProfile: (updates) => {
        const current = get();
        const weight = updates.weight ?? current.weight;
        const age = updates.age ?? current.age;
        const goal = calculateDailyGoal(weight, age);
        set({ ...updates, dailyGoal: goal });
        // Update widget goal — consumed stays the same
        const consumed = mmkv.getNumber('widget:consumed') ?? 0;
        const lastLogged = mmkv.getString('widget:lastLogged') ?? null;
        writeWidgetData(goal, consumed, lastLogged);
      },

      updateSchedule: (updates) => {
        set(updates);
      },

      setRemindersEnabled: (enabled) => {
        set({ remindersEnabled: enabled });
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        name: state.name,
        weight: state.weight,
        age: state.age,
        wakeUpTime: state.wakeUpTime,
        sleepTime: state.sleepTime,
        remindersEnabled: state.remindersEnabled,
        onboardingComplete: state.onboardingComplete,
        dailyGoal: state.dailyGoal,
      }),
    },
  ),
);
```

- [ ] **Step 3: Create water store**

Create `src/store/useWaterStore.ts`:

```typescript
// Zustand store for daily water consumption tracking.
// Persisted to MMKV. Handles midnight reset and undo.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage, writeWidgetData } from './mmkv';
import { useUserStore } from './useUserStore';
import type { WaterDay } from '../types';

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface WaterActions {
  logWater: (amount: number) => void;
  undoLastLog: () => void;
  checkMidnightReset: () => void;
}

type WaterState = WaterDay & WaterActions;

export const useWaterStore = create<WaterState>()(
  persist(
    (set, get) => ({
      consumed: 0,
      lastLoggedAt: null,
      lastLogAmount: null,
      date: getTodayDate(),

      logWater: (amount) => {
        const now = new Date().toISOString();
        const newConsumed = get().consumed + amount;
        set({
          consumed: newConsumed,
          lastLoggedAt: now,
          lastLogAmount: amount,
        });
        const { dailyGoal } = useUserStore.getState();
        writeWidgetData(dailyGoal, newConsumed, now);
      },

      undoLastLog: () => {
        const { lastLogAmount, consumed } = get();
        if (lastLogAmount === null) return;
        const newConsumed = Math.max(0, consumed - lastLogAmount);
        const lastLogged = get().lastLoggedAt;
        set({
          consumed: newConsumed,
          lastLogAmount: null,
        });
        const { dailyGoal } = useUserStore.getState();
        writeWidgetData(dailyGoal, newConsumed, lastLogged);
      },

      checkMidnightReset: () => {
        const today = getTodayDate();
        if (get().date !== today) {
          set({
            consumed: 0,
            lastLoggedAt: null,
            lastLogAmount: null,
            date: today,
          });
          const { dailyGoal } = useUserStore.getState();
          writeWidgetData(dailyGoal, 0, null);
        }
      },
    }),
    {
      name: 'water-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        consumed: state.consumed,
        lastLoggedAt: state.lastLoggedAt,
        lastLogAmount: state.lastLogAmount,
        date: state.date,
      }),
    },
  ),
);
```

- [ ] **Step 4: Commit**

```bash
git add src/store/
git commit -m "feat: add MMKV storage, user store, and water store

Zustand stores persisted via MMKV with widget-readable keys.
Water store handles logging, undo, and midnight reset."
```

---

## Task 3: Notification Scheduler Utility

**Files:**
- Create: `src/utils/notificationScheduler.ts`

- [ ] **Step 1: Create notification scheduler**

Create `src/utils/notificationScheduler.ts`:

```typescript
// Standalone notification scheduling utility.
// No React imports — can be called from any context (screens, store
// subscribers, or future widget/background tasks).

import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
} from '@notifee/react-native';
import type { TimeOfDay } from '../types';

const CHANNEL_ID = 'water-reminder';
const NOTIFICATION_ID_PREFIX = 'water-reminder-';

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Water Reminders',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  // iOS: authorizationStatus 1 = AUTHORIZED
  return settings.authorizationStatus >= 1;
}

export async function cancelAllReminders(): Promise<void> {
  const triggers = await notifee.getTriggerNotificationIds();
  const reminderIds = triggers.filter((id) => id.startsWith(NOTIFICATION_ID_PREFIX));
  for (const id of reminderIds) {
    await notifee.cancelNotification(id);
  }
}

// Schedules hourly reminders between wake-up and sleep for today.
// Cancels all existing reminders first, then creates new ones.
// Skips hours already past. Called on every water log so notification
// messages always reflect current consumption.
export async function scheduleReminders(
  wakeUp: TimeOfDay,
  sleep: TimeOfDay,
  consumed: number,
  dailyGoal: number,
  remindersEnabled: boolean,
): Promise<void> {
  await cancelAllReminders();

  if (!remindersEnabled) return;

  await ensureChannel();

  const now = new Date();
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  for (let hour = wakeUp.hour; hour <= sleep.hour; hour++) {
    const fireDate = new Date();
    fireDate.setHours(hour, 0, 0, 0);

    // Skip if this hour has already passed
    if (fireDate.getTime() <= now.getTime()) continue;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireDate.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `${NOTIFICATION_ID_PREFIX}${hour}`,
        title: 'Water Reminder',
        body: `Time to drink water! You've had ${consumedL}L of ${goalL}L today.`,
        android: {
          channelId: CHANNEL_ID,
          pressAction: { id: 'default' },
        },
      },
      trigger,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/notificationScheduler.ts
git commit -m "feat: add standalone notification scheduler

Schedules hourly reminders between wake/sleep times using Notifee.
Cancels and reschedules on every call for accurate consumption data."
```

---

## Task 4: Theme System

**Files:**
- Create: `src/theme.ts`

- [ ] **Step 1: Create theme definitions**

Create `src/theme.ts`:

```typescript
// Light and dark theme definitions.
// Used inline via useColorScheme() — no context provider needed.

export interface AppTheme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  error: string;
}

export const lightTheme: AppTheme = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  accent: '#2196F3',
  border: '#E5E7EB',
  error: '#EF4444',
};

export const darkTheme: AppTheme = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accent: '#64B5F6',
  border: '#374151',
  error: '#F87171',
};

export function getTheme(colorScheme: 'light' | 'dark' | null | undefined): AppTheme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme.ts
git commit -m "feat: add light/dark theme definitions"
```

---

## Task 5: Water Progress Ring Component

**Files:**
- Create: `src/components/WaterProgressBar.tsx`

- [ ] **Step 1: Create circular progress component**

Create `src/components/WaterProgressBar.tsx`:

```tsx
// Circular progress ring showing water consumed vs daily goal.
// Uses react-native-svg for the ring. Accepts consumed/goal in ml.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { AppTheme } from '../theme';

interface WaterProgressBarProps {
  consumed: number; // ml
  dailyGoal: number; // ml
  theme: AppTheme;
}

const SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WaterProgressBar({ consumed, dailyGoal, theme }: WaterProgressBarProps) {
  const progress = dailyGoal > 0 ? consumed / dailyGoal : 0;
  const clampedProgress = Math.min(progress, 1); // Clamp ring at 100%, but show real percentage in text
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedProgress);
  const percentage = Math.round(progress * 100);
  const consumedL = (consumed / 1000).toFixed(1);
  const goalL = (dailyGoal / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.border}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.accent}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.amount, { color: theme.text }]}>
          {consumedL} / {goalL} L
        </Text>
        <Text style={[styles.percentage, { color: theme.textSecondary }]}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
  },
  percentage: {
    fontSize: 16,
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WaterProgressBar.tsx
git commit -m "feat: add circular water progress ring component"
```

---

## Task 6: Log Water Modal Component

**Files:**
- Create: `src/components/LogWaterModal.tsx`

- [ ] **Step 1: Create log water modal**

Create `src/components/LogWaterModal.tsx`:

```tsx
// Modal for logging water intake.
// Preset buttons (150/250/500 ml) + slider with text input (50-1000 ml).

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import type { AppTheme } from '../theme';

interface LogWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (amount: number) => void;
  theme: AppTheme;
}

const PRESETS = [150, 250, 500];
const MIN_CUSTOM = 50;
const MAX_CUSTOM = 1000;

export function LogWaterModal({ visible, onClose, onLog, theme }: LogWaterModalProps) {
  const [customAmount, setCustomAmount] = useState(250);
  const [customText, setCustomText] = useState('250');

  function handlePreset(amount: number) {
    onLog(amount);
    onClose();
  }

  function handleCustomLog() {
    onLog(customAmount);
    onClose();
  }

  function handleSliderText(text: string) {
    setCustomText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(MIN_CUSTOM, Math.min(MAX_CUSTOM, parsed));
      setCustomAmount(clamped);
    }
  }

  function handleTextBlur() {
    // Sync text field to clamped value on blur
    setCustomText(String(customAmount));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>Log Water</Text>

          {/* Preset buttons */}
          <View style={styles.presetRow}>
            {PRESETS.map((ml) => (
              <TouchableOpacity
                key={ml}
                style={[styles.presetButton, { borderColor: theme.accent }]}
                onPress={() => handlePreset(ml)}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>{ml} ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount section */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Custom amount
          </Text>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="numeric"
              value={customText}
              onChangeText={handleSliderText}
              onBlur={handleTextBlur}
              maxLength={4}
            />
            <Text style={[styles.mlLabel, { color: theme.textSecondary }]}>ml</Text>
          </View>

          {/* Slider - using a simple view-based approach since
              @react-native-community/slider adds another dep.
              The text input + presets cover the UX need. */}
          <View style={styles.rangeHint}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{MIN_CUSTOM} ml</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{MAX_CUSTOM} ml</Text>
          </View>

          <TouchableOpacity
            style={[styles.logButton, { backgroundColor: theme.accent }]}
            onPress={handleCustomLog}
          >
            <Text style={styles.logButtonText}>Log {customAmount} ml</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={{ color: theme.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  presetButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  mlLabel: {
    fontSize: 16,
    marginLeft: 10,
  },
  rangeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LogWaterModal.tsx
git commit -m "feat: add log water modal with presets and custom input"
```

---

## Task 7: Onboarding Screen

**Files:**
- Create: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Create onboarding screen**

Create `src/screens/OnboardingScreen.tsx`:

```tsx
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

// Note: @react-native-community/datetimepicker is commonly used for time pickers in RN.
// If not installed, we'll need: npm install @react-native-community/datetimepicker
// Alternative: use simple numeric inputs for hour/minute if the picker dep is unwanted.
// For now, we use simple numeric inputs to avoid an extra dependency.

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
  const nameError = name.length === 0 ? null : ''; // Only show after touch — handled by isValid
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: add onboarding screen with form validation and time pickers"
```

---

## Task 8: Home Screen

**Files:**
- Create: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Create home screen**

Create `src/screens/HomeScreen.tsx`:

```tsx
// Home screen: shows greeting, circular progress ring, log button, and undo toast.
// Checks for midnight reset on foreground and reschedules notifications on log.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  AppState,
  Animated,
} from 'react-native';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { useWaterStore } from '../store/useWaterStore';
import { WaterProgressBar } from '../components/WaterProgressBar';
import { LogWaterModal } from '../components/LogWaterModal';
import { scheduleReminders } from '../utils/notificationScheduler';

export function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  const name = useUserStore((s) => s.name);
  const dailyGoal = useUserStore((s) => s.dailyGoal);
  const wakeUpTime = useUserStore((s) => s.wakeUpTime);
  const sleepTime = useUserStore((s) => s.sleepTime);
  const remindersEnabled = useUserStore((s) => s.remindersEnabled);

  const consumed = useWaterStore((s) => s.consumed);
  const lastLogAmount = useWaterStore((s) => s.lastLogAmount);
  const logWater = useWaterStore((s) => s.logWater);
  const undoLastLog = useWaterStore((s) => s.undoLastLog);
  const checkMidnightReset = useWaterStore((s) => s.checkMidnightReset);

  const [modalVisible, setModalVisible] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Midnight reset on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkMidnightReset();
        // Reschedule notifications in case day rolled over
        scheduleReminders(wakeUpTime, sleepTime, useWaterStore.getState().consumed, dailyGoal, remindersEnabled);
      }
    });
    return () => sub.remove();
  }, [checkMidnightReset, wakeUpTime, sleepTime, dailyGoal, remindersEnabled]);

  // Also check on mount
  useEffect(() => {
    checkMidnightReset();
  }, [checkMidnightReset]);

  const handleLog = useCallback((amount: number) => {
    logWater(amount);
    const newConsumed = consumed + amount;

    // Reschedule notifications with updated consumption
    scheduleReminders(wakeUpTime, sleepTime, newConsumed, dailyGoal, remindersEnabled);

    // Show undo toast
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(true);
    Animated.timing(undoOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    undoTimer.current = setTimeout(() => {
      Animated.timing(undoOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowUndo(false));
    }, 5000);
  }, [consumed, logWater, wakeUpTime, sleepTime, dailyGoal, remindersEnabled, undoOpacity]);

  const handleUndo = useCallback(() => {
    undoLastLog();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    undoOpacity.setValue(0);

    // Reschedule with reverted consumption
    const reverted = useWaterStore.getState().consumed;
    scheduleReminders(wakeUpTime, sleepTime, reverted, dailyGoal, remindersEnabled);
  }, [undoLastLog, wakeUpTime, sleepTime, dailyGoal, remindersEnabled, undoOpacity]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.greeting, { color: theme.text }]}>Hi, {name}</Text>

      <View style={styles.progressContainer}>
        <WaterProgressBar consumed={consumed} dailyGoal={dailyGoal} theme={theme} />
      </View>

      <TouchableOpacity
        style={[styles.logButton, { backgroundColor: theme.accent }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.logButtonText}>Log Water</Text>
      </TouchableOpacity>

      <LogWaterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onLog={handleLog}
        theme={theme}
      />

      {/* Undo toast */}
      {showUndo && (
        <Animated.View style={[styles.undoToast, { backgroundColor: theme.surface, borderColor: theme.border, opacity: undoOpacity }]}>
          <Text style={{ color: theme.text }}>
            Logged {lastLogAmount} ml
          </Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text style={{ color: theme.accent, fontWeight: '700', marginLeft: 16 }}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', paddingHorizontal: 24 },
  progressContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logButton: {
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  logButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add home screen with progress ring, logging, and undo toast"
```

---

## Task 9: Settings Screen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Create settings screen**

Create `src/screens/SettingsScreen.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add settings screen with profile editing and reminder controls"
```

---

## Task 10: App Entry Point & Navigation

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Replace App.tsx with navigation setup**

Replace the contents of `App.tsx` with:

```tsx
// Root app component.
// Conditional navigation: onboarding screen if not completed,
// bottom tab navigator (Home, Settings) otherwise.

import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useUserStore } from './src/store/useUserStore';
import { useWaterStore } from './src/store/useWaterStore';
import { scheduleReminders } from './src/utils/notificationScheduler';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function App() {
  const colorScheme = useColorScheme();
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  // Schedule initial notifications on app start (if onboarded)
  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, dailyGoal, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
      scheduleReminders(wakeUpTime, sleepTime, consumed, dailyGoal, remindersEnabled);
    }
  }, [onboardingComplete]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      {onboardingComplete ? (
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <OnboardingScreen />
      )}
    </SafeAreaProvider>
  );
}

export default App;
```

- [ ] **Step 2: Commit**

```bash
git add App.tsx
git commit -m "feat: wire up navigation with onboarding gate and tab navigator"
```

---

## Task 11: Build & Smoke Test

- [ ] **Step 1: TypeScript type check**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx tsc --noEmit
```

Expected: No type errors. If there are errors, fix them.

- [ ] **Step 2: Run existing unit tests**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx jest
```

Expected: All tests pass (waterCalculator tests + the default App test, which may need updating since App.tsx changed).

- [ ] **Step 3: Update App test if needed**

If `__tests__/App.test.tsx` fails because of the new App.tsx dependencies, update it:

```tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Mock the native modules that aren't available in test
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    remove: jest.fn(),
  }),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createTriggerNotification: jest.fn(),
    cancelNotification: jest.fn(),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  }),
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
```

- [ ] **Step 4: Build for Android (smoke test)**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx react-native run-android
```

Expected: App launches on emulator/device. If onboarding not complete, shows the onboarding form.

- [ ] **Step 5: Build for iOS (smoke test)**

Run:
```bash
cd /Users/imhimanshu1/Documents/Personal/WaterReminder && npx react-native run-ios
```

Expected: App launches on simulator. Same behavior as Android.

- [ ] **Step 6: Manual testing checklist**

Test the following flows:
1. **Onboarding**: Fill all fields, verify validation errors for out-of-range values, submit
2. **Home screen**: Verify greeting shows name, progress ring shows 0/goal
3. **Log water**: Tap "Log Water", try each preset (150/250/500), verify progress updates
4. **Custom log**: Enter custom amount, verify it logs correctly
5. **Undo**: After logging, verify undo toast appears and disappears after 5 seconds. Tap undo, verify consumption decreases.
6. **Settings**: Edit name/weight/age, verify goal recalculates. Toggle reminders on/off.
7. **Dark mode**: Switch device to dark mode, verify theme changes.
8. **App restart**: Kill and reopen app, verify data persists.
9. **Midnight rollover**: (Optionally set device clock) verify consumption resets.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test: update app test with native module mocks"
```

---

## Verification

### Automated
- `npx tsc --noEmit` — zero type errors
- `npx jest` — all tests pass

### Manual
- Full flow: onboarding -> home -> log water -> undo -> settings -> edit profile -> verify goal recalculation
- Dark mode toggle
- App restart persistence
- Notification delivery (set wake time to current hour, wait for next hour)
