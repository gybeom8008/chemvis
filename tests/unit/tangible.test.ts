import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { HOP_WAIT, REACH, REACH_FIRM, REACH_STIFF, SNATCH, hopFlight, reachAt, reachPairs, snatchAt, snatchPairs, trackAt, type StepAnim } from '../../src/engine/timeline';
import { component, neighbors } from '../../src/engine/world';
import { element } from '../../src/chem/elements';
import { CHAPTERS, sceneOf } from '../../src/tutorial/chapters';
import { dist, type Vec } from '../../src/util/math';

/**
 * Motion that reads as bodies moved by forces (CompileOptions.tangible). These check the shape of
 * the paths in numbers: what is pulled speeds up until it meets, an atom handed over is let go
 * before it is taken, what is in the way gives as the other comes near and not before.
 */
const scene = (id: string) => sceneOf(CHAPTERS.find((c) => c.id === id)!.script);
const tangible = (id: string) => compile(scene(id), { tight: true, tangible: true }).timeline!;
const plain = (id: string) => compile(scene(id), { tight: true }).timeline!;
const pos = (s: StepAnim, id: string, t: number): Vec => {
  const tr = s.tracks.get(id);
  return tr ? trackAt(tr, t) : s.before.atoms.get(id) ?? s.after.atoms.get(id)!;
};
const scenes = ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'addition', 'condensation', 'redox', 'coordination', 'radical', 'dissolving', 'cell'];

describe('the snatch curve', () => {
  it('slides, rushes, lands at SNATCH.hit and settles at 1', () => {
    expect(snatchAt(0)).toBe(0);
    expect(snatchAt(SNATCH.slide)).toBeCloseTo(0.16, 6);
    expect(snatchAt(SNATCH.hit)).toBeCloseTo(1, 6);
    expect(snatchAt(1)).toBeCloseTo(1, 6);
    // Never runs back before it lands, and speeds up all the way in.
    let last = 0;
    let lastV = 0;
    for (let i = 1; i <= 70; i++) {
      const v = snatchAt(i / 100) - snatchAt((i - 1) / 100);
      expect(v).toBeGreaterThan(0);
      if (i > 2) expect(v).toBeGreaterThan(lastV - 1e-9);
      lastV = v;
      last = snatchAt(i / 100);
    }
    expect(last).toBeCloseTo(1, 6);
    // Presses in a little and comes back: a few percent, not a bounce off.
    const peak = Math.max(...Array.from({ length: 31 }, (_, i) => snatchAt(0.7 + i / 100)));
    expect(peak).toBeGreaterThan(1.04);
    expect(peak).toBeLessThan(1.15);
  });
  it('no pair holds the atom between `free` and `grab`', () => {
    for (let f = 0; f <= 1.0001; f += 0.01) {
      const p = snatchPairs(f);
      // Never both at once: the old pair is gone before the new one reaches.
      expect(Math.min(1 - p.let, p.take)).toBe(0);
    }
    expect(snatchPairs(SNATCH.free).let).toBe(1);
    expect(snatchPairs(SNATCH.grab).take).toBe(0);
    expect(snatchPairs(SNATCH.hit).take).toBe(1);
  });
});

