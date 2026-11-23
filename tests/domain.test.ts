import { describe, expect, it } from 'vitest';
import { cars, events, rarities, stats, tacticModifiers } from '../src/game/config';
import { buildCaseReel, caseIds, casePool, casePrice, cases, drawCaseReward } from '../src/game/cases';
import { economy } from '../src/game/economy';
import {
  createGame,
  finishCase,
  finishRace,
  junkyardRemainingMs,
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
  return finishCase(openCase(createGame(), 'junkyard', 12, 100_000), 'keep');
}

describe('Junkyard and paid cases', () => {
  it('opens a free selected starter, persists the timestamp, and waits 60 seconds across reload', () => {
    const storage = memoryStorage();
    const fresh = createGame();
    const opened = openCase(fresh, 'junkyard', 12, 100_000);
    expect(opened.coins).toBe(fresh.coins);
    expect(opened.garage).toHaveLength(1);
    expect(opened.selectedId).toBe(opened.garage[0].id);
    expect(opened.pendingCase).toBe(opened.garage[0].id);
    expect(opened.pendingCaseType).toBe('junkyard');
    expect(fresh.garage).toEqual([]);
    expect(() => openCase(opened, 'junkyard', 12, 100_000)).toThrow(/finish/i);
    writeSave(storage, finishCase(opened, 'keep'));
    const restored = readSave(storage);
    expect(() => openCase(restored, 'junkyard', 12, 159_999)).toThrow(/ready in/i);
    expect(openCase(restored, 'junkyard', 12, 160_000).garage).toHaveLength(2);
  });

  it('keeps the case price fixed and rejects paid entry without enough coins', () => {
    expect(caseIds.map(casePrice)).toEqual([0, 250, 700, 2000, 5500, 9000, 16000, 30000]);
    expect(() => openCase(createGame(), 'rookie', 12, 100_000)).toThrow(/coins/i);
  });

  it('keeps the exact first-case tiers and excludes cars that cannot clear Rookie', () => {
    const ids = new Set(casePool('junkyard', true).map((car) => car.id));
    expect(ids).toEqual(new Set(['bravik-110', 'petrel-s1', 'merovar-sprint']));
    let uncommon = 0;
    const draws = 12_000;
    for (let seed = 0; seed < draws; seed++) {
      const game = openCase(createGame(), 'junkyard', seed, 100_000);
      const rewardId = game.garage[0].carId;
      if (rewardId === 'merovar-sprint') uncommon++;
      if (!ids.has(rewardId)) throw new Error(`Ineligible starter: ${rewardId}`);
    }
    expect(Math.abs(uncommon / draws - 0.05)).toBeLessThan(0.01);
    for (const winner of casePool('junkyard', true)) {
      const reel = buildCaseReel('junkyard', winner, 12, true);
      expect(reel.entries[reel.winnerIndex]).toBe(winner);
      expect(reel.entries.every((car) => ids.has(car.id))).toBe(true);
    }
  });

  it('keeps cooldown when the clock rolls back, then recovers without a long lockout', () => {
    const storage = memoryStorage();
    const game = finishCase(openCase(createGame(), 'junkyard', 12, 1_000_000), 'keep');
    writeSave(storage, game);
    expect(junkyardRemainingMs(game, 999_999)).toBe(economy.junkyardCooldownMs);
    const resetClock = 100_000;
    const rebased = readSave(storage, storageKey, resetClock + 10_000, resetClock);
    expect(junkyardRemainingMs(rebased, resetClock + 10_000)).toBe(50_000);
    // Re-reading the same snapshot uses the same page clock baseline.
    const readyAt = resetClock + economy.junkyardCooldownMs;
    const ready = readSave(storage, storageKey, readyAt, resetClock);
    expect(junkyardRemainingMs(ready, readyAt)).toBe(0);
    expect(openCase(ready, 'junkyard', 12, readyAt).garage).toHaveLength(2);
  });
});
describe('case odds and visual reels', () => {
  const publishedOdds = {
    junkyard: [95, 5, 0, 0, 0, 0],
    rookie: [52, 30, 18, 0, 0, 0],
    street: [18, 37, 32, 13, 0, 0],
    sport: [0, 16, 52, 29, 3, 0],
    performance: [0, 0, 25, 50, 25, 0],
    heritage: [0, 0, 40, 42, 18, 0],
    elite: [0, 0, 0, 65, 32, 3],
    hyper: [0, 0, 0, 50, 42, 8],
  };

  it('defines eight distinct vehicle pools and exact odds totaling 100% each', () => {
    expect(caseIds).toEqual(['junkyard', 'rookie', 'street', 'sport', 'performance', 'heritage', 'elite', 'hyper']);
    const pools = caseIds.map((id) => casePool(id).map((car) => car.id).sort().join(','));
    expect(new Set(pools).size).toBe(8);
    expect(casePool('heritage').every((car) => car.class === 'Collector')).toBe(true);
    for (const id of caseIds) {
      const odds = rarities.map((rarity) => cases[id].odds[rarity]);
      expect(odds).toEqual(publishedOdds[id]);
      expect(odds.reduce((total, weight) => total + weight, 0)).toBe(100);
      const eligibleRarities = rarities.filter((_, index) => odds[index] > 0);
      expect(new Set(casePool(id).map((car) => car.rarity))).toEqual(new Set(eligibleRarities));
      expect(new Set(cases[id].carIds)).toEqual(new Set(casePool(id).map((car) => car.id)));
    }
  });

  it('distributes forty unique cars across the specified rarity mix and reachable pools', () => {
    expect(cars).toHaveLength(40);
    expect(new Set(cars.map((car) => car.id)).size).toBe(40);
    expect(rarities.map((rarity) => cars.filter((car) => car.rarity === rarity).length)).toEqual([9, 8, 8, 7, 5, 3]);
    expect(new Set(caseIds.flatMap((id) => casePool(id).map((car) => car.id)))).toEqual(new Set(cars.map((car) => car.id)));
  });

  it('gives paid cases strictly negative resale expectation', () => {
    for (const id of caseIds) {
      if (id === 'junkyard') continue;
      const pool = casePool(id);
      let expectedResale = 0;
      for (const rarity of rarities) {
        const tier = pool.filter((car) => car.rarity === rarity);
        if (!tier.length) continue;
        expectedResale += (cases[id].odds[rarity] / 100) * tier.reduce((sum, car) => sum + car.resaleValue, 0) / tier.length;
      }
      expect(expectedResale).toBeGreaterThan(0);
      expect(expectedResale).toBeLessThan(casePrice(id));
    }
  });

  it.each(caseIds)('%s draws only eligible vehicles at its real odds', (id) => {
    const sampleCount = 12_000;
    const counts = Object.fromEntries(rarities.map((rarity) => [rarity, 0]));
    const pool = new Map(casePool(id).map((car) => [car.id, car]));
    for (let seed = 0; seed < sampleCount; seed++) {
      const reward = drawCaseReward(id, seed);
      const car = pool.get(reward.id);
      if (!car) throw new Error(`Ineligible ${id} case reward: ${reward.id}`);
      counts[car.rarity]++;
    }

    for (const [index, rarity] of rarities.entries()) {
      const expected = publishedOdds[id][index] * sampleCount / 100;
      if (expected === 0) {
        expect(counts[rarity]).toBe(0);
      } else {
        expect(counts[rarity]).toBeGreaterThan(0);
        expect(Math.abs(counts[rarity] - expected)).toBeLessThan(5 * Math.sqrt(expected));
      }
    }
  });

  it('pins the actual reward and limits scarce fillers to eligible cars away from the marker', () => {
    for (const id of caseIds) {
      const pool = casePool(id);
      const allowed = new Set(pool.map((car) => car.id));
      for (const reward of pool) {
        let reelsWithoutMythicFiller = 0;
        let mostLikelyFillers = 0;
        let totalFillers = 0;
        const dominant = rarities.reduce((best, rarity) => cases[id].odds[rarity] > cases[id].odds[best] ? rarity : best);
        for (let seed = 0; seed < 48; seed++) {
          const reel = buildCaseReel(id, reward, seed);
          expect(reel.entries[reel.winnerIndex]).toBe(reward);
          expect(reel.winnerIndex).toBeGreaterThanOrEqual(20);
          expect(reel.entries.length - reel.winnerIndex - 1).toBeGreaterThanOrEqual(5);
          expect(reel.entries.every((car) => allowed.has(car.id))).toBe(true);
          const fillers = reel.entries.filter((_, index) => index !== reel.winnerIndex);
          const mythics = fillers.filter((car) => car.rarity === 'Mythic');
          expect(mythics.length).toBeLessThanOrEqual(1);
          expect(fillers.filter((car) => car.rarity === 'Legendary').length).toBeLessThanOrEqual(2);
          if (mythics.length === 0) reelsWithoutMythicFiller++;
          mostLikelyFillers += fillers.filter((car) => car.rarity === dominant).length;
          totalFillers += fillers.length;
          for (const neighbor of [reel.entries[reel.winnerIndex - 1], reel.entries[reel.winnerIndex + 1]]) {
            expect(['Legendary', 'Mythic']).not.toContain(neighbor.rarity);
          }
        }
        expect(reelsWithoutMythicFiller).toBeGreaterThan(24);
        expect(mostLikelyFillers / totalFillers).toBeGreaterThan(0.4);
        expect(buildCaseReel(id, reward, 12)).toEqual(buildCaseReel(id, reward, 12));
      }
    }
  });

  it('lets Legendary fillers appear in some Elite reels and keeps them out of others', () => {
    const reward = casePool('elite').find((car) => car.rarity === 'Epic');
    if (!reward) throw new Error('Expected an Epic Elite reward');
    const sampleCount = 64;
    const reelsWithLegendary = Array.from({ length: sampleCount }, (_, seed) => (
      buildCaseReel('elite', reward, seed).entries.some((car) => car.rarity === 'Legendary')
    )).filter(Boolean).length;

    expect(reelsWithLegendary).toBeGreaterThan(sampleCount / 5);
    expect(sampleCount - reelsWithLegendary).toBeGreaterThan(sampleCount / 5);
  });
});

