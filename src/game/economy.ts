import type { LeagueId } from './career';

export const economy = {
  startingCoins: 60,
  junkyardCooldownMs: 60_000,
  raceRewardCooldownMs: 60_000,
  freeRaceWin: 18,
  lossReward: 0,
  career: {
    rookie: { firstWin: 190, replayWin: 48 },
    street: { firstWin: 575, replayWin: 105 },
    pro: { firstWin: 1_700, replayWin: 190 },
    elite: { firstWin: 3_800, replayWin: 420 },
  } satisfies Record<LeagueId, { firstWin: number; replayWin: number }>,
};

export const gameClockStartedAt = Math.floor(performance.timeOrigin);

export function gameClockNow(): number {
  return gameClockStartedAt + Math.floor(performance.now());
}

export function cooldownRemainingMs(lastAt: number | null, duration: number, now: number): number {
  if (lastAt === null) return 0;
  return Math.max(0, Math.min(duration, lastAt + duration - now));
}
