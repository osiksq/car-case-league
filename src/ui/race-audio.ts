import type { RaceCue } from './race-scene';

let audioContext: AudioContext | undefined;

export function unlockRaceAudio(): void {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
  } catch {
    // Racing remains available if the browser lacks Web Audio.
  }
}

export function createRaceAudio(): { cue: (cue: RaceCue) => void; stop: () => void } {
  const context = audioContext;
  if (!context || context.state === 'closed') return { cue: () => {}, stop: () => {} };

  const bus = context.createGain();
  bus.gain.value = 0.24;
  bus.connect(context.destination);
  const engine = context.createOscillator();
  const harmonic = context.createOscillator();
  const filter = context.createBiquadFilter();
  const motor = context.createGain();
  engine.type = 'sawtooth';
  engine.frequency.value = 39;
  harmonic.type = 'triangle';
  harmonic.frequency.value = 78;
  filter.type = 'lowpass';
  filter.frequency.value = 170;
  motor.gain.value = 0;
  engine.connect(filter);
  harmonic.connect(filter);
  filter.connect(motor);
  motor.connect(bus);
  engine.start();
  harmonic.start();

  const voices = new Map<OscillatorNode, GainNode>();
  let active = true;
  let finishing = false;

  function tone(from: number, to: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
    if (!context) return;
    const time = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.028);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    voices.set(oscillator, envelope);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      voices.delete(oscillator);
    };
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  function cue(event: RaceCue) {
    if (!active || !context) return;
    const now = context.currentTime;
    switch (event.type) {
      case 'countdown':
        tone(330, 330, 0.17, 0.29);
        break;
      case 'start':
        tone(495, 660, 0.28, 0.34);
        motor.gain.setTargetAtTime(0.27, now, 0.07);
        break;
      case 'engine': {
        if (finishing) break;
        const pace = Math.max(0, Math.min(event.pace, 1));
        engine.frequency.setTargetAtTime(42 + pace * 70, now, 0.09);
        harmonic.frequency.setTargetAtTime(84 + pace * 140, now, 0.09);
        filter.frequency.setTargetAtTime(180 + pace * 620, now, 0.13);
        break;
      }
      case 'shift':
        tone(160, 62, 0.16, 0.16, 0, 'triangle');
        break;
      case 'overtake':
        tone(270, 82, 0.28, 0.16, 0, 'triangle');
        break;
      case 'finish':
        finishing = true;
        motor.gain.setTargetAtTime(0, now, 0.13);
        tone(392, 392, 0.22, 0.17);
        tone(523, 523, 0.32, 0.23, 0.11);
        break;
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    bus.disconnect();
    for (const [voice, envelope] of voices) {
      voice.onended = null;
      voice.stop();
      voice.disconnect();
      envelope.disconnect();
    }
    voices.clear();
    engine.stop();
    harmonic.stop();
    engine.disconnect();
    harmonic.disconnect();
    filter.disconnect();
    motor.disconnect();
  }

  return { cue, stop };
}
