import { describe, expect, it } from 'vitest';
import {
  ASSEMBLY_ELEMENTS, ASSEMBLY_MOLECULES, ASSEMBLY_MESSAGES, ASSEMBLY_BLOCK_MESSAGES,
  addAssemblyBond, areAssemblyGraphsIsomorphic, assemblyBondOrderSum, assemblyFormalCharge,
  checkAssemblyBond, createAssemblyGraph, evaluateAssembly,
  type AssemblyBond, type AssemblyElement, type AssemblyGraph, type BondOrder,
} from '../../src/lab/assembly-data';
import { compileFrom } from '../../src/engine/compile';
import { emptyWorld, formalCharge, getBond, type World } from '../../src/engine/world';
import { getStage } from '../../src/stage/stages';

type Edge = readonly [number, number, BondOrder];
const graph = (elements: readonly AssemblyElement[], edges: readonly Edge[] = []) =>
  createAssemblyGraph(elements, edges.map(([a, b, order]) => ({ a, b, order })));
const named = (id: string) => ASSEMBLY_MOLECULES.find(m => m.id === id)!;
const block = (g: AssemblyGraph, a: number, b: number, reason: keyof typeof ASSEMBLY_BLOCK_MESSAGES) => {
  const before = structuredClone(g);
  expect(checkAssemblyBond(g, a, b)).toEqual({ allowed: false, reason, message: ASSEMBLY_BLOCK_MESSAGES[reason] });
  const result = addAssemblyBond(g, a, b);
  expect(result.check.allowed).toBe(false);
  expect(result.graph).toBe(g);
  expect(g).toEqual(before);
};
const allow = (g: AssemblyGraph, a: number, b: number) => {
  const before = structuredClone(g);
  const result = addAssemblyBond(g, a, b);
  expect(result.check).toEqual({ allowed: true });
  expect(g).toEqual(before);
  expect(result.graph).not.toBe(g);
  expect(result.graph.atoms[a].rad).toBe(g.atoms[a].rad - 1);
  expect(result.graph.atoms[b].rad).toBe(g.atoms[b].rad - 1);
  result.graph.atoms.forEach((atom, i) => {
    expect(atom.lp).toBe(g.atoms[i].lp);
    expect(assemblyFormalCharge(result.graph, i)).toBe(0);
  });
  return result.graph;
};

// 재번호 매김에는 원자 배열 순서, 결합 배열 순서, 결합 양 끝의 방향을 함께 바꾼다.
function permute(g: AssemblyGraph, permutation: number[]): AssemblyGraph {
  const inverse = permutation.map((_, oldIndex) => permutation.indexOf(oldIndex));
  return {
    atoms: permutation.map(i => ({ ...g.atoms[i] })),
    bonds: [...g.bonds].reverse().map(b => ({ a: inverse[b.b], b: inverse[b.a], order: b.order })),
  };
}
const electronTotal = (g: AssemblyGraph) =>
  g.atoms.reduce((sum, a) => sum + 2 * a.lp + a.rad, 0) + g.bonds.reduce((sum, b) => sum + 2 * b.order, 0);
const elementCounts = (g: AssemblyGraph) => {
  const out: Record<string, number> = {};
  g.atoms.forEach(a => { out[a.element] = (out[a.element] ?? 0) + 1; });
  return out;
};
const dimethylEther = () => graph(['C', 'O', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],
  [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [2, 6, 1], [2, 7, 1], [2, 8, 1]]);