describe('tangible motion', () => {
  it('ends every step where the plain tight motion ends it', { timeout: 60000 }, () => {
    for (const id of scenes) {
      const a = tangible(id);
      const b = plain(id);
      expect(a.steps.length).toBe(b.steps.length);
      a.steps.forEach((s, k) => {
        expect([...s.after.bonds.keys()].sort()).toEqual([...b.steps[k].after.bonds.keys()].sort());
        for (const [aid, at] of s.after.atoms) {
          const end = pos(s, aid, 1);
          expect(dist(end, at), `${id} step ${k + 1} ${aid} path end`).toBeLessThan(0.6);
        }
      });
    }
  });

  it('a handed H is let go, drifts, and lands on its taker at the strike', () => {
    // Also where a net reaction is drawn as four pairs changing hands (condensation, hydrolysis):
    // there the atom keeps the clock of the two pairs that let it go and take it.
    const steps = ['acid-hcl', 'base-nh3', 'neutralization', 'condensation'].flatMap((id) => tangible(id).steps.filter((x) => x.handed?.length).map((s) => ({ id, s })));
    expect(steps.map((x) => x.id)).toEqual(['acid-hcl', 'base-nh3', 'neutralization', 'condensation', 'condensation']);
    for (const { id, s } of steps) {
      expect(s, id).toBeTruthy();
      for (const h of s.handed!) {
        const at = (f: number) => h.t0 + (h.t1 - h.t0) * f;
        expect(h.t0).toBeGreaterThanOrEqual(s.phase!.b0 - 1e-9);
        expect(h.t1).toBeLessThanOrEqual(s.phase!.b1 + 1e-9);
        const dTo = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.to, at(f)));
        const dFrom = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.from, at(f)));
        const bondTo = dist(s.after.atoms.get(h.id)!, s.after.atoms.get(h.to)!);
        const way = dTo(0) - bondTo;
        // It lands at the strike, at bond length.
        expect(dTo(SNATCH.hit), `${id} lands`).toBeCloseTo(bondTo, 0);
        expect(s.strike).toBeCloseTo(at(SNATCH.hit), 6);
        // Where it starts beside its taker already (a net reaction brings them together first) there is no way to cross.
        if (way < 6) continue;
        // While the old pair lets go the atom has barely left; it has not reached the taker.
        expect(dFrom(SNATCH.free) - dFrom(0), `${id} slides`).toBeGreaterThan(0.5);
        expect(dTo(0) - dTo(SNATCH.free)).toBeLessThan(0.2 * way);
        expect(dTo(SNATCH.grab)).toBeGreaterThan(bondTo + 0.5 * way);
        // The last tenth before landing covers more ground than the whole slide: a snatch.
        expect(dTo(SNATCH.grab) - dTo(SNATCH.hit)).toBeGreaterThan(2.5 * (dTo(0) - dTo(SNATCH.slide)));
        // It never passes through its taker.
        const R = element(s.after.atoms.get(h.to)!.el).r;
        for (let f = 0; f <= 1; f += 0.01) expect(dTo(f)).toBeGreaterThan(R * 0.6);
      }
    }
  });

  it('what is drawn in speeds up until the two meet, and the other leans toward it', () => {
    const tl = tangible('acid-hcl');
    const s = tl.steps.find((x) => x.pulls?.length && !x.phase)!;
    const { a, b } = s.pulls![0];
    const d = (t: number) => dist(pos(s, a, t), pos(s, b, t));
    const v: number[] = [];
    for (let i = 1; i <= 80; i++) v.push(d((i - 1) / 100) - d(i / 100));
    // Closing speed grows over the approach (allowing for the path going round).
    expect(v[70]).toBeGreaterThan(v[30]);
    expect(v[30]).toBeGreaterThan(v[5]);
    expect(Math.max(...v.slice(0, 10))).toBeLessThan(0.25 * Math.max(...v));
    // The one that is come to has moved toward the comer by the time they meet, and is back at the end.
    const home = s.before.atoms.get(b)!;
    expect(dist(pos(s, b, 0.8), home)).toBeGreaterThan(2);
    expect(dist(pos(s, b, 1), home)).toBeLessThan(0.6);
  });

  it('in a substitution the H atoms give way as the other molecule comes near, not before', () => {
    const tl = tangible('substitution');
    const s = tl.steps.find((x) => x.pulls?.length && !x.phase)!;
    const { a, b } = s.pulls![0];
    const hs = neighbors(s.before, b).map((n) => n.id).filter((id) => s.before.atoms.get(id)!.el === 'H');
    const angle = (id: string, t: number) => Math.atan2(pos(s, id, t).y - pos(s, b, t).y, pos(s, id, t).x - pos(s, b, t).x);
    const turned = (t: number) => Math.max(...hs.map((id) => Math.abs(Math.atan2(Math.sin(angle(id, t) - angle(id, 0)), Math.cos(angle(id, t) - angle(id, 0))))));
    const total = turned(1);
    expect(total).toBeGreaterThan(0.2);
    const gap = (t: number) => dist(pos(s, a, t), pos(s, b, t));
    for (let t = 0; t <= 1; t += 0.02) {
      // Nothing has moved aside while the comer is still far off.
      if (gap(t) > gap(1) + 80) expect(turned(t)).toBeLessThan(0.02);
    }
    // And they are out of the way by the time it is there.
    expect(turned(0.8)).toBeGreaterThan(0.95 * total);
    // Bond lengths of the swinging H atoms never change.
    for (const id of hs) for (let t = 0; t <= 1; t += 0.05) expect(dist(pos(s, id, t), pos(s, b, t))).toBeCloseTo(dist(s.before.atoms.get(id)!, s.before.atoms.get(b)!), 0);
  });

  it('what is thrown off leaves at once and slows down', () => {
    const tl = tangible('substitution');
    const s = tl.steps.find((x) => x.phase && x.arrows.length)!;
    const br = [...s.after.atoms.values()].find((x) => x.el === 'Br')!;
    const { c0, c1 = 1 } = s.phase!;
    const p = (u: number) => pos(s, br.id, c0 + (c1 - c0) * u);
    const whole = dist(p(0), p(1));
    expect(whole).toBeGreaterThan(20);
    expect(dist(p(0), p(0.25))).toBeGreaterThan(0.5 * whole);
    expect(dist(p(0.75), p(1))).toBeLessThan(0.05 * whole);
    // Still where it was until the change is done.
    expect(dist(pos(s, br.id, c0 - 0.01), s.before.atoms.get(br.id)!)).toBeLessThan(0.6);
  });

  it('keeps bonded atoms at bond length and unbonded ones apart on the way', { timeout: 60000 }, () => {
    for (const id of scenes) {
      const tl = tangible(id);
      for (const s of tl.steps) {
        const kept = [...s.before.bonds.values()].filter((bd) => s.after.bonds.has(bd.a < bd.b ? `${bd.a}|${bd.b}` : `${bd.b}|${bd.a}`));
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          for (const bd of kept) {
            const A = s.before.atoms.get(bd.a)!;
            const B = s.before.atoms.get(bd.b)!;
            if (A.crowd || !s.after.atoms.has(bd.a) || !s.after.atoms.has(bd.b)) continue;
            const d0 = dist(A, B);
            const d1 = dist(s.after.atoms.get(bd.a)!, s.after.atoms.get(bd.b)!);
            const d = dist(pos(s, bd.a, t), pos(s, bd.b, t));
            expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${t}`).toBeGreaterThan(Math.min(d0, d1) - 1.5);
            expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${t}`).toBeLessThan(Math.max(d0, d1) + 1.5);
          }
        }
      }
    }
  });

  it('gives every reacting step its moment', { timeout: 60000 }, () => {
    for (const id of scenes) {
      for (const s of tangible(id).steps) {
        if (!s.phase) continue;
        expect(s.strike, `${id} step ${s.index + 1}`).toBeGreaterThanOrEqual(s.phase.b0);
        expect(s.strike!).toBeLessThanOrEqual(Math.max(s.phase.b1, s.phase.c1 ?? 1));
      }
    }
  });

  it('leaves the plain tight motion as it was', () => {
    const s = plain('acid-hcl').steps.find((x) => x.phase)!;
    expect(s.handed).toBeUndefined();
    expect(s.strike).toBeUndefined();
    expect(component(s.after, [...s.after.atoms.keys()][0]).length).toBeGreaterThan(0);
    expect(s.heat).toBeUndefined();
  });
});

