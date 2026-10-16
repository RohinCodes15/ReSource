import { ACCOUNT_PRIVACY, ACCOUNT_TERMS, PRIVACY, TERMS } from '../legal/content';

const text = (sections: typeof PRIVACY) => JSON.stringify(sections);

describe('account-required legal text', () => {
  it('keeps every section, in the same order', () => {
    expect(ACCOUNT_PRIVACY.map((s) => s.heading)).toEqual(PRIVACY.map((s) => s.heading));
    expect(ACCOUNT_TERMS.map((s) => s.heading)).toEqual(TERMS.map((s) => s.heading));
  });

  it('replaces the sections whose facts change', () => {
    const privacy = text(ACCOUNT_PRIVACY);
    expect(privacy).toContain('You need an account to use ReSource');
    expect(privacy).toContain('resource.session');
    expect(privacy).toContain('not linked to your account');
    expect(privacy).toContain('Deleting an account is not yet available in the app');
    expect(privacy).toContain('cannot create an account');
    expect(privacy).not.toContain('without an account');
    expect(privacy).not.toContain('never need to sign in');
    expect(text(ACCOUNT_TERMS)).toContain('You need an account to use ReSource');
  });
});
