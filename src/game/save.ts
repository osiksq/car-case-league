import { cars, economy, events, rarities, rookieOdds, starterOdds, tactics, type Car, type EventId, type Tactic } from './config';
import { createRandom } from './random';
import { simulateRace, type RacePhase, type RaceResult } from './race';

export type { RaceResult } from './race';

export const storageKey = 'car-case-league.save';
const saveVersion = 1;
const carById = new Map(cars.map((car) => [car.id, car]));
const carsByRarity = new Map(rarities.map((rarity) => [rarity, cars.filter((car) => car.rarity === rarity)]));

export interface OwnedCar {
  id: string;
  carId: string;
  locked: boolean;
}

export interface GameState {
  version: typeof saveVersion;
  coins: number;
  garage: OwnedCar[];
  selectedId: string | null;
  progress: { casesOpened: number; racesCompleted: number };
  races: RaceResult[];
  pendingCase: string | null;
  pendingRace: RaceResult | null;
}

export function createGame(): GameState {
  return {
    version: saveVersion,
    coins: economy.startingCoins,
    garage: [],
    selectedId: null,
    progress: { casesOpened: 0, racesCompleted: 0 },
    races: [],
    pendingCase: null,
    pendingRace: null,
  };
}

function requireIdle(state: GameState): void {
  if (state.pendingCase || state.pendingRace) throw new Error('Finish the current case or race first.');
}

function requireOwnedCar(state: GameState, id: string | null): OwnedCar {
  const car = state.garage.find((candidate) => candidate.id === id);
  if (!car) throw new Error('Choose a car from your garage first.');
  return car;
}

function chooseReward(first: boolean, seed?: number): Car {
  const odds = first ? starterOdds : rookieOdds;
  const random = createRandom(seed);
  const roll = random() * 100;
  let cumulative = 0;
  for (const rarity of rarities) {
    cumulative += odds[rarity];
    if (roll >= cumulative) continue;
    const pool = carsByRarity.get(rarity);
    if (!pool?.length) throw new Error(`The ${rarity} reward pool is empty.`);
    return pool[Math.floor(random() * pool.length)];
  }
  throw new Error('Rookie Case odds do not cover every roll.');
}

export function openCase(state: GameState, seed?: number): GameState {
  requireIdle(state);
  const first = state.progress.casesOpened === 0;
  const price = first ? 0 : economy.casePrice;
  if (state.coins < price) throw new Error('You do not have enough coins for this case.');
  const casesOpened = state.progress.casesOpened + 1;
  const reward = chooseReward(first, seed);
  const owned = { id: `car-${casesOpened}`, carId: reward.id, locked: false };

  // Commit the debit, ownership and pending reveal together before animation.
  return {
    ...state,
    coins: state.coins - price,
    garage: [...state.garage, owned],
    selectedId: state.selectedId ?? owned.id,
    progress: { ...state.progress, casesOpened },
    pendingCase: owned.id,
  };
}

export function finishCase(state: GameState, action: 'keep' | 'sell'): GameState {
  if (!state.pendingCase) return state;
  const resolved = { ...state, pendingCase: null };
  return action === 'sell' ? sellCar(resolved, state.pendingCase) : resolved;
}

export function selectCar(state: GameState, id: string): GameState {
  requireIdle(state);
  requireOwnedCar(state, id);
  return { ...state, selectedId: id };
}

export function toggleLock(state: GameState, id: string): GameState {
  requireIdle(state);
  const car = requireOwnedCar(state, id);
  return { ...state, garage: state.garage.map((item) => item.id === id ? { ...car, locked: !car.locked } : item) };
}

export function sellCar(state: GameState, id: string): GameState {
  requireIdle(state);
  const owned = requireOwnedCar(state, id);
  if (owned.locked) throw new Error('This car is locked. Unlock it before selling.');
  if (state.garage.length <= 1) throw new Error('You cannot sell your last car.');
  const car = carById.get(owned.carId);
  if (!car) throw new Error('This car cannot be sold.');

  const garage = state.garage.filter((item) => item.id !== id);
  return {
    ...state,
    coins: state.coins + car.resaleValue,
    garage,
    selectedId: state.selectedId === id ? garage[0].id : state.selectedId,
  };
}

