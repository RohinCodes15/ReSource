import { expect, test, type Page } from '@playwright/test';
import { ADMIN_TOKEN } from '../playwright.config';
import { API, mapServiceCount, open, prepare, v } from './helpers';

test.beforeEach(async ({ page }) => { await prepare(page); });

const tick = async (page: Page) => { await v(page, 'consent-checkbox').click(); await v(page, 'age-checkbox').click(); };

async function fileReport(page: Page, description = 'The potholes on our street have not been repaired this year.') {
  await open(page, '/report');
  await v(page, 'service-option-svc-pavement').click();
  await v(page, 'report-next').click();
  await v(page, 'report-description').fill(description);
  await v(page, 'report-next').click();
  await v(page, 'impact-high').click();
  await tick(page);
  await v(page, 'report-submit').click();
  await expect(v(page, 'report-success')).toBeVisible();
}

// ---- Location and ZIP -------------------------------------------------------------------------

test.describe('location', () => {
  test('ZIP code: invalid, outside Fremont, valid, persists, and can be cleared', async ({ page }) => {
    await open(page, '/resources');
    await expect(v(page, 'location-label')).toContainText('Fremont City Hall');
    await v(page, 'location-chip').click();

    await v(page, 'zip-input').fill('9453');
    await v(page, 'use-zip').click();
    await expect(v(page, 'zip-input-error')).toContainText('5-digit');

    await v(page, 'zip-input').fill('94102');
    await v(page, 'use-zip').click();
    await expect(v(page, 'zip-input-error')).toContainText('outside Fremont');
    await expect(v(page, 'use-center-offer')).toBeVisible();

    await v(page, 'zip-input').fill(' 94536 ');
    await v(page, 'use-zip').click();
    await expect(v(page, 'location-label')).toContainText('Centerville & Niles (94536)');
    // Distance sorting follows the new location: the nearest resource is now in 94536.
    await expect(page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)').first()).toContainText('94536');

    await page.reload();
    await expect(v(page, 'location-label')).toContainText('Centerville & Niles (94536)');

    await v(page, 'location-chip').click();
    await v(page, 'clear-location').click();
    await expect(v(page, 'location-label')).toContainText('Fremont City Hall');
  });

  test('GPS denied: a clear message, nothing changes, and the app keeps working', async ({ page }) => {
    await open(page, '/resources');
    await v(page, 'location-chip').click();
    await v(page, 'use-gps').click();
    await expect(v(page, 'location-notice')).toContainText(/ZIP code instead/);
    await v(page, 'sheet-close').click();
    await expect(v(page, 'location-label')).toContainText('Fremont City Hall');
    await expect(page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)').first()).toBeVisible();
  });

  test.describe('GPS allowed', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 37.5773, longitude: -121.9806 } });
    test('the chosen position drives the chip and the distance order', async ({ page }) => {
      await open(page, '/resources');
      await v(page, 'location-chip').click();
      await v(page, 'use-gps').click();
      await expect(v(page, 'location-label')).toContainText('your location');
      await expect(v(page, 'location-label')).not.toContainText('Centerville'); // no guessed neighborhood name
      await expect(page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)').first()).toContainText('Niles Library');
      await open(page, '/chat');
      await expect(v(page, 'location-label')).toContainText('your location');
    });
  });

  test.describe('GPS outside Fremont', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 } });
    test('says so and offers City Hall', async ({ page }) => {
      await open(page, '/resources');
      await v(page, 'location-chip').click();
      await v(page, 'use-gps').click();
      await expect(v(page, 'location-notice')).toContainText('outside Fremont');
      await v(page, 'use-center').click();
      await expect(v(page, 'location-label')).toContainText('Fremont City Hall');
    });
  });
});

// ---- Resource Finder ---------------------------------------------------------------------------

