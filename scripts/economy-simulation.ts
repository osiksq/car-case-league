import { careerEvents, type CareerEventId } from '../src/game/career';
import { caseIds, casePool, cases, type CaseId } from '../src/game/cases';
import { cars, rarities, tactics, type Car, type Tactic } from '../src/game/config';
import { createRandom } from '../src/game/random';
import { simulateRace } from '../src/game/race';
import {
  createGame, finishCase, finishRace, openCase, raceRewardPreview, selectCar,
  startCareerRace, startRace, type GameState, type OwnedCar,
} from '../src/game/save';

const sessions = Number(process.env.CAR_CASE_SIM_SESSIONS ?? 600);
if (!Number.isSafeInteger(sessions) || sessions < 1) throw new Error('CAR_CASE_SIM_SESSIONS must be a positive integer.');
const horizon = 180 * 60_000;
const checkpoints = [10, 30, 60].map((minutes) => minutes * 60_000);
const epoch = 1_800_000_000_000;
const paidCases = caseIds.filter((id) => cases[id].price > 0);
const alternativeHyperPrice = 24_000;
const catalog = new Map(cars.map((car) => [car.id, car]));
const careerIds = Object.keys(careerEvents) as CareerEventId[];
const fullCaseCycle = 8_000;
const skipCaseCycle = 4_000;
const profiles = [
  { id: 'Junkyard (full opening)', duration: 24_000, strategy: 'yard' },
  { id: 'Junkyard (Skip)', duration: 7_000, strategy: 'yard' },
  { id: 'Career', duration: 24_000, strategy: 'career' },
  { id: 'Frequent losses', duration: 24_000, strategy: 'losses' },
  { id: 'Sell all duplicates', duration: 24_000, strategy: 'duplicates' },
  { id: 'Skip every animation', duration: 7_000, strategy: 'career' },
  { id: 'Farm best replays', duration: 7_000, strategy: 'farm' },
] as const;

type Profile = typeof profiles[number];
type Matchup = { tactic: Tactic; winRate: number };
type Entry = Matchup & { owned: OwnedCar; event?: CareerEventId; value: number };

const distinctGarages = new WeakMap<OwnedCar[], OwnedCar[]>();

function distinctGarage(state: GameState): OwnedCar[] {
  const cached = distinctGarages.get(state.garage);
  if (cached) return cached;
  const unique = [...new Map(state.garage.map((car) => [car.carId, car])).values()];
  distinctGarages.set(state.garage, unique);
  return unique;
}

function buildMatchups() {
  const matchups = new Map<string, Matchup>();
  for (const event of careerIds) {
    const rival = careerEvents[event];
    const opponent = catalog.get(rival.rivalCarId)!;
    for (const car of cars) {
      const scored = tactics.map((tactic) => {
        let wins = 0;
        for (let seed = 0; seed < 128; seed++) {
          const race = simulateRace('sample', rival.eventId, tactic, car, seed + 101, {
            opponent, name: rival.rivalName, paceRatio: rival.paceRatio, volatility: rival.rivalVolatility,
          });
          wins += Number(race.won);
        }
        return { tactic, winRate: wins / 128 };
      });
      matchups.set(car.id + '/' + event, scored.reduce((best, next) => next.winRate > best.winRate ? next : best));
    }
  }
  return matchups;
}

function bestEntry(state: GameState, now: number, matchups: Map<string, Matchup>, profile: Profile): Entry | undefined {
  const firstOnly: Entry[] = [];
  const payingReplays: Entry[] = [];
  const garage = distinctGarage(state);
  for (const event of careerIds) {
    if (!state.career.unlocked.includes(careerEvents[event].leagueId)) continue;
    const preview = raceRewardPreview(state, event, now);
    for (const owned of garage) {
      const matchup = matchups.get(owned.carId + '/' + event)!;
      const first = preview.firstWin > 0;
      const payout = first ? preview.firstWin : preview.replayWin;
      const entry = { ...matchup, event, owned, value: matchup.winRate * payout };
      if (first && matchup.winRate >= 0.05) firstOnly.push(entry);
      if (!first && preview.remainingMs === 0 && matchup.winRate >= 0.05) payingReplays.push(entry);
    }
  }
  const best = (entries: Entry[]) => entries.reduce<Entry | undefined>((top, entry) => !top || entry.value > top.value ? entry : top, undefined);
  if (profile.strategy === 'losses') {
    // Deliberately enter the hardest available race in the starter on nine of ten attempts.
    if (state.progress.racesCompleted % 10 !== 9) {
      const owned = state.garage[0];
      const event = careerIds.filter((id) => state.career.unlocked.includes(careerEvents[id].leagueId))
        .reduce((hardest, id) => matchups.get(owned.carId + '/' + id)!.winRate < matchups.get(owned.carId + '/' + hardest)!.winRate ? id : hardest);
      return { owned, event, tactic: 'Safe', winRate: 0, value: 0 };
    }
  }
  const priorities = best(firstOnly) ?? best(payingReplays);
  if (priorities) return priorities;
  if (profile.strategy === 'farm' && state.career.completed.length) {
    const event = state.career.completed.at(-1)!;
    const owned = state.garage.reduce((best, candidate) =>
      matchups.get(candidate.carId + '/' + event)!.winRate > matchups.get(best.carId + '/' + event)!.winRate ? candidate : best);
    return { owned, event, ...matchups.get(owned.carId + '/' + event)!, value: 0 };
  }
  if (raceRewardPreview(state, undefined, now).remainingMs === 0) {
    return { owned: state.garage[0], tactic: 'Push', winRate: 0.5, value: 0 };
  }
}

