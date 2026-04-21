// Jest mock for mixpanel-react-native. All methods are jest.fn() spies so tests can
// assert calls without a native module. The People sub-API is a fresh spied object
// per call to getPeople() so .set / .increment / etc. are tracked.

const peopleInstance = {
  set: jest.fn(),
  setOnce: jest.fn(),
  increment: jest.fn(),
  append: jest.fn(),
  union: jest.fn(),
  remove: jest.fn(),
  unset: jest.fn(),
  trackCharge: jest.fn(),
  deleteUser: jest.fn(),
};

class Mixpanel {
  constructor(token, trackAutomaticEvents) {
    this.token = token;
    this.trackAutomaticEvents = trackAutomaticEvents;
  }
  init = jest.fn().mockResolvedValue(undefined);
  setLoggingEnabled = jest.fn();
  track = jest.fn();
  identify = jest.fn().mockResolvedValue(undefined);
  alias = jest.fn().mockResolvedValue(undefined);
  reset = jest.fn().mockResolvedValue(undefined);
  flush = jest.fn().mockResolvedValue(undefined);
  timeEvent = jest.fn();
  eventElapsedTime = jest.fn().mockResolvedValue(0);
  registerSuperProperties = jest.fn();
  registerSuperPropertiesOnce = jest.fn();
  getSuperProperties = jest.fn().mockResolvedValue({});
  unregisterSuperProperty = jest.fn();
  clearSuperProperties = jest.fn();
  optInTracking = jest.fn();
  optOutTracking = jest.fn();
  hasOptedOutTracking = jest.fn().mockResolvedValue(false);
  getDistinctId = jest.fn().mockResolvedValue('mock-distinct-id');
  getDeviceId = jest.fn().mockResolvedValue('mock-device-id');
  getPeople = jest.fn(() => peopleInstance);
}

function __resetMocks() {
  [
    peopleInstance.set, peopleInstance.setOnce, peopleInstance.increment, peopleInstance.append,
    peopleInstance.union, peopleInstance.remove, peopleInstance.unset, peopleInstance.trackCharge,
    peopleInstance.deleteUser,
  ].forEach((fn) => fn.mockClear());
}

module.exports = { Mixpanel, __resetMocks };
