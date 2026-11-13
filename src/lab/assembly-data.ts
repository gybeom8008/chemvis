/** 분자 조립 자료. 엔진의 World, 배치, 재생 상태에 의존하지 않는다. */
export const ASSEMBLY_ELEMENTS = Object.freeze({
  H: Object.freeze({ lp: 0, rad: 1, maxBondOrderSum: 1, valenceElectrons: 1 }),
  C: Object.freeze({ lp: 0, rad: 4, maxBondOrderSum: 4, valenceElectrons: 4 }),
  N: Object.freeze({ lp: 1, rad: 3, maxBondOrderSum: 3, valenceElectrons: 5 }),
  O: Object.freeze({ lp: 2, rad: 2, maxBondOrderSum: 2, valenceElectrons: 6 }),
  F: Object.freeze({ lp: 3, rad: 1, maxBondOrderSum: 1, valenceElectrons: 7 }),
  Cl: Object.freeze({ lp: 3, rad: 1, maxBondOrderSum: 1, valenceElectrons: 7 }),
});

export type AssemblyElement = keyof typeof ASSEMBLY_ELEMENTS;
export type BondOrder = 1 | 2 | 3;
export interface AssemblyAtom {
  readonly element: AssemblyElement;
  readonly lp: number;
  readonly rad: number;
}
export interface AssemblyBond {
  /** atoms 배열의 0부터 시작하는 위치다. */
  readonly a: number;
  readonly b: number;
  readonly order: BondOrder;
}
export interface AssemblyGraph {
  readonly atoms: readonly AssemblyAtom[];
  readonly bonds: readonly AssemblyBond[];
}
export interface AssemblyMolecule extends AssemblyGraph {
  readonly id: string;
  readonly formula: string;
  readonly name: string;
  readonly message: string;
}

export const ASSEMBLY_MESSAGES = Object.freeze({
  claim: '원자 모형을 연결해 분자 구조를 조립해요.',
  pairedUnlisted: '전자 표시는 모두 짝지어졌어요. 실제로 있는 분자인지는 아직 확인하지 않았어요.',
  unpaired: '이 모형에는 짝을 이루지 않은 전자가 남아 있어요.',
});

export const ASSEMBLY_BLOCK_MESSAGES = Object.freeze({
  NO_UNPAIRED_ELECTRON: '양쪽 원자에 홑전자가 하나씩 남아 있어야 결합을 만들 수 있어요.',
  VALENCE_EXCEEDED: '이 원자가 만들 수 있는 결합 차수의 합을 넘어요.',
  BOND_ORDER_EXCEEDED: '삼중 결합보다 결합 차수를 더 높일 수 없어요.',
  RING_CREATION: '같은 분자 안에서 새로 이어 고리를 만드는 조작은 아직 지원하지 않아요.',
  O2_COMPLETION: '산소 분자의 실제 홑전자 두 개는 이 조립 모형으로 정확히 나타낼 수 없어요.',
});
export type AssemblyBlockReason = keyof typeof ASSEMBLY_BLOCK_MESSAGES;
export type AssemblyOperationCheck =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AssemblyBlockReason; readonly message: string };

function assertIndex(graph: AssemblyGraph, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= graph.atoms.length) {
    throw new RangeError('원자 번호가 그래프 범위를 벗어났다.');
  }
}

/** 잘못된 참조와 전자 장부는 화학 판정 결과로 바꾸지 않는다. */
function assertShape(graph: AssemblyGraph): void {
  for (const atom of graph.atoms) {
    if (!Object.hasOwn(ASSEMBLY_ELEMENTS, atom.element) ||
      !Number.isInteger(atom.lp) || atom.lp < 0 || !Number.isInteger(atom.rad) || atom.rad < 0) {
      throw new RangeError('지원하지 않는 원소 또는 잘못된 전자 수다.');
    }
  }
  const pairs = new Set<string>();
  for (const bond of graph.bonds) {
    assertIndex(graph, bond.a);
    assertIndex(graph, bond.b);
    const key = [Math.min(bond.a, bond.b), Math.max(bond.a, bond.b)].join(':');
    if (bond.a === bond.b || ![1, 2, 3].includes(bond.order) || pairs.has(key)) {
      throw new RangeError('자기 결합, 중복 결합 또는 잘못된 결합 차수다.');
    }
    pairs.add(key);
  }
}

export function assemblyBondOrderSum(graph: AssemblyGraph, index: number): number {
  assertIndex(graph, index);
  return graph.bonds.reduce((sum, b) => sum + (b.a === index || b.b === index ? b.order : 0), 0);
}

export function assemblyFormalCharge(graph: AssemblyGraph, index: number): number {
  assertIndex(graph, index);
  const atom = graph.atoms[index];
  return ASSEMBLY_ELEMENTS[atom.element].valenceElectrons - 2 * atom.lp - atom.rad - assemblyBondOrderSum(graph, index);
}

