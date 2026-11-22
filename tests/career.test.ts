import { describe, expect, it } from 'vitest';
import { careerEvents, createCareerProgress, leagueIds, leagues, type CareerEventId } from '../src/game/career';
import { cars, economy } from '../src/game/config';
import {
  createGame, finishCase, finishRace, openCase, readSave, startCareerRace, startRace,
  storageKey, writeSave, type GameState,
} from '../src/game/save';

function startWithCar(): GameState {
  return finishCase(openCase(createGame(), 'rookie', 12), 'keep');
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

  it('advances through the four leagues on distinct wins even with the starter car', () => {
    let game = startWithCar();
    const starter = game.garage[0];

    for (const [index, league] of leagueIds.entries()) {
      const [first, second] = leagues[league].eventIds;
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
      expect(promotion.garage).toEqual([starter]);
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

  it('keeps Elite difficulty winnable with any existing model and seeds deterministic results', () => {
    const ready = startWithCar();
    for (const model of cars) {
      const state = {
        ...ready,
        garage: [{ ...ready.garage[0], carId: model.id }],
        career: { completed: [], unlocked: [...leagueIds] },
      };
      for (const eventId of leagues.elite.eventIds) {
        const win = raceWithOutcome(state, eventId, true);
        const loss = raceWithOutcome(state, eventId, false);
        expect(win.pendingRace?.won).toBe(true);
        expect(loss.pendingRace?.won).toBe(false);
        expect(startCareerRace(state, eventId, 'Safe', 123)).toEqual(
          startCareerRace(state, eventId, 'Safe', 123),
        );
      }
    }
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
