import { expect, test, type Page } from '@playwright/test';
import { events, type EventId } from '../../src/game/config';
import { createGame, startRace, storageKey } from '../../src/game/save';

const starter = {
  ...createGame(),
  garage: [{ id: 'car-1', carId: 'petrel-s1', locked: false }],
  selectedId: 'car-1',
  progress: { casesOpened: 1, racesCompleted: 0 },
};

async function prepareRace(page: Page, eventId: EventId, seed = 120) {
  await page.addInitScript(({ key, state, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, state);
    const source = crypto.getRandomValues;
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: Uint32Array) {
        Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: source });
        array[0] = seed;
        return array;
      },
    });
  }, { key: storageKey, state: JSON.stringify(starter), seed });
  await page.goto('./');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await button('Races').click();
  await button(events[eventId].name).click();
  return button;
}

async function savedState(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
}

test('four free disciplines show the opponent used by the saved race', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const button = await prepareRace(page, 'drag');
  for (const event of Object.keys(events) as EventId[]) {
    await button(events[event].name).click();
    const opponent = page.getByTestId('race-preview-opponent');
    await expect(opponent).toBeVisible();
    const rivalId = await opponent.getAttribute('data-car-id');
    await button('Start Race').click();
    await expect(page.getByRole('heading', { name: 'Race Results', exact: true })).toBeVisible();
    await expect(page.locator('[data-race-scene]')).toHaveCount(0);
    const race = (await savedState(page)).pendingRace;
    expect(race.eventId).toBe(event);
    expect(race.opponentCarId).toBe(rivalId);
    await expect(page.getByRole('heading', { name: race.won ? 'Victory' : 'Defeat', exact: true })).toBeVisible();
    await button('Race Again').click();
  }
});

for (const [eventId, won] of [['circuit', true], ['wet-circuit', false]] as const) {
  test(`the first visual finisher matches the saved ${won ? 'victory' : 'defeat'}`, async ({ page }) => {
    const seeds = Array.from({ length: 100 }, (_, index) => 901 + index);
    const seed = seeds.find((value) => startRace(starter, eventId, 'Balanced', value).pendingRace?.won === won);
    expect(seed).toBeDefined();
    await page.clock.install();
    const button = await prepareRace(page, eventId, seed);
    await button('Start Race').click();
    const scene = page.locator('[data-race-scene]');
    await expect(scene).toHaveAttribute('data-race-status', 'countdown');
    await expect(scene.locator('[data-race-canvas]')).toBeVisible();
    const artwork = scene.locator('[data-scene-car]');
    await expect(artwork).toHaveCount(2);
    await expect(artwork.first()).toBeHidden();
    await expect(artwork.last()).toBeHidden();
    await expect(button('Skip Race')).toBeVisible();
    await scene.evaluate((stage) => {
      const observer = new MutationObserver(() => {
        const finisher = stage.getAttribute('data-first-finisher');
        if (!finisher) return;
        document.documentElement.dataset.observedFinisher = finisher;
        observer.disconnect();
      });
      observer.observe(stage, { attributes: true, attributeFilter: ['data-first-finisher'] });
    });
    await page.clock.fastForward(4_000);
    await expect(scene).toHaveAttribute('data-race-status', 'racing');
    const saved = await savedState(page);
    expect(saved.pendingRace.won).toBe(won);
    await page.clock.fastForward(30_000);
    await expect(page.locator('html')).toHaveAttribute('data-observed-finisher', won ? 'player' : 'opponent');
    await expect(page.getByRole('heading', { name: won ? 'Victory' : 'Defeat', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: won ? 'Victory' : 'Defeat', exact: true })).toBeVisible();
    expect(await savedState(page)).toEqual(saved);
  });
}

