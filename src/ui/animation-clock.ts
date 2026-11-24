export function runForegroundAnimation(
  owner: HTMLElement | null,
  step: (elapsed: number) => boolean,
  done: () => void,
): () => void {
  let elapsed = 0;
  let segmentStart = 0;
  let frame: number | undefined;
  let stopped = false;
  let running = false;

  function update(now: number) {
    if (!running || stopped) return;
    if (step(elapsed + Math.max(0, now - segmentStart))) {
      stop();
      done();
    } else if (running && !stopped) {
      frame = requestAnimationFrame(update);
    }
  }

  function syncVisibility() {
    const visible = !document.hidden;
    if (owner) owner.dataset.animationPaused = String(!visible);
    if (visible === running || stopped) return;
    const now = performance.now();
    if (visible) {
      segmentStart = now;
      frame = requestAnimationFrame(update);
    } else {
      elapsed += Math.max(0, now - segmentStart);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    }
    running = visible;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', syncVisibility);
  }

  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  return stop;
}
