import { describe, expect, it } from 'vitest';
import document from '../../docs/plan/lab-rows-stage1.md?raw';
import { addSpecies, compile, compileFrom } from '../../src/engine/compile';
import { allComponents, bondKey, cloneWorld, formalCharge, type World } from '../../src/engine/world';
import { getStage } from '../../src/stage/stages';

type EventId = 'A01' | 'A02' | 'A05' | 'P01' | 'D01' | 'R01' | 'R02' | 'R03';
type AtomState = readonly [element: string, lp: number, rad: number, charge: number, lattice: boolean];
interface Outcome {
  atoms: Record<string, AtomState>;
  components: string[][];
  bonds: [string, string][];
  crystals: Record<string, string[]>;
  // Includes the one Na+ observer, excludes all crowd water.
  totals: readonly [atoms: number, electrons: number, charge: number];
}

const stage = getStage('solution')!;
const observer = 'observer.Na';
const hydrogens = (...ids: string[]): Record<string, AtomState> => Object.fromEntries(ids.map((id) => [id, ['H', 0, 0, 0, false]]));
const star = (center: string, ...ids: string[]): [string, string][] => ids.map((id) => [center, id]);
const orderedComponents = (cs: string[][]) => cs.map((c) => [...c].sort()).sort((a, b) => a.join('|').localeCompare(b.join('|')));
const tracked = (w: World) => [...w.atoms.values()].filter((a) => !a.crowd);
const totals = (w: World) => {
  const atoms = tracked(w);
  const bonds = [...w.bonds.values()].filter((b) => !w.atoms.get(b.a)!.crowd && !w.atoms.get(b.b)!.crowd);
  return [atoms.length, atoms.reduce((s, a) => s + 2 * a.lp + a.rad, 0) + bonds.reduce((s, b) => s + 2 * b.order, 0),
    atoms.reduce((s, a) => s + formalCharge(w, a), 0)];
};

