module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-svg|@notifee|react-native-mmkv|react-native-health|react-native-health-connect|react-native-geolocation-service|react-native-config)/)',
  ],
  moduleNameMapper: {
    'react-native-config': '<rootDir>/__mocks__/react-native-config.js',
  },
};
