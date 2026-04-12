// Standalone notification scheduling utility.
// No React imports — can be called from any context (screens, store
// subscribers, or future widget/background tasks).

import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
} from '@notifee/react-native';
import type { TimeOfDay } from '../types';
import { storage } from '../store/mmkv';

const CHANNEL_ID = 'water-reminder';
const NOTIFICATION_ID_PREFIX = 'water-reminder-';
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
