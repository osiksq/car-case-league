import './style.css';
import './career.css';
import './audio-panel.css';
import { careerEvents, type CareerEventId } from './game/career';
import { buildCaseReel, caseIds, casePrice, type CaseId } from './game/cases';
import { events, tactics, type EventId, type Tactic } from './game/config';
import { gameClockNow } from './game/economy';
import { addDeveloperCoins, developerButton, developerDialog, developerSaveKey, openDeveloperCase } from './dev/developer';
import {
  createGame, finishCase, finishRace, junkyardRemainingMs, openCase, readSave, selectCar, sellCar,
  startCareerRace, startRace, storageKey, toggleLock, writeSave, type GameState,
} from './game/save';
import { animateRace, animateRoulette } from './ui/animation';
import { audio, defaultAudioSettings, normalizeAudioSettings, type AudioSettings } from './ui/audio';
import { careerScreen } from './ui/career';
import { escapeHtml, icon, money } from './ui/components';
import {
  caseAnimationScreen, caseCollectionScreen, caseResultScreen, casesScreen, carsById, garageScreen,
  raceAnimationScreen, raceResultScreen, raceSetupScreen, updateCaseCountdown, updateRaceReward,
  type GarageFilters, type GarageSort,
} from './ui/screens';
import { createSoundPanel, soundButton, syncSoundButton } from './ui/sound-panel';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Game container is missing.');
const app: HTMLElement = container;

const navigation = { cases: 'Cases', garage: 'My Garage', career: 'Career', races: 'Races' } as const;
type Screen = keyof typeof navigation;
type Visual = 'case' | 'race' | null;
type Command = (latest: GameState) => GameState;
type RestoreFocus = { action: string; id?: string } | { filter: string };

const motionKey = import.meta.env.DEV ? 'car-case-league.reduce-motion.dev' : 'car-case-league.reduce-motion';
const raceSoundKey = import.meta.env.DEV ? 'car-case-league.race-sound.dev' : 'car-case-league.race-sound';
const audioKey = import.meta.env.DEV ? 'car-case-league.audio.dev' : 'car-case-league.audio';
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const defaultFilters: GarageFilters = { sort: 'recent', rarity: '', carClass: '' };

let game = createGame();
let screen: Screen = 'cases';
let selectedCase: CaseId | null = null;
let careerEntry: CareerEventId | null = null;
let caseReel: ReturnType<typeof buildCaseReel> | null = null;
let eventId: EventId = 'drag';
let freeRaceSeed = nextRaceSeed();
let tactic: Tactic = 'Balanced';
let filters = { ...defaultFilters };
let animation: Visual = null;
let stopAnimation = () => {};
let notice = '';
let commandPending = false;
let motionPreference = false;
let soundSettings = defaultAudioSettings;
let infiniteMoney = false;
let sandbox = false;
let renderedView = '';

function activeSaveKey() {
  if (import.meta.env.DEV) return developerSaveKey;
  return import.meta.env.PROD && sandbox ? `${storageKey}.sandbox` : storageKey;
}

function hasUnlimitedCoins() {
  return (import.meta.env.DEV && infiniteMoney) || (import.meta.env.PROD && sandbox);
}

function nextRaceSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

try {
  game = readSave(localStorage, activeSaveKey());
  selectedCase = game.pendingCaseType ?? selectedCase;
  motionPreference = localStorage.getItem(motionKey) === 'true';
} catch {
  notice = 'Local storage is unavailable. Enable storage to play and save your progress.';
}

function readAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(audioKey);
    return stored === null
      ? { ...defaultAudioSettings, enabled: localStorage.getItem(raceSoundKey) !== 'false' }
      : normalizeAudioSettings(JSON.parse(stored));
  } catch {
    return defaultAudioSettings;
  }
}

const soundPanel = createSoundPanel((next, trusted) => {
  applyAudioSettings(next);
  if (next.enabled && trusted) audio.unlock();
  try {
    localStorage.setItem(audioKey, JSON.stringify(next));
  } catch {
    // The current mixer still works if settings cannot be persisted.
  }
}, () => {
  syncSoundButton(app, soundSettings, false);
  app.querySelector<HTMLButtonElement>('[data-action="sound"]')?.focus({ preventScroll: true });
});

