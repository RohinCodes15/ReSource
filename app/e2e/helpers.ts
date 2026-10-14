import { expect, type Page } from '@playwright/test';

export const API = 'http://localhost:8000';

/** Every route in the app: [path, name used for screenshots]. */
export const ROUTES: [string, string][] = [
  ['/', 'home'], ['/map', 'map'], ['/resources', 'resources'], ['/alerts', 'alerts'], ['/chat', 'chat'], ['/more', 'more'],
  ['/for-me', 'for-me'], ['/status', 'status'], ['/report', 'report'], ['/reptracker', 'reps'], ['/community', 'community'], ['/budget', 'budget'],
  ['/impact', 'impact'], ['/admin', 'admin'], ['/settings', 'settings'], ['/about', 'about'], ['/privacy', 'privacy'],
  ['/terms', 'terms'], ['/cookies', 'cookies'], ['/credits', 'credits'], ['/data-request', 'data-request'], ['/sign-in', 'sign-in'],
];

/**
 * Screens in other tabs stay mounted but inert, so the same test id can exist several times.
 * `v` finds the one in the current screen (or in an open dialog).
 */
export const ON_SCREEN = ':visible:not([inert] *)';
export const v = (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]${ON_SCREEN}`);

/** Answers the storage banner ahead of time so it does not cover the page under test. */
export async function answerStorageBanner(page: Page, choice: 'all' | 'essential' = 'essential') {
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('resource.storageConsent')) {
      window.localStorage.setItem('resource.storageConsent', JSON.stringify({ choice: value, decidedAt: '2026-10-12T00:00:00.000Z' }));
    }
  }, choice);
}

const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Map tiles come from OpenStreetMap; tests answer those requests locally instead. */
export async function stubTiles(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TILE }));
}

/** Makes every API call fail, as if the server were down. */
export async function blockApi(page: Page) {
  await page.route(`${API}/**`, (route) => route.abort());
}

/** Collects console errors and uncaught exceptions so a test can assert there were none. */
export function trackErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  const keep = (text: string) => { if (!ignore.some((pattern) => pattern.test(text))) errors.push(text); };
  page.on('console', (message) => { if (message.type() === 'error') keep(message.text()); });
  page.on('pageerror', (error) => keep(String(error)));
  return errors;
}

export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('[role="main"]:visible:not([inert] *)').first().waitFor();
  await expect(page.locator('[data-testid="loading"]:visible')).toHaveCount(0);
}

/** A page must never scroll sideways. */
export async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
}

export async function prepare(page: Page) {
  // Tests run with reduced motion so nothing is measured or clicked half-way through a fade.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await answerStorageBanner(page);
  await stubTiles(page);
}
