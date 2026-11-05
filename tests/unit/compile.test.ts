import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { allComponents, formalCharge, formulaOf } from '../../src/engine/world';
import type { World } from '../../src/engine/world';

const species = (w: World) =>
  allComponents(w)
    .filter((c) => !w.atoms.get(c[0])!.crowd)
    .map((c) => formulaOf(w, c))
    .sort();

describe('acid–base by curved arrows', () => {
  const src = `
scene "HCl + H2O"
stage solution
mol a = HCl at left
mol w = H2O at right
step "다가간다"
  approach w.O a.H
step "양성자가 옮겨 간다"
  arrow w.O:lp -> w.O~a.H
  arrow a.H~a.Cl -> a.Cl
`;
  it('derives H3O+ and Cl- with the right formal charges', () => {
    const r = compile(src);
    expect(r.errors).toEqual([]);
    const last = r.timeline!.steps[1].after;
    expect(species(last)).toEqual(['Cl-', 'H3O+']);
    expect(formalCharge(last, last.atoms.get('w.O')!)).toBe(1);
    expect(formalCharge(last, last.atoms.get('a.Cl')!)).toBe(-1);
    expect(last.atoms.get('a.Cl')!.lp).toBe(4);
  });
  it('transfer is the same two arrows', () => {
    const r = compile(src.replace(/arrow w.O:lp[^\n]*\n\s*arrow[^\n]*/, 'transfer a.H to w.O'));
    expect(r.errors).toEqual([]);
    expect(species(r.timeline!.steps[1].after)).toEqual(['Cl-', 'H3O+']);
    expect(r.timeline!.steps[1].arrows.length).toBe(2);
  });
  it('reports an over-full octet with the line number', () => {
    const r = compile(`
mol a = HCl at left
mol w = H2O at right
step "잘못된 화살표"
  arrow w.O:lp -> w.O~a.H
`);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].line).toBe(5);
    expect(r.errors[0].message).toContain('전자가 4개');
  });
});

describe('script errors', () => {
  it('unknown stage, op and molecule', () => {
    expect(compile('stage moon').errors[0].message).toContain('무대');
    expect(compile('mol x = Unobtainium\nstep "a"\n  wait').errors[0].message).toContain('등록되지 않은');
    expect(compile('step "a"\n  fly x').errors[0].message).toContain('모르는 명령');
  });
  it('ambiguous atom reference', () => {
    const r = compile('mol w = H2O\nstep "a"\n  note w.H "수소"');
    expect(r.errors[0].message).toContain('여러 개');
  });
});

describe('soil: exchange and leaching', () => {
  it('rejects unbalanced charge', () => {
    const r = compile(`
stage soil
mol c = Ca2+ on clay in topsoil
step "교환"
  exchange c with H+ on clay
`);
    expect(r.errors[0].message).toContain('전하가 맞지 않아요');
  });
  it('balanced exchange then leaching to subsoil', () => {
    const r = compile(`
stage soil
mol c = Ca2+ on clay in topsoil
step "교환"
  exchange c with 2 H+ on clay
step "씻겨 내려감"
  leach c from topsoil to subsoil
`);
    expect(r.errors).toEqual([]);
    const w = r.timeline!.steps[1].after;
    const ca = w.atoms.get('c.Ca')!;
    expect(ca.y).toBeGreaterThan(480);
    expect(ca.y).toBeLessThan(800);
    expect(w.sites.filter((s) => s.occupant).length).toBe(2);
  });
});

