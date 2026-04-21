// Analytics client: wraps mixpanel-react-native v3 with a memoized init,
// bounded pre-init queue, and the public API surface exported from ./index.ts.
// See docs/superpowers/specs/2026-04-21-mixpanel-analytics-design.md.

import { Platform } from 'react-native';
import { Mixpanel } from 'mixpanel-react-native';
import DeviceInfo from 'react-native-device-info';
import { mmkv } from '../../store/mmkv';
import { MIXPANEL_TOKEN, MIXPANEL_SERVER_URL } from '../../config';
import {
  type EventName,
  type SuperProperties,
  type TrackArgs,
  filterProfileUpdateValues,
} from './events';
import { checkPii } from './privacy';

// ----- Module singletons -----

const mixpanel = new Mixpanel(MIXPANEL_TOKEN, false); // auto-events OFF

let initPromise: Promise<void> | null = null;
let initialized = false;

// ----- Pre-init queue -----

type QueuedCall =
  | { kind: 'track'; name: EventName; props?: Record<string, unknown> }
  | { kind: 'identify'; distinctId: string }
  | { kind: 'timeEvent'; name: EventName }
  | { kind: 'registerSuperProperties'; props: Partial<SuperProperties> }
  | { kind: 'incrementProperty'; prop: string; by: number }
  | { kind: 'syncUserProfile'; profile: Record<string, unknown> }
  | { kind: 'syncSessionProperties' };

const QUEUE_CAP = 50;
const QUEUE_TIMEOUT_MS = 10_000;
let queue: QueuedCall[] = [];
let queueTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
let queueOverflowWarned = false;

function enqueue(call: QueuedCall): void {
  if (queue.length >= QUEUE_CAP) {
    queue.shift();
    if (__DEV__ && !queueOverflowWarned) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] pre-init queue overflow — oldest events dropped');
      queueOverflowWarned = true;
    }
  }
  queue.push(call);
  if (queueTimeoutHandle === null) {
    queueTimeoutHandle = setTimeout(() => {
      // Drain without dispatching — local in-memory discard, does NOT flip MMKV opt-out.
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] pre-init queue 10s timeout — drained without dispatching');
      }
      queue = [];
      queueOverflowWarned = false;
      queueTimeoutHandle = null;
    }, QUEUE_TIMEOUT_MS);
  }
}

function clearQueueTimer(): void {
  if (queueTimeoutHandle !== null) {
    clearTimeout(queueTimeoutHandle);
    queueTimeoutHandle = null;
  }
}

export function drainPreInitQueue(opts: { discard: boolean }): void {
  clearQueueTimer();
  const toFlush = queue;
  queue = [];
  queueOverflowWarned = false;
  if (opts.discard) return;
  for (const call of toFlush) dispatch(call);
}

// Uses raw mixpanel instance methods (not the public `track` / `identify` / etc.
// exports) because during queue drainage `initialized` is still false — the
// public API would re-enqueue, causing infinite recursion. This function runs
// only from the init path after `mixpanel.init()` resolves but before
// `initialized = true` is set.
function dispatch(call: QueuedCall): void {
  switch (call.kind) {
    case 'track': {
      const merged = { ...baseEventProps(), ...(call.props ?? {}) };
      mixpanel.track(call.name, merged);
      break;
    }
    case 'identify':
      mixpanel.identify(call.distinctId);
      break;
    case 'timeEvent':
      mixpanel.timeEvent(call.name);
      break;
    case 'registerSuperProperties':
      mixpanel.registerSuperProperties(call.props);
      break;
    case 'incrementProperty':
      mixpanel.getPeople().increment(call.prop, call.by);
      break;
    case 'syncUserProfile':
      applySyncUserProfile(call.profile);
      break;
    case 'syncSessionProperties':
      applySyncSessionProperties();
      break;
  }
}

// ----- Base / session props -----

function baseEventProps(): { app_version: string; build_number: string } {
  return {
    app_version: DeviceInfo.getVersion(),
    build_number: DeviceInfo.getBuildNumber(),
  };
}

function installedAt(): number {
  const existing = mmkv.getNumber('analytics:installedAt');
  if (existing && existing > 0) return existing;
  const now = Date.now();
  mmkv.set('analytics:installedAt', now);
  return now;
}

function daysSinceInstall(): number {
  return Math.floor((Date.now() - installedAt()) / 86_400_000);
}

function currentStreakDays(): number {
  const { useHistoryStore } = require('../../store/useHistoryStore');
  return useHistoryStore.getState().getCurrentStreak();
}

function hasHealthPermission(): boolean {
  try {
    const { getHealthPermissionStatus } = require('../../utils/healthService');
    return getHealthPermissionStatus();
  } catch {
    return false;
  }
}

// ----- Profile field picker -----

type ProfileFields = {
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'moderate' | 'active';
  climatePreference: 'cold' | 'temperate' | 'hot' | 'tropical';
  wakeUpTime: { hour: number; minute: number };
  sleepTime: { hour: number; minute: number };
  dailyGoal: number;
};

function pickProfileFields(state: Record<string, unknown>): ProfileFields {
  return {
    weight: state.weight as number,
    age: state.age as number,
    gender: state.gender as ProfileFields['gender'],
    activityLevel: state.activityLevel as ProfileFields['activityLevel'],
    climatePreference: state.climatePreference as ProfileFields['climatePreference'],
    wakeUpTime: state.wakeUpTime as ProfileFields['wakeUpTime'],
    sleepTime: state.sleepTime as ProfileFields['sleepTime'],
    dailyGoal: state.dailyGoal as number,
  };
}

