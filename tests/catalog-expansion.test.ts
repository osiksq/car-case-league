import { describe, expect, it } from 'vitest';
import { casePool, casePrice, drawCaseReward } from '../src/game/cases';
import { cars } from '../src/game/config';
import { raceRatings } from '../src/game/race';
import { createGame, finishCase, openCase, readSave, storageKey } from '../src/game/save';

describe('expanded vehicle catalog', () => {
  it('keeps the first Junkyard drop in the existing Rookie-ready pool', () => {
    expect(casePool('junkyard', true).map(({ id }) => id)).toEqual(['bravik-110', 'petrel-s1', 'merovar-sprint']);
    expect(casePool('junkyard').filter(({ artIndex }) => artIndex >= 40).map(({ id }) => id))
      .toEqual(['vostren-76', 'borvane-estate']);
  });

  it('makes the new Epic muscle car a drag specialist with a circuit trade-off', () => {
    const muscle = cars.find(({ id }) => id === 'bramlock-900')!;
    const formerEpicBenchmark = cars.find(({ id }) => id === 'ralvex-turbo')!;
    const trackCar = cars.find(({ id }) => id === 'quorven-rs')!;
    expect(muscle.class).toBe('Muscle');
    expect(muscle.rarity).toBe('Epic');
    const drag = raceRatings('drag', muscle, formerEpicBenchmark, 'Balanced');
    expect(drag.playerBase).toBeGreaterThan(drag.rivalBase);
    const circuit = raceRatings('circuit', muscle, trackCar, 'Balanced');
    expect(circuit.playerBase).toBeLessThan(circuit.rivalBase);
  });

  it('draws the historical collector as Exotic from Heritage and recovers the pending reward', () => {
    const collector = casePool('heritage').find(({ rarity }) => rarity === 'Exotic');
    expect(collector).toMatchObject({ id: 'calderon-lm64', class: 'Collector' });
    const seed = Array.from({ length: 1_000 }, (_, index) => index)
      .find((index) => drawCaseReward('heritage', index) === collector);
    expect(seed).toBeDefined();
    const started = { ...createGame(), coins: casePrice('heritage') };
    const opened = openCase(started, 'heritage', seed, 10_000);
    const recovered = readSave({ getItem: () => JSON.stringify(opened) }, storageKey, 10_000);
    expect(recovered.garage).toMatchObject([{ id: recovered.pendingCase, carId: 'calderon-lm64' }]);
    expect(recovered.pendingCaseType).toBe('heritage');
    const kept = finishCase(recovered, 'keep');
    expect(kept).toMatchObject({ pendingCase: null, coins: 0, progress: { casesOpened: 1 } });
    expect(kept.garage).toHaveLength(1);
  });
});
