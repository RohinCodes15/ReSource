import { gateState, isOpenPath } from '../components/AccountGate';
import { effectiveAccountRequired } from '../lib/supabase';

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

describe('effectiveAccountRequired', () => {
  it('follows the API when it answers, in a build with the flag', () => {
    expect(effectiveAccountRequired(true, true)).toBe(true);
    expect(effectiveAccountRequired(true, false)).toBe(false);
  });

  it('falls back to the build flag when the API has not said', () => {
    expect(effectiveAccountRequired(true, null)).toBe(true);
    expect(effectiveAccountRequired(true, undefined)).toBe(true);
    expect(effectiveAccountRequired(false, null)).toBe(false);
  });

  it('cannot be turned on by the API in a build without the flag', () => {
    expect(effectiveAccountRequired(false, true)).toBe(false);
  });
});

describe('gateState while the API has not answered', () => {
  it('waits instead of showing the welcome screen', () => {
    expect(gateState({ ...base, signedIn: false, checking: true })).toBe('loading');
  });
});
