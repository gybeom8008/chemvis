/** 조립판을 엔진 입력으로 옮긴다. 반응이나 실제 낱원자 상태를 뜻하지 않는다. */
import { bondKey, emptyWorld, type World } from '../engine/world';
import {
  addAssemblyBond, createAssemblyGraph,
  type AssemblyAtom, type AssemblyBlockReason, type AssemblyGraph,
} from './assembly-data';

export interface AssemblyPlacedAtom extends AssemblyAtom {
  readonly x: number;
  readonly y: number;
}

export interface AssemblyBoard extends AssemblyGraph {
  readonly atoms: readonly AssemblyPlacedAtom[];
}

interface AssemblyBase {
  /** compileFrom에 넘길 독립된 복사본이다. 입력 좌표를 그대로 보존한다. */
  readonly world: World;
  /** 그래프 배열 순서에 대응한다. 이어서 조립할 때 원자 배열 순서를 유지한다. */
  readonly atomIds: readonly string[];
}

export type AssemblyHeader = AssemblyBase & (
  | { readonly mode: 'script'; readonly script: string }
  | {
    readonly mode: 'world'; readonly script: null;
    readonly reason: 'ATOM_STATE_UNSUPPORTED' | 'BOND_LAYOUT_UNSUPPORTED';
    readonly message: string;
  }
);

export type AssemblyStep =
  | { readonly allowed: true; readonly script: string; readonly graph: AssemblyGraph }
  | { readonly allowed: false; readonly reason: AssemblyBlockReason; readonly message: string };

const atomId = (graph: AssemblyGraph, index: number) => `a${index}.${graph.atoms[index].element}`;

/** DSL 좌표는 지수 표기를 받지 않는다. 반올림하지 않고 십진 표기로 펼친다. */
function coordinate(value: number): string {
  const [mantissa, exponent] = String(value).split('e');
  if (exponent === undefined) return mantissa;
  const sign = mantissa.startsWith('-') ? '-' : '';
  const unsigned = mantissa.replace('-', '');
  const point = (unsigned.indexOf('.') < 0 ? unsigned.length : unsigned.indexOf('.')) + Number(exponent);
  const digits = unsigned.replace('.', '');
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * 머리말만으로 표현할 수 없으면 script를 만들지 않고 이유와 World를 반환한다.
 * 현재 지원하는 문자열 머리말은 결합 없는 H·F·Cl이다. C·N·O 또는 기존 결합은
 * World 경로로 복원한다. 일반 분자 SMILES를 조립용 전자 상태로 대신 쓰지 않는다.
 * 저장 상태를 복원하는 함수이며, 과거 조작이 허용됐는지는 다시 판정하지 않는다.
 */
export function createAssemblyHeader(board: AssemblyBoard): AssemblyHeader {
  const expected = createAssemblyGraph(board.atoms.map(a => a.element), board.bonds);
  board.atoms.forEach((a, i) => {
    if (a.lp !== expected.atoms[i].lp || a.rad !== expected.atoms[i].rad) {
      throw new RangeError('조립판의 전자 수가 결합 상태와 맞지 않아요.');
    }
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) {
      throw new RangeError('원자 위치에는 유한한 좌표를 써 주세요.');
    }
  });

  const world = emptyWorld();
  const atomIds = board.atoms.map((_, i) => atomId(board, i));
  board.atoms.forEach((a, i) => {
    const owner = `a${i}`;
    world.atoms.set(atomIds[i], {
      id: atomIds[i], el: a.element, lp: a.lp, rad: a.rad, x: a.x, y: a.y,
      owner, label: a.element, num: i + 1, crowd: false,
    });
    world.names.set(owner, atomIds[i]);
  });
  world.counter = board.atoms.length;
  for (const b of board.bonds) {
    const a = atomIds[b.a];
    const other = atomIds[b.b];
    world.bonds.set(bondKey(a, other), { a, b: other, order: b.order });
  }
  const base = { world, atomIds };
  if (board.bonds.length) return {
    ...base, mode: 'world', script: null, reason: 'BOND_LAYOUT_UNSUPPORTED',
    message: '지금 대본으로는 원자마다 정한 위치와 결합을 함께 복원할 수 없어요. 저장한 조립판에서 이어서 그려요.',
  };
  // 라이브러리와 SMILES에서 실제로 제공하는 단일 원자 전자 상태다.
  const formulas = { H: 'H·', F: 'smiles:[F]', Cl: 'Cl·' };
  if (board.atoms.some(a => !(a.element in formulas))) return {
    ...base, mode: 'world', script: null, reason: 'ATOM_STATE_UNSUPPORTED',
    message: '지금 대본으로는 탄소·질소·산소 원자 모형의 전자 수를 지정할 수 없어요. 조립판에 정한 전자 수로 이어서 그려요.',
  };
  const declarations = board.atoms.map((a, i) =>
    `mol a${i} = ${formulas[a.element as keyof typeof formulas]} at ${coordinate(a.x)},${coordinate(a.y)}`);
  return {
    ...base, mode: 'script',
    script: ['scene "분자 구조를 조립해요"', 'stage gas', 'lens attract off', ...declarations].join('\n'),
  };
}

/**
 * 새 결합 또는 기존 결합 차수 +1이다. 차단되면 script 필드 자체가 없다.
 * 반환 graph는 컴파일 성공 뒤 적용할 예상 상태다. 실제 끝 상태는 별도로 대조한다.
 * approach를 쓰지 않아 pulls를 만들지 않는다. :e 두 줄은 반드시 같은 step에 둔다.
 */
export function createAssemblyStep(graph: AssemblyGraph, a: number, b: number): AssemblyStep {
  const next = addAssemblyBond(graph, a, b);
  if (!next.check.allowed) return next.check;
  const left = atomId(graph, a);
  const right = atomId(graph, b);
  const existing = graph.bonds.some(edge =>
    (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
  return {
    allowed: true, graph: next.graph,
    script: [
      `step "${existing ? '결합을 한 겹 더 이어요.' : '두 원자 모형을 이어요.'}"`,
      `  hop ${left}:e -> ${left}~${right}`,
      `  hop ${right}:e -> ${left}~${right}`,
    ].join('\n'),
  };
}
