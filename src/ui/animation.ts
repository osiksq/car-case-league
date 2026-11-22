import type { GameState } from '../game/save';

type Race = NonNullable<GameState['pendingRace']>;
const raceDuration = 13_000;
const reelDuration = 3_800;
const reelHold = 330;

function animate(duration: number, step: (elapsed: number) => void, done: () => void) {
  const start = performance.now();
  let frame = requestAnimationFrame(update);
  function update(now: number) {
    const elapsed = Math.min(Math.max(0, now - start), duration);
    step(elapsed);
    if (elapsed === duration) done();
    else frame = requestAnimationFrame(update);
  }
  return () => cancelAnimationFrame(frame);
}

export function animateRoulette(root: HTMLElement, done: () => void) {
  const viewport = root.querySelector<HTMLElement>('.roulette-viewport');
  const track = root.querySelector<HTMLElement>('.roulette-track');
  const winner = root.querySelector<HTMLElement>('[data-reel-winner]');
  if (!viewport || !track || !winner) return animate(0, () => {}, done);

  let distance = 0;
  let shift = 0;
  const measure = () => {
    const card = winner.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    distance = card.left + card.width / 2 - (bounds.left + bounds.width / 2) - shift;
  };

  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(viewport);
  const stop = animate(reelDuration + reelHold, (elapsed) => {
    const ratio = Math.min(elapsed / reelDuration, 1);
    shift = -distance * (1 - (1 - ratio) ** 3.6);
    track.style.transform = `translateX(${shift}px)`;
  }, () => {
    observer.disconnect();
    done();
  });
  return () => {
    observer.disconnect();
    stop();
  };
}

export function animateRace(root: HTMLElement, race: Race, done: () => void) {
  const { phases } = race;
  const lanes = (['player', 'opponent'] as const).map((side) => {
    return {
      side,
      bar: root.querySelector<HTMLElement>(`[data-progress="${side}"]`),
      fill: root.querySelector<HTMLElement>(`[data-progress="${side}"] .progress-fill`),
      label: root.querySelector<HTMLElement>(`[data-percent="${side}"]`),
      previousValue: -1,
    };
  });

  return animate(raceDuration, (elapsed) => {
    const phase = elapsed / raceDuration * (phases.length - 1);
    const index = Math.floor(phase);
    const from = phases[index];
    const to = phases[index + 1] ?? from;
    const fraction = phase - index;
    for (const lane of lanes) {
      const value = from[lane.side] + (to[lane.side] - from[lane.side]) * fraction;
      if (lane.fill) lane.fill.style.width = `${value}%`;
      const display = Math.floor(value);
      if (display !== lane.previousValue) {
        lane.bar?.setAttribute('aria-valuenow', String(display));
        if (lane.label) lane.label.textContent = `${display}%`;
        lane.previousValue = display;
      }
    }
  }, done);
}