test('resources: search, chips, sort, call, directions, website, share and save', async ({ page }) => {
  await open(page, '/resources');
  const cards = page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)');
  const all = await cards.count();
  expect(all).toBeGreaterThan(8);

  await v(page, 'resource-search').fill('food bank');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('TCV Food Bank');
  await v(page, 'resource-search-clear').click();
  await expect(cards).toHaveCount(all);

  await v(page, 'chip-Health').click();
  await expect(v(page, 'resource-count')).toContainText('3 resources');
  await v(page, 'chip-all').click();

  await v(page, 'segment-name').click();
  await expect(cards.first()).toContainText('211 Alameda County');

  await expect(v(page, 'call-res-tcv')).toHaveAttribute('href', 'tel:5107934583');
  await expect(v(page, 'call-res-211')).toHaveAttribute('href', 'tel:211');
  await expect(v(page, 'directions-res-tcv')).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=37350%20Joseph/);
  const website = v(page, 'website-res-tcv');
  await expect(website).toHaveAttribute('href', 'https://tcvfoodbank.org/');
  await expect(website).toHaveAttribute('target', '_blank');
  await expect(website).toHaveAttribute('rel', /noopener noreferrer/);

  await v(page, 'share-res-tcv').click();
  await expect(v(page, 'resource-notice')).toBeVisible();

  await v(page, 'save-res-tcv').click();
  await expect(v(page, 'chip-saved')).toContainText('Saved (1)');
  await page.reload();
  await v(page, 'chip-saved').click();
  await expect(cards).toHaveCount(1);
  await v(page, 'save-res-tcv').click();
  await expect(v(page, 'empty-state')).toBeVisible();
});

// ---- Map ------------------------------------------------------------------------------------

test('map: a group of pins says how many services it holds and which', async ({ page }) => {
  await open(page, '/map');
  const group = page.locator('[data-testid="pin-cluster"][data-members*="svc-human-services"]');
  await expect(group).toHaveAttribute('role', 'button');
  await expect(group).toHaveAttribute('aria-label', /services close together: .*Human Services/);
});

test('map: when the map images fail, the map stays blank with a note and the pins still work', async ({ page }) => {
  await page.unroute(/tile\.openstreetmap\.org/);
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await open(page, '/map');
  await expect(v(page, 'map-tiles-failed')).toContainText('could not load');
  const shown = await page.evaluate(() => Array.from(document.querySelectorAll('.leaflet-tile')).filter((tile) => getComputedStyle(tile).visibility !== 'hidden').length);
  expect(shown, 'failed tiles are hidden').toBe(0);
  await expect.poll(() => mapServiceCount(page)).toBe(11);
});

test('map: pins, filters, search, list view, details sheet and Find Alternative', async ({ page }) => {
  await open(page, '/map');
  await expect.poll(() => mapServiceCount(page)).toBe(11);
  await v(page, 'map-filter-open').click();
  await expect(v(page, 'map-count')).toContainText('4 services');
  await expect.poll(() => mapServiceCount(page)).toBe(4);
  await v(page, 'map-filter-all').click();
  await v(page, 'map-search').fill('zzz nothing');
  await expect(v(page, 'map-count')).toContainText('0 services');
  await v(page, 'map-search-clear').click();
  await v(page, 'map-recenter').click();

  // Pins close together form a group; selecting it zooms in, then opens the five at City Hall into a ring.
  const pin = page.locator('[data-testid="pin-svc-human-services"]');
  for (let i = 0; i < 4 && !(await pin.count()); i += 1) {
    await page.locator('[data-testid="pin-cluster"][data-members*="svc-human-services"]').click();
    await page.waitForTimeout(600);
  }
  // A pin opens the same detail sheet as the list.
  await pin.click();
  await expect(v(page, 'service-detail')).toContainText('10 more positions');
  await page.keyboard.press('Escape');
  await expect(v(page, 'service-detail')).toHaveCount(0);

  await v(page, 'segment-list').click();
  await v(page, 'service-svc-human-services').click();
  await expect(v(page, 'detail-call')).toHaveAttribute('href', 'tel:5105742050');
  await v(page, 'find-alternative').click();
  await expect(page).toHaveURL(/\/resources\?categories=Food/);
  await expect(v(page, 'alternatives-banner')).toContainText('Human Services safety-net programs');
  await expect(page.locator('[data-testid^="resource-res-library"]:visible:not([inert] *)')).toHaveCount(0);
  await v(page, 'clear-alternatives').click();
  await expect(page.locator('[data-testid^="resource-res-library"]:visible:not([inert] *)')).toHaveCount(3);
});

