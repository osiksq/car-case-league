import { cars, events, stats, tactics, type EventId, type Tactic } from './config';
import {
  careerEvents, completeCareerEvent, createCareerProgress, isCareerEventId,
  type CareerEvent, type CareerEventId, type CareerProgress,
} from './career';
import { casePrice, cases, drawCaseReward, type CaseId } from './cases';
import { cooldownRemainingMs, economy, gameClockNow, gameClockStartedAt } from './economy';
import { simulateRace, type RacePhase, type RaceResult } from './race';

export type { RaceResult } from './race';

export const storageKey = 'car-case-league.save';
const saveVersion = 2;
const carById = new Map(cars.map((car) => [car.id, car]));

export interface OwnedCar {
  id: string;
  carId: string;
  locked: boolean;
}

interface EconomyTiming {
  lastSeenAt: number;
  raceRewardedAt: number | null;
}

export interface GameState {
  version: typeof saveVersion;
  coins: number;
  garage: OwnedCar[];
  selectedId: string | null;
  progress: { casesOpened: number; racesCompleted: number };
  career: CareerProgress;
  timing: EconomyTiming;
  races: RaceResult[];
  pendingCase: string | null;
  pendingCaseType?: CaseId;
  pendingRace: RaceResult | null;
}

function createTiming(): EconomyTiming {
  return { lastSeenAt: 0, raceRewardedAt: null };
}

