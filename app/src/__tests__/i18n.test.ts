import { formatDate, formatMoney, LANGUAGES } from '../lib/i18n';

describe('formatDate', () => {
  it('formats a day, a month and a timestamp', () => {
    expect(formatDate('2026-03-30', 'en-US')).toBe('Mar 30, 2026');
    expect(formatDate('2026-03', 'en-US')).toBe('March 2026');
    expect(formatDate('2026-03-30T18:00:00Z', 'en-US')).toContain('2026');
  });

  it('returns what it was given when it is not a date, and nothing for nothing', () => {
    expect(formatDate('soon', 'en-US')).toBe('soon');
    expect(formatDate(null, 'en-US')).toBe('');
  });

  it('keeps Dari dates in the Gregorian calendar with Western digits', () => {
    const dari = LANGUAGES.find((language) => language.code === 'fa');
    expect(formatDate('2026-03-30', dari?.locale ?? '')).toMatch(/2026/);
  });
});

describe('formatMoney', () => {
  it('shortens large amounts', () => {
    expect(formatMoney(3_800_000)).toBe('$3.8M');
    expect(formatMoney(3_000_000)).toBe('$3M');
    expect(formatMoney(450_000)).toBe('$450K');
    expect(formatMoney(900)).toBe('$900');
  });
});
