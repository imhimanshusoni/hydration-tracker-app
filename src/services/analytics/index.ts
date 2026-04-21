export {
  initAnalytics,
  initAnalyticsForBackground,
  track,
  identify,
  alias,
  timeEvent,
  registerSuperProperties,
  incrementProperty,
  syncUserProfile,
  syncSessionProperties,
  optIn,
  optOut,
  hasOptedOut,
  reset,
  flush,
} from './client';

export { onNavigationStateChange, resetScreenTrackingState } from './screenTracking';

export type { EventName, EventMap, SuperProperties, TrackArgs, BaseEventProps } from './events';