test('status dashboard: counts, filters and recent changes', async ({ page }) => {
  await open(page, '/status');
  await expect(v(page, 'count-reduced-value')).toHaveText('7');
  await expect(v(page, 'count-open-value')).toHaveText('4');
  await expect(page.locator('[data-testid^="recent-svc-"]:visible:not([inert] *)')).toHaveCount(5);
  await v(page, 'status-cat-seniors').click();
  await expect(v(page, 'status-count')).toContainText('Showing 2 of 11');
  await v(page, 'status-area-94539').click();
  await expect(v(page, 'status-count')).toContainText('Showing 1 of 11');
  await v(page, 'toggle-table').click();
  await expect(v(page, 'data-table')).toBeVisible();
});

// ---- What changed for me ---------------------------------------------------------------------

test('what changed for me: interests give a sourced summary and a printable card with no personal data', async ({ page }) => {
  await open(page, '/');
  await v(page, 'home-action-forMe').click();
  await expect(v(page, 'for-me-screen')).toBeVisible();
  await v(page, 'for-me-show').click();
  await expect(v(page, 'for-me-error')).toContainText('at least one');

  await v(page, 'location-chip').click();
  await v(page, 'zip-input').fill('94538');
  await v(page, 'use-zip').click();
  await v(page, 'interest-parks').click();
  await v(page, 'interest-kids').click();
  await v(page, 'for-me-show').click();

  // A reduction, with its source link.
  const parks = v(page, 'for-me-section-parks');
  await expect(parks).toContainText('Park and street-median capital replacement');
  await expect(parks.locator('a[href^="https://"]').first()).toBeVisible();
  // Where the documents show no change, the screen says so instead of implying one.
  await expect(v(page, 'for-me-nochange-kids')).toContainText('no budget-related change');
  // Citywide items are always included, and ones in the chosen ZIP area are marked.
  await expect(v(page, 'for-me-section-everyone')).toContainText('Located in your area');

  await page.evaluate(() => { HTMLIFrameElement.prototype.focus = () => undefined; });
  await v(page, 'for-me-card').click();
  const card = await page.locator('iframe[data-print="impact-card"]').getAttribute('srcdoc');
  expect(card).toContain('My impact card');
  expect(card).toContain('Park and street-median capital replacement');
  expect(card).toContain('No personal information is on this card');
  expect(card).not.toMatch(/resource\.installToken|@gmail|latitude/i);
});

// ---- Report an Impact ------------------------------------------------------------------------

test('report: validation at every step, back, consent, success and "your reports"', async ({ page }) => {
  await open(page, '/report');
  await v(page, 'report-next').click();
  await expect(v(page, 'step-error')).toContainText('Choose a service');
  await v(page, 'service-option-other').click();
  await v(page, 'report-next').click();
  await expect(v(page, 'other-service-error')).toBeVisible();
  await v(page, 'service-option-svc-pavement').click();
  await v(page, 'report-next').click();

  await v(page, 'report-description').fill('short');
  await v(page, 'report-next').click();
  await expect(v(page, 'report-description-error')).toContainText('at least 10');
  await v(page, 'report-back').click();
  await expect(v(page, 'report-step-title')).toContainText('Which service');
  await v(page, 'report-next').click();
  await v(page, 'report-description').fill('Potholes on our block. Call me at 510-555-0188.');
  await v(page, 'report-area-94538').click();
  await v(page, 'report-next').click();

  await v(page, 'report-submit').click();
  await expect(v(page, 'step-error')).toContainText('how much');
  await v(page, 'impact-medium').click();
  await v(page, 'report-submit').click();
  await expect(v(page, 'consent-fields')).toContainText('Tick this box');
  await expect(v(page, 'report-success')).toHaveCount(0);
  await tick(page);
  await v(page, 'report-submit').click();

  await expect(v(page, 'report-success')).toContainText('Report received');
  await expect(v(page, 'report-receipt')).toContainText('Receipt:');
  await expect(v(page, 'report-success')).toContainText('removed personal details');
  await expect(v(page, 'my-reports')).toContainText('Waiting for review');
  await v(page, 'report-another').click();
  await expect(v(page, 'report-step-title')).toContainText('Which service');
});

