# Notification Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent notifications by adding a custom water drop sound on both Android and iOS, with a version-gated channel migration for existing installs.

**Architecture:** A single `water_drop.wav` audio file is placed in native asset directories for both platforms. A new `migrateNotificationChannel()` function uses an MMKV version flag to delete-then-recreate the Android channel exactly once per config change. The existing `ensureChannel()` and `createTriggerNotification()` calls are updated with sound and iOS config.

**Tech Stack:** @notifee/react-native, react-native-mmkv, Xcode project (pbxproj), Android res/raw

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `android/app/src/main/res/raw/water_drop.wav` | Android notification sound asset |
| Create | `assets/sounds/water_drop.wav` | Source sound file (iOS references this via Xcode) |
| Modify | `ios/WaterReminder.xcodeproj/project.pbxproj` | Add sound file to iOS bundle resources |
| Modify | `src/utils/notificationScheduler.ts` | Channel migration, sound config, iOS config |
| Modify | `App.tsx` | Call `migrateNotificationChannel()` at init |
| Modify | `__tests__/App.test.tsx` | Update notifee mock for new APIs |

---

### Task 1: Source and place the audio asset

**Files:**
- Create: `assets/sounds/water_drop.wav`
- Create: `android/app/src/main/res/raw/water_drop.wav`

**Prerequisite:** Download a water drop sound from Pixabay before starting.
- Go to pixabay.com/sound-effects and search "water drop"
- Pick a gentle, short (0.5-1.5s) single drop sound with no background noise
- Download as `.wav`

- [ ] **Step 1: Create the assets/sounds directory and place the file**

```bash
mkdir -p assets/sounds
# Copy your downloaded file (rename to water_drop.wav if needed):
cp ~/Downloads/<downloaded-file>.wav assets/sounds/water_drop.wav
```

- [ ] **Step 2: Create the Android raw directory and copy the file**

```bash
mkdir -p android/app/src/main/res/raw
cp assets/sounds/water_drop.wav android/app/src/main/res/raw/water_drop.wav
```

- [ ] **Step 3: Verify both files exist**

Run: `ls -la assets/sounds/water_drop.wav android/app/src/main/res/raw/water_drop.wav`
Expected: Both files listed with non-zero size.

- [ ] **Step 4: Commit**

```bash
git add assets/sounds/water_drop.wav android/app/src/main/res/raw/water_drop.wav
git commit -m "feat: add water drop notification sound asset"
```

---

### Task 2: Add sound file to iOS Xcode project bundle

**Files:**
- Modify: `ios/WaterReminder.xcodeproj/project.pbxproj`

The sound file must be registered in the Xcode project so it gets bundled into the iOS app. Follow the same pattern used for the Poppins font files already in the project.

- [ ] **Step 1: Add PBXBuildFile entry**

In `ios/WaterReminder.xcodeproj/project.pbxproj`, add a new build file entry in the `/* Begin PBXBuildFile section */`. Place it after the existing Poppins entries:

```
		A1B2C3D4E5F6789012345678 /* water_drop.wav in Resources */ = {isa = PBXBuildFile; fileRef = F9E8D7C6B5A4321098765432 /* water_drop.wav */; };
```

- [ ] **Step 2: Add PBXFileReference entry**

In the `/* Begin PBXFileReference section */`, add:

```
		F9E8D7C6B5A4321098765432 /* water_drop.wav */ = {isa = PBXFileReference; explicitFileType = undefined; fileEncoding = undefined; includeInIndex = 0; lastKnownFileType = audio.wav; name = "water_drop.wav"; path = "../assets/sounds/water_drop.wav"; sourceTree = "<group>"; };
```

- [ ] **Step 3: Add to PBXResourcesBuildPhase**

In the `/* Begin PBXResourcesBuildPhase section */`, add the build file reference inside the `files = (` array, after the existing Poppins entries:

```
				A1B2C3D4E5F6789012345678 /* water_drop.wav in Resources */,
```

So the full section looks like:

```
		13B07F8E1A680F5B00A75B9A /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				81AB9BB82411601600AC10FF /* LaunchScreen.storyboard in Resources */,
				13B07FBF1A68108700A75B9A /* Images.xcassets in Resources */,
				5D44621B753EC5965A5B7127 /* PrivacyInfo.xcprivacy in Resources */,
				106F6E89E913487FBCF22F08 /* Poppins-Light.ttf in Resources */,
				75FF5FFA68184DDEB822A693 /* Poppins-Medium.ttf in Resources */,
				F933D9C95CF94C978166A141 /* Poppins-Regular.ttf in Resources */,
				4CE98CB2453B40FA9D44BDED /* Poppins-Bold.ttf in Resources */,
				E21A0924EC25424DA51EC39E /* Poppins-Thin.ttf in Resources */,
				4D658140EA354714B6170169 /* Poppins-SemiBold.ttf in Resources */,
				A1B2C3D4E5F6789012345678 /* water_drop.wav in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
```

- [ ] **Step 4: Add to PBXGroup children**

Find the PBXGroup that lists the Poppins font file references and add the water_drop.wav file reference to its `children` array:

```
				F9E8D7C6B5A4321098765432 /* water_drop.wav */,
```

- [ ] **Step 5: Verify the Xcode project builds**

Run: `cd ios && pod install && xcodebuild -workspace WaterReminder.xcworkspace -scheme WaterReminder -sdk iphonesimulator -configuration Debug build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 6: Commit**

```bash
git add ios/WaterReminder.xcodeproj/project.pbxproj
git commit -m "feat(ios): add water_drop.wav to Xcode bundle resources"
```

---

### Task 3: Add version-gated channel migration

**Files:**
- Modify: `src/utils/notificationScheduler.ts`

- [ ] **Step 1: Add the MMKV import and CHANNEL_VERSION constant**

At the top of `src/utils/notificationScheduler.ts`, after the existing imports (line 10), add:

```typescript
import { storage } from '../store/mmkv';

