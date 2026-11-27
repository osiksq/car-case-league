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

type SoundName = 'button' | 'case-select' | 'car-select' | 'coins' | 'sale' | 'league' | 'victory' | 'defeat';
type RaceOutcome = { outcome: 'victory' | 'defeat'; coins?: boolean; league?: boolean };
type UiCue = SoundName | { reward: Rarity } | RaceOutcome;
type Sample = readonly [file: string, level: number];

const effectsBank: Record<SoundName, Sample> = {
  button: ['ui-button', .48],
  'case-select': ['case-select', .55],
  'car-select': ['ui-car-select', .61],
  coins: ['ui-coins', .73],
  sale: ['ui-sale', .78],
  league: ['ui-league', .83],
  victory: ['victory', .83],
  defeat: ['defeat', .70],
};
const rewards: Record<Rarity, Sample> = {
  Common: ['reward-common', .75],
  Uncommon: ['reward-uncommon', .75],
  Rare: ['reward-rare', .76],
  Epic: ['reward-epic', .77],
  Legendary: ['reward-legendary', .77],
  Mythic: ['reward-mythic', .77],
  Exotic: ['reward-exotic', .76],
};
const raceSamples = {
  countdown: ['countdown', .60],
  go: ['go', .82],
  ignition: ['ignition', .50],
  shift: ['shift', .63],
  pass: ['pass', .71],
  tires: ['tires', .50],
  finish: ['finish', .79],
} satisfies Record<string, Sample>;
const caseSamples = {
  open: ['case-open', .75],
  latch: ['case-latch', .49],
  rise: ['reel-rise', .62],
  tick: ['reel-tick', .51],
  settle: ['reel-stop', .77],
} satisfies Record<string, Sample>;

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  engine: GainNode;
  effects: GainNode;
  samples: Map<string, AudioBuffer | Promise<AudioBuffer | null> | null>;
}

interface Scope { active: boolean }
interface Voice { scope: Scope; stop(): void }
interface Motor {
  scope: Scope;
  update(pace: number): void;
  shift(): void;
  stop(finish?: boolean): void;
}

function engineProfile(car: Car) {
  if (car.rarity === 'Mythic' || car.class === 'Exotic') return { file: 'engine-hyper', base: .77, range: .67, gain: .75 };
  if (car.rarity === 'Common' || car.class === 'Classic' || car.class === 'Collector') {
    return { file: 'engine-vintage', base: .81, range: .49, gain: .81 };
  }
  return { file: 'engine-sport', base: .78, range: .60, gain: .78 };
}

class GameAudio {
  private settings = normalizeAudioSettings(defaultAudioSettings);
  private graph: AudioGraph | undefined;
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<SoundName, number>();
  private readonly uiScope: Scope = { active: true };
  private readonly voiceLimit = globalThis.matchMedia?.('(pointer: coarse)').matches ? 8 : 12;
  private motor: Motor | undefined;
  private visible = typeof document === 'undefined' || !document.hidden;
  private resuming: Promise<void> | undefined;
  private effectsGeneration = 0;
  private engineGeneration = 0;

