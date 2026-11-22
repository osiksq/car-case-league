import { describe, expect, it } from 'vitest';
import { careerEvents, createCareerProgress, leagueIds, leagues, type CareerEventId } from '../src/game/career';
import { cars, economy, type Car, type Tactic } from '../src/game/config';
import { simulateRace } from '../src/game/race';
import {
  createGame, finishCase, finishRace, openCase, readSave, startCareerRace, startRace,
  storageKey, writeSave, type GameState,
} from '../src/game/save';

function startWithCar(): GameState {
  return finishCase(openCase(createGame(), 'rookie', 12), 'keep');
}

function catalogCar(id: string): Car {
  const car = cars.find((model) => model.id === id);
  if (!car) throw new Error(`Unknown fixture car: ${id}`);
  return car;
}

function careerWithCar(carId: string): GameState {
  const ready = startWithCar();
  return {
    ...ready,
    garage: [{ ...ready.garage[0], carId }],
    career: { completed: [], unlocked: [...leagueIds] },
  };
}

function winRate(carId: string, eventId: CareerEventId, tactic: Tactic = 'Balanced'): number {
  const state = careerWithCar(carId);
  const samples = 2_048;
  let wins = 0;
  for (let seed = 0; seed < samples; seed++) {
    if (startCareerRace(state, eventId, tactic, seed).pendingRace?.won) wins++;
  }
  return wins / samples;
}

function raceWithOutcome(state: GameState, eventId: CareerEventId, won: boolean): GameState {
  for (let seed = 0; seed < 256; seed++) {
    const race = startCareerRace(state, eventId, 'Balanced', seed);
    if (race.pendingRace?.won === won) return race;
  }
  throw new Error(`Expected a ${won ? 'win' : 'loss'} in ${eventId}`);
}

function storageFor(key = storageKey) {
  const entries = new Map<string, string>();
  return {
    getItem: (name: string) => entries.get(name) ?? null,
    setItem: (name: string, value: string) => void entries.set(name, value),
    write: (value: unknown) => void entries.set(key, JSON.stringify(value)),
  };
}

describe('career progression', () => {
  it('starts in Rookie, gates later leagues, and requires a selected car', () => {
    const fresh = createGame();
    expect(fresh.career).toEqual({ completed: [], unlocked: ['rookie'] });
    expect(() => startCareerRace(fresh, 'depot-sprint', 'Balanced', 0)).toThrow(/choose a car/i);
    const ready = startWithCar();
    expect(() => startCareerRace(ready, leagues.street.eventIds[0], 'Balanced', 0)).toThrow(/locked/i);
    expect(() => startCareerRace(openCase(fresh, 'rookie', 12), 'depot-sprint', 'Balanced', 0)).toThrow(/finish/i);
  });

  it('advances through all four leagues with distinct wins and a non-Mythic garage', () => {
    const ready = startWithCar();
    const garage = [...ready.garage, { id: 'car-2', carId: 'sorevik-t9', locked: false }];
    let game = { ...ready, garage, progress: { ...ready.progress, casesOpened: 2 } };

    for (const [index, league] of leagueIds.entries()) {
      const [first, second] = leagues[league].eventIds;
      if (index === 1) game = { ...game, selectedId: 'car-2' };
      expect(game.career.unlocked).toEqual(leagueIds.slice(0, index + 1));
      expect(careerEvents[first].rivalCarId).not.toBe(careerEvents[second].rivalCarId);
      const firstWin = raceWithOutcome(game, first, true);
      expect(firstWin.pendingRace?.careerAward).toBeUndefined();
      expect(firstWin.career.unlocked).toEqual(game.career.unlocked);

      const promotion = raceWithOutcome(finishRace(firstWin), second, true);
      expect(promotion.pendingRace?.careerEventId).toBe(second);
      expect(promotion.pendingRace?.opponentCarId).toBe(careerEvents[second].rivalCarId);
      expect(promotion.pendingRace?.careerAward).toBe(league);
      expect(promotion.career.unlocked).toEqual(leagueIds.slice(0, index + 2));
      expect(promotion.career.completed).toEqual(leagueIds.slice(0, index + 1).flatMap((id) => leagues[id].eventIds));
      expect(promotion.garage).toEqual(garage);
      game = finishRace(promotion);
    }

    expect(game.coins).toBe(economy.startingCoins + 8 * economy.winReward);
    expect(game.races.filter((race) => race.careerAward).map((race) => race.careerAward)).toEqual(leagueIds);
  });

  it('records attempts and awards standard payouts without advancing on losses, free races, or repeated wins', () => {
    const ready = startWithCar();
    const failed = raceWithOutcome(ready, 'foundry-loop', false);
    expect(failed.career).toEqual(ready.career);
    expect(failed.coins).toBe(ready.coins + economy.lossReward);
    expect(failed.races).toHaveLength(1);
    expect(failed.pendingRace?.careerEventId).toBe('foundry-loop');
    const freeRace = startRace(finishRace(failed), 'drag', 'Balanced', 42);
    expect(freeRace.pendingRace?.careerEventId).toBeUndefined();
    expect(freeRace.career).toEqual(ready.career);

    const first = finishRace(raceWithOutcome(finishRace(freeRace), 'depot-sprint', true));
    const promoted = finishRace(raceWithOutcome(first, 'foundry-loop', true));
    const repeat = raceWithOutcome(promoted, 'foundry-loop', true);
    expect(repeat.career).toEqual(promoted.career);
    expect(repeat.pendingRace?.careerAward).toBeUndefined();
    expect(repeat.coins).toBe(promoted.coins + economy.winReward);
    expect(repeat.races.filter((race) => race.careerAward)).toHaveLength(1);
  });

});

