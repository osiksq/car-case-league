import { expect, test } from '@playwright/test';
import { createGame, storageKey } from '../../src/game/save';

const expectedCases = [
  { name: 'Rookie Case', odds: [70, 25, 5, 0, 0, 0], pool: 6 },
  { name: 'Street Case', odds: [35, 45, 18, 2, 0, 0], pool: 8 },
  { name: 'Performance Case', odds: [0, 25, 45, 26, 4, 0], pool: 8 },
  { name: 'Elite Case', odds: [0, 0, 20, 55, 24, 1], pool: 8 },
];
const tiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

test('selecting a case updates the action, exact odds and the visible pool', async ({ page }) => {
  await page.goto('./');
  const pool = page.locator('details').filter({ has: page.getByText('Vehicle Pool', { exact: true }) });
  for (const [index, entry] of expectedCases.entries()) {
    const selection = page.getByRole('button', { name: entry.name, exact: true });
    await selection.click();
    await expect(selection).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: entry.name, exact: true })).toBeVisible();
    const action = page.getByRole('button', { name: index === 0 ? 'Open Free Case' : 'Open Case', exact: true });
    if (index === 0) await expect(action).toBeEnabled();
    else await expect(action).toBeDisabled();

    const odds = page.getByRole('region', { name: 'Drop odds' }).getByRole('listitem');
    await expect(odds).toHaveCount(tiers.length);
    for (const [tierIndex, tier] of tiers.entries()) {
      const row = odds.filter({ has: page.getByText(tier, { exact: true }) });
      await expect(row.getByText(`${entry.odds[tierIndex]}%`, { exact: true })).toBeVisible();
    }
    if (!await pool.evaluate((element: HTMLDetailsElement) => element.open)) {
      await pool.locator('summary').click();
    }
    await expect(pool.locator('article')).toHaveCount(entry.pool);
    const visibleTiers = await pool.locator('.rarity-badge').allTextContents();
    expect(visibleTiers.every((tier) => entry.odds[tiers.indexOf(tier.trim())] > 0)).toBe(true);
  }
});

test('paid reel lands on the acquired car and its case survives reload', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: storageKey, value: JSON.stringify({ ...createGame(), coins: 750 }) });

  await page.goto('./');
  await page.getByRole('button', { name: 'Elite Case', exact: true }).click();
  await page.getByRole('button', { name: 'Open Case', exact: true }).click();
  const winner = page.locator('[data-reel-winner]');
  await expect(winner).toHaveCount(1);
  const wonId = await winner.getAttribute('data-car-id');
  const reelRarities = await page.locator('.roulette-card .rarity-badge').allTextContents();
  expect(reelRarities.length).toBeGreaterThan(20);
  expect(reelRarities.every((tier) => ['Rare', 'Epic', 'Legendary', 'Mythic'].includes(tier.trim()))).toBe(true);
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
