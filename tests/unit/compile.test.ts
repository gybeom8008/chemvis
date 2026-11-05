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
});
