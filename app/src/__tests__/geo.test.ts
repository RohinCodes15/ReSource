import { distanceMiles, formatMiles, inFremont, sortByDistance } from '../utils/geo';

const CITY_HALL = { latitude: 37.5518, longitude: -121.9826 };

describe('geo', () => {
  it('measures distance in miles', () => {
    expect(distanceMiles(CITY_HALL, CITY_HALL)).toBe(0);
    // One degree of latitude is about 69 miles anywhere on Earth.
    expect(distanceMiles({ latitude: 37, longitude: -122 }, { latitude: 38, longitude: -122 })).toBeCloseTo(69.1, 0);
    expect(formatMiles(1.26)).toBe('1.3 mi');
  });

  it('knows what is inside Fremont', () => {
    expect(inFremont(CITY_HALL)).toBe(true);
    expect(inFremont({ latitude: 37.7749, longitude: -122.4194 })).toBe(false); // San Francisco
  });

  it('sorts by distance and puts places with no position last', () => {
    const rows = [
      { name: 'Phone line', lat: null, lng: null },
      { name: 'Far', lat: 37.62, lng: -122.05 },
      { name: 'Near', lat: 37.552, lng: -121.983 },
    ];
    expect(sortByDistance(rows, CITY_HALL).map((row) => row.name)).toEqual(['Near', 'Far', 'Phone line']);
  });
});
