import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { API, blockApi, expectNoSidewaysScroll, open, prepare, ROUTES, trackErrors, v } from './helpers';

// Everything here runs with the API unreachable. The app must keep working from its bundled data.
test.beforeEach(async ({ page }) => {
  await prepare(page);
  await blockApi(page);
});

const NETWORK_NOISE = [/Failed to load resource/, /net::ERR_FAILED/];

test('offline: a banner appears and every screen still shows content', async ({ page }) => {
  const errors = trackErrors(page, NETWORK_NOISE);
  await open(page, '/');
  await expect(v(page, 'offline-banner')).toContainText('Offline mode');
  await expect(v(page, 'stat-reduced')).toContainText('of the 11 City services');
  await expect(page.locator('[data-testid="stat-reports"]')).toHaveCount(0); // never a made-up number
  await expect(v(page, 'home-hero-value')).toHaveText('$289.1M'); // the hero needs no connection
  for (const [path, name] of ROUTES) {
    await open(page, path);
    await expect(page.locator('[data-testid="error-state"]:visible:not([inert] *)'), name).toHaveCount(0);
  }
  await open(page, '/resources');
  await expect(page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)')).toHaveCount(14);
  await open(page, '/map');
  await expect(page.locator('[data-testid^="pin-svc-"]')).toHaveCount(11);
  await open(page, '/reptracker');
  await expect(page.locator('[data-testid^="member-"]:visible:not([inert] *)')).toHaveCount(7);
  await open(page, '/budget');
  await expect(v(page, 'headline-total2627')).toContainText('$427.1M');
  expect(errors, 'uncaught errors while offline').toEqual([]);
});

test('offline: report and chat fail politely and can be retried when the API returns', async ({ page }) => {
  await open(page, '/report');
  await v(page, 'service-option-svc-pavement').click();
  await v(page, 'report-next').click();
  await v(page, 'report-description').fill('Written while the server was unreachable.');
  await v(page, 'report-next').click();
  await v(page, 'impact-low').click();
  await v(page, 'consent-checkbox').click();
  await v(page, 'age-checkbox').click();
  await v(page, 'report-submit').click();
  await expect(v(page, 'report-failure')).toContainText('offline');

  await open(page, '/chat');
  await v(page, 'chat-input').fill('Where can I get free food?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-failed')).toBeVisible();

  await page.unroute('http://localhost:8000/**');
  await v(page, 'chat-retry').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  await expect(v(page, 'offline-banner')).toHaveCount(0);

  await open(page, '/community');
  await expect(page.locator('[data-testid^="post-post-sample"]:visible:not([inert] *)').first()).toBeVisible();
});

// Screenshots for the submission: `npm run screenshots`. That starts a fresh API with an empty
// state folder and runs only these two tests, so the images show the real app online with no
// test reports or posts in it. They are skipped in the full run, where earlier tests have left data.
for (const [device, size] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]] as const) {
  test(`screenshots: every screen, ${device}`, async ({ page }) => {
    test.skip(!process.env.SCREENSHOTS, 'run with `npm run screenshots`');
    test.setTimeout(180_000);
    await page.unroute(`${API}/**`); // online: undo the block this file applies to every other test
    const folder = join(__dirname, '..', '..', 'submission', 'screenshots', device);
    mkdirSync(folder, { recursive: true });
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [path, name] of ROUTES) {
      await open(page, path);
      await page.waitForTimeout(400);
      await expectNoSidewaysScroll(page, `${name} (${device})`);
      await page.screenshot({ path: join(folder, `${name}.png`), fullPage: false });
    }
    // The main feature after it has been used, which the route list alone would not show.
    await open(page, '/for-me');
    await v(page, 'interest-parks').click();
    await v(page, 'interest-kids').click();
    await v(page, 'for-me-show').click();
    await v(page, 'for-me-section-parks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(folder, 'for-me-summary.png'), fullPage: false });
  });
}
