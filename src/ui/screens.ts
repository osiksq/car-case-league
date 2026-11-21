import {
  cars, classes, economy, events, rarities, rookieOdds, starterOdds, tactics,
  type Car, type EventId, type Tactic,
} from '../game/config';
import type { GameState } from '../game/save';
import { carCard, carImage, carStyle, carStats, escapeHtml, icon, money, oddsTable, pageHeading, rarityBadge, statEntries } from './components';

export const carsById = new Map(cars.map((car) => [car.id, car]));
const featuredCar = cars.find((car) => car.artIndex === 7) ?? cars[0];

export type GarageSort = 'recent' | 'rarity' | 'name' | 'speed';

export interface GarageFilters {
  sort: GarageSort;
  rarity: string;
  carClass: string;
}

const sortOptions: Record<GarageSort, string> = {
  recent: 'Recently acquired',
  rarity: 'Highest rarity',
  name: 'Name A–Z',
  speed: 'Highest speed',
};

const tacticDescriptions: Record<Tactic, string> = {
  Safe: 'Trade pace for reliability.',
  Balanced: 'Run the car at its baseline.',
  Push: 'Chase speed and acceleration at higher risk.',
};

function option(value: string, label: string, current: string) {
  return `<option value="${escapeHtml(value)}"${value === current ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

export function casesScreen(game: GameState, canOpenPaidCase: boolean) {
  const free = game.progress.casesOpened === 0;
  const canOpen = free || canOpenPaidCase;
  return `<section class="case-screen" aria-labelledby="screen-title">
    <header class="case-header">
      <h1 id="screen-title" tabindex="-1">Cases</h1>
      <dl class="case-stats" aria-label="Your progress">
        <div><dt>In garage</dt><dd>${game.garage.length}</dd></div>
        <div><dt>Cases opened</dt><dd>${game.progress.casesOpened}</dd></div>
        <div><dt>Races finished</dt><dd>${game.progress.racesCompleted}</dd></div>
      </dl>
    </header>
    <div class="case-grid">
      <article class="case-feature panel" aria-labelledby="rookie-case-title">
        <div class="case-stage" aria-hidden="true">
          <div class="case-crate">
            <span class="case-crate-lid"></span>
            <span class="case-crate-face">
              <span class="case-crate-plate">${icon('logo')}</span>
            </span>
          </div>
        </div>
        <div class="case-content">
          <h2 id="rookie-case-title">Rookie Case</h2>
          <button type="button" class="button button-primary case-open-button" data-action="open-case"${free ? '' : ' aria-describedby="rookie-case-price"'}${canOpen ? '' : ' disabled'}>
            ${icon('cases')} ${free ? 'Open Free Case' : 'Open Case'}
          </button>
          ${free ? '' : `<span class="case-price" id="rookie-case-price">${icon('coin')} ${money(economy.casePrice)} coins</span>`}
          ${canOpen ? '' : '<p class="action-hint">Race to earn more coins.</p>'}
        </div>
      </article>
      <aside class="case-sidebar">
        <section class="odds-panel panel" aria-labelledby="odds-title">
          <div class="panel-heading"><h2 id="odds-title">Drop odds</h2><span>Per case</span></div>
          ${oddsTable(free ? starterOdds : rookieOdds)}
          <p class="odds-note">Cars have equal odds within each rarity.</p>
        </section>
        <section class="case-preview panel" aria-labelledby="case-preview-title">
          <div class="case-preview-art">${carImage(featuredCar)}</div>
          <div class="case-preview-details">
            <p id="case-preview-title">Featured drop</p>
            <h2>${escapeHtml(featuredCar.name)}</h2>
            ${rarityBadge(featuredCar.rarity)}
          </div>
        </section>
      </aside>
    </div>
    <details class="catalog-section panel">
      <summary class="catalog-summary">
        ${icon('garage')} <strong>Vehicle Pool</strong><span>${cars.length} vehicles</span>
      </summary>
      <div class="card-grid">${cars.map((car) => carCard(car)).join('')}</div>
    </details>
  </section>`;
}

export function garageScreen(game: GameState, filters: GarageFilters) {
  const visible = game.garage.flatMap((owned, acquired) => {
    const car = carsById.get(owned.carId);
    return car && (!filters.rarity || filters.rarity === car.rarity) &&
      (!filters.carClass || filters.carClass === car.class) ? [{ owned, car, acquired }] : [];
  });

  visible.sort((left, right) => {
    switch (filters.sort) {
      case 'rarity': return rarities.indexOf(right.car.rarity) - rarities.indexOf(left.car.rarity) || right.acquired - left.acquired;
      case 'name': return left.car.name.localeCompare(right.car.name) || right.acquired - left.acquired;
      case 'speed': return right.car.stats.speed - left.car.stats.speed || right.acquired - left.acquired;
      case 'recent': return right.acquired - left.acquired;
    }
  });

  const controls = `<div class="garage-controls panel" aria-label="Garage filters">
    <label>Sort by <select data-filter="sort">${Object.entries(sortOptions).map(([value, name]) => option(value, name, filters.sort)).join('')}</select></label>
    <label>Rarity <select data-filter="rarity">${option('', 'All rarities', filters.rarity)}${rarities.map((rarity) => option(rarity, rarity, filters.rarity)).join('')}</select></label>
    <label>Class <select data-filter="carClass">${option('', 'All classes', filters.carClass)}${classes.map((carClass) => option(carClass, carClass, filters.carClass)).join('')}</select></label>
  </div>`;

  const empty = `<div class="empty-state panel">
    <h2>${game.garage.length ? 'No cars match these filters' : 'Your garage is empty'}</h2>
    <p>${game.garage.length ? 'Change the rarity or class to see more of your collection.' : 'Open the Rookie Case to add your first car.'}</p>
    ${game.garage.length ? '<button class="button button-secondary" type="button" data-action="clear-filters">Clear Filters</button>' :
      '<button class="button button-primary" type="button" data-action="nav-cases">Go to Cases</button>'}
  </div>`;

  return `<section class="garage-screen" aria-labelledby="screen-title">
    ${pageHeading('YOUR COLLECTION', 'My Garage', 'Select a car for your next race or manage the cars you own.')}
    ${game.garage.length ? controls : ''}
    <div class="card-grid garage-grid">${visible.map(({ car, owned }) => {
      const id = escapeHtml(owned.id);
      const name = escapeHtml(car.name);
      const selected = owned.id === game.selectedId;
      const canSell = game.garage.length > 1 && !owned.locked;
      return carCard(car, { stats: true, selected, actions: `<div class="card-actions">
        <button type="button" class="button ${selected ? 'button-secondary' : 'button-primary'}" data-action="select-car" data-id="${id}"
          aria-label="Select ${name}" aria-pressed="${selected}">${selected ? `${icon('check')} Selected` : 'Select'}</button>
        <button type="button" class="button button-secondary" data-action="toggle-lock" data-id="${id}"
          aria-label="${owned.locked ? 'Unlock' : 'Lock'} ${name}">${icon('lock')} ${owned.locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" class="button button-secondary" data-action="sell-car" data-id="${id}" aria-label="Sell ${name}"${canSell ? '' : ' disabled'}
          title="${owned.locked ? 'Unlock this car before selling' : game.garage.length < 2 ? 'Keep at least one car to race' : `Sell for ${money(car.resaleValue)} coins`}">Sell · ${money(car.resaleValue)}</button>
      </div>` });
    }).join('')}</div>
    ${visible.length ? '' : empty}
  </section>`;
}

export function raceSetupScreen(game: GameState, eventId: EventId, tactic: Tactic) {
  const selected = game.garage.find((car) => car.id === game.selectedId);
  const car = selected && carsById.get(selected.carId);
  const races = Array.from(game.races).slice(-3).reverse();

  return `<section class="race-screen" aria-labelledby="screen-title">
    ${pageHeading('TRACK EVENTS', 'Race Control', 'Choose a track, set your tactic and let your car do the driving.')}
    <div class="race-setup">
      <section class="race-options panel" aria-labelledby="event-title">
        <div class="panel-heading"><h2 id="event-title">Choose a track</h2></div>
        <div class="event-options">${(Object.keys(events) as EventId[]).map((id) => `
          <button class="option-button" type="button" data-action="event" data-id="${id}" aria-label="${escapeHtml(events[id].name)}" aria-pressed="${id === eventId}">
            ${icon(id === 'drag' ? 'bolt' : 'races')}<span><strong>${escapeHtml(events[id].name)}</strong><small>${escapeHtml(events[id].description)}</small></span>
          </button>`).join('')}
        </div>
        <div class="track-weights" aria-label="Track stat weights">${statEntries.map(([stat, label]) => `<span>${label} <strong>${events[eventId].weights[stat]}%</strong></span>`).join('')}</div>
        <div class="panel-heading"><h2>Choose a tactic</h2></div>
        <div class="tactic-options">${tactics.map((entry) => `<button class="option-button" type="button" data-action="tactic" data-id="${entry}" aria-label="${entry}" aria-pressed="${entry === tactic}"><span><strong>${entry}</strong><small>${tacticDescriptions[entry]}</small></span></button>`).join('')}</div>
      </section>
      <section class="race-entry panel" aria-labelledby="entry-title">
        <div class="panel-heading"><h2 id="entry-title">Race entry</h2></div>
        ${car && selected ? `<label class="car-selector">Race car <select data-filter="raceCar">${game.garage.map((entry, index) => {
          const model = carsById.get(entry.carId);
          return model ? option(entry.id, `${model.name} · #${index + 1}`, selected.id) : '';
        }).join('')}</select></label>
          ${carCard(car, { stats: true })}
          <button type="button" class="button button-primary" data-action="start-race">${icon('races')} Start Race</button>` :
        `<p>Add a car to your garage to enter a race.</p><button type="button" class="button button-primary" data-action="nav-cases">Go to Cases</button>`}
      </section>
    </div>
    ${races.length ? `<section class="race-history panel" aria-label="Recent races">
      <div class="panel-heading"><h2>Recent races</h2></div>
      <ul>${races.map((race) => `<li><span>${escapeHtml(events[race.eventId].name)} · ${escapeHtml(carsById.get(race.playerCarId)?.name ?? 'Unknown car')}</span><strong>${race.won ? 'Win' : 'Loss'} · +${money(race.reward)} coins</strong></li>`).join('')}</ul>
    </section>` : ''}
  </section>`;
}