function applyAudioSettings(next: AudioSettings) {
  soundSettings = next;
  audio.configure(next);
  soundPanel.sync(next);
  syncSoundButton(app, next, soundPanel.panel.open);
}

applyAudioSettings(readAudioSettings());
document.addEventListener('visibilitychange', () => audio.setVisible(!document.hidden));
window.addEventListener('pagehide', () => audio.setVisible(false));
window.addEventListener('pageshow', () => audio.setVisible(!document.hidden));
audio.setVisible(!document.hidden);

function reducedMotion() {
  return motionPreference || mediaMotion.matches;
}

function gameScreen() {
  if (game.pendingCase) {
    const owned = game.garage.find((entry) => entry.id === game.pendingCase);
    const car = owned && carsById.get(owned.carId);
    const caseId = game.pendingCaseType ?? 'rookie';
    if (car) {
      return animation === 'case' && caseReel
        ? caseAnimationScreen(caseId, caseReel)
        : caseResultScreen(game, car, caseId);
    }
  }
  if (game.pendingRace) {
    const race = game.pendingRace;
    const player = carsById.get(race.playerCarId);
    const opponent = carsById.get(race.opponentCarId);
    if (player && opponent) {
      return animation === 'race' ? raceAnimationScreen(race, player, opponent) : raceResultScreen(race, player, opponent, game.career);
    }
  }
  switch (screen) {
    case 'garage': return garageScreen(game, filters);
    case 'races': return raceSetupScreen(game, eventId, tactic, undefined, gameClockNow(), freeRaceSeed);
    case 'career': {
      const entry = careerEntry ? careerEvents[careerEntry] : undefined;
      return entry && game.career.unlocked.includes(entry.leagueId)
        ? raceSetupScreen(game, entry.eventId, tactic, entry)
        : careerScreen(game);
    }
    case 'cases': {
      const unlimited = hasUnlimitedCoins();
      const now = gameClockNow();
      if (!selectedCase) return caseCollectionScreen(game, unlimited ? 0 : junkyardRemainingMs(game, now));
      const canOpen = unlimited || (selectedCase === 'junkyard'
        ? junkyardRemainingMs(game, now) === 0
        : game.coins >= casePrice(selectedCase));
      return casesScreen(game, selectedCase, canOpen, now, unlimited);
    }
  }
}

function dialogMarkup() {
  return `<dialog id="settings-dialog" class="settings-dialog panel" aria-labelledby="settings-title">
    <div class="panel-heading"><h2 id="settings-title">Settings</h2></div>
    <label class="motion-setting"><input type="checkbox" data-filter="motion"${reducedMotion() ? ' checked' : ''}${mediaMotion.matches ? ' disabled' : ''}> Reduce Motion</label>
    ${mediaMotion.matches ? '<p class="action-hint">Your device has requested reduced motion.</p>' : ''}
    <p>Reset clears your cars, coins, race history and career on this device.</p>
    <div class="button-row">
      <button type="button" class="button button-secondary" data-action="close-settings">Close</button>
      <button type="button" class="button button-secondary" data-action="reset">Reset Progress</button>
    </div>
  </dialog>`;
}

function sandboxDialog() {
  return `<dialog id="sandbox-dialog" class="settings-dialog panel" aria-labelledby="sandbox-title">
    <div class="panel-heading"><h2 id="sandbox-title">Sandbox</h2></div>
    <p>Open any case with unlimited coins. Sandbox uses its own garage and progress.</p>
    <div class="button-row">
      <button type="button" class="button button-primary" role="switch" aria-label="Unlimited coins"
        aria-checked="${sandbox}" data-action="sandbox-toggle">${sandbox ? 'Exit Sandbox' : 'Enable unlimited coins'}</button>
      <button type="button" class="button button-secondary" data-action="sandbox-close">Close</button>
    </div>
  </dialog>`;
}

