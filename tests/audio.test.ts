import { describe, expect, it, vi } from 'vitest';
import { audio, defaultAudioSettings, normalizeAudioSettings } from '../src/ui/audio';
import { cars } from '../src/game/config';

describe('audio settings', () => {
  it('normalizes saved settings per channel and ignores invalid values', () => {
    expect(normalizeAudioSettings(null)).toEqual(defaultAudioSettings);
    expect(normalizeAudioSettings({ enabled: false, master: 120, engine: -5, effects: Number.NaN })).toEqual({
      enabled: false,
      master: 100,
      engine: 0,
      effects: defaultAudioSettings.effects,
    });
    expect(normalizeAudioSettings({ enabled: 'false', master: '40' })).toEqual(defaultAudioSettings);
  });
});

describe('audio activation', () => {
  it('requires explicit activation and stays usable when the audio backend fails', () => {
    const constructor = vi.fn(function () { throw new Error('No audio output'); });
    vi.stubGlobal('AudioContext', constructor);
    try {
      audio.configure(defaultAudioSettings);
      audio.play('button');
      const race = audio.race(cars[0]);
      race.cue({ type: 'start' });
      expect(constructor).not.toHaveBeenCalled();
      expect(() => audio.unlock()).not.toThrow();
      expect(constructor).toHaveBeenCalledOnce();
      const reel = audio.reel();
      expect(() => reel.cue('mechanism')).not.toThrow();
      expect(() => { reel.stop(); race.stop(); }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cleans up scoped sounds on hide or stop and resumes only the current engine', async () => {
    const active = new Set<object>();
    const param = () => ({
      setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(), value: 0,
    });
    const sources: { frequency: ReturnType<typeof param> }[] = [];
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    const source = () => {
      const oscillator = {
        ...node(), frequency: param(),
        start: () => active.add(oscillator),
        stop: (time?: number) => { if (time === undefined) active.delete(oscillator); },
      };
      sources.push(oscillator);
      return oscillator;
    };
    const context = {
      state: 'running',
      currentTime: 1,
      sampleRate: 100,
      destination: node(),
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: source,
      createBufferSource: source,
      createBuffer: () => ({ getChannelData: () => new Float32Array(32) }),
      createBiquadFilter: () => ({ ...node(), Q: param(), frequency: param() }),
      createDynamicsCompressor: () => ({ ...node(), threshold: param(), ratio: param(), attack: param(), release: param() }),
      suspend: async () => { context.state = 'suspended'; },
      resume: async () => { context.state = 'running'; },
    };
    const Constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', Constructor);
    try {
      audio.unlock();
      audio.unlock();
      expect(Constructor).toHaveBeenCalledOnce();
      const race = audio.race(cars[0]);
      race.cue({ type: 'start' });
      expect(active.size).toBe(3);
      race.cue({ type: 'engine', pace: .8 });
      const targets = sources[1].frequency.setTargetAtTime.mock.calls.map(([frequency]) => frequency);
      expect(targets.at(-1)).toBeGreaterThan(targets[0]);
      audio.setVisible(false);
      expect(active.size).toBe(0);
      race.cue({ type: 'overtake' });
      expect(active.size).toBe(0);
      audio.setVisible(true);
      expect(active.size).toBe(0);
      race.cue({ type: 'engine', pace: .7 });
      expect(active.size).toBe(2);
      audio.configure({ ...defaultAudioSettings, enabled: false });
      expect(active.size).toBe(0);
      audio.configure(defaultAudioSettings);
      race.cue({ type: 'engine', pace: .8 });
      expect(active.size).toBe(2);
      race.stop();
      race.cue({ type: 'start' });
      expect(active.size).toBe(0);

      const reel = audio.reel();
      reel.cue('mechanism');
      for (let i = 0; i < 20; i++) reel.cue('tick');
      expect(active.size).toBe(6);
      reel.stop();
      expect(active.size).toBe(0);
    } finally {
      audio.setVisible(false);
      vi.unstubAllGlobals();
    }
  });
});
