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
    getBoolean: jest.fn(),
    remove: jest.fn(),
  }),
}));

jest.mock('../src/services/analytics', () => ({
  initAnalytics: jest.fn().mockResolvedValue(undefined),
  initAnalyticsForBackground: jest.fn().mockResolvedValue(undefined),
  track: jest.fn(),
  syncUserProfile: jest.fn(),
  syncSessionProperties: jest.fn(),
  markUserCreated: jest.fn(),
  onNavigationStateChange: jest.fn(),
  resetScreenTrackingState: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
}));

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
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: {TIMESTAMP: 0},
  AndroidImportance: {DEFAULT: 3, HIGH: 4},
  EventType: {DELIVERED: 3, PRESS: 1, DISMISSED: 0, ACTION_PRESS: 2},
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

jest.mock('@kingstinct/react-native-healthkit', () => ({
  requestAuthorization: jest.fn().mockResolvedValue(true),
  queryQuantitySamples: jest.fn().mockResolvedValue([]),
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