describe('the heat of a reaction', () => {
  const heats = (id: string) => tangible(id).steps.map((s) => s.heat);
  it('is what the script states, at the moment of the reaction', () => {
    const s = tangible('neutralization').steps.find((x) => x.energy)!;
    expect(s.heat).toBe(-56);
    expect(s.strike).toBeGreaterThan(s.phase!.b0);
    expect(s.strike).toBeLessThan(s.phase!.b1);
    expect(heats('redox').filter((h) => h !== undefined)).toEqual([-212]);
  });
  it('is worked out from enthalpies of formation where the script states none', () => {
    // Three pairs of Ca2+ and CO3 2- (or whatever the chapter precipitates): heat given off, once.
    const got = heats('precipitation').filter((h) => h !== undefined);
    expect(got.length).toBe(1);
    expect(got[0]!).toBeLessThan(-20);
    // Cl· + CH4 → HCl + CH3·: takes in a little.
    const rad = heats('radical');
    expect(rad[2]!).toBeGreaterThan(0);
    expect(rad[2]!).toBeLessThan(20);
  });
  it('is not given where the energy is not heat, or where the sign cannot be trusted', () => {
    // Light breaks Cl2: the energy comes with the light.
    expect(heats('radical')[0]).toBeUndefined();
    // On electrodes the energy leaves as electrical work.
    expect(heats('cell').every((h) => h === undefined)).toBe(true);
    // Water of the crowd joins in (hydrolysis): the count of atoms changes.
    expect(heats('condensation')[4]).toBeUndefined();
    // Nothing reacts while molecules only come together or are surrounded by water.
    for (const id of scenes) {
      tangible(id).steps.forEach((s, k) => {
        if (!s.phase && s.strike === undefined) expect(s.heat, `${id} step ${k + 1}`).toBeUndefined();
      });
    }
  });
});

/**
 * CompileOptions.reach: two molecules come to each other, and an atom handed over is never held by
 * nothing (the taker's pair reaches it while the old bond, stretched, still holds it).
 */
const reach = (id: string) => compile(scene(id), { tight: true, tangible: true, reach: true }).timeline!;

describe('the reach curve', () => {
  it('draws the atom out, snaps it across in a few frames, and settles at 1', () => {
    expect(reachAt(REACH.start)).toBe(0);
    expect(reachAt(REACH.snap)).toBeCloseTo(REACH.tug, 6);
    expect(reachAt(REACH.hit)).toBeCloseTo(1, 6);
    expect(reachAt(1)).toBeCloseTo(1, 6);
    let lastV = 0;
    for (let i = 1; i <= Math.round(REACH.hit * 200); i++) {
      const v = reachAt(i / 200) - reachAt((i - 1) / 200);
      expect(v).toBeGreaterThanOrEqual(0);
      if (i / 200 > REACH.start + 0.01) expect(v).toBeGreaterThan(lastV - 1e-9);
      lastV = v;
    }
    // The snap is short beside the drawing out.
    expect(REACH.hit - REACH.snap).toBeLessThan(0.25 * (REACH.snap - REACH.start));
  });
  it('the atom is held at every moment: by its old bond until the hand has it', () => {
    for (let f = 0; f <= 1.0001; f += 0.005) {
      const p = reachPairs(f);
      expect(p.let === 0 || p.take === 1, `f ${f}`).toBe(true);
      // It changes hands at the snap, not while the hand is only reaching.
      if (f < REACH.snap) expect(p.charge).toBe(0);
      expect(p.thin).toBeGreaterThan(0.6);
      expect(p.thin).toBeLessThanOrEqual(1);
    }
    expect(reachPairs(REACH.snap).take).toBe(1);
    expect(reachPairs(REACH.hit).let).toBe(1);
    expect(reachPairs(REACH.hit).charge).toBe(1);
  });
});

