/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Required by Notifee: notifications scheduled with pressAction invoke a
// headless JS task on tap when the app is backgrounded/killed. Without a
// registered handler, Android crashes on notification tap.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    // Tapping brings the app to foreground; no extra work needed.
  }
});

AppRegistry.registerComponent(appName, () => App);
