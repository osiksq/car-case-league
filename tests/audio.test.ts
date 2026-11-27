import { describe, expect, it, vi } from 'vitest';
import { audio, defaultAudioSettings, normalizeAudioSettings } from '../src/ui/audio';
import { cars, rarities } from '../src/game/config';

describe('audio settings', () => {
  it('normalizes saved settings per channel and ignores invalid values', () => {
    expect(normalizeAudioSettings(null)).toEqual(defaultAudioSettings);
    expect(normalizeAudioSettings({ enabled: false, master: 120, engine: -5, effects: Number.NaN })).toEqual({
      enabled: false, master: 100, engine: 0, effects: defaultAudioSettings.effects,
    });
    expect(normalizeAudioSettings({ enabled: 'false', master: '40' })).toEqual(defaultAudioSettings);
  });

  it('requires activation and stays usable when creating the audio context fails', () => {
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
      expect(() => { audio.reel().stop(); race.stop(); }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('loads real samples once, changes playback rate, and stops live and pending sounds', async () => {
    const active = new Set<object>();
    const param = () => ({ setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), value: 0 });
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    type TestSource = ReturnType<typeof node> & {
      playbackRate: ReturnType<typeof param>;
      loop: boolean;
      buffer: { file: string } | null;
      start: ReturnType<typeof vi.fn<(when?: number, offset?: number) => void>>;
      stop(time?: number): void;
    };
    const sources: TestSource[] = [];
    const makeSource = () => {
      const source: TestSource = {
        ...node(), playbackRate: param(), loop: false, buffer: null as { file: string } | null,
        start: vi.fn(() => { active.add(source); }), stop: (time?: number) => { if (time === undefined) active.delete(source); },
      };
      sources.push(source);
      return source;
    };
    const context = {
      state: 'running', currentTime: 1, destination: node(),
      createGain: () => ({ ...node(), gain: param() }),
      createBufferSource: makeSource,
      createBiquadFilter: () => ({ ...node(), frequency: param() }),
      createDynamicsCompressor: () => ({ ...node(), threshold: param(), ratio: param(), attack: param(), release: param() }),
      decodeAudioData: async (file: string) => ({ file, duration: 3.8 }),
      suspend: async () => { context.state = 'suspended'; },
      resume: async () => { context.state = 'running'; },
    };
    const constructor = vi.fn(function () { return context; });
    let releaseMythic: () => void = () => {};
    const mythicPending = new Promise<void>((resolve) => { releaseMythic = resolve; });
    const fetchSample = vi.fn(async (file: string) => {
      if (file.endsWith('reward-mythic.mp3')) await mythicPending;
      return { ok: true, arrayBuffer: async () => file };
    });
    vi.stubGlobal('AudioContext', constructor);
    vi.stubGlobal('fetch', fetchSample);
    try {
      audio.unlock();
      audio.unlock();
      expect(constructor).toHaveBeenCalledOnce();
      const race = audio.race(cars[0]);
      race.cue({ type: 'start' });
      await vi.waitFor(() => expect(active.size).toBe(3));
      const motor = sources.find((source) => source.loop)!;
      expect(motor.buffer?.file).toMatch(/engine-vintage\.mp3$/);
      race.cue({ type: 'engine', pace: .82 });
      const targets = motor.playbackRate.setTargetAtTime.mock.calls.map(([rate]) => rate);
      expect(targets.at(-1)).toBeGreaterThan(targets[0]);
      audio.setVisible(false);
      expect(active.size).toBe(0);
      race.cue({ type: 'overtake' });
      audio.setVisible(true);
      expect(active.size).toBe(0);
      race.cue({ type: 'engine', pace: .7 });
      expect(active.size).toBe(1);
      race.stop();
      expect(active.size).toBe(0);
      expect(fetchSample.mock.calls.filter(([file]) => file.endsWith('engine-vintage.mp3'))).toHaveLength(1);

      const reel = audio.reel();
      reel.cue('mechanism');
      reel.cue({ type: 'progress', elapsed: 0 });
      for (let i = 0; i < 20; i++) reel.cue('tick');
      await vi.waitFor(() => expect(active.size).toBe(4));
      const riser = () => sources.filter((source) => source.buffer?.file.endsWith('reel-rise.mp3'));
      expect(riser()).toHaveLength(1);
      reel.cue({ type: 'progress', elapsed: 500 });
      expect(riser()).toHaveLength(1);
      audio.setVisible(false);
      expect(active.size).toBe(0);
      audio.setVisible(true);
      reel.cue({ type: 'progress', elapsed: 1600 });
      expect(riser()).toHaveLength(2);
      expect(riser().at(-1)?.start).toHaveBeenCalledWith(1, 1.6);
      reel.cue('settle');
      expect(active.has(riser().at(-1)!)).toBe(false);
      expect([...active]).toEqual([sources.find((source) => source.buffer?.file.endsWith('reel-stop.mp3'))]);
      reel.stop();
      expect(active.size).toBe(0);
      audio.play({ reward: 'Mythic' });
      audio.configure({ ...defaultAudioSettings, enabled: false });
      audio.configure(defaultAudioSettings);
      releaseMythic();
      await vi.waitFor(() => expect(fetchSample.mock.calls.filter(([file]) => file.endsWith('reward-mythic.mp3'))).toHaveLength(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(active.size).toBe(0);
      for (const rarity of rarities) audio.play({ reward: rarity });
      await vi.waitFor(() => {
        const rewardsPlayed = [...active] as TestSource[];
        expect(rewardsPlayed.map((source) => source.buffer?.file.split('/').at(-1))).toEqual(
          rarities.map((rarity) => `reward-${rarity.toLowerCase()}.mp3`),
        );
      });
    } finally {
      audio.setVisible(false);
      vi.unstubAllGlobals();
    }
  });
});
