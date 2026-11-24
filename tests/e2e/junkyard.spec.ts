import { expect, test, type Page } from '@playwright/test';
import { economy } from '../../src/game/economy';
import { storageKey } from '../../src/game/save';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const openFree = (page: Page) => button(page, 'Open Free Case');
const result = (page: Page) => page.getByRole('heading', { name: 'Case Result', exact: true });

function rawSave(page: Page, key = storageKey) {
  return page.evaluate((key) => localStorage.getItem(key), key);
}

async function revealJunkyard(page: Page) {
  await openFree(page).click();
  await expect(result(page)).toBeVisible();
}

test.use({ reducedMotion: 'reduce' });

test('Reset Progress cannot renew the normal Junkyard earlier than sixty seconds', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-24T12:00:00Z') });
  await page.goto('./');
  await button(page, 'Junkyard Case').click();
  await revealJunkyard(page);
  const openedAt = JSON.parse((await rawSave(page))!).timing.junkyardOpenedAt;
  await button(page, 'Keep').click();
  await expect(openFree(page)).toBeDisabled();

  await button(page, 'Settings').click();
  page.once('dialog', (dialog) => dialog.accept());
  await button(page, 'Reset Progress').click();
  await expect(page.getByRole('heading', { name: 'Case Collection' })).toBeVisible();
  await button(page, 'Junkyard Case').click();
  await expect(openFree(page)).toBeDisabled();
  const reset = JSON.parse((await rawSave(page))!);
  expect(reset.garage).toEqual([]);
  expect(reset.progress.casesOpened).toBe(0);
  expect(reset.timing.junkyardOpenedAt).toBe(openedAt);

  await page.addInitScript(() => {
    Object.defineProperty(performance, 'timeOrigin', { configurable: true, value: 0 });
  });
  await page.reload();
  await button(page, 'Junkyard Case').click();
  await expect(openFree(page)).toBeDisabled();
  await page.clock.fastForward(economy.junkyardCooldownMs);
  await revealJunkyard(page);
  const next = JSON.parse((await rawSave(page))!);
  expect(next.timing.junkyardOpenedAt - openedAt).toBeGreaterThanOrEqual(economy.junkyardCooldownMs);
  expect(next.garage).toHaveLength(1);
});

test('rapid requests in two tabs grant one free case and cannot bypass the saved cooldown', async ({ page, context }) => {
  const other = await context.newPage();
  const chooseJunkyard = async (current: Page) => {
    await current.goto('./');
    await button(current, 'Junkyard Case').click();
    await expect(openFree(current)).toBeEnabled();
  };
  await Promise.all([chooseJunkyard(page), chooseJunkyard(other)]);
  const openingButtons = await Promise.all([page, other].map((current) => openFree(current).elementHandle()));
  await Promise.all(openingButtons.map((handle) => handle!.evaluate((element) => {
    // Simulate two events arriving before the UI can disable the button.
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })));
  await expect(result(page)).toBeVisible();
  await expect(result(other)).toBeVisible();
  const opened = JSON.parse((await rawSave(page))!);
  expect(opened.garage).toHaveLength(1);
  expect(opened.progress.casesOpened).toBe(1);
  await button(page, 'Keep').click();
  await expect(openFree(page)).toBeDisabled();

  // Force the event through a disabled presentation control to exercise the domain guard.
  await openFree(page).dispatchEvent('click');
  await expect(page.getByRole('alert')).toContainText(/Junkyard is ready in/);
  expect(JSON.parse((await rawSave(page))!).progress.casesOpened).toBe(1);
});

test('navigation and Sandbox keep the normal Junkyard cooldown separate', async ({ page }) => {
  await page.goto('./');
  await button(page, 'Junkyard Case').click();
  await revealJunkyard(page);
  await button(page, 'Keep').click();
  await expect(openFree(page)).toBeDisabled();
  const normal = await rawSave(page);

  await button(page, 'Back to Cases').click();
  await button(page, 'Rookie Case').click();
  await button(page, 'My Garage').click();
  await button(page, 'Cases').click();
  await button(page, 'Junkyard Case').click();
  await expect(openFree(page)).toBeDisabled();
  expect(await rawSave(page)).toBe(normal);

  await button(page, 'Sandbox').click();
  await page.getByRole('switch', { name: 'Unlimited coins' }).click();
  await button(page, 'Junkyard Case').click();
  for (let count = 0; count < 3; count++) {
    await revealJunkyard(page);
    await button(page, 'Keep').click();
  }
  const sandbox = JSON.parse((await rawSave(page, `${storageKey}.sandbox`))!);
  expect(sandbox.progress.casesOpened).toBe(3);
  expect(sandbox.timing.junkyardOpenedAt).toBeNull();
  expect(await rawSave(page)).toBe(normal);

  await button(page, 'Settings').click();
  page.once('dialog', (dialog) => dialog.accept());
  await button(page, 'Reset Progress').click();
  await expect(page.getByRole('heading', { name: 'Case Collection' })).toBeVisible();
  expect(JSON.parse((await rawSave(page, `${storageKey}.sandbox`))!).progress.casesOpened).toBe(0);
  expect(await rawSave(page)).toBe(normal);

  await button(page, 'Sandbox').click();
  await page.getByRole('switch', { name: 'Unlimited coins' }).click();
  await button(page, 'Junkyard Case').click();
  await expect(openFree(page)).toBeDisabled();
  expect(await rawSave(page)).toBe(normal);
});
