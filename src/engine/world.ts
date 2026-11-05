import { element } from '../chem/elements';
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
}

export interface Bond {
  a: string;
  b: string;
  order: number;
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
    lens: { charge: true, attract: false, numbers: false },
    counter: 0,
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

export function formalCharge(w: World, atom: Atom): number {
  return element(atom.el).valence - atom.lp * 2 - atom.rad - bondOrderSum(w, atom.id);
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
  const counts = new Map<string, number>();
  for (const i of ids) {
    const el = w.atoms.get(i)!.el;
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  const els = [...counts.keys()];
  const hasC = counts.has('C');
  els.sort((p, q) => {
    if (hasC) {
      if (p === 'C') return -1;
      if (q === 'C') return 1;
      if (p === 'H') return -1;
      if (q === 'H') return 1;
    }
    return p < q ? -1 : 1;
  });
  let f = els.map((e) => e + (counts.get(e)! > 1 ? counts.get(e) : '')).join('');
  if (!hasC && counts.has('O') && counts.has('H') && counts.size === 2) {
    const h = counts.get('H')!;
    const o = counts.get('O')!;
    f = o === 1 && h === 1 ? 'OH' : `H${h > 1 ? h : ''}O${o > 1 ? o : ''}`;
  } else if (!hasC && counts.has('N') && counts.has('H') && counts.size === 2) {
    f = `NH${counts.get('H')! > 1 ? counts.get('H') : ''}`;
  } else if (!hasC && counts.has('H') && counts.size === 2) {
    const other = els.find((e) => e !== 'H')!;
    if (['F', 'Cl', 'Br', 'I'].includes(other)) f = `H${other}`;
  }
  const q = componentCharge(w, ids);
  if (q === 0) return f;
  const mag = Math.abs(q) === 1 ? '' : String(Math.abs(q));
  return f + mag + (q > 0 ? '+' : '-');
}
