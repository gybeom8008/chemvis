import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { allComponents, formalCharge, formulaOf, oxidationState, type World } from '../../src/engine/world';

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

describe('coordination bonds', () => {
  it('Cu2+ + 4 NH3 → [Cu(NH3)4]2+ keeps +2 on copper and 0 on nitrogen', () => {
    const r = compile(`
stage solution
mol c = Cu2+ at center
mol n1 = NH3 at 320,310
mol n2 = NH3 at 680,310
step "결합"
  ligand n1.N -> c.Cu
  ligand n2.N -> c.Cu
`);
    expect(r.errors).toEqual([]);
    const w = r.timeline!.steps[0].after;
    expect(formalCharge(w, w.atoms.get('c.Cu')!)).toBe(2);
    expect(formalCharge(w, w.atoms.get('n1.N')!)).toBe(0);
    expect(oxidationState(w, w.atoms.get('c.Cu')!)).toBe(2);
    expect(species(w)).toEqual(['CuH6N22+']);
  });
  it('unligand returns the pair to the ligand', () => {
    const r = compile(`
stage solution
mol c = Cu2+ at center
mol n = NH3 at 320,310
step "결합"
  ligand n.N -> c.Cu
step "풀림"
  unligand c.Cu~n.N
`);
    expect(r.errors).toEqual([]);
    expect(species(r.timeline!.steps[1].after)).toEqual(['Cu2+', 'NH3']);
  });
});

describe('electrochemical cell', () => {
  const cell = (wireN: number) => `
stage cell
electrode left = Zn
electrode right = Cu
mol c = Cu2+ in right
step "산화"
  oxidize left
step "도선"
  wire ${wireN}
step "환원"
  reduce c at right
step "염다리"
  bridge Cl- K+ x2
`;
  it('Zn plate → Zn2+, electrons through the wire, Cu2+ → Cu on the plate', () => {
    const r = compile(cell(2));
    expect(r.errors).toEqual([]);
    const s = r.timeline!.steps;
    expect(s[0].after.plate.left).toBe(2);
    expect(s[1].after.plate.right).toBe(2);
    const w = s[2].after;
    expect(w.plate.right).toBe(0);
    expect(w.atoms.get('c.Cu')!.lattice).toBe(true);
    expect(formalCharge(w, w.atoms.get('c.Cu')!)).toBe(0);
    const freeZn = [...w.atoms.values()].filter((a) => a.el === 'Zn' && !a.lattice);
    expect(freeZn.length).toBe(1);
    expect(formalCharge(w, freeZn[0])).toBe(2);
    expect(s[3].after.atoms.size).toBe(s[2].after.atoms.size + 4);
  });
  it('too few electrons at the reduction electrode is an error', () => {
    const r = compile(cell(1));
    expect(r.errors[0].message).toContain('전자가 1개뿐');
  });
});

describe('condensation and hydrolysis', () => {
  it('two glycines join with loss of water, then split again', () => {
    const r = compile(`
stage solution
mol g1 = Gly at 330,300
mol g2 = Gly at 670,300
step "축합"
  condensation g1.C2 g2.N
step "가수분해"
  hydrolysis g1.C2~g2.N
`);
    expect(r.errors).toEqual([]);
    expect(species(r.timeline!.steps[0].after)).toEqual(['C4H8N2O3', 'H2O']);
    expect(species(r.timeline!.steps[1].after)).toEqual(['C2H5NO2', 'C2H5NO2']);
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