const expectedCatalog = [
  ['H2', '수소', { H: 2 }], ['N2', '질소', { N: 2 }], ['F2', '플루오린', { F: 2 }],
  ['Cl2', '염소', { Cl: 2 }], ['HF', '플루오린화 수소', { H: 1, F: 1 }],
  ['HCl', '염화 수소', { H: 1, Cl: 1 }], ['H2O', '물', { H: 2, O: 1 }],
  ['NH3', '암모니아', { N: 1, H: 3 }], ['CH4', '메테인', { C: 1, H: 4 }],
  ['CO2', '이산화 탄소', { C: 1, O: 2 }], ['H2O2', '과산화 수소', { H: 2, O: 2 }],
  ['CH3OH', '메탄올', { C: 1, H: 4, O: 1 }], ['C2H5OH', '에탄올', { C: 2, H: 6, O: 1 }],
  ['C2H4', '에텐', { C: 2, H: 4 }], ['CH3COOH', '아세트산', { C: 2, H: 4, O: 2 }],
] as const;

describe('assembly data consistency', () => {
  it('S01: six assembly electron models and bond-order limits are fixed', () => {
    expect(Object.entries(ASSEMBLY_ELEMENTS).map(([el, e]) => [el, e.lp, e.rad, e.maxBondOrderSum, e.valenceElectrons]))
      .toEqual([['H', 0, 1, 1, 1], ['C', 0, 4, 4, 4], ['N', 1, 3, 3, 5], ['O', 2, 2, 2, 6], ['F', 3, 1, 1, 7], ['Cl', 3, 1, 1, 7]]);
  });
  it('S02: catalog contains exactly the fifteen agreed molecules without duplicates', () => {
    expect(ASSEMBLY_MOLECULES.map(m => m.id)).toEqual(expectedCatalog.map(([id]) => id));
    expect(new Set(ASSEMBLY_MOLECULES.map(m => m.id)).size).toBe(15);
    for (let i = 0; i < 15; i++) for (let j = i + 1; j < 15; j++) {
      expect(areAssemblyGraphsIsomorphic(ASSEMBLY_MOLECULES[i], ASSEMBLY_MOLECULES[j])).toBe(false);
    }
  });
  it.each(expectedCatalog)('S03 %s: formula, name, valence, duet/octet, neutrality and tree', (id, name, counts) => {
    const m = named(id);
    expect(m.name).toBe(name);
    expect(m.message).toBe(`${name} 분자 모형을 조립했어요.`);
    expect(elementCounts(m)).toEqual(counts);
    const valence = { H: 1, C: 4, N: 5, O: 6, F: 7, Cl: 7 };
    const limits = { H: 1, C: 4, N: 3, O: 2, F: 1, Cl: 1 };
    const parent = m.atoms.map((_, i) => i);
    const root = (i: number): number => parent[i] === i ? i : root(parent[i]);
    for (const b of m.bonds) {
      expect([1, 2, 3]).toContain(b.order);
      expect(root(b.a)).not.toBe(root(b.b));
      parent[root(b.a)] = root(b.b);
    }
    expect(new Set(parent.map((_, i) => root(i))).size).toBe(1);
    expect(m.bonds).toHaveLength(m.atoms.length - 1);
    m.atoms.forEach((a, i) => {
      const sum = m.bonds.filter(b => b.a === i || b.b === i).reduce((s, b) => s + b.order, 0);
      expect(a.rad).toBe(0);
      expect(sum).toBe(limits[a.element]);
      expect(2 * a.lp + a.rad + 2 * sum).toBe(a.element === 'H' ? 2 : 8);
      expect(valence[a.element] - 2 * a.lp - a.rad - sum).toBe(0);
      expect(assemblyFormalCharge(m, i)).toBe(0);
    });
  });
  it.each(ASSEMBLY_MOLECULES)('S04 $id: replay a legal assembly sequence, conserving electrons at every action', m => {
    let state = createAssemblyGraph(m.atoms.map(a => a.element));
    const total = electronTotal(state);
    for (const b of m.bonds) for (let order = 0; order < b.order; order++) {
      state = allow(state, b.a, b.b);
      expect(electronTotal(state)).toBe(total);
    }
    expect(state).toEqual({ atoms: m.atoms, bonds: m.bonds });
    expect(evaluateAssembly(state)).toMatchObject({ kind: 'matched', molecule: { id: m.id } });
  });
});

