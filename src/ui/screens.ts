import '../racing.css';
import {
  cars, classes, events, rarities, tactics, tacticVolatility,
  type Car, type EventId, type Tactic,
} from '../game/config';
import { caseIds, casePool, casePrice, cases, type CaseId } from '../game/cases';
import { careerEvents, leagues, type CareerEvent, type CareerEventId, type CareerProgress } from '../game/career';
import { economy, gameClockNow } from '../game/economy';
import { previewRaceOpponent, raceRatings } from '../game/race';
import { junkyardRemainingMs, raceRewardPreview, type GameState } from '../game/save';
import { careerAward } from './career';
import { carCard, carImage, carStyle, carStats, escapeHtml, icon, money, oddsTable, pageHeading, rarityBadge, statEntries } from './components';
import { raceSceneMarkup } from './race-scene';

export const carsById = new Map(cars.map((car) => [car.id, car]));

const caseArtwork = {
  junkyard: { badge: 'garage', featuredCarId: 'bravik-110' },
  rookie: { badge: 'logo', featuredCarId: 'merovar-sprint' },
  street: { badge: 'bolt', featuredCarId: 'thalven-gt' },
  sport: { badge: 'career', featuredCarId: 'vossari-spyder' },
  performance: { badge: 'races', featuredCarId: 'kairox-r' },
  heritage: { badge: 'crest', featuredCarId: 'ardenza-proto' },
  elite: { badge: 'crest', featuredCarId: 'orvane-eclipse' },
  hyper: { badge: 'bolt', featuredCarId: 'novaryn-zero' },
} as const satisfies Record<CaseId, { badge: Parameters<typeof icon>[0]; featuredCarId: string }>;

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
  Safe: 'Better handling and reliability. Less speed and acceleration.',
  Balanced: 'Keep your base stats. No boosts or stat penalties.',
  Push: 'More speed and acceleration. Less handling and reliability.',
};

