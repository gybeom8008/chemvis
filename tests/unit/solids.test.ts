import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { formalCharge, type World } from '../../src/engine/world';

const end = (src: string): World => {
  const r = compile(src);
  expect(r.errors).toEqual([]);
  return r.timeline!.steps.at(-1)!.after;
};
const fails = (src: string) => expect(compile(src).timeline).toBeNull();
const electrons = (w: World) => {
  let e = 0;
  for (const a of w.atoms.values()) if (!a.crowd) e += 2 * a.lp + a.rad;
  for (const b of w.bonds.values()) if (!w.atoms.get(b.a)!.crowd) e += 2 * b.order;
  return e;
};

const IONS = `stage solution
mol a1 = Ag+ at 300,220
mol a2 = Ag+ at 690,200
mol a3 = Ag+ at 280,420
mol b1 = Cl- at 470,250
mol b2 = Cl- at 640,400
mol b3 = Cl- at 420,430
`;

describe('precipitate using: only the ions that were named become solid', () => {
  it('takes exactly the named pair, not the first ions of that formula', () => {
    const w = end(`${IONS}step "x"\n  precipitate using a3 b2 as s`);
    expect([...w.crystals.get('s')!].sort()).toEqual(['a3.Ag', 'b2.Cl']);
    expect(formalCharge(w, w.atoms.get('a3.Ag')!)).toBe(1);
    expect(formalCharge(w, w.atoms.get('b2.Cl')!)).toBe(-1);
    expect(w.bonds.size).toBe(0);
    expect(electrons(w)).toBe(24);
  });
  it('the solid grows one pair at a time, and the ions already in it stay where they are', () => {
    const r = compile(`${IONS}step "1"\n  precipitate using a3 b2 as s\nstep "2"\n  precipitate using a1 b1 onto s\nstep "3"\n  precipitate using a2 b3 onto s`);
    expect(r.errors).toEqual([]);
    const [s1, s2, s3] = r.timeline!.steps.map((s) => s.after);
    expect(s1.crystals.get('s')!.length).toBe(2);
    expect(s2.crystals.get('s')!.length).toBe(4);
    expect(s3.crystals.get('s')!.length).toBe(6);
    for (const id of ['a3.Ag', 'b2.Cl']) {
      expect(s3.atoms.get(id)!.x).toBeCloseTo(s1.atoms.get(id)!.x, 3);
      expect(s3.atoms.get(id)!.y).toBeCloseTo(s1.atoms.get(id)!.y, 3);
    }
    // Every ion sits beside ions of the other sign only.
    const ions = s3.crystals.get('s')!.map((id) => s3.atoms.get(id)!);
    const gap = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    const step = gap(s1.atoms.get('a3.Ag')!, s1.atoms.get('b2.Cl')!);
    for (const p of ions) {
      for (const q of ions) {
        if (p === q) continue;
        expect(gap(p, q)).toBeGreaterThan(step * 0.9);
        if (gap(p, q) < step * 1.2) expect(p.el).not.toBe(q.el);
      }
    }
  });
  it('refuses the same ion twice, an ion already in a solid, a name that was not declared, and a solid of another salt', () => {
    fails(`${IONS}step "x"\n  precipitate using a1 a1`);
    fails(`${IONS}step "x"\n  precipitate using a1 b1 as s\nstep "y"\n  precipitate using a1 b2 onto s`);
    fails(`${IONS}step "x"\n  precipitate using Ag+ Cl-`);
    fails(`${IONS}crystal n = NaCl at bottom 2x1\nstep "x"\n  precipitate using a1 b1 onto n`);
  });
});

const PIECE = `stage solution
metal m = Zn at 420,330 3x2
mol a1 = Ag+ at 640,200
mol a2 = Ag+ at 700,330
`;

describe('a piece of metal gives electrons to ions that touch it', () => {
  it('one surface atom leaves as an ion; the silver stays on the piece', () => {
    const w = end(`${PIECE}step "1"\n  land a1 a2 on m3\nstep "2"\n  hop m3.Zn -> a1.Ag\n  hop m3.Zn -> a2.Ag\n  join a1 a2 to m\nstep "3"\n  leave m3 from m`);
    expect([...w.crystals.get('m')!].sort()).toEqual(['a1.Ag', 'a2.Ag', 'm1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']);
    const zn = w.atoms.get('m3.Zn')!;
    expect(formalCharge(w, zn)).toBe(2);
    expect(zn.lattice).toBeFalsy();
    for (const id of ['a1.Ag', 'a2.Ag']) {
      expect(formalCharge(w, w.atoms.get(id)!)).toBe(0);
      expect(w.atoms.get(id)!.lattice).toBe(true);
    }
    for (const id of ['m1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']) expect(formalCharge(w, w.atoms.get(id)!)).toBe(0);
    // Six Zn with two outer electrons each: twelve before and after. Total charge +2 (the counter-ions are left out).
    expect(electrons(w)).toBe(12);
  });
  it('the two ions rest on different spots and do not overlap any atom of the piece', () => {
    const r = compile(`${PIECE}step "1"\n  land a1 a2 on m3`);
    const w = r.timeline!.steps[0].after;
    const a1 = w.atoms.get('a1.Ag')!;
    const a2 = w.atoms.get('a2.Ag')!;
    expect(Math.hypot(a1.x - a2.x, a1.y - a2.y)).toBeGreaterThan(40);
    for (const id of ['m1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']) {
      const z = w.atoms.get(id)!;
      for (const a of [a1, a2]) expect(Math.hypot(a.x - z.x, a.y - z.y)).toBeGreaterThan(38);
    }
  });
  it('an ion cannot join before it has its electron, and an atom cannot leave before it has given its electrons', () => {
    fails(`${PIECE}step "1"\n  land a1 a2 on m3\nstep "2"\n  join a1 to m`);
    fails(`${PIECE}step "1"\n  leave m3 from m`);
  });
});