function mapUserProfileToSuperProps(p: ProfileFields): Record<string, unknown> {
  const fmt = (t: { hour: number; minute: number }) =>
    `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  return {
    weight_kg: p.weight,
    age: p.age,
    gender: p.gender,
    activity_level: p.activityLevel,
    climate: p.climatePreference,
    wake_time: fmt(p.wakeUpTime),
    sleep_time: fmt(p.sleepTime),
    daily_goal_ml: p.dailyGoal,
  };
}

function applySyncUserProfile(profile: Record<string, unknown>): void {
  mixpanel.registerSuperProperties(profile);
  mixpanel.getPeople().set(profile);
}

function applySyncSessionProperties(): void {
  const props: Partial<SuperProperties> = {
    app_version: baseEventProps().app_version,
    build_number: baseEventProps().build_number,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    days_since_install: daysSinceInstall(),
    current_streak_days: currentStreakDays(),
    has_health_permission: hasHealthPermission(),
    streak_rule_version: 'v2_80pct',
  };
  mixpanel.registerSuperProperties(props);
}

// ----- Init -----

function doInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const optedOut = mmkv.getBoolean('analytics:optedOut') ?? false;

    // Touch installedAt to write it if missing (side-effect of the getter).
    installedAt();

    if (MIXPANEL_SERVER_URL) {
      await mixpanel.init(optedOut, {}, MIXPANEL_SERVER_URL);
    } else {
      await mixpanel.init(optedOut);
    }
    mixpanel.setLoggingEnabled(__DEV__);

    drainPreInitQueue({ discard: optedOut });

    applySyncSessionProperties();

    const { useUserStore } = require('../../store/useUserStore');
    if (useUserStore.getState().onboardingComplete) {
      applySyncUserProfile(mapUserProfileToSuperProps(pickProfileFields(useUserStore.getState())));
    }

    initialized = true;
  })();
  return initPromise;
}

export async function initAnalytics(): Promise<void> {
  await doInit();
  track('App Opened', {
    days_since_install: daysSinceInstall(),
    session_source: 'cold',
  });
}

export async function initAnalyticsForBackground(): Promise<void> {
  await doInit();
  // no App Opened — background entry
}

// ----- Public API -----

export function track<K extends EventName>(...args: TrackArgs<K>): void {
  const name = args[0];
  const props = args.length > 1 ? (args[1] as Record<string, unknown>) : undefined;

  // Profile Updated runtime allowlist — drop disallowed fields before dispatch.
  let finalProps = props;
  if (name === 'Profile Updated' && props) {
    const raw = props as { fields_changed: string[]; values: Record<string, unknown> };
    finalProps = {
      fields_changed: raw.fields_changed,
      values: filterProfileUpdateValues(raw.values ?? {}),
    };
  }

  if (__DEV__) checkPii(name, finalProps);

  if (!initialized) {
    enqueue({ kind: 'track', name, props: finalProps });
    return;
  }
  const merged = { ...baseEventProps(), ...(finalProps ?? {}) };
  mixpanel.track(name, merged);
}

export async function identify(distinctId: string): Promise<void> {
  if (!initialized) { enqueue({ kind: 'identify', distinctId }); return; }
  await mixpanel.identify(distinctId);
}

export async function alias(aliasId: string, distinctId?: string): Promise<void> {
  await doInit();
  const currentId = distinctId ?? (await mixpanel.getDistinctId());
  mixpanel.alias(aliasId, currentId);
}

export function timeEvent<K extends EventName>(name: K): void {
  if (!initialized) { enqueue({ kind: 'timeEvent', name }); return; }
  mixpanel.timeEvent(name);
}

export function registerSuperProperties(props: Partial<SuperProperties>): void {
  if (!initialized) { enqueue({ kind: 'registerSuperProperties', props }); return; }
  mixpanel.registerSuperProperties(props);
}

export function incrementProperty(prop: string, by = 1): void {
  if (!initialized) { enqueue({ kind: 'incrementProperty', prop, by }); return; }
  mixpanel.getPeople().increment(prop, by);
}

export function syncUserProfile(profile: ProfileFields): void {
  const mapped = mapUserProfileToSuperProps(profile);
  if (!initialized) { enqueue({ kind: 'syncUserProfile', profile: mapped }); return; }
  applySyncUserProfile(mapped);
}

export function syncSessionProperties(): void {
  if (!initialized) { enqueue({ kind: 'syncSessionProperties' }); return; }
  applySyncSessionProperties();
}

// ----- Opt-out plumbing -----

export async function optOut(): Promise<void> {
  await doInit();
  await mixpanel.flush(); // LOAD-BEARING: optOutTracking deletes unflushed events
  mmkv.set('analytics:optedOut', true);
  mixpanel.optOutTracking();
  await mixpanel.reset();
}

export function optIn(): void {
  mmkv.remove('analytics:optedOut');
  mixpanel.optInTracking();
  syncSessionProperties();
  const { useUserStore } = require('../../store/useUserStore');
  if (useUserStore.getState().onboardingComplete) {
    syncUserProfile(pickProfileFields(useUserStore.getState()));
  }
  const { resetScreenTrackingState } = require('./screenTracking');
  resetScreenTrackingState();
}

export async function hasOptedOut(): Promise<boolean> {
  return (mmkv.getBoolean('analytics:optedOut') ?? false);
}

export async function reset(): Promise<void> {
  await doInit();
  await mixpanel.reset();
}

export async function flush(): Promise<void> {
  await doInit();
  await mixpanel.flush();
}

// ----- Test-only reset hook -----
// Not exported from index.ts. Tests import directly from './client'.
export function __resetForTests(): void {
  initPromise = null;
  initialized = false;
  queue = [];
  queueOverflowWarned = false;
  clearQueueTimer();
}

// Exported for tests that need the singleton reference.
export { mixpanel as __mixpanelForTests };
