import type { Car, Rarity } from '../game/config';
import type { ReelCue } from './animation';
import type { RaceCue } from './race-scene';

export interface AudioSettings {
  enabled: boolean;
  master: number;
  engine: number;
  effects: number;
}

export const defaultAudioSettings: Readonly<AudioSettings> = Object.freeze({
  enabled: true,
  master: 72,
  engine: 60,
  effects: 70,
});

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const saved = typeof value === 'object' && value !== null ? value as Partial<AudioSettings> : {};
  const volume = (key: 'master' | 'engine' | 'effects') => {
    const level = saved[key];
    return typeof level === 'number' && Number.isFinite(level)
      ? Math.round(Math.max(0, Math.min(level, 100)))
      : defaultAudioSettings[key];
  };
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaultAudioSettings.enabled,
    master: volume('master'),
    engine: volume('engine'),
    effects: volume('effects'),
  };
}

type SoundName = 'button' | 'case-select' | 'case-open' | 'car-select' | 'coins' | 'sale' | 'league' | 'victory' | 'defeat';
type RaceOutcome = { outcome: 'victory' | 'defeat'; coins?: boolean; league?: boolean };
type UiCue = SoundName | { reward: Rarity } | RaceOutcome;
type Note = readonly [frequency: number, duration: number, gain: number, at?: number, endFrequency?: number, wave?: OscillatorType];

const effects: Record<SoundName, readonly Note[]> = {
  button: [[520, .052, .12, 0, 380, 'triangle']],
  'case-select': [[370, .09, .13, 0, 580, 'triangle'], [740, .08, .08, .042]],
  'case-open': [[82, .18, .17, 0, 39, 'triangle'], [235, .09, .08, .045, 118]],
  'car-select': [[392, .09, .13, 0, 480, 'triangle'], [650, .11, .07, .058]],
  coins: [[932, .115, .09], [1245, .124, .10, .09]],
  sale: [[245, .098, .10, 0, 172, 'triangle'], [830, .13, .12, .06], [1108, .15, .09, .12]],
  league: [[330, .21, .13, 0, 330, 'triangle'], [495, .21, .14, .11], [660, .28, .11, .22], [990, .38, .085, .33]],
  victory: [[392, .17, .14, 0, 440, 'triangle'], [523, .22, .13, .12], [659, .29, .15, .23], [1047, .27, .065, .27]],
  defeat: [[330, .23, .13, 0, 310, 'triangle'], [247, .30, .13, .12, 218], [147, .29, .08, .23]],
};

const rewardEffects: Record<Rarity, readonly Note[]> = {
  Common: [[420, .14, .16, 0, 520, 'triangle']],
  Uncommon: [[392, .13, .16, 0, 440, 'triangle'], [659, .19, .10, .09]],
  Rare: [[294, .17, .15, 0, 330, 'triangle'], [440, .18, .11, .085], [587, .25, .12, .18]],
  Epic: [[165, .28, .18, 0, 124, 'triangle'], [330, .21, .12, .10], [494, .21, .12, .19], [740, .37, .12, .27]],
  Legendary: [[110, .40, .19, 0, 69, 'triangle'], [330, .28, .12, .075], [440, .30, .13, .17], [660, .38, .13, .25], [880, .44, .075, .31]],
  Mythic: [[82, .55, .22, 0, 49, 'triangle'], [220, .35, .12, .095, 440, 'triangle'], [523, .36, .12, .20],
    [784, .37, .13, .31], [1175, .48, .11, .41], [1568, .46, .07, .50]],
};
const promotionTail: readonly Note[] = [[660, .25, .13], [990, .35, .09, .15]];

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  engine: GainNode;
  effects: GainNode;
  noise?: AudioBuffer;
}

interface Voice {
  scope: symbol;
  stop(): void;
}

interface Motor {
  scope: symbol;
  update(pace: number): void;
  shift(): void;
  stop(): void;
}