function connectedIndices(graph: AssemblyGraph, start: number): Set<number> {
  const seen = new Set([start]);
  const pending = [start];
  while (pending.length) {
    const current = pending.pop()!;
    for (const bond of graph.bonds) {
      const next = bond.a === current ? bond.b : bond.b === current ? bond.a : -1;
      if (next !== -1 && !seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
    }
  }
  return seen;
}

function assertElectronLedger(graph: AssemblyGraph): void {
  graph.atoms.forEach((atom, index) => {
    const initial = ASSEMBLY_ELEMENTS[atom.element];
    if (atom.lp !== initial.lp || atom.rad + assemblyBondOrderSum(graph, index) !== initial.rad ||
      assemblyFormalCharge(graph, index) !== 0) {
      throw new RangeError('조립용 전자 장부 또는 형식 전하가 맞지 않는다.');
    }
  });
}

/** 원자 모형의 비공유 전자쌍은 고정하고, 결합에 쓴 만큼 홑전자를 줄인다. */
export function createAssemblyGraph(elements: readonly AssemblyElement[], bonds: readonly AssemblyBond[] = []): AssemblyGraph {
  const graph: AssemblyGraph = {
    atoms: elements.map(element => ({ element, ...ASSEMBLY_ELEMENTS[element] })),
    bonds: bonds.map(b => ({ ...b })),
  };
  assertShape(graph);
  const atoms = graph.atoms.map((atom, index) => ({
    element: atom.element, lp: atom.lp, rad: atom.rad - assemblyBondOrderSum(graph, index),
  }));
  const result = { atoms, bonds: graph.bonds };
  assertShape(result);
  assertElectronLedger(result);
  return result;
}

type Edge = readonly [number, number, BondOrder];
function molecule(id: string, formula: string, name: string, elements: readonly AssemblyElement[], edges: readonly Edge[]): AssemblyMolecule {
  const graph = createAssemblyGraph(elements, edges.map(([a, b, order]) => ({ a, b, order })));
  return Object.freeze({
    id, formula, name, message: `${name} 분자 모형을 조립했어요.`,
    atoms: Object.freeze(graph.atoms.map(a => Object.freeze(a))),
    bonds: Object.freeze(graph.bonds.map(b => Object.freeze(b))),
  });
}

export const ASSEMBLY_MOLECULES: readonly AssemblyMolecule[] = Object.freeze([
  molecule('H2', 'H₂', '수소', ['H', 'H'], [[0, 1, 1]]),
  molecule('N2', 'N₂', '질소', ['N', 'N'], [[0, 1, 3]]),
  molecule('F2', 'F₂', '플루오린', ['F', 'F'], [[0, 1, 1]]),
  molecule('Cl2', 'Cl₂', '염소', ['Cl', 'Cl'], [[0, 1, 1]]),
  molecule('HF', 'HF', '플루오린화 수소', ['H', 'F'], [[0, 1, 1]]),
  molecule('HCl', 'HCl', '염화 수소', ['H', 'Cl'], [[0, 1, 1]]),
  molecule('H2O', 'H₂O', '물', ['O', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]),
  molecule('NH3', 'NH₃', '암모니아', ['N', 'H', 'H', 'H'], [[0, 1, 1], [0, 2, 1], [0, 3, 1]]),
  molecule('CH4', 'CH₄', '메테인', ['C', 'H', 'H', 'H', 'H'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]),
  molecule('CO2', 'CO₂', '이산화 탄소', ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 2]]),
  molecule('H2O2', 'H₂O₂', '과산화 수소', ['O', 'O', 'H', 'H'], [[0, 1, 1], [0, 2, 1], [1, 3, 1]]),
  molecule('CH3OH', 'CH₃OH', '메탄올', ['C', 'O', 'H', 'H', 'H', 'H'],
    [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1]]),
  molecule('C2H5OH', 'C₂H₅OH', '에탄올', ['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'],
    [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1]]),
  molecule('C2H4', 'C₂H₄', '에텐', ['C', 'C', 'H', 'H', 'H', 'H'],
    [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]]),
  molecule('CH3COOH', 'CH₃COOH', '아세트산', ['C', 'C', 'O', 'O', 'H', 'H', 'H', 'H'],
    [[0, 1, 1], [1, 2, 2], [1, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [3, 7, 1]]),
]);