function toggleSandbox() {
  sandbox = !sandbox;
  game = readSave(localStorage, activeSaveKey());
  screen = 'cases';
  selectedCase = game.pendingCaseType ?? null;
  careerEntry = null;
  caseReel = null;
  notice = '';
  render({ action: 'sandbox-open' });
}

function render(focus?: 'heading' | RestoreFocus) {
  stopAnimation();
  stopAnimation = () => {};
  document.documentElement.classList.toggle('reduced-motion', reducedMotion());
  const activeScreen: Screen = game.pendingCase ? 'cases'
    : game.pendingRace ? (game.pendingRace.careerEventId ? 'career' : 'races') : screen;
  const view = game.pendingCase || game.pendingRace
    ? `${activeScreen}:${animation ?? 'result'}`
    : screen === 'cases' ? `cases:${selectedCase ?? 'collection'}`
    : screen === 'career' && careerEntry ? `career:${careerEntry}` : screen;
  const transition = view !== renderedView;
  renderedView = view;
  const visibleWallet = animation === 'race' ? game.coins - (game.pendingRace?.reward ?? 0) : game.coins;
  app.innerHTML = `<div class="shell">
    <header class="site-header game-hud">
      <a class="skip-link" href="#main-content">Skip to content</a>
      <button class="brand" type="button" data-action="nav-cases" aria-label="Car Case League"${animation ? ' disabled' : ''}>
        <span class="brand-mark">${icon('logo')}</span>
        <span class="brand-name">Car Case <strong>League</strong></span>
      </button>
      <nav class="main-nav" aria-label="Main navigation">
        ${(Object.keys(navigation) as Screen[]).map((page) => `<button type="button" data-action="nav-${page}" aria-label="${navigation[page]}"${activeScreen === page ? ' aria-current="page"' : ''}${animation ? ' disabled' : ''}>
          ${icon(page)}<span>${page === 'garage' ? 'Garage' : navigation[page]}</span>
        </button>`).join('')}
      </nav>
      <div class="header-actions">
        <div class="wallet" aria-label="Wallet">
          <span class="wallet-icon">${icon('coin')}</span>
          <span class="wallet-label">Coins</span><strong class="wallet-value" data-testid="coin-balance">${hasUnlimitedCoins() ? '∞' : money(visibleWallet)}</strong>
        </div>
        <button class="settings-button" type="button" data-action="settings" aria-label="Settings"${animation ? ' disabled' : ''}>${icon('settings')}</button>
        ${soundButton(soundSettings, soundPanel.panel.open)}
        ${import.meta.env.DEV ? developerButton(Boolean(animation)) : ''}
        ${import.meta.env.PROD ? `<button class="settings-button" type="button" data-action="sandbox-open"
          aria-label="Sandbox" aria-haspopup="dialog" title="Sandbox"${animation ? ' disabled' : ''}><span class="wallet-value">∞</span></button>` : ''}
      </div>
    </header>
    <main class="main-content" id="main-content" tabindex="-1">
      ${notice ? `<p class="notice panel" role="alert">${escapeHtml(notice)}</p>` : ''}
      <div${transition ? ' class="screen-transition"' : ''}>${gameScreen()}</div>
    </main>
    ${dialogMarkup()}
    ${import.meta.env.DEV ? developerDialog(infiniteMoney) : ''}
    ${import.meta.env.PROD ? sandboxDialog() : ''}
  </div>`;

  if (focus === 'heading') {
    window.scrollTo({ top: 0 });
    app.querySelector<HTMLElement>('#screen-title')?.focus({ preventScroll: true });
  } else if (focus) {
    const target = 'filter' in focus
      ? [...app.querySelectorAll<HTMLElement>('[data-filter]')].find((element) => element.dataset.filter === focus.filter)
      : [...app.querySelectorAll<HTMLElement>('button[data-action]')].find(
        (element) => element.dataset.action === focus.action && element.dataset.id === focus.id,
      );
    (target ?? app.querySelector<HTMLElement>('#screen-title'))?.focus({ preventScroll: true });
  }

  if (animation === 'case') {
    const soundtrack = audio.reel();
    const stopReel = animateRoulette(app, () => showResult('finished'), soundtrack.cue);
    stopAnimation = () => { stopReel(); soundtrack.stop(); };
  }
  if (animation === 'race' && game.pendingRace) {
    const car = carsById.get(game.pendingRace.playerCarId);
    const soundtrack = car && audio.race(car);
    const stopRace = animateRace(app, game.pendingRace, () => showResult('finished'), soundtrack?.cue);
    stopAnimation = () => {
      stopRace();
      soundtrack?.stop();
    };
  }
}