describe('motion by reach', () => {
  it('ends every step in the world it says it ends in, with bonds kept at length', { timeout: 60000 }, () => {
    for (const id of scenes) {
      for (const s of reach(id).steps) {
        for (const [aid, at] of s.after.atoms) expect(dist(pos(s, aid, 1), at), `${id} step ${s.index + 1} ${aid}`).toBeLessThan(0.6);
        const kept = [...s.before.bonds.values()].filter((bd) => s.after.bonds.has(bd.a < bd.b ? `${bd.a}|${bd.b}` : `${bd.b}|${bd.a}`));
        for (let i = 0; i <= 50; i++) for (const bd of kept) {
          const A = s.before.atoms.get(bd.a)!;
          const B = s.before.atoms.get(bd.b)!;
          if (A.crowd || !s.after.atoms.has(bd.a) || !s.after.atoms.has(bd.b)) continue;
          const d0 = dist(A, B);
          const d1 = dist(s.after.atoms.get(bd.a)!, s.after.atoms.get(bd.b)!);
          const d = dist(pos(s, bd.a, i / 50), pos(s, bd.b, i / 50));
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeGreaterThan(Math.min(d0, d1) - 1.5);
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeLessThan(Math.max(d0, d1) + 1.5);
        }
      }
    }
  });

  it('two molecules come to each other: both move, and they end as the approach laid them out', () => {
    for (const id of ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'addition']) {
      const s = reach(id).steps.find((x) => x.pulls?.length && !x.phase)!;
      const s0 = tangible(id).steps.find((x) => x.pulls?.length && !x.phase)!;
      const { a, b } = s.pulls![0];
      // Both have gone a good part of the way.
      expect(dist(pos(s, a, 1), pos(s, a, 0)), `${id} comer`).toBeGreaterThan(25);
      expect(dist(pos(s, b, 1), pos(s, b, 0)), `${id} the one come to`).toBeGreaterThan(25);
      // The distance between them only closes, faster and faster until they meet.
      const d = (t: number) => dist(pos(s, a, t), pos(s, b, t));
      for (let i = 1; i <= 80; i++) expect(d(i / 100), `${id} at ${i / 100}`).toBeLessThan(d((i - 1) / 100) + 0.3);
      expect(d(0.5) - d(0.75)).toBeGreaterThan(d(0.05) - d(0.3));
      // Relative to each other they end as in the motion without reach (but for the gap an H is snatched across).
      const A = component(s.after, a);
      const B = component(s.after, b);
      const H = s.after.atoms.get(b)!.el === 'H' && neighbors(s.before, b).length === 1;
      if (H) expect(d(1)).toBeCloseTo(34 * 1.5, 0);
      else for (const x of A) for (const y of B) expect(dist(s.after.atoms.get(x)!, s.after.atoms.get(y)!), `${id} ${x}-${y}`).toBeCloseTo(dist(s0.after.atoms.get(x)!, s0.after.atoms.get(y)!), 0);
    }
  });

  it('an H handed over is drawn out on its stretched bond, then is across in a few frames', () => {
    for (const id of ['acid-hcl', 'base-nh3', 'neutralization']) {
      const s = reach(id).steps.find((x) => x.handed?.length)!;
      const h = s.handed![0];
      expect(h.reach).toBe('soft');
      // Reaching, snapping and settling are quick: about three quarters of a second.
      expect((h.t1 - h.t0) * s.duration).toBeLessThan(0.85);
      const at = (f: number) => h.t0 + (h.t1 - h.t0) * f;
      const dTo = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.to, at(f)));
      const dFrom = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.from, at(f)));
      const bond = dFrom(0);
      // Until the snap it is still on its bond, which has grown a little longer: by a tenth to a third.
      expect(dFrom(REACH.snap) / bond, `${id} stretch`).toBeGreaterThan(1.1);
      expect(dFrom(REACH.snap) / bond, `${id} stretch`).toBeLessThan(1.33);
      for (let f = 0; f <= REACH.snap; f += 0.02) expect(dFrom(f)).toBeLessThanOrEqual(dFrom(REACH.snap) + 1e-6);
      // Then it is on its taker, at bond length, within the snap.
      expect(dTo(REACH.hit)).toBeCloseTo(dist(s.after.atoms.get(h.id)!, s.after.atoms.get(h.to)!), 0);
      expect((REACH.hit - REACH.snap) * (h.t1 - h.t0) * s.duration).toBeLessThan(0.1);
      expect(s.strike).toBeCloseTo(at(REACH.hit), 6);
      // What it leaves behind goes its way as soon as the hand-over is done, not after a wait.
      expect(s.phase!.c0).toBeCloseTo(h.t1, 6);
    }
  });

  it('leaves the motion without reach as it was', () => {
    const s = tangible('acid-hcl').steps.find((x) => x.handed?.length)!;
    expect(s.handed![0].reach).toBeUndefined();
    expect(s.phase!.b1 - s.phase!.b0).toBeGreaterThan(0.4);
  });
});

/**
 * CompileOptions.reach 'stiff': the hand-over as something stiff and springy. The bond hardly
 * gives, the atom is across all but at once, and what was under tension springs back.
 */
const stiff = (id: string) => compile(scene(id), { tight: true, tangible: true, reach: 'stiff' }).timeline!;

describe('the stiff reach', () => {
  it('hardly stretches, then crosses in a small part of the time the soft one takes', () => {
    expect(REACH_STIFF.tug).toBeLessThan(0.5 * REACH.tug);
    expect(REACH_STIFF.thin).toBeLessThan(0.5 * REACH.thin);
    expect(REACH_STIFF.hit - REACH_STIFF.snap).toBeLessThan(0.4 * (REACH.hit - REACH.snap));
    expect(reachAt(REACH_STIFF.snap, REACH_STIFF)).toBeCloseTo(REACH_STIFF.tug, 6);
    expect(reachAt(REACH_STIFF.hit, REACH_STIFF)).toBeCloseTo(1, 6);
    expect(reachAt(1, REACH_STIFF)).toBeCloseTo(1, 6);
    // Stiff: half-way through the drawing out it has given less than a fifth of what it gives in the end.
    const half = (REACH_STIFF.start + REACH_STIFF.snap) / 2;
    expect(reachAt(half, REACH_STIFF)).toBeLessThan(0.2 * REACH_STIFF.tug);
    // Springy: after landing it goes past its place and back more than once.
    let turns = 0;
    let last = 0;
    for (let f = REACH_STIFF.hit + 0.002; f <= 1; f += 0.002) {
      const d = reachAt(f, REACH_STIFF) - 1;
      if (last !== 0 && Math.sign(d) !== Math.sign(last) && Math.abs(d) > 1e-4) turns++;
      if (Math.abs(d) > 1e-4) last = d;
    }
    expect(turns).toBeGreaterThanOrEqual(2);
  });
  it('the old pair holds until the snap, the charge changes hands in it, and the pair that let go springs back', () => {
    for (let f = 0; f <= 1.0001; f += 0.002) {
      const p = reachPairs(f, REACH_STIFF);
      if (f < REACH_STIFF.snap) {
        expect(p.let).toBe(0);
        expect(p.charge).toBe(0);
        expect(p.spring).toBe(0);
        // The hand strains out but has not got it yet.
        expect(p.take).toBeLessThanOrEqual(REACH_STIFF.reachTo + 1e-9);
      }
      if (f > REACH_STIFF.hit) {
        expect(p.take).toBeCloseTo(1, 9);
        expect(p.let).toBeCloseTo(1, 9);
      }
      expect(p.thin).toBeGreaterThan(0.85);
    }
    const after = Array.from({ length: 60 }, (_, i) => reachPairs(REACH_STIFF.hit + (i + 1) * 0.005, REACH_STIFF).spring);
    expect(Math.min(...after)).toBeLessThan(-1.5);
    expect(Math.max(...after)).toBeGreaterThan(0.3);
    expect(reachPairs(1, REACH_STIFF).spring).toBeCloseTo(0, 6);
  });
});