/** 원소와 결합 차수만 비교한다. 좌표, 전자 장부, 이름, 원자 번호는 비교하지 않는다. */
export function areAssemblyGraphsIsomorphic(left: AssemblyGraph, right: AssemblyGraph): boolean {
  assertShape(left);
  assertShape(right);
  const n = left.atoms.length;
  if (n !== right.atoms.length || left.bonds.length !== right.bonds.length) return false;
  const matrix = (g: AssemblyGraph) => {
    const out = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const b of g.bonds) out[b.a][b.b] = out[b.b][b.a] = b.order;
    return out;
  };
  const l = matrix(left);
  const r = matrix(right);
  const signature = (g: AssemblyGraph, m: number[][], i: number) =>
    `${g.atoms[i].element}|${m[i].map((order, j) => order ? `${g.atoms[j].element}:${order}` : '')
      .filter(Boolean).sort().join(',')}`;
  const rightSignatures = right.atoms.map((_, i) => signature(right, r, i));
  const candidates = left.atoms.map((_, i) => {
    const sig = signature(left, l, i);
    return rightSignatures.flatMap((s, j) => s === sig ? [j] : []);
  });
  if (candidates.some(c => c.length === 0)) return false;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => candidates[a].length - candidates[b].length);
  const mapping = Array<number>(n).fill(-1);
  const used = new Set<number>();
  const search = (depth: number): boolean => {
    if (depth === n) return true;
    const a = order[depth];
    for (const b of candidates[a]) {
      if (used.has(b) || mapping.some((mapped, i) => mapped !== -1 && l[a][i] !== r[b][mapped])) continue;
      mapping[a] = b;
      used.add(b);
      if (search(depth + 1)) return true;
      used.delete(b);
      mapping[a] = -1;
    }
    return false;
  };
  return search(0);
}

/** 새 결합을 만들거나 기존 차수를 정확히 1 올리는 조작이다. 입력은 바꾸지 않는다. */
export function checkAssemblyBond(graph: AssemblyGraph, a: number, b: number): AssemblyOperationCheck {
  assertShape(graph);
  assertIndex(graph, a);
  assertIndex(graph, b);
  if (a === b) throw new RangeError('서로 다른 원자 둘을 골라야 한다.');
  const blocked = (reason: AssemblyBlockReason): AssemblyOperationCheck =>
    ({ allowed: false, reason, message: ASSEMBLY_BLOCK_MESSAGES[reason] });
  const bond = graph.bonds.find(edge => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
  if (bond?.order === 3) return blocked('BOND_ORDER_EXCEEDED');
  if (graph.atoms[a].rad === 0 || graph.atoms[b].rad === 0) return blocked('NO_UNPAIRED_ELECTRON');
  if ([a, b].some(i => assemblyBondOrderSum(graph, i) + 1 > ASSEMBLY_ELEMENTS[graph.atoms[i].element].maxBondOrderSum)) {
    return blocked('VALENCE_EXCEEDED');
  }
  const component = connectedIndices(graph, a);
  if (!bond && component.has(b)) return blocked('RING_CREATION');
  if (bond?.order === 1 && component.size === 2 && [a, b].every(i =>
    graph.atoms[i].element === 'O' && assemblyFormalCharge(graph, i) === 0)) {
    return blocked('O2_COMPLETION');
  }
  // 앞의 안전 검사는 어긋난 외부 장부에서도 작동하지만, 허용에는 올바른 장부가 필요하다.
  assertElectronLedger(graph);
  return { allowed: true };
}

/** UI와 독립적인 상태 전이. 차단 시 같은 입력을 돌려주고, 허용 시 새 그래프를 만든다. */
export function addAssemblyBond(graph: AssemblyGraph, a: number, b: number):
  { readonly graph: AssemblyGraph; readonly check: AssemblyOperationCheck } {
  const check = checkAssemblyBond(graph, a, b);
  if (!check.allowed) return { graph, check };
  let found = false;
  const bonds: AssemblyBond[] = graph.bonds.map(edge => {
    if (!((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a))) return { ...edge };
    found = true;
    return { ...edge, order: (edge.order + 1) as BondOrder };
  });
  if (!found) bonds.push({ a, b, order: 1 });
  const atoms = graph.atoms.map((atom, i) => ({ ...atom, rad: atom.rad - (i === a || i === b ? 1 : 0) }));
  return { graph: { atoms, bonds }, check };
}

export type AssemblyResult =
  | { readonly kind: 'matched'; readonly molecule: AssemblyMolecule; readonly message: string }
  | { readonly kind: 'paired-unlisted' | 'unpaired'; readonly message: string };

/** 작업판에서 선택한 연결 성분 하나만 판정한다. 빈 판과 여러 분자는 호출 대상이 아니다. */
export function evaluateAssembly(graph: AssemblyGraph): AssemblyResult {
  assertShape(graph);
  assertElectronLedger(graph);
  if (!graph.atoms.length || connectedIndices(graph, 0).size !== graph.atoms.length ||
    graph.bonds.length !== graph.atoms.length - 1) {
    throw new RangeError('결과 판정에는 고리가 없는 연결 성분 하나가 필요하다.');
  }
  if (graph.atoms.some(a => a.rad > 0)) return { kind: 'unpaired', message: ASSEMBLY_MESSAGES.unpaired };
  const molecule = ASSEMBLY_MOLECULES.find(m => areAssemblyGraphsIsomorphic(graph, m));
  return molecule ? { kind: 'matched', molecule, message: molecule.message } :
    { kind: 'paired-unlisted', message: ASSEMBLY_MESSAGES.pairedUnlisted };
}
