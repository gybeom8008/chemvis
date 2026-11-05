import { ELECTRONEGATIVITY, element } from '../chem/elements';
import { LIBRARY, formulaCharge } from '../chem/library';
import type { Vec } from '../util/math';

export interface Atom {
  id: string;
  el: string;
  x: number;
  y: number;
  /** Lone pairs (pairs of non-bonding electrons). */
  lp: number;
  /** Unpaired electrons. */
  rad: number;
  /** Name the script declared (or an automatic name). */
  owner: string;
  label: string;
  /** Tracking number for the "원자 번호" lens; 0 for solvent. */
  num: number;
  /** Background solvent molecule (crowd). */
  crowd: boolean;
  /** For an atom with no bonds: direction (radians) its first unpaired electron faces. */
  face?: number;
  /** While electrons are in flight: slots left empty by unpaired electrons that just left (atoms with no bonds). */
  skip?: number;
  /** Part of a metal electrode: its outer electrons belong to the metal as a whole, so no dots are drawn. */
  lattice?: boolean;
}

export interface Bond {
  a: string;
  b: string;
  order: number;
  /** Coordinate (dative) bond: the atom that supplied both electrons. */
  dative?: string;
}

export interface Site {
  id: string;
  x: number;
  y: number;
  /** Unit vector pointing from the clay surface into the pore. */
  nx: number;
  ny: number;
  region: string;
  plate: number;
  occupant: string | null;
}

export interface Lens {
  charge: boolean;
  attract: boolean;
  numbers: boolean;
  oxidation: boolean;
}

export interface World {
  atoms: Map<string, Atom>;
  bonds: Map<string, Bond>;
  sites: Site[];
  /** Solute anchor atom id → anchor ids of solvent molecules that travel with it. */
  attached: Map<string, string[]>;
  temp: Record<string, number>;
  /** Declared name → anchor atom id. */
  names: Map<string, string>;
  /** Crystal name → atom ids still in the lattice. */
  crystals: Map<string, string[]>;
  lens: Lens;
  counter: number;
  /** Electrons waiting in each electrode (electrode stage). */
  plate: Record<string, number>;
  /** Membrane proteins (membrane stage). */
  proteins: Protein[];
}

export interface Protein {
  name: string;
  kind: 'channel' | 'pump';
  x: number;
  /** What a channel lets through (formula), e.g. K+ or H2O. */
  carries?: string;
}

export const bondKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function emptyWorld(): World {
  return {
    atoms: new Map(),
    bonds: new Map(),
    sites: [],
    attached: new Map(),
    temp: {},
    names: new Map(),
    crystals: new Map(),
    lens: { charge: true, attract: false, numbers: false, oxidation: false },
    counter: 0,
    plate: {},
    proteins: [],
  };
}

export function cloneWorld(w: World): World {
  return {
    atoms: new Map([...w.atoms].map(([k, a]) => [k, { ...a }])),
    bonds: new Map([...w.bonds].map(([k, b]) => [k, { ...b }])),
    sites: w.sites.map((s) => ({ ...s })),
    attached: new Map([...w.attached].map(([k, l]) => [k, [...l]])),
    temp: { ...w.temp },
    names: new Map(w.names),
    crystals: new Map([...w.crystals].map(([k, l]) => [k, [...l]])),
    lens: { ...w.lens },
    counter: w.counter,
    plate: { ...w.plate },
    proteins: w.proteins.map((p) => ({ ...p })),
  };
}

export function getBond(w: World, a: string, b: string): Bond | undefined {
  return w.bonds.get(bondKey(a, b));
}

export function neighbors(w: World, id: string): { id: string; order: number }[] {
  const out: { id: string; order: number }[] = [];
  for (const b of w.bonds.values()) {
    if (b.order <= 0) continue;
    if (b.a === id) out.push({ id: b.b, order: b.order });
    else if (b.b === id) out.push({ id: b.a, order: b.order });
  }
  return out;
}

export function bondOrderSum(w: World, id: string): number {
  return neighbors(w, id).reduce((s, n) => s + n.order, 0);
}

/**
 * Formal charge. A coordinate (dative) bond is counted the way chemists write complexes:
 * its pair still belongs to the donor (as if a lone pair), so the metal keeps its ionic charge.
 */
export function formalCharge(w: World, atom: Atom): number {
  let bonded = 0;
  for (const b of w.bonds.values()) {
    if (b.order <= 0 || (b.a !== atom.id && b.b !== atom.id)) continue;
    if (b.dative) bonded += b.dative === atom.id ? 2 : 0;
    else bonded += b.order;
  }
  return element(atom.el).valence - atom.lp * 2 - atom.rad - bonded;
}

/** Electrons around an atom (bonding pairs count fully, as in the octet rule). */
export function electronCount(w: World, atom: Atom): number {
  return atom.lp * 2 + atom.rad + bondOrderSum(w, atom.id) * 2;
}

/** All atom ids connected to `id` by bonds. */
export function component(w: World, id: string): string[] {
  const seen = new Set([id]);
  const stack = [id];
  const adj = adjacency(w);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of adj.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

export function adjacency(w: World): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const b of w.bonds.values()) {
    if (b.order <= 0) continue;
    if (!adj.has(b.a)) adj.set(b.a, []);
    if (!adj.has(b.b)) adj.set(b.b, []);
    adj.get(b.a)!.push(b.b);
    adj.get(b.b)!.push(b.a);
  }
  return adj;
}

