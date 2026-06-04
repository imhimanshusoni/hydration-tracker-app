// Standalone notification scheduling utility.
// No React imports — can be called from any context (screens, store
// subscribers, or future widget/background tasks).

import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
  RepeatFrequency,
} from '@notifee/react-native';
import type { TimeOfDay } from '../types';

const CHANNEL_ID = 'water-reminder';
const NOTIFICATION_ID_PREFIX = 'water-reminder-';

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Water Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'water_drop',
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
  if (reminderIds.length > 0) {
    await notifee.cancelAllNotifications(reminderIds);
  }
}

// Schedules daily-repeating hourly reminders between wake-up and sleep.
// Cancels all existing reminders first, then creates new ones. The OS
// repeats each trigger every day, so reminders keep firing even if the
// app is never reopened.
export async function scheduleReminders(
  wakeUp: TimeOfDay,
  sleep: TimeOfDay,
  remindersEnabled: boolean,
): Promise<void> {
  try {
    await cancelAllReminders();

    if (!remindersEnabled) return;

    await ensureChannel();

    const now = new Date();

    // When today's goal is already met, suppress the rest of today's reminders
    // by anchoring EVERY hour to tomorrow. The DAILY repeat resumes tomorrow
    // with no app reopen needed. Lazy require keeps this file free of static
    // store imports (callable from any context, no circular-import risk).
    const { isDailyGoalMet } = require('../store/useWaterStore');
    const goalMetToday: boolean = isDailyGoalMet();

    for (let hour = wakeUp.hour; hour <= sleep.hour; hour++) {
      const fireDate = new Date();
      fireDate.setHours(hour, 0, 0, 0);

      // Android rejects past timestamps, so anchor hours already past to
      // tomorrow. Harmless on iOS — DAILY repeats only use the time of day.
      if (goalMetToday || fireDate.getTime() <= now.getTime()) {
        fireDate.setDate(fireDate.getDate() + 1);
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: fireDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      };

      await notifee.createTriggerNotification(
        {
          id: `${NOTIFICATION_ID_PREFIX}${hour}`,
          title: 'Water Reminder',
          body: 'Time to drink water! Stay on track with your hydration goal.',
          data: { hour: String(hour) },
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
    }
  } catch (e) {
    // Call sites don't await this; without the catch a failure here would be
    // an invisible unhandled rejection.
    console.warn('[notifications] scheduleReminders failed', e);
  }
}
