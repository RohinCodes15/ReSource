import { lookupZip } from '../state/stores';

describe('lookupZip', () => {
  it('finds a Fremont ZIP code, with or without the +4 part', () => {
    const plain = lookupZip('94538');
    expect(plain.ok && plain.location.zip).toBe('94538');
    expect(plain.ok && plain.location.area).toBe('94538');
    const plusFour = lookupZip(' 94538-1234 ');
    expect(plusFour.ok && plusFour.location.zip).toBe('94538');
  });

  it('says why a ZIP code was not accepted', () => {
    expect(lookupZip('9453')).toEqual({ ok: false, reason: 'format' });
    expect(lookupZip('abcde')).toEqual({ ok: false, reason: 'format' });
    expect(lookupZip('94102')).toEqual({ ok: false, reason: 'outside' }); // San Francisco
  });
});
