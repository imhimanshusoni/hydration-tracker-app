// Plain arrow functions — do NOT wrap in jest.fn() at module top level.
// Some Jest load paths evaluate manual mocks before the jest global is
// defined, which throws "jest is not defined". Tests that need to spy
// should use jest.spyOn(DeviceInfo, 'getVersion') inside the test body.
module.exports = {
  __esModule: true,
  default: {
    getVersion: () => '1.3.2',
    getBuildNumber: () => '7',
  },
  getVersion: () => '1.3.2',
  getBuildNumber: () => '7',
};
