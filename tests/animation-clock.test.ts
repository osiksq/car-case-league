import { afterEach, describe, expect, it, vi } from 'vitest';
import { runForegroundAnimation } from '../src/ui/animation-clock';

function browserClock(initiallyHidden = false) {
  const visibility = Object.assign(new EventTarget(), { hidden: initiallyHidden });
  const owner = { dataset: {} } as HTMLElement;
  const frames = new Map<number, FrameRequestCallback>();
  let time = 0;
  let nextFrame = 0;
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('performance', { now: () => time });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const frame = ++nextFrame;
    frames.set(frame, callback);
    return frame;
  });
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
  return {
    owner,
    frames,
    visibility,
    advance(ms: number) {
      time += ms;
      for (const [frame, callback] of [...frames]) {
        if (frames.delete(frame)) callback(time);
      }
    },
    hide(hidden: boolean) {
      visibility.hidden = hidden;
      visibility.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('foreground animation time', () => {
  it('pauses without accumulating elapsed time and completes only once', () => {
    const clock = browserClock();
    const step = vi.fn((elapsed: number) => elapsed >= 100);
    const done = vi.fn();
    const remove = vi.spyOn(clock.visibility, 'removeEventListener');
    runForegroundAnimation(clock.owner, step, done);

    clock.advance(20);
    expect(step).toHaveBeenLastCalledWith(20);
    clock.hide(true);
    expect(clock.owner.dataset.animationPaused).toBe('true');
    expect(clock.frames.size).toBe(0);
    clock.advance(5000);
    expect(step).toHaveBeenCalledTimes(1);

    clock.hide(false);
    expect(clock.owner.dataset.animationPaused).toBe('false');
    clock.advance(40);
    expect(step).toHaveBeenLastCalledWith(60);
    clock.advance(40);
    expect(step).toHaveBeenLastCalledWith(100);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(done).toHaveBeenCalledTimes(1);
    expect(clock.frames.size).toBe(0);

    clock.hide(true);
    clock.hide(false);
    clock.advance(5000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts from zero after a hidden launch and discards work on cancellation', () => {
    const clock = browserClock(true);
    const step = vi.fn(() => false);
    const done = vi.fn();
    const stop = runForegroundAnimation(clock.owner, step, done);
    clock.advance(3000);
    expect(step).not.toHaveBeenCalled();
    clock.hide(false);
    clock.advance(16);
    expect(step).toHaveBeenCalledWith(16);
    stop();
    stop();
    clock.hide(true);
    clock.hide(false);
    clock.advance(5000);
    expect(step).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    expect(clock.frames.size).toBe(0);
  });
});
