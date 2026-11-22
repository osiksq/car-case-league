import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

async function winNextRace(page: Page, reloadDuringRace = false) {
  // Make the next real game draw reproducible without preloading a career result.
  await page.evaluate(() => {
    const original = crypto.getRandomValues;
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: Uint32Array) {
        Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: original });
        array[0] = 120;
        return array;
      },
    });
  });
  await page.getByRole('button', { name: 'Start Race', exact: true }).click();
  if (reloadDuringRace) {
    await expect(page.getByRole('progressbar', { name: 'Your car race progress' })).toBeVisible();
    await page.reload();
  }
  await expect(page.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible();
}

test('career opens with only Rookie unlocked and free races still available', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Career', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Career', exact: true })).toBeVisible();
  const leagues = page.getByTestId('career-league');
  await expect(leagues).toHaveCount(4);
  await expect(page.getByTestId('career-current-league')).toHaveText('Rookie League');
  const eventHeights = await page.locator('.career-event').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(eventHeights).toHaveLength(8);
  expect(Math.max(...eventHeights)).toBeLessThan(105);
  await expect(leagues.filter({ hasText: 'Street League' }).getByRole('button', { name: 'Neon Straight' })).toBeDisabled();
  await expect(leagues.filter({ hasText: 'Elite League' })).toContainText('Locked');
  await page.getByRole('button', { name: 'Races', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Race Control' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drag Race' })).toBeVisible();
});

test('promotion and its award survive reload without awarding the badge twice', async ({ page }) => {
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const award = page.getByTestId('career-award');
  const wallet = page.getByTestId('coin-balance');
  await page.goto('./');
  await button('Open Free Case').click();
  await button('Go to Garage').click();
  await button('Career').click();

  await button('Depot Sprint').click();
  await expect(page.getByRole('heading', { name: 'Depot Sprint', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Race car' })).toHaveValue('car-1');
  await button('Balanced').click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await winNextRace(page, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(wallet).toHaveText('160');
  await expect(award).toHaveCount(0);
  await button('Back to Career').click();
  await expect(button('Neon Straight')).toBeDisabled();

  await button('Foundry Loop').click();
  await winNextRace(page);
  await expect(award).toContainText('Rookie Crest');
  await expect(award).toContainText('Street League');
  await expect(wallet).toHaveText('260');

  await page.reload();
  await expect(award).toContainText('Rookie Crest');
  await expect(wallet).toHaveText('260');
  await button('Race Again').click();
  await expect(page.getByRole('heading', { name: 'Foundry Loop', exact: true })).toBeVisible();
  await winNextRace(page);
  await expect(award).toHaveCount(0);
  await expect(wallet).toHaveText('360');

  await button('Back to Career').click();
  await page.reload();
  await button('Career').click();
  await expect(page.getByTestId('career-current-league')).toHaveText('Street League');
  await expect(button('Neon Straight')).toBeEnabled();
  await expect(button('Apex Sprint')).toBeDisabled();
  await expect(page.locator('[data-league-id="rookie"]')).toContainText('Completed');
});