describe('fixed career rivals', () => {
  it('keeps the same rival score for different cars and tactics at the same seed', () => {
    for (const eventId of ['depot-sprint', 'summit-circuit'] as const) {
      const slow = careerWithCar('bravik-110');
      const fast = careerWithCar('orvane-eclipse');
      for (const seed of [0, 41, 120, 1001]) {
        const start = startCareerRace(slow, eventId, 'Safe', seed).pendingRace;
        const upgrade = startCareerRace(fast, eventId, 'Push', seed).pendingRace;
        expect(upgrade?.opponentScore).toBe(start?.opponentScore);
        expect(upgrade?.playerScore).toBeGreaterThan(start!.playerScore);
        expect(startCareerRace(fast, eventId, 'Push', seed).pendingRace).toEqual(upgrade);
      }
    }
  });

  it('uses the rival stats and makes a player stat upgrade improve wins at fixed odds', () => {
    const player = catalogCar('sorevik-t9');
    const opponent = catalogCar('orvane-eclipse');
    const tuned = { ...player, stats: { ...player.stats, handling: player.stats.handling + 4 } };
    const rival = { opponent, name: 'Fixture rival', paceRatio: 0.97, volatility: 0.065 };
    const fasterRival = { ...rival, opponent: { ...opponent, stats: { ...opponent.stats, handling: opponent.stats.handling + 4 } } };
    let improvements = 0;
    for (let seed = 0; seed < 512; seed++) {
      const original = simulateRace('original', 'circuit', 'Balanced', player, seed, rival);
      const upgrade = simulateRace('upgrade', 'circuit', 'Balanced', tuned, seed, rival);
      const harder = simulateRace('harder', 'circuit', 'Balanced', player, seed, fasterRival);
      expect(upgrade.opponentScore).toBe(original.opponentScore);
      expect(harder.opponentScore).toBeGreaterThan(original.opponentScore);
      expect(upgrade.playerScore).toBeGreaterThan(original.playerScore);
      if (original.won) expect(upgrade.won).toBe(true);
      if (!original.won && upgrade.won) improvements++;
    }
    expect(improvements).toBeGreaterThan(20);
  });

  it('raises opponent scores on each track from Rookie to Elite', () => {
    const state = careerWithCar('bravik-110');
    for (const track of ['drag', 'circuit'] as const) {
      const scores = leagueIds.map((league) => {
        const eventId = leagues[league].eventIds.find((id) => careerEvents[id].eventId === track)!;
        return startCareerRace(state, eventId, 'Balanced', 42).pendingRace!.opponentScore;
      });
      for (let index = 1; index < scores.length; index++) {
        expect(scores[index] - scores[index - 1]).toBeGreaterThan(8);
      }
    }
  });

  it('lets either Common starter clear Rookie and makes better cars matter in higher leagues', () => {
    for (const id of ['bravik-110', 'petrel-s1']) {
      expect(winRate(id, 'depot-sprint', 'Push')).toBeGreaterThan(0.5);
      expect(winRate(id, 'foundry-loop', 'Safe')).toBeGreaterThan(0.45);
    }
    expect(winRate('bravik-110', 'ridge-circuit')).toBeLessThan(0.05);
    expect(winRate('kairox-r', 'ridge-circuit')).toBeGreaterThan(0.65);
    for (const eventId of ['crown-sprint', 'summit-circuit'] as const) {
      expect(winRate('bravik-110', eventId)).toBe(0);
      const legendary = winRate('sorevik-t9', eventId);
      const mythic = winRate('orvane-eclipse', eventId);
      expect(legendary).toBeGreaterThan(0.2);
      expect(mythic - legendary).toBeGreaterThan(0.15);
      expect(mythic).toBeLessThan(0.98);
    }
  });

  it('makes the best tactic depend on the track', () => {
    expect(winRate('sorevik-t9', 'crown-sprint', 'Push') - winRate('sorevik-t9', 'crown-sprint', 'Safe'))
      .toBeGreaterThan(0.07);
    expect(winRate('sorevik-t9', 'summit-circuit', 'Safe') - winRate('sorevik-t9', 'summit-circuit', 'Push'))
      .toBeGreaterThan(0.05);
  });
});

