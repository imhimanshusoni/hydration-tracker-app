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

**Single file:** `src/utils/notificationScheduler.ts`

### 1. Channel management: delete-and-recreate

Replace the current `ensureChannel()` with a delete-then-create pattern so existing installs pick up the new sound and importance settings (Android channels are immutable after creation):

```typescript
async function ensureChannel(): Promise<void> {
  await notifee.deleteChannel(CHANNEL_ID);
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Water Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'water_drop',
  });
}
```

This is safe because `scheduleReminders()` already calls `cancelAllReminders()` before `ensureChannel()`, so no notifications reference the old channel when it's deleted.

### 2. iOS notification config

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