export function allComponents(w: World): string[][] {
  const seen = new Set<string>();
  const adj = adjacency(w);
  const out: string[][] = [];
  for (const id of w.atoms.keys()) {
    if (seen.has(id)) continue;
    const comp: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of adj.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Representative atom of a component: first non-hydrogen, lowest tracking number. */
export function anchorOf(w: World, ids: string[]): string {
  const atoms = ids.map((i) => w.atoms.get(i)!).filter(Boolean);
  atoms.sort((p, q) => {
    const ph = p.el === 'H' ? 1 : 0;
    const qh = q.el === 'H' ? 1 : 0;
    if (ph !== qh) return ph - qh;
    if (p.num !== q.num) return (p.num || 1e9) - (q.num || 1e9);
    return p.id < q.id ? -1 : 1;
  });
  return atoms[0].id;
}

export function componentCharge(w: World, ids: string[]): number {
  return ids.reduce((s, i) => s + formalCharge(w, w.atoms.get(i)!), 0);
}

export function centerOf(w: World, ids: string[]): Vec {
  let x = 0;
  let y = 0;
  for (const i of ids) {
    const a = w.atoms.get(i)!;
    x += a.x;
    y += a.y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

/** Molecular formula in Hill order with charge, e.g. H3O+, Ca2+. */
export function formulaOf(w: World, ids: string[]): string {
  const els = ids.map((i) => w.atoms.get(i)!.el);
  const unpaired = ids.reduce((n, i) => n + w.atoms.get(i)!.rad, 0);
  const f = hillFormula(els, componentCharge(w, ids), unpaired);
  // Small molecules go by their usual name (H2CO3, not CH2O3; SO42-, not O4S2-).
  return els.filter((e) => e === 'C').length <= 1 ? (libraryName(f) ?? f) : f;
}

function hillFormula(els: string[], q: number, unpaired: number): string {
  const counts = new Map<string, number>();
  for (const el of els) counts.set(el, (counts.get(el) ?? 0) + 1);
  const keys = [...counts.keys()];
  const hasC = counts.has('C');
  keys.sort((p, q2) => {
    if (hasC) {
      if (p === 'C') return -1;
      if (q2 === 'C') return 1;
      if (p === 'H') return -1;
      if (q2 === 'H') return 1;
    }
    return p < q2 ? -1 : 1;
  });
  let f = keys.map((e) => e + (counts.get(e)! > 1 ? counts.get(e) : '')).join('');
  if (!hasC && counts.has('O') && counts.has('H') && counts.size === 2) {
    const h = counts.get('H')!;
    const o = counts.get('O')!;
    f = o === 1 && h === 1 ? 'OH' : `H${h > 1 ? h : ''}O${o > 1 ? o : ''}`;
  } else if (!hasC && counts.has('N') && counts.has('H') && counts.size === 2) {
    f = `NH${counts.get('H')! > 1 ? counts.get('H') : ''}`;
  } else if (!hasC && counts.has('H') && counts.size === 2) {
    const other = keys.find((e) => e !== 'H')!;
    if (['F', 'Cl', 'Br', 'I'].includes(other)) f = `H${other}`;
  }
  // An odd number of unpaired electrons makes it a radical, written with "·".
  if (unpaired % 2 === 1) f += '·';
  if (q === 0) return f;
  const mag = Math.abs(q) === 1 ? '' : String(Math.abs(q));
  return f + mag + (q > 0 ? '+' : '-');
}

let libIndex: Map<string, string> | null = null;

/** Library name for a computed formula, when exactly one library molecule has that make-up. */
function libraryName(f: string): string | undefined {
  if (!libIndex) {
    libIndex = new Map();
    const dup = new Set<string>();
    for (const [key, def] of LIBRARY) {
      const h = hillFormula(
        def.atoms.map((a) => a.el),
        formulaCharge(key),
        def.atoms.reduce((n, a) => n + (a.rad ?? 0), 0),
      );
      if (h === key) continue;
      if (libIndex.has(h) && libIndex.get(h) !== key) dup.add(h);
      else libIndex.set(h, key);
    }
    for (const d of dup) libIndex.delete(d);
  }
  return libIndex.get(f);
}

/**
 * Oxidation state: give each bond's electrons to the more electronegative atom
 * (split evenly between identical elements), then compare with the neutral atom.
 */
export function oxidationState(w: World, atom: Atom): number {
  const en = (el: string) => ELECTRONEGATIVITY[el] ?? 2;
  let owned = atom.lp * 2 + atom.rad;
  for (const b of w.bonds.values()) {
    if (b.order <= 0 || (b.a !== atom.id && b.b !== atom.id)) continue;
    const other = w.atoms.get(b.a === atom.id ? b.b : b.a)!;
    if (b.dative) {
      // Ligand electrons stay with the ligand (ionic convention for complexes).
      if (b.dative === atom.id) owned += 2;
      continue;
    }
    const d = en(atom.el) - en(other.el);
    if (Math.abs(d) < 1e-9) owned += b.order;
    else if (d > 0) owned += b.order * 2;
  }
  return element(atom.el).valence - owned;
}
