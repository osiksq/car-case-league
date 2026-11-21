import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openStarter(page: Page) {
  await page.goto('./');
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

  await startRace(page, 'Drag Race');
  await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible();
  await expect(page.getByTestId('coin-balance')).toHaveText(/^(120|160)$/);

  await page.getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByRole('button', { name: 'Open Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip Animation', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  const afterPurchase = await page.getByTestId('coin-balance').innerText();
  expect(afterPurchase).toMatch(/^(0|40)$/);
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
  expect(afterRace).toMatch(/^(120|160)$/);
  await page.reload();
  await expect(page.getByTestId('coin-balance')).toHaveText(afterRace);
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible();
});

test('layout fits the viewport including on mobile', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Open Free Case', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cases', exact: true })).toHaveAttribute('aria-current', 'page');
  const pool = page.locator('details').filter({ has: page.getByText('Vehicle Pool', { exact: true }) });
  await expect(pool).toHaveJSProperty('open', false);
  await pool.locator('summary').click();
  await expect(pool).toHaveJSProperty('open', true);
  await expect(pool.locator('article')).toHaveCount(6);
  await pool.locator('article').last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId('coin-balance')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('the reel and race progress finish automatically', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Free Case', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();

  await startRace(page, 'Drag Race');
  const lane = page.getByRole('progressbar', { name: 'Your car race progress' });
  await expect(lane).toBeVisible();
  await expect(lane).toHaveAttribute('aria-valuenow', /^[1-9]\d*$/);
  await expect(page.getByRole('heading', { name: 'Race Results' })).toBeVisible({ timeout: 18_000 });
});