test('report: a double tap on Submit files one report', async ({ page, request }) => {
  // Every report, reviewed or not: the public count only includes verified ones.
  const filed = async () => ((await (await request.get(`${API}/admin/reports?status=all`, { headers: { 'X-Admin-Token': ADMIN_TOKEN } })).json()) as unknown[]).length;
  const before = await filed();
  await open(page, '/report');
  await v(page, 'service-option-svc-fire-ops').click();
  await v(page, 'report-next').click();
  await v(page, 'report-description').fill('Checking that two quick taps only send one report.');
  await v(page, 'report-next').click();
  await v(page, 'impact-low').click();
  await tick(page);
  await v(page, 'report-submit').dblclick();
  await expect(v(page, 'report-success')).toBeVisible();
  expect(await filed()).toBe(before + 1);
});

test('report: photo can be picked and removed, and the wrong type is refused', async ({ page }) => {
  await open(page, '/report');
  await v(page, 'service-option-svc-pavement').click();
  await v(page, 'report-next').click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  let chooser = page.waitForEvent('filechooser');
  await v(page, 'add-photo').click();
  await (await chooser).setFiles({ name: 'street.png', mimeType: 'image/png', buffer: png });
  await expect(v(page, 'remove-photo')).toBeVisible();
  await v(page, 'remove-photo').click();
  await expect(v(page, 'add-photo')).toBeVisible();
});

test('under 13: forms are replaced by browse-only mode', async ({ page }) => {
  await open(page, '/community');
  await v(page, 'under-13').click();
  await expect(v(page, 'browse-only')).toContainText('under 13');
  await expect(v(page, 'post-submit')).toHaveCount(0);
  await open(page, '/report');
  await expect(v(page, 'browse-only')).toBeVisible();
  await open(page, '/chat');
  await expect(v(page, 'chat-input')).toHaveCount(0);
  await open(page, '/resources'); // reading still works
  await expect(page.locator('[data-testid^="resource-res-"]:visible:not([inert] *)').first()).toBeVisible();
});

// ---- Alerts ----------------------------------------------------------------------------------

test('alerts: subscribe persists across a restart, mark read, unsubscribe', async ({ page }) => {
  await open(page, '/alerts');
  await expect(page.locator('[data-testid^="alert-alert-"]:visible:not([inert] *)')).toHaveCount(6);
  await expect(v(page, 'unread-count')).toContainText('6 unread');
  await v(page, 'mark-read-alert-election-2026').click();
  await expect(v(page, 'unread-count')).toContainText('5 unread');

  await v(page, 'topic-civic').click();
  await v(page, 'area-94536').click();
  await v(page, 'subscribe').click();
  await expect(v(page, 'alerts-notice')).toContainText('saved');

  await page.reload();
  await expect(v(page, 'alert-preferences')).toContainText('You are following updates');
  await expect(v(page, 'unread-count')).toContainText('5 unread');
  await v(page, 'segment-mine').click();
  await expect(page.locator('[data-testid^="alert-alert-"]:visible:not([inert] *)')).toHaveCount(1);

  await v(page, 'notify-toggle').click(); // browsers: a clear explanation, not a silent failure
  await expect(v(page, 'alerts-notice')).toContainText('not available');
  await v(page, 'mark-all-read').click();
  await expect(v(page, 'unread-count')).toContainText('0 unread');
  await v(page, 'unsubscribe').click();
  await expect(v(page, 'alerts-notice')).toContainText('stopped following');
  await page.reload();
  await expect(v(page, 'unsubscribe')).toHaveCount(0);
});

// ---- Rep Tracker -----------------------------------------------------------------------------

