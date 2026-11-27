import { expect, test, type Page } from '@playwright/test';
import { cars } from '../../src/game/config';
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

test('rapid requests across two tabs grant one free drop and credit one sale', async ({ page, context }) => {
  const other = await context.newPage();
  const tabs = [page, other];
  const chooseJunkyard = async (current: Page) => {
    await current.goto('./');
    await button(current, 'Junkyard Case').click();
    await expect(openFree(current)).toBeEnabled();
  };
  await Promise.all(tabs.map(chooseJunkyard));

  async function simultaneousClicks(name: string) {
    const controls = await Promise.all(tabs.map((current) => button(current, name).elementHandle()));
    await page.evaluate(async (key) => {
      // Keep the write lock until both pages have dispatched their commands.
      await new Promise<void>((ready) => {
        void navigator.locks.request(key, () => new Promise<void>((release) => {
          window.addEventListener('test-release-save-lock', () => release(), { once: true });
          ready();
        }));
      });
    }, storageKey);
    try {
      await Promise.all(controls.map((control) => control!.evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      })));
      await expect.poll(() => page.evaluate(async (key) => {
        const state = await navigator.locks.query();
        return state.pending?.filter(({ name }) => name === key).length;
      }, storageKey)).toBe(2);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event('test-release-save-lock')));
    }
  }

  await simultaneousClicks('Open Free Case');
  for (const tab of tabs) await expect(result(tab)).toBeVisible();
  const starter = JSON.parse((await rawSave(page))!);
  expect(starter.progress.casesOpened).toBe(1);
  expect(starter.garage).toHaveLength(1);
  await button(page, 'Keep').click();
  for (const tab of tabs) await expect(openFree(tab)).toBeEnabled();

  await simultaneousClicks('Open Free Case');
  for (const tab of tabs) await expect(result(tab)).toBeVisible();
  const opened = JSON.parse((await rawSave(page))!);
  expect(opened.progress.casesOpened).toBe(2);
  expect(opened.garage).toHaveLength(2);
  const drop = cars.find(({ id }) => id === opened.garage[1].carId)!;
  await simultaneousClicks('Sell');
  for (const tab of tabs) await expect(openFree(tab)).toBeEnabled();
  const sold = JSON.parse((await rawSave(page))!);
  expect(sold.pendingCase).toBeNull();
  expect(sold.progress.casesOpened).toBe(2);
  expect(sold.garage).toEqual(starter.garage);
  expect(sold.coins).toBe(starter.coins + drop.resaleValue);
});

test('navigation and Sandbox keep the normal Junkyard save separate', async ({ page }) => {
  await page.goto('./');
  await button(page, 'Junkyard Case').click();
  await revealJunkyard(page);
  await button(page, 'Keep').click();
  await expect(openFree(page)).toBeEnabled();
  const normal = await rawSave(page);

  await button(page, 'Back to Cases').click();
  await button(page, 'Rookie Case').click();
  await button(page, 'My Garage').click();
  await button(page, 'Cases').click();
  await button(page, 'Junkyard Case').click();
  await expect(openFree(page)).toBeEnabled();
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
  await expect(openFree(page)).toBeEnabled();
  expect(await rawSave(page)).toBe(normal);
});
