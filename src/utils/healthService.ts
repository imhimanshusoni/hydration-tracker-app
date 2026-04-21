// Platform-abstracted health data service.
// iOS: Apple HealthKit via @kingstinct/react-native-healthkit
// Android: Health Connect via react-native-health-connect

import { Platform } from 'react-native';
import { track, syncSessionProperties } from '../services/analytics';

// Module-scope cached boolean — written by permission-prompt + status-check paths.
// Read synchronously by analytics syncSessionProperties() and never prompts natively.
let healthPermissionCache = false;

export function getHealthPermissionStatus(): boolean {
  return healthPermissionCache;
}

function updateHealthPermissionCache(granted: boolean): void {
  const changed = healthPermissionCache !== granted;
  healthPermissionCache = granted;
  if (changed) syncSessionProperties();
}

// ----- iOS (HealthKit) -----

async function iosRequestPermissions(): Promise<boolean> {
  try {
    const { requestAuthorization } =
      require('@kingstinct/react-native-healthkit');
    await requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierAppleExerciseTime',
      ],
    });
    return true;
  } catch {
    return false;
  }
}

async function iosGetActiveMinutes(): Promise<number> {
  try {
    const { queryQuantitySamples } =
      require('@kingstinct/react-native-healthkit');
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const samples: Array<{ quantity: number }> = await queryQuantitySamples(
      'HKQuantityTypeIdentifierAppleExerciseTime',
      {
        unit: 'min',
        filter: {
          date: {
            startDate: startOfDay,
            endDate: now,
          },
        },
      },
    );

    const total = samples.reduce((sum, s) => sum + (s.quantity || 0), 0);
    return Math.round(total);
  } catch {
    return 0;
  }
}

// ----- Android (Health Connect) -----

async function androidRequestPermissions(): Promise<boolean> {
  try {
    const { initialize, getSdkStatus, requestPermission, SdkAvailabilityStatus } =
      require('react-native-health-connect');

    const isInitialized = await initialize();
    if (!isInitialized) return false;

    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;

    const grantedPermissions = await requestPermission([
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    if (!grantedPermissions || grantedPermissions.length === 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function androidGetActiveMinutes(): Promise<number> {
  try {
    const { readRecords } = require('react-native-health-connect');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { records } = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });

    let totalMinutes = 0;
    for (const session of records) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      totalMinutes += (end - start) / 60000;
    }
    return Math.round(totalMinutes);
  } catch {
    return 0;
  }
}

// ----- Public API -----

export function isHealthAvailable(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    try {
      const { SdkAvailabilityStatus } = require('react-native-health-connect');
      // SDK_AVAILABLE check is async, but for a quick sync guard we return true
      // and let the actual async calls handle unavailability gracefully.
      return SdkAvailabilityStatus !== undefined;
    } catch {
      return false;
    }
  }
  return false;
}

export async function checkHealthPermissions(): Promise<boolean> {
  let granted = false;
  if (Platform.OS === 'ios') {
    // HealthKit doesn't expose a pure status-only API — requestAuthorization
    // re-prompts in some contexts. Instead, try a lightweight sample query:
    // success ⇒ permission granted, failure ⇒ not granted.
    try {
      const { queryQuantitySamples } = require('@kingstinct/react-native-healthkit');
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      await queryQuantitySamples('HKQuantityTypeIdentifierAppleExerciseTime', {
        unit: 'min',
        filter: { date: { startDate: startOfDay, endDate: now } },
      });
      granted = true;
    } catch {
      granted = false;
    }
  } else if (Platform.OS === 'android') {
    try {
      const { initialize, getGrantedPermissions } = require('react-native-health-connect');
      const isInitialized = await initialize();
      if (isInitialized) {
        const granted_perms = await getGrantedPermissions();
        const needed = ['ActiveCaloriesBurned', 'ExerciseSession'];
        granted = needed.every((rt) =>
          granted_perms.some((p: { recordType: string; accessType: string }) =>
            p.recordType === rt && p.accessType === 'read',
          ),
        );
      }
    } catch {
      granted = false;
    }
  }
  updateHealthPermissionCache(granted);
  return granted;
}

export async function requestHealthPermissions(): Promise<boolean> {
  const platform = Platform.OS === 'ios' ? ('healthkit' as const) : ('health_connect' as const);
  track('Health Permission Prompted', { platform });
  let granted = false;
  if (Platform.OS === 'ios') granted = await iosRequestPermissions();
  else if (Platform.OS === 'android') granted = await androidRequestPermissions();
  updateHealthPermissionCache(granted);
  track('Health Permission Result', { platform, granted });
  return granted;
}

export async function getTodayActiveMinutes(): Promise<number> {
  let minutes = 0;
  if (Platform.OS === 'ios') minutes = await iosGetActiveMinutes();
  else if (Platform.OS === 'android') minutes = await androidGetActiveMinutes();
  // bump_ml is computed inside useGoalStore.applyActivityBump — we don't know
  // the bump here. Emit 0 and see docs/analytics.md Known gaps for the planned
  // fix (move emission into useGoalStore).
  track('Activity Sync Completed', { active_minutes: minutes, bump_ml: 0 });
  return minutes;
}
