import './style.css';
import { buildCaseReel, caseIds, casePrice, type CaseId } from './game/cases';
import { events, tactics, type EventId, type Tactic } from './game/config';
import { addDeveloperCoins, developerButton, developerDialog, developerSaveKey, openDeveloperCase } from './dev/developer';
import {
  createGame, finishCase, finishRace, openCase, readSave, selectCar, sellCar,
  startRace, storageKey, toggleLock, writeSave, type GameState,
} from './game/save';
import { animateRace, animateRoulette } from './ui/animation';
import { escapeHtml, icon, money } from './ui/components';
import {
  caseAnimationScreen, caseResultScreen, casesScreen, carsById, garageScreen,
  raceAnimationScreen, raceResultScreen, raceSetupScreen, type GarageFilters, type GarageSort,
} from './ui/screens';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Game container is missing.');
const app: HTMLElement = container;

const navigation = { cases: 'Cases', garage: 'My Garage', races: 'Races' } as const;
type Screen = keyof typeof navigation;
type Visual = 'case' | 'race' | null;
type Command = (latest: GameState) => GameState;
type RestoreFocus = { action: string; id?: string } | { filter: string };

const activeSaveKey = import.meta.env.DEV ? developerSaveKey : storageKey;
const motionKey = import.meta.env.DEV ? 'car-case-league.reduce-motion.dev' : 'car-case-league.reduce-motion';
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const defaultFilters: GarageFilters = { sort: 'recent', rarity: '', carClass: '' };

let game = createGame();
let screen: Screen = 'cases';
let selectedCase: CaseId = 'rookie';
let caseReel: ReturnType<typeof buildCaseReel> | null = null;
let eventId: EventId = 'drag';
let tactic: Tactic = 'Balanced';
let filters = { ...defaultFilters };
let animation: Visual = null;
let stopAnimation = () => {};
let notice = '';
let commandPending = false;
let motionPreference = false;
let infiniteMoney = false;
let renderedView = '';

try {
  game = readSave(localStorage, activeSaveKey);
  selectedCase = game.pendingCaseType ?? selectedCase;
  motionPreference = localStorage.getItem(motionKey) === 'true';
} catch {
  notice = 'Local storage is unavailable. Enable storage to play and save your progress.';
}

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
      return animation === 'race' ? raceAnimationScreen(race, player, opponent) : raceResultScreen(race, player, opponent);
    }
  }
  switch (screen) {
    case 'garage': return garageScreen(game, filters);
    case 'races': return raceSetupScreen(game, eventId, tactic);
    case 'cases':
      return casesScreen(game, selectedCase,
        game.coins >= casePrice(selectedCase, game.progress.casesOpened) || (import.meta.env.DEV && infiniteMoney));
  }
}

function dialogMarkup() {
  return `<dialog id="settings-dialog" class="settings-dialog panel" aria-labelledby="settings-title">
    <div class="panel-heading"><h2 id="settings-title">Settings</h2></div>
    <label class="motion-setting"><input type="checkbox" data-filter="motion"${reducedMotion() ? ' checked' : ''}${mediaMotion.matches ? ' disabled' : ''}> Reduce Motion</label>
    ${mediaMotion.matches ? '<p class="action-hint">Your device has requested reduced motion.</p>' : ''}
    <p>Reset clears your cars, coins and race history on this device.</p>
    <div class="button-row">
      <button type="button" class="button button-secondary" data-action="close-settings">Close</button>
      <button type="button" class="button button-secondary" data-action="reset">Reset Progress</button>
    </div>
  </dialog>`;
}

function render(focus?: 'heading' | RestoreFocus) {
  stopAnimation();
  stopAnimation = () => {};
  document.documentElement.classList.toggle('reduced-motion', reducedMotion());
  const activeScreen: Screen = game.pendingCase ? 'cases' : game.pendingRace ? 'races' : screen;
  const view = game.pendingCase || game.pendingRace
    ? `${activeScreen}:${animation ?? 'result'}`
    : screen === 'cases' ? `cases:${selectedCase}` : screen;
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
          <span class="wallet-label">Coins</span><strong class="wallet-value" data-testid="coin-balance">${import.meta.env.DEV && infiniteMoney ? '∞' : money(visibleWallet)}</strong>
        </div>
        <button class="settings-button" type="button" data-action="settings" aria-label="Settings"${animation ? ' disabled' : ''}>${icon('settings')}</button>
        ${import.meta.env.DEV ? developerButton(Boolean(animation)) : ''}
      </div>
    </header>
    <main class="main-content" id="main-content" tabindex="-1">
      ${notice ? `<p class="notice panel" role="alert">${escapeHtml(notice)}</p>` : ''}
      <div${transition ? ' class="screen-transition"' : ''}>${gameScreen()}</div>
    </main>
    ${dialogMarkup()}
    ${import.meta.env.DEV ? developerDialog(infiniteMoney) : ''}
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

  if (animation === 'case') stopAnimation = animateRoulette(app, showResult);
  if (animation === 'race' && game.pendingRace) stopAnimation = animateRace(app, game.pendingRace, showResult);
}