describe('assembly acceptance', () => {
  it.each(expectedCatalog)('A01–A15 %s: recognize a completed structure and its exact Korean result', (id, name) => {
    expect(evaluateAssembly(named(id))).toMatchObject({ kind: 'matched', molecule: { id }, message: `${name} 분자 모형을 조립했어요.` });
  });
  it.each(ASSEMBLY_MOLECULES)('A16–A30 $id: recognize every cyclic shift of numbering with reversed bond direction', m => {
    for (let shift = 1; shift <= m.atoms.length; shift++) {
      const g = permute(m, m.atoms.map((_, i) => (i + shift) % m.atoms.length).reverse());
      expect(areAssemblyGraphsIsomorphic(g, m)).toBe(true);
      expect(areAssemblyGraphsIsomorphic(m, g)).toBe(true);
      expect(evaluateAssembly(g)).toMatchObject({ kind: 'matched', molecule: { id: m.id } });
    }
  });
  it('A31: dimethyl ether has the same formula as ethanol but is paired and unlisted', () => {
    const ether = dimethylEther();
    expect(elementCounts(ether)).toEqual(elementCounts(named('C2H5OH')));
    expect(areAssemblyGraphsIsomorphic(ether, named('C2H5OH'))).toBe(false);
    expect(evaluateAssembly(ether)).toEqual({ kind: 'paired-unlisted', message: ASSEMBLY_MESSAGES.pairedUnlisted });
    let state = createAssemblyGraph(ether.atoms.map(a => a.element));
    for (const b of ether.bonds) state = allow(state, b.a, b.b);
    expect(evaluateAssembly(state).kind).toBe('paired-unlisted');
  });
  it('A32: ethane is another completed unlisted structure', () => {
    const g = graph(['C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],
      [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]]);
    expect(evaluateAssembly(g)).toEqual({ kind: 'paired-unlisted', message: ASSEMBLY_MESSAGES.pairedUnlisted });
  });
  it.each(['H', 'C', 'N', 'O', 'F', 'Cl'] as const)('A33–A38: isolated %s has unpaired electrons', el => {
    expect(evaluateAssembly(graph([el]))).toEqual({ kind: 'unpaired', message: ASSEMBLY_MESSAGES.unpaired });
  });
  it('A39: OH has an unpaired electron', () => {
    expect(evaluateAssembly(graph(['O', 'H'], [[0, 1, 1]]))).toEqual({ kind: 'unpaired', message: ASSEMBLY_MESSAGES.unpaired });
  });
  it('A40: single-bonded nitrogen is unfinished despite the same formula as N2', () => {
    const g = graph(['N', 'N'], [[0, 1, 1]]);
    expect(areAssemblyGraphsIsomorphic(g, named('N2'))).toBe(false);
    expect(evaluateAssembly(g).kind).toBe('unpaired');
  });
  it('A41: either endpoint lacking a radical blocks a bond; lone pairs stay intact', () => {
    const g = graph(['H', 'F', 'H'], [[0, 1, 1]]);
    block(g, 1, 2, 'NO_UNPAIRED_ELECTRON');
    block(g, 2, 1, 'NO_UNPAIRED_ELECTRON');
  });
  it('A42: completed water cannot make an extra O–H bond', () => {
    block(graph(['O', 'H', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]), 0, 3, 'NO_UNPAIRED_ELECTRON');
  });
  it.each(['H', 'C', 'N', 'O', 'F', 'Cl'] as const)('A43–A48: valence guard rejects a faulty imported %s radical count', el => {
    const max = { H: 1, C: 4, N: 3, O: 2, F: 1, Cl: 1 }[el];
    const g = graph([el, ...Array<AssemblyElement>(max + 1).fill('H')],
      Array.from({ length: max }, (_, i): Edge => [0, i + 1, 1]));
    const faulty: AssemblyGraph = { ...g, atoms: g.atoms.map((a, i) => i === 0 ? { ...a, rad: 1 } : a) };
    block(faulty, 0, max + 1, 'VALENCE_EXCEEDED');
    block(faulty, max + 1, 0, 'VALENCE_EXCEEDED');
  });
  it('A49: a fourth bond-order unit is blocked even when both carbons have radicals', () => {
    block(graph(['C', 'C'], [[0, 1, 3]]), 0, 1, 'BOND_ORDER_EXCEEDED');
  });
  it('A50: a saturated nitrogen triple bond reports the order limit first', () => {
    block(named('N2'), 1, 0, 'BOND_ORDER_EXCEEDED');
  });
  it('A51: a new edge within the same component would close a ring', () => {
    block(graph(['C', 'C', 'C'], [[0, 1, 1], [1, 2, 1]]), 2, 0, 'RING_CREATION');
  });
  it('A52: joining separate carbon fragments is allowed', () => {
    allow(graph(['C', 'C', 'C', 'C'], [[0, 1, 1], [2, 3, 1]]), 1, 2);
  });
  it('A53: raising an existing bond order does not create a ring', () => {
    const g = allow(graph(['N', 'N'], [[0, 1, 1]]), 1, 0);
    expect(g.bonds[0].order).toBe(2);
    expect(evaluateAssembly(allow(g, 0, 1))).toMatchObject({ molecule: { id: 'N2' } });
  });
  it('A54: two oxygen atoms may form a single bond and remain unfinished', () => {
    const g = allow(graph(['O', 'O']), 0, 1);
    expect(g.atoms.map(a => a.rad)).toEqual([1, 1]);
    expect(evaluateAssembly(g).kind).toBe('unpaired');
  });
  it('A55: completing neutral O=O is blocked in either endpoint order', () => {
    const g = graph(['O', 'O'], [[0, 1, 1]]);
    block(g, 0, 1, 'O2_COMPLETION');
    block(g, 1, 0, 'O2_COMPLETION');
  });
  it('A56: an unrelated H atom on the board does not bypass the O2 block', () => {
    block(graph(['O', 'O', 'H'], [[0, 1, 1]]), 0, 1, 'O2_COMPLETION');
  });
  it('A57: charged O–O input does not qualify for the neutral O2 reason', () => {
    const g = graph(['O', 'O'], [[0, 1, 1]]);
    const charged = { ...g, atoms: g.atoms.map(a => ({ ...a, lp: 1 })) };
    expect(() => checkAssemblyBond(charged, 0, 1)).toThrow('형식 전하');
  });
  it('A58: H2O2 can start with O–O and finish by adding both hydrogens', () => {
    let g = allow(graph(['O', 'O', 'H', 'H']), 0, 1);
    g = allow(g, 0, 2);
    g = allow(g, 1, 3);
    expect(evaluateAssembly(g)).toMatchObject({ molecule: { id: 'H2O2' } });
  });
  it('A59: H2O2 can also join two OH fragments', () => {
    const g = allow(graph(['O', 'O', 'H', 'H'], [[0, 2, 1], [1, 3, 1]]), 1, 0);
    expect(evaluateAssembly(g)).toMatchObject({ molecule: { id: 'H2O2' } });
  });
  it('A60: both C=O bonds of CO2 are allowed', () => {
    let g = graph(['C', 'O', 'O']);
    for (const i of [1, 1, 2, 2]) g = allow(g, 0, i);
    expect(evaluateAssembly(g)).toMatchObject({ molecule: { id: 'CO2' } });
  });
  it('A61: an O–O bond bearing H is blocked by exhausted radicals, not by the O2 exception', () => {
    block(graph(['O', 'O', 'H'], [[0, 1, 1], [0, 2, 1]]), 0, 1, 'NO_UNPAIRED_ELECTRON');
  });
  it('A62: changing the element breaks isomorphism', () => {
    expect(areAssemblyGraphsIsomorphic(named('HF'), named('HCl'))).toBe(false);
  });
  it('A63: identical local degrees do not substitute for full graph matching', () => {
    const ring = graph(['C', 'C', 'C', 'C', 'C', 'C'],
      [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1]]);
    const triangles = graph(['C', 'C', 'C', 'C', 'C', 'C'],
      [[0, 1, 1], [1, 2, 1], [2, 0, 1], [3, 4, 1], [4, 5, 1], [5, 3, 1]]);
    expect(areAssemblyGraphsIsomorphic(ring, triangles)).toBe(false);
    expect(areAssemblyGraphsIsomorphic(ring, permute(ring, [3, 0, 5, 2, 4, 1]))).toBe(true);
  });
  it('A64: result strings preserve the agreed text exactly', () => {
    expect(ASSEMBLY_MESSAGES).toEqual({
      claim: '원자 모형을 연결해 분자 구조를 조립해요.',
      pairedUnlisted: '전자 표시는 모두 짝지어졌어요. 실제로 있는 분자인지는 아직 확인하지 않았어요.',
      unpaired: '이 모형에는 짝을 이루지 않은 전자가 남아 있어요.',
    });
    expect(ASSEMBLY_BLOCK_MESSAGES.O2_COMPLETION).toBe('산소 분자의 실제 홑전자 두 개는 이 조립 모형으로 정확히 나타낼 수 없어요.');
  });
});