export function createGame(): GameState {
  return {
    version: saveVersion,
    coins: economy.startingCoins,
    garage: [],
    selectedId: null,
    progress: { casesOpened: 0, racesCompleted: 0 },
    career: createCareerProgress(),
    timing: createTiming(),
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

export function openCase(state: GameState, id: CaseId = 'junkyard', seed?: number, now = gameClockNow(), unlimited = false): GameState {
  requireIdle(state);
  const price = unlimited ? 0 : casePrice(id);
  if (state.coins < price) throw new Error('You do not have enough coins for this case.');
  const casesOpened = state.progress.casesOpened + 1;
  const reward = drawCaseReward(id, seed, id === 'junkyard' && state.garage.length === 0);
  const owned = { id: `car-${casesOpened}`, carId: reward.id, locked: false };
  const lastSeenAt = Math.max(state.timing.lastSeenAt, now);

  // Commit the debit, ownership and pending reveal together before animation.
  return {
    ...state,
    coins: state.coins - price,
    garage: [...state.garage, owned],
    selectedId: state.selectedId ?? owned.id,
    progress: { ...state.progress, casesOpened },
    timing: { ...state.timing, lastSeenAt },
    pendingCase: owned.id,
    pendingCaseType: id,
  };
}

export function finishCase(state: GameState, action: 'keep' | 'sell'): GameState {
  if (!state.pendingCase) return state;
  const resolved = { ...state, pendingCase: null };
  delete resolved.pendingCaseType;
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

export function raceRewardPreview(state: GameState, careerEventId?: CareerEventId, now = gameClockNow()) {
  const competition = careerEventId && careerEvents[careerEventId];
  const rewards = competition ? economy.career[competition.leagueId] : undefined;
  const firstWin = competition && state.career.unlocked.includes(competition.leagueId)
    && !state.career.completed.includes(competition.id) ? rewards?.firstWin ?? 0 : 0;
  return {
    firstWin,
    replayWin: rewards?.replayWin ?? economy.freeRaceWin,
    remainingMs: cooldownRemainingMs(state.timing.raceRewardedAt, economy.raceRewardCooldownMs, now),
  };
}

export function startRace(state: GameState, eventId: EventId, tactic: Tactic, seed?: number, now = gameClockNow()): GameState {
  return raceSession(state, eventId, tactic, seed, now);
}

export function startCareerRace(state: GameState, id: CareerEventId, tactic: Tactic, seed?: number, now = gameClockNow()): GameState {
  if (!isCareerEventId(id)) throw new Error('Choose a valid career competition.');
  const event = careerEvents[id];
  if (!state.career.unlocked.includes(event.leagueId)) throw new Error('This career league is locked.');
  return raceSession(state, event.eventId, tactic, seed, now, event);
}

function raceSession(state: GameState, eventId: EventId, tactic: Tactic, seed: number | undefined, now: number, competition?: CareerEvent): GameState {
  requireIdle(state);
  const owned = requireOwnedCar(state, state.selectedId);
  const car = carById.get(owned.carId);
  if (!car) throw new Error('The selected car is unavailable.');
  if (!Object.hasOwn(events, eventId) || !tactics.includes(tactic)) throw new Error('Choose a valid race and tactic.');
  const opponent = competition && carById.get(competition.rivalCarId);
  if (competition && !opponent) throw new Error('The career rival is unavailable.');
  const rival = competition && opponent
    ? {
      opponent,
      name: competition.rivalName,
      paceRatio: competition.paceRatio,
      volatility: competition.rivalVolatility,
    }
    : undefined;
  const racesCompleted = state.progress.racesCompleted + 1;
  const result = simulateRace(`race-${racesCompleted}`, eventId, tactic, car, seed, rival);
  const payout = raceRewardPreview(state, competition?.id, now);
  let reward = economy.lossReward;
  let rewardReason: NonNullable<RaceResult['rewardReason']> = 'loss';
  if (result.won) {
    if (payout.firstWin > 0) {
      reward = payout.firstWin;
      rewardReason = 'first-clear';
    } else if (payout.remainingMs === 0) {
      reward = payout.replayWin;
      rewardReason = 'win';
    } else {
      rewardReason = 'cooldown';
    }
  }
  const { progress: career, award } = competition && result.won
    ? completeCareerEvent(state.career, competition.id)
    : { progress: state.career, award: undefined };
  const race: RaceResult = {
    ...result, reward, rewardReason,
    ...(competition ? { careerEventId: competition.id } : {}),
    ...(award ? { careerAward: award } : {}),
  };
  const lastSeenAt = Math.max(state.timing.lastSeenAt, now);

  // Commit the result, wallet and career progression before showing the reveal.
  return {
    ...state,
    coins: state.coins + race.reward,
    progress: { ...state.progress, racesCompleted },
    career,
    timing: {
      ...state.timing,
      lastSeenAt,
      raceRewardedAt: rewardReason === 'win' ? lastSeenAt : state.timing.raceRewardedAt,
    },
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

function isScoreDelta(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 120;
}

function isValidBreakdown(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { stats: gaps, tacticDelta, playerVariation, rivalPaceDelta, rivalVariation } = value;
  return isObject(gaps) && stats.every((stat) => isScoreDelta(gaps[stat]))
    && [tacticDelta, playerVariation, rivalPaceDelta, rivalVariation].every(isScoreDelta);
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

function hasValidCaseMetadata(value: Record<string, unknown>): boolean {
  return value.pendingCaseType === undefined || (value.pendingCase !== null
    && typeof value.pendingCaseType === 'string' && Object.hasOwn(cases, value.pendingCaseType));
}

type StoredGame = Omit<GameState, 'career' | 'version' | 'timing'> & { version: 1 | 2; timing?: unknown };

function isSave(value: unknown): value is StoredGame {
  if (!isObject(value) || (value.version !== 1 && value.version !== saveVersion) || !isCount(value.coins)) return false;
  if (!isObject(value.progress) || !isCount(value.progress.casesOpened) || !isCount(value.progress.racesCompleted)) return false;
  if (!Array.isArray(value.garage) || !value.garage.every(isOwnedCar)) return false;
  if (!Array.isArray(value.races) || !value.races.every(isRaceResult)) return false;
  const garageIds = new Set(value.garage.map(({ id }) => id));
  const { casesOpened, racesCompleted } = value.progress;
  if (garageIds.size !== value.garage.length || value.garage.some(({ id }) => Number(id.slice(4)) > casesOpened)) return false;
  if (casesOpened > 0 && value.garage.length === 0) return false;
  if (value.garage.length ? typeof value.selectedId !== 'string' || !garageIds.has(value.selectedId) : value.selectedId !== null) return false;
  if (value.pendingCase !== null && (typeof value.pendingCase !== 'string' || !garageIds.has(value.pendingCase))) return false;
  if (!hasValidCaseMetadata(value)) return false;
  if (value.races.length !== racesCompleted || value.races.some(({ id }, index) => id !== `race-${index + 1}`)) return false;
  return value.pendingRace === null || (value.pendingCase === null && isRaceResult(value.pendingRace)
    && value.pendingRace.id === value.races.at(-1)?.id);
}

function recoverTiming(timing: unknown, now: number, clockStartedAt: number): EconomyTiming {
  if (!isObject(timing) || !isCount(timing.lastSeenAt)) return createTiming();
  const recordedAt = timing.lastSeenAt;
  // A clock correction between page loads must not create a wait longer than
  // the original cooldown. Rebase against the current page's monotonic clock.
  const shiftedAt = recordedAt > now ? Math.min(now, clockStartedAt) : recordedAt;
  const recoverTimestamp = (timestamp: unknown) => isCount(timestamp) && timestamp <= recordedAt
    ? Math.max(0, timestamp - (recordedAt - shiftedAt))
    : null;
  return {
    lastSeenAt: shiftedAt,
    raceRewardedAt: recoverTimestamp(timing.raceRewardedAt),
  };
}

function parseSave(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function readSave(
  storage: Pick<Storage, 'getItem'>, key = storageKey, now = gameClockNow(), clockStartedAt = gameClockStartedAt,
): GameState {
  try {
    const value = parseSave(storage.getItem(key));
    if (isObject(value) && !hasValidCaseMetadata(value)) delete value.pendingCaseType;
    if (!isSave(value)) return createGame();
    // Recorded wins are authoritative so old saves and corrupted career metadata
    // can be restored without changing the wallet or handing out awards again.
    let career = createCareerProgress();
    const races = value.races.map(({ careerEventId, careerAward: _award, ...race }): RaceResult => {
      if (race.breakdown !== undefined && !isValidBreakdown(race.breakdown)) delete race.breakdown;
      if (!isCareerEventId(careerEventId) || careerEvents[careerEventId].eventId !== race.eventId) return race;
      const completion = race.won ? completeCareerEvent(career, careerEventId) : { progress: career, award: undefined };
      career = completion.progress;
      return { ...race, careerEventId, ...(completion.award ? { careerAward: completion.award } : {}) };
    });
    return {
      ...value,
      version: saveVersion,
      timing: value.version === 1 ? createTiming() : recoverTiming(value.timing, now, clockStartedAt),
      career,
      races,
      pendingRace: value.pendingRace ? races.at(-1) ?? null : null,
    };
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