describe('motion by stiff reach', () => {
  it('ends every step in the world it says it ends in', { timeout: 60000 }, () => {
    for (const id of scenes) {
      for (const s of stiff(id).steps) {
        for (const [aid, at] of s.after.atoms) expect(dist(pos(s, aid, 1), at), `${id} step ${s.index + 1} ${aid}`).toBeLessThan(0.6);
      }
    }
  });

  it('the H stays on its bond, a few percent longer, then is across within two frames', () => {
    for (const id of ['acid-hcl', 'base-nh3', 'neutralization']) {
      const s = stiff(id).steps.find((x) => x.handed?.length)!;
      const h = s.handed![0];
      expect(h.reach).toBe('stiff');
      const at = (f: number) => h.t0 + (h.t1 - h.t0) * f;
      const dTo = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.to, at(f)));
      const dFrom = (f: number) => dist(pos(s, h.id, at(f)), pos(s, h.from, at(f)));
      const bond = dFrom(0);
      const end = dist(s.after.atoms.get(h.id)!, s.after.atoms.get(h.to)!);
      // Stiff: until the snap the bond is at most a tenth longer.
      expect(dFrom(REACH_STIFF.snap) / bond, `${id} stretch`).toBeGreaterThan(1.02);
      expect(dFrom(REACH_STIFF.snap) / bond, `${id} stretch`).toBeLessThan(1.1);
      // The crossing: most of the way, in less than two frames at 60 a second.
      const jump = dTo(REACH_STIFF.snap) - dTo(REACH_STIFF.hit);
      expect(jump, `${id} jump`).toBeGreaterThan(10);
      expect(jump).toBeGreaterThan(0.8 * (dTo(0) - end));
      const seconds = (REACH_STIFF.hit - REACH_STIFF.snap) * (h.t1 - h.t0) * s.duration;
      expect(seconds, `${id} crossing time`).toBeLessThan(2 / 60);
      expect(dTo(REACH_STIFF.hit)).toBeCloseTo(end, 0);
      expect(s.strike).toBeCloseTo(at(REACH_STIFF.hit), 6);
      // The path keeps that sharpness (nothing laid over it has smeared the jump over more samples).
      const tr = s.tracks.get(h.id)!;
      const inJump = tr.filter((k) => k.t > at(REACH_STIFF.snap) + 1e-9 && k.t < at(REACH_STIFF.hit) - 1e-9).length;
      expect(inJump).toBeGreaterThanOrEqual(3);
      // Springy: it presses in past its place by a pixel or more, and is back out past it after.
      const ring = Array.from({ length: 80 }, (_, i) => dTo(REACH_STIFF.hit + (i + 1) * 0.005) - end);
      expect(Math.min(...ring)).toBeLessThan(-1);
      expect(Math.max(...ring)).toBeGreaterThan(0.3);
      // What it leaves behind is let go with it: it has started away by the time the window ends.
      expect(s.phase!.c0).toBeCloseTo(at(REACH_STIFF.hit), 6);
      // The molecule that held it springs back the other way at the snap.
      const from0 = pos(s, h.from, at(REACH_STIFF.snap));
      const kick = Math.max(...Array.from({ length: 30 }, (_, i) => dist(pos(s, h.from, at(REACH_STIFF.snap) + (i + 1) * 0.004), from0)));
      expect(kick, `${id} recoil`).toBeGreaterThan(1.5);
    }
  });
});

describe('the firm reach', () => {
  it('the pair that takes the atom leans out a little and no more, and the atom hardly rings on it', () => {
    const before = (k: typeof REACH_FIRM) => reachPairs(k.snap - 1e-6, k).take;
    expect(before(REACH_FIRM)).toBeLessThan(0.25);
    expect(before(REACH_STIFF)).toBeGreaterThan(0.6);
    expect(reachPairs(REACH_FIRM.hit, REACH_FIRM).take).toBeCloseTo(1, 6);
    const ring = (k: typeof REACH_FIRM) => Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(reachAt(k.hit + (1 - k.hit) * (i / 200), k) - 1)));
    expect(ring(REACH_FIRM)).toBeLessThan(0.08);
    expect(ring(REACH_FIRM)).toBeGreaterThan(0.02);
    expect(ring(REACH_STIFF)).toBeGreaterThan(0.15);
    // The rest is as stiff: the bond hardly gives, and the atom is across as fast.
    expect(REACH_FIRM.tug).toBe(REACH_STIFF.tug);
    expect(REACH_FIRM.hit - REACH_FIRM.snap).toBe(REACH_STIFF.hit - REACH_STIFF.snap);
  });
});

