export const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export type Rarity = (typeof rarities)[number];

export const classes = ['Street', 'Sport', 'Muscle', 'Track', 'Exotic', 'Classic', 'Collector'] as const;
export type CarClass = (typeof classes)[number];

export const stats = ['speed', 'acceleration', 'handling', 'reliability'] as const;
export type Stat = (typeof stats)[number];
export type CarStats = Record<Stat, number>;

export const tactics = ['Safe', 'Balanced', 'Push'] as const;
export type Tactic = (typeof tactics)[number];
export type EventId = 'drag' | 'circuit';

export interface Car {
  id: string;
  name: string;
  rarity: Rarity;
  class: CarClass;
  stats: CarStats;
  resaleValue: number;
  artIndex: number;
}

export const economy = {
  startingCoins: 60,
  winReward: 100,
  lossReward: 60,
};

export const events: Record<EventId, { name: string; description: string; weights: CarStats }> = {
  drag: {
    name: 'Drag Race',
    description: 'A straight-line sprint that rewards quick launches and strong acceleration.',
    weights: { speed: 20, acceleration: 60, handling: 15, reliability: 5 },
  },
  circuit: {
    name: 'Circuit Race',
    description: 'A technical lap that favors confident cornering and sustained speed.',
    weights: { speed: 35, acceleration: 15, handling: 40, reliability: 10 },
  },
};

export const tacticModifiers: Record<Tactic, CarStats> = {
  Safe: { speed: -4, acceleration: -2, handling: 3, reliability: 8 },
  Balanced: { speed: 0, acceleration: 0, handling: 0, reliability: 0 },
  Push: { speed: 1, acceleration: 1, handling: -2, reliability: -3 },
};

export const tacticVolatility: Record<Tactic, number> = {
  Safe: 0.01,
  Balanced: 0.02,
  Push: 0.03,
};

export const cars: readonly Car[] = [
  {
    id: 'bravik-110', name: 'Bravik 110', rarity: 'Common', class: 'Classic',
    stats: { speed: 33, acceleration: 41, handling: 46, reliability: 61 }, resaleValue: 25, artIndex: 0,
  },
  {
    id: 'petrel-s1', name: 'Petrel S1', rarity: 'Common', class: 'Street',
    stats: { speed: 37, acceleration: 39, handling: 56, reliability: 55 }, resaleValue: 28, artIndex: 1,
  },
  {
    id: 'kestovan-rx', name: 'Kestovan RX', rarity: 'Uncommon', class: 'Muscle',
    stats: { speed: 56, acceleration: 63, handling: 35, reliability: 49 }, resaleValue: 42, artIndex: 2,
  },
  {
    id: 'merovar-sprint', name: 'Merovar Sprint', rarity: 'Uncommon', class: 'Street',
    stats: { speed: 49, acceleration: 57, handling: 67, reliability: 52 }, resaleValue: 47, artIndex: 3,
  },
  {
    id: 'thalven-gt', name: 'Thalven GT', rarity: 'Rare', class: 'Sport',
    stats: { speed: 65, acceleration: 69, handling: 64, reliability: 58 }, resaleValue: 70, artIndex: 4,
  },
  {
    id: 'dorsenne-v12', name: 'Dorsenne V12', rarity: 'Rare', class: 'Collector',
    stats: { speed: 70, acceleration: 59, handling: 58, reliability: 65 }, resaleValue: 79, artIndex: 5,
  },
  {
    id: 'kairox-r', name: 'Kairox R', rarity: 'Epic', class: 'Track',
    stats: { speed: 70, acceleration: 72, handling: 91, reliability: 63 }, resaleValue: 110, artIndex: 6,
  },
  {
    id: 'nivaro-gtx', name: 'Nivaro GTX', rarity: 'Epic', class: 'Exotic',
    stats: { speed: 82, acceleration: 79, handling: 71, reliability: 60 }, resaleValue: 117, artIndex: 7,
  },
  {
    id: 'viremont-aurum', name: 'Viremont Aurum', rarity: 'Legendary', class: 'Collector',
    stats: { speed: 85, acceleration: 84, handling: 82, reliability: 76 }, resaleValue: 200, artIndex: 8,
  },
  {
    id: 'sorevik-t9', name: 'Sorevik T9', rarity: 'Legendary', class: 'Track',
    stats: { speed: 88, acceleration: 81, handling: 95, reliability: 65 }, resaleValue: 220, artIndex: 9,
  },
  {
    id: 'veldris-zenith', name: 'Veldris Zenith', rarity: 'Mythic', class: 'Exotic',
    stats: { speed: 98, acceleration: 98, handling: 72, reliability: 70 }, resaleValue: 360, artIndex: 10,
  },
  {
    id: 'orvane-eclipse', name: 'Orvane Eclipse', rarity: 'Mythic', class: 'Exotic',
    stats: { speed: 96, acceleration: 93, handling: 89, reliability: 74 }, resaleValue: 390, artIndex: 11,
  },
];