function option(value: string, label: string, current: string) {
  return `<option value="${escapeHtml(value)}"${value === current ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function cooldownTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function junkyardStatus(ms: number): string {
  return ms > 0 ? `Next free case in ${cooldownTime(ms)}` : 'Free case ready';
}

function caseStage(id: CaseId): string {
  return `<span class="case-stage" aria-hidden="true">
    <span class="case-crate">
      <span class="case-crate-lid"></span>
      <span class="case-crate-face">
        <span class="case-crate-plate">${icon(caseArtwork[id].badge)}</span>
      </span>
    </span>
  </span>`;
}

export function caseCollectionScreen(game: GameState, remainingMs: number) {
  const orderedCases = [...caseIds].sort((left, right) => casePrice(left) - casePrice(right));
  return `<section class="case-screen" aria-labelledby="screen-title">
    <header class="case-header">
      <h1 id="screen-title" tabindex="-1">Case Collection</h1>
      <dl class="case-stats" aria-label="Your progress">
        <div><dt>In garage</dt><dd>${game.garage.length}</dd></div>
        <div><dt>Cases opened</dt><dd>${game.progress.casesOpened}</dd></div>
        <div><dt>Races finished</dt><dd>${game.progress.racesCompleted}</dd></div>
      </dl>
    </header>
    <ul class="case-collection">
      ${orderedCases.map((id) => `<li>
        <button class="case-display panel" type="button" data-action="select-case" data-id="${id}" data-case-theme="${id}"
          aria-labelledby="collection-name-${id}" aria-describedby="collection-price-${id}">
          ${caseStage(id)}
          <span class="case-display-caption">
            <strong id="collection-name-${id}">${cases[id].name}</strong>
            <span class="case-display-price" id="collection-price-${id}">${id === 'junkyard'
              ? `<span>Free</span><span data-junkyard-status>${collectionAvailability(remainingMs)}</span>`
              : `${icon('coin')} ${money(casePrice(id))} coins`}</span>
          </span>
        </button>
      </li>`).join('')}
    </ul>
  </section>`;
}

function collectionAvailability(ms: number): string {
  return ms > 0 ? `in ${cooldownTime(ms)}` : 'Ready';
}

export function updateCaseCountdown(root: ParentNode, remainingMs: number): void {
  const status = root.querySelector<HTMLElement>('[data-junkyard-status]');
  const shortStatus = collectionAvailability(remainingMs);
  if (status && status.textContent !== shortStatus) status.textContent = shortStatus;
  const countdown = root.querySelector<HTMLElement>('[data-testid="junkyard-countdown"]');
  const button = root.querySelector<HTMLButtonElement>('[data-junkyard-open]');
  const label = junkyardStatus(remainingMs);
  if (countdown && countdown.textContent !== label) countdown.textContent = label;
  if (button && button.disabled !== (remainingMs > 0)) button.disabled = remainingMs > 0;
}

export function casesScreen(game: GameState, activeCase: CaseId, canOpen: boolean, now = gameClockNow(), unlimited = false) {
  const selected = cases[activeCase];
  const price = casePrice(activeCase);
  const free = activeCase === 'junkyard';
  const remainingMs = unlimited ? 0 : junkyardRemainingMs(game, now);
  const starterOpening = free && game.garage.length === 0;
  const pool = casePool(activeCase, starterOpening);
  const artwork = caseArtwork[activeCase];
  const featuredCar = pool.find(({ id }) => id === artwork.featuredCarId) ?? pool[0];
  return `<section class="case-screen" data-case-theme="${activeCase}" aria-labelledby="screen-title">
    <div class="case-back">
      <button class="button button-secondary" type="button" data-action="back-to-cases"><span aria-hidden="true">←</span> Back to Cases</button>
    </div>
    <div class="case-grid">
      <article class="case-feature panel" aria-labelledby="screen-title">
        ${caseStage(activeCase)}
        <div class="case-content">
          <h1 id="screen-title" tabindex="-1">${selected.name}</h1>
          <button type="button" class="button button-primary case-open-button" data-action="open-case"
            ${free ? 'data-junkyard-open aria-describedby="junkyard-countdown"' : 'aria-describedby="selected-case-price"'}${(free ? remainingMs === 0 : canOpen) ? '' : ' disabled'}>
            ${icon('cases')} ${free ? 'Open Free Case' : 'Open Case'}
          </button>
          ${free
            ? `<div class="junkyard-status"><span role="timer" id="junkyard-countdown" data-testid="junkyard-countdown">${junkyardStatus(remainingMs)}</span>
                <span>${unlimited ? 'Unlimited openings are active.' : `One free opening every ${economy.junkyardCooldownMs / 1000}s.`}</span></div>`
            : `<span class="case-price" id="selected-case-price">${icon('coin')} ${unlimited ? 'Free with unlimited coins' : `${money(price)} coins`}</span>`}
          ${free || canOpen ? '' : '<p class="action-hint">Win Career competitions or sell spare cars to earn coins.</p>'}
        </div>
      </article>
      <aside class="case-sidebar">
        <section class="odds-panel panel" aria-labelledby="odds-title">
          <div class="panel-heading"><h2 id="odds-title">Drop odds</h2><span>Per case</span></div>
          ${oddsTable(selected.odds)}
          <p class="odds-note">${starterOpening ? 'Your first drop is drawn from a pool of Rookie-ready cars. ' : activeCase === 'heritage' ? 'Collector cars only. ' : ''}Cars have equal odds within each rarity.</p>
        </section>
        <section class="case-preview panel" aria-labelledby="case-preview-title">
          <div class="case-preview-art">${carImage(featuredCar)}</div>
          <div class="case-preview-details">
            <p id="case-preview-title">${starterOpening ? 'Possible starter' : 'Featured drop'}</p>
            <h2>${escapeHtml(featuredCar.name)}</h2>
            ${rarityBadge(featuredCar.rarity)}
          </div>
        </section>
      </aside>
    </div>
    <details class="catalog-section panel">
      <summary class="catalog-summary">
        ${icon('garage')} <strong>Vehicle Pool</strong><span>${pool.length} ${starterOpening ? 'starter cars' : 'vehicles'}</span>
      </summary>
      <div class="card-grid">${pool.map((car) => carCard(car, { stats: true })).join('')}</div>
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
    <p>${game.garage.length ? 'Change the rarity or class to see more of your collection.' : 'Open the free Junkyard Case to add your first car.'}</p>
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

function replayRewardStatus(remainingMs: number): string {
  return remainingMs > 0 ? `Shared reward cooldown: ${cooldownTime(remainingMs)}` : 'Shared reward ready';
}

export function updateRaceReward(root: ParentNode, game: GameState, careerEventId?: CareerEventId, now = gameClockNow()): void {
  const status = root.querySelector<HTMLElement>('[data-race-reward-status]');
  if (!status) return;
  const label = replayRewardStatus(raceRewardPreview(game, careerEventId, now).remainingMs);
  if (status.textContent !== label) status.textContent = label;
}

function racePortrait(car: Car, label: string, side: 'player' | 'rival', score?: number): string {
  const preview = side === 'rival' && score === undefined ? ' data-testid="race-preview-opponent"' : '';
  return `<article class="race-portrait ${carStyle(car)}" data-race-portrait="${side}" data-car-id="${car.id}"${preview}>
    <div class="race-portrait-image">${carImage(car, true)}<span class="race-portrait-side">${escapeHtml(label)}</span></div>
    <div class="race-portrait-caption">
      <h3>${escapeHtml(car.name)}</h3>
      <p>${rarityBadge(car.rarity)}<span class="car-class">${escapeHtml(car.class)}</span></p>
      ${score === undefined ? '' : `<p class="race-finish-score">Finish score <strong>${score.toFixed(2)}</strong></p>`}
    </div>
  </article>`;
}

function raceStatComparison(player: Car, rival: Car, eventId: EventId, tactic: Tactic, paceRatio: number): string {
  const { weights } = events[eventId];
  const ratings = raceRatings(eventId, player, rival, tactic, paceRatio);
  const rows = [...statEntries].sort(([left], [right]) => weights[right] - weights[left]);
  return `<table class="race-stat-comparison">
    <caption class="race-accessible">Vehicle stats and track weights</caption>
    <thead><tr><th scope="col">You</th><th scope="col">Track weight</th><th scope="col">Rival</th></tr></thead>
    <tbody>${rows.map(([stat, label]) => `<tr>
      <td><span>${player.stats[stat]}</span><span class="race-meter" aria-hidden="true"><span style="--race-meter-progress:${player.stats[stat]}%"></span></span></td>
      <th scope="row">${label} <strong>${weights[stat]}%</strong></th>
      <td><span class="race-meter" aria-hidden="true"><span style="--race-meter-progress:${rival.stats[stat]}%"></span></span><span>${rival.stats[stat]}</span></td>
    </tr>`).join('')}</tbody>
  </table>
  <p class="race-pace-note">Your weighted pace with ${tactic} <strong>${ratings.playerTactical.toFixed(1)}</strong>
    <span aria-hidden="true">·</span> Rival event pace <strong>${ratings.rivalPace.toFixed(1)}</strong>. Race-day variation still applies.</p>`;
}

export function raceSetupScreen(
  game: GameState, eventId: EventId, tactic: Tactic, competition?: CareerEvent, now = gameClockNow(), freeRaceSeed = 0,
) {
  const selected = game.garage.find((car) => car.id === game.selectedId);
  const car = selected && carsById.get(selected.carId);
  const races = game.races.filter((race) => race.careerEventId === competition?.id).slice(-3).reverse();
  const rival = competition ? carsById.get(competition.rivalCarId) : car && previewRaceOpponent(eventId, car, freeRaceSeed);
  const event = events[eventId];
  const reward = raceRewardPreview(game, competition?.id, now);
  const trackOptions = (Object.keys(events) as EventId[]).map((id) => `<button class="race-discipline" type="button"
      data-action="event" data-id="${id}" aria-label="${escapeHtml(events[id].name)}" aria-pressed="${id === eventId}" data-discipline="${id}">
      ${icon(id === 'drag' ? 'bolt' : id === 'endurance' ? 'crest' : 'races')} <span>${escapeHtml(events[id].name)}</span></button>`).join('');

  return `<section class="race-screen race-desk" aria-labelledby="screen-title">
    ${competition
      ? pageHeading(escapeHtml(leagues[competition.leagueId].name), escapeHtml(competition.name), '')
      : pageHeading('FREE RACES', 'Race Control', '')}
    ${competition ? '' : `<div class="race-disciplines" role="group" aria-label="Choose a track">${trackOptions}</div>`}
    <div class="race-desk-grid">
      <div class="race-desk-main">
        <section class="race-track-info panel" aria-labelledby="event-title" data-discipline="${eventId}">
          <div class="race-track-icon">${icon(eventId === 'drag' ? 'bolt' : eventId === 'endurance' ? 'crest' : 'races')}</div>
          <div><h2 id="event-title">${escapeHtml(event.name)}</h2><p>${escapeHtml(event.description)}</p></div>
          ${competition ? `<span class="race-difficulty">${escapeHtml(competition.difficulty)}</span>` : ''}
        </section>
        ${car && rival ? `<section class="race-matchup panel" aria-labelledby="race-matchup-title">
          <h2 id="race-matchup-title">Head to head</h2>
          <div class="race-portraits">
            ${racePortrait(car, 'Your car', 'player')}
            ${racePortrait(rival, competition?.rivalName ?? 'Rival', 'rival')}
          </div>
          ${raceStatComparison(car, rival, eventId, tactic, competition?.paceRatio ?? 1)}
        </section>` : ''}
      </div>
      <section class="race-pit panel" aria-labelledby="entry-title">
        <h2 id="entry-title">Race entry</h2>
        ${car && selected ? `<label class="car-selector">Race car <select data-filter="raceCar">${game.garage.map((entry, index) => {
          const model = carsById.get(entry.carId);
          return model ? option(entry.id, `${model.name} · #${index + 1}`, selected.id) : '';
        }).join('')}</select></label>` : ''}
        <div class="race-tactic-group" role="group" aria-label="Choose a tactic">${tactics.map((entry) => `<button class="race-tactic" type="button"
          data-action="tactic" data-id="${entry}" aria-label="${entry}" aria-pressed="${entry === tactic}">
          <strong>${entry}</strong><small>${tacticDescriptions[entry]} Up to ±${tacticVolatility[entry] * 100}% race-day variation.</small></button>`).join('')}</div>
        <div class="race-payout">
          <dl>
            ${reward.firstWin ? `<div><dt>First win</dt><dd>+${money(reward.firstWin)} coins</dd></div>` : ''}
            <div><dt>${competition ? 'Replay win' : 'Win'}</dt><dd>+${money(reward.replayWin)} coins</dd></div>
          </dl>
          ${reward.firstWin ? '<p>First career wins pay immediately.</p>' : ''}
          <p role="timer" data-race-reward-status>${replayRewardStatus(reward.remainingMs)}</p>
          <p>Free-race and replay wins share a ${economy.raceRewardCooldownMs / 1000}s reward cooldown. Losses earn no coins.</p>
        </div>
        ${car && rival
          ? `<button type="button" class="button button-primary" data-action="start-race">${icon('races')} Start Race</button>`
          : '<p>Add a car to your garage to enter a race.</p><button type="button" class="button button-primary" data-action="nav-cases">Go to Cases</button>'}
        ${competition ? '<button type="button" class="button button-secondary" data-action="nav-career">Back to Career</button>' : ''}
      </section>
    </div>
    ${races.length ? `<section class="race-history panel" aria-label="Recent races">
      <div class="panel-heading"><h2>Recent races</h2></div>
      <ul>${races.map((race) => `<li><span>${escapeHtml(events[race.eventId].name)} · ${escapeHtml(carsById.get(race.playerCarId)?.name ?? 'Unknown car')}</span><strong>${race.won ? 'Win' : 'Loss'} · +${money(race.reward)} coins</strong></li>`).join('')}</ul>
    </section>` : ''}
  </section>`;
}

export function caseAnimationScreen(caseId: CaseId, { entries, winnerIndex }: { entries: Car[]; winnerIndex: number }) {
  return `<section class="opening-screen" data-case-theme="${caseId}" aria-labelledby="screen-title">
    ${pageHeading(cases[caseId].name, 'Opening Case', 'The reward is already drawn. The reel is a visual reveal.')}
    <section class="roulette-panel panel" aria-label="Case opening animation">
      <div class="roulette-viewport" aria-hidden="true">
        <div class="roulette-track">${entries.map((entry, index) => `<div class="roulette-card ${carStyle(entry)}" data-car-id="${escapeHtml(entry.id)}"${index === winnerIndex ? ' data-reel-winner' : ''}>
          <div class="roulette-art">${carImage(entry, true)}</div><strong>${escapeHtml(entry.name)}</strong>${rarityBadge(entry.rarity)}
        </div>`).join('')}</div>
        <div class="roulette-marker"></div>
      </div>
      <div class="button-row"><button class="button button-secondary" type="button" data-action="skip">Skip Animation</button></div>
    </section>
  </section>`;
}

export function caseResultScreen(game: GameState, car: Car, caseId: CaseId) {
  const owned = game.garage.find((entry) => entry.id === game.pendingCase);
  const canSell = game.garage.length > 1 && owned && !owned.locked;
  return `<section class="case-result-screen" data-case-theme="${caseId}" aria-labelledby="screen-title">
    ${pageHeading(cases[caseId].name, 'Case Result', 'Your new car is already saved to your garage.')}
    <article class="case-result panel ${carStyle(car)}" data-car-id="${escapeHtml(car.id)}">
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
  const competition = race.careerEventId && careerEvents[race.careerEventId];
  const event = events[race.eventId];
  return `<section class="race-animation-screen race-live-screen" aria-labelledby="screen-title">
    <header class="race-live-heading">
      <div><p class="eyebrow">${competition ? escapeHtml(leagues[competition.leagueId].name) : 'Free race'}</p>
        <h1 id="screen-title" tabindex="-1">${escapeHtml(competition?.name ?? event.name)}</h1></div>
      <button class="button button-secondary" type="button" data-action="skip">Skip Race <span aria-hidden="true">→</span></button>
    </header>
    ${raceSceneMarkup(race, player, opponent)}
  </section>`;
}

function signedScore(value: number): string {
  const magnitude = Math.abs(value).toFixed(2);
  if (magnitude === '0.00') return magnitude;
  return `${value > 0 ? '+' : '−'}${magnitude}`;
}

function raceBreakdown(race: Race): string {
  const breakdown = race.breakdown;
  if (!breakdown) return '';
  const [[strongest, label]] = [...statEntries]
    .sort(([left], [right]) => Math.abs(breakdown.stats[right]) - Math.abs(breakdown.stats[left]));
  const trackGap = Object.values(breakdown.stats).reduce((sum, value) => sum + value, 0);
  const raceDayGap = breakdown.playerVariation - breakdown.rivalVariation;
  const statDetail = breakdown.stats[strongest] === 0 ? 'Both cars have equal track-weighted stats.'
    : `Largest stat difference: ${label} (${signedScore(breakdown.stats[strongest])}).`;
  return `<dl class="race-breakdown" aria-label="Score breakdown from your perspective">
    <div><dt>Track-weighted car gap</dt><dd>${signedScore(trackGap)}</dd>
      <small>${statDetail}</small></div>
    <div><dt>${race.tactic} effect</dt><dd>${signedScore(breakdown.tacticDelta)}</dd>
      <small>${tacticDescriptions[race.tactic]}</small></div>
    ${Math.abs(breakdown.rivalPaceDelta) >= 0.005 ? `<div><dt>Career rival pace</dt><dd>${signedScore(-breakdown.rivalPaceDelta)}</dd>
      <small>The event adjusts the rival’s pace.</small></div>` : ''}
    <div><dt>Race-day swing</dt><dd>${signedScore(raceDayGap)}</dd><small>Difference in race-day variation between both cars.</small></div>
  </dl>`;
}
function raceCareerProgress(competition: CareerEvent, progress: CareerProgress): string {
  const league = leagues[competition.leagueId];
  const won = league.eventIds.filter((id) => progress.completed.includes(id)).length;
  return `<p class="race-career-progress">Career progress <strong>${escapeHtml(league.name)} · ${won}/${league.eventIds.length} wins</strong></p>`;
}

export function raceResultScreen(race: Race, player: Car, opponent: Car, career?: CareerProgress) {
  const competition = race.careerEventId ? careerEvents[race.careerEventId] : undefined;
  const event = events[race.eventId];
  const eventName = competition ? `${competition.name} · ${event.name}` : event.name;
  const coinLabel = race.rewardReason === 'cooldown' ? 'The shared reward cooldown was active at the start.'
    : race.rewardReason === 'loss' ? 'Losses do not pay coins.' : '';
  const scoreGap = race.playerScore - race.opponentScore;
  const margin = scoreGap === 0 ? 'Tie-break' : `${Math.abs(scoreGap).toFixed(2)}-point margin`;
  return `<section class="race-result-screen race-review" aria-labelledby="screen-title">
    ${pageHeading('FINISH LINE', 'Race Results', escapeHtml(`${eventName} · ${race.tactic}`))}
    <section class="race-result race-review-card panel" data-race-outcome="${race.won ? 'victory' : 'defeat'}">
      <div class="result-summary">
        <div><h2>${race.won ? 'Victory' : 'Defeat'}</h2><p class="race-result-margin">${margin}</p></div>
        <span class="reward-badge${race.reward ? '' : ' reward-badge-empty'}">${icon('coin')} +${money(race.reward)} coins</span>
      </div>
      ${race.careerAward ? careerAward(race.careerAward) : ''}
      ${competition && career ? raceCareerProgress(competition, career) : ''}
      <div class="race-portraits">
        ${racePortrait(player, 'Your car', 'player', race.playerScore)}
        ${racePortrait(opponent, competition?.rivalName ?? 'Rival', 'rival', race.opponentScore)}
      </div>
      <section class="race-result-analysis" aria-label="Race analysis">
        <h3>Why it finished this way</h3>
        <p class="result-explanation">${escapeHtml(race.explanation)}</p>
        ${raceBreakdown(race)}
      </section>
      ${coinLabel ? `<p class="race-result-reward-note">${coinLabel}</p>` : ''}
      <div class="button-row">
        <button type="button" class="button button-primary" data-action="race-again">Race Again</button>
        ${competition ? '<button type="button" class="button button-secondary" data-action="race-career">Back to Career</button>' : ''}
        <button type="button" class="button button-secondary" data-action="race-cases">Go to Cases</button>
        <button type="button" class="button button-secondary" data-action="race-garage">Go to Garage</button>
      </div>
    </section>
  </section>`;
}