describe('career snapshots', () => {
  it('preserves a pre-career v1 wallet, garage, case progress, and pending free race', () => {
    const storage = storageFor();
    const { career: _career, ...legacy } = startRace(startWithCar(), 'circuit', 'Balanced', 18);
    storage.write(legacy);
    expect(readSave(storage)).toEqual({ ...legacy, career: createCareerProgress() });
  });

  it('restores a promotion, wallet, and pending result together and never reissues the badge', () => {
    const key = `${storageKey}.dev`;
    const storage = storageFor(key);
    const first = finishRace(raceWithOutcome(startWithCar(), 'depot-sprint', true));
    const promotion = raceWithOutcome(first, 'foundry-loop', true);
    writeSave(storage, promotion, key);
    const loaded = readSave(storage, key);
    expect(loaded).toEqual(promotion);
    expect(loaded.pendingRace?.careerAward).toBe('rookie');
    expect(readSave(storage).career).toEqual(createCareerProgress());

    const finished = finishRace(loaded);
    writeSave(storage, finished, key);
    const repeated = raceWithOutcome(readSave(storage, key), 'foundry-loop', true);
    expect(repeated.pendingRace?.careerAward).toBeUndefined();
    expect(repeated.career.unlocked).toEqual(['rookie', 'street']);
    expect(repeated.coins).toBe(promotion.coins + economy.winReward);
  });

  it('recovers from malformed career metadata without wiping the wallet, garage, or earned unlock', () => {
    const storage = storageFor();
    const first = finishRace(raceWithOutcome(startWithCar(), 'depot-sprint', true));
    const promotion = raceWithOutcome(first, 'foundry-loop', true);
    storage.write({ ...promotion, career: { unlocked: 'invalid' } });
    expect(readSave(storage)).toEqual(promotion);
  });
});