describe('assembly input boundaries', () => {
  it('B01: rejects empty or disconnected result inputs', () => {
    expect(() => evaluateAssembly(graph([]))).toThrow(RangeError);
    expect(() => evaluateAssembly(graph(['H', 'H']))).toThrow(RangeError);
    expect(() => evaluateAssembly(graph(['H', 'H', 'H', 'H'], [[0, 1, 1], [2, 3, 1]]))).toThrow(RangeError);
  });
  it('B02: rejects cyclic result input', () => {
    expect(() => evaluateAssembly(graph(['C', 'C', 'C'], [[0, 1, 1], [1, 2, 1], [2, 0, 1]]))).toThrow(RangeError);
  });
  it('B03: rejects self-selection and invalid atom indices', () => {
    for (const [a, b] of [[0, 0], [-1, 1], [0, 2], [0.5, 1], [0, NaN]]) {
      expect(() => checkAssemblyBond(graph(['H', 'H']), a, b)).toThrow(RangeError);
    }
  });
  it('B04: rejects duplicate edges, self-edges, half bonds and invalid references', () => {
    const invalidEdges = [
      [{ a: 0, b: 1, order: 1 }, { a: 1, b: 0, order: 1 }],
      [{ a: 0, b: 0, order: 1 }], [{ a: 0, b: 1, order: 0.5 }],
      [{ a: 0, b: 2, order: 1 }], [{ a: 0, b: 1, order: 4 }],
    ];
    for (const bonds of invalidEdges) expect(() => createAssemblyGraph(['C', 'C'], bonds as AssemblyBond[])).toThrow(RangeError);
  });
  it('B05: rejects excess valence at construction and a false paired result from a faulty ledger', () => {
    expect(() => graph(['H', 'H'], [[0, 1, 2]])).toThrow(RangeError);
    expect(() => evaluateAssembly({ atoms: [{ element: 'H', lp: 0, rad: 0 }], bonds: [] })).toThrow(RangeError);
  });
  it('B06: constants are frozen and pure calls accept frozen inputs', () => {
    expect(Object.isFrozen(ASSEMBLY_ELEMENTS.O)).toBe(true);
    expect(Object.isFrozen(ASSEMBLY_MOLECULES)).toBe(true);
    expect(Object.isFrozen(named('H2O').atoms[0])).toBe(true);
    expect(Object.isFrozen(named('H2O').bonds[0])).toBe(true);
    expect(evaluateAssembly(named('H2O')).message).toBe('물 분자 모형을 조립했어요.');
    const start = graph(['N', 'N']);
    start.atoms.forEach(Object.freeze);
    Object.freeze(start.atoms);
    Object.freeze(start.bonds);
    Object.freeze(start);
    allow(start, 0, 1);
  });
});

