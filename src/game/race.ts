import { cars, events, stats, tacticModifiers, tacticVolatility, type Car, type CarStats, type EventId, type Stat, type Tactic } from './config';
import type { CareerEventId, LeagueId } from './career';
import { createRandom } from './random';

export interface RacePhase {
  player: number;
  opponent: number;
}

export interface RaceBreakdown {
  stats: CarStats;
  tacticDelta: number;
  playerVariation: number;
  rivalPaceDelta: number;
  rivalVariation: number;
}

interface RaceRatings extends Pick<RaceBreakdown, 'stats' | 'tacticDelta' | 'rivalPaceDelta'> {
  playerBase: number;
  playerTactical: number;
  rivalBase: number;
  rivalPace: number;
}

export interface RaceResult {
  id: string;
  eventId: EventId;
  tactic: Tactic;
  playerCarId: string;
  opponentCarId: string;
  won: boolean;
  reward: number;
  rewardReason?: 'first-clear' | 'win' | 'cooldown' | 'loss';
  playerScore: number;
  opponentScore: number;
  explanation: string;
  phases: RacePhase[];
  breakdown?: RaceBreakdown;
  careerEventId?: CareerEventId;
  careerAward?: LeagueId;
}

interface CareerRival {
  opponent: Car;
  name: string;
  paceRatio: number;
  volatility: number;
}

const statNames: Record<Stat, string> = {
  speed: 'Speed',
  acceleration: 'Acceleration',
  handling: 'Handling',
  reliability: 'Reliability',
};

