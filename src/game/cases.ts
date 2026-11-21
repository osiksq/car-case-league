import { cars, rarities, type Car, type Rarity } from './config';
import { createRandom } from './random';

export const caseIds = ['rookie', 'street', 'performance', 'elite'] as const;
export type CaseId = (typeof caseIds)[number];

interface CaseDefinition {
  name: string;
  price: number;
  odds: Record<Rarity, number>;
  carIds: readonly string[];
}

export const cases: Record<CaseId, CaseDefinition> = {
  rookie: {
    name: 'Rookie Case',
    price: 120,
    odds: { Common: 70, Uncommon: 25, Rare: 5, Epic: 0, Legendary: 0, Mythic: 0 },
    carIds: ['bravik-110', 'petrel-s1', 'kestovan-rx', 'merovar-sprint', 'thalven-gt', 'dorsenne-v12'],
  },
  street: {
    name: 'Street Case',
    price: 240,
    odds: { Common: 35, Uncommon: 45, Rare: 18, Epic: 2, Legendary: 0, Mythic: 0 },
    carIds: ['bravik-110', 'petrel-s1', 'kestovan-rx', 'merovar-sprint', 'thalven-gt', 'dorsenne-v12', 'kairox-r', 'nivaro-gtx'],
  },
  performance: {
    name: 'Performance Case',
    price: 420,
    odds: { Common: 0, Uncommon: 25, Rare: 45, Epic: 26, Legendary: 4, Mythic: 0 },
    carIds: ['kestovan-rx', 'merovar-sprint', 'thalven-gt', 'dorsenne-v12', 'kairox-r', 'nivaro-gtx', 'viremont-aurum', 'sorevik-t9'],
  },
  elite: {
    name: 'Elite Case',
    price: 700,
    odds: { Common: 0, Uncommon: 0, Rare: 20, Epic: 55, Legendary: 24, Mythic: 1 },
    carIds: ['thalven-gt', 'dorsenne-v12', 'kairox-r', 'nivaro-gtx', 'viremont-aurum', 'sorevik-t9', 'veldris-zenith', 'orvane-eclipse'],
  },
};

const pools = new Map(caseIds.map((id) => {
  const { carIds, odds } = cases[id];
  return [id, cars.filter((car) => carIds.includes(car.id) && odds[car.rarity] > 0)];
}));

interface CaseTier {
  rarity: Rarity;
  weight: number;
  cars: readonly Car[];
}

const tiersByCase = new Map(caseIds.map((id) => {
  const { odds } = cases[id];
  const pool = casePool(id);
  const tiers: CaseTier[] = rarities.filter((rarity) => odds[rarity] > 0).map((rarity) => ({
    rarity,
    weight: odds[rarity],
    cars: pool.filter((car) => car.rarity === rarity),
  }));
  return [id, tiers];
}));

export function casePool(id: CaseId): readonly Car[] {
  return pools.get(id) ?? [];
}

export function casePrice(id: CaseId, casesOpened: number): number {
  return id === 'rookie' && casesOpened === 0 ? 0 : cases[id].price;
}

function drawVehicle(tiers: readonly CaseTier[], random: () => number): Car {
  let roll = random() * tiers.reduce((total, tier) => total + tier.weight, 0);
  for (const tier of tiers) {
    roll -= tier.weight;
    if (roll < 0) {
      if (!tier.cars.length) throw new Error(`The ${tier.rarity} reward pool is empty.`);
      return tier.cars[Math.floor(random() * tier.cars.length)];
    }
  }
  throw new Error('No eligible case rewards.');
}

export function drawCaseReward(id: CaseId, seed?: number): Car {
  return drawVehicle(tiersByCase.get(id) ?? [], createRandom(seed));
}

const reelWinnerIndex = 20;
const reelLength = 26;

export function buildCaseReel(id: CaseId, winner: Car, seed?: number): { entries: Car[]; winnerIndex: number } {
  const tiers = tiersByCase.get(id);
  if (!tiers?.length || !casePool(id).some((car) => car.id === winner.id)) {
    throw new Error('The reward is not available in this case.');
  }

  const random = createRandom(seed);
  const scarceFillerLimit: Partial<Record<Rarity, number>> = {
    Legendary: Math.floor(random() * 3),
    Mythic: 1,
  };
  const commonTier = tiers.reduce((best, tier) => tier.weight > best.weight ? tier : best);
  const used = new Map<Rarity, number>();
  const entries = Array.from({ length: reelLength }, (_, index) => {
    if (index === reelWinnerIndex) return winner;
    // Adjacent cards use the most likely tier so the stop never stages a near miss.
    const candidates = Math.abs(index - reelWinnerIndex) === 1
      ? [commonTier]
      : tiers.filter(({ rarity }) => (used.get(rarity) ?? 0) < (scarceFillerLimit[rarity] ?? Infinity));
    const car = drawVehicle(candidates, random);
    used.set(car.rarity, (used.get(car.rarity) ?? 0) + 1);
    return car;
  });

  return { entries, winnerIndex: reelWinnerIndex };
}
