import { readFile, readdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createGame } from '../../src/game/save';

test('production excludes developer controls and ignores development data', async ({ page }) => {
  await page.addInitScript((devSave) => {
    localStorage.setItem('car-case-league.save.dev', devSave);
    localStorage.setItem('infiniteMoney', 'true');
  }, JSON.stringify({ ...createGame(), coins: 10_000 }));
  await page.goto('./?dev=1&infiniteMoney=true');
  await expect(page.getByRole('button', { name: 'DEV', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('coin-balance')).toHaveText('60');
  await page.getByRole('button', { name: 'Open Free Case', exact: true }).click();
  await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Case', exact: true })).toBeDisabled();
  await expect(page.getByTestId('coin-balance')).toHaveText('60');

  const assets = new URL('../../dist/assets/', import.meta.url);
  const scripts = (await readdir(assets)).filter((file) => file.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    const source = await readFile(new URL(script, assets), 'utf8');
    expect(source).not.toMatch(/Infinite Money|Developer Tools|dev-(?:tools|money|add-coins|reset)|car-case-league\.save\.dev/);
  }
});