const vintage = { base: 29, climb: 57, filter: 115, brightness: 465, harmonic: 2, level: .19 };
const sport = { base: 41, climb: 82, filter: 162, brightness: 700, harmonic: 2, level: .15 };
const hyper = { base: 49, climb: 106, filter: 205, brightness: 900, harmonic: 3, level: .13 };

function engineProfile(car: Car) {
  if (car.rarity === 'Mythic' || car.class === 'Exotic') return hyper;
  if (car.rarity === 'Common' || car.class === 'Classic' || car.class === 'Collector') return vintage;
  return sport;
}

class GameAudio {
  private settings = normalizeAudioSettings(defaultAudioSettings);
  private graph: AudioGraph | undefined;
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<string, number>();
  private readonly uiScope = Symbol('interface');
  private readonly voiceLimit = globalThis.matchMedia?.('(pointer: coarse)').matches ? 8 : 13;
  private motor: Motor | undefined;
  private visible = typeof document === 'undefined' || !document.hidden;
  private resuming: Promise<void> | undefined;

  configure(settings: AudioSettings): void {
    this.settings = normalizeAudioSettings(settings);
    this.updateMixer();
    if (!this.settings.enabled || this.settings.master === 0) {
      this.stopAll();
      return;
    }
    if (this.settings.engine === 0) this.stopMotor();
    if (this.settings.effects === 0) this.stopVoices();
  }

