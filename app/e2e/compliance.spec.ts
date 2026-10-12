import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, prepare, ROUTES, stubTiles, v } from './helpers';

// ---- Accessibility: axe-core on every route ---------------------------------------------------

test('axe: no serious or critical accessibility violations on any route', async ({ page }) => {
  test.setTimeout(240_000);
  await prepare(page);
  const found: string[] = [];
  for (const [path, name] of ROUTES) {
    await open(page, path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Map tiles are third-party images inside Leaflet's own markup; the map has a list alternative.
      .exclude('.leaflet-pane')
      .analyze();
    for (const violation of results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')) {
      found.push(`${name}: ${violation.id} x${violation.nodes.length}: ${violation.nodes[0].html.slice(0, 160)} :: ${(violation.nodes[0].failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 220)}`);
    }
  }
  expect(found, found.join('\n')).toEqual([]);
});

test('axe: dialogs and right-to-left pass too', async ({ page }) => {
  await prepare(page);
  await open(page, '/resources');
  await v(page, 'location-chip').click();
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical').map((item) => `${item.id}: ${item.nodes[0].html.slice(0, 200)}`)).toEqual([]);
  await v(page, 'sheet-close').click();

  await open(page, '/settings');
  await v(page, 'language-fa').click();
  for (const path of ['/', '/resources', '/report', '/reptracker']) {
    await open(page, path);
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical').map((item) => `${path}: ${item.id}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} in Dari`).toBeLessThanOrEqual(1);
  }
});

test('text can be enlarged to 200% without losing content', async ({ page }) => {
  await prepare(page);
  // A 640px-wide window at 200% zoom has the same layout as a 320px-wide one (WCAG 1.4.10).
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/', '/resources', '/report', '/alerts', '/budget', '/settings']) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

// ---- Storage consent --------------------------------------------------------------------------

test('storage banner: three equal choices, nothing optional before a choice, and the choice sticks', async ({ page }) => {
  await stubTiles(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/');
  await expect(v(page, 'cookie-banner')).toBeVisible();
  const boxes = await Promise.all(['cookie-accept', 'cookie-reject', 'cookie-manage'].map((id) => v(page, id).boundingBox()));
  const styles = await Promise.all(['cookie-accept', 'cookie-reject', 'cookie-manage'].map((id) =>
    v(page, id).evaluate((el) => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.borderColor}|${s.height}`; })));
  expect(new Set(styles).size, 'the three buttons look the same').toBe(1);
  expect(Math.abs((boxes[0]?.height ?? 0) - (boxes[1]?.height ?? 0))).toBeLessThanOrEqual(1);

  // Before any choice: chat history (the one optional item) is not written to the device.
  await open(page, '/chat');
  await v(page, 'suggestion-s2').focus(); // the banner sits over the chips, so use the keyboard
  await page.keyboard.press('Enter');
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  expect(await page.evaluate(() => localStorage.getItem('resource.chat'))).toBeNull();

  await v(page, 'cookie-reject').click();
  await expect(v(page, 'cookie-banner')).toHaveCount(0);
  await page.reload();
  await expect(v(page, 'cookie-banner')).toHaveCount(0);
  await expect(v(page, 'chat-user')).toHaveCount(0); // history was not kept
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('resource.storageConsent') ?? '{}')).choice).toBe('essential');

  // Changing the choice later: accept optional storage, and chat history is now kept.
  await open(page, '/cookies');
  await v(page, 'cookies-open-settings').click();
  await v(page, 'cookie-optional-toggle').click();
  await v(page, 'cookie-save').click();
  await open(page, '/chat');
  await v(page, 'suggestion-s2').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  await page.reload();
  await expect(v(page, 'chat-user')).toHaveCount(1);
});

test('with "Reject all", the app talks only to its own API and, on the map, the tile server', async ({ page }) => {
  test.setTimeout(180_000);
  const hosts = new Map<string, Set<string>>();
  let current = '';
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (!hosts.has(url.host)) hosts.set(url.host, new Set());
    hosts.get(url.host)?.add(current);
  });
  await stubTiles(page);
  await open(page, '/');
  await v(page, 'cookie-reject').click();
  for (const [path, name] of ROUTES) {
    current = name;
    await open(page, path);
    await page.waitForTimeout(250);
  }
  const allowed = ['localhost:4173', 'localhost:8000'];
  const thirdParty = [...hosts.entries()].filter(([host]) => !allowed.includes(host));
  // The only third party is OpenStreetMap, and only on the map screen.
  expect(thirdParty.map(([host]) => host)).toEqual(['tile.openstreetmap.org']);
  expect([...(hosts.get('tile.openstreetmap.org') ?? [])]).toEqual(['map']);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((key) => !key.startsWith('resource.'))).toEqual([]);
  expect(keys).not.toContain('resource.chat');
});

test('the cookie policy lists exactly the storage keys the app uses', async ({ page }) => {
  await prepare(page);
  await open(page, '/cookies');
  const listed = await page.locator('[data-testid^="storage-"]:visible:not([inert] *)').count();
  expect(listed).toBe(9);
  await expect(v(page, 'storage-chat')).toContainText('Optional');
  await expect(v(page, 'storage-installToken')).toContainText('Essential');
});

test('policy pages are real routes and are linked from every screen', async ({ page }) => {
  await prepare(page);
  for (const [path, heading] of [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookies', 'Cookie Policy']]) {
    await open(page, path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await open(page, '/privacy');
  await expect(page.getByText('We do not sell personal information', { exact: false })).toBeVisible();
  await expect(page.getByText('CCPA/CPRA', { exact: false })).toBeVisible();
  for (const path of ['/', '/resources', '/alerts', '/status', '/report', '/community', '/reptracker', '/budget', '/settings']) {
    await open(page, path);
    await expect(v(page, 'footer-privacy'), path).toBeVisible();
    await expect(v(page, 'footer-terms'), path).toBeVisible();
  }
});
