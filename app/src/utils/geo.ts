export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(Math.min(1, h)));
}

export const formatMiles = (mi: number) => `${mi.toFixed(1)} mi`;

/** Rough box around Fremont, used to tell a GPS fix inside the city from one elsewhere. */
export const FREMONT_BOUNDS = { minLat: 37.45, maxLat: 37.63, minLng: -122.15, maxLng: -121.85 };

export const inFremont = (p: LatLng) =>
  p.latitude >= FREMONT_BOUNDS.minLat && p.latitude <= FREMONT_BOUNDS.maxLat &&
  p.longitude >= FREMONT_BOUNDS.minLng && p.longitude <= FREMONT_BOUNDS.maxLng;

/** Adds `distance` (miles, or null when the row has no position) and sorts nearest first. */
export function sortByDistance<T extends { lat: number | null; lng: number | null; name: string }>(
  rows: T[],
  origin: LatLng,
): (T & { distance: number | null })[] {
  return rows
    .map((row) => ({
      ...row,
      distance: row.lat == null || row.lng == null ? null : distanceMiles(origin, { latitude: row.lat, longitude: row.lng }),
    }))
    .sort((a, b) => {
      if (a.distance == null && b.distance == null) return a.name.localeCompare(b.name);
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
}
