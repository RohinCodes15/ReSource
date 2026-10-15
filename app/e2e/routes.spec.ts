import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, open, prepare, ROUTES, trackErrors, v } from './helpers';

// Every route, loaded directly (the same as a deep link or a browser refresh), at three widths.
for (const width of [360, 768, 1280]) {
  test(`every route renders at ${width}px with no errors and no sideways scroll`, async ({ page }) => {
    test.setTimeout(180_000);
    await prepare(page);
    await page.setViewportSize({ width, height: 800 });
    const errors = trackErrors(page);
    for (const [path, name] of ROUTES) {
      await open(page, path);
      await expect(page, `${name}: tab title`).toHaveTitle(/ReSource/);
      await expect(page.locator('[role="heading"]:visible, h1:visible, h2:visible').first(), `${name}: a heading`).toBeVisible();
      await expect(page.locator('[data-testid="error-state"]:visible:not([inert] *)'), `${name}: error state`).toHaveCount(0);
      await expectNoSidewaysScroll(page, `${name} at ${width}px`);
    }
    expect(errors, 'console errors').toEqual([]);
  });
}

test('each route has its own tab title', async ({ page }) => {
  await prepare(page);
  const titles = new Set<string>();
  for (const [path] of ROUTES) {
    await open(page, path);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(ROUTES.length);
});

test('the tab bar reaches every tab and the header Back button returns', async ({ page }) => {
  await prepare(page);
  await open(page, '/');
  for (const [tab, path] of [['map', '/map'], ['resources', '/resources'], ['alerts', '/alerts'], ['chat', '/chat'], ['more', '/more'], ['home', '/']] as const) {
    await v(page, `tab-${tab}`).click();
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`));
  }
  await v(page, 'tab-more').click();
  await v(page, 'more-budget').click();
  await expect(page).toHaveURL(/\/budget/);
  await v(page, 'header-back').click();
  await expect(page).toHaveURL(/\/more/);
});

test('every row on the More screen opens its screen', async ({ page }) => {
  await prepare(page);
  for (const [row, path] of [['forMe', '/for-me'], ['status', '/status'], ['budget', '/budget'], ['reps', '/reptracker'], ['report', '/report'], ['community', '/community'], ['settings', '/settings'],
    ['about', '/about'], ['privacy', '/privacy'], ['terms', '/terms'], ['cookies', '/cookies'], ['dataRequest', '/data-request'], ['credits', '/credits'], ['impact', '/impact'], ['admin', '/admin']]) {
    await open(page, '/more');
    await v(page, `more-${row}`).click();
    await expect(page, row).toHaveURL(new RegExp(path));
  }
});

test('home actions and the footer links all go somewhere', async ({ page }) => {
  await prepare(page);
  for (const [action, path] of [['map', '/map'], ['resources', '/resources'], ['status', '/status'], ['budget', '/budget'], ['report', '/report'], ['chat', '/chat'], ['reps', '/reptracker'], ['forMe', '/for-me']]) {
    await open(page, '/');
    await v(page, `home-action-${action}`).click();
    await expect(page, action).toHaveURL(new RegExp(path));
  }
  for (const [link, path] of [['about', '/about'], ['privacy', '/privacy'], ['terms', '/terms'], ['cookies', '/cookies'], ['credits', '/credits']]) {
    await open(page, '/');
    await v(page, `footer-${link}`).click();
    await expect(page, link).toHaveURL(new RegExp(path));
  }
  await open(page, '/');
  await v(page, 'footer-storage-settings').click();
  await expect(v(page, 'cookie-preferences')).toBeVisible();
});

test('an unknown address shows a 404 screen with a Home button', async ({ page }) => {
  await prepare(page);
  await open(page, '/this-page-does-not-exist');
  await expect(v(page, 'not-found')).toBeVisible();
  await v(page, 'go-home').click();
  await expect(v(page, 'home-screen')).toBeVisible();
});

test('home shows real counts from the database and the independent-project notice', async ({ page, request }) => {
  await prepare(page);
  const stats = await (await request.get('http://localhost:8000/stats')).json();
  await open(page, '/');
  await expect(v(page, 'stat-reduced-value')).toHaveText(String(stats.services_reduced + stats.services_closed));
  await expect(v(page, 'stat-reduced')).toContainText(`of the ${stats.services_tracked} City services`);
  await expect(v(page, 'stat-resources-value')).toContainText(String(stats.resources));
  // A count of zero says nothing to a resident, so it is not shown at all.
  if (stats.reports_verified > 0) await expect(v(page, 'stat-reports-value')).toHaveText(String(stats.reports_verified));
  else await expect(page.locator('[data-testid="stat-reports"]')).toHaveCount(0);
  await expect(v(page, 'independent-notice')).toContainText('not an official City of Fremont service');
});

test('home leads with the General Fund figure, its source, and where it goes', async ({ page }) => {
  await prepare(page);
  await open(page, '/');
  await expect(v(page, 'home-hero-value')).toHaveText('$289.1M');
  await expect(v(page, 'home-hero')).toContainText('$427.1M');
  await expect(v(page, 'home-hero').getByRole('link', { name: /Proposed Budget presentation, May 12, 2026, page 7/ })).toBeVisible();
  for (const [label, percent] of [['Police', 45], ['Fire', 27], ['Maintenance', 15], ['Other', 13]]) {
    await expect(v(page, 'home-shares')).toContainText(`${label}${percent}%`);
  }
});