function weightedScore(ratings: CarStats, weights: CarStats, modifiers?: CarStats): number {
  return stats.reduce((score, stat) => score + (ratings[stat] + (modifiers?.[stat] ?? 0)) * weights[stat] / 100, 0);
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function pickOpponent(player: Car, weights: CarStats, random: () => number): Car {
  const playerScore = weightedScore(player.stats, weights);
  const candidates = cars.filter((car) => {
    if (car.id === player.id) return false;
    const opponentScore = weightedScore(car.stats, weights);
    // Leave at least half of the combined Balanced swing available to decide the race.
    const maxGap = (playerScore + opponentScore) * tacticVolatility.Balanced / 2;
    return Math.abs(opponentScore - playerScore) <= maxGap;
  });
  return candidates[Math.floor(random() * candidates.length)] ?? player;
}

export function previewRaceOpponent(eventId: EventId, player: Car, seed: number): Car {
  return pickOpponent(player, events[eventId].weights, createRandom(seed));
}

export function raceRatings(eventId: EventId, player: Car, opponent: Car, tactic: Tactic, paceRatio = 1): RaceRatings {
  const { weights } = events[eventId];
  const playerBase = weightedScore(player.stats, weights);
  const playerTactical = weightedScore(player.stats, weights, tacticModifiers[tactic]);
  const rivalBase = weightedScore(opponent.stats, weights);
  const rivalPace = rivalBase * paceRatio;
  const statGaps = Object.fromEntries(stats.map((stat) => [stat, (player.stats[stat] - opponent.stats[stat]) * weights[stat] / 100])) as CarStats;
  return { playerBase, playerTactical, rivalBase, rivalPace, stats: statGaps,
    tacticDelta: playerTactical - playerBase, rivalPaceDelta: rivalPace - rivalBase };
}

function describeResult(won: boolean, player: Car, opponent: Car, weights: CarStats, tactic: Tactic, tied: boolean, raceDaySwing: number): string {
  const modifiers = tacticModifiers[tactic];
  const differences = stats.map((stat) => ({ stat, gap: (player.stats[stat] + modifiers[stat] - opponent.stats[stat]) * weights[stat] / 100 }));
  const advantage = differences.reduce((best, current) => won ? (current.gap > best.gap ? current : best) : (current.gap < best.gap ? current : best));
  const closest = tied
    ? 'A seeded tie-break decided the race.'
    : `Race-day variation changed your score by ${raceDaySwing >= 0 ? '+' : ''}${raceDaySwing.toFixed(2)} points.`;
  const driver = won ? 'Your car' : 'The rival';
  const factor = (won ? advantage.gap : -advantage.gap) > 0
    ? `${driver} had its biggest weighted advantage in ${statNames[advantage.stat]}.`
    : 'Race-day variation and the tie-break can decide close matches.';
  return `${won ? 'You won.' : 'You lost.'} ${factor} ${tactic} allows up to ${tacticVolatility[tactic] * 100}% variation. ${closest}`;
}

const launch = { speed: 4, acceleration: 86, handling: 8, reliability: 2 };
const straight = { speed: 82, acceleration: 12, handling: 4, reliability: 2 };
const curves = { speed: 12, acceleration: 14, handling: 64, reliability: 10 };
const wetCurves = { speed: 6, acceleration: 6, handling: 63, reliability: 25 };
const stint = { speed: 15, acceleration: 8, handling: 12, reliability: 65 };

const sectors: Record<EventId, readonly CarStats[]> = {
  drag: [launch, launch, launch, straight, straight, straight, straight],
  circuit: [launch, straight, curves, curves, straight, curves, straight],
  'wet-circuit': [launch, wetCurves, wetCurves, straight, wetCurves, wetCurves, straight, wetCurves],
  endurance: [launch, straight, stint, curves, stint, straight, stint, curves, stint, stint],
};

function sectorProgress(eventId: EventId, car: Car, finish: number, variation: number, modifiers?: CarStats): number[] {
  const weights = sectors[eventId];
  // Sector strengths shape the visible lead. Normalizing them leaves the scored finish unchanged.
  const paces = weights.map((sector, index) =>
    34 + weightedScore(car.stats, sector, modifiers) + (index % 2 === 0 ? 2 : -2) * variation);
  const distance = paces.reduce((total, pace) => total + pace, 0);
  let travelled = 0;
  const splits = paces.slice(0, -1).map((pace) => {
    travelled += pace;
    return roundScore(finish * travelled / distance);
  });
  return [0, ...splits, finish];
}

function buildPhases(
  eventId: EventId, player: Car, opponent: Car, tactic: Tactic,
  playerScore: number, opponentScore: number, won: boolean, breakdown: RaceBreakdown,
): RacePhase[] {
  const otherFinish = Math.max(75, Math.min(99.5, 100 * Math.min(playerScore, opponentScore) / Math.max(playerScore, opponentScore)));
  const playerSplits = sectorProgress(eventId, player, won ? 100 : otherFinish, breakdown.playerVariation, tacticModifiers[tactic]);
  const opponentSplits = sectorProgress(eventId, opponent, won ? otherFinish : 100, breakdown.rivalVariation);
  return playerSplits.map((progress, index) => ({ player: progress, opponent: opponentSplits[index] }));
}

export function simulateRace(
  id: string, eventId: EventId, tactic: Tactic, player: Car, seed?: number, careerRival?: CareerRival,
): Omit<RaceResult, 'reward' | 'rewardReason'> {
  const random = createRandom(seed);
  const { weights, rivalVolatility } = events[eventId];
  const opponent = careerRival?.opponent ?? pickOpponent(player, weights, random);
  const ratings = raceRatings(eventId, player, opponent, tactic, careerRival?.paceRatio);
  const variation = (volatility: number) => 1 + (2 * random() - 1) * volatility;
  const playerScore = roundScore(ratings.playerTactical * variation(tacticVolatility[tactic]));
  const opponentScore = roundScore(ratings.rivalPace * variation(careerRival?.volatility ?? rivalVolatility ?? tacticVolatility.Balanced));
  const tied = playerScore === opponentScore;
  const won = tied ? random() < 0.5 : playerScore > opponentScore;
  const breakdown: RaceBreakdown = {
    stats: ratings.stats,
    tacticDelta: ratings.tacticDelta,
    playerVariation: playerScore - ratings.playerTactical,
    rivalPaceDelta: ratings.rivalPaceDelta,
    rivalVariation: opponentScore - ratings.rivalPace,
  };

  return {
    id, eventId, tactic,
    playerCarId: player.id,
    opponentCarId: opponent.id,
    won,
    playerScore,
    opponentScore,
    explanation: careerRival
      ? `${won ? 'You won.' : 'You lost.'} ${careerRival.name}'s pace comes from their car and this event's setup. ${tied ? 'A seeded tie-break settled the finish.' : `${tactic} and race-day variation set your final score.`}`
      : describeResult(won, player, opponent, weights, tactic, tied, roundScore(breakdown.playerVariation)),
    phases: buildPhases(eventId, player, opponent, tactic, playerScore, opponentScore, won, breakdown),
    breakdown,
  };
}