test('reps: contacts, sources, unverified votes and the letter flow', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '/reptracker');
  await expect(page.locator('[data-testid^="member-"]:visible:not([inert] *)')).toHaveCount(7);
  await expect(v(page, 'call-salwan')).toHaveAttribute('href', 'tel:5102844082');
  await expect(v(page, 'email-keng')).toHaveAttribute('href', 'mailto:tkeng@fremont.gov');
  await expect(v(page, 'district-locator')).toHaveAttribute('href', 'https://city.fremont.gov/locatedistrict');
  await expect(v(page, 'vote-vote-rebalance-2026')).toContainText('Vote record not yet verified');
  await expect(v(page, 'vote-vote-tax-defer-2026')).toContainText('Reported as unanimous');

  await v(page, 'write-liu').click();
  await expect(v(page, 'letter-body')).toHaveValue(/Dear Vice Mayor Raymond Liu/);
  await v(page, 'letter-body').fill('Dear Vice Mayor Liu, please keep the Age Well Centers funded.');
  await expect(v(page, 'letter-email')).toHaveAttribute('href', /^mailto:rliu@fremont\.gov\?subject=.*&body=Dear%20Vice%20Mayor%20Liu/);
  await v(page, 'letter-copy').click();
  await expect(v(page, 'letter-copy')).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('please keep the Age Well Centers funded');
  await v(page, 'sheet-close').click();
  await expect(v(page, 'letter-sheet')).toHaveCount(0);
});

// ---- Community Board -------------------------------------------------------------------------

test('community: post, one vote per person, report abuse, delete own post', async ({ page, browser }) => {
  await open(page, '/community');
  await v(page, 'post-submit').click();
  await expect(v(page, 'post-body-error')).toBeVisible();
  await v(page, 'post-body').fill('The Senior InfoLine called me back the next morning.');
  await v(page, 'post-submit').click();
  await expect(v(page, 'consent-fields')).toContainText('Tick this box');
  await tick(page);
  await v(page, 'post-submit').click();
  await expect(v(page, 'community-notice')).toContainText('now visible');
  const mine = page.locator('[data-testid^="post-"]:visible:not([inert] *)', { hasText: 'called me back the next morning' });
  await expect(mine).toContainText('Your post');
  const id = ((await mine.getAttribute('data-testid')) ?? '').replace('post-', '');

  // Voting twice toggles the vote; it can never count twice.
  await v(page, `vote-${id}`).click();
  await expect(v(page, `votes-${id}`)).toHaveText('1');
  await v(page, `vote-${id}`).click();
  await expect(v(page, `votes-${id}`)).toHaveText('0');
  await v(page, `vote-${id}`).click();
  await expect(v(page, `votes-${id}`)).toHaveText('1');

  // A second person sees the post and can report it, but cannot delete it. Their vote comes from
  // the same network as the first one, so the server does not count it and the app says why.
  const other = await (await browser.newContext()).newPage();
  await prepare(other);
  await open(other, '/community');
  await expect(v(other, `delete-${id}`)).toHaveCount(0);
  await v(other, `vote-${id}`).click();
  await expect(v(other, 'community-notice')).toContainText('already voted');
  await expect(v(other, `votes-${id}`)).toHaveText('1');
  await v(other, `flag-${id}`).click();
  await v(other, 'confirm-yes').click();
  await expect(v(other, 'community-notice')).toContainText('reported to a moderator');
  await other.context().close();

  await v(page, `delete-${id}`).click();
  await v(page, 'confirm-no').click();
  await expect(mine).toBeVisible();
  await v(page, `delete-${id}`).click();
  await v(page, 'confirm-yes').click();
  await expect(v(page, 'community-notice')).toContainText('deleted');
  await expect(mine).toHaveCount(0);
  await v(page, 'segment-new').click();
  await expect(page.locator('[data-testid^="post-post-sample"]:visible:not([inert] *)').first()).toContainText('Starter post');
});

// ---- Assistant --------------------------------------------------------------------------------

test('chat: suggestion chip, typed question, sources, "I don\'t know", clear', async ({ page }) => {
  await open(page, '/chat');
  await expect(v(page, 'chat-notice')).toContainText('sent to an AI service');
  await expect(v(page, 'chat-emergency')).toContainText('911');
  await v(page, 'suggestion-s2').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  await expect(v(page, 'chat-sources').last()).toContainText('TCV Food Bank + Mobile Pantry');

  await v(page, 'chat-input').fill('What is the weather on Mars?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-assistant').last()).toContainText("I don't know");
  await expect(v(page, 'chat-sources').last()).toContainText('none');
  await expect(v(page, 'chat-user')).toHaveCount(2);

  await v(page, 'chat-clear').click();
  await expect(v(page, 'chat-user')).toHaveCount(0);
  await expect(v(page, 'suggestion-s1')).toBeVisible();
});

