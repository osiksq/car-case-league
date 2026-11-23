import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageKey } from '../../src/game/save';

async function openStarter(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Free Case', exact: true }).click();
  await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
}

async function startRace(page: Page, event: 'Drag Race' | 'Circuit Race') {
  await page.getByRole('button', { name: 'Races', exact: true }).click();
  await page.getByRole('button', { name: event }).click();
  await page.getByRole('button', { name: 'Push', exact: true }).click();
  await page.getByRole('button', { name: 'Start Race', exact: true }).click();
}

test('first visit through a paid case survives reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await openStarter(page);
  await expect(page.getByRole('button', { name: 'Sell', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Garage', exact: true })).toBeVisible();
  await expect(page.getByTestId('coin-balance')).toHaveText('60');

  await page.getByRole('button', { name: 'Career', exact: true }).click();
  for (const competition of ['Depot Sprint', 'Foundry Loop']) {
    await page.getByRole('button', { name: competition, exact: true }).click();
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.getByRole('button', { name: 'Start Race', exact: true }).click();
      await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
      const outcome = await page.getByRole('heading', { name: /^(Victory|Defeat)$/ }).textContent();
      if (outcome === 'Victory') break;
      await page.getByRole('button', { name: 'Race Again', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Career', exact: true }).click();
  }
  await expect(page.getByTestId('coin-balance')).toHaveText('440');

  await page.getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByRole('button', { name: 'Rookie Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip Animation', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  const afterPurchase = await page.getByTestId('coin-balance').innerText();
  expect(afterPurchase).toBe('190');
  await page.reload();
  await expect(page.getByTestId('coin-balance')).toHaveText(afterPurchase);
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Garage', exact: true })).toBeVisible();
  await expect(page.getByTestId('garage-car')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'My Garage', exact: true }).click();
  const garage = page.getByTestId('garage-car');
  await expect(garage).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
  const model = garage.first();
  await model.getByRole('button', { name: /^Select / }).click();
  await expect(model.getByRole('button', { name: /^Select / })).toHaveAttribute('aria-pressed', 'true');
  await model.getByRole('button', { name: /^Lock / }).click();
  await expect(model.getByRole('button', { name: /^Sell / })).toBeDisabled();
  await model.getByRole('button', { name: /^Unlock / }).click();
  await model.getByRole('button', { name: /^Sell / }).click();
  await expect(garage).toHaveCount(1);
  await expect(garage.getByRole('button', { name: /^Sell / })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('refreshing a free reveal or race animation preserves its single award', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Free Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip Animation', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();
  await expect(page.getByTestId('garage-car')).toHaveCount(1);

  await startRace(page, 'Circuit Race');
  await expect(page.getByRole('button', { name: 'Skip Animation', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible();
  const afterRace = await page.getByTestId('coin-balance').innerText();
  expect(afterRace).toMatch(/^(60|78)$/);
  await page.reload();
  await expect(page.getByTestId('coin-balance')).toHaveText(afterRace);
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible();
});

test('layout fits the viewport including on mobile', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.case-collection .case-crate')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Free Case', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cases', exact: true })).toHaveAttribute('aria-current', 'page');
  const pool = page.locator('details').filter({ has: page.getByText('Vehicle Pool', { exact: true }) });
  await expect(pool).toHaveJSProperty('open', false);
  await pool.locator('summary').click();
  await expect(pool).toHaveJSProperty('open', true);
  await expect(pool.locator('article')).toHaveCount(3);
  await pool.locator('article').last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId('coin-balance')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('Junkyard cooldown is saved and the next car can be sold', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await page.goto('./');
  await button('Junkyard Case').click();
  await button('Open Free Case').click();
  await button('Keep').click();
  await expect(button('Open Free Case')).toBeDisabled();
  const opened = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).progress.casesOpened, storageKey);
  expect(opened).toBe(1);
  await page.reload();
  await expect(button('Junkyard Case')).toContainText(/in \d:\d{2}/);
  await button('Junkyard Case').click();
  await expect(button('Open Free Case')).toBeDisabled();
  await expect(page.getByTestId('junkyard-countdown')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(button('Open Free Case')).toBeEnabled();
  await button('Open Free Case').click();
  await button('Sell').click();
  await expect(button('Open Free Case')).toBeDisabled();
  await expect(page.getByTestId('coin-balance')).not.toHaveText('60');
  await button('My Garage').click();
  await expect(page.getByTestId('garage-car')).toHaveCount(1);
});

test('the reel and race progress finish automatically', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Free Case', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();

  await startRace(page, 'Drag Race');
  const lane = page.getByRole('progressbar', { name: 'Your car race progress' });
  await expect(lane).toBeVisible();
  await expect(lane).toHaveAttribute('aria-valuenow', /^[1-9]\d*$/);
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible({ timeout: 18_000 });
});