function showResult() {
  animation = null;
  caseReel = null;
  render('heading');
}

async function transact(command: Command, onCommit: () => void, focus: 'heading' | RestoreFocus = 'heading') {
  if (commandPending) return;
  commandPending = true;
  let latest: GameState | undefined;
  let committed = false;
  const save = () => {
    latest = readSave(localStorage, activeSaveKey);
    const next = command(latest);
    if (next !== latest) writeSave(localStorage, next, activeSaveKey);
    game = next;
    committed = true;
  };

  try {
    if (navigator.locks) await navigator.locks.request(activeSaveKey, save);
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
  void transact((latest) => {
    if (caseId && caseId === latest.pendingCase) return finishCase(latest, action);
    if (raceId && raceId === latest.pendingRace?.id) return finishRace(latest);
    return latest;
  }, () => { screen = next; });
}

function beginCase() {
  const opened = game.progress.casesOpened;
  const caseId = selectedCase;
  void transact((latest) => {
    if (opened !== latest.progress.casesOpened) throw new Error('Progress changed in another tab. Review the current case.');
    return import.meta.env.DEV && infiniteMoney ? openDeveloperCase(latest, caseId) : openCase(latest, caseId);
  }, () => {
    const owned = game.garage.find((entry) => entry.id === game.pendingCase);
    const reward = owned && carsById.get(owned.carId);
    if (reward && !reducedMotion()) {
      caseReel = buildCaseReel(caseId, reward);
      animation = 'case';
    }
  });
}

function beginRace() {
  const selectedId = game.selectedId;
  const completed = game.progress.racesCompleted;
  void transact((latest) => {
    if (selectedId !== latest.selectedId || completed !== latest.progress.racesCompleted) {
      throw new Error('Progress changed in another tab. Review your race entry.');
    }
    return startRace(latest, eventId, tactic);
  }, () => { animation = reducedMotion() ? null : 'race'; });
}

function resetProgress(message: string) {
  if (!window.confirm(message)) return;
  void transact(createGame, () => {
    screen = 'cases';
    selectedCase = 'rookie';
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
  if (animation && action !== 'skip') return;

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
        void transact(addDeveloperCoins, () => {}, { action: 'dev-tools' })
          .then(() => openDeveloperPanel('dev-add-coins'));
        return;
      case 'dev-reset':
        resetProgress('Reset Car Case League development progress on this device?');
        return;
    }
  }

  switch (action) {
    case 'nav-cases': changeScreen('cases'); break;
    case 'nav-garage': changeScreen('garage'); break;
    case 'nav-races': changeScreen('races'); break;
    case 'select-case': {
      const choice = caseIds.find((candidate) => candidate === id);
      if (!choice || choice === selectedCase) break;
      selectedCase = choice;
      notice = '';
      render({ action, id });
      break;
    }
    case 'open-case': beginCase(); break;
    case 'start-race': beginRace(); break;
    case 'skip': showResult(); break;
    case 'keep-case':
    case 'race-cases': dismissResult('cases'); break;
    case 'sell-case': dismissResult('cases', 'sell'); break;
    case 'garage-case':
    case 'race-garage': dismissResult('garage'); break;
    case 'race-again': dismissResult('races'); break;
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
      if (id) void transact((latest) => selectCar(latest, id), () => {}, { action, id });
      break;
    case 'toggle-lock':
      if (id) void transact((latest) => toggleLock(latest, id), () => {}, { action, id });
      break;
    case 'sell-car':
      if (id) void transact((latest) => sellCar(latest, id), () => {}, { action: 'select-car', id });
      break;
    case 'settings': app.querySelector<HTMLDialogElement>('#settings-dialog')?.showModal(); break;
    case 'close-settings': app.querySelector<HTMLDialogElement>('#settings-dialog')?.close(); break;
    case 'reset':
      resetProgress(import.meta.env.DEV
        ? 'Reset Car Case League development progress on this device?'
        : 'Reset all Car Case League progress on this device?');
      break;
  }
}

app.addEventListener('click', (event) => {
  const button = event.target instanceof Element && event.target.closest<HTMLButtonElement>('button[data-action]');
  if (button && !commandPending) handleAction(button);
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
    void transact((latest) => selectCar(latest, field.value), () => {}, { filter });
    return;
  }
  if (filter === 'sort') filters.sort = field.value as GarageSort;
  else if (filter === 'rarity') filters.rarity = field.value;
  else if (filter === 'carClass') filters.carClass = field.value;
  else return;
  render({ filter });
});

window.addEventListener('storage', (event) => {
  if ((event.key !== activeSaveKey && event.key !== null) || commandPending) return;
  try {
    game = readSave(localStorage, activeSaveKey);
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
  if (animation && reducedMotion()) showResult();
  else document.documentElement.classList.toggle('reduced-motion', reducedMotion());
});

render();