describe('motion by encounter', () => {
  const made = new Map<string, ReturnType<typeof stiff>>();
  const meet = (id: string) => {
    if (!made.has(id)) made.set(id, compile(scene(id), { tight: true, tangible: true, reach: 'firm', encounter: true }).timeline!);
    return made.get(id)!;
  };
  const far = new Map<string, ReturnType<typeof stiff>>();
  const was = (id: string) => {
    if (!far.has(id)) far.set(id, stiff(id));
    return far.get(id)!;
  };
  const mid = (s: StepAnim, ids: string[], t: number): Vec => {
    const ps = ids.map((id) => pos(s, id, t));
    return { x: ps.reduce((sum, p) => sum + p.x, 0) / ps.length, y: ps.reduce((sum, p) => sum + p.y, 0) / ps.length };
  };
  const way = (s: StepAnim, ids: string[]): number => {
    let sum = 0;
    for (let i = 1; i <= 200; i++) sum += dist(mid(s, ids, (i - 1) / 200), mid(s, ids, i / 200));
    return sum;
  };
  const first = (id: string, tl = meet(id)) => tl.steps.find((x) => x.pulls?.length && !x.phase)!;
  const pair = (s: StepAnim) => [component(s.before, s.pulls![0].a), component(s.before, s.pulls![0].b)] as const;
  const together = ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'addition', 'condensation', 'redox', 'radical'];

  it('ends every step in the world it says it ends in, with bonds kept at length', { timeout: 120000 }, () => {
    for (const id of scenes) {
      for (const s of meet(id).steps) {
        for (const [aid, at] of s.after.atoms) expect(dist(pos(s, aid, 1), at), `${id} step ${s.index + 1} ${aid}`).toBeLessThan(0.6);
        const kept = [...s.before.bonds.values()].filter((bd) => s.after.bonds.has(bd.a < bd.b ? `${bd.a}|${bd.b}` : `${bd.b}|${bd.a}`));
        for (let i = 0; i <= 50; i++) for (const bd of kept) {
          const A = s.before.atoms.get(bd.a)!;
          const B = s.before.atoms.get(bd.b)!;
          if (A.crowd || !s.after.atoms.has(bd.a) || !s.after.atoms.has(bd.b)) continue;
          const d0 = dist(A, B);
          const d1 = dist(s.after.atoms.get(bd.a)!, s.after.atoms.get(bd.b)!);
          const d = dist(pos(s, bd.a, i / 50), pos(s, bd.b, i / 50));
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeGreaterThan(Math.min(d0, d1) - 1.5);
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeLessThan(Math.max(d0, d1) + 1.5);
        }
      }
    }
  });

  it('two that are going to react start near each other: neither flies across the stage', { timeout: 120000 }, () => {
    for (const id of together) {
      const s = first(id);
      const s0 = first(id, was(id));
      const [A, B] = pair(s);
      const now = way(s, A) + way(s, B);
      const then = way(s0, A) + way(s0, B);
      expect(now, `${id} way`).toBeLessThan(240);
      expect(now, `${id} way, against before`).toBeLessThan(0.75 * then);
      for (const g of [A, B]) expect(way(s, g), `${id} each`).toBeLessThan(130);
    }
    // What it was before: hundreds of px, and in the condensation a way round the other molecule.
    expect(way(first('neutralization', was('neutralization')), pair(first('neutralization'))[0])).toBeGreaterThan(200);
    expect(way(first('condensation', was('condensation')), pair(first('condensation'))[0])).toBeGreaterThan(1000);
  });

  it('neither goes round the other: each stays on its side, and its way is as good as straight', { timeout: 120000 }, () => {
    for (const id of [...together, 'coordination']) {
      const s = first(id);
      for (const pl of s.pulls!) {
        const A = component(s.before, pl.a), B = component(s.before, pl.b);
        const angle = (t: number) => {
          const a = mid(s, A, t), b = mid(s, B, t);
          return Math.atan2(a.y - b.y, a.x - b.x);
        };
        for (let i = 0; i <= 100; i++) {
          let d = Math.abs(angle(i / 100) - angle(0));
          if (d > Math.PI) d = 2 * Math.PI - d;
          expect(d * 180 / Math.PI, `${id} ${pl.a} at ${i / 100}`).toBeLessThan(15);
        }
        // (The milling about adds a little to the way.)
        for (const g of [A, B]) expect(way(s, g), `${id} ${g[0]}`).toBeLessThan(1.3 * dist(mid(s, g, 0), mid(s, g, 1)) + 22);
      }
    }
  });

  it('they turn to face each other first, then close faster and faster until they touch', () => {
    for (const id of together) {
      const s = first(id);
      const [A, B] = pair(s);
      const d = (t: number) => dist(mid(s, A, t), mid(s, B, t));
      const closed = d(0) - d(0.8);
      expect(closed, `${id} closed`).toBeGreaterThan(15);
      // (Little in the first half: a little more or less with the milling about.)
      expect(d(0) - d(0.4), `${id} first half`).toBeLessThan(0.45 * closed);
      expect(d(0.7) - d(0.8), `${id} last stretch`).toBeGreaterThan(0.25 * closed);
      // Turned by the time the last stretch begins (two atoms of the molecule lie as they will at the end).
      for (const g of [A, B]) {
        if (g.length < 2) continue;
        const lie = (t: number) => {
          const p = pos(s, g[0], t), q = pos(s, g[1], t);
          return Math.atan2(q.y - p.y, q.x - p.x);
        };
        let left = Math.abs(lie(0.6) - lie(1));
        if (left > Math.PI) left = 2 * Math.PI - left;
        // (But for the wobble it has until the two touch.)
        expect(left * 180 / Math.PI, `${id} ${g[0]} still to turn at 0.6`).toBeLessThan(8);
      }
    }
  });

  it('a molecule that could have started any way round has at most a sixth of a turn to make', () => {
    for (const id of ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'coordination']) {
      const s = first(id);
      for (const pl of s.pulls!) for (const g of [component(s.before, pl.a), component(s.before, pl.b)]) {
        if (g.length < 2) continue;
        const p0 = s.before.atoms.get(g[0])!, q0 = s.before.atoms.get(g[1])!;
        const p1 = s.after.atoms.get(g[0])!, q1 = s.after.atoms.get(g[1])!;
        let turn = Math.abs(Math.atan2(q1.y - p1.y, q1.x - p1.x) - Math.atan2(q0.y - p0.y, q0.x - p0.x));
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        expect(turn * 180 / Math.PI, `${id} ${g[0]}`).toBeLessThan(70);
      }
    }
  });

  it('nothing is run into on the way', { timeout: 120000 }, () => {
    for (const id of [...together, 'coordination']) {
      for (const s of meet(id).steps) {
        if (!s.pulls?.length || s.phase) continue;
        const named = [...s.before.atoms.values()].filter((a) => !a.crowd && !a.gone);
        const group = new Map(named.map((a) => [a.id, component(s.before, a.id).sort()[0]]));
        for (let i = 0; i <= 120; i++) for (let p = 0; p < named.length; p++) for (let q = p + 1; q < named.length; q++) {
          const a = named[p], b = named[q];
          if (group.get(a.id) === group.get(b.id)) continue;
          const least = element(a.el).r + element(b.el).r - 1;
          expect(dist(pos(s, a.id, i / 120), pos(s, b.id, i / 120)), `${id} step ${s.index + 1} ${a.id}-${b.id} at ${i / 120}`).toBeGreaterThan(least);
        }
      }
    }
  });

  it('the water that splits a bond comes straight in from where it is', () => {
    const s = meet('condensation').steps.find((x) => /가수분해/.test(x.text))!;
    const s0 = was('condensation').steps.find((x) => /가수분해/.test(x.text))!;
    const water = (st: StepAnim) => {
      const o = st.shifts![0].src.a;
      return component(st.before, o);
    };
    const w = water(s);
    const end = 0.36;
    let sum = 0;
    for (let i = 1; i <= 100; i++) sum += dist(mid(s, w, end * (i - 1) / 100), mid(s, w, end * i / 100));
    const net = dist(mid(s, w, 0), mid(s, w, end));
    expect(net).toBeGreaterThan(10);
    expect(net).toBeLessThan(100);
    expect(sum).toBeLessThan(1.3 * net + 16);
    // Before: it went a longer way than it had come nearer.
    const w0 = water(s0);
    let sum0 = 0;
    for (let i = 1; i <= 100; i++) sum0 += dist(mid(s0, w0, end * (i - 1) / 100), mid(s0, w0, end * i / 100));
    expect(sum0).toBeGreaterThan(sum);
  });

  it('leaves the motion without it as it was', () => {
    const a = stiff('acid-hcl').steps[0];
    const b = compile(scene('acid-hcl'), { tight: true, tangible: true, reach: 'stiff', encounter: false }).timeline!.steps[0];
    for (const [id, tr] of a.tracks) expect(b.tracks.get(id)).toEqual(tr);
    expect(dist(a.before.atoms.get('a.H')!, a.before.atoms.get('w.O')!)).toBeGreaterThan(250);
    expect(dist(first('acid-hcl').before.atoms.get('a.H')!, first('acid-hcl').before.atoms.get('w.O')!)).toBeLessThan(160);
  });
});

