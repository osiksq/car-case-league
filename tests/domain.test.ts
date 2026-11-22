import { describe, expect, it } from 'vitest';
import { cars, economy, events, rarities, rookieOdds, starterOdds, stats, tacticModifiers } from '../src/game/config';
import {
  createGame,
  finishCase,
  finishRace,
  openCase,
  readSave,
  selectCar,
  sellCar,
  startRace,
  storageKey,
  toggleLock,
  writeSave,
} from '../src/game/save';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function starter() {
  return finishCase(openCase(createGame(), 12), 'keep');
}

describe('Rookie Case', () => {
  it('grants one selected starter for free and rejects a second case before a race', () => {
    const fresh = createGame();
    const opened = openCase(fresh, 12);

    expect(opened.coins).toBe(fresh.coins);
    expect(opened.garage).toHaveLength(1);
    expect(opened.selectedId).toBe(opened.garage[0].id);
    expect(opened.pendingCase).toBe(opened.garage[0].id);
    expect(fresh.garage).toEqual([]);
    expect(() => openCase(opened, 12)).toThrow();
    expect(() => openCase(finishCase(opened, 'keep'), 12)).toThrow(/coins/i);
  });

  it('offers a second case after the first race even on a loss', () => {
    const game = starter();
    const loss = Array.from({ length: 50 }, (_, seed) => startRace(game, 'drag', 'Balanced', seed))
      .find((result) => !result.pendingRace?.won);
    expect(loss).toBeDefined();
    if (!loss) throw new Error('Expected at least one loss in the seeded fixtures');

    const opened = openCase(finishRace(loss), 12);
    expect(loss.pendingRace?.reward).toBe(economy.lossReward);
    expect(opened.coins).toBe(loss.coins - economy.casePrice);
    expect(opened.coins).toBeGreaterThanOrEqual(0);
    expect(opened.garage).toHaveLength(2);
  });

  it('draws seeded rewards across the published odds with a populated pool in every tier', () => {
    const sampleCount = 20_000;
    const counts: Record<string, number> = Object.fromEntries(rarities.map((rarity) => [rarity, 0]));
    const catalog = new Map(cars.map((car) => [car.id, car]));
    const state = { ...starter(), coins: economy.casePrice };
    for (let seed = 0; seed < sampleCount; seed++) {
      const reward = openCase(state, seed).garage.at(-1);
      const car = reward && catalog.get(reward.carId);
      if (!car) throw new Error('Missing case reward');
      counts[car.rarity]++;
    }

    expect(Object.values(starterOdds).reduce((total, odds) => total + odds, 0)).toBeCloseTo(100);
    expect(Object.values(rookieOdds).reduce((total, odds) => total + odds, 0)).toBeCloseTo(100);
    for (const rarity of rarities) {
      const expected = (rookieOdds[rarity] / 100) * sampleCount;
      expect(counts[rarity]).toBeGreaterThan(0);
      expect(Math.abs(counts[rarity] - expected)).toBeLessThan(5 * Math.sqrt(expected));
    }
  });
});

describe('garage', () => {
  it('protects the last car through both sale paths', () => {
    const game = openCase(createGame(), 12);
    expect(() => finishCase(game, 'sell')).toThrow(/last car/i);
    const kept = finishCase(game, 'keep');
    expect(() => sellCar(kept, kept.garage[0].id)).toThrow(/last car/i);
  });

  it('honors a lock and reselects the remaining car when the selected car is sold', () => {
    const game = { ...starter(), coins: economy.casePrice };
    const twoCars = finishCase(openCase(game, 12), 'keep');
    const [first, second] = twoCars.garage;
    const selected = selectCar(twoCars, second.id);
    const locked = toggleLock(selected, second.id);
    expect(() => sellCar(locked, second.id)).toThrow(/locked/i);

    const sold = sellCar(toggleLock(locked, second.id), second.id);
    const definition = cars.find((car) => car.id === second.carId);
    expect(sold.garage).toEqual([first]);
    expect(sold.selectedId).toBe(first.id);
    expect(sold.coins).toBe(0 + (definition?.resaleValue ?? 0));
  });
});