  configure(settings: AudioSettings): void {
    this.settings = normalizeAudioSettings(settings);
    this.updateMixer();
    if (!this.settings.enabled || this.settings.master === 0) {
      this.stopAll();
      return;
    }
    if (this.settings.engine === 0) {
      this.engineGeneration++;
      this.stopMotor();
    }
    if (this.settings.effects === 0) {
      this.effectsGeneration++;
      this.stopVoices();
    }
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
          limiter.threshold.value = -13;
          limiter.ratio.value = 4;
          limiter.attack.value = .008;
          limiter.release.value = .18;
          engine.connect(master);
          effects.connect(master);
          master.connect(limiter);
          limiter.connect(context.destination);
          this.graph = { context, master, engine, effects, samples: new Map() };
          this.updateMixer();
          this.warm([effectsBank.button, effectsBank['case-select'], raceSamples.countdown, raceSamples.go]);
        } catch {
          void context.close().catch(() => {});
          return;
        }
      } catch {
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

  private load(graph: AudioGraph, file: string): AudioBuffer | Promise<AudioBuffer | null> | null {
    if (!graph.samples.has(file)) {
      const pending = fetch(`${import.meta.env.BASE_URL}audio/${file}.mp3`)
        .then((response) => {
          if (!response.ok) throw new Error('Audio sample unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => graph.context.decodeAudioData(bytes))
        .catch(() => null)
        .then((buffer) => {
          graph.samples.set(file, buffer);
          return buffer;
        });
      graph.samples.set(file, pending);
      return pending;
    }
    return graph.samples.get(file) ?? null;
  }

  private warm(samples: readonly Sample[]): void {
    const graph = this.graph;
    if (!graph || !this.settings.enabled) return;
    for (const [file] of samples) this.load(graph, file);
  }

  play(cue: UiCue): void {
    const graph = this.activeGraph();
    if (!graph || this.settings.effects === 0) return;
    if (typeof cue === 'string') {
      const now = graph.context.currentTime;
      if (now - (this.lastPlayed.get(cue) ?? -Infinity) < .08) return;
      this.lastPlayed.set(cue, now);
      this.sample(this.uiScope, effectsBank[cue]);
      if (cue === 'case-select') this.warm(Object.values(caseSamples));
    } else if ('reward' in cue) {
      this.sample(this.uiScope, rewards[cue.reward]);
    } else {
      this.sample(this.uiScope, effectsBank[cue.outcome]);
      if (cue.coins) this.sample(this.uiScope, effectsBank.coins, .47);
      if (cue.league) this.sample(this.uiScope, effectsBank.league, cue.coins ? .78 : .50);
    }
  }

  race(car: Car): { cue(event: RaceCue): void; stop(): void } {
    const scope: Scope = { active: true };
    const profile = engineProfile(car);
    let driving = false;
    let loading = false;
    let pace = 0;
    this.warm([...Object.values(raceSamples), effectsBank.victory, effectsBank.defeat, effectsBank.coins, effectsBank.league, [profile.file, 1]]);

    const runMotor = () => {
      const graph = this.activeGraph();
      if (!graph || !driving || !scope.active || this.settings.engine === 0 || loading) return;
      if (this.motor?.scope === scope) {
        this.motor.update(pace);
        return;
      }
      const buffer = this.load(graph, profile.file);
      if (!buffer) return;
      const generation = this.engineGeneration;
      if (buffer instanceof Promise) {
        loading = true;
        void buffer.then((loaded) => {
          loading = false;
          if (loaded && generation === this.engineGeneration && scope.active && driving
            && this.activeGraph() === graph && this.settings.engine > 0) {
            this.startMotor(graph, scope, profile, loaded).update(pace);
          }
        });
      } else {
        this.startMotor(graph, scope, profile, buffer).update(pace);
      }
    };

    return {
      cue: (event) => {
        if (!scope.active) return;
        switch (event.type) {
          case 'countdown':
            this.sample(scope, raceSamples.countdown);
            break;
          case 'start':
            driving = true;
            pace = .20;
            this.sample(scope, raceSamples.go);
            this.sample(scope, raceSamples.ignition, .035);
            runMotor();
            break;
          case 'engine':
            pace = event.pace;
            runMotor();
            break;
          case 'shift':
            if (this.motor?.scope === scope) this.motor.shift();
            this.sample(scope, raceSamples.shift);
            break;
          case 'overtake':
            this.sample(scope, raceSamples.pass);
            this.sample(scope, raceSamples.tires, .02);
            break;
          case 'finish':
            driving = false;
            if (this.motor?.scope === scope) this.stopMotor(true);
            this.sample(scope, raceSamples.finish);
            break;
        }
      },
      stop: () => {
        scope.active = false;
        this.stopVoices(scope);
        if (this.motor?.scope === scope) this.stopMotor();
      },
    };
  }

  reel(): { cue(event: ReelCue): void; stop(): void } {
    const motion: Scope = { active: true };
    const landing: Scope = { active: true };
    let lastTick = -Infinity;
    let riseGeneration = -1;
    this.warm([...Object.values(caseSamples), ...Object.values(rewards)]);
    this.sample(motion, caseSamples.open);
    return {
      cue: (event) => {
        if (!motion.active) return;
        if (event === 'settle') {
          motion.active = false;
          this.stopVoices(motion);
          this.sample(landing, caseSamples.settle);
        } else if (event === 'mechanism') {
          this.sample(motion, caseSamples.latch, .07);
        } else if (event === 'tick') {
          const now = this.activeGraph()?.context.currentTime;
          if (now === undefined || now - lastTick < .061) return;
          lastTick = now;
          this.sample(motion, caseSamples.tick, 0, .10);
        } else if (riseGeneration !== this.effectsGeneration && this.activeGraph() && this.settings.effects > 0) {
          riseGeneration = this.effectsGeneration;
          this.sample(motion, caseSamples.rise, 0, 3.8, event.elapsed / 1_000);
        }
      },
      stop: () => {
        motion.active = false;
        landing.active = false;
        this.stopVoices(motion);
        this.stopVoices(landing);
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

  private sample(scope: Scope, [file, level]: Sample, delay = 0, tolerance = .28, offset?: number): void {
    const graph = this.activeGraph();
    if (!graph || !scope.active || this.settings.effects === 0) return;
    const generation = this.effectsGeneration;
    const when = graph.context.currentTime + delay;
    const resource = this.load(graph, file);
    const play = (buffer: AudioBuffer | null) => {
      if (!buffer || !scope.active || this.activeGraph() !== graph || generation !== this.effectsGeneration) return;
      const { context, effects } = graph;
      if (context.currentTime - when > tolerance) return;
      const startOffset = offset === undefined ? 0 : offset + Math.max(0, context.currentTime - when);
      if (startOffset >= buffer.duration) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = level;
      source.connect(gain);
      gain.connect(effects);
      const cleanup = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
      };
      const voice: Voice = { scope, stop: () => {
        source.onended = null;
        source.stop();
        cleanup();
      } };
      source.onended = cleanup;
      if (this.voices.size >= this.voiceLimit) this.voices.values().next().value?.stop();
      this.voices.add(voice);
      source.start(Math.max(when, context.currentTime), startOffset);
    };
    if (resource instanceof Promise) void resource.then(play);
    else play(resource);
  }

  private startMotor(graph: AudioGraph, scope: Scope, profile: ReturnType<typeof engineProfile>, buffer: AudioBuffer): Motor {
    this.stopMotor();
    const { context, engine } = graph;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = profile.base;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1800;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(engine);
    source.start();
    const cleanup = () => {
      source.disconnect();
      lowpass.disconnect();
      gain.disconnect();
      if (this.motor?.scope === scope) this.motor = undefined;
    };
    let shiftTime = -Infinity;
    let fading = false;
    const motor: Motor = {
      scope,
      shift: () => { shiftTime = context.currentTime; },
      update: (pace) => {
        const now = context.currentTime;
        const throttle = Math.max(0, Math.min(1, pace));
        const dip = Math.max(0, 1 - (now - shiftTime) / .25);
        source.playbackRate.setTargetAtTime(profile.base + throttle * profile.range - .19 * dip, now, .065);
        lowpass.frequency.setTargetAtTime(1250 + throttle * 5000, now, .10);
        gain.gain.setTargetAtTime(profile.gain * (.47 + throttle * .53 - .22 * dip), now, .08);
      },
      stop: (finish) => {
        if (finish && !fading) {
          fading = true;
          const now = context.currentTime;
          gain.gain.setTargetAtTime(0, now, .075);
          source.onended = cleanup;
          source.stop(now + .34);
        } else {
          source.onended = null;
          source.stop();
          cleanup();
        }
      },
    };
    this.motor = motor;
    return motor;
  }

  private stopMotor(finish = false): void {
    this.motor?.stop(finish);
    if (!finish) this.motor = undefined;
  }

  private stopVoices(scope?: Scope): void {
    for (const voice of this.voices) {
      if (!scope || voice.scope === scope) voice.stop();
    }
  }

  private stopAll(): void {
    this.engineGeneration++;
    this.effectsGeneration++;
    this.stopMotor();
    this.stopVoices();
  }
}

export const audio = new GameAudio();
