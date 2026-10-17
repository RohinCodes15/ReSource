// Constants shared across the Expo app.

export const APP_NAME = 'ReSource';

/** Version of the Privacy Policy and Terms a person agrees to. Matches POLICY_VERSION in backend/settings.py. */
export const POLICY_VERSION = '2026-10-20';
export const POLICY_EFFECTIVE_DATE = '2026-10-20';

export const BRAND_COLORS = {
  navy: '#1B3A6B',
  gold: '#F5A623',
};

/**
 * Details supplied by the project's creator. Nothing here may be invented.
 * repoUrl must not be shown on any screen until the repository is public (docs/HUMAN_TODO.md).
 */
export const PROJECT = {
  creator: 'Rohin Pidathala',
  contactEmail: 'rohincodes15@gmail.com',
  location: 'Fremont, California',
  repoUrl: 'https://github.com/RohinCodes15/ReSource',
};

export const AREA_CODES = ['citywide', '94536', '94538', '94539', '94555'] as const;
export const ALERT_CATEGORIES = ['budget', 'public_safety', 'human_services', 'infrastructure', 'civic'] as const;