export function startRace(state: GameState, eventId: EventId, tactic: Tactic, seed?: number): GameState {
  requireIdle(state);
  const owned = requireOwnedCar(state, state.selectedId);
  const car = carById.get(owned.carId);
  if (!car) throw new Error('The selected car is unavailable.');
  if (!Object.hasOwn(events, eventId) || !tactics.includes(tactic)) throw new Error('Choose a valid race and tactic.');
  const racesCompleted = state.progress.racesCompleted + 1;
  const race = simulateRace(`race-${racesCompleted}`, eventId, tactic, car, seed);

  // Stage the result, history and wallet in the same snapshot. Dismissing a
  // reveal or loading a pending result never credits the reward a second time.
  return {
    ...state,
    coins: state.coins + race.reward,
    progress: { ...state.progress, racesCompleted },
    races: [...state.races, race],
    pendingRace: race,
  };
}

export function finishRace(state: GameState): GameState {
  return state.pendingRace ? { ...state, pendingRace: null } : state;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNumberInRange(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

function isCarId(value: unknown): value is string {
  return typeof value === 'string' && carById.has(value);
}

function isOwnedCar(value: unknown): value is OwnedCar {
  return isObject(value) && typeof value.id === 'string' && /^car-[1-9]\d*$/.test(value.id)
    && isCarId(value.carId) && typeof value.locked === 'boolean';
}

function isRacePhase(value: unknown): value is RacePhase {
  return isObject(value) && isNumberInRange(value.player, 100) && isNumberInRange(value.opponent, 100);
}

function isRaceResult(value: unknown): value is RaceResult {
  return isObject(value) && typeof value.id === 'string' && /^race-[1-9]\d*$/.test(value.id)
    && typeof value.eventId === 'string' && Object.hasOwn(events, value.eventId)
    && tactics.some((tactic) => tactic === value.tactic)
    && isCarId(value.playerCarId) && isCarId(value.opponentCarId) && typeof value.won === 'boolean'
    && isCount(value.reward) && isNumberInRange(value.playerScore, 120) && isNumberInRange(value.opponentScore, 120)
    && typeof value.explanation === 'string'
    && Array.isArray(value.phases) && value.phases.length >= 2 && value.phases.every(isRacePhase);
}

function isSave(value: unknown): value is GameState {
  if (!isObject(value) || value.version !== saveVersion || !isCount(value.coins)) return false;
  if (!isObject(value.progress) || !isCount(value.progress.casesOpened) || !isCount(value.progress.racesCompleted)) return false;
  if (!Array.isArray(value.garage) || !value.garage.every(isOwnedCar)) return false;
  if (!Array.isArray(value.races) || !value.races.every(isRaceResult)) return false;
  const garageIds = new Set(value.garage.map(({ id }) => id));
  const { casesOpened, racesCompleted } = value.progress;
  if (garageIds.size !== value.garage.length || value.garage.some(({ id }) => Number(id.slice(4)) > casesOpened)) return false;
  if (casesOpened > 0 && value.garage.length === 0) return false;
  if (value.garage.length ? typeof value.selectedId !== 'string' || !garageIds.has(value.selectedId) : value.selectedId !== null) return false;
  if (value.pendingCase !== null && (typeof value.pendingCase !== 'string' || !garageIds.has(value.pendingCase))) return false;
  if (value.races.length !== racesCompleted || value.races.some(({ id }, index) => id !== `race-${index + 1}`)) return false;
  return value.pendingRace === null || (value.pendingCase === null && isRaceResult(value.pendingRace)
    && value.pendingRace.id === value.races.at(-1)?.id);
}

function parseSave(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function readSave(storage: Pick<Storage, 'getItem'>, key = storageKey): GameState {
  try {
    const value = parseSave(storage.getItem(key));
    if (!isSave(value)) return createGame();
    return value.pendingRace ? { ...value, pendingRace: value.races.at(-1) ?? null } : value;
  } catch {
    return createGame();
  }
}

export function writeSave(
  storage: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>>,
  state: GameState,
  key = storageKey,
): void {
  const existing = parseSave(storage.getItem?.(key) ?? null);
  if (isObject(existing) && isCount(existing.version) && existing.version > saveVersion) {
    throw new Error('This save belongs to a newer version of Car Case League.');
  }
  storage.setItem(key, JSON.stringify(state));
}
