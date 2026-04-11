# Water Reminder App — Design Specification

## Context

A fully local React Native mobile app that helps users track daily water intake with hourly reminders. No backend, no auth, no cloud sync. Designed with future Android widget support in mind.

**Tech stack**: React Native 0.85, TypeScript strict, React Navigation v6 (bottom tabs), Zustand with persist middleware, MMKV storage, Notifee for local notifications.

---

## 1. Data Model & State

### useUserStore (Zustand, persisted via MMKV)

| Field              | Type                              | Notes                                   |
|--------------------|-----------------------------------|-----------------------------------------|
| name               | string                            | User's display name                     |
| weight             | number                            | kg, validated 30–200                    |
| age                | number                            | Validated 12–100                        |
| wakeUpTime         | { hour: number, minute: number }  | 24h format                              |
| sleepTime          | { hour: number, minute: number }  | 24h format, must be > wakeUpTime        |
| remindersEnabled   | boolean                           | Toggles notification scheduling, defaults to true on onboarding |
| onboardingComplete | boolean                           | Gates navigation to main app            |
| dailyGoal          | number                            | ml, calculated: weight × 35, ×0.9 if age > 55 |

### useWaterStore (Zustand, persisted via MMKV)

| Field          | Type           | Notes                                      |
|----------------|----------------|--------------------------------------------|
| consumed       | number         | ml, cumulative for current day              |
| lastLoggedAt   | string | null  | ISO timestamp of most recent log            |
| lastLogAmount  | number | null  | ml of most recent log (for undo)            |
| date           | string         | YYYY-MM-DD, used to detect midnight rollover|

### Widget MMKV Keys (written on every store change via `subscribe`)

- `widget:dailyGoal` — number (ml)
- `widget:consumed` — number (ml)
- `widget:lastLogged` — ISO timestamp string

These keys are raw MMKV reads — no Zustand dependency — so a future native widget can access them directly.

### Midnight Reset

On every app foreground (`AppState` change to `active`) and on store initialization, compare stored `date` to today's date (`YYYY-MM-DD`). If different:
- Set `consumed` to 0
- Clear `lastLoggedAt` and `lastLogAmount`
- Update `date` to today
- Update widget keys
- Reschedule notifications

Reset is silent — no toast or notification.

---

## 2. Screens & Navigation

### Navigation Structure

- **Root**: Conditional — if `onboardingComplete === false`, render `OnboardingScreen` (full-screen, no tabs). Otherwise, render bottom tab navigator.
- **Bottom Tabs**: Home, Settings (2 tabs)

### OnboardingScreen

Single scrollable form collecting:
- Name (text input)
- Weight (numeric input, 30–200 kg, inline error for out-of-range)
- Age (numeric input, 12–100, inline error for out-of-range)
- Wake-up time (time picker, 24h)
- Sleep time (time picker, 24h, must be after wake-up)

"Get Started" button at bottom — disabled until all fields valid. On submit:
1. Calculate `dailyGoal = weight × 35` (if age > 55, multiply by 0.9)
2. Save all fields to `useUserStore`
3. Set `onboardingComplete = true`
4. Navigate to Home (no intermediate screen)

### HomeScreen

- **Top**: Greeting — "Hi, {name}"
- **Center**: Large circular progress ring showing consumed vs. goal (e.g., "1.2 / 2.5 L")
- **Below ring**: Percentage text (e.g., "48%")
- **Bottom**: "Log Water" button — opens `LogWaterModal`
- **Undo toast**: After logging, a small toast appears at bottom for 5 seconds with "Undo" button. Tapping reverses the last log. If user logs again within 5 seconds, the previous undo opportunity is replaced.
- Progress can exceed 100% — no cap, no celebration message.

### SettingsScreen

**Profile section:**
- Name, weight, age — editable fields with same validation as onboarding
- Changing weight or age immediately recalculates `dailyGoal`
- Today's consumption is preserved (not reset)

**Reminders section:**
- Wake-up time picker
- Sleep time picker
- Reminder toggle (on/off)
- Changing any of these reschedules all notifications

### LogWaterModal

- Three preset buttons: 150ml, 250ml, 500ml
- Custom input: slider (50–1000ml) + text field for fine-tuning
- "Log" button to confirm
- On log: add amount to `consumed`, set `lastLoggedAt`, set `lastLogAmount`, update widget keys, reschedule notifications

---

## 3. Notification Scheduling

### notificationScheduler.ts — Standalone Utility

No React imports. Takes plain values, returns nothing. Can be called from any context (screen, store subscriber, future widget/background task).

**Functions:**
- `scheduleReminders(wakeUp, sleep, consumed, dailyGoal, remindersEnabled)` — cancels all existing reminders, then schedules one notification per hour between wake-up and sleep for the current day. Skips hours already past.
- `cancelAllReminders()` — cancels all scheduled notifications.

**Notification content:**
- Title: "Water Reminder"
- Body: "Time to drink water! You've had {consumed}L of {dailyGoal}L today."

**Triggers for rescheduling:**
1. User logs water (consumed changes)
2. User changes wake/sleep times in Settings
3. User toggles reminders on
4. App comes to foreground (catch midnight reset)

**Library: Notifee** (by Invertase) — to be confirmed via Context7 at implementation time. Supports scheduled local notifications on both iOS and Android.

**Permission handling:** Check notification permission before scheduling. If denied, show a message in Settings explaining how to enable in system settings. The toggle still functions (schedules are set, but OS won't deliver).

---

## 4. Theming

Follow system theme using `useColorScheme()`.

Define a theme object with light/dark variants:
- background, surface, text, textSecondary, accent (blue), border, error

No theming library — simple React Context or inline style selection. Blue accent color for water-themed identity in both modes.

---

## 5. Utility: waterCalculator.ts

Pure function:
```
calculateDailyGoal(weight: number, age: number): number
  → weight × 35, then × 0.9 if age > 55
  → returns ml as integer
```

---

## 6. File Structure

```
src/
  screens/
    OnboardingScreen.tsx
    HomeScreen.tsx
    SettingsScreen.tsx
  components/
    WaterProgressBar.tsx      — circular progress ring component
    LogWaterModal.tsx          — modal with presets + slider + custom input
  store/
    useUserStore.ts            — Zustand store for user profile
    useWaterStore.ts           — Zustand store for daily water tracking
  utils/
    waterCalculator.ts         — pure goal calculation function
    notificationScheduler.ts   — standalone notification scheduling
  types/
    index.ts                   — shared TypeScript types
```

---

## 7. Input Validation Summary

| Field     | Range    | Error behavior                          |
|-----------|----------|-----------------------------------------|
| Name      | non-empty| Inline error "Name is required"         |
| Weight    | 30–200 kg| Inline error "Weight must be 30–200 kg" |
| Age       | 12–100   | Inline error "Age must be 12–100"       |
| Wake time | —        | Must be before sleep time               |
| Sleep time| —        | Must be after wake time                 |
| Custom ml | 50–1000  | Slider constrains; text field clamps    |

---

## 8. Out of Scope

- User accounts, cloud sync, authentication
- Multiple user profiles
- Water intake history or charts
- Internationalization
- Widget implementation (architected for, not built)
- Notification action buttons (informational only)

## 9. Future Scope (Architected For)

- **Android widget**: reads `widget:*` MMKV keys directly
- **Background tasks**: `notificationScheduler.ts` is decoupled from React — callable from native modules
- **History/charts**: `useWaterStore` date field enables per-day tracking in a future version