describe('races', () => {
  it('reproduces the same result and phases with the same seed', () => {
    const ready = starter();
    const raced = startRace(ready, 'circuit', 'Safe', 193);
    expect(startRace(ready, 'circuit', 'Safe', 193)).toEqual(raced);
    expect(raced.pendingRace?.eventId).toBe('circuit');
    expect(raced.pendingRace?.explanation.length).toBeGreaterThan(20);
    expect(raced.races).toHaveLength(1);
    expect(raced.coins).toBe(ready.coins + (raced.pendingRace?.reward ?? 0));
    expect(() => startRace(raced, 'circuit', 'Safe', 193)).toThrow();
  });

  it('uses track and tactic inputs, and produces valid monotonic race progress', () => {
    const game = starter();
    const drag = startRace(game, 'drag', 'Balanced', 75).pendingRace;
    const push = startRace(game, 'drag', 'Push', 75).pendingRace;
    const circuit = startRace(game, 'circuit', 'Balanced', 75).pendingRace;
    expect(drag?.playerScore).not.toBe(push?.playerScore);
    expect(drag?.playerScore).not.toBe(circuit?.playerScore);
    expect(events.drag.weights.acceleration).toBeGreaterThan(events.drag.weights.handling);
    expect(events.circuit.weights.handling).toBeGreaterThan(events.circuit.weights.acceleration);

    if (!drag) throw new Error('Expected a race result');
    for (const [index, phase] of drag.phases.entries()) {
      for (const lane of ['player', 'opponent'] as const) {
        expect(phase[lane]).toBeGreaterThanOrEqual(drag.phases[index - 1]?.[lane] ?? 0);
        expect(phase[lane]).toBeLessThanOrEqual(100);
      }
    }
    expect(drag.phases.at(-1)?.[drag.won ? 'player' : 'opponent']).toBe(100);
  });

  it('keeps Safe tighter than Balanced and gives Push the largest bounded swings', () => {
    const game = starter();
    const player = cars.find((car) => car.id === game.garage[0].carId);
    if (!player) throw new Error('Expected a playable starter');
    const results = Array.from({ length: 200 }, (_, seed) => seed);
    const dragWeights = events.drag.weights;
    for (const [tactic, maximum] of [['Safe', 0.01], ['Balanced', 0.02], ['Push', 0.03]] as const) {
      const weighted = stats.reduce((total, stat) => total + (player.stats[stat] + tacticModifiers[tactic][stat]) * dragWeights[stat] / 100, 0);
      const spreads = results.map((seed) => {
        const result = startRace(game, 'drag', tactic, seed).pendingRace;
        if (!result) throw new Error('Expected a race result');
        return (result.playerScore - weighted) / weighted;
      });
      const roundingTolerance = 0.005 / weighted;
      expect(Math.max(...spreads)).toBeLessThanOrEqual(maximum + roundingTolerance);
      expect(Math.min(...spreads)).toBeGreaterThanOrEqual(-maximum - roundingTolerance);
      expect(Math.max(...spreads)).toBeGreaterThan(maximum * 0.85);
      expect(Math.min(...spreads)).toBeLessThan(-maximum * 0.85);
    }
    expect(results.some((seed) => {
      const balanced = startRace(game, 'drag', 'Balanced', seed).pendingRace;
      const push = startRace(game, 'drag', 'Push', seed).pendingRace;
      return balanced && push && balanced.playerScore > push.playerScore;
    })).toBe(true);
  });

  it('gives every car a meaningful chance to win or lose on both tracks with Balanced', () => {
    const game = starter();
    const sampleCount = 400;
    for (const car of cars) {
      const ready = { ...game, garage: [{ ...game.garage[0], carId: car.id }] };
      for (const eventId of ['drag', 'circuit'] as const) {
        let wins = 0;
        for (let seed = 0; seed < sampleCount; seed++) {
          if (startRace(ready, eventId, 'Balanced', seed).pendingRace?.won) wins++;
        }
        const match = `${car.name} in ${events[eventId].name}`;
        expect(wins, match).toBeGreaterThan(sampleCount * 0.05);
        expect(wins, match).toBeLessThan(sampleCount * 0.95);
      }
    }
  });

  it('prefers a distinct comparable rival and uses the same model when there is no match', () => {
    const game = starter();
    const ready = { ...game, garage: [{ ...game.garage[0], carId: 'bravik-110' }] };
    expect(startRace(ready, 'drag', 'Balanced', 3).pendingRace?.opponentCarId).toBe('petrel-s1');
    expect(startRace(ready, 'circuit', 'Balanced', 3).pendingRace?.opponentCarId).toBe('bravik-110');
  });
});

describe('versioned progress', () => {
  it('restores the pending case and its already acquired car in one snapshot', () => {
    const storage = memoryStorage();
    const paid = { ...starter(), coins: economy.casePrice };
    writeSave(storage, openCase(paid, 101));

    const restored = readSave(storage);
    expect(restored.coins).toBe(0);
    expect(restored.garage).toHaveLength(2);
    expect(restored.garage.at(-1)?.id).toBe(restored.pendingCase);
    const accepted = finishCase(restored, 'keep');
    writeSave(storage, accepted);
    expect(finishCase(readSave(storage), 'keep')).toEqual(accepted);
  });

  it('keeps a single race reward when reload interrupts the pending result', () => {
    const storage = memoryStorage();
    const ready = starter();
    const race = startRace(ready, 'circuit', 'Push', 4);
    writeSave(storage, race);

    const restored = readSave(storage);
    const accepted = finishRace(restored);
    writeSave(storage, accepted);
    expect(accepted.races).toHaveLength(1);
    expect(accepted.pendingRace).toBeNull();
    expect(accepted.coins - ready.coins).toBe(accepted.races[0].reward);
    expect(finishRace(readSave(storage))).toEqual(accepted);
  });

  it('uses the canonical history result if a matching pending race diverged', () => {
    const storage = memoryStorage();
    const game = startRace(starter(), 'circuit', 'Safe', 4);
    storage.setItem(storageKey, JSON.stringify({ ...game, pendingRace: { ...game.pendingRace, reward: 0 } }));

    const restored = readSave(storage);
    expect(restored.pendingRace).toEqual(game.races[0]);
    expect(restored.coins).toBe(game.coins);
  });

  it('falls back safely for malformed and inconsistent saves', () => {
    const storage = memoryStorage();
    storage.setItem(storageKey, '{unfinished');
    expect(readSave(storage)).toEqual(createGame());
    storage.setItem(storageKey, JSON.stringify({ ...starter(), selectedId: 'unknown' }));
    expect(readSave(storage)).toEqual(createGame());
  });

  it('does not overwrite a save from a newer game version', () => {
    const storage = memoryStorage();
    const raw = JSON.stringify({ ...starter(), version: 2 });
    storage.setItem(storageKey, raw);
    expect(readSave(storage)).toEqual(createGame());
    expect(() => writeSave(storage, createGame())).toThrow(/newer version/i);
    expect(storage.getItem(storageKey)).toBe(raw);
  });
});