/** Read the actual document scripts, so editing a template changes the acceptance input too. */
const section = (id: EventId) => {
  const start = document.indexOf(`### ${id} —`);
  expect(start, `missing ${id} in the document`).toBeGreaterThan(-1);
  return document.slice(start).split(/\n#{2,3} /, 1)[0];
};
const blocks = (id: EventId) => [...section(id).matchAll(/```text\r?\n([\s\S]*?)```/g)].map((m) => m[1].trim());
const documentSteps = (id: EventId, index = 0) => {
  const scripts = blocks(id).filter((b) => b.startsWith('step '));
  expect(scripts.length, `missing ${id} step template`).toBeGreaterThan(index);
  return scripts[index];
};

const steps = (id: EventId) => documentSteps(id);

const fixture = (header: string): World => {
  const r = compile(`stage solution\n${header}\nmol observer = Na+ at 850,170`);
  expect(r.errors).toEqual([]);
  expect(r.timeline!.steps).toHaveLength(0);
  return r.timeline!.initial;
};
const run = (base: World, script: string) => {
  const saved = cloneWorld(base);
  const r = compileFrom(base, stage, script);
  expect(r.errors).toEqual([]);
  expect(base).toEqual(saved);
  if (!r.timeline) throw new Error(JSON.stringify(r.errors));
  expect(r.timeline.initial).toEqual(saved);
  // No fixed coordinates or animation assertions: only the observer must remain where it was.
  expect(r.end.atoms.get(observer)).toEqual(saved.atoms.get(observer));
  expect(r.end.attached.get(observer)).toEqual(saved.attached.get(observer));
  expect(r.end.names.get('observer')).toBe(saved.names.get('observer'));
  expect([...r.end.crystals.values()].some((ids) => ids.includes(observer))).toBe(false);
  return r;
};
const assertOutcome = (base: World, end: World, outcome: Outcome) => {
  const expected: Record<string, AtomState> = { ...outcome.atoms, [observer]: ['Na', 0, 0, 1, false] };
  expect(tracked(end).map((a) => a.id).sort()).toEqual(Object.keys(expected).sort());
  expect(tracked(end).map((a) => a.id).sort()).toEqual(tracked(base).map((a) => a.id).sort());
  for (const [id, [el, lp, rad, q, lattice]] of Object.entries(expected)) {
    const a = end.atoms.get(id)!;
    expect([a.el, a.lp, a.rad, formalCharge(end, a), !!a.lattice], id).toEqual([el, lp, rad, q, lattice]);
    const original = base.atoms.get(id)!;
    expect([a.owner, a.label, a.num, a.crowd], id).toEqual([original.owner, original.label, original.num, original.crowd]);
  }
  const materialComponents = allComponents(end).filter((c) => c.some((id) => !end.atoms.get(id)!.crowd));
  expect(orderedComponents(materialComponents)).toEqual(orderedComponents([...outcome.components, [observer]]));
  const materialBonds = [...end.bonds.values()].filter((b) => !end.atoms.get(b.a)!.crowd || !end.atoms.get(b.b)!.crowd);
  expect(materialBonds.map((b) => [bondKey(b.a, b.b), b.order, b.dative ?? null]).sort()).toEqual(
    outcome.bonds.map(([a, b]) => [bondKey(a, b), 1, null]).sort(),
  );
  expect([...end.crystals].map(([name, ids]) => [name, [...ids].sort()]).sort()).toEqual(
    Object.entries(outcome.crystals).map(([name, ids]) => [name, [...ids].sort()]).sort(),
  );
  expect(totals(end)).toEqual(outcome.totals);
  expect(totals(end)).toEqual(totals(base));
};
const assertHydrated = (w: World, id: string) => {
  const shell = w.attached.get(id);
  expect(shell, `${id} hydration shell`).toBeDefined();
  expect(shell!.length).toBeGreaterThan(0);
  expect(new Set(shell).size).toBe(shell!.length);
  for (const anchor of shell!) expect(w.atoms.get(anchor)!.crowd).toBe(true);
};
const assertFailure = (base: World, script: string, message: string) => {
  const saved = cloneWorld(base);
  const r = compileFrom(base, stage, script);
  expect(r.errors.some((e) => e.message.includes(message))).toBe(true);
  expect(r.timeline).toBeNull();
  expect(r.end).toBeNull();
  expect(r.effects).toEqual([]);
  expect(base).toEqual(saved);
  expect(base.atoms.get(observer)).toEqual(saved.atoms.get(observer));
};

const acidHeader = {
  A01: 'mol a = H3O+ at 280,260\nmol b = OH- at 500,300',
  A02: 'mol a = H3O+ at 280,260\nmol b = NH3 at 500,300',
  A05: 'mol n = NH4+ at 280,260\nmol o = OH- at 500,300',
};
const acidOutcome: Record<keyof typeof acidHeader, Outcome> = {
  A01: {
    atoms: { 'a.O': ['O', 2, 0, 0, false], 'b.O': ['O', 2, 0, 0, false], ...hydrogens('a.H1', 'a.H2', 'a.H3', 'b.H') },
    components: [['a.O', 'a.H2', 'a.H3'], ['b.O', 'b.H', 'a.H1']],
    bonds: [...star('a.O', 'a.H2', 'a.H3'), ...star('b.O', 'b.H', 'a.H1')], crystals: {}, totals: [7, 16, 1],
  },
  A02: {
    atoms: { 'a.O': ['O', 2, 0, 0, false], 'b.N': ['N', 0, 0, 1, false], ...hydrogens('a.H1', 'a.H2', 'a.H3', 'b.H1', 'b.H2', 'b.H3') },
    components: [['a.O', 'a.H2', 'a.H3'], ['b.N', 'b.H1', 'b.H2', 'b.H3', 'a.H1']],
    bonds: [...star('a.O', 'a.H2', 'a.H3'), ...star('b.N', 'b.H1', 'b.H2', 'b.H3', 'a.H1')], crystals: {}, totals: [9, 16, 2],
  },
  A05: {
    atoms: { 'n.N': ['N', 1, 0, 0, false], 'o.O': ['O', 2, 0, 0, false], ...hydrogens('n.H1', 'n.H2', 'n.H3', 'n.H4', 'o.H') },
    components: [['n.N', 'n.H2', 'n.H3', 'n.H4'], ['o.O', 'o.H', 'n.H1']],
    bonds: [...star('n.N', 'n.H2', 'n.H3', 'n.H4'), ...star('o.O', 'o.H', 'n.H1')], crystals: {}, totals: [8, 16, 1],
  },
};

describe('stage 1 document: eight positive events', () => {
  it.each(['A01', 'A02', 'A05'] as const)('%s preserves IDs and produces the specified proton-transfer products', (id) => {
    const base = fixture(acidHeader[id]);
    const r = run(base, steps(id));
    assertOutcome(base, r.end, acidOutcome[id]);
  });

  it('P01 keeps the two ionic charges and creates only the selected solid membership', () => {
    const base = fixture('mol a = Ag+ at 300,260\nmol b = Cl- at 500,300');
    const r = run(base, steps('P01'));
    expect(r.effects).toHaveLength(1);
    const s = r.effects[0].crystalName;
    expect(r.effects[0]).toMatchObject({ kind: 'precipitate', addedAtomIds: ['a.Ag', 'b.Cl'], onto: false });
    assertOutcome(base, r.end, {
      atoms: { 'a.Ag': ['Ag', 0, 0, 1, false], 'b.Cl': ['Cl', 4, 0, -1, false] },
      components: [['a.Ag'], ['b.Cl']], bonds: [], crystals: { [s]: ['a.Ag', 'b.Cl'] }, totals: [3, 8, 1],
    });
    expect(r.end.attached.has('a.Ag')).toBe(false);
    expect(r.end.attached.has('b.Cl')).toBe(false);
  });

  it('D01 dissolves the minimal formula unit without consuming the selected water', () => {
    const base = fixture('crystal s = NaCl at bottom 2x1\nmol w = H2O at 220,260');
    const r = run(base, steps('D01'));
    assertOutcome(base, r.end, {
      atoms: { 's1.Na': ['Na', 0, 0, 1, false], 's2.Cl': ['Cl', 4, 0, -1, false], 'w.O': ['O', 2, 0, 0, false], ...hydrogens('w.H1', 'w.H2') },
      components: [['s1.Na'], ['s2.Cl'], ['w.O', 'w.H1', 'w.H2']], bonds: star('w.O', 'w.H1', 'w.H2'),
      crystals: { s: [] }, totals: [6, 16, 1],
    });
    assertHydrated(r.end, 's1.Na');
    assertHydrated(r.end, 's2.Cl');
  });

  it('D01 releases the same two IDs from a 12-ion crystal and retains the other ten', () => {
    const base = fixture('crystal s = NaCl at bottom 4x3\nmol w = H2O at 220,260');
    const r = run(base, steps('D01'));
    const ions = ['s1.Na', 's2.Cl', 's3.Na', 's4.Cl', 's5.Cl', 's6.Na', 's7.Cl', 's8.Na', 's9.Na', 's10.Cl', 's11.Na', 's12.Cl'];
    const atoms: Record<string, AtomState> = { 'w.O': ['O', 2, 0, 0, false], ...hydrogens('w.H1', 'w.H2') };
    for (const id of ions) atoms[id] = id.endsWith('.Na') ? ['Na', 0, 0, 1, false] : ['Cl', 4, 0, -1, false];
    assertOutcome(base, r.end, {
      atoms, components: [...ions.map((id) => [id]), ['w.O', 'w.H1', 'w.H2']], bonds: star('w.O', 'w.H1', 'w.H2'),
      crystals: { s: ions.slice(2) }, totals: [16, 56, 1],
    });
    assertHydrated(r.end, 's1.Na');
    assertHydrated(r.end, 's2.Cl');
    for (const id of ions.slice(2)) expect(r.end.attached.has(id)).toBe(false);
    assertFailure(r.end, steps('D01'), '결정');
  });

  it.each(['R01', 'R02', 'R03'] as const)('%s transfers exactly two electrons, joins reduced metal and releases the donor', (id) => {
    const donor = id === 'R03' ? 'Cu' : 'Zn';
    const headers = blocks(id).filter((b) => !b.startsWith('step '));
    expect(headers).toHaveLength(1);
    const base = fixture(headers[0]);
    const r = run(base, steps(id));
    assertOutcome(base, r.end, metalOutcome(id));
    expect(r.end.atoms.get(`m3.${donor}`)!.lattice).toBe(false);
    assertHydrated(r.end, `m3.${donor}`);
    for (const product of id === 'R01' ? ['u.Cu'] : ['a1.Ag', 'a2.Ag']) expect(r.end.attached.has(product)).toBe(false);
    if (id === 'R01') {
      // The resulting Cu is on a piece with five remaining Zn atoms, not an independent Cu piece.
      expect(r.end.crystals.get('m')!.filter((x) => x.endsWith('.Zn'))).toEqual(['m1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']);
      const continued = run(r.end, 'step "상태를 이어서 보아요"\n wait 1');
      assertOutcome(r.end, continued.end, metalOutcome(id));
    }
  });
});

function metalOutcome(id: 'R01' | 'R02' | 'R03'): Outcome {
  const el = id === 'R03' ? 'Cu' : 'Zn';
  const atoms: Record<string, AtomState> = {};
  for (let i = 1; i <= 6; i++) atoms[`m${i}.${el}`] = i === 3 ? [el, 0, 0, 2, false] : [el, 1, 0, 0, true];
  const products = id === 'R01' ? ['u.Cu'] : ['a1.Ag', 'a2.Ag'];
  for (const product of products) atoms[product] = id === 'R01' ? ['Cu', 1, 0, 0, true] : ['Ag', 0, 1, 0, true];
  const members = [1, 2, 4, 5, 6].map((i) => `m${i}.${el}`).concat(products);
  return { atoms, components: Object.keys(atoms).map((a) => [a]), bonds: [], crystals: { m: members }, totals: [id === 'R01' ? 8 : 9, 12, 3] };
}

describe('stage 1 document: reuse products across compileFrom boundaries', () => {
  it('A02 -> A05 passes the same a.H1 from oxygen to nitrogen to the new oxygen', () => {
    const original = fixture(acidHeader.A02);
    const first = run(original, steps('A02'));
    assertOutcome(original, first.end, acidOutcome.A02);
    const saved = cloneWorld(first.end);
    const added = addSpecies(first.end, 'OH-', 'c', { x: 700, y: 400 });
    expect(added.errors).toEqual([]);
    expect(first.end).toEqual(saved);
    expect(added.addedAtomIds).toEqual(['c.O', 'c.H']);
    const next = steps('A05').replaceAll('n.H1', 'a.H1').replaceAll('o.O', 'c.O');
    const second = run(added.world!, next);
    assertOutcome(added.world!, second.end, {
      atoms: { 'a.O': ['O', 2, 0, 0, false], 'b.N': ['N', 1, 0, 0, false], 'c.O': ['O', 2, 0, 0, false],
        ...hydrogens('a.H1', 'a.H2', 'a.H3', 'b.H1', 'b.H2', 'b.H3', 'c.H') },
      components: [['a.O', 'a.H2', 'a.H3'], ['b.N', 'b.H1', 'b.H2', 'b.H3'], ['c.O', 'c.H', 'a.H1']],
      bonds: [...star('a.O', 'a.H2', 'a.H3'), ...star('b.N', 'b.H1', 'b.H2', 'b.H3'), ...star('c.O', 'c.H', 'a.H1')],
      crystals: {}, totals: [11, 24, 1],
    });
    expect(second.end.atoms.get('a.H1')!.owner).toBe('a');
    expect(second.end.atoms.has('b.H4')).toBe(false);
  });

  it('P01 -> onto -> onto retains one crystal and selects exactly one named pair each time', () => {
    let base = fixture('mol a1 = Ag+ at 300,220\nmol a2 = Ag+ at 690,200\nmol a3 = Ag+ at 280,420\nmol b1 = Cl- at 470,250\nmol b2 = Cl- at 640,400\nmol b3 = Cl- at 420,430');
    const atoms: Record<string, AtomState> = {};
    for (let i = 1; i <= 3; i++) {
      atoms[`a${i}.Ag`] = ['Ag', 0, 0, 1, false];
      atoms[`b${i}.Cl`] = ['Cl', 4, 0, -1, false];
    }
    const members: string[] = [];
    let name = '';
    for (const [i, [a, b]] of [['a3', 'b2'], ['a1', 'b1'], ['a2', 'b3']].entries()) {
      let script = documentSteps('P01', i === 0 ? 0 : 1).replace('using a b', `using ${a} ${b}`);
      if (i) script = script.replace('onto s', `onto ${name}`);
      const r = run(base, script);
      expect(r.effects).toHaveLength(1);
      if (i === 0) name = r.effects[0].crystalName;
      expect(r.effects[0]).toMatchObject({ crystalName: name, addedAtomIds: [`${a}.Ag`, `${b}.Cl`], onto: i > 0 });
      members.push(`${a}.Ag`, `${b}.Cl`);
      assertOutcome(base, r.end, { atoms, components: Object.keys(atoms).map((a) => [a]), bonds: [], crystals: { [name]: [...members] }, totals: [7, 24, 1] });
      expect(r.end.crystals.get(name)).toHaveLength((i + 1) * 2);
      base = r.end;
    }
  });
});

describe('stage 1 document: rejected state transitions are atomic', () => {
  it('rejects leave for a metal atom that has not donated electrons', () => {
    const base = fixture('metal m = Zn at 420,330 3x2');
    assertFailure(base, 'step "아직 중성인 아연"\n leave m3 from m', '전자를 내주지');
  });

  it('rejects join for a still-charged ion even after land', () => {
    const base = fixture('metal m = Zn at 420,330 3x2\nmol a1 = Ag+ at 640,200');
    const landed = run(base, 'step "표면에 닿아요"\n land a1 on m3');
    assertFailure(landed.end, 'step "환원 전"\n join a1 to m', '아직 이온');
    // A preceding successful step must also be discarded when both are submitted together.
    assertFailure(base, 'step "표면에 닿아요"\n land a1 on m3\nstep "환원 전"\n join a1 to m', '아직 이온');
  });

  it('rejects precipitating an ion that is already in the crystal', () => {
    const base = fixture('mol a = Ag+ at 300,260\nmol b = Cl- at 500,300\nmol c = Cl- at 700,400');
    const first = run(base, steps('P01'));
    const s = first.effects[0].crystalName;
    assertFailure(first.end, `step "이미 고체인 이온"\n precipitate using a c onto ${s}`, '물에 녹아 있는 이온');
  });
});
