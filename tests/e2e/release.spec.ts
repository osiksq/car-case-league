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

test('public sandbox opens paid cases without modifying the normal save', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const wallet = page.getByTestId('coin-balance');
  async function toggleSandbox() {
    await button('Sandbox').click();
    await page.getByRole('switch', { name: 'Unlimited coins' }).click();
  }

  await page.goto('./');
  await button('Open Free Case').click();
  await button('Keep').click();
  await expect(button('Open Case')).toBeDisabled();
  const normalSave = await page.evaluate(() => localStorage.getItem('car-case-league.save'));
  expect(normalSave).toBeTruthy();
  await expect(wallet).toHaveText('60');

  await toggleSandbox();
  await expect(wallet).toHaveText('∞');
  await button('Elite Case').click();
  await button('Open Case').click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  await button('Go to Garage').click();
  const sandboxGarage = page.getByTestId('garage-car');
  await expect(sandboxGarage).toHaveCount(1);
  const sandboxCar = await sandboxGarage.getByRole('heading').textContent();

  await toggleSandbox();
  await expect(wallet).toHaveText('60');
  await expect(button('Open Case')).toBeDisabled();
  await page.reload();
  await expect(wallet).toHaveText('60');
  expect(await page.evaluate(() => localStorage.getItem('car-case-league.save'))).toBe(normalSave);

  await toggleSandbox();
  await button('My Garage').click();
  await expect(sandboxGarage).toHaveCount(1);
  await expect(sandboxGarage.getByRole('heading')).toHaveText(sandboxCar!);
});
