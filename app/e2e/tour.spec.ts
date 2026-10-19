import { expect, test } from '@playwright/test';
import { answerStorageBanner, open, seedTourSeen, stubTiles, v } from './helpers';

test('first launch shows the tour, Skip dismisses it, and Settings can replay it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await answerStorageBanner(page);
  await seedTourSeen(page, false);
  await stubTiles(page);

  await open(page, '/');
  await expect(v(page, 'tour')).toBeVisible();
  await expect(v(page, 'tour-next')).toBeVisible();
  await v(page, 'tour-skip').click();
  await expect(v(page, 'tour')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('resource.tourSeen'))).toBe('true');

  await open(page, '/settings');
  await v(page, 'settings-show-tour').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(v(page, 'tour')).toBeVisible();
});
