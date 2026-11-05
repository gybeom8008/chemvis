import { describe, expect, it } from 'vitest';
import type { Timeline } from '../../src/engine/timeline';
import { Player, readingTime } from '../../src/ui/player';

const tl = (n: number) =>
  ({ steps: Array.from({ length: n }, (_, i) => ({ duration: 1, text: `단계 ${i + 1}` })) }) as unknown as Timeline;

/** Run the clock for s seconds in small ticks. */
const run = (p: Player, s: number) => {
  for (let i = 0; i < Math.round(s / 0.05); i++) p.tick(0.05);
};

describe('Player: each control does one thing', () => {
  it('next shows the following step once, then holds on its last frame', () => {
    const p = new Player();
    p.load(tl(3));
    p.next();
    expect([p.k, p.t, p.running]).toEqual([1, 0, true]);
    run(p, 1.5);
    expect([p.k, p.t, p.playing]).toEqual([1, 1, false]);
  });

  it('replay shows the current step again instead of moving on', () => {
    const p = new Player();
    p.load(tl(3));
    p.go(1);
    run(p, 1.5);
    p.replay();
    expect([p.k, p.t, p.running]).toEqual([1, 0, true]);
  });

  it('prev goes to the step before and shows it', () => {
    const p = new Player();
    p.load(tl(3));
    p.seek(2, 0.5);
    p.prev();
    expect([p.k, p.t, p.running]).toEqual([1, 0, true]);
  });

  it('play never leaves the current step: on a finished step it plays that step again', () => {
    const p = new Player();
    p.load(tl(3));
    p.seek(1, 1);
    p.play();
    expect([p.k, p.t, p.running]).toEqual([1, 0, true]);
    run(p, 10);
    expect([p.k, p.t, p.playing]).toEqual([1, 1, false]);
    p.seek(2, 1);
    p.play();
    expect([p.k, p.t]).toEqual([2, 0]);
  });

  it('play after a pause goes on from where it stopped', () => {
    const p = new Player();
    p.load(tl(3));
    p.go(0);
    run(p, 0.4);
    p.pause();
    const t = p.t;
    run(p, 3);
    expect([p.k, p.t, p.playing]).toEqual([0, t, false]);
    p.play();
    expect(p.t).toBe(t);
    expect(p.running).toBe(true);
  });

  it('only the "이어서 재생" setting moves on by itself, after time to read the caption', () => {
    const p = new Player();
    p.load(tl(3));
    p.auto = true;
    p.go(0);
    run(p, 1.05);
    expect(p.k).toBe(0);
    expect(p.playing).toBe(true);
    run(p, readingTime('단계 1') + 0.1);
    expect(p.k).toBe(1);
    run(p, 20);
    expect(p.atEnd).toBe(true);
    expect(p.playing).toBe(false);
  });

  it('next on the last step starts over, unless someone else takes it (next chapter)', () => {
    const p = new Player();
    p.load(tl(2));
    p.seek(1, 1);
    p.next();
    expect([p.k, p.running]).toEqual([0, true]);
    let taken = false;
    p.onEnd = () => (taken = true);
    p.seek(1, 0.3);
    p.next();
    expect(taken).toBe(true);
  });

  it('scrubbing stops the run', () => {
    const p = new Player();
    p.load(tl(3));
    p.auto = true;
    p.play();
    p.seek(1, 0.5);
    run(p, 5);
    expect([p.k, p.t, p.playing]).toEqual([1, 0.5, false]);
  });
});
