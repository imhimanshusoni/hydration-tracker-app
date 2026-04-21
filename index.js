/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { useWaterStore } from './src/store/useWaterStore';
import { useGoalStore } from './src/store/useGoalStore';
import {
  initAnalyticsForBackground,
  track,
  flush,
} from './src/services/analytics';

// Android may spin up a fresh JS VM for the background handler. Analytics init
// and Zustand persist rehydration must complete before reading store state.
//
// persist.rehydrate() is LOAD-BEARING on fresh VMs, not merely defensive:
// useWaterStore uses createJSONStorage(() => zustandStorage), whose interface
// is async. Even though MMKV itself is synchronous, the persist middleware
// schedules hydration asynchronously (microtask). Calling useWaterStore.getState()
// immediately after module load returns the initial defaults, not the persisted
// values. Awaiting rehydrate() is the only way to guarantee persisted state
// is loaded before we read consumed / goal.
//
// iOS typically runs this in the foreground VM, where rehydration completed
// during app startup and initAnalyticsForBackground() is a cheap no-op (memoized
// promise). The rehydrate() await is still safe there — Zustand treats repeat
// calls as idempotent.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.DELIVERED && type !== EventType.PRESS) return;

  await initAnalyticsForBackground();

  if (type === EventType.DELIVERED) {
    await useWaterStore.persist.rehydrate();
    const consumed = useWaterStore.getState().consumed;
    const goal = useGoalStore.getState().effectiveGoal;
    const scheduledHour = parseReminderHour(detail.notification?.data);
    track('Reminder Delivered', {
      scheduled_hour: scheduledHour,
      consumed_ml: consumed,
      goal_ml: goal,
    });
    await flush();
    return;
  }

  // PRESS
  const scheduledHour = parseReminderHour(detail.notification?.data);
  track('Reminder Tapped', { scheduled_hour: scheduledHour });
  await flush();
});

function parseReminderHour(data) {
  if (!data || typeof data !== 'object') return -1;
  const h = data.hour;
  const n = typeof h === 'string' ? parseInt(h, 10) : typeof h === 'number' ? h : NaN;
  return Number.isFinite(n) ? n : -1;
}

AppRegistry.registerComponent(appName, () => App);
