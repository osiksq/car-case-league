import '../race-scene.css';
import { events, type Car, type EventId } from '../game/config';
import type { RacePhase, RaceResult } from '../game/race';
import { runForegroundAnimation } from './animation-clock';
import { escapeHtml } from './components';
import { useCarImage } from './race-car-art';

type Side = keyof RacePhase;

export type RaceCue =
  | { type: 'countdown'; count: 3 | 2 | 1 }
  | { type: 'start' | 'shift' | 'overtake' | 'finish' }
  | { type: 'engine'; pace: number };

export const raceSceneTiming = { countdown: 3_000, finishHold: 1_080 };
const { countdown, finishHold } = raceSceneTiming;
const playerColor = '#cbf96e';
const rivalColor = '#a8c0ff';
const TAU = 2 * Math.PI;
const shiftTimes = [.14, .29, .53, .76];

interface Track {
  duration: number;
  sky: string;
  glow: string;
  landscape: string;
  asphalt: string;
  shoulder: string;
  curb: string;
  lights: string;
  curve: number;
  rhythm: number;
}

const tracks: Record<EventId, Track> = {
  drag: { duration: 8_900, sky: '#140d25', glow: '#483047', landscape: '#171324', asphalt: '#191b27', shoulder: '#302431', curb: '#ff6b8c', lights: '#fbb5a8', curve: 0, rhythm: 1 },
  circuit: { duration: 11_800, sky: '#15172a', glow: '#5c3b39', landscape: '#21202a', asphalt: '#24262f', shoulder: '#282d2b', curb: '#ed6860', lights: '#ffd5a1', curve: .095, rhythm: 1.55 },
  'wet-circuit': { duration: 13_000, sky: '#0b172a', glow: '#254758', landscape: '#182d3b', asphalt: '#233444', shoulder: '#182c39', curb: '#5fb0ce', lights: '#a6e7ff', curve: .095, rhythm: 1.35 },
  endurance: { duration: 16_500, sky: '#101d2b', glow: '#334b54', landscape: '#172e36', asphalt: '#252a30', shoulder: '#283537', curb: '#d7b873', lights: '#ffdd9a', curve: .057, rhythm: .78 },
};

