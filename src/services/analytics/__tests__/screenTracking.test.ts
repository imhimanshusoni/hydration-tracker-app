jest.mock('../client', () => ({ track: jest.fn() }));

import { track } from '../client';
import { onNavigationStateChange, resetScreenTrackingState } from '../screenTracking';

const mockTrack = track as unknown as jest.Mock;

function state(name: string): any {
  return { index: 0, routes: [{ name }] };
}

describe('screenTracking', () => {
  beforeEach(() => {
    resetScreenTrackingState();
    mockTrack.mockClear();
  });

  it('fires once per distinct route', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('dedups identical consecutive routes any time', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Home'), () => 5000);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('dedups rapid same-route within 500ms', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Home'), () => 1100);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('first event has previous_screen: null (cold start)', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    expect(mockTrack).toHaveBeenCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Home', previous_screen: null }),
    );
  });

  it('previous_screen chains correctly', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    expect(mockTrack).toHaveBeenLastCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Settings', previous_screen: 'Home' }),
    );
  });

  it('resetScreenTrackingState returns to cold-start state', () => {
    onNavigationStateChange(state('Home'), () => 1000);
    onNavigationStateChange(state('Settings'), () => 2000);
    resetScreenTrackingState();
    onNavigationStateChange(state('Settings'), () => 3000);
    expect(mockTrack).toHaveBeenLastCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Settings', previous_screen: null }),
    );
  });

  it('handles nested nav state (tabs inside stack)', () => {
    const nested = { index: 0, routes: [{ name: 'Root', state: { index: 0, routes: [{ name: 'Home' }] } }] };
    onNavigationStateChange(nested, () => 1000);
    expect(mockTrack).toHaveBeenCalledWith(
      'Screen Viewed',
      expect.objectContaining({ screen_name: 'Home' }),
    );
  });
});
