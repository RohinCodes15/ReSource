/**
 * "What changed for me?": picks, from the service and resource data the app already has, the
 * entries that match what a person says they care about. Nothing here writes a sentence about
 * the budget: every claim shown is a row of the data with its own source, and where the data
 * has nothing the result says so (`noData`) instead of guessing.
 */
import type { AreaCode, Resource, Service } from '../../../shared/types';

export const INTERESTS = ['kids', 'seniors', 'transit', 'health', 'parks'] as const;
export type Interest = (typeof INTERESTS)[number];
export type SectionKey = Interest | 'everyone';

/** Service categories (shared/data/services.json) behind each interest. */
export const SERVICE_CATEGORIES: Record<SectionKey, string[]> = {
  kids: ['youth'],
  seniors: ['seniors'],
  // The data has no bus or train entries; street upkeep is the closest thing it has.
  transit: ['infrastructure'],
  health: ['human_services'],
  parks: ['parks'],
  everyone: ['public_safety', 'administration'],
};

/** Resource categories (shared/data/resources.json) offered as places that can help. */
export const RESOURCE_CATEGORIES: Record<SectionKey, string[]> = {
  kids: ['Community', 'Library'],
  seniors: ['Seniors'],
  transit: [],
  health: ['Health', 'Crisis'],
  parks: [],
  everyone: ['Referral'],
};

export type ForMeSection = {
  key: SectionKey;
  /** Services whose status is reduced or closed, ones located in the person's area first. */
  changed: Service[];
  /** Services the data lists as open, with no budget-related change found. */
  unchanged: Service[];
  resources: Resource[];
  /** True when the data has no service at all for this topic. */
  noData: boolean;
};

const MAX_RESOURCES = 3;

export function isInterest(value: string): value is Interest {
  return (INTERESTS as readonly string[]).includes(value);
}

/** True when a service sits in the person's own ZIP area (citywide services are not "local"). */
export const inMyArea = (service: Service, area: AreaCode | null | undefined) => !!area && area !== 'citywide' && service.area === area;

export function whatChangedForMe(services: Service[], resources: Resource[], area: AreaCode | null | undefined, interests: Interest[]): ForMeSection[] {
  const keys: SectionKey[] = [...INTERESTS.filter((interest) => interests.includes(interest)), 'everyone'];
  return keys.map((key) => {
    const mine = services
      .filter((service) => SERVICE_CATEGORIES[key].includes(service.category))
      // Local first, then newest change first, then by name so the order never shuffles.
      .sort((a, b) => Number(inMyArea(b, area)) - Number(inMyArea(a, area)) || (b.effective_date ?? '').localeCompare(a.effective_date ?? '') || a.name.localeCompare(b.name));
    return {
      key,
      changed: mine.filter((service) => service.status !== 'open'),
      unchanged: mine.filter((service) => service.status === 'open'),
      resources: resources.filter((resource) => RESOURCE_CATEGORIES[key].includes(resource.category)).slice(0, MAX_RESOURCES),
      noData: mine.length === 0,
    };
  });
}

// ---- The printable card ---------------------------------------------------------------------

/** Every piece of text on the card that is not data, already in the reader's language. */
export type CardLabels = {
  title: string;
  area: string;
  date: string;
  footer: string;
  englishNote: string;
  noChange: string;
  noData: string;
  source: (title: string) => string;
  section: (key: SectionKey) => string;
  status: (service: Service) => string;
  amount: (service: Service) => string;
  since: (service: Service) => string;
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
/** Only http(s) links are written into the card. */
const safeUrl = (url: string | null) => (url && /^https?:\/\//i.test(url) ? url : null);

/** One printable page. It holds an area and topics only: no name, address, position or device id. */
export function impactCardHtml(sections: ForMeSection[], labels: CardLabels, options: { lang: string; rtl: boolean }): string {
  const item = (service: Service) => {
    const url = safeUrl(service.source_url);
    const source = service.source_title ? escapeHtml(labels.source(service.source_title)) : '';
    return `<li><strong>${escapeHtml(service.name)}</strong> <span class="status">${escapeHtml(labels.status(service))}</span>
<p>${escapeHtml(service.summary)}</p>
<p class="fine">${escapeHtml(labels.amount(service))} ${escapeHtml(labels.since(service))}</p>
<p class="fine">${source}${url ? ` <span class="url">${escapeHtml(url)}</span>` : ''}</p></li>`;
  };
  const body = sections.map((section) => {
    const rows = section.changed.map(item).join('');
    const note = section.noData ? labels.noData : section.changed.length === 0 ? labels.noChange : '';
    return `<section><h2>${escapeHtml(labels.section(section.key))}</h2>${note ? `<p>${escapeHtml(note)}</p>` : ''}${rows ? `<ul>${rows}</ul>` : ''}</section>`;
  }).join('');
  return `<!doctype html><html lang="${escapeHtml(options.lang)}" dir="${options.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(labels.title)}</title>
<style>
@page { size: letter; margin: 14mm; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0F172A; font-size: 10.5pt; line-height: 1.35; margin: 0; }
h1 { font-size: 18pt; margin: 0; color: #1B3A6B; border-bottom: 3px solid #F5A623; padding-bottom: 4pt; }
h2 { font-size: 12pt; margin: 10pt 0 2pt; color: #1B3A6B; }
p { margin: 2pt 0; } ul { margin: 2pt 0; padding-inline-start: 14pt; } li { margin-bottom: 5pt; break-inside: avoid; }
.status { border: 1px solid #0F172A; border-radius: 8pt; padding: 0 5pt; font-size: 8.5pt; }
.fine { font-size: 8.5pt; color: #334155; } .url { word-break: break-all; }
footer { margin-top: 10pt; border-top: 1px solid #CBD5E1; padding-top: 4pt; font-size: 8.5pt; color: #334155; }
</style></head><body>
<h1>${escapeHtml(labels.title)}</h1>
<p class="fine">${escapeHtml(labels.area)} · ${escapeHtml(labels.date)}</p>
${body}
<footer><p>${escapeHtml(labels.englishNote)}</p><p>${escapeHtml(labels.footer)}</p></footer>
</body></html>`;
}

/** The same card as plain text, for sharing from a phone. */
export function impactCardText(sections: ForMeSection[], labels: CardLabels): string {
  const lines = [labels.title, `${labels.area} · ${labels.date}`, ''];
  for (const section of sections) {
    lines.push(labels.section(section.key).toUpperCase());
    if (section.noData) lines.push(labels.noData);
    else if (section.changed.length === 0) lines.push(labels.noChange);
    for (const service of section.changed) {
      lines.push(`- ${service.name} (${labels.status(service)}): ${service.summary}`);
      lines.push(`  ${labels.amount(service)} ${labels.since(service)}`);
      if (service.source_title) lines.push(`  ${labels.source(service.source_title)}${safeUrl(service.source_url) ? ` ${service.source_url}` : ''}`);
    }
    lines.push('');
  }
  lines.push(labels.englishNote, labels.footer);
  return lines.join('\n');
}
