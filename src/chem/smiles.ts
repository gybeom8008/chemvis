/**
 * A small SMILES reader (the standard one-line notation for molecules), enough
 * for teaching-size molecules: the organic subset, bracket atoms with charges
 * and hydrogens, branches, ring closures, and aromatic rings (kekulized).
 *
 * Atom names follow the order atoms appear: element symbol plus a running
 * number per element (C1, C2, O1 …); an element that appears once keeps the
 * bare symbol (N). Hydrogens are numbered H1, H2 … in the order of the atoms
 * they sit on.
 */
import { ELEMENTS } from './elements';
import type { MolDef } from './library';

interface PAtom {
  el: string;
  aromatic: boolean;
  charge: number;
  /** Explicit H count from a bracket atom; null = work it out. */
  hcount: number | null;
  bracket: boolean;
}

interface PBond {
  a: number;
  b: number;
  order: number;
  aromatic: boolean;
}

const ORGANIC = ['Cl', 'Br', 'B', 'C', 'N', 'O', 'P', 'S', 'F', 'I'];
const AROMATIC = ['c', 'n', 'o', 's', 'p', 'b'];
const NORMAL_VALENCE: Record<string, number[]> = {
  B: [3],
  C: [4],
  N: [3, 5],
  O: [2],
  P: [3, 5],
  S: [2, 4, 6],
  F: [1],
  Cl: [1],
  Br: [1],
  I: [1],
};

export class SmilesError extends Error {}

export function parseSmiles(src: string): MolDef {
  const s = src.trim();
  if (!s) throw new SmilesError('SMILES가 비어 있어요.');
  if (s.includes('.')) throw new SmilesError('점(.)으로 나뉜 SMILES는 분자마다 따로 mol로 적어 주세요.');
  const atoms: PAtom[] = [];
  const bonds: PBond[] = [];
  const stack: number[] = [];
  const rings = new Map<number, { atom: number; order: number | null; aromatic: boolean }>();
  let prev = -1;
  let pendingOrder: number | null = null;
  let pendingAromatic = false;
  let i = 0;

  const addAtom = (a: PAtom) => {
    atoms.push(a);
    const idx = atoms.length - 1;
    if (prev >= 0) {
      const arom = pendingOrder === null && a.aromatic && atoms[prev].aromatic;
      bonds.push({ a: prev, b: idx, order: pendingOrder ?? 1, aromatic: arom || pendingAromatic });
    }
    pendingOrder = null;
    pendingAromatic = false;
    prev = idx;
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      if (prev < 0) throw new SmilesError('괄호가 원자보다 먼저 나왔어요.');
      stack.push(prev);
      i++;
      continue;
    }
    if (ch === ')') {
      if (!stack.length) throw new SmilesError("괄호 ')'가 '('보다 많아요.");
      prev = stack.pop()!;
      i++;
      continue;
    }
    if (ch === '-' || ch === '=' || ch === '#' || ch === '$' || ch === ':') {
      pendingOrder = ch === '-' ? 1 : ch === '=' ? 2 : ch === '#' ? 3 : ch === '$' ? 4 : null;
      pendingAromatic = ch === ':';
      i++;
      continue;
    }
    if (ch === '/' || ch === '\\') {
      i++; // stereo marks are ignored in 2D drawings
      continue;
    }
    if (/\d/.test(ch) || ch === '%') {
      let n: number;
      if (ch === '%') {
        n = parseInt(s.slice(i + 1, i + 3), 10);
        i += 3;
      } else {
        n = parseInt(ch, 10);
        i++;
      }
      if (prev < 0) throw new SmilesError('고리 번호가 원자보다 먼저 나왔어요.');
      const open = rings.get(n);
      if (open) {
        const order = pendingOrder ?? open.order ?? 1;
        const arom = (pendingOrder === null && open.order === null && atoms[prev].aromatic && atoms[open.atom].aromatic) || pendingAromatic || open.aromatic;
        bonds.push({ a: open.atom, b: prev, order, aromatic: arom });
        rings.delete(n);
      } else {
        rings.set(n, { atom: prev, order: pendingOrder, aromatic: pendingAromatic });
      }
      pendingOrder = null;
      pendingAromatic = false;
      continue;
    }
    if (ch === '[') {
      const end = s.indexOf(']', i);
      if (end < 0) throw new SmilesError("대괄호 '['의 짝인 ']'가 없어요.");
      addAtom(parseBracket(s.slice(i + 1, end)));
      i = end + 1;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (ORGANIC.includes(two)) {
      addAtom({ el: two, aromatic: false, charge: 0, hcount: null, bracket: false });
      i += 2;
      continue;
    }
    if (ORGANIC.includes(ch)) {
      addAtom({ el: ch, aromatic: false, charge: 0, hcount: null, bracket: false });
      i++;
      continue;
    }
    if (AROMATIC.includes(ch)) {
      addAtom({ el: ch.toUpperCase(), aromatic: true, charge: 0, hcount: null, bracket: false });
      i++;
      continue;
    }
    throw new SmilesError(`SMILES에서 '${ch}'(${i + 1}번째 글자)를 읽지 못했어요.`);
  }
  if (stack.length) throw new SmilesError("괄호 '('의 짝인 ')'가 없어요.");
  if (rings.size) throw new SmilesError(`고리 번호 ${[...rings.keys()].join(', ')}의 짝이 없어요.`);

  kekulize(atoms, bonds);

  // Hydrogens and lone pairs.
  const bondSum = atoms.map(() => 0);
  for (const b of bonds) {
    bondSum[b.a] += b.order;
    bondSum[b.b] += b.order;
  }
  const hcount = atoms.map((a, k) => {
    if (a.hcount !== null) return a.hcount;
    if (a.bracket) return 0;
    const target = (NORMAL_VALENCE[a.el] ?? [0]).find((v) => v >= bondSum[k]) ?? bondSum[k];
    return Math.max(0, target - bondSum[k]);
  });

  const perEl = new Map<string, number>();
  for (const a of atoms) perEl.set(a.el, (perEl.get(a.el) ?? 0) + 1);
  const seen = new Map<string, number>();
  const out: MolDef = { formula: `smiles:${s}`, name: s, atoms: [], bonds: [] };
  atoms.forEach((a, k) => {
    const info = ELEMENTS[a.el];
    if (!info) throw new SmilesError(`원소 '${a.el}'은(는) 아직 그릴 수 없어요.`);
    const n = (seen.get(a.el) ?? 0) + 1;
    seen.set(a.el, n);
    const label = (perEl.get(a.el) ?? 0) > 1 || a.el === 'H' ? `${a.el}${n}` : a.el;
    const nonbonding = info.valence - a.charge - bondSum[k] - hcount[k];
    if (nonbonding < 0) throw new SmilesError(`${label} 원자의 결합이 너무 많아요(전하 ${a.charge}).`);
    out.atoms.push({ label, el: a.el, lp: Math.floor(nonbonding / 2), rad: nonbonding % 2 });
  });
  for (const b of bonds) out.bonds.push([b.a, b.b, b.order]);
  let h = seen.get('H') ?? 0;
  atoms.forEach((_, k) => {
    for (let j = 0; j < hcount[k]; j++) {
      h++;
      out.atoms.push({ label: `H${h}`, el: 'H', lp: 0 });
      out.bonds.push([k, out.atoms.length - 1, 1]);
    }
  });
  return out;
}

