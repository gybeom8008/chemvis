import { describe, expect, it } from 'vitest';
import { lookupMolecule } from '../../src/chem/library';
import { compile, compileFrom } from '../../src/engine/compile';
import { formalCharge, type World } from '../../src/engine/world';
import { parse } from '../../src/dsl/parser';
import { getStage } from '../../src/stage/stages';
import {
  ASSEMBLY_BLOCK_MESSAGES, ASSEMBLY_ELEMENTS, ASSEMBLY_MESSAGES, ASSEMBLY_MOLECULES,
  areAssemblyGraphsIsomorphic, createAssemblyGraph, evaluateAssembly,
  type AssemblyBlockReason, type AssemblyElement, type AssemblyGraph, type BondOrder,
} from '../../src/lab/assembly-data';
import { createAssemblyHeader, createAssemblyStep, type AssemblyBoard } from '../../src/lab/assembly-script';

const stage = getStage('gas')!;
const board = (graph: AssemblyGraph): AssemblyBoard => ({
  atoms: graph.atoms.map((a, i) => ({ ...a, x: 250 + (i % 4) * 115, y: 200 + Math.floor(i / 4) * 110 })),
  bonds: graph.bonds,
});

/** 실제 컴파일 결과에서 그래프를 읽는다. */
function readGraph(world: World, ids: readonly string[]): AssemblyGraph {
  expect(world.atoms.size).toBe(ids.length);
  const indices = new Map(ids.map((id, i) => [id, i]));
  return {
    atoms: ids.map(id => {
      const atom = world.atoms.get(id)!;
      expect(atom).toBeDefined();
      expect(formalCharge(world, atom)).toBe(0);
      return { element: atom.el as AssemblyElement, lp: atom.lp, rad: atom.rad };
    }),
    bonds: [...world.bonds.values()].map(b => {
      expect(indices.has(b.a) && indices.has(b.b)).toBe(true);
      expect([1, 2, 3]).toContain(b.order);
      expect(b.dative).toBeUndefined();
      return { a: indices.get(b.a)!, b: indices.get(b.b)!, order: b.order as BondOrder };
    }),
  };
}

function expectGraph(actual: AssemblyGraph, expected: AssemblyGraph): void {
  expect(actual.atoms).toEqual(expected.atoms.map(({ element, lp, rad }) => ({ element, lp, rad })));
  const edges = (g: AssemblyGraph) => g.bonds.map(b =>
    `${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}:${b.order}`).sort();
  expect(edges(actual)).toEqual(edges(expected));
}

function electronTotal(graph: AssemblyGraph): number {
  return graph.atoms.reduce((sum, a) => sum + 2 * a.lp + a.rad, 0) +
    graph.bonds.reduce((sum, b) => sum + 2 * b.order, 0);
}

