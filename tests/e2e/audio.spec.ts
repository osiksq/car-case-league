import { expect, test, type Page } from '@playwright/test';
import { storageKey } from '../../src/game/save';

const audioKey = 'car-case-league.audio';

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function openAudioPanel(page: Page) {
  await button(page, 'Sound').click();
  const panel = page.getByRole('dialog', { name: 'Sound', exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function startJunkyard(page: Page) {
  await button(page, 'Junkyard Case').click();
  await button(page, 'Open Free Case').click();
  await expect(button(page, 'Skip Animation')).toBeVisible();
}

test('audio starts after a gesture and remembers Sound and the three volume controls', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    let contexts = 0;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        document.documentElement.dataset.audioContexts = String(++contexts);
      }
    };
  });
  await page.goto('./');
  const root = page.locator('html');
  await expect(page.getByRole('heading', { name: 'Case Collection' })).toBeVisible();
  await expect(root).not.toHaveAttribute('data-audio-contexts', /\d+/);

  await button(page, 'Junkyard Case').click();
  await expect(root).toHaveAttribute('data-audio-contexts', '1');
  const panel = await openAudioPanel(page);
  const sound = panel.getByRole('switch', { name: 'Sound', exact: true });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  const selectedVolumes = [
    { name: 'Master Volume', key: 'Home', value: '0' },
    { name: 'Engine Volume', key: 'End', value: '100' },
    { name: 'Effects Volume', key: 'Home', value: '0' },
  ];
  for (const setting of selectedVolumes) {
    const slider = panel.getByRole('slider', { name: setting.name, exact: true });
    await slider.press(setting.key);
    await expect(slider).toHaveValue(setting.value);
  }
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await expect(root).toHaveAttribute('data-audio-contexts', '1');
  const settings = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), audioKey);
  expect(settings).toEqual({ enabled: false, master: 0, engine: 100, effects: 0 });

  await page.reload();
  await openAudioPanel(page);
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  for (const setting of selectedVolumes) {
    await expect(panel.getByRole('slider', { name: setting.name, exact: true })).toHaveValue(setting.value);
  }
  await expect(root).not.toHaveAttribute('data-audio-contexts', /\d+/);
});

test('the previous race mute remains respected until edited in the audio panel', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('car-case-league.race-sound', 'false');
  });
  await page.goto('./');
  const panel = await openAudioPanel(page);
  await expect(panel.getByRole('switch', { name: 'Sound', exact: true })).toHaveAttribute('aria-checked', 'false');
});

test('blocking Web Audio does not interrupt case awards or result recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        Object.defineProperty(this, 'state', { value: 'suspended' });
      }

      resume() {
        return Promise.reject(new DOMException('Playback blocked by policy', 'NotAllowedError'));
      }
    };
  });
  await page.goto('./');
  await startJunkyard(page);
  await button(page, 'Skip Animation').click();
  const result = page.getByRole('heading', { name: 'Case Result' });
  await expect(result).toBeVisible();
  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await page.reload();
  await expect(result).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(saved);
  expect(errors).toEqual([]);
});

test('a full case opening plays the recorded selection, reel build and matching reveal', async ({ page }) => {
  await page.addInitScript(() => {
    const responseBytes = Response.prototype.arrayBuffer;
    const decode = AudioContext.prototype.decodeAudioData;
    const start = AudioBufferSourceNode.prototype.start;
    const inputFiles = new WeakMap<ArrayBuffer, string>();
    const decodedFiles = new WeakMap<AudioBuffer, string>();
    const played: string[] = [];

    Response.prototype.arrayBuffer = async function () {
      const bytes = await responseBytes.call(this);
      const asset = this.url.match(/\/audio\/([^/]+)\.mp3$/)?.[1];
      if (asset) inputFiles.set(bytes, asset);
      return bytes;
    };
    AudioContext.prototype.decodeAudioData = async function (bytes, onSuccess, onError) {
      const input = inputFiles.get(bytes);
      const buffer = await decode.call(this, bytes, onSuccess, onError);
      if (input) decodedFiles.set(buffer, input);
      return buffer;
    };
    AudioBufferSourceNode.prototype.start = function (...args) {
      const asset = this.buffer && decodedFiles.get(this.buffer);
      if (asset) {
        played.push(asset);
        document.documentElement.dataset.playedAudio = played.join(',');
      }
      start.apply(this, args);
    };
  });
  await page.goto('./');
  const root = page.locator('html');
  await button(page, 'Junkyard Case').click();
  await expect(root).toHaveAttribute('data-played-audio', /case-select/);
  await button(page, 'Open Free Case').click();
  await expect(button(page, 'Skip Animation')).toBeVisible();
  await expect(root).toHaveAttribute('data-played-audio', /case-open/, { timeout: 3_000 });
  await expect(root).toHaveAttribute('data-played-audio', /reel-rise/, { timeout: 3_000 });
  await expect(root).toHaveAttribute('data-played-audio', /reel-tick/);
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  const badges = page.locator('.case-result .badges');
  const rarity = await badges.getByText(/^(Common|Uncommon)$/).innerText();
  const played = (await root.getAttribute('data-played-audio'))?.split(',') ?? [];
  expect(played.filter((asset) => asset === 'reel-rise')).toHaveLength(1);
  await expect(root).toHaveAttribute('data-played-audio', new RegExp(`reel-stop,.*reward-${rarity.toLowerCase()}`));
});

test('a hidden tab pauses the roulette and stays quiet until foreground playback resumes', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    let sources = 0;
    const active = new Set<AudioBufferSourceNode>();
    AudioBufferSourceNode.prototype.start = function (...args) {
      document.documentElement.dataset.startedAudioSources = String(++sources);
      active.add(this);
      document.documentElement.dataset.activeAudioSources = String(active.size);
      this.addEventListener('ended', () => {
        active.delete(this);
        document.documentElement.dataset.activeAudioSources = String(active.size);
      }, { once: true });
      start.apply(this, args);
    };
  });
  await page.goto('./');
  await startJunkyard(page);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-started-audio-sources', /[1-9]/);
  const reel = page.locator('.roulette-track');
  await page.clock.fastForward(350);
  await expect(reel).toHaveAttribute('style', /translate(?:X|3d)\(-[1-9]/);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const position = await reel.getAttribute('style');
  const hiddenSources = await root.getAttribute('data-started-audio-sources');
  await page.clock.fastForward(10_000);
  await expect(reel).toHaveAttribute('style', position!);
  await expect(root).toHaveAttribute('data-started-audio-sources', hiddenSources!);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(250);
  await expect(reel).not.toHaveAttribute('style', position!);
  expect(Number(await root.getAttribute('data-started-audio-sources')) - Number(hiddenSources)).toBeLessThan(8);
  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await button(page, 'Skip Animation').click();
  await expect(page.getByRole('heading', { name: 'Case Result' })).toBeVisible();
  await expect(root).toHaveAttribute('data-active-audio-sources', '0');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(saved);
});
