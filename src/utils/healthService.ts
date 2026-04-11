// Platform-abstracted health data service.
// iOS: Apple HealthKit via react-native-health
// Android: Health Connect via react-native-health-connect

import { Platform } from 'react-native';

// ----- iOS (HealthKit) -----

function iosRequestPermissions(): Promise<boolean> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.AppleExerciseTime,
        ],
        write: [],
      },
    };
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        resolve(!error);
      });
    });
  } catch {
    return Promise.resolve(false);
  }
}

function iosGetActiveMinutes(): Promise<number> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const options = {
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
    };
    return new Promise((resolve) => {
      AppleHealthKit.getAppleExerciseTime(
        options,
        (err: object, results: Array<{ value: number }>) => {
          if (err || !results) {
            resolve(0);
            return;
          }
          const total = results.reduce((sum, r) => sum + (r.value || 0), 0);
          resolve(Math.round(total));
        },
      );
    });
  } catch {
    return Promise.resolve(0);
  }
}

// ----- Android (Health Connect) -----

async function androidRequestPermissions(): Promise<boolean> {
  try {
    const { initialize, getSdkStatus, requestPermission, openHealthConnectSettings, SdkAvailabilityStatus } =
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
      await openHealthConnectSettings();
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
  if (Platform.OS === 'ios') return iosRequestPermissions();
  if (Platform.OS === 'android') {
    try {
      const { initialize, getGrantedPermissions } = require('react-native-health-connect');
      const isInitialized = await initialize();
      if (!isInitialized) return false;

      const granted = await getGrantedPermissions();
      const needed = ['ActiveCaloriesBurned', 'ExerciseSession'];
      return needed.every((rt) =>
        granted.some((p: { recordType: string; accessType: string }) =>
          p.recordType === rt && p.accessType === 'read',
        ),
      );
    } catch {
      return false;
    }
  }
  return false;
}

export function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return iosRequestPermissions();
  if (Platform.OS === 'android') return androidRequestPermissions();
  return Promise.resolve(false);
}

export function getTodayActiveMinutes(): Promise<number> {
  if (Platform.OS === 'ios') return iosGetActiveMinutes();
  if (Platform.OS === 'android') return androidGetActiveMinutes();
  return Promise.resolve(0);
}
