import { gateState, isOpenPath } from '../components/AccountGate';

const base = { required: true, configured: true, ready: true, signedIn: true, offline: false, open: false };

describe('gateState', () => {
  it('never gets in the way when the account-required flag is off', () => {
    expect(gateState({ ...base, required: false, signedIn: false, ready: false, configured: false, offline: true })).toBeNull();
  });

  it('lets a signed-in person through', () => {
    expect(gateState(base)).toBeNull();
  });

  it('sends a signed-out person to sign in, once the saved session has been checked', () => {
    expect(gateState({ ...base, signedIn: false, ready: false })).toBe('loading');
    expect(gateState({ ...base, signedIn: false })).toBe('redirect');
  });

  it('blocks use while offline, with no cached browsing', () => {
    expect(gateState({ ...base, offline: true })).toBe('offline');
  });

  it('says so when sign-in is not configured', () => {
    expect(gateState({ ...base, configured: false })).toBe('notConfigured');
  });

  it('always shows the open pages', () => {
    expect(gateState({ ...base, signedIn: false, offline: true, configured: false, open: true })).toBeNull();
  });
});

describe('isOpenPath', () => {
  it('keeps the legal pages, sign-in and the admin passcode form open', () => {
    for (const path of ['/sign-in', '/privacy', '/terms', '/cookies', '/credits', '/data-request', '/admin', '/privacy/']) {
      expect(isOpenPath(path)).toBe(true);
    }
  });

  it('gates everything else', () => {
    for (const path of ['/', '/report', '/map', '/chat', '/settings', '/community']) {
      expect(isOpenPath(path)).toBe(false);
    }
  });
});
