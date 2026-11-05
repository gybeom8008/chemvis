import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { allComponents, formulaOf, oxidationState, type World } from '../../src/engine/world';

const species = (w: World) =>
  allComponents(w)
    .filter((c) => !w.atoms.get(c[0])!.crowd)
    .map((c) => formulaOf(w, c))
    .sort();

describe('single-electron moves (hop)', () => {
  it('zinc gives two electrons to a copper ion: Zn + Cu2+ → Zn2+ + Cu', () => {
    const r = compile(`
stage solution
mol z = Zn at left
mol c = Cu2+ at right
step "다가간다"
  approach c.Cu z.Zn
step "전자 두 개가 옮겨 간다"
  hop 2 z.Zn -> c.Cu
`);
    expect(r.errors).toEqual([]);
    const w = r.timeline!.steps[1].after;
    expect(species(w)).toEqual(['Cu', 'Zn2+']);
    expect(oxidationState(w, w.atoms.get('z.Zn')!)).toBe(2);
    expect(oxidationState(w, w.atoms.get('c.Cu')!)).toBe(0);
    expect(r.timeline!.steps[1].arrows.map((a) => a.kind)).toEqual(['single', 'single']);
  });

  it('light splits Cl2 into two chlorine radicals (homolysis)', () => {
    const r = compile(`
stage gas
mol c = Cl2 at left
step "빛"
  light c
  hop c.Cl1~c.Cl2 -> c.Cl1
  hop c.Cl1~c.Cl2 -> c.Cl2
`);
    expect(r.errors).toEqual([]);
    const s = r.timeline!.steps[0];
    expect(species(s.after)).toEqual(['Cl·', 'Cl·']);
    expect(s.photons.length).toBe(1);
    // While the electrons are in flight the bond is already gone.
    expect(s.mid.bonds.size).toBe(0);
  });

  it('a chlorine radical takes H from methane: Cl· + CH4 → HCl + CH3·', () => {
    const r = compile(`
stage gas
mol x = Cl· at left
mol m = CH4 at right
step "다가간다"
  approach x.Cl m.H1
step "수소 떼어 가기"
  hop x.Cl -> x.Cl~m.H1
  hop m.C~m.H1 -> x.Cl~m.H1
  hop m.C~m.H1 -> m.C
`);
    expect(r.errors).toEqual([]);
    expect(species(r.timeline!.steps[1].after)).toEqual(['CH3·', 'HCl']);
  });

  it('a bond left with one electron is reported on the hop line', () => {
    const r = compile(`
stage gas
mol c = Cl2 at left
step "반쪽만"
  hop c.Cl1~c.Cl2 -> c.Cl1
`);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].line).toBe(5);
    expect(r.errors[0].message).toContain('홀수');
  });

  it('cannot move an electron that is not there', () => {
    const r = compile(`
stage solution
mol c = Cu2+ at right
mol z = Zn at left
step "잘못"
  hop c.Cu -> z.Zn
`);
    expect(r.errors[0].message).toContain('옮길 비결합 전자가 없어요');
  });
});

describe('oxidation states', () => {
  it('water: O is −2, H is +1; chloride −1', () => {
    const r = compile('stage solution\nmol w = H2O\nmol c = Cl-\nstep "a"\n  wait\n');
    const w = r.timeline!.initial;
    expect(oxidationState(w, w.atoms.get('w.O')!)).toBe(-2);
    expect(oxidationState(w, w.atoms.get('w.H1')!)).toBe(1);
    expect(oxidationState(w, w.atoms.get('c.Cl')!)).toBe(-1);
  });
  it('accepts radical spellings Cl. and Cl*', () => {
    expect(compile('stage gas\nmol a = Cl.\nmol b = Cl*\nstep "a"\n  wait\n').errors).toEqual([]);
  });
});