const CHANNEL_VERSION = 'channel_v2';
```

- [ ] **Step 2: Add the `migrateNotificationChannel()` function**

After the `NOTIFICATION_ID_PREFIX` constant (line 13) and the new `CHANNEL_VERSION` constant, add:

```typescript
export async function migrateNotificationChannel(): Promise<void> {
  const currentVersion = storage.getString('notificationChannelVersion');
  if (currentVersion === CHANNEL_VERSION) return;

  await notifee.cancelAllNotifications();
  await notifee.deleteChannel(CHANNEL_ID);
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Water Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'water_drop',
  });

  storage.set('notificationChannelVersion', CHANNEL_VERSION);
}
```

- [ ] **Step 3: Update `ensureChannel()` with sound and HIGH importance**

Replace the existing `ensureChannel()` function:

```typescript
async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Water Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'water_drop',
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/notificationScheduler.ts
git commit -m "feat: add version-gated notification channel migration with sound"
```

---

### Task 4: Add iOS notification config to trigger notifications

**Files:**
- Modify: `src/utils/notificationScheduler.ts`

- [ ] **Step 1: Update the `createTriggerNotification` call**

Replace the notification object in `scheduleReminders()` (the `createTriggerNotification` call) with the iOS-aware version:

```typescript
    await notifee.createTriggerNotification(
      {
        id: `${NOTIFICATION_ID_PREFIX}${hour}`,
        title: 'Water Reminder',
        body: `Time to drink water! You've had ${consumedL}L of ${goalL}L today.`,
        android: {
          channelId: CHANNEL_ID,
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'water_drop.wav',
          interruptionLevel: 'timeSensitive',
          foregroundPresentationOptions: {
            sound: true,
            banner: true,
            list: true,
            badge: true,
          },
        },
      },
      trigger,
    );
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/notificationScheduler.ts
git commit -m "feat(ios): add sound and time-sensitive config to notifications"
```

---

### Task 5: Call migration at app init

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the import**

In `App.tsx`, update the existing import from `notificationScheduler` (line 16):

```typescript
import { scheduleReminders, migrateNotificationChannel } from './src/utils/notificationScheduler';
```

- [ ] **Step 2: Call `migrateNotificationChannel()` before `scheduleReminders()`**

In the `useEffect` inside the `App` component (lines 67-77), add the migration call before the existing schedule logic. Replace the entire `useEffect` callback:

```typescript
  useEffect(() => {
    if (onboardingComplete) {
      const { wakeUpTime, sleepTime, remindersEnabled } = useUserStore.getState();
      const { consumed } = useWaterStore.getState();
      // Migrate notification channel if config has changed (runs once per version bump)
      migrateNotificationChannel().then(() => {
        // Recalculate smart goal for today (weather + activity)
        useGoalStore.getState().recalculateMorningGoal().then(() => {
          const { effectiveGoal } = useGoalStore.getState();
          scheduleReminders(wakeUpTime, sleepTime, consumed, effectiveGoal, remindersEnabled);
        });
      });
    }
  }, [onboardingComplete]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: call notification channel migration at app init"
```

---

### Task 6: Update test mock

**Files:**
- Modify: `__tests__/App.test.tsx`

- [ ] **Step 1: Update the notifee mock to include new APIs**

In `__tests__/App.test.tsx`, replace the existing `@notifee/react-native` mock (lines 18-29):

```typescript
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(),
    deleteChannel: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    createTriggerNotification: jest.fn(),
    cancelNotification: jest.fn(),
    cancelAllNotifications: jest.fn(),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  TriggerType: {TIMESTAMP: 0},
  AndroidImportance: {DEFAULT: 3, HIGH: 4},
}));
```

Changes from the original:
- Added `deleteChannel: jest.fn()` (used by `migrateNotificationChannel`)
- Added `cancelAllNotifications: jest.fn()` (used by `migrateNotificationChannel`)
- Added `HIGH: 4` to `AndroidImportance` (used by updated channel config)

- [ ] **Step 2: Run the test**

Run: `npx jest __tests__/App.test.tsx --verbose`
Expected: PASS — `renders correctly` test passes.

- [ ] **Step 3: Run all tests**

Run: `npx jest --verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/App.test.tsx
git commit -m "test: update notifee mock for channel migration and sound APIs"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Android — build and install**

Run: `npx react-native run-android`
Expected: App launches successfully.

- [ ] **Step 2: Android — verify channel settings**

Open the device's notification settings for the app (Settings > Apps > WaterReminder > Notifications > Water Reminders). Verify:
- Importance is set to High (or "Urgent"/"Make sound and pop on screen" depending on OEM)
- Sound shows the custom `water_drop` sound

- [ ] **Step 3: Android — wait for a reminder**

Set wake/sleep times so a reminder fires within a few minutes. Verify:
- Notification appears as heads-up (pops down from top)
- Water drop sound plays

- [ ] **Step 4: iOS — build and install**

Run: `npx react-native run-ios`
Expected: App launches successfully.

- [ ] **Step 5: iOS — wait for a reminder**

Set wake/sleep times so a reminder fires within a few minutes. Verify:
- Notification plays the water drop sound
- With app in foreground: banner appears and sound plays

- [ ] **Step 6: Regression — toggle reminders off**

In Settings, toggle reminders off. Verify no new notifications are scheduled. Toggle back on and verify they resume.
