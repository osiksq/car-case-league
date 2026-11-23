import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { cars } from '../../src/game/config';
import { simulateRace } from '../../src/game/race';
import { storageKey } from '../../src/game/save';

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
  await button('Junkyard Case').click();
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
  await expect(wallet).toHaveText('250');
  await expect(award).toHaveCount(0);
  await button('Back to Career').click();
  await expect(button('Neon Straight')).toBeDisabled();

  await button('Foundry Loop').click();
  await winNextRace(page);
  await expect(award).toContainText('Rookie Crest');
  await expect(award).toContainText('Street League');
  await expect(wallet).toHaveText('440');

  await page.reload();
  await expect(award).toContainText('Rookie Crest');
  await expect(wallet).toHaveText('440');
  await button('Race Again').click();
  await expect(page.getByRole('heading', { name: 'Foundry Loop', exact: true })).toBeVisible();
  await winNextRace(page);
  await expect(award).toHaveCount(0);
  await expect(wallet).toHaveText('488');
  await button('Race Again').click();
  await winNextRace(page);
  await expect(wallet).toHaveText('488');

  await button('Back to Career').click();
  await page.reload();
  await button('Career').click();
  await expect(page.getByTestId('career-current-league')).toHaveText('Street League');
  await expect(button('Neon Straight')).toBeEnabled();
  await expect(button('Apex Sprint')).toBeDisabled();
  await expect(page.locator('[data-league-id="rookie"]')).toContainText('Completed');
});

test('a saved Alpha 0.2 wallet, garage and promotion migrate without a second award', async ({ page }) => {
  const player = cars.find((car) => car.id === 'petrel-s1')!;
  const first = { ...simulateRace('race-1', 'drag', 'Balanced', player, 120),
    won: true, reward: 100, careerEventId: 'depot-sprint' };
  const second = { ...simulateRace('race-2', 'circuit', 'Balanced', player, 120),
    won: true, reward: 100, careerEventId: 'foundry-loop', careerAward: 'rookie' };
  await page.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, saved);
  }, { key: storageKey, saved: JSON.stringify({
    version: 1, coins: 721, garage: [{ id: 'car-1', carId: player.id, locked: true }], selectedId: 'car-1',
    progress: { casesOpened: 1, racesCompleted: 2 }, races: [first, second], pendingRace: second, pendingCase: null,
  }) });

  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await page.goto('./');
  await expect(page.getByTestId('career-award')).toContainText('Rookie Crest');
  await expect(page.getByTestId('coin-balance')).toHaveText('721');
  await button('Back to Career').click();
  await expect(button('Neon Straight')).toBeEnabled();
  await button('Cases').click();
  await button('Junkyard Case').click();
  await button('Open Free Case').click();
  await button('Go to Garage').click();
  await expect(page.getByTestId('garage-car')).toHaveCount(2);
  await expect(button('Unlock Petrel S1').first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('coin-balance')).toHaveText('721');
  await button('Junkyard Case').click();
  await expect(button('Open Free Case')).toBeDisabled();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(saved.version).toBe(2);
  expect(saved.career.completed).toEqual(['depot-sprint', 'foundry-loop']);
  expect(saved.races.map(({ reward }: { reward: number }) => reward)).toEqual([100, 100]);
});