/** 조작마다 직전 컴파일 결과를 다음 compileFrom 입력으로 쓴다. */
function assemble(target: AssemblyGraph, reverse = false) {
  const initial = createAssemblyGraph(target.atoms.map(a => a.element));
  const placed = board(initial);
  const saved = structuredClone(placed);
  const header = createAssemblyHeader(placed);
  let world = header.world;
  let graph = readGraph(world, header.atomIds);
  const scripts: string[] = [];
  const bonds = reverse ? [...target.bonds].reverse() : target.bonds;
  for (const edge of bonds) for (let order = 0; order < edge.order; order++) {
    const a = reverse ? edge.b : edge.a;
    const b = reverse ? edge.a : edge.b;
    const graphBefore = structuredClone(graph);
    const operation = createAssemblyStep(graph, a, b);
    expect(graph).toEqual(graphBefore);
    expect(operation.allowed).toBe(true);
    if (!operation.allowed) throw new Error(operation.reason);
    scripts.push(operation.script);
    const ast = parse(operation.script);
    expect(ast.errors).toEqual([]);
    expect(ast.header).toEqual([]);
    expect(ast.steps).toHaveLength(1);
    expect(ast.steps[0].cmds.map(c => c.op)).toEqual(['hop', 'hop']);
    expect(ast.steps[0].cmds.map(c => c.args)).toEqual([
      [`${header.atomIds[a]}:e`, '->', `${header.atomIds[a]}~${header.atomIds[b]}`],
      [`${header.atomIds[b]}:e`, '->', `${header.atomIds[a]}~${header.atomIds[b]}`],
    ]);
    const before = structuredClone(world);
    const result = compileFrom(world, stage, operation.script);
    expect(world).toEqual(before);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    if (!result.timeline) throw new Error(JSON.stringify(result.errors));
    expect(result.effects).toEqual([]);
    expect(result.timeline.steps).toHaveLength(1);
    const step = result.timeline.steps[0];
    expect(step.arrows.map(a => a.kind)).toEqual(['single', 'single']);
    expect(step.pulls ?? []).toEqual([]);
    world = result.end;
    graph = readGraph(world, header.atomIds);
    expectGraph(graph, operation.graph);
    expect(electronTotal(graph)).toBe(electronTotal(initial));
    expect(world.names).toEqual(header.world.names);
    expect(world.counter).toBe(initial.atoms.length);
    header.atomIds.forEach((id, i) => {
      const atom = world.atoms.get(id)!;
      expect([atom.owner, atom.label, atom.num]).toEqual([`a${i}`, initial.atoms[i].element, i + 1]);
      expect(Number.isFinite(atom.x) && Number.isFinite(atom.y)).toBe(true);
    });
  }
  expect(placed).toEqual(saved);
  expectGraph(graph, target);
  // 문자열 머리말을 지원하는 경우 전체 대본 경로도 실제로 실행한다.
  if (header.mode === 'script') {
    const result = compile([header.script, ...scripts].join('\n'));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.timeline).not.toBeNull();
    const end = result.timeline!.steps.at(-1)?.after ?? result.timeline!.initial;
    expectGraph(readGraph(end, header.atomIds), target);
    for (const step of result.timeline!.steps) expect(step.pulls ?? []).toEqual([]);
  }
  return { graph, world, header };
}