function upgrade(state: GameState, matchups: Map<string, Matchup>, purchases: ReadonlyMap<CaseId, number>): CaseId | undefined {
  const garage = distinctGarage(state);
  const blocked = careerIds.filter((id) =>
    state.career.unlocked.includes(careerEvents[id].leagueId) && !state.career.completed.includes(id)
    && garage.every((car) => matchups.get(car.carId + '/' + id)!.winRate < 0.05));
  if (!blocked.length) return undefined;
  const opportunities = paidCases.filter((id) => state.coins >= cases[id].price).map((id) => {
    const pool = casePool(id);
    let chance = 0;
    for (const rarity of rarities) {
      const tier = pool.filter((car) => car.rarity === rarity);
      if (!tier.length) continue;
      const useful = tier.filter((car: Car) => blocked.some((event) => matchups.get(car.id + '/' + event)!.winRate >= 0.12)).length;
      chance += cases[id].odds[rarity] * useful / tier.length;
    }
    const limit = id === 'rookie' ? 2 : 5;
    const value = (purchases.get(id) ?? 0) < limit && chance >= 12 ? chance / cases[id].price : 0;
    return { id, value };
  }).sort((a, b) => b.value - a.value);
  return opportunities.find(({ value }) => value > 0)?.id;
}

function runSession(profile: Profile, seed: number, matchups: Map<string, Matchup>) {
  const random = createRandom(seed);
  const nextSeed = () => Math.floor(random() * 0x100000000);
  const caseDuration = profile.duration === 7_000 ? skipCaseCycle : fullCaseCycle;
  let state = createGame();
  let now = epoch;
  let earned = 0;
  let won = 0;
  const firstAffordable = new Map<CaseId, number>();
  let careerCompleted: number | undefined;
  let alternativeHyper: number | undefined;
  const balances: number[] = [];
  const purchases = new Map<CaseId, number>();
  const recordCheckpoints = (next: number) => {
    while (balances.length < checkpoints.length && next - epoch > checkpoints[balances.length]) balances.push(earned);
  };

  while (now - epoch <= horizon) {
    recordCheckpoints(now);
    for (const id of paidCases) {
      if (state.coins >= cases[id].price && !firstAffordable.has(id)) firstAffordable.set(id, now - epoch);
    }
    if (state.career.completed.length === careerIds.length) careerCompleted ??= now - epoch;
    if (state.coins >= alternativeHyperPrice) alternativeHyper ??= now - epoch;
    const chosen = !state.garage.length || profile.strategy === 'yard'
      ? 'junkyard'
      : profile.strategy !== 'losses' ? upgrade(state, matchups, purchases) : undefined;
    if (chosen) {
      recordCheckpoints(now + caseDuration);
      const opened = openCase(state, chosen, nextSeed(), now);
      const car = opened.garage.at(-1)!;
      const duplicate = state.garage.some((owned) => owned.carId === car.carId);
      const sell = state.garage.length > 0 && (profile.strategy === 'yard' || (profile.strategy === 'duplicates' && duplicate));
      state = finishCase(opened, sell ? 'sell' : 'keep');
      if (sell) earned += state.coins - opened.coins;
      if (chosen !== 'junkyard') purchases.set(chosen, (purchases.get(chosen) ?? 0) + 1);
      now += caseDuration;
      continue;
    }
    const entry = bestEntry(state, now, matchups, profile);
    if (entry) {
      recordCheckpoints(now + profile.duration);
      if (entry.owned.id !== state.selectedId) state = selectCar(state, entry.owned.id);
      const started = entry.event
        ? startCareerRace(state, entry.event, entry.tactic, nextSeed(), now)
        : startRace(state, 'drag', entry.tactic, nextSeed(), now);
      earned += started.pendingRace!.reward;
      won += Number(started.pendingRace!.won);
      // The simulation never serializes; trim history while retaining the real counter and result.
      state = finishRace({ ...started, races: started.races.slice(-1) });
      now += profile.duration;
      continue;
    }
    now += raceRewardPreview(state, undefined, now).remainingMs || 1_000;
  }
  recordCheckpoints(Number.POSITIVE_INFINITY);
  return { balances, firstAffordable, careerCompleted, alternativeHyper, wins: won, races: state.progress.racesCompleted };
}

