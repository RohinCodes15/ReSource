// Constants shared across the Expo app.

export const APP_NAME = 'ReSource';

/** Version of the Privacy Policy and Terms a person agrees to. Matches POLICY_VERSION in backend/settings.py. */
export const POLICY_VERSION = '2026-10-12';
export const POLICY_EFFECTIVE_DATE = '2026-10-12';

export const BRAND_COLORS = {
  navy: '#1B3A6B',
  gold: '#F5A623',
};

/**
 * Details only the project's creator can fill in. They are placeholders on purpose:
 * docs/HUMAN_TODO.md lists each one. Nothing here may be invented.
 */
export const PROJECT = {
  creator: '[Your name]',
  contactEmail: '[your-contact-email@example.com]',
  location: 'Fremont, California',
  repoUrl: '[link to your public code repository]',
};

export const AREA_CODES = ['citywide', '94536', '94538', '94539', '94555'] as const;
export const ALERT_CATEGORIES = ['budget', 'public_safety', 'human_services', 'infrastructure', 'civic'] as const;