export function caseAnimationScreen(car: Car) {
  const alternatives = cars.filter((candidate) => candidate.id !== car.id);
  const reel = [...alternatives, ...alternatives.slice(3), car, ...alternatives.slice(0, 6)];
  const winnerIndex = alternatives.length * 2 - 3;
  return `<section class="opening-screen" aria-labelledby="screen-title">
    ${pageHeading('ROOKIE CASE', 'Opening Case', 'The car is already drawn. The reel brings it into view.')}
    <section class="roulette-panel panel" aria-label="Case opening animation">
      <div class="roulette-viewport" aria-hidden="true">
        <div class="roulette-track">${reel.map((entry, index) => `<div class="roulette-card ${carStyle(entry)}"${index === winnerIndex ? ' data-reel-winner' : ''}>
          <div class="roulette-art">${carImage(entry, true)}</div><strong>${escapeHtml(entry.name)}</strong>${rarityBadge(entry.rarity)}
        </div>`).join('')}</div>
        <div class="roulette-marker"></div>
      </div>
      <div class="button-row"><button class="button button-secondary" type="button" data-action="skip">Skip Animation</button></div>
    </section>
  </section>`;
}

export function caseResultScreen(game: GameState, car: Car) {
  const owned = game.garage.find((entry) => entry.id === game.pendingCase);
  const canSell = game.garage.length > 1 && owned && !owned.locked;
  return `<section class="case-result-screen" aria-labelledby="screen-title">
    ${pageHeading('ROOKIE CASE', 'Case Result', 'Your new car is already saved to your garage.')}
    <article class="case-result panel ${carStyle(car)}">
      <div class="case-result-art">${carImage(car, true)}</div>
      <div class="case-result-content">
        <div class="badges">${rarityBadge(car.rarity)}<span class="car-class">${car.class}</span></div>
        <h2>${escapeHtml(car.name)}</h2>${carStats(car)}
        <div class="button-row">
          <button type="button" class="button button-secondary" data-action="keep-case">Keep</button>
          <button type="button" class="button button-secondary" data-action="sell-case" aria-describedby="case-sell-hint"${canSell ? '' : ' disabled'}>Sell</button>
          <button type="button" class="button button-primary" data-action="garage-case">Go to Garage</button>
        </div>
        <p class="action-hint" id="case-sell-hint">${canSell ? `Sale value: ${money(car.resaleValue)} coins.` : 'Keep at least one car to stay eligible for races.'}</p>
      </div>
    </article>
  </section>`;
}

