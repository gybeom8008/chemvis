import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { SNATCH, snatchAt, snatchPairs, trackAt, type StepAnim } from '../../src/engine/timeline';
import { component, neighbors } from '../../src/engine/world';
import { element } from '../../src/chem/elements';
import { CHAPTERS } from '../../src/tutorial/chapters';
import { dist, type Vec } from '../../src/util/math';

/**
 * Motion that reads as bodies moved by forces (CompileOptions.tangible). These check the shape of
 * the paths in numbers: what is pulled speeds up until it meets, an atom handed over is let go
 * before it is taken, what is in the way gives as the other comes near and not before.
 */
const scene = (id: string) => CHAPTERS.find((c) => c.id === id)!.script;
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
