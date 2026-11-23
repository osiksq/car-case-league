import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { caseIds, cases } from '../../src/game/cases';
import { createGame } from '../../src/game/save';

const releaseSaveKey = 'car-case-league.save';
const localSaveKey = 'car-case-league.save.dev';

async function openCase(page: Page, free = false) {
  await page.getByRole('button', { name: free ? 'Open Free Case' : 'Open Case', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
}

test.use({ reducedMotion: 'reduce' });

test('infinite money grants cars without debiting the isolated wallet', async ({ page }) => {
  const releaseSave = JSON.stringify({ ...createGame(), coins: 23 });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: releaseSaveKey, value: releaseSave });
  await page.goto('./');
  const wallet = page.getByTestId('coin-balance');
  const developer = page.getByRole('button', { name: 'DEV', exact: true });
  const panel = page.getByRole('dialog', { name: 'Developer Tools' });
  const toggle = panel.getByRole('switch', { name: 'Infinite Money' });

  await expect(wallet).toHaveText('60');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await openCase(page, true);
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Free Case', exact: true })).toBeDisabled();

  await developer.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(wallet).toHaveText('∞');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Back to Cases', exact: true }).click();
  await page.getByRole('button', { name: 'Rookie Case', exact: true }).click();
  await openCase(page);
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await openCase(page);
  await developer.click();
  await toggle.click();
  await expect(wallet).toHaveText('60');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();
  await expect(page.getByTestId('garage-car')).toHaveCount(3);
  expect(await page.evaluate((key) => localStorage.getItem(key), releaseSaveKey)).toBe(releaseSave);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).coins, localSaveKey)).toBe(60);
});

test('test credits use normal prices and reset requires confirmation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await openCase(page, true);
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  const developer = page.getByRole('button', { name: 'DEV', exact: true });
  const panel = page.getByRole('dialog', { name: 'Developer Tools' });
  const wallet = page.getByTestId('coin-balance');
  await developer.click();
  await panel.getByRole('button', { name: 'Add 10,000 Coins' }).click();
  await expect(wallet).toHaveText('10,060');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Back to Cases', exact: true }).click();
  await page.getByRole('button', { name: 'Rookie Case', exact: true }).click();
  await openCase(page);
  await expect(wallet).toHaveText('9,810');
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await developer.click();
  const reset = panel.getByRole('button', { name: 'Reset Progress' });
  page.once('dialog', (dialog) => dialog.dismiss());
  await reset.click();
  await expect(wallet).toHaveText('9,810');
  page.once('dialog', (dialog) => dialog.accept());
  await reset.click();
  await expect(wallet).toHaveText('60');
  await page.getByRole('button', { name: 'Junkyard Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Free Case', exact: true })).toBeEnabled();
});

test('infinite money unlocks all eight cases without debiting the wallet', async ({ page }) => {
  await page.goto('./');
  const developer = page.getByRole('button', { name: 'DEV', exact: true });
  const panel = page.getByRole('dialog', { name: 'Developer Tools' });
  await developer.click();
  await panel.getByRole('switch', { name: 'Infinite Money' }).click();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();

  for (const id of caseIds) {
    const { name } = cases[id];
    await page.getByRole('button', { name, exact: true }).click();
    await openCase(page, id === 'junkyard');
    await expect(page.locator('.case-result-screen .eyebrow')).toHaveText(new RegExp(name, 'i'));
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Cases', exact: true }).click();
  }

  await developer.click();
  await panel.getByRole('switch', { name: 'Infinite Money' }).click();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('coin-balance')).toHaveText('60');
  await page.getByRole('button', { name: 'Hyper Case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Case', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'My Garage', exact: true }).click();
  await expect(page.getByTestId('garage-car')).toHaveCount(8);
});
