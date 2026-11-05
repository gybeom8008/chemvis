import type { Timeline } from '../engine/timeline';

/** Playback position: step k, progress t (0..1) inside it. */
export class Player {
  tl: Timeline | null = null;
  k = 0;
  t = 0;
  playing = false;
  speed = 1;
  continuous = false;
  onChange: (() => void) | null = null;
  private lastK = -1;
  onStepEnter: ((k: number) => void) | null = null;

  unload(): void {
    this.tl = null;
    this.k = 0;
    this.t = 0;
    this.playing = false;
    this.lastK = -1;
    this.emit();
  }

  load(tl: Timeline): void {
    this.tl = tl;
    this.k = 0;
    this.t = 0;
    this.playing = false;
    this.lastK = -1;
    this.emit();
  }

  get n(): number {
    return this.tl?.steps.length ?? 0;
  }

  private emit(): void {
    if (this.k !== this.lastK) {
      this.lastK = this.k;
      this.onStepEnter?.(this.k);
    }
    this.onChange?.();
  }

  seek(k: number, t: number, play = false): void {
    if (!this.n) return;
    this.k = Math.max(0, Math.min(this.n - 1, k));
    this.t = Math.max(0, Math.min(1, t));
    this.playing = play;
    this.emit();
  }

  /** Called when play is pressed at the very end; return true if handled (e.g. next chapter). */
  onEndPlay: (() => boolean) | null = null;

  get atEnd(): boolean {
    return this.n > 0 && this.k >= this.n - 1 && this.t >= 1;
  }

  play(): void {
    if (!this.n) return;
    if (this.t >= 1) {
      if (this.k < this.n - 1) this.seek(this.k + 1, 0, true);
      else if (!this.onEndPlay?.()) this.seek(0, 0, true);
      return;
    }
    this.playing = true;
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  next(): void {
    if (!this.n) return;
    if (this.k < this.n - 1) this.seek(this.k + 1, 0, true);
    else this.seek(this.k, 1, false);
  }

  prev(): void {
    if (!this.n) return;
    if (this.t > 0.02) this.seek(this.k, 0, false);
    else this.seek(this.k - 1, 0, false);
  }

  restart(): void {
    this.seek(0, 0, false);
  }

  /** Advance by dt seconds of wall time. */
  tick(dt: number): void {
    if (!this.playing || !this.tl) return;
    const step = this.tl.steps[this.k];
    if (!step) return;
    this.t += (dt * this.speed) / step.duration;
    if (this.t >= 1) {
      this.t = 1;
      if (this.continuous && this.k < this.n - 1) {
        this.k += 1;
        this.t = 0;
      } else this.playing = false;
    }
    this.emit();
  }
}
