import { describe, expect, it } from 'vitest';
import type { Timeline } from '../../src/engine/timeline';
import { Player, readingTime } from '../../src/ui/player';

const tl = (n: number) =>
  ({ steps: Array.from({ length: n }, (_, i) => ({ duration: 1, text: `단계 ${i + 1}` })) }) as unknown as Timeline;

/** Run the clock for s seconds in small ticks. */
const run = (p: Player, s: number) => {
  for (let i = 0; i < Math.round(s / 0.05); i++) p.tick(0.05);
};

const at = (k: number, t: number) => {
  const p = new Player();
  p.load(tl(3));
  p.seek(k, t);
  return p;
};

describe('Player: one job per control, no two alike', () => {
  it('a step plays once when you arrive at it, then holds on its last frame', () => {
    const p = at(0, 1);
    p.next();
    expect([p.k, p.t, p.running]).toEqual([1, 0, true]);
    run(p, 10);
    expect([p.k, p.t, p.running]).toEqual([1, 1, false]);
  });

  it('prev, replay and next lead to three different places', () => {
    const where = (f: (p: Player) => void) => {
      const p = at(1, 0.5);
      f(p);
      return `${p.k}:${p.t}`;
    };
    const ends = [where((p) => p.prev()), where((p) => p.replay()), where((p) => p.next())];
    expect(ends).toEqual(['0:0', '1:0', '2:0']);
  });

  it('on the first step there is no step before: prev does nothing (it does not repeat the step)', () => {
    const p = at(0, 0.6);
    p.prev();
    expect([p.k, p.t, p.running]).toEqual([0, 0.6, false]);
  });

  it('next on the last step starts over, unless someone else takes it (the next chapter)', () => {
    const p = at(2, 1);
    p.next();
    expect([p.k, p.t, p.running]).toEqual([0, 0, true]);
    let taken = false;
    p.onEnd = () => (taken = true);
    p.seek(2, 0.3);
    p.next();
    expect(taken).toBe(true);
  });

  it('nothing moves on by itself unless "이어서 재생" is on', () => {
    const p = at(0, 0);
    p.replay();
    run(p, 20);
    expect([p.k, p.t]).toEqual([0, 1]);
  });

  it('"이어서 재생" moves on after time to read the caption, and stops at the end', () => {
    const p = at(0, 0);
    p.auto = true;
    p.replay();
    run(p, 1.05);
    expect(p.k).toBe(0);
    run(p, readingTime('단계 1') + 0.1);
    expect(p.k).toBe(1);
    run(p, 20);
    expect(p.atEnd).toBe(true);
    expect(p.running).toBe(false);
  });

  it('the step bar holds one moment still, even with "이어서 재생" on', () => {
    const p = at(0, 0);
    p.auto = true;
    p.replay();
    p.seek(1, 0.5);
    run(p, 10);
    expect([p.k, p.t, p.running]).toEqual([1, 0.5, false]);
  });
});
