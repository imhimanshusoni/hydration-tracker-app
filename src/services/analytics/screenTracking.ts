import type { NavigationState, PartialState } from '@react-navigation/native';
import { track } from './client';

let previousScreen: string | null = null;
let lastScreenName: string | null = null;
let lastScreenAt = 0;
const SAME_ROUTE_DEDUP_MS = 500;

function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | null {
  if (!state) return null;
  const index = (state as NavigationState).index ?? 0;
  const route = state.routes?.[index];
  if (!route) return null;
  if ('state' in route && route.state) {
    return getActiveRouteName(route.state as NavigationState);
  }
  return route.name ?? null;
}

export function onNavigationStateChange(
  state: NavigationState | PartialState<NavigationState> | undefined,
  nowFn: () => number = () => Date.now(),
): void {
  const current = getActiveRouteName(state);
  if (!current) return;
  const now = nowFn();
  if (current === lastScreenName && now - lastScreenAt < SAME_ROUTE_DEDUP_MS) return;
  if (current === lastScreenName) return;
  track('Screen Viewed', { screen_name: current, previous_screen: previousScreen });
  previousScreen = current;
  lastScreenName = current;
  lastScreenAt = now;
}

export function resetScreenTrackingState(): void {
  previousScreen = null;
  lastScreenName = null;
  lastScreenAt = 0;
}
