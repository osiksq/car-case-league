import { cars, rarities, type Car, type Rarity } from './config';
import { createRandom } from './random';

export const caseIds = ['junkyard', 'rookie', 'street', 'sport', 'performance', 'heritage', 'elite', 'hyper'] as const;
export type CaseId = (typeof caseIds)[number];

interface CaseDefinition {
  name: string;
  price: number;
  odds: Record<Rarity, number>;
  carIds: readonly string[];
}

export const cases: Record<CaseId, CaseDefinition> = {
  junkyard: {
    name: 'Junkyard Case',
    price: 0,
    odds: { Common: 95, Uncommon: 5, Rare: 0, Epic: 0, Legendary: 0, Mythic: 0 },
    carIds: [
      'bravik-110', 'petrel-s1', 'dorvik-75', 'talmor-pico', 'norwyn-kite', 'velska-cargo',
      'ruskell-120', 'havrix-cabrio', 'elden-boxer', 'merovar-sprint', 'issara-twin', 'ordane-sedan',
    ],
  },
  rookie: {
    name: 'Rookie Case',
    price: 250,
    odds: { Common: 52, Uncommon: 30, Rare: 18, Epic: 0, Legendary: 0, Mythic: 0 },
    carIds: [
      'bravik-110', 'petrel-s1', 'talmor-pico', 'norwyn-kite', 'ruskell-120', 'havrix-cabrio', 'elden-boxer',
      'kestovan-rx', 'merovar-sprint', 'issara-twin', 'malkor-ss', 'ordane-sedan', 'thalven-gt', 'cirven-sport',
    ],
  },
  street: {
    name: 'Street Case',
    price: 700,
    odds: { Common: 18, Uncommon: 37, Rare: 32, Epic: 13, Legendary: 0, Mythic: 0 },
    carIds: [
      'petrel-s1', 'talmor-pico', 'norwyn-kite', 'kestovan-rx', 'merovar-sprint', 'narvik-rally',
      'issara-twin', 'ordane-sedan', 'thalven-gt', 'tavren-cup', 'karsen-v8', 'cirven-sport', 'quorven-rs', 'ralvex-turbo',
    ],
  },
  sport: {
    name: 'Sport Case',
    price: 2_000,
    odds: { Common: 0, Uncommon: 16, Rare: 52, Epic: 29, Legendary: 3, Mythic: 0 },
    carIds: [
      'narvik-rally', 'malkor-ss', 'vesryn-dune', 'selaire-roadster', 'thalven-gt', 'tavren-cup', 'karsen-v8',
      'vossari-spyder', 'cirven-sport', 'kairox-r', 'quorven-rs', 'ralvex-turbo', 'ventari-s4', 'sorevik-t9',
    ],
  },
  performance: {
    name: 'Performance Case',
    price: 5_500,
    odds: { Common: 0, Uncommon: 0, Rare: 25, Epic: 50, Legendary: 25, Mythic: 0 },
    carIds: [
      'tavren-cup', 'karsen-v8', 'vossari-spyder', 'kairox-r', 'nivaro-gtx', 'quorven-rs', 'ralvex-turbo', 'ventari-s4',
      'sorevik-t9', 'trevos-r90', 'ikhara-gt',
    ],
  },
  heritage: {
    name: 'Heritage Case',
    price: 9_000,
    odds: { Common: 0, Uncommon: 0, Rare: 40, Epic: 42, Legendary: 18, Mythic: 0 },
    carIds: [
      'dorsenne-v12', 'aldoven-63', 'bellovar-mk2', 'solvara-sr6', 'melvane-gt1', 'viremont-aurum', 'ardenza-proto',
    ],
  },
  elite: {
    name: 'Elite Case',
    price: 16_000,
    odds: { Common: 0, Uncommon: 0, Rare: 0, Epic: 65, Legendary: 32, Mythic: 3 },
    carIds: [
      'kairox-r', 'nivaro-gtx', 'quorven-rs', 'solvara-sr6', 'melvane-gt1', 'ventari-s4',
      'viremont-aurum', 'sorevik-t9', 'trevos-r90', 'ardenza-proto', 'ikhara-gt', 'veldris-zenith', 'orvane-eclipse',
    ],
  },
  hyper: {
    name: 'Hyper Case',
    price: 30_000,
    odds: { Common: 0, Uncommon: 0, Rare: 0, Epic: 50, Legendary: 42, Mythic: 8 },
    carIds: ['nivaro-gtx', 'ventari-s4', 'trevos-r90', 'ikhara-gt', 'veldris-zenith', 'orvane-eclipse', 'novaryn-zero'],
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

const starterIds = ['bravik-110', 'petrel-s1', 'merovar-sprint'];
const starterPool = cars.filter((car) => starterIds.includes(car.id));

export function casePool(id: CaseId, firstJunkyard = false): readonly Car[] {
  return id === 'junkyard' && firstJunkyard ? starterPool : (pools.get(id) ?? []);
}

function makeTiers(id: CaseId, pool: readonly Car[]): CaseTier[] {
  const { odds } = cases[id];
  return rarities.filter((rarity) => odds[rarity] > 0).map((rarity) => ({
    rarity,
    weight: odds[rarity],
    cars: pool.filter((car) => car.rarity === rarity),
  }));
}

const tiersByCase = new Map(caseIds.map((id) => [id, makeTiers(id, casePool(id))]));
const firstJunkyardTiers = makeTiers('junkyard', starterPool);

function caseTiers(id: CaseId, firstJunkyard: boolean): readonly CaseTier[] {
  return id === 'junkyard' && firstJunkyard ? firstJunkyardTiers : (tiersByCase.get(id) ?? []);
}

export function casePrice(id: CaseId): number {
  return cases[id].price;
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

export function drawCaseReward(id: CaseId, seed?: number, firstJunkyard = false): Car {
  return drawVehicle(caseTiers(id, firstJunkyard), createRandom(seed));
}

const reelWinnerIndex = 20;
const reelLength = 26;

export function buildCaseReel(id: CaseId, winner: Car, seed?: number, firstJunkyard = false): { entries: Car[]; winnerIndex: number } {
  const tiers = caseTiers(id, firstJunkyard);
  if (!tiers.length || !casePool(id, firstJunkyard).some((car) => car.id === winner.id)) {
    throw new Error('The reward is not available in this case.');
  }

  const random = createRandom(seed);
  const scarceFillerLimit: Partial<Record<Rarity, number>> = {
    Legendary: Math.floor(random() * 3),
    Mythic: 1,
  };
  const commonTier = tiers.reduce((best, tier) => tier.weight > best.weight ? tier : best);
  const fillerTiers = tiers.map((tier) => tier.rarity === 'Mythic' ? { ...tier, weight: Math.min(tier.weight, 1.5) } : tier);
  const used = new Map<Rarity, number>();
  const entries = Array.from({ length: reelLength }, (_, index) => {
    if (index === reelWinnerIndex) return winner;
    // Adjacent cards use the most likely tier so the stop never stages a near miss.
    const candidates = Math.abs(index - reelWinnerIndex) === 1
      ? [commonTier]
      : fillerTiers.filter(({ rarity }) => (used.get(rarity) ?? 0) < (scarceFillerLimit[rarity] ?? Infinity));
    const car = drawVehicle(candidates, random);
    used.set(car.rarity, (used.get(car.rarity) ?? 0) + 1);
    return car;
  });

  return { entries, winnerIndex: reelWinnerIndex };
}