describe('원자에서부터 실제 컴파일로 이어 조립해요', () => {
  for (const reverse of [false, true]) {
    it.each(ASSEMBLY_MOLECULES)(`$id: ${reverse ? '역순' : '정순'} 조립 뒤 대조한 구조와 같음`, molecule => {
      const { graph } = assemble(molecule, reverse);
      expect(areAssemblyGraphsIsomorphic(graph, molecule)).toBe(true);
      const verdict = evaluateAssembly(graph);
      expect(verdict.kind).toBe('matched');
      if (verdict.kind !== 'matched') throw new Error(verdict.kind);
      expect(verdict.molecule.id).toBe(molecule.id);
      expect(verdict.message).toBe(molecule.message);
    });
  }

  it('다이메틸 에터를 에탄올로 판정하지 않아요', () => {
    const target = createAssemblyGraph(['C', 'O', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],
      [[0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [2, 6], [2, 7], [2, 8]]
        .map(([a, b]) => ({ a, b, order: 1 })));
    const { graph } = assemble(target);
    const ethanol = ASSEMBLY_MOLECULES.find(m => m.id === 'C2H5OH')!;
    expect(graph.atoms.map(a => a.element).sort()).toEqual(ethanol.atoms.map(a => a.element).sort());
    expect(areAssemblyGraphsIsomorphic(graph, ethanol)).toBe(false);
    expect(evaluateAssembly(graph)).toEqual({ kind: 'paired-unlisted', message: ASSEMBLY_MESSAGES.pairedUnlisted });
  });

  it.each([
    createAssemblyGraph(['O', 'H'], [{ a: 0, b: 1, order: 1 }]),
    createAssemblyGraph(['N', 'N'], [{ a: 0, b: 1, order: 1 }]),
  ])('결합 뒤 홑전자가 남으면 완성 이름을 붙이지 않아요', target => {
    const { graph } = assemble(target);
    expect(evaluateAssembly(graph)).toEqual({ kind: 'unpaired', message: ASSEMBLY_MESSAGES.unpaired });
  });
});

describe('머리말과 정확한 조립판 복원', () => {
  it('여섯 원소를 지정한 위치와 전자 수로 만들고 입력을 공유하지 않아요', () => {
    const input = board(createAssemblyGraph(['H', 'C', 'N', 'O', 'F', 'Cl']));
    const saved = structuredClone(input);
    const header = createAssemblyHeader(input);
    expect(header).toMatchObject({ mode: 'world', script: null, reason: 'ATOM_STATE_UNSUPPORTED' });
    expectGraph(readGraph(header.world, header.atomIds), input);
    input.atoms.forEach((a, i) => {
      expect(header.world.atoms.get(header.atomIds[i])).toMatchObject({ x: a.x, y: a.y, lp: a.lp, rad: a.rad });
    });
    header.world.atoms.get(header.atomIds[0])!.x += 50;
    expect(input).toEqual(saved);
  });

  it.each(['C', 'N', 'O'] as const)('%s SMILES 낱원자는 조립용 전자 수와 달라요', el => {
    const atom = lookupMolecule(`smiles:[${el}]`)!.atoms[0];
    expect([atom.lp, atom.rad]).not.toEqual([ASSEMBLY_ELEMENTS[el].lp, ASSEMBLY_ELEMENTS[el].rad]);
    expect(createAssemblyHeader(board(createAssemblyGraph([el])))).toMatchObject({
      mode: 'world', script: null, reason: 'ATOM_STATE_UNSUPPORTED',
    });
  });

  it('H·F·Cl 머리말을 컴파일하면 전자 수와 떨어진 좌표가 같아요', () => {
    const input = board(createAssemblyGraph(['H', 'F', 'Cl']));
    const header = createAssemblyHeader(input);
    expect(header.mode).toBe('script');
    if (header.mode !== 'script') throw new Error(header.reason);
    const result = compile(header.script);
    expect(result.errors).toEqual([]);
    expect(result.timeline!.steps).toEqual([]);
    expect(result.timeline!.initial).toEqual(header.world);
    // 머리말만 컴파일했을 때 생기는 기존 엔진 안내다.
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('step이 하나도 없어서');
  });

  it('빈 조립판도 복원할 수 있어요', () => {
    const header = createAssemblyHeader({ atoms: [], bonds: [] });
    expect(header.mode).toBe('script');
    expect(header.atomIds).toEqual([]);
    expect(header.world.atoms.size).toBe(0);
    expect(compile(header.script!).errors).toEqual([]);
  });

  it('좌표를 반올림하거나 지수 표기로 내보내지 않아요', () => {
    const input: AssemblyBoard = { atoms: [{ element: 'H', lp: 0, rad: 1, x: -1e-7, y: 1e21 }], bonds: [] };
    const header = createAssemblyHeader(input);
    expect(header.script).toContain('at -0.0000001,1000000000000000000000');
    const ast = parse(header.script!);
    expect(ast.errors).toEqual([]);
    expect(compile(header.script!).errors).toEqual([]);
  });

  it.each(ASSEMBLY_MOLECULES)('$id 기존 결합도 World 경로로 복원해요', molecule => {
    const input = board(molecule);
    const header = createAssemblyHeader(input);
    expect(header).toMatchObject({ mode: 'world', script: null, reason: 'BOND_LAYOUT_UNSUPPORTED' });
    expectGraph(readGraph(header.world, header.atomIds), molecule);
    input.atoms.forEach((a, i) => expect(header.world.atoms.get(header.atomIds[i])).toMatchObject({ x: a.x, y: a.y }));
    const result = compileFrom(header.world, stage, 'step "조립한 모형을 살펴봐요."\n  wait 1');
    expect(result.errors).toEqual([]);
    expect(result.timeline).not.toBeNull();
    expectGraph(readGraph(result.end!, header.atomIds), molecule);
  });

  it('이미 이은 질소를 복원하고 이중·삼중 결합으로 이어가요', () => {
    const header = createAssemblyHeader(board(createAssemblyGraph(['N', 'N'], [{ a: 0, b: 1, order: 1 }])));
    let world = header.world;
    for (const order of [2, 3]) {
      const op = createAssemblyStep(readGraph(world, header.atomIds), 1, 0);
      if (!op.allowed) throw new Error(op.reason);
      const result = compileFrom(world, stage, op.script);
      expect(result.errors).toEqual([]);
      world = result.end!;
      expect([...world.bonds.values()][0].order).toBe(order);
    }
    expect(evaluateAssembly(readGraph(world, header.atomIds)).kind).toBe('matched');
  });

  it('잘못된 좌표·전자 수·결합 참조를 조용히 고치지 않아요', () => {
    const input = board(createAssemblyGraph(['H']));
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => createAssemblyHeader({ ...input, atoms: [{ ...input.atoms[0], x: value }] })).toThrow(RangeError);
    }
    expect(() => createAssemblyHeader({ ...input, atoms: [{ ...input.atoms[0], rad: 0 }] })).toThrow(RangeError);
    expect(() => createAssemblyHeader({ ...input, bonds: [{ a: 0, b: 1, order: 1 }] })).toThrow(RangeError);
  });
});