test('race audio follows the start, pauses with the scene, and stops on Skip Race', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const observe = ResizeObserver.prototype.observe;
    const disconnect = ResizeObserver.prototype.disconnect;
    const activeSceneObservers = new Set<ResizeObserver>();
    ResizeObserver.prototype.observe = function (target, options) {
      if (target.matches('[data-race-canvas]')) {
        activeSceneObservers.add(this);
        document.documentElement.dataset.activeSceneObservers = String(activeSceneObservers.size);
      }
      observe.call(this, target, options);
    };
    ResizeObserver.prototype.disconnect = function () {
      if (activeSceneObservers.delete(this)) {
        document.documentElement.dataset.activeSceneObservers = String(activeSceneObservers.size);
      }
      disconnect.call(this);
    };
    const read = Response.prototype.arrayBuffer;
    const decode = AudioContext.prototype.decodeAudioData;
    const fileByBytes = new WeakMap<ArrayBuffer, string>();
    const fileByBuffer = new WeakMap<AudioBuffer, string>();
    Response.prototype.arrayBuffer = async function () {
      const bytes = await read.call(this);
      fileByBytes.set(bytes, this.url.split('/').at(-1) ?? '');
      return bytes;
    };
    AudioContext.prototype.decodeAudioData = async function (bytes) {
      const name = fileByBytes.get(bytes);
      const buffer = await decode.call(this, bytes);
      if (name) fileByBuffer.set(buffer, name);
      return buffer;
    };
    const original = AudioContext.prototype.createBufferSource;
    const active = new Set<AudioBufferSourceNode>();
    function updateAudioState() {
      document.documentElement.dataset.activeSoundSources = String(active.size);
    }
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this);
      const start = source.start.bind(source);
      source.start = (...args) => {
        active.add(source);
        updateAudioState();
        const file = source.buffer && fileByBuffer.get(source.buffer);
        if (file === 'countdown.mp3') document.documentElement.dataset.countdownSound = 'true';
        if (file === 'go.mp3') document.documentElement.dataset.startSound = 'true';
        if (source.loop && file === 'engine-vintage.mp3') document.documentElement.dataset.motorSound = 'true';
        start(...args);
      };
      source.addEventListener('ended', () => { active.delete(source); updateAudioState(); });
      return source;
    };
  });
  const button = await prepareRace(page, 'endurance');
  await button('Start Race').click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-countdown-sound', 'true');
  await page.clock.fastForward(4_000);
  await expect(html).toHaveAttribute('data-start-sound', 'true', { timeout: 7_000 });
  await expect(html).toHaveAttribute('data-motor-sound', 'true');
  await expect(html).toHaveAttribute('data-active-scene-observers', '1');
  const scene = page.locator('[data-race-scene]');
  await expect(scene).toHaveAttribute('data-race-status', 'racing');
  const setHidden = (hidden: boolean) => page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, value: hidden ? 'hidden' : 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  const frozenProgress = await scene.getAttribute('data-player-progress');
  await page.clock.fastForward(25_000);
  await expect(scene).toHaveAttribute('data-player-progress', frozenProgress!);
  await setHidden(false);
  await page.clock.fastForward(350);
  await expect(scene).not.toHaveAttribute('data-player-progress', frozenProgress!);
  const saved = await savedState(page);
  await button('Skip Race').click();
  await expect(html).toHaveAttribute('data-active-sound-sources', '0');
  await expect(html).toHaveAttribute('data-active-scene-observers', '0');
  await expect(page.getByRole('heading', { name: saved.pendingRace.won ? 'Victory' : 'Defeat', exact: true })).toBeVisible();
  expect(await savedState(page)).toEqual(saved);
  await button('Sound').click();
  const panel = page.getByRole('dialog', { name: 'Sound', exact: true });
  const sound = panel.getByRole('switch', { name: 'Sound', exact: true });
  await sound.click();
  await page.reload();
  await button('Sound').click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await button('Race Again').click();
  await button('Start Race').click();
  await expect(page.locator('[data-race-scene]')).toHaveAttribute('data-race-status', 'countdown');
  await page.clock.fastForward(4_000);
  await expect(page.locator('[data-race-scene]')).toHaveAttribute('data-race-status', 'racing', { timeout: 7_000 });
  await expect(html).not.toHaveAttribute('data-countdown-sound', 'true');
  await expect(html).not.toHaveAttribute('data-start-sound', 'true');
  await button('Skip Race').click();
});