function expectedResale(id: CaseId, first = false) {
  const pool = casePool(id, first);
  return rarities.reduce((sum, rarity) => {
    const tier = pool.filter((car) => car.rarity === rarity);
    return tier.length ? sum + cases[id].odds[rarity] * tier.reduce((value, car) => value + car.resaleValue, 0) / tier.length / 100 : sum;
  }, 0);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatTime(times: (number | undefined)[], sampleSize: number) {
  const reached = times.filter((time): time is number => time !== undefined);
  if (!reached.length) return '— (0%)';
  return `${(average(reached) / 60_000).toFixed(1)} min (${(reached.length * 100 / sampleSize).toFixed(0)}%)`;
}

export function simulateEconomy() {
  const matchups = buildMatchups();
  const lines = [
    `Sessions per strategy: ${sessions}; horizon: ${horizon / 60_000} minutes; race cycles: 24s normal / 7s skipped; case cycles: 8s / 4s.`,
    '',
    '| Strategy | Income 10 min | 30 min | 60 min | Race win rate |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  const data = profiles.map((profile) => ({
    profile,
    results: Array.from({ length: sessions }, (_, index) => runSession(profile, 73_001 + index, matchups)),
  }));
  for (const { profile, results } of data) {
    const income = checkpoints.map((_, index) => Math.round(average(results.map((result) => result.balances[index]))));
    const raceCount = average(results.map(({ races }) => races));
    const winRate = raceCount ? `${(average(results.map(({ wins }) => wins)) * 100 / raceCount).toFixed(0)}%` : '—';
    lines.push(`| ${profile.id} | ${income.join(' | ')} | ${winRate} |`);
  }
  lines.push('', '| Strategy | ' + paidCases.map((id) => cases[id].name).join(' | ') + ' |',
    '| --- |' + ' ---: |'.repeat(paidCases.length));
  for (const { profile, results } of data) {
    const times = paidCases.map((id) => formatTime(results.map(({ firstAffordable }) => firstAffordable.get(id)), sessions));
    lines.push(`| ${profile.id} | ${times.join(' | ')} |`);
  }
  lines.push('', '| Strategy | All eight competitions won | Alternative Hyper price (24,000 coins) |',
    '| --- | ---: | ---: |');
  for (const { profile, results } of data) {
    const career = formatTime(results.map(({ careerCompleted }) => careerCompleted), sessions);
    const hyper = formatTime(results.map(({ alternativeHyper }) => alternativeHyper), sessions);
    lines.push(`| ${profile.id} | ${career} | ${hyper} |`);
  }
  lines.push('', 'Times are means among sessions reaching the goal by 180 minutes. The percentage is coverage. Income excludes the initial wallet and does not subtract case purchases.',
    'Junkyard-only strategies keep the first car and sell every later drop. Other strategies open their starter, then prioritize racing and their configured paid case purchases.',
    '', '| Case | Price | Expected resale |', '| --- | ---: | ---: |');
  for (const id of caseIds) lines.push(`| ${cases[id].name} | ${cases[id].price} | ${expectedResale(id).toFixed(2)} |`);
  lines.push('', '| Junkyard cycle | Expected coins at 10 min | 30 min | 60 min |',
    '| --- | ---: | ---: | ---: |');
  const resale = expectedResale('junkyard');
  for (const [label, duration] of [['Full opening', fullCaseCycle], ['Skip', skipCaseCycle]] as const) {
    const earnings = checkpoints.map((time) => ((Math.floor(time / duration) - 1) * resale).toFixed(2));
    lines.push(`| ${label} (${duration / 1_000}s) | ${earnings.join(' | ')} |`);
  }
  lines.push('', `First Junkyard theoretical resale: ${expectedResale('junkyard', true).toFixed(2)} coins (the last-car protection prevents selling it immediately).`);
  return lines.join('\n');
}