function playCaseReward() {
  const owned = game.garage.find((entry) => entry.id === game.pendingCase);
  const model = owned && carsById.get(owned.carId);
  if (model) audio.play({ reward: model.rarity });
}

function playRaceResult() {
  const race = game.pendingRace;
  if (race) audio.play({
    outcome: race.won ? 'victory' : 'defeat',
    coins: race.reward > 0,
    league: Boolean(race.careerAward && race.careerAward !== 'elite'),
  });
}

function showResult(reason: 'finished' | 'skip' | 'reduced') {
  const completed = animation;
  animation = null;
  caseReel = null;
  render('heading');
  if (completed === 'case' && reason !== 'reduced') playCaseReward();
  if (completed === 'race' && reason === 'finished') playRaceResult();
}

async function transact(command: Command, onCommit: () => void, focus: 'heading' | RestoreFocus = 'heading') {
  if (commandPending) return;
  commandPending = true;
  const key = activeSaveKey();
  let latest: GameState | undefined;
  let committed = false;
  const save = () => {
    latest = readSave(localStorage, key);
    const next = command(latest);
    if (next !== latest) writeSave(localStorage, next, key);
    game = next;
    committed = true;
  };

  try {
    if (navigator.locks) await navigator.locks.request(key, save);
    else save();
    notice = '';
    onCommit();
  } catch (error) {
    if (!committed && latest) game = latest;
    animation = null;
    caseReel = null;
    notice = error instanceof Error ? error.message : 'Could not save progress. Try again.';
  } finally {
    commandPending = false;
    render(focus);
  }
}

function changeScreen(next: Screen) {
  screen = next;
  if (!game.pendingCase && !game.pendingRace) {
    notice = '';
    render('heading');
    return;
  }
  dismissResult(next);
}

function dismissResult(next: Screen, action: 'keep' | 'sell' = 'keep') {
  const caseId = game.pendingCase;
  const raceId = game.pendingRace?.id;
  let sold = false;
  void transact((latest) => {
    if (caseId && caseId === latest.pendingCase) {
      const result = finishCase(latest, action);
      sold = result.coins > latest.coins;
      return result;
    }
    if (raceId && raceId === latest.pendingRace?.id) return finishRace(latest);
    return latest;
  }, () => {
    screen = next;
    if (sold) audio.play('sale');
  });
}

function beginCase() {
  const opened = game.progress.casesOpened;
  const caseId = selectedCase;
  if (!caseId) return;
  let starterDraw = false;
  void transact((latest) => {
    if (opened !== latest.progress.casesOpened) throw new Error('Progress changed in another tab. Review the current case.');
    starterDraw = caseId === 'junkyard' && latest.garage.length === 0;
    return hasUnlimitedCoins() ? openDeveloperCase(latest, caseId) : openCase(latest, caseId);
  }, () => {
    const owned = game.garage.find((entry) => entry.id === game.pendingCase);
    const reward = owned && carsById.get(owned.carId);
    if (reward && !reducedMotion()) {
      caseReel = buildCaseReel(caseId, reward, undefined, starterDraw);
      animation = 'case';
    } else {
      playCaseReward();
    }
  });
}

