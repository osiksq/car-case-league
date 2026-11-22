import type { EventId } from './config';

export const leagueIds = ['rookie', 'street', 'pro', 'elite'] as const;
export type LeagueId = typeof leagueIds[number];

interface CareerEventConfig {
  id: string;
  name: string;
  leagueId: LeagueId;
  eventId: EventId;
  rivalName: string;
  rivalCarId: string;
  difficulty: string;
  paceRatio: number;
  rivalVolatility: number;
}

export const careerEvents = {
  'depot-sprint': {
    id: 'depot-sprint', name: 'Depot Sprint', leagueId: 'rookie', eventId: 'drag',
    rivalName: 'Mara Vale', rivalCarId: 'petrel-s1', difficulty: 'Entry', paceRatio: 0.975, rivalVolatility: 0.02,
  },
  'foundry-loop': {
    id: 'foundry-loop', name: 'Foundry Loop', leagueId: 'rookie', eventId: 'circuit',
    rivalName: 'Noah Flint', rivalCarId: 'bravik-110', difficulty: 'Entry', paceRatio: 1, rivalVolatility: 0.02,
  },
  'neon-straight': {
    id: 'neon-straight', name: 'Neon Straight', leagueId: 'street', eventId: 'drag',
    rivalName: 'Inez Torres', rivalCarId: 'kestovan-rx', difficulty: 'Club', paceRatio: 0.975, rivalVolatility: 0.02,
  },
  'harbor-loop': {
    id: 'harbor-loop', name: 'Harbor Loop', leagueId: 'street', eventId: 'circuit',
    rivalName: 'Ada Mercer', rivalCarId: 'merovar-sprint', difficulty: 'Club', paceRatio: 0.985, rivalVolatility: 0.02,
  },
  'apex-sprint': {
    id: 'apex-sprint', name: 'Apex Sprint', leagueId: 'pro', eventId: 'drag',
    rivalName: 'Luca Rook', rivalCarId: 'thalven-gt', difficulty: 'Expert', paceRatio: 1.025, rivalVolatility: 0.02,
  },
  'ridge-circuit': {
    id: 'ridge-circuit', name: 'Ridge Circuit', leagueId: 'pro', eventId: 'circuit',
    rivalName: 'Rin Sato', rivalCarId: 'kairox-r', difficulty: 'Expert', paceRatio: 0.95, rivalVolatility: 0.02,
  },
  'crown-sprint': {
    id: 'crown-sprint', name: 'Crown Sprint', leagueId: 'elite', eventId: 'drag',
    rivalName: 'Arden Knox', rivalCarId: 'veldris-zenith', difficulty: 'Elite', paceRatio: 0.935, rivalVolatility: 0.09,
  },
  'summit-circuit': {
    id: 'summit-circuit', name: 'Summit Circuit', leagueId: 'elite', eventId: 'circuit',
    rivalName: 'Sera Voss', rivalCarId: 'orvane-eclipse', difficulty: 'Elite', paceRatio: 0.97, rivalVolatility: 0.065,
  },
} as const satisfies Record<string, CareerEventConfig>;

export type CareerEventId = keyof typeof careerEvents;
export type CareerEvent = typeof careerEvents[CareerEventId];

interface LeagueConfig {
  name: string;
  badge: string;
  eventIds: readonly CareerEventId[];
}

export const leagues: Record<LeagueId, LeagueConfig> = {
  rookie: { name: 'Rookie League', badge: 'Rookie Crest', eventIds: ['depot-sprint', 'foundry-loop'] },
  street: { name: 'Street League', badge: 'Street Crest', eventIds: ['neon-straight', 'harbor-loop'] },
  pro: { name: 'Pro League', badge: 'Pro Crest', eventIds: ['apex-sprint', 'ridge-circuit'] },
  elite: { name: 'Elite League', badge: 'Elite Crest', eventIds: ['crown-sprint', 'summit-circuit'] },
};

export interface CareerProgress {
  completed: CareerEventId[];
  unlocked: LeagueId[];
}

export function createCareerProgress(): CareerProgress {
  return { completed: [], unlocked: [leagueIds[0]] };
}

export function isCareerEventId(value: unknown): value is CareerEventId {
  return typeof value === 'string' && Object.hasOwn(careerEvents, value);
}

export function completeCareerEvent(progress: CareerProgress, id: CareerEventId): {
  progress: CareerProgress;
  award?: LeagueId;
} {
  const { leagueId } = careerEvents[id];
  if (!progress.unlocked.includes(leagueId) || progress.completed.includes(id)) return { progress };

  const completed = [...progress.completed, id];
  if (!leagues[leagueId].eventIds.every((eventId) => completed.includes(eventId))) {
    return { progress: { ...progress, completed } };
  }

  const nextLeague = leagueIds[leagueIds.indexOf(leagueId) + 1];
  const unlocked = nextLeague && !progress.unlocked.includes(nextLeague)
    ? [...progress.unlocked, nextLeague]
    : progress.unlocked;
  return { progress: { completed, unlocked }, award: leagueId };
}
