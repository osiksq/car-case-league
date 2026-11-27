import type { RaceResult } from '../game/race';
import { runForegroundAnimation } from './animation-clock';
import { playRaceScene, type RaceCue } from './race-scene';

const reelDuration = 3_800;
const reelHold = 330;
const reelTickInterval = 74;

export type ReelCue = 'mechanism' | 'tick' | 'settle' | { type: 'progress'; elapsed: number };

export function animateRoulette(root: HTMLElement, done: () => void, onCue?: (cue: ReelCue) => void) {
  const viewport = root.querySelector<HTMLElement>('.roulette-viewport');
  const track = root.querySelector<HTMLElement>('.roulette-track');
  const winner = root.querySelector<HTMLElement>('[data-reel-winner]');
  if (!viewport || !track || !winner) return runForegroundAnimation(null, () => true, done);

  let distance = 0;
  let shift = 0;
  let origin = 0;
  let stride = 0;
  let crossing = 0;
  let lastTick = 0;
  let lastFrame = -1;
  let started = false;
  let settled = false;
  const measure = () => {
    const card = winner.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    distance = card.left + card.width / 2 - center - shift;
    const first = track.children[0]?.getBoundingClientRect();
    const second = track.children[1]?.getBoundingClientRect();
    stride = first && second ? second.left - first.left : 0;
    origin = first ? center - first.left - first.width / 2 + shift : 0;
    crossing = stride > 0 ? Math.floor((origin - shift) / stride) : 0;
  };

  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(viewport);
  const stop = runForegroundAnimation(viewport, (elapsed) => {
    const frame = Math.floor(elapsed * 60 / 1000);
    if (frame === lastFrame) return false;
    lastFrame = frame;
    if (!started) {
      started = true;
      onCue?.('mechanism');
    }
    const ratio = Math.min(elapsed / reelDuration, 1);
    const offset = -distance * (1 - (1 - ratio) ** 3.6);
    if (offset !== shift) {
      shift = offset;
      track.style.transform = `translate3d(${shift}px, 0, 0)`;
    }
    const nextCrossing = stride > 0 ? Math.floor((origin - shift) / stride) : crossing;
    if (ratio === 1 && !settled) {
      settled = true;
      onCue?.('settle');
    } else if (ratio < 1) {
      onCue?.({ type: 'progress', elapsed });
      if (nextCrossing !== crossing && elapsed - lastTick >= reelTickInterval) {
        onCue?.('tick');
        lastTick = elapsed;
      }
    }
    crossing = nextCrossing;
    return elapsed >= reelDuration + reelHold;
  }, () => {
    observer.disconnect();
    done();
  });
  return () => {
    observer.disconnect();
    stop();
  };
}

export function animateRace(root: HTMLElement, race: RaceResult, done: () => void, onCue?: (cue: RaceCue) => void) {
  return playRaceScene(root, race, done, onCue);
}