function beginRace() {
  const selectedId = game.selectedId;
  const completed = game.progress.racesCompleted;
  const competition = screen === 'career' ? careerEntry : null;
  const seed = freeRaceSeed;
  void transact((latest) => {
    if (selectedId !== latest.selectedId || completed !== latest.progress.racesCompleted) {
      throw new Error('Progress changed in another tab. Review your race entry.');
    }
    return competition ? startCareerRace(latest, competition, tactic) : startRace(latest, eventId, tactic, seed);
  }, () => {
    if (!competition) freeRaceSeed = nextRaceSeed();
    animation = reducedMotion() ? null : 'race';
    if (!animation) playRaceResult();
  });
}

function resetProgress(message: string) {
  if (!window.confirm(message)) return;
  void transact(createGame, () => {
    screen = 'cases';
    selectedCase = null;
    careerEntry = null;
    eventId = 'drag';
    tactic = 'Balanced';
    filters = { ...defaultFilters };
    if (import.meta.env.DEV) infiniteMoney = false;
  });
}

function openDeveloperPanel(focus?: 'dev-money' | 'dev-add-coins') {
  const panel = app.querySelector<HTMLDialogElement>('.dev-dialog');
  panel?.showModal();
  if (focus) panel?.querySelector<HTMLElement>(`[data-action="${focus}"]`)?.focus();
}

function handleAction(button: HTMLButtonElement) {
  const action = button.dataset.action ?? '';
  const id = button.dataset.id;
  if (action === 'sound') {
    soundPanel.panel.showModal();
    syncSoundButton(app, soundSettings, true);
    return;
  }
  if (animation && action !== 'skip') return;

  if (import.meta.env.PROD) {
    switch (action) {
      case 'sandbox-open': app.querySelector<HTMLDialogElement>('#sandbox-dialog')?.showModal(); return;
      case 'sandbox-close': app.querySelector<HTMLDialogElement>('#sandbox-dialog')?.close(); return;
      case 'sandbox-toggle': toggleSandbox(); return;
    }
  }

  if (import.meta.env.DEV) {
    switch (action) {
      case 'dev-tools': openDeveloperPanel(); return;
      case 'dev-close': app.querySelector<HTMLDialogElement>('.dev-dialog')?.close(); return;
      case 'dev-money':
        infiniteMoney = !infiniteMoney;
        render({ action: 'dev-tools' });
        openDeveloperPanel('dev-money');
        return;
      case 'dev-add-coins':
        void transact(addDeveloperCoins, () => audio.play('coins'), { action: 'dev-tools' })
          .then(() => openDeveloperPanel('dev-add-coins'));
        return;
      case 'dev-reset':
        resetProgress('Reset Car Case League development progress on this device?');
        return;
    }
  }

  switch (action) {
    case 'nav-cases':
      selectedCase = null;
      changeScreen('cases');
      break;
    case 'nav-garage': changeScreen('garage'); break;
    case 'nav-races': changeScreen('races'); break;
    case 'nav-career':
    case 'race-career':
      careerEntry = null;
      changeScreen('career');
      break;
    case 'career-event': {
      if (!id || !Object.hasOwn(careerEvents, id)) break;
      const entry = careerEvents[id as CareerEventId];
      if (!game.career.unlocked.includes(entry.leagueId)) break;
      careerEntry = entry.id;
      changeScreen('career');
      break;
    }
    case 'select-case': {
      const choice = caseIds.find((candidate) => candidate === id);
      if (!choice) break;
      audio.play('case-select');
      selectedCase = choice;
      notice = '';
      render('heading');
      break;
    }
    case 'back-to-cases': {
      const previous = selectedCase;
      selectedCase = null;
      notice = '';
      render(previous ? { action: 'select-case', id: previous } : 'heading');
      document.activeElement?.scrollIntoView({ block: 'nearest' });
      break;
    }
    case 'open-case': beginCase(); break;
    case 'start-race': beginRace(); break;
    case 'skip': showResult('skip'); break;
    case 'keep-case': dismissResult('cases'); break;
    case 'race-cases':
      selectedCase = null;
      dismissResult('cases');
      break;
    case 'sell-case': dismissResult('cases', 'sell'); break;
    case 'garage-case':
    case 'race-garage': dismissResult('garage'); break;
    case 'race-again': {
      const race = game.pendingRace;
      if (race?.careerEventId) {
        careerEntry = race.careerEventId;
        tactic = race.tactic;
        dismissResult('career');
      } else {
        dismissResult('races');
      }
      break;
    }
    case 'clear-filters':
      filters = { ...defaultFilters };
      render({ filter: 'sort' });
      break;
    case 'event':
      if (id && Object.hasOwn(events, id)) {
        eventId = id as EventId;
        render({ action, id });
      }
      break;
    case 'tactic':
      if (tactics.includes(id as Tactic)) {
        tactic = id as Tactic;
        render({ action, id });
      }
      break;
    case 'select-car':
      if (id && id !== game.selectedId) void transact((latest) => selectCar(latest, id), () => audio.play('car-select'), { action, id });
      break;
    case 'toggle-lock':
      if (id) void transact((latest) => toggleLock(latest, id), () => {}, { action, id });
      break;
    case 'sell-car':
      if (id) void transact((latest) => sellCar(latest, id), () => audio.play('sale'), { action: 'select-car', id });
      break;
    case 'settings': app.querySelector<HTMLDialogElement>('#settings-dialog')?.showModal(); break;
    case 'close-settings': app.querySelector<HTMLDialogElement>('#settings-dialog')?.close(); break;
    case 'reset':
      resetProgress(import.meta.env.DEV
        ? 'Reset Car Case League development progress on this device?'
        : sandbox ? 'Reset Sandbox progress on this device?' : 'Reset all Car Case League progress on this device?');
      break;
  }
}