export function raceSceneMarkup(race: RaceResult, player: Car, opponent: Car): string {
  const title = escapeHtml(events[race.eventId].name);
  const trackImage = (car: Car, side: Side) =>
    `<img hidden data-scene-car="${side}" data-art-index="${car.artIndex}" src="${import.meta.env.BASE_URL}cars/${car.artIndex}.webp" alt="">`;
  return `<section class="race-scene panel" data-race-scene="${race.eventId}" data-race-status="countdown"
    data-player-progress="0" data-opponent-progress="0" aria-label="${title} live race">
    <div class="race-scene-stage">
      <canvas data-race-canvas role="img" aria-label="${escapeHtml(player.name)} and ${escapeHtml(opponent.name)} on the ${title} track"></canvas>
      ${trackImage(player, 'player')}${trackImage(opponent, 'opponent')}
      <div class="race-scene-overlay">
        <span class="race-scene-session">${title}</span>
        <span aria-hidden="true" class="race-scene-clock" data-race-clock>0:00.00</span>
      </div>
      <div aria-hidden="true" class="race-scene-callout" data-race-callout>3</div>
      <p class="race-scene-reader" data-race-announcement role="status">Race starts in three seconds.</p>
    </div>
    <div class="race-scene-legend">
      <div><span class="race-scene-dot race-scene-dot-player" aria-hidden="true"></span><span><small>You</small><strong>${escapeHtml(player.name)}</strong></span></div>
      <span class="race-scene-phase" data-race-stage-label>Starting grid</span>
      <div><span><small>Rival</small><strong>${escapeHtml(opponent.name)}</strong></span><span class="race-scene-dot race-scene-dot-rival" aria-hidden="true"></span></div>
    </div>
  </section>`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function monotoneSlope(left: number, right: number): number {
  return left > 0 && right > 0 ? 2 * left * right / (left + right) : 0;
}

export function sampleRaceProgress(phases: readonly RacePhase[], side: Side, ratio: number): number {
  const position = clamp(ratio, 0, 1) * (phases.length - 1);
  const index = Math.floor(position);
  const from = phases[index][side];
  const to = phases[index + 1]?.[side];
  if (to === undefined) return from;
  const fraction = position - index;
  const speed = to - from;
  const before = phases[index - 1]?.[side];
  const after = phases[index + 2]?.[side];
  const begin = before === undefined ? speed : monotoneSlope(from - before, speed);
  const end = after === undefined ? speed : monotoneSlope(speed, after - to);
  return from + fraction * (begin + fraction * (3 * speed - 2 * begin - end + fraction * (begin + end - 2 * speed)));
}

function clockText(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor(ms / 1_000) % 60;
  const decimal = Math.floor(ms / 10) % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(decimal).padStart(2, '0')}`;
}

interface Frame {
  age: number;
  playhead: number;
  player: number;
  opponent: number;
  finished: number;
}

function canvasBudget(width: number, height: number) {
  const narrow = width < 600;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const constrained = navigator.hardwareConcurrency <= 4 || (memory !== undefined && memory <= 4);
  const lighter = narrow || constrained;
  const maxPixels = narrow ? 410_000 : constrained ? 750_000 : 1_520_000;
  const maxScale = narrow ? 1.4 : constrained ? 1.35 : 1.7;
  return {
    dpr: Math.min(window.devicePixelRatio || 1, maxScale, Math.sqrt(maxPixels / (width * height))),
    rain: narrow ? 24 : constrained ? 34 : 58,
    curveSamples: lighter ? 8 : 12,
    reflection: !constrained,
  };
}

function makePainter(canvas: HTMLCanvasElement, scene: HTMLElement, race: RaceResult, track: Track) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const ctx = context;
  const playerImage = useCarImage(scene.querySelector('[data-scene-car="player"]'));
  const rivalImage = useCarImage(scene.querySelector('[data-scene-car="opponent"]'));
  const wet = race.eventId === 'wet-circuit';
  const drag = race.eventId === 'drag';
  const endurance = race.eventId === 'endurance';
  let width = 1;
  let height = 1;
  let budget = canvasBudget(width, height);
  let sky: CanvasGradient;
  let asphalt: CanvasGradient;
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    budget = canvasBudget(width, height);
    const pixelWidth = Math.max(1, Math.round(width * budget.dpr));
    const pixelHeight = Math.max(1, Math.round(height * budget.dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);

    sky = ctx.createLinearGradient(0, 0, 0, height * .62);
    sky.addColorStop(0, track.sky);
    sky.addColorStop(.76, track.glow);
    sky.addColorStop(1, track.landscape);
    asphalt = ctx.createLinearGradient(0, height * .43, 0, height);
    asphalt.addColorStop(0, track.asphalt);
    asphalt.addColorStop(.75, wet ? '#182634' : '#1b2028');
    asphalt.addColorStop(1, wet ? '#23394c' : '#10141a');
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let turn = 0;
  let curveOffset = 0;
  const view = {
    camera: 0,
    center: (x: number) => height * .645 + track.curve * height * (.7 * Math.sin(turn + (x / width - .5) * 2.8) + curveOffset),
  };

  type View = typeof view;
  function stripe(view: View, color: string | CanvasGradient, top: number, bottom: number, start = 0, end = width) {
    const length = end - start;
    const sampleCount = clamp(Math.ceil(length / 105), 2, budget.curveSamples);
    ctx.beginPath();
    ctx.moveTo(start, view.center(start) + top);
    for (let index = 1; index <= sampleCount; index++) {
      const x = start + length * index / sampleCount;
      ctx.lineTo(x, view.center(x) + top);
    }
    for (let index = sampleCount; index >= 0; index--) {
      const x = start + length * index / sampleCount;
      ctx.lineTo(x, view.center(x) + bottom);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function scenery(view: View, age: number) {
    const w = width;
    const h = height;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (endurance) {
      ctx.fillStyle = '#e5cfae';
      ctx.beginPath();
      ctx.arc(w * .76, h * .23, h * .037, 0, TAU);
      ctx.fill();
    }
    const ridgeCounts = drag ? 17 : 13;
    for (let layer = 0; layer < 2; layer++) {
      const size = w / 8;
      const shift = view.camera * (.12 + .1 * layer);
      const start = Math.floor(shift / size);
      ctx.fillStyle = layer === 0 ? track.landscape : endurance ? '#101e28' : wet ? '#121f2b' : '#191c27';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let index = 0; index < ridgeCounts; index++) {
        const x = (index + start - 2) * size - shift;
        const modifier = Math.sin((index + start) * 2.16 + layer * 1.95);
        const y = h * (.38 + layer * .06 + modifier * (drag ? .09 : .12));
        if (drag) {
          ctx.lineTo(x, y);
          ctx.lineTo(x + size, y);
        } else {
          ctx.lineTo(x + size * .5, y);
        }
      }
      ctx.lineTo(w + 2, h);
      ctx.closePath();
      ctx.fill();
    }

    const decorations = endurance ? 78 : 96;
    for (let index = -1; index <= Math.ceil(w / decorations); index++) {
      const shift = view.camera * (endurance ? .42 : .48);
      const x = index * decorations - shift % decorations;
      const base = view.center(x) - h * .13;
      if (endurance) {
        const variant = ((index + Math.floor(shift / decorations)) % 4 + 4) % 4;
        const tree = h * (.115 + variant * .023);
        ctx.fillStyle = variant % 2 ? '#122832' : '#1d363e';
        ctx.beginPath();
        ctx.moveTo(x, base - tree);
        ctx.lineTo(x + tree * .39, base);
        ctx.lineTo(x - tree * .39, base);
        ctx.fill();
      } else if (!drag) {
        const y = base - h * .115;
        ctx.fillStyle = wet ? '#283d4a' : '#3c3440';
        ctx.fillRect(x, y + h * .025, decorations * .89, h * .105);
        ctx.fillStyle = wet ? '#4f7486' : '#aa6f68';
        ctx.fillRect(x, y, decorations * .94, h * .014);
        ctx.fillStyle = wet ? '#456579' : '#756575';
        for (let row = 0; row < 3; row++) ctx.fillRect(x + 4, y + h * (.022 + row * .025), decorations * .82, 2);
      }
      if (drag || index % 2 === 0) {
        const y = base - h * (drag ? .22 : .24);
        ctx.fillStyle = wet ? '#334b56' : '#4b4653';
        ctx.fillRect(x, y, 3, base - y + 2);
        ctx.fillStyle = track.lights;
        ctx.globalAlpha = wet ? .72 : .9;
        ctx.fillRect(x - 11, y, 25, 3);
        ctx.globalAlpha = 1;
      }
    }
    if (drag) {
      const y = h * .34;
      const color = age >= countdown ? playerColor : '#ff8a75';
      ctx.fillStyle = '#171822';
      ctx.fillRect(w * .094 - view.camera * .08, y - 6, 11, h * .18);
      for (let index = 0; index < 3; index++) {
        ctx.fillStyle = color;
        ctx.globalAlpha = age >= index * 1_000 ? .87 : .24;
        ctx.fillRect(w * .094 - view.camera * .08 + 2, y + index * 9, 7, 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function road(view: View) {
    const halfRoad = height * .178;
    const edge = Math.max(3, height * .012);
    stripe(view, track.shoulder, -halfRoad - 15, halfRoad + 27);
    stripe(view, '#131820', -halfRoad - 7, halfRoad + 11);
    stripe(view, asphalt, -halfRoad, halfRoad);
    stripe(view, '#b9c4ca55', -halfRoad + 2, -halfRoad + 4);
    stripe(view, '#080c1266', halfRoad - 4, halfRoad - 1);
    const dash = clamp(width * .126, 46, 124);
    for (let index = -1; index <= Math.ceil(width / dash); index++) {
      const x = index * dash - view.camera % dash;
      stripe(view, wet ? '#bed6e185' : '#d8d7ceac', -1, 1.3, x, x + dash * .45);
      if (wet) {
        stripe(view, '#86c9fd24', -height * .094, -height * .077, x, x + dash * .64);
        stripe(view, '#82caff1e', height * .07, height * .086, x + 16, x + dash * .88);
      }
    }
    if (!drag && !endurance) {
      const step = clamp(width / 31, 17, 39);
      for (let index = -1; index <= Math.ceil(width / step); index++) {
        const x = index * step - view.camera % (step * 2);
        const color = index % 2 === 0 ? track.curb : '#c8d0d4';
        stripe(view, color, halfRoad - edge, halfRoad + edge * .24, x, x + step);
        stripe(view, color, -halfRoad - edge * .24, -halfRoad + edge, x, x + step);
      }
    } else {
      stripe(view, track.curb, halfRoad - 1, halfRoad + 2);
      stripe(view, track.curb, -halfRoad - 2, -halfRoad + 1);
    }
  }

  function finishLine(view: View, x: number) {
    const halfRoad = height * .175;
    const size = clamp(height * .034, 6, 13);
    for (let row = 0; row < Math.ceil(2 * halfRoad / size); row++) {
      const top = -halfRoad + row * size;
      const bottom = Math.min(halfRoad, top + size);
      stripe(view, row % 2 ? '#1a2028' : '#dce7ea', top, bottom, x, x + size);
      stripe(view, row % 2 ? '#dce7ea' : '#1a2028', top, bottom, x + size, x + size * 2);
    }
  }

  function car(view: View, x: number, lane: number, sprite: HTMLCanvasElement | undefined, color: string, progress: number, size: number) {
    if (!sprite) return;
    const y = view.center(x) + height * lane;
    const derivative = (view.center(x + 6) - view.center(x - 6)) / 12;
    const imageHeight = size * sprite.height / sprite.width;
    const top = -imageHeight * .83;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan(derivative) * .58);
    ctx.fillStyle = '#090b10a6';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * .42, size * .053, 0, 0, TAU);
    ctx.fill();
    if (wet && budget.reflection) {
      ctx.save();
      ctx.scale(-1, -.48);
      ctx.globalAlpha = .23;
      ctx.drawImage(sprite, -size / 2, top - 5, size, imageHeight);
      ctx.restore();
    }
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -size / 2, top, size, imageHeight);
    ctx.fillStyle = color;
    ctx.fillRect(-size * .058, 6, size * .116, 2);
    ctx.restore();
    if (wet && progress > 0) {
      ctx.fillStyle = '#acd7ec28';
      ctx.fillRect(x - size * .56, y - 2, size * .14, 2.7);
    }
  }

  function rain(frame: Frame) {
    if (!wet) return;
    const wind = frame.age * .22;
    const fall = frame.age * .53;
    ctx.beginPath();
    for (let index = 1; index <= budget.rain; index++) {
      const x = (index * 168.27 + wind) % (width + 22);
      const y = (index * 381.17 + fall) % (height + 26);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + (index % 3 + 1) * 7);
    }
    ctx.strokeStyle = '#b7d7ff54';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const paint = (frame: Frame) => {
    const best = Math.max(frame.player, frame.opponent);
    const progress = (frame.player + frame.opponent) / 2 + frame.finished / finishHold * 1.64;
    view.camera = progress * (drag ? 40 : endurance ? 29 : 34);
    turn = progress / 100 * TAU * track.rhythm;
    curveOffset = .31 * Math.sin(turn * 1.2);
    const carWidth = clamp(width * .24, 103, Math.min(height * .48, 225));
    const front = width * (.28 + .39 * Math.sin(Math.min(frame.playhead * 2.4, 1) * Math.PI / 2));
    const gap = Math.abs(frame.player - frame.opponent);
    const distance = Math.min(width * .45, width * (1 - Math.exp(-gap / 9)) * .47);
    const playerAhead = frame.player >= frame.opponent;
    const finishX = width * .67 + carWidth * .5;
    const coast = frame.finished / finishHold * Math.min(width * .15, 104);

    scenery(view, frame.age);
    road(view);
    if (best === 0) finishLine(view, front + carWidth * .55);
    if (best > 82) finishLine(view, finishX + width * (100 - best) * .047);
    car(view, front + carWidth * .045 - (playerAhead ? distance : 0) + (!playerAhead ? coast : 0), -.081, rivalImage(), rivalColor, frame.opponent, carWidth * .91);
    car(view, front - (playerAhead ? 0 : distance) + (playerAhead ? coast : 0), .105, playerImage(), playerColor, frame.player, carWidth);
    rain(frame);
  };
  return { paint, disconnect: () => observer.disconnect() };
}

export function raceSceneDuration(event: EventId): number {
  return raceSceneTiming.countdown + tracks[event].duration + raceSceneTiming.finishHold;
}

export function playRaceScene(root: HTMLElement, race: RaceResult, done: () => void, onCue?: (cue: RaceCue) => void) {
  const scene = root.querySelector<HTMLElement>('[data-race-scene]');
  const canvas = scene?.querySelector<HTMLCanvasElement>('[data-race-canvas]');
  if (!scene || !canvas) {
    return runForegroundAnimation(scene, () => true, done);
  }
  const track = tracks[race.eventId];
  const painter = makePainter(canvas, scene, race, track);
  const clock = scene.querySelector<HTMLElement>('[data-race-clock]');
  const callout = scene.querySelector<HTMLElement>('[data-race-callout]');
  const stageLabel = scene.querySelector<HTMLElement>('[data-race-stage-label]');
  const announcement = scene.querySelector<HTMLElement>('[data-race-announcement]');
  const end = countdown + track.duration;
  let lastCount = 0;
  let started = false;
  let finished = false;
  let lastUi = -100;
  let stage = '';
  let previousLeader: Side | undefined;
  let lastPass = -1_000;
  let nextShift = 0;
  let lastPaceProgress = 0;
  let enginePace = 0;
  let lastPaint = -1;
  const frame = { age: 0, playhead: 0, player: 0, opponent: 0, finished: 0 };

  const stop = runForegroundAnimation(scene, (age) => {
    const paintFrame = Math.floor(age * 60 / 1000);
    if (paintFrame === lastPaint && age < end + finishHold) return false;
    lastPaint = paintFrame;
    const timeOnTrack = age - countdown;
    const playhead = clamp(timeOnTrack / track.duration, 0, 1);
    const player = sampleRaceProgress(race.phases, 'player', playhead);
    const opponent = sampleRaceProgress(race.phases, 'opponent', playhead);
    const coast = clamp(age - end, 0, finishHold);
    const nextStage = playhead >= 1 ? 'finish' : playhead > 0 ? 'racing' : 'countdown';
    const transition = nextStage !== stage;

    if (transition) {
      scene.dataset.raceStatus = nextStage;
      stage = nextStage;
      if (stageLabel) stageLabel.textContent = stage === 'racing' ? 'On track' : stage === 'finish' ? 'Race complete' : 'Starting grid';
    }
    if (age < countdown) {
      const count = (3 - Math.floor(age / 1_000)) as 3 | 2 | 1;
      if (count !== lastCount) {
        if (callout) callout.textContent = String(count);
        lastCount = count;
        onCue?.({ type: 'countdown', count });
      }
    } else if (!started) {
      if (callout) callout.textContent = 'GO';
      if (announcement) announcement.textContent = 'Race started.';
      started = true;
      onCue?.({ type: 'start' });
    } else if (stage === 'racing' && timeOnTrack > 650 && callout?.textContent === 'GO') {
      callout.textContent = '';
    }

    if (started && !finished && playhead < 1) {
      const leader = Math.abs(player - opponent) > .15 ? player > opponent ? 'player' : 'opponent' : undefined;
      if (leader && previousLeader && leader !== previousLeader && timeOnTrack - lastPass >= 550) {
        if (stageLabel) stageLabel.textContent = leader === 'player' ? 'You take the lead' : 'Rival takes the lead';
        lastPass = timeOnTrack;
        onCue?.({ type: 'overtake' });
      } else if (stageLabel && lastPass >= 0 && timeOnTrack - lastPass > 1400 && stageLabel.textContent !== 'On track') {
        stageLabel.textContent = 'On track';
      }
      if (leader) previousLeader = leader;
      if (nextShift < shiftTimes.length && playhead >= shiftTimes[nextShift]) {
        do nextShift++; while (nextShift < shiftTimes.length && playhead >= shiftTimes[nextShift]);
        onCue?.({ type: 'shift' });
      }
    }

    if (age - lastUi >= 72 || playhead === 1 && !finished) {
      const aggregate = (player + opponent) / 2;
      const elapsed = Math.max(72, age - lastUi);
      const velocity = (aggregate - lastPaceProgress) / elapsed * track.duration / 100;
      enginePace += (clamp(velocity, 0, 1) - enginePace) * .34;
      if (started && playhead < 1) onCue?.({ type: 'engine', pace: clamp(.19 + enginePace * .65 + playhead * .13, 0, 1) });
      lastPaceProgress = aggregate;
      if (clock) clock.textContent = clockText(clamp(timeOnTrack, 0, track.duration));
      scene.dataset.playerProgress = player.toFixed(2);
      scene.dataset.opponentProgress = opponent.toFixed(2);
      lastUi = age;
    }
    if (playhead === 1 && !finished) {
      finished = true;
      scene.dataset.firstFinisher = player > opponent ? 'player' : 'opponent';
      if (callout) callout.textContent = 'FINISH';
      if (announcement) announcement.textContent = race.won ? 'You crossed the finish line first.' : 'The rival crossed the finish line first.';
      onCue?.({ type: 'finish' });
    }
    frame.age = age;
    frame.playhead = playhead;
    frame.player = player;
    frame.opponent = opponent;
    frame.finished = coast;
    painter?.paint(frame);
    return age >= end + finishHold;
  }, () => {
    painter?.disconnect();
    done();
  });
  return () => {
    stop();
    painter?.disconnect();
  };
}