function parseBracket(body: string): PAtom {
  const m = body.match(/^(\d+)?([A-Z][a-z]?|[cnospb])(@{0,2})(H\d*)?([+-]+\d*|[+-]\d+)?(:\d+)?$/);
  if (!m) throw new SmilesError(`[${body}]을(를) 읽지 못했어요.`);
  const sym = m[2];
  const aromatic = sym === sym.toLowerCase();
  const el = aromatic ? sym.toUpperCase() : sym;
  let hcount = 0;
  if (m[4]) hcount = m[4].length > 1 ? parseInt(m[4].slice(1), 10) : 1;
  let charge = 0;
  if (m[5]) {
    const c = m[5];
    const sign = c[0] === '+' ? 1 : -1;
    const digits = c.replace(/[+-]/g, '');
    charge = sign * (digits ? parseInt(digits, 10) : c.length);
  }
  return { el, aromatic, charge, hcount, bracket: true };
}

/** Turn aromatic bonds into alternating single/double bonds (a perfect matching of aromatic atoms). */
function kekulize(atoms: PAtom[], bonds: PBond[]): void {
  const arom = bonds.filter((b) => b.aromatic);
  if (!arom.length) return;
  for (const b of arom) b.order = 1;
  // Atoms that need a double bond: aromatic C (and N without H/charge) with fewer than 3 neighbours… simplified:
  const need = new Set<number>();
  atoms.forEach((a, i) => {
    if (!a.aromatic) return;
    const deg = bonds.filter((b) => b.a === i || b.b === i).length;
    const h = a.hcount ?? 0;
    if (a.el === 'C' && deg + h <= 3) need.add(i);
    if (a.el === 'N' && !a.bracket && deg === 2) need.add(i);
  });
  const cand = arom.filter((b) => need.has(b.a) && need.has(b.b));
  const matched = new Set<number>();
  const chosen: PBond[] = [];
  const order = [...need];
  const solve = (k: number): boolean => {
    while (k < order.length && matched.has(order[k])) k++;
    if (k >= order.length) return true;
    const v = order[k];
    for (const b of cand) {
      if (b.a !== v && b.b !== v) continue;
      const u = b.a === v ? b.b : b.a;
      if (matched.has(u)) continue;
      matched.add(u);
      matched.add(v);
      chosen.push(b);
      if (solve(k + 1)) return true;
      chosen.pop();
      matched.delete(u);
      matched.delete(v);
    }
    return false;
  };
  if (!solve(0)) throw new SmilesError('방향족 고리에서 이중 결합 위치를 정하지 못했어요. 이중 결합(=)을 직접 적어 주세요.');
  for (const b of chosen) b.order = 2;
}