describe('garage', () => {
  it('protects the last car through both sale paths', () => {
    const game = openCase(createGame(), 'junkyard', 12);
    expect(() => finishCase(game, 'sell')).toThrow(/last car/i);
    const kept = finishCase(game, 'keep');
    expect(() => sellCar(kept, kept.garage[0].id)).toThrow(/last car/i);
  });

  it('honors a lock and reselects the remaining car when the selected car is sold', () => {
    const game = { ...starter(), coins: cases.rookie.price };
    const twoCars = finishCase(openCase(game, 'rookie', 12), 'keep');
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
    const raced = startRace(ready, 'circuit', 'Safe', 193, 100_000);
    expect(startRace(ready, 'circuit', 'Safe', 193, 100_000)).toEqual(raced);
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
    const player = cars.find((car) => car.id === 'bravik-110')!;
    for (const eventId of ['drag', 'circuit'] as const) {
      const weights = events[eventId].weights;
      const score = (car: typeof player) => stats.reduce((sum, stat) => sum + car.stats[stat] * weights[stat] / 100, 0);
      const playerScore = score(player);
      const eligible = cars.filter((car) => car.id !== player.id
        && Math.abs(score(car) - playerScore) <= (score(car) + playerScore) / 100);
      const opponentId = startRace(ready, eventId, 'Balanced', 3).pendingRace?.opponentCarId;
      expect(eligible.length ? eligible.map((car) => car.id) : [player.id]).toContain(opponentId);
    }
  });
});