type Race = NonNullable<GameState['pendingRace']>;

export function raceAnimationScreen(race: Race, player: Car, opponent: Car) {
  return `<section class="race-animation-screen" aria-labelledby="screen-title">
    ${pageHeading('RACE IN PROGRESS', events[race.eventId].name, `Tactic: ${race.tactic}. Follow both cars through the race.`)}
    <div class="race-lanes">
      ${([['player', player, 'Your car'], ['opponent', opponent, 'Rival']] as const).map(([lane, car, label]) => `<article class="race-lane panel">
        <p class="eyebrow">${label}</p>${carCard(car)}
        <div class="progress-track" role="progressbar" aria-label="${label} race progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progress="${lane}"><div class="progress-fill"></div></div>
        <span class="progress-value" data-percent="${lane}" aria-hidden="true">0%</span>
      </article>`).join('')}
    </div>
    <div class="button-row"><button class="button button-secondary" type="button" data-action="skip">Skip Animation</button></div>
  </section>`;
}

export function raceResultScreen(race: Race, player: Car, opponent: Car) {
  return `<section class="race-result-screen" aria-labelledby="screen-title">
    ${pageHeading('FINISH LINE', 'Race Results', `${events[race.eventId].name} · ${race.tactic} tactic`)}
    <section class="race-result panel">
      <div class="result-summary">
        <div><p class="eyebrow">${race.won ? 'WIN' : 'LOSS'}</p><h2>${race.won ? 'Victory' : 'Defeat'}</h2></div>
        <span class="reward-badge">${icon('coin')} +${money(race.reward)} coins</span>
      </div>
      <p class="result-explanation">${escapeHtml(race.explanation)}</p>
      <div class="result-scores">
        <article>${carCard(player)}<p>Your score <strong>${race.playerScore.toFixed(2)}</strong></p></article>
        <article>${carCard(opponent)}<p>Rival score <strong>${race.opponentScore.toFixed(2)}</strong></p></article>
      </div>
      <div class="button-row">
        <button type="button" class="button button-primary" data-action="race-again">Race Again</button>
        <button type="button" class="button button-secondary" data-action="race-cases">Go to Cases</button>
        <button type="button" class="button button-secondary" data-action="race-garage">Go to Garage</button>
      </div>
    </section>
  </section>`;
}
