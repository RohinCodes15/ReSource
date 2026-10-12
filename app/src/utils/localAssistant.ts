import { cutServices, resources } from '../data';
import { distanceMiles, FREMONT_CENTER, formatMiles, LatLng } from './geo';

const nearest = (category: string | null, from: LatLng, n = 3) =>
  resources
    .filter((r) => !category || r.category === category)
    .map((r) => ({ r, d: distanceMiles(from, r) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ r, d }) => `• ${r.name} (${formatMiles(d)}): ${r.hours}. ${r.phone}`)
    .join('\n');

/** Offline keyword assistant used when the Python backend can't be reached. */
export function localAnswer(message: string, location?: LatLng | null): string {
  const q = message.toLowerCase();
  const from = location ?? FREMONT_CENTER;
  const where = location ? 'near you' : 'near central Fremont';

  const cut = cutServices.find((s) =>
    [s.category, ...s.name.toLowerCase().split(/\W+/).filter((w) => w.length > 4)].some((k) => q.includes(k)),
  );

  if (/food|hungry|lunch|meal|grocer|pantry/.test(q))
    return `Free food options ${where}:\n${nearest('Food', from)}`;
  if (/clinic|doctor|health|flu|medical|vaccin/.test(q))
    return `Free or low-cost health care ${where}:\n${nearest('Health', from)}`;
  if (/open|near me|nearby|still|available/.test(q))
    return `Here are the closest resources that are still open ${where}:\n${nearest(null, from, 4)}\n\nCity services being cut: ${cutServices
      .map((s) => `${s.name} (${s.effective.toLowerCase()})`)
      .join('; ')}.`;
  if (cut)
    return `${cut.name}: ${cut.change}. ${cut.effective}. ${cut.details}\n\nAlternatives ${where}:\n${nearest(null, from, 2)}`;
  if (/council|vote|rep|mayor|contact/.test(q))
    return 'Open the Reps tab to see how each council member voted on the budget and to call or email them.';
  return 'I can help you find free food, clinics, and other resources, and explain which city services are being cut. Try: "What services are still open near me?"';
}