describe('versioned progress', () => {
  it('restores the pending case and its already acquired car in one snapshot', () => {
    const storage = memoryStorage();
    const paid = { ...starter(), coins: cases.elite.price };
    writeSave(storage, openCase(paid, 'elite', 101));

    const restored = readSave(storage);
    expect(restored.coins).toBe(0);
    expect(restored.garage).toHaveLength(2);
    expect(restored.garage.at(-1)?.id).toBe(restored.pendingCase);
    expect(restored.pendingCaseType).toBe('elite');
    const accepted = finishCase(restored, 'keep');
    expect(accepted.pendingCaseType).toBeUndefined();
    writeSave(storage, accepted);
    expect(finishCase(readSave(storage), 'keep')).toEqual(accepted);
  });

  it('keeps a legacy Rookie save with a pending car outside the current Rookie pool', () => {
    const storage = memoryStorage();
    const { timing: _timing, ...base } = createGame();
    const previous = {
      ...base,
      version: 1,
      garage: [{ id: 'car-1', carId: 'veldris-zenith', locked: true }],
      selectedId: 'car-1',
      coins: 260,
      progress: { casesOpened: 1, racesCompleted: 0 },
      pendingCase: 'car-1',
    };
    storage.setItem(storageKey, JSON.stringify(previous));
    const restored = readSave(storage);
    expect(restored).toEqual({ ...previous, version: 2, timing: createGame().timing });
    expect(finishCase(restored, 'keep').garage).toEqual(previous.garage);
  });

  it('discards unknown case display metadata without losing the pending car or wallet', () => {
    const storage = memoryStorage();
    const opened = openCase({ ...starter(), coins: cases.elite.price + 40 }, 'elite', 101);
    storage.setItem(storageKey, JSON.stringify({ ...opened, pendingCaseType: 'unknown-case' }));

    const restored = readSave(storage);
    expect(restored.pendingCaseType).toBeUndefined();
    expect(restored.pendingCase).toBe(opened.pendingCase);
    expect(restored.garage).toEqual(opened.garage);
    expect(restored.coins).toBe(40);
    expect(finishCase(restored, 'keep').garage).toEqual(opened.garage);
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
    const raw = JSON.stringify({ ...starter(), version: 3 });
    storage.setItem(storageKey, raw);
    expect(readSave(storage)).toEqual(createGame());
    expect(() => writeSave(storage, createGame())).toThrow(/newer version/i);
    expect(storage.getItem(storageKey)).toBe(raw);
  });
});
