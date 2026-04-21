import { checkPii } from '../privacy';

describe('checkPii (dev-only PII guard)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns on email-ish key', () => {
    checkPii('Test Event', { user_email: 'x' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('email in property key'));
  });

  it('warns on phone key', () => {
    checkPii('Test Event', { phone_number: '555' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('phone in property key'));
  });

  it('warns on password key', () => {
    checkPii('Test Event', { user_password: 'hunter2' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('password in property key'));
  });

  it('does NOT warn on name key (allowed by product decision for user identification)', () => {
    checkPii('Test Event', { name: 'Alice' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn on name-like but compound key (e.g. "activity_level")', () => {
    checkPii('Test Event', { activity_level: 'moderate', daily_goal_ml: 2800 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns on email-like string value', () => {
    checkPii('Test Event', { contact: 'user@example.com' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('email-like string'));
  });

  it('silent on clean props', () => {
    checkPii('Water Logged', { amount_ml: 250, source: 'quick', is_first_log_of_day: true });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('silent when props is undefined', () => {
    checkPii('Onboarding Started');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