test('chat: Stop cancels a slow answer, and a failed answer can be retried', async ({ page }) => {
  let mode: 'slow' | 'fail' | 'ok' = 'slow';
  await page.route(`${API}/chat/stream`, async (route) => {
    if (mode === 'slow') { await new Promise((resolve) => setTimeout(resolve, 15000)); return route.abort(); }
    if (mode === 'fail') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"detail":"database_unavailable"}' });
    return route.continue();
  });
  await open(page, '/chat');
  await v(page, 'chat-input').fill('Where can I get free food?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-stop')).toBeVisible();
  await v(page, 'chat-stop').click();
  await expect(v(page, 'chat-send')).toBeVisible();
  await expect(v(page, 'chat-assistant')).toHaveCount(0); // the empty answer was removed
  await expect(v(page, 'chat-user')).toHaveCount(1);

  mode = 'fail';
  await v(page, 'chat-input').fill('Where can I get free food?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-failed')).toBeVisible();
  mode = 'ok';
  await v(page, 'chat-retry').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  await expect(v(page, 'chat-failed')).toHaveCount(0);
});

test('chat: a reload while an answer is being written leaves a retry, not an endless wait', async ({ page }) => {
  let slow = true;
  await page.route(`${API}/chat/stream`, async (route) => {
    if (!slow) return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 15000));
    return route.abort().catch(() => undefined);
  });
  await open(page, '/chat');
  // Chat history is only saved when optional storage is accepted.
  await page.evaluate(() => localStorage.setItem('resource.storageConsent', JSON.stringify({ choice: 'all', decidedAt: '2026-10-12T00:00:00.000Z' })));
  await open(page, '/chat');
  await v(page, 'chat-input').fill('Where can I get free food?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-stop')).toBeVisible();
  await page.reload();
  await expect(v(page, 'chat-failed')).toBeVisible();
  slow = false;
  await v(page, 'chat-retry').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank');
  await v(page, 'chat-input').fill('Is there a low-cost clinic?');
  await v(page, 'chat-send').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('Clinic');
});

// ---- Language, text size, settings ------------------------------------------------------------

test('language: switch, persist, and Dari is right-to-left', async ({ page }) => {
  await open(page, '/');
  await v(page, 'language-button').click();
  await v(page, 'language-es').click();
  await expect(v(page, 'tab-home')).toContainText('Inicio');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(v(page, 'tab-home')).toContainText('Inicio');

  await open(page, '/settings');
  await v(page, 'language-fa').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa-AF');
  await open(page, '/chat');
  await v(page, 'suggestion-s2').click();
  await expect(v(page, 'chat-assistant').last()).toContainText('TCV Food Bank'); // answered in the chosen language, same data
  await expect(v(page, 'chat-assistant').last()).toContainText('منابع');
  await open(page, '/settings');
  await v(page, 'language-en').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('settings: text size, download my data, delete my data, clear this device, feedback', async ({ page }) => {
  await fileReport(page);
  await open(page, '/settings');
  const sample = page.getByText('This is how text will look across the app.');
  const before = await sample.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const size = () => sample.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await v(page, 'segment-1.3').click();
  await expect.poll(size).toBeGreaterThan(before * 1.25);
  await page.reload();
  await expect.poll(size).toBeGreaterThan(before * 1.25);
  await v(page, 'segment-1').click();

  const download = page.waitForEvent('download');
  await v(page, 'download-data').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('resource-my-data.json');
  const exported = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString());
  expect(exported.data.reports).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain('owner_hash');

  await v(page, 'delete-data').click();
  await v(page, 'confirm-delete-no').click();
  await v(page, 'delete-data').click();
  await v(page, 'confirm-delete-yes').click();
  await expect(v(page, 'settings-notice')).toContainText('Deleted 2 records');
  await open(page, '/report');
  await expect(v(page, 'my-reports')).toHaveCount(0);

  await open(page, '/settings');
  await v(page, 'feedback-send').click();
  await expect(v(page, 'feedback-message-error')).toBeVisible();
  await v(page, 'feedback-data_error').click();
  await v(page, 'feedback-message').fill('The library phone number looks out of date.');
  await v(page, 'feedback-send').click();
  await expect(v(page, 'settings-notice')).toContainText('feedback was sent');

  await v(page, 'clear-device').click();
  await v(page, 'confirm-delete-yes').click();
  await expect(v(page, 'settings-notice')).toContainText('cleared');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('resource.')))).toEqual([]);
});