describe('phase changes', () => {
  it('evaporation moves a surface water molecule into the air', () => {
    const r = compile(`
stage interface
crowd H2O in water 30
step "증발"
  evaporate H2O
`);
    expect(r.errors).toEqual([]);
    const s = r.timeline!.steps[0];
    const id = [...s.focus][0];
    expect(s.before.atoms.get(id)!.y).toBeGreaterThan(250);
    expect(s.after.atoms.get(id)!.y).toBeLessThan(250);
  });
  it('dissolving takes ions out of the crystal with a water shell', () => {
    const r = compile(`
stage solution
crowd H2O in water 40
crystal s = NaCl at bottom 4x3
step "녹는다"
  dissolve 2 from s
`);
    expect(r.errors).toEqual([]);
    const w = r.timeline!.steps[0].after;
    expect(w.crystals.get('s')!.length).toBe(10);
    expect(w.attached.size).toBe(2);
  });
  it('a crystal of polyatomic ions dissolves ion by ion and grows back into its holes', () => {
    const r = compile(`
stage solution
crowd H2O in water 20
crystal s = CaCO3 at water 4x2
step "녹는다"
  dissolve s1 s2 from s
step "다시 결정이 된다"
  precipitate Ca2+ CO32- onto s
`);
    expect(r.errors).toEqual([]);
    const [a, b] = r.timeline!.steps;
    const start = r.timeline!.initial;
    expect(start.crystals.get('s')!.length).toBe(20);
    expect(a.after.crystals.get('s')!.length).toBe(15);
    expect(species(a.after).filter((f) => f === 'CO32-').length).toBe(4);
    expect(b.after.crystals.get('s')!.length).toBe(20);
    // Each ion goes back into a hole of its own kind.
    const ca = b.after.atoms.get('s1.Ca')!;
    const ca0 = start.atoms.get('s1.Ca')!;
    expect(Math.hypot(ca.x - ca0.x, ca.y - ca0.y)).toBeLessThan(3);
  });
  it('splits salts into their ions, and says what it cannot draw', () => {
    for (const salt of ['NaCl', 'AgCl', 'CaSO4', 'Ca2+ CO32-']) {
      expect(compile(`stage solution\ncrystal s = ${salt} at water 2x2\nstep "x"\n  wait\n`).errors).toEqual([]);
    }
    expect(compile(`stage solution\ncrystal s = CaCl2 at water 2x2\nstep "x"\n  wait\n`).errors.length).toBe(1);
  });
});

describe('collective mode', () => {
  const script = (arrow: string) => `
stage gas
place H2 in air x8
place I2 in air x8
step "부딪친다"
  ensemble H2 + I2 ${arrow} 2 HI for 10s
`;
  it('conserves atoms, records bond events and keeps counts consistent', () => {
    const r = compile(script('<=>'));
    expect(r.errors).toEqual([]);
    const s = r.timeline!.steps[0];
    expect(s.duration).toBe(10);
    expect(s.events.length).toBeGreaterThan(0);
    expect(s.events.every((e, i) => i === 0 || e.t >= s.events[i - 1].t)).toBe(true);
    for (const e of s.tally) {
      const n = Object.fromEntries(e.counts);
      // Every H atom and every I atom is in exactly one molecule.
      expect(2 * n.H2 + n.HI).toBe(16);
      expect(2 * n.I2 + n.HI).toBe(16);
    }
    const end = Object.fromEntries(s.tally[s.tally.length - 1].counts);
    expect(end.HI).toBeGreaterThan(0);
    // The world at the end agrees with the last count.
    const sp = species(s.after);
    expect(sp.filter((f) => f === 'HI').length).toBe(end.HI);
    // Replaying the events on the starting bonds gives the end bonds.
    const bonds = new Map([...s.before.bonds.keys()].map((k) => [k, true]));
    for (const e of s.events) {
      const k = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
      if (e.order > 0) bonds.set(k, true);
      else bonds.delete(k);
    }
    expect([...bonds.keys()].sort()).toEqual([...s.after.bonds.keys()].sort());
  });
  it('one-way reaction only makes HI', () => {
    const r = compile(script('->'));
    expect(r.errors).toEqual([]);
    const counts = r.timeline!.steps[0].tally.map((e) => Object.fromEntries(e.counts).HI);
    expect(counts.every((n, i) => i === 0 || n >= counts[i - 1])).toBe(true);
  });
  it('works for the other hydrogen halides', () => {
    for (const [x, p] of [
      ['Cl2', 'HCl'],
      ['Br2', 'HBr'],
      ['F2', 'HF'],
    ]) {
      const r = compile(`
stage gas
place H2 in air x6
place ${x} in air x6
step "x"
  ensemble H2 + ${x} -> 2 ${p} for 8s
`);
      expect(r.errors).toEqual([]);
      const end = r.timeline!.steps[0].tally.at(-1)!.counts;
      expect(end[2][0]).toBe(p);
      expect(end[2][1]).toBeGreaterThan(0);
    }
  });
  it('rejects shapes it cannot draw', () => {
    const r = compile(`
stage gas
place H2 in air x4
step "x"
  ensemble H2 + O2 <=> H2O2
`);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