function expectBlocked(graph: AssemblyGraph, a: number, b: number, reason: AssemblyBlockReason): void {
  const before = structuredClone(graph);
  for (const [left, right] of [[a, b], [b, a]]) {
    const result = createAssemblyStep(graph, left, right);
    expect(result).toEqual({ allowed: false, reason, message: ASSEMBLY_BLOCK_MESSAGES[reason] });
    expect(result).not.toHaveProperty('script');
    expect(graph).toEqual(before);
  }
}

describe('막힌 조작은 대본을 만들지 않아요', () => {
  it.each([false, true])('O₂ 완성을 막아요: 다른 원자 존재 %s', extra => {
    const single = createAssemblyGraph(['O', 'O'], [{ a: 0, b: 1, order: 1 }]);
    const { graph } = assemble(single);
    const input = extra ? { ...graph, atoms: [...graph.atoms, ...createAssemblyGraph(['H']).atoms] } : graph;
    expectBlocked(input, 0, 1, 'O2_COMPLETION');
  });

  it('이미 이어진 세 탄소를 고리로 닫지 않아요', () => {
    const { graph } = assemble(createAssemblyGraph(['C', 'C', 'C'], [{ a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }]));
    expectBlocked(graph, 0, 2, 'RING_CREATION');
  });

  it('홑전자가 없으면 비공유 전자쌍을 쓰지 않아요', () => {
    expectBlocked(createAssemblyGraph(['F', 'H', 'H'], [{ a: 0, b: 1, order: 1 }]), 0, 2, 'NO_UNPAIRED_ELECTRON');
  });

  it('삼중 결합보다 높이지 않아요', () => {
    expectBlocked(ASSEMBLY_MOLECULES.find(m => m.id === 'N2')!, 0, 1, 'BOND_ORDER_EXCEEDED');
  });

  it('외부에서 전자 수를 잘못 넘겨도 결합 한도를 넘지 않아요', () => {
    const input = createAssemblyGraph(['H', 'H', 'H'], [{ a: 0, b: 1, order: 1 }]);
    const faulty = { ...input, atoms: input.atoms.map(a => ({ ...a, rad: 1 })) };
    expectBlocked(faulty, 0, 2, 'VALENCE_EXCEEDED');
  });

  it('같은 원자 선택과 없는 원자 참조는 입력 오류예요', () => {
    const input = createAssemblyGraph(['H', 'H']);
    expect(() => createAssemblyStep(input, 0, 0)).toThrow(RangeError);
    expect(() => createAssemblyStep(input, 0, 2)).toThrow(RangeError);
  });
});