  unlock(): void {
    if (!this.settings.enabled || !this.visible) return;
    if (!this.graph || this.graph.context.state === 'closed') {
      try {
        const Constructor = globalThis.AudioContext
          ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        const context = new Constructor();
        try {
          const master = context.createGain();
          const engine = context.createGain();
          const effects = context.createGain();
          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -15;
          limiter.ratio.value = 4;
          limiter.attack.value = .008;
          limiter.release.value = .18;
          engine.connect(master);
          effects.connect(master);
          master.connect(limiter);
          limiter.connect(context.destination);
          this.graph = { context, master, engine, effects };
          this.updateMixer();
        } catch {
          void context.close().catch(() => {});
          return;
        }
      } catch {
        // The game remains usable when audio creation is blocked or unsupported.
        return;
      }
    }
    this.resume(true);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) {
      this.resume();
      return;
    }
    this.stopAll();
    this.lastPlayed.clear();
    const context = this.graph?.context;
    if (context && context.state !== 'closed') {
      void context.suspend().then(() => {
        if (this.visible) this.resume();
      }).catch(() => {});
    }
  }

  play(cue: UiCue): void {
    const graph = this.activeGraph();
    if (!graph || this.settings.effects === 0) return;
    if (typeof cue === 'string') {
      if (!this.allow(cue, graph.context.currentTime, .08)) return;
      this.notes(graph, this.uiScope, effects[cue]);
    } else if ('reward' in cue) {
      this.notes(graph, this.uiScope, rewardEffects[cue.reward]);
    } else {
      this.notes(graph, this.uiScope, effects[cue.outcome]);
      if (cue.coins) this.notes(graph, this.uiScope, effects.coins, .48);
      if (cue.league) this.notes(graph, this.uiScope, cue.coins ? promotionTail : effects.league, cue.coins ? .73 : .50);
    }
  }

  race(car: Car): { cue(event: RaceCue): void; stop(): void } {
    const scope = Symbol('race');
    let driving = false;
    let stopped = false;
    return {
      cue: (event) => {
        if (stopped) return;
        if (event.type === 'start') driving = true;
        if (event.type === 'finish') {
          driving = false;
          if (this.motor?.scope === scope) this.stopMotor();
        }
        const graph = this.activeGraph();
        if (!graph) return;
        const hasEffects = this.settings.effects > 0;
        switch (event.type) {
          case 'countdown':
            if (hasEffects) this.notes(graph, scope, [[330, .15, .24]]);
            break;
          case 'start':
            if (hasEffects) this.notes(graph, scope, [[495, .23, .29, 0, 660]]);
            if (this.settings.engine > 0) this.startMotor(graph, car, scope).update(.22);
            break;
          case 'engine':
            if (!driving || this.settings.engine === 0) break;
            if (this.motor?.scope !== scope) this.startMotor(graph, car, scope);
            this.motor?.update(event.pace);
            break;
          case 'shift':
            if (this.motor?.scope === scope) this.motor.shift();
            if (hasEffects) {
              this.notes(graph, scope, [[160, .12, .13, 0, 66, 'triangle']]);
              this.hiss(graph, scope, .11, .14, 760, 150);
            }
            break;
          case 'overtake':
            if (hasEffects) {
              this.notes(graph, scope, [[270, .25, .12, 0, 90, 'triangle']]);
              this.hiss(graph, scope, .23, .22, 1420, 290);
            }
            break;
          case 'finish':
            if (hasEffects) this.notes(graph, scope, [[392, .15, .15], [523, .26, .17, .12]]);
            break;
        }
      },
      stop: () => {
        stopped = true;
        this.stopVoices(scope);
        if (this.motor?.scope === scope) this.stopMotor();
      },
    };
  }

  reel(): { cue(event: ReelCue): void; stop(): void } {
    const scope = Symbol('roulette');
    let lastTick = -Infinity;
    let stopped = false;
    const graph = this.activeGraph();
    if (graph && this.settings.effects > 0) this.notes(graph, scope, effects['case-open']);
    return {
      cue: (event) => {
        const graph = this.activeGraph();
        if (stopped || !graph || this.settings.effects === 0) return;
        switch (event) {
          case 'mechanism':
            this.notes(graph, scope, [[150, .135, .19, 0, 80, 'triangle'], [720, .08, .095, .04, 260]]);
            this.hiss(graph, scope, .21, .18, 490, 130);
            break;
          case 'tick': {
            const now = graph.context.currentTime;
            if (now - lastTick < .060) break;
            lastTick = now;
            this.notes(graph, scope, [[610, .058, .085, 0, 320, 'triangle']]);
            break;
          }
          case 'settle':
            this.notes(graph, scope, [[138, .156, .24, 0, 59, 'triangle'], [820, .085, .13, .025, 300]]);
            this.hiss(graph, scope, .095, .14, 520, 180);
            break;
        }
      },
      stop: () => {
        stopped = true;
        this.stopVoices(scope);
      },
    };
  }

  private activeGraph(): AudioGraph | undefined {
    if (this.visible && this.settings.enabled && this.settings.master > 0
      && this.graph?.context.state === 'running') return this.graph;
  }

  private resume(fromGesture = false): void {
    const context = this.graph?.context;
    if (!this.visible || !this.settings.enabled || !context || (this.resuming && !fromGesture)
      || context.state === 'running' || context.state === 'closed') return;
    const pending = context.resume().catch(() => {});
    this.resuming = pending;
    void pending.then(() => {
      if (this.resuming === pending) this.resuming = undefined;
    });
  }

  private updateMixer(): void {
    const graph = this.graph;
    if (!graph || graph.context.state === 'closed') return;
    for (const channel of ['master', 'engine', 'effects'] as const) {
      const param = graph[channel].gain;
      const now = graph.context.currentTime;
      const gain = this.settings.enabled ? this.settings[channel] / 100 : 0;
      param.cancelScheduledValues(now);
      if (!gain || graph.context.state !== 'running') param.setValueAtTime(gain, now);
      else param.setTargetAtTime(gain, now, .016);
    }
  }

  private allow(cue: string, now: number, gap: number): boolean {
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < gap) return false;
    this.lastPlayed.set(cue, now);
    return true;
  }

  private limitVoices(): void {
    if (this.voices.size >= this.voiceLimit) this.voices.values().next().value?.stop();
  }

  private schedule(
    graph: AudioGraph, scope: symbol, source: AudioScheduledSourceNode, nodes: AudioNode[], at: number, duration: number,
  ): void {
    const cleanup = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
    const voice: Voice = { scope, stop: () => {
      source.onended = null;
      source.stop();
      cleanup();
    } };
    source.onended = cleanup;
    this.limitVoices();
    this.voices.add(voice);
    source.start(graph.context.currentTime + at);
    source.stop(graph.context.currentTime + at + duration);
  }

  private notes(graph: AudioGraph, scope: symbol, notes: readonly Note[], delay = 0): void {
    for (const [frequency, duration, level, offset = 0, end = frequency, wave = 'sine'] of notes) {
      const { context, effects } = graph;
      const at = offset + delay;
      const time = context.currentTime + at;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
      envelope.gain.value = .001;
      envelope.gain.setValueAtTime(.001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + .013);
      envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
      oscillator.connect(envelope);
      envelope.connect(effects);
      this.schedule(graph, scope, oscillator, [envelope], at, duration);
    }
  }

  private hiss(graph: AudioGraph, scope: symbol, duration: number, level: number, from: number, to: number): void {
    const { context, effects } = graph;
    const time = context.currentTime;
    if (!graph.noise) {
      graph.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .32), context.sampleRate);
      const samples = graph.noise.getChannelData(0);
      // Fixed seed gives a consistent original noise bed on every device.
      let seed = 0x28ff6e7;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 0x80000000 - 1;
      }
    }
    const source = context.createBufferSource();
    source.buffer = graph.noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = .75;
    filter.frequency.setValueAtTime(from, time);
    filter.frequency.exponentialRampToValueAtTime(to, time + duration);
    const envelope = context.createGain();
    envelope.gain.value = .001;
    envelope.gain.setValueAtTime(.001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(effects);
    this.schedule(graph, scope, source, [filter, envelope], 0, duration);
  }

  private startMotor(graph: AudioGraph, car: Car, scope: symbol): Motor {
    this.stopMotor();
    const { context, engine } = graph;
    const profile = engineProfile(car);
    const base = context.createOscillator();
    base.type = 'sawtooth';
    base.frequency.value = profile.base;
    const harmonic = context.createOscillator();
    harmonic.type = car.class === 'Muscle' ? 'sine' : 'triangle';
    harmonic.frequency.value = profile.base * profile.harmonic;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = profile.filter;
    const envelope = context.createGain();
    envelope.gain.value = 0;
    base.connect(filter);
    harmonic.connect(filter);
    filter.connect(envelope);
    envelope.connect(engine);
    base.start();
    harmonic.start();
    let shiftedAt = -Infinity;
    const motor: Motor = {
      scope,
      shift: () => { shiftedAt = context.currentTime; },
      update: (pace) => {
        const now = context.currentTime;
        const throttle = Math.max(0, Math.min(1, pace));
        const dip = Math.max(0, 1 - (now - shiftedAt) / .19);
        const pitch = profile.base + throttle * profile.climb - 18 * dip;
        base.frequency.setTargetAtTime(pitch, now, .058);
        harmonic.frequency.setTargetAtTime(pitch * profile.harmonic, now, .064);
        filter.frequency.setTargetAtTime(profile.filter + profile.brightness * throttle, now, .075);
        envelope.gain.setTargetAtTime(profile.level * (.42 + throttle * .55 - .24 * dip), now, .057);
      },
      stop: () => {
        base.stop();
        harmonic.stop();
        base.disconnect();
        harmonic.disconnect();
        filter.disconnect();
        envelope.disconnect();
      },
    };
    this.motor = motor;
    return motor;
  }

  private stopMotor(): void {
    this.motor?.stop();
    this.motor = undefined;
  }

  private stopVoices(scope?: symbol): void {
    for (const voice of this.voices) {
      if (scope === undefined || voice.scope === scope) voice.stop();
    }
  }

  private stopAll(): void {
    this.stopMotor();
    this.stopVoices();
  }
}

export const audio = new GameAudio();
