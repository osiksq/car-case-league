export const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic'] as const;
export type Rarity = (typeof rarities)[number];

export const classes = ['Street', 'Sport', 'Muscle', 'Track', 'Exotic', 'Classic', 'Collector'] as const;
export type CarClass = (typeof classes)[number];

export const stats = ['speed', 'acceleration', 'handling', 'reliability'] as const;
export type Stat = (typeof stats)[number];
export type CarStats = Record<Stat, number>;

export const tactics = ['Safe', 'Balanced', 'Push'] as const;
export type Tactic = (typeof tactics)[number];
export type EventId = 'drag' | 'circuit' | 'wet-circuit' | 'endurance';

export interface Car {
  id: string;
  name: string;
  rarity: Rarity;
  class: CarClass;
  stats: CarStats;
  resaleValue: number;
  artIndex: number;
}

export const events: Record<EventId, { name: string; description: string; weights: CarStats; rivalVolatility?: number }> = {
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
  'wet-circuit': {
    name: 'Wet Circuit',
    description: 'Standing water and slick corners reward confident handling and a dependable car.',
    weights: { speed: 15, acceleration: 10, handling: 50, reliability: 25 },
    rivalVolatility: 0.07,
  },
  endurance: {
    name: 'Endurance',
    description: 'A long twilight run that rewards reliable pace through every stint.',
    weights: { speed: 20, acceleration: 10, handling: 20, reliability: 50 },
    rivalVolatility: 0.085,
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
  {
    id: 'dorvik-75', name: 'Dorvik 75', rarity: 'Common', class: 'Classic',
    stats: { speed: 35, acceleration: 40, handling: 47, reliability: 62 }, resaleValue: 20, artIndex: 12,
  },
  {
    id: 'talmor-pico', name: 'Talmor Pico', rarity: 'Common', class: 'Street',
    stats: { speed: 28, acceleration: 45, handling: 58, reliability: 44 }, resaleValue: 22, artIndex: 13,
  },
  {
    id: 'norwyn-kite', name: 'Norwyn Kite', rarity: 'Common', class: 'Street',
    stats: { speed: 41, acceleration: 43, handling: 52, reliability: 46 }, resaleValue: 24, artIndex: 14,
  },
  {
    id: 'velska-cargo', name: 'Velska Cargo', rarity: 'Common', class: 'Street',
    stats: { speed: 31, acceleration: 35, handling: 42, reliability: 72 }, resaleValue: 16, artIndex: 15,
  },
  {
    id: 'ruskell-120', name: 'Ruskell 120', rarity: 'Common', class: 'Classic',
    stats: { speed: 39, acceleration: 44, handling: 38, reliability: 66 }, resaleValue: 18, artIndex: 16,
  },
  {
    id: 'havrix-cabrio', name: 'Havrix Cabrio', rarity: 'Common', class: 'Classic',
    stats: { speed: 34, acceleration: 37, handling: 60, reliability: 59 }, resaleValue: 26, artIndex: 17,
  },
  {
    id: 'elden-boxer', name: 'Elden Boxer', rarity: 'Common', class: 'Muscle',
    stats: { speed: 46, acceleration: 49, handling: 29, reliability: 53 }, resaleValue: 23, artIndex: 18,
  },
  {
    id: 'narvik-rally', name: 'Narvik Rally', rarity: 'Uncommon', class: 'Sport',
    stats: { speed: 48, acceleration: 55, handling: 72, reliability: 62 }, resaleValue: 43, artIndex: 19,
  },
  {
    id: 'issara-twin', name: 'Issara Twin', rarity: 'Uncommon', class: 'Street',
    stats: { speed: 51, acceleration: 60, handling: 58, reliability: 45 }, resaleValue: 37, artIndex: 20,
  },
  {
    id: 'malkor-ss', name: 'Malkor SS', rarity: 'Uncommon', class: 'Muscle',
    stats: { speed: 61, acceleration: 66, handling: 33, reliability: 48 }, resaleValue: 40, artIndex: 21,
  },
  {
    id: 'vesryn-dune', name: 'Vesryn Dune', rarity: 'Uncommon', class: 'Sport',
    stats: { speed: 58, acceleration: 53, handling: 54, reliability: 69 }, resaleValue: 34, artIndex: 22,
  },
  {
    id: 'selaire-roadster', name: 'Selaire Roadster', rarity: 'Uncommon', class: 'Classic',
    stats: { speed: 53, acceleration: 51, handling: 70, reliability: 56 }, resaleValue: 46, artIndex: 23,
  },
  {
    id: 'ordane-sedan', name: 'Ordane Sedan', rarity: 'Uncommon', class: 'Street',
    stats: { speed: 59, acceleration: 57, handling: 47, reliability: 74 }, resaleValue: 39, artIndex: 24,
  },
  {
    id: 'tavren-cup', name: 'Tavren Cup', rarity: 'Rare', class: 'Track',
    stats: { speed: 58, acceleration: 65, handling: 84, reliability: 56 }, resaleValue: 78, artIndex: 25,
  },
  {
    id: 'karsen-v8', name: 'Karsen V8', rarity: 'Rare', class: 'Muscle',
    stats: { speed: 75, acceleration: 77, handling: 40, reliability: 57 }, resaleValue: 76, artIndex: 26,
  },
  {
    id: 'vossari-spyder', name: 'Vossari Spyder', rarity: 'Rare', class: 'Sport',
    stats: { speed: 71, acceleration: 62, handling: 77, reliability: 59 }, resaleValue: 88, artIndex: 27,
  },
  {
    id: 'aldoven-63', name: 'Aldoven 63', rarity: 'Rare', class: 'Collector',
    stats: { speed: 66, acceleration: 61, handling: 68, reliability: 78 }, resaleValue: 95, artIndex: 28,
  },
  {
    id: 'bellovar-mk2', name: 'Bellovar Mk II', rarity: 'Rare', class: 'Collector',
    stats: { speed: 77, acceleration: 71, handling: 54, reliability: 52 }, resaleValue: 98, artIndex: 29,
  },
  {
    id: 'cirven-sport', name: 'Cirven Sport', rarity: 'Rare', class: 'Sport',
    stats: { speed: 63, acceleration: 73, handling: 72, reliability: 47 }, resaleValue: 72, artIndex: 30,
  },
  {
    id: 'quorven-rs', name: 'Quorven RS', rarity: 'Epic', class: 'Track',
    stats: { speed: 76, acceleration: 70, handling: 93, reliability: 74 }, resaleValue: 138, artIndex: 31,
  },
  {
    id: 'ralvex-turbo', name: 'Ralvex Turbo', rarity: 'Epic', class: 'Muscle',
    stats: { speed: 84, acceleration: 94, handling: 48, reliability: 55 }, resaleValue: 139, artIndex: 32,
  },
  {
    id: 'solvara-sr6', name: 'Solvara SR6', rarity: 'Epic', class: 'Collector',
    stats: { speed: 74, acceleration: 76, handling: 86, reliability: 69 }, resaleValue: 161, artIndex: 33,
  },
  {
    id: 'melvane-gt1', name: 'Melvane GT1', rarity: 'Epic', class: 'Collector',
    stats: { speed: 88, acceleration: 80, handling: 72, reliability: 62 }, resaleValue: 169, artIndex: 34,
  },
  {
    id: 'ventari-s4', name: 'Ventari S4', rarity: 'Epic', class: 'Exotic',
    stats: { speed: 85, acceleration: 75, handling: 77, reliability: 73 }, resaleValue: 152, artIndex: 35,
  },
  {
    id: 'trevos-r90', name: 'Trevos R90', rarity: 'Legendary', class: 'Track',
    stats: { speed: 85, acceleration: 83, handling: 98, reliability: 72 }, resaleValue: 242, artIndex: 36,
  },
  {
    id: 'ardenza-proto', name: 'Ardenza Proto', rarity: 'Legendary', class: 'Collector',
    stats: { speed: 94, acceleration: 89, handling: 75, reliability: 66 }, resaleValue: 260, artIndex: 37,
  },
  {
    id: 'ikhara-gt', name: 'Ikhara GT', rarity: 'Legendary', class: 'Exotic',
    stats: { speed: 90, acceleration: 94, handling: 68, reliability: 80 }, resaleValue: 237, artIndex: 38,
  },
  {
    id: 'novaryn-zero', name: 'Novaryn Zero', rarity: 'Mythic', class: 'Exotic',
    stats: { speed: 97, acceleration: 90, handling: 98, reliability: 67 }, resaleValue: 430, artIndex: 39,
  },
  {
    id: 'vostren-76', name: 'Vostren 76', rarity: 'Common', class: 'Classic',
    stats: { speed: 35, acceleration: 38, handling: 53, reliability: 58 }, resaleValue: 21, artIndex: 40,
  },
  {
    id: 'borvane-estate', name: 'Borvane Estate', rarity: 'Common', class: 'Street',
    stats: { speed: 32, acceleration: 34, handling: 45, reliability: 71 }, resaleValue: 19, artIndex: 41,
  },
  {
    id: 'raiven-16', name: 'Raiven 1.6', rarity: 'Uncommon', class: 'Sport',
    stats: { speed: 53, acceleration: 61, handling: 69, reliability: 49 }, resaleValue: 44, artIndex: 42,
  },
  {
    id: 'harten-velo', name: 'Harten Velo', rarity: 'Uncommon', class: 'Street',
    stats: { speed: 57, acceleration: 54, handling: 60, reliability: 66 }, resaleValue: 41, artIndex: 43,
  },
  {
    id: 'shinari-ts', name: 'Shinari TS', rarity: 'Rare', class: 'Sport',
    stats: { speed: 63, acceleration: 67, handling: 83, reliability: 60 }, resaleValue: 83, artIndex: 44,
  },
  {
    id: 'krayden-t6', name: 'Krayden T6', rarity: 'Rare', class: 'Sport',
    stats: { speed: 68, acceleration: 66, handling: 68, reliability: 76 }, resaleValue: 85, artIndex: 45,
  },
  {
    id: 'bramlock-900', name: 'Bramlock 900', rarity: 'Epic', class: 'Muscle',
    stats: { speed: 85, acceleration: 99, handling: 42, reliability: 45 }, resaleValue: 147, artIndex: 46,
  },
  {
    id: 'vantesso-corsa', name: 'Vantesso Corsa', rarity: 'Legendary', class: 'Track',
    stats: { speed: 86, acceleration: 81, handling: 93, reliability: 76 }, resaleValue: 230, artIndex: 47,
  },
  {
    id: 'nythera-rift', name: 'Nythera Rift', rarity: 'Mythic', class: 'Exotic',
    stats: { speed: 100, acceleration: 95, handling: 83, reliability: 64 }, resaleValue: 415, artIndex: 48,
  },
  {
    id: 'calderon-lm64', name: 'Calderon LM64', rarity: 'Exotic', class: 'Collector',
    stats: { speed: 78, acceleration: 69, handling: 85, reliability: 93 }, resaleValue: 520, artIndex: 49,
  },
];
