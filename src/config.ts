// App configuration constants

import Config from 'react-native-config';

export const OPENWEATHERMAP_API_KEY = Config.OPENWEATHERMAP_API_KEY ?? '';

export const MIXPANEL_TOKEN = Config.MIXPANEL_TOKEN ?? '';

// Empty ≡ use Mixpanel's default (US) endpoint. EU projects set this in .env:
//   MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com
export const MIXPANEL_SERVER_URL = (Config.MIXPANEL_SERVER_URL ?? '').trim() || undefined;

export const MIN_GOAL_ML = 1500;
export const MAX_GOAL_ML = 5000;
export const ACTIVITY_BUMP_INTERVAL_MIN = 30;
export const ACTIVITY_BUMP_ML = 350;
