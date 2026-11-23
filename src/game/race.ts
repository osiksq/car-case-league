import { cars, events, stats, tacticModifiers, tacticVolatility, type Car, type CarStats, type EventId, type Stat, type Tactic } from './config';
import type { CareerEventId, LeagueId } from './career';
import { createRandom } from './random';

export interface RacePhase {
  player: number;
  opponent: number;
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

function buildPhases(player: Car, opponent: Car, playerScore: number, opponentScore: number, won: boolean): RacePhase[] {
  const otherFinish = Math.max(75, Math.min(99.5, 100 * Math.min(playerScore, opponentScore) / Math.max(playerScore, opponentScore)));
  const playerFinish = won ? 100 : otherFinish;
  const opponentFinish = won ? otherFinish : 100;
  const progress = (car: Car, fraction: number, finish: number) => {
    const launch = (car.stats.acceleration - 50) / 500;
    return roundScore(finish * (fraction + launch * Math.sin(Math.PI * fraction)));
  };
  return [0, 0.17, 0.38, 0.64, 0.83, 1].map((fraction) => ({
    player: progress(player, fraction, playerFinish),
    opponent: progress(opponent, fraction, opponentFinish),
  }));
}

export function simulateRace(
  id: string, eventId: EventId, tactic: Tactic, player: Car, seed?: number, careerRival?: CareerRival,
): Omit<RaceResult, 'reward' | 'rewardReason'> {
  const random = createRandom(seed);
  const { weights } = events[eventId];
  const opponent = careerRival?.opponent ?? pickOpponent(player, weights, random);
  const opponentBaseScore = weightedScore(opponent.stats, weights) * (careerRival?.paceRatio ?? 1);
  const variation = (volatility: number) => 1 + (2 * random() - 1) * volatility;
  const playerBaseScore = weightedScore(player.stats, weights, tacticModifiers[tactic]);
  const playerScore = roundScore(playerBaseScore * variation(tacticVolatility[tactic]));
  const opponentScore = roundScore(opponentBaseScore * variation(careerRival?.volatility ?? tacticVolatility.Balanced));
  const tied = playerScore === opponentScore;
  const won = tied ? random() < 0.5 : playerScore > opponentScore;

  return {
    id, eventId, tactic,
    playerCarId: player.id,
    opponentCarId: opponent.id,
    won,
    playerScore,
    opponentScore,
    explanation: careerRival
      ? `${won ? 'You won.' : 'You lost.'} ${careerRival.name}'s pace comes from their car and this event's setup. ${tied ? 'A seeded tie-break settled the finish.' : `${tactic} and race-day variation set your final score.`}`
      : describeResult(won, player, opponent, weights, tactic, tied, roundScore(playerScore - playerBaseScore)),
    phases: buildPhases(player, opponent, playerScore, opponentScore, won),
  };
}
