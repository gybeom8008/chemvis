import type { Timeline } from '../engine/timeline';

/** Seconds to leave a caption on screen before "이어서 재생" moves on. */
export function readingTime(text: string): number {
  return Math.min(6, Math.max(2, 1 + text.length * 0.05));
}

/**
 * Playback position: step k, progress t (0..1) inside it.
 *
 * A step plays once when you arrive at it and then holds on its last frame.
 * Each control does one thing, and no two do the same:
 * - prev: the step before (none on the first step);
 * - replay: the current step again, from its start;
 * - next: the step after; on the last step, start over (or the next chapter, via onEnd);
 * - seek: one moment of any step, held still (the step bar).
 * Only the "이어서 재생" setting (auto) moves on by itself, after time to read the caption.
 */
export class Player {
  tl: Timeline | null = null;
  k = 0;
  t = 0;
  /** The current step's animation is running. */
  running = false;
  /** Setting: after a step, go on to the next one by itself. */
  auto = false;
  speed = 1;
  onChange: (() => void) | null = null;
  onStepEnter: ((k: number) => void) | null = null;
  /** Called by next() on the last step; return true if handled (the tutorial opens the next chapter). */
  onEnd: (() => boolean) | null = null;
  private lastK = -1;
  /** Seconds left to read the caption before auto moves on. */
  private wait = 0;

  unload(): void {
    this.tl = null;
    this.reset();
  }

  load(tl: Timeline): void {
    this.tl = tl;
    this.reset();
  }

  private reset(): void {
    this.k = 0;
    this.t = 0;
    this.running = false;
    this.wait = 0;
    this.lastK = -1;
    this.emit();
  }

  get n(): number {
    return this.tl?.steps.length ?? 0;
  }

  get onFirst(): boolean {
    return this.k === 0;
  }

  get onLast(): boolean {
    return this.n > 0 && this.k >= this.n - 1;
  }

  get atEnd(): boolean {
    return this.onLast && this.t >= 1;
  }

  private emit(): void {
    if (this.k !== this.lastK) {
      this.lastK = this.k;
      this.onStepEnter?.(this.k);
    }
    this.onChange?.();
  }

  /** Show one moment and hold it (the step bar, tests). */
  seek(k: number, t: number): void {
    if (!this.n) return;
    this.k = Math.max(0, Math.min(this.n - 1, k));
    this.t = Math.max(0, Math.min(1, t));
    this.running = false;
    this.wait = 0;
    this.emit();
  }

  /** Show step k from its start. */
  go(k: number): void {
    if (!this.n) return;
    this.k = Math.max(0, Math.min(this.n - 1, k));
    this.t = 0;
    this.running = true;
    this.wait = 0;
    this.emit();
  }

  replay(): void {
    this.go(this.k);
  }

  prev(): void {
    if (this.n && !this.onFirst) this.go(this.k - 1);
  }

  next(): void {
    if (!this.n) return;
    if (!this.onLast) return this.go(this.k + 1);
    if (this.onEnd?.()) return;
    this.restart();
  }

  restart(): void {
    this.go(0);
  }

  /** Stop where it is (the tutorial closing). */
  stop(): void {
    this.running = false;
    this.wait = 0;
    this.emit();
  }

  /** Advance by dt seconds of wall time. */
  tick(dt: number): void {
    const step = this.tl?.steps[this.k];
    if (!step) return;
    if (this.running) {
      this.t += (dt * this.speed) / step.duration;
      if (this.t >= 1) {
        this.t = 1;
        this.running = false;
        if (this.auto && !this.onLast) this.wait = readingTime(step.text) / this.speed;
      }
      this.emit();
    } else if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = 0;
        if (this.auto) this.go(this.k + 1);
      }
    }
  }
}
