import { expect, test } from '@playwright/test';
import { caseIds, casePool, cases } from '../../src/game/cases';
import { cars, rarities } from '../../src/game/config';
import { createGame, storageKey } from '../../src/game/save';

test('the collection displays all eight models in price order and opens their details', async ({ page }) => {
  await page.goto('./');
  const collection = page.getByRole('region', { name: 'Case Collection' });
  const choices = collection.getByRole('button');
  await expect(choices).toHaveCount(8);
  await expect(collection.locator('.case-crate')).toHaveCount(8);
  expect(await choices.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-id')))).toEqual(caseIds);
  await expect(choices.first()).toContainText('Free');
  await expect(page.getByRole('button', { name: 'Open Free Case', exact: true })).toHaveCount(0);
  const pool = page.locator('details').filter({ has: page.getByText('Vehicle Pool', { exact: true }) });
  for (const id of caseIds) {
    const entry = cases[id];
    const selection = page.getByRole('button', { name: entry.name, exact: true });
    await selection.click();
    await expect(collection).toHaveCount(0);
    await expect(page.getByRole('heading', { name: entry.name, exact: true })).toBeFocused();
    await expect(page.locator('.case-crate')).toHaveCount(1);
    const action = page.getByRole('button', { name: id === 'junkyard' ? 'Open Free Case' : 'Open Case', exact: true });
    if (id === 'junkyard') await expect(action).toBeEnabled();
    else await expect(action).toBeDisabled();

    const odds = page.getByRole('region', { name: 'Drop odds' }).getByRole('listitem');
    await expect(odds).toHaveCount(rarities.length);
    for (const tier of rarities) {
      const row = odds.filter({ has: page.getByText(tier, { exact: true }) });
      await expect(row.getByText(`${entry.odds[tier]}%`, { exact: true })).toBeVisible();
    }
    if (!await pool.evaluate((element: HTMLDetailsElement) => element.open)) {
      await pool.locator('summary').click();
    }
    await expect(pool.locator('article')).toHaveCount(casePool(id, id === 'junkyard').length);
    const visibleTiers = await pool.locator('.rarity-badge').allTextContents();
    expect(visibleTiers.every((tier) => rarities.some((rarity) => tier.trim() === rarity && entry.odds[rarity] > 0))).toBe(true);
    await page.getByRole('button', { name: 'Back to Cases', exact: true }).click();
    await expect(selection).toBeFocused();
  }
});

test('paid reel lands on the acquired car and its case survives reload', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: storageKey, value: JSON.stringify({ ...createGame(), coins: cases.elite.price + 50 }) });

  await page.goto('./');
  await page.getByRole('button', { name: 'Elite Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Case', exact: true }).click();
  const winner = page.locator('[data-reel-winner]');
  await expect(winner).toHaveCount(1);
  const wonId = await winner.getAttribute('data-car-id');
  const reelRarities = await page.locator('.roulette-card .rarity-badge').allTextContents();
  expect(reelRarities.length).toBeGreaterThan(20);
  expect(reelRarities.every((tier) => rarities.some((rarity) => tier.trim() === rarity && cases.elite.odds[rarity] > 0))).toBe(true);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(saved.garage[0].carId).toBe(wonId);
  expect(saved.coins).toBe(50);
  expect(saved.pendingCaseType).toBe('elite');

  await page.waitForFunction(() => {
    const card = document.querySelector('[data-reel-winner]')?.getBoundingClientRect();
    const marker = document.querySelector('.roulette-marker')?.getBoundingClientRect();
    return card && marker && Math.abs(card.left + card.width / 2 - marker.left - marker.width / 2) < 0.5;
  }, undefined, { timeout: 5_000 });
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  await expect(page.locator('.case-result')).toHaveAttribute('data-car-id', wonId!);
  await expect(page.getByTestId('coin-balance')).toHaveText('50');
  await page.reload();
  await expect(page.locator('.case-result')).toHaveAttribute('data-car-id', wonId!);
  await expect(page.locator('.case-result-screen .eyebrow')).toHaveText(/elite case/i);
  await page.getByRole('button', { name: 'Go to Garage', exact: true }).click();
  await expect(page.getByTestId('garage-car')).toHaveCount(1);
});

test('all fifty vehicle images decode under the production base path', async ({ page }) => {
  await page.goto('./');
  const broken = await page.evaluate(async (indexes) => {
    const results = await Promise.all(indexes.map(async (index) => {
      const image = new Image();
      image.src = `./cars/${index}.webp`;
      try {
        await image.decode();
        return image.naturalWidth > 0 && image.naturalHeight > 0 ? null : index;
      } catch {
        return index;
      }
    }));
    return results.filter((index) => index !== null);
  }, cars.map(({ artIndex }) => artIndex));
  expect(cars).toHaveLength(50);
  expect(broken).toEqual([]);
});