app.addEventListener('click', (event) => {
  if (event.isTrusted) audio.unlock();
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('button[data-action]');
  const action = button?.dataset.action;
  if (!button || !action || (commandPending && action !== 'sound')) return;
  if (!animation && (action.startsWith('nav-') || ['back-to-cases', 'settings', 'sound', 'event', 'tactic'].includes(action))) {
    audio.play('button');
  }
  handleAction(button);
});

app.addEventListener('change', (event) => {
  const field = event.target;
  if (field instanceof HTMLInputElement && field.dataset.filter === 'motion') {
    try {
      localStorage.setItem(motionKey, String(field.checked));
      motionPreference = field.checked;
      document.documentElement.classList.toggle('reduced-motion', reducedMotion());
    } catch {
      field.checked = reducedMotion();
      notice = 'The motion preference could not be saved on this device.';
      render({ action: 'settings' });
    }
    return;
  }
  if (!(field instanceof HTMLSelectElement)) return;
  const filter = field.dataset.filter;
  if (filter === 'raceCar') {
    if (event.isTrusted) audio.unlock();
    void transact((latest) => selectCar(latest, field.value), () => audio.play('car-select'), { filter });
    return;
  }
  if (filter === 'sort') filters.sort = field.value as GarageSort;
  else if (filter === 'rarity') filters.rarity = field.value;
  else if (filter === 'carClass') filters.carClass = field.value;
  else return;
  render({ filter });
});

window.addEventListener('storage', (event) => {
  if (event.key === audioKey || event.key === null) applyAudioSettings(readAudioSettings());
  const key = activeSaveKey();
  if ((event.key !== key && event.key !== null) || commandPending) return;
  try {
    game = readSave(localStorage, key);
    selectedCase = game.pendingCaseType ?? selectedCase;
    animation = null;
    caseReel = null;
    render();
  } catch {
    notice = 'Progress could not be read from local storage.';
    render();
  }
});

mediaMotion.addEventListener('change', () => {
  if (animation && reducedMotion()) showResult('reduced');
  else document.documentElement.classList.toggle('reduced-motion', reducedMotion());
});

render();

window.setInterval(() => {
  if (document.hidden || animation || commandPending) return;
  const now = gameClockNow();
  updateCaseCountdown(app, hasUnlimitedCoins() ? 0 : junkyardRemainingMs(game, now));
  updateRaceReward(app, game, screen === 'career' ? careerEntry ?? undefined : undefined, now);
}, 250);
