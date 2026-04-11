/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

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
    requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    createTriggerNotification: jest.fn(),
    cancelNotification: jest.fn(),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  TriggerType: {TIMESTAMP: 0},
  AndroidImportance: {DEFAULT: 3},
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({children}: {children: React.ReactNode}) => children,
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({children}: {children: React.ReactNode}) => children,
    Screen: () => null,
  }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const MockPicker = () => null;
  MockPicker.default = MockPicker;
  return MockPicker;
});

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    requestAuthorization: jest.fn().mockResolvedValue('granted'),
  },
}));

jest.mock('react-native-health', () => ({
  __esModule: true,
  default: {
    initHealthKit: jest.fn((_perms: unknown, cb: (err: string | null) => void) => cb(null)),
    getAppleExerciseTime: jest.fn((_opts: unknown, cb: (err: object | null, results: Array<{value: number}>) => void) => cb(null, [])),
    Constants: {
      Permissions: {
        ActiveEnergyBurned: 'ActiveEnergyBurned',
        AppleExerciseTime: 'AppleExerciseTime',
      },
    },
  },
}));

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  getSdkStatus: jest.fn().mockResolvedValue(1),
  requestPermission: jest.fn().mockResolvedValue([]),
  readRecords: jest.fn().mockResolvedValue({ records: [] }),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 1, SDK_UNAVAILABLE: 2 },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
