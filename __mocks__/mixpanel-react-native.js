// Jest mock for mixpanel-react-native. The Mixpanel constructor is a jest.fn
// so tests can read `Mixpanel.mock.instances` directly. Every method on each
// instance is a jest.fn() spy — tests can assert calls without a native module.

function makePeople() {
  return {
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
}

function makeInstance() {
  const people = makePeople();
  return {
    init: jest.fn().mockResolvedValue(undefined),
    setLoggingEnabled: jest.fn(),
    track: jest.fn(),
    identify: jest.fn().mockResolvedValue(undefined),
    alias: jest.fn(),
    reset: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
    timeEvent: jest.fn(),
    eventElapsedTime: jest.fn().mockResolvedValue(0),
    registerSuperProperties: jest.fn(),
    registerSuperPropertiesOnce: jest.fn(),
    getSuperProperties: jest.fn().mockResolvedValue({}),
    unregisterSuperProperty: jest.fn(),
    clearSuperProperties: jest.fn(),
    optInTracking: jest.fn(),
    optOutTracking: jest.fn(),
    hasOptedOutTracking: jest.fn().mockResolvedValue(false),
    getDistinctId: jest.fn().mockResolvedValue('mock-distinct-id'),
    getDeviceId: jest.fn().mockResolvedValue('mock-device-id'),
    getPeople: jest.fn(() => people),
  };
}

const Mixpanel = jest.fn().mockImplementation(function (token, trackAutomaticEvents) {
  const inst = makeInstance();
  inst.token = token;
  inst.trackAutomaticEvents = trackAutomaticEvents;
  Object.assign(this, inst);
});

function __resetMocks() {
  // Clears method-spy call history on the most recent instance. Do NOT call
  // Mixpanel.mockClear() here — that would wipe mock.instances, but the client.ts
  // singleton was already constructed at module load time and never recreated.
  const inst = Mixpanel.mock.instances[Mixpanel.mock.instances.length - 1];
  if (!inst) return;
  for (const key of Object.keys(inst)) {
    const v = inst[key];
    if (v && typeof v.mockClear === 'function') v.mockClear();
  }
  const people = inst.getPeople ? inst.getPeople() : null;
  if (people) {
    for (const key of Object.keys(people)) {
      const v = people[key];
      if (v && typeof v.mockClear === 'function') v.mockClear();
    }
  }
}

module.exports = { Mixpanel, __resetMocks };