function engineBase(g: AssemblyGraph): { world: World; ids: string[] } {
  const world = emptyWorld();
  world.counter = g.atoms.length;
  const ids = g.atoms.map((a, i) => `a${i}.${a.element}`);
  g.atoms.forEach((a, i) => {
    world.atoms.set(ids[i], {
      id: ids[i], el: a.element, lp: a.lp, rad: a.rad,
      x: 260 + (i % 4) * 115, y: 210 + Math.floor(i / 4) * 110,
      owner: `a${i}`, label: a.element, num: i + 1, crowd: false,
    });
    world.names.set(`a${i}`, ids[i]);
  });
  return { world, ids };
}

describe('current engine hop contract', () => {
  it.each(ASSEMBLY_MOLECULES)('E01 $id: two :e hops per step realize the complete assembly', m => {
    const initial = createAssemblyGraph(m.atoms.map(a => a.element));
    const { world, ids } = engineBase(initial);
    const before = structuredClone(world);
    const actions = m.bonds.flatMap(b => Array.from({ length: b.order }, () => b));
    const script = actions.map((b, i) => `step "조립 ${i + 1}"
  hop ${ids[b.a]}:e -> ${ids[b.a]}~${ids[b.b]}
  hop ${ids[b.b]}:e -> ${ids[b.a]}~${ids[b.b]}`).join('\n');
    const result = compileFrom(world, getStage('gas')!, script);
    expect(world).toEqual(before);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.timeline).not.toBeNull();
    let expected = initial;
    result.timeline!.steps.forEach((step, i) => {
      expected = addAssemblyBond(expected, actions[i].a, actions[i].b).graph;
      expect(step.arrows.map(a => a.kind)).toEqual(['single', 'single']);
      expect(step.pulls ?? []).toEqual([]);
      expect(step.after.bonds.size).toBe(expected.bonds.length);
      for (const b of expected.bonds) expect(getBond(step.after, ids[b.a], ids[b.b])?.order).toBe(b.order);
      expected.atoms.forEach((a, j) => {
        const actual = step.after.atoms.get(ids[j])!;
        expect([actual.lp, actual.rad, formalCharge(step.after, actual)]).toEqual([a.lp, a.rad, 0]);
      });
    });
    expect(expected).toEqual({ atoms: m.atoms, bonds: m.bonds });
    expect(assemblyBondOrderSum(expected, 0)).toBe(assemblyBondOrderSum(m, 0));
  });
  it('E02: one hop alone fails transactionally with a half-bond diagnostic', () => {
    const { world, ids } = engineBase(graph(['H', 'H']));
    const before = structuredClone(world);
    const result = compileFrom(world, getStage('gas')!, `step "반쪽"\n hop ${ids[0]}:e -> ${ids[0]}~${ids[1]}`);
    expect(result.errors.some(e => e.message.includes('홀수'))).toBe(true);
    expect(result.end).toBeNull();
    expect(world).toEqual(before);
  });
  it('E03: :e refuses to split a lone pair when there is no radical', () => {
    const { world, ids } = engineBase(graph(['F', 'H']));
    world.atoms.get(ids[0])!.rad = 0;
    const result = compileFrom(world, getStage('gas')!, `step "금지"\n hop ${ids[0]}:e -> ${ids[0]}~${ids[1]}`);
    expect(result.errors.some(e => e.message.includes('홑전자가 없어요'))).toBe(true);
    expect(result.end).toBeNull();
    expect(world.atoms.get(ids[0])!.lp).toBe(3);
  });
});
