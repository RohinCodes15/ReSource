import { bundledResources, bundledServices } from '../data';
import { type CardLabels, impactCardHtml, impactCardText, INTERESTS, isInterest, whatChangedForMe } from '../utils/forMe';

const labels: CardLabels = {
  title: 'My impact card',
  area: 'Area: 94538',
  date: 'Made on Oct 13, 2026',
  footer: 'No personal information is on this card.',
  englishNote: 'Shown in English.',
  noChange: 'No change found.',
  noData: 'No entry.',
  source: (title) => `Source: ${title}`,
  section: (key) => `Section ${key}`,
  status: (service) => service.status,
  amount: (service) => (service.cut_amount != null ? `$${service.cut_amount}` : 'No amount published.'),
  since: (service) => service.effective_date ?? 'No date published.',
};

describe('whatChangedForMe', () => {
  it('always adds the section that affects everyone, after the chosen interests', () => {
    expect(whatChangedForMe(bundledServices, bundledResources, null, []).map((s) => s.key)).toEqual(['everyone']);
    expect(whatChangedForMe(bundledServices, bundledResources, null, ['parks', 'kids']).map((s) => s.key)).toEqual(['kids', 'parks', 'everyone']);
  });

  it('separates reduced services from ones with no change found, using only the data', () => {
    const [kids, parks] = whatChangedForMe(bundledServices, bundledResources, null, ['kids', 'parks']);
    expect(kids.changed).toEqual([]);
    expect(kids.unchanged.map((s) => s.id)).toEqual(['svc-youth-family']);
    expect(parks.changed.map((s) => s.id)).toEqual(['svc-park-median']);
    expect(parks.noData).toBe(false);
  });

  it('every service it returns carries a source', () => {
    for (const section of whatChangedForMe(bundledServices, bundledResources, '94538', [...INTERESTS])) {
      for (const service of [...section.changed, ...section.unchanged]) {
        expect(service.source_title).toBeTruthy();
        expect(service.source_url).toMatch(/^https:\/\//);
      }
    }
  });

  it('says so when the data has nothing on a topic', () => {
    const withoutParks = bundledServices.filter((s) => s.category !== 'parks');
    expect(whatChangedForMe(withoutParks, bundledResources, null, ['parks'])[0]).toMatchObject({ noData: true, changed: [], unchanged: [] });
  });

  it('puts services located in the chosen area first', () => {
    const everyone = whatChangedForMe(bundledServices, bundledResources, '94538', []).at(-1);
    expect(everyone?.changed[0].area).toBe('94538');
  });

  it('recognizes interest names', () => {
    expect(isInterest('kids')).toBe(true);
    expect(isInterest('money')).toBe(false);
  });
});

describe('impact card', () => {
  const sections = whatChangedForMe(bundledServices, bundledResources, '94538', ['parks', 'kids']);

  it('lists each change with its source and the no-change note', () => {
    const html = impactCardHtml(sections, labels, { lang: 'en', rtl: false });
    expect(html).toContain('Park and street-median capital replacement');
    expect(html).toContain('Source: ');
    expect(html).toContain('https://');
    expect(html).toContain('No change found.');
    expect(html).toContain('No personal information is on this card.');
    expect(impactCardText(sections, labels)).toContain('SECTION PARKS');
  });

  it('escapes text and sets the direction for right-to-left languages', () => {
    const odd = [{ ...sections[1], changed: [{ ...sections[1].changed[0], name: '<script>alert(1)</script>', source_url: 'javascript:alert(1)' }] }];
    const html = impactCardHtml(odd, labels, { lang: 'fa', rtl: true });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('dir="rtl"');
  });
});
