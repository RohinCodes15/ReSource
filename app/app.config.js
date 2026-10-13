// Adds the Android Google Maps key to app.json when one is supplied at build time.
// Without GOOGLE_MAPS_ANDROID_KEY an Android build shows the service list instead of the map
// (src/lib/platform.ts, MAP_AVAILABLE). Expo Go carries its own key, so the map works there.
module.exports = ({ config }) => {
  const key = (process.env.GOOGLE_MAPS_ANDROID_KEY || '').trim();
  return {
    ...config,
    android: { ...config.android, ...(key ? { config: { ...config.android?.config, googleMaps: { apiKey: key } } } : {}) },
    extra: { ...config.extra, androidMapsKey: Boolean(key) },
  };
};
