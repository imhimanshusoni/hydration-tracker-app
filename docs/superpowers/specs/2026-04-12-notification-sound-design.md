# Custom Water Drop Notification Sound

## Problem

Scheduled water reminder notifications are delivered silently on both Android and iOS. The Notifee notification channel lacks a `sound` property (defaults to no sound), uses `AndroidImportance.DEFAULT` (no heads-up display), and the notification object has no `ios` config at all.

## Decision

Ship a single custom water drop sound sourced from Pixabay. This gives the app a distinctive, brand-aligned notification tone that users can immediately associate with their hydration reminders.

## Sound Asset

- **Source:** Pixabay (royalty-free, no attribution required)
- **Search terms:** "water drop", "water droplet", "single drop"
- **Criteria:** 0.5-1.5 seconds, gentle single drop, clean recording, no background noise
- **Format:** `.wav`
- **File name:** `water_drop.wav`
- **Placement:**
  - Android: `android/app/src/main/res/raw/water_drop.wav`
  - iOS: Added to Xcode project bundle (WaterReminder target)

## Code Changes

**Files:** `src/utils/notificationScheduler.ts`, `App.tsx` (to call migration at init)

### 1. Channel migration: version-gated delete-and-recreate

Android channels are immutable after creation, so existing installs need a delete-then-create to pick up new settings. But this should only run once per config change, not on every launch. Gate it behind a version flag in MMKV (already in the stack via `src/store/mmkv.ts`).

Add a new exported function `migrateNotificationChannel()`:

```typescript
import { storage } from '../store/mmkv';

const CHANNEL_VERSION = 'channel_v2';

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

**Flow:**
- First launch after update: version mismatch -> delete, recreate, save new version
- Every subsequent launch: version matches -> skip entirely
- Future channel config changes: bump `CHANNEL_VERSION` to `'channel_v3'` etc.

Call `migrateNotificationChannel()` early in the app init (before `scheduleReminders`). Fresh installs can initialize the flag at install time so they skip this block.

### 2. Update `ensureChannel()` for normal path

After migration, the regular `ensureChannel()` becomes a simple create (no-op if channel already exists):

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

### 3. iOS notification config

Add an `ios` block to the `createTriggerNotification` call:

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

## Verification

1. **Android:** Install the app. Open system notification settings for the app — "Water Reminders" channel should show importance High with the custom sound. Wait for a scheduled reminder; it should play the water drop sound and show as a heads-up notification.
2. **iOS:** Install the app. Wait for a scheduled reminder; it should play the water drop sound. Test with the app in foreground — sound and banner should both appear.
3. **Upgrade path:** Install the old version first, then upgrade. Verify the old silent channel is replaced and new notifications have sound.
4. **Regression:** Confirm reminders still schedule correctly between wake/sleep times, cancellation still works, and toggling reminders off in settings still cancels all notifications.