test('data deletion request form: validation, consent and a receipt', async ({ page }) => {
  await open(page, '/data-request');
  await v(page, 'request-submit').click();
  await expect(v(page, 'request-email-error')).toBeVisible();
  await expect(v(page, 'request-details-error')).toBeVisible();
  await v(page, 'request-parent').click();
  await v(page, 'request-email').fill('parent@example.com');
  await v(page, 'request-details').fill('Please remove the report my child sent last week.');
  await v(page, 'request-submit').click();
  await expect(v(page, 'data-request-done')).toHaveCount(0); // consent box still unticked
  await v(page, 'request-consent').click();
  await v(page, 'request-submit').click();
  await expect(v(page, 'data-request-done')).toContainText('within 30 days');
});

// ---- Admin and the impact dashboard -----------------------------------------------------------

test('admin: wrong passcode, verify a report, impact dashboard and CSV export, lock', async ({ page }) => {
  await fileReport(page, 'Street repair on our block has been postponed again this season.');
  await open(page, '/impact');
  await expect(v(page, 'impact-dashboard')).toBeVisible(); // the totals are public
  await expect(v(page, 'impact-export')).toHaveCount(0); // the export is not
  await v(page, 'admin-passcode').fill('not-the-passcode');
  await v(page, 'admin-unlock').click();
  await expect(v(page, 'admin-passcode-error')).toContainText('not correct');
  await v(page, 'admin-passcode').fill(ADMIN_TOKEN);
  await v(page, 'admin-unlock').click();
  await expect(v(page, 'impact-export')).toBeVisible();

  await v(page, 'tab-more').click();
  await v(page, 'more-admin').click();
  const pending = page.locator('[data-testid^="admin-report-"]:visible:not([inert] *)', { hasText: 'postponed again this season' });
  await pending.locator('[data-testid^="verify-"]').click();
  await expect(v(page, 'admin-notice')).toContainText('Saved');
  await expect(pending).toHaveCount(0);

  await v(page, 'segment-services').click();
  await v(page, 'set-svc-age-well-south-reduced').click();
  await v(page, 'confirm-status').click();
  await expect(v(page, 'admin-service-svc-age-well-south')).toContainText('Reduced');
  await v(page, 'set-svc-age-well-south-open').click();
  await v(page, 'confirm-status').click();
  await expect(v(page, 'admin-service-svc-age-well-south')).toContainText('Open');
  await v(page, 'segment-posts').click();
  await v(page, 'segment-requests').click();

  await v(page, 'tab-more').click();
  await v(page, 'more-impact').click();
  await expect(v(page, 'impact-by-service')).toContainText('Street pavement maintenance');
  await v(page, 'toggle-table').first().click();
  await expect(v(page, 'data-table').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await v(page, 'impact-export').click();
  const csv = Buffer.concat(await (await (await download).createReadStream()).toArray()).toString();
  expect(csv.split('\n')[0]).toBe('report_id,created_at,service,area,impact_level,description\r');
  expect(csv).toContain('postponed again this season');

  await v(page, 'admin-lock').click();
  await expect(v(page, 'admin-gate')).toBeVisible();
});

// ---- Keyboard --------------------------------------------------------------------------------

test('keyboard: skip link, visible focus, dialog keeps focus and returns it on Escape', async ({ page }) => {
  await open(page, '/resources');
  await page.keyboard.press('Tab');
  await expect(v(page, 'skip-link')).toBeFocused();
  await expect(v(page, 'skip-link')).toBeInViewport();
  const ring = await v(page, 'skip-link').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).toBe('solid');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('main');

  const chip = v(page, 'location-chip');
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(v(page, 'location-sheet')).toBeVisible();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `focus left the dialog after ${i + 1} tabs`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(v(page, 'location-sheet')).toHaveCount(0);
  await expect(chip).toBeFocused();

  // Chips and buttons work from the keyboard alone.
  await v(page, 'chip-Food').focus();
  await page.keyboard.press('Enter');
  await expect(v(page, 'resource-count')).toContainText('1 resources');
});