describe('one event (instant)', () => {
  const made = new Map<string, ReturnType<typeof stiff>>();
  const force = (id: string) => {
    if (!made.has(id)) made.set(id, compile(scene(id), { tight: true, tangible: true, reach: 'firm', encounter: true, instant: true }).timeline!);
    return made.get(id)!;
  };
  const K = REACH_FIRM;
  const snapAt = (s: StepAnim) => s.phase!.b0 + (s.phase!.b1 - s.phase!.b0) * K.snap;
  const hitAt = (s: StepAnim) => s.phase!.b0 + (s.phase!.b1 - s.phase!.b0) * K.hit;

  it('ends every step in the world it says it ends in, with bonds kept at length', { timeout: 120000 }, () => {
    for (const id of scenes) {
      for (const s of force(id).steps) {
        for (const [aid, at] of s.after.atoms) expect(dist(pos(s, aid, 1), at), `${id} step ${s.index + 1} ${aid}`).toBeLessThan(0.6);
        const kept = [...s.before.bonds.values()].filter((bd) => s.after.bonds.get(bd.a < bd.b ? `${bd.a}|${bd.b}` : `${bd.b}|${bd.a}`)?.order === bd.order);
        for (let i = 0; i <= 50; i++) for (const bd of kept) {
          const A = s.before.atoms.get(bd.a)!;
          const B = s.before.atoms.get(bd.b)!;
          if (A.crowd || !s.after.atoms.has(bd.a) || !s.after.atoms.has(bd.b)) continue;
          const d0 = dist(A, B);
          const d1 = dist(s.after.atoms.get(bd.a)!, s.after.atoms.get(bd.b)!);
          const d = dist(pos(s, bd.a, i / 50), pos(s, bd.b, i / 50));
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeGreaterThan(Math.min(d0, d1) - 2.5);
          expect(d, `${id} step ${s.index + 1} ${bd.a}-${bd.b} at ${i / 50}`).toBeLessThan(Math.max(d0, d1) + 2.5);
        }
      }
    }
  });

  it('every step in which bonds change has its instant, and the heat comes in it', { timeout: 120000 }, () => {
    for (const id of scenes) {
      for (const s of force(id).steps) {
        if (!s.phase) continue;
        expect(s.instant, `${id} step ${s.index + 1}`).toBe('firm');
        expect(s.strike, `${id} step ${s.index + 1}`).toBeGreaterThanOrEqual(s.phase.b0);
        expect(s.strike!).toBeLessThanOrEqual(Math.max(s.phase.b1, s.phase.c1 ?? 1));
      }
    }
  });

  it('a group that takes the place of another: the new bond closes in the instant, and the one let go is thrown off in it', () => {
    const s = force('substitution').steps.find((x) => x.phase)!;
    expect(s.strike).toBeCloseTo(hitAt(s), 6);
    const d = (t: number) => dist(pos(s, 'n.N', t), pos(s, 'm.C', t));
    const end = dist(s.after.atoms.get('n.N')!, s.after.atoms.get('m.C')!);
    const gap = d(s.phase!.b0) - end;
    expect(gap).toBeGreaterThan(4);
    // Held until the snap (a little give), then closed within the crossing, in under two frames.
    expect(d(snapAt(s)) - end).toBeGreaterThan(0.75 * gap);
    expect(Math.abs(d(hitAt(s)) - end)).toBeLessThan(0.12 * gap + 0.5);
    expect((hitAt(s) - snapAt(s)) * s.duration).toBeLessThan(2 / 60);
    // Br: where it was until the instant, well away soon after (fastest at the start).
    const br = (t: number) => dist(pos(s, 'm.Br', t), pos(s, 'm.Br', snapAt(s)));
    expect(dist(pos(s, 'm.Br', snapAt(s)), pos(s, 'm.Br', s.phase!.b0))).toBeLessThan(3);
    expect(br(hitAt(s) + 0.08)).toBeGreaterThan(8);
    expect(br(hitAt(s) + 0.08)).toBeGreaterThan(br(1) * 0.3);
  });

  it('a bond that changes its order has its new length in the instant', () => {
    const s = force('addition').steps.find((x) => x.phase)!;
    const d = (t: number) => dist(pos(s, 'e.C1', t), pos(s, 'e.C2', t));
    const d0 = dist(s.before.atoms.get('e.C1')!, s.before.atoms.get('e.C2')!);
    const d1 = dist(s.after.atoms.get('e.C1')!, s.after.atoms.get('e.C2')!);
    expect(Math.abs(d1 - d0)).toBeGreaterThan(1);
    expect(Math.abs(d(snapAt(s)) - d0)).toBeLessThan(0.25 * Math.abs(d1 - d0) + 0.3);
    expect(Math.abs(d(hitAt(s)) - d1)).toBeLessThan(0.15 * Math.abs(d1 - d0) + 0.3);
  });

  it('a net reaction is one event: both exchanges in the same instant, and the water is thrown off at once', () => {
    const tl = force('condensation');
    const s = tl.steps.find((x) => x.shifts?.length === 4)!;
    expect(s.strike).toBeCloseTo(hitAt(s), 6);
    for (const h of s.handed ?? []) {
      expect(h.t0).toBeCloseTo(s.phase!.b0, 6);
      expect(h.t1).toBeCloseTo(s.phase!.b1, 6);
    }
    const o = s.shifts![1].dst.a;
    const moved = (t: number) => dist(pos(s, o, t), pos(s, o, hitAt(s)));
    expect(moved(hitAt(s) + 0.1)).toBeGreaterThan(8);
    expect((hitAt(s) - snapAt(s)) * s.duration).toBeLessThan(2 / 60);
  });

  it('single electrons leap, each in a few frames, and each landing is an instant of the heat', () => {
    expect(hopFlight(HOP_WAIT, true)).toBe(0);
    expect(hopFlight(HOP_WAIT + 0.5 * (1 - HOP_WAIT), true)).toBeGreaterThan(0.8);
    expect(hopFlight(1, true)).toBe(1);
    expect(hopFlight(0.5)).toBeCloseTo(0.5, 6);
    const s = force('redox').steps.find((x) => x.phase && x.energy)!;
    expect(s.strikes?.length).toBe(2);
    expect(s.strikes![0]).toBeLessThan(s.strikes![1]);
    for (const at of s.strikes!) {
      expect(at).toBeGreaterThan(s.phase!.b0);
      expect(at).toBeLessThanOrEqual(s.phase!.b1 + 1e-9);
    }
    // The leap itself: a seventh of each electron's turn.
    const turn = (s.phase!.b1 - s.phase!.b0) * 0.8 / 2 * s.duration;
    expect(turn * (1 - HOP_WAIT)).toBeLessThan(0.09);
  });

  it('leaves the motion without it as it was', () => {
    const a = compile(scene('substitution'), { tight: true, tangible: true, reach: 'firm', encounter: true }).timeline!.steps.find((x) => x.phase)!;
    expect(a.instant).toBeUndefined();
    expect(a.strikes).toBeUndefined();
  });
});

describe('the opening captions of a lesson', () => {
  it('only tell: nothing moves and nothing changes in them, and the scene after is as without them', { timeout: 120000 }, () => {
    for (const c of CHAPTERS) {
      const full = compile(c.script, { tight: true, tangible: true, reach: 'firm', encounter: true, instant: true }).timeline!;
      const bare = compile(sceneOf(c.script), { tight: true, tangible: true, reach: 'firm', encounter: true, instant: true }).timeline!;
      const opening = full.steps.length - bare.steps.length;
      expect(opening, c.id).toBeGreaterThan(0);
      for (const st of full.steps.slice(0, opening)) {
        // (Nothing is moved by them; the first step of a scene may still settle what the header placed too close.)
        for (const [id, a] of st.after.atoms) {
          const b = st.before.atoms.get(id);
          if (b && !a.crowd) expect(dist(a, b), `${c.id} ${id} in: ${st.text}`).toBeLessThan(0.5);
        }
        expect(st.arrows.length).toBe(0);
        expect([...st.after.bonds.keys()].sort()).toEqual([...st.before.bonds.keys()].sort());
      }
      expect(full.steps.slice(opening).map((x) => x.text)).toEqual(bare.steps.map((x) => x.text));
    }
  });
});
