/**
 * Electrons drawn as what they are in a Lewis structure: pairs.
 *
 * Every electron pair is one visible thing, a soft "pouch" with its two electrons in it.
 * A pouch held by one atom is a lone pair; a pouch held by two atoms is a bond.
 * A reaction is then shown as it happens: a pouch lets go of one atom or takes hold of
 * another, with the same two electrons in it from start to end. Nothing turns into a line,
 * and no arrow has to be decoded.
 *
 * Single electrons (radicals, redox) are half-size pouches with one electron; an electron
 * that goes from one atom to another flies there as a dot.
 */
import { ELECTRONEGATIVITY, METALS as METAL_ELS, element } from '../chem/elements';
import { electronDomains } from '../chem/geometry';
import { plateSlot, type ArrowAnim, type StepAnim, type Timeline } from '../engine/timeline';
import { component, formalCharge, type Atom, type World } from '../engine/world';
import { add, clamp, dist, fromAngle, lerp, lerpV, norm, perp, scale, smooth, sub, type Vec } from '../util/math';

export interface PairWin {
  pre: boolean;
  during: boolean;
  post: boolean;
  settle: number;
  prog: number;
  cue: number;
  /** Progress through the change window before easing (0..1). */
  frac: number;
}

export interface PairsInput {
  step: StepAnim | undefined;
  win: PairWin;
  /** The world to draw when nothing is changing (before the change, or after it). */
  topo: World;
  after: World;
  atoms: Atom[];
  pos: Map<string, Vec>;
  isCrowd(a: Atom): boolean;
  opacity(id: string): number;
  /** Electrons on the move are enlarged by this on small screens. */
  eScale: number;
  /** Progress through the step (0..1). */
  t: number;
  /** The stage's electrodes (electrons kept in a plate are drawn near its top). */
  electrodes?: Record<string, { x: number; top: number }>;
  /** A scene about many molecules at once (collisions, counts): molecules are drawn without their electrons. */
  simple?: boolean;
  /** Atoms of molecules and ions that take no part in the scene's reactions: drawn without their electrons. */
  aside?: Set<string>;
}

const f1 = (n: number) => n.toFixed(1);
/** Width of a pouch with two electrons, and with one. */
const W2 = 13;
const W1 = 8.5;
/** Width of half a pouch: one of the two electrons of a pair, drawn beside the other. */
const WH = 6.6;
/** How far beyond the atom's edge a lone pouch's electrons sit. */
const OUT = 5.5;
/** Half the distance between the two electrons of a pair. */
const SIDE = 3.3;
const DOT = 2.5;
const FLY = 4.2;

const angOf = (p: Vec, q: Vec) => Math.atan2(q.y - p.y, q.x - p.x);
function angDelta(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const angDist = (a: number, b: number) => Math.abs(angDelta(a, b));
const angLerp = (a: number, b: number, u: number) => a + angDelta(a, b) * u;
const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Sideways offsets of the strands of a bond with n pairs, and how wide each strand is. */
const strandOffsets = (n: number): number[] => (n <= 1 ? [0] : n === 2 ? [-5.2, 5.2] : [-8.4, 0, 8.4]);
const strandWidth = (n: number): number => (n <= 1 ? W2 : n === 2 ? 8.5 : 6.5);

/** A lone pouch on an atom: its direction and how many electrons are in it. */
interface Dom {
  angle: number;
  n: number;
}

/*
 * Stability. Which way a lone pair points, which pouch an electron joins, where a charge badge
 * sits: these are decided from the positions stored in the world (no thermal motion, no half-way
 * positions), once, and then only turned with the molecule. Deciding them from the positions of
 * the moment makes them flip between two near-equal choices from one frame to the next.
 */
const adjCache = new WeakMap<World, Map<string, string[]>>();
function adjacency(w: World): Map<string, string[]> {
  let m = adjCache.get(w);
  if (m) return m;
  m = new Map<string, string[]>();
  for (const b of w.bonds.values()) {
    if (b.order <= 0) continue;
    (m.get(b.a) ?? m.set(b.a, []).get(b.a)!).push(b.b);
    (m.get(b.b) ?? m.set(b.b, []).get(b.b)!).push(b.a);
  }
  adjCache.set(w, m);
  return m;
}

/** Lone pouches of an atom, pointing as the world's own coordinates say. */
const domCache = new WeakMap<World, Map<string, Dom[]>>();
function domainsOf(w: World, id: string): Dom[] {
  let m = domCache.get(w);
  if (!m) domCache.set(w, (m = new Map()));
  let d = m.get(id);
  if (d) return d;
  const a = w.atoms.get(id);
  if (!a || a.lp + a.rad <= 0) d = [];
  else {
    const dirs = (adjacency(w).get(id) ?? []).filter((o) => w.atoms.has(o)).map((o) => angOf(a, w.atoms.get(o)!));
    d = electronDomains(a, dirs, a.lp, a.rad, a.face, a.skip ?? 0).map((x) => ({ angle: x.angle, n: x.single ? 1 : 2 }));
  }
  m.set(id, d);
  return d;
}

/** How far the atom's molecule is turned now, compared with the world's coordinates. */
export function turnOf(w: World, id: string, pos: Map<string, Vec>): number {
  const a = w.atoms.get(id);
  const p = pos.get(id);
  if (!a || !p) return 0;
  for (const o of adjacency(w).get(id) ?? []) {
    const wo = w.atoms.get(o);
    const po = pos.get(o);
    if (wo && po) return angDelta(angOf(a, wo), angOf(p, po));
  }
  return 0;
}

/**
 * The lone electrons of an atom for the 'lines' style, steady in the same way: their directions are
 * read from the world's own coordinates and turned with the molecule. `counts` draws another
 * number of electrons than the world's atom has (the 'lines' style draws the electrons an atom
 * keeps in the middle of a step around the bonds it has at the end).
 */
const countCache = new WeakMap<World, Map<string, Dom[]>>();
export function stableDomains(
  w: World,
  id: string,
  pos: Map<string, Vec>,
  counts?: { lp: number; rad: number; face?: number; skip?: number },
): { angle: number; single: boolean }[] {
  const a = w.atoms.get(id);
  if (!a) return [];
  let doms: Dom[];
  if (!counts || (counts.lp === a.lp && counts.rad === a.rad && (counts.skip ?? 0) === (a.skip ?? 0) && counts.face === a.face)) doms = domainsOf(w, id);
  else {
    const key = `${id}|${counts.lp}|${counts.rad}|${counts.skip ?? 0}|${counts.face ?? ''}`;
    let m = countCache.get(w);
    if (!m) countCache.set(w, (m = new Map()));
    let d = m.get(key);
    if (!d) {
      const dirs = (adjacency(w).get(id) ?? []).filter((o) => w.atoms.has(o)).map((o) => angOf(a, w.atoms.get(o)!));
      d = counts.lp + counts.rad <= 0 ? [] : electronDomains(a, dirs, counts.lp, counts.rad, counts.face, counts.skip ?? 0).map((x) => ({ angle: x.angle, n: x.single ? 1 : 2 }));
      m.set(key, d);
    }
    doms = d;
  }
  const turn = turnOf(w, id, pos);
  return doms.map((d) => ({ angle: d.angle + turn, single: d.n === 1 }));
}

/**
 * Electrons half-way between two arrangements around the same atom: each one turns from its old
 * direction to the nearest new one. Null when the two do not have the same electrons.
 */
export function blendDomains(
  from: { angle: number; single: boolean }[],
  to: { angle: number; single: boolean }[],
  u: number,
): { angle: number; single: boolean }[] | null {
  const n = from.length;
  if (n !== to.length) return null;
  if (!n) return [];
  const x = [...from].sort((p, q) => p.angle - q.angle);
  const y = [...to].sort((p, q) => p.angle - q.angle);
  let best = 0;
  let bestCost = Infinity;
  for (let sh = 0; sh < n; sh++) {
    let cost = 0;
    for (let i = 0; i < n; i++) cost += angDist(x[i].angle, y[(i + sh) % n].angle) + (x[i].single === y[(i + sh) % n].single ? 0 : 100);
    if (cost < bestCost) {
      bestCost = cost;
      best = sh;
    }
  }
  if (bestCost >= 100) return null;
  return x.map((d, i) => ({ angle: angLerp(d.angle, y[(i + best) % n].angle, u), single: d.single }));
}

/**
 * A direction around an atom that is clear of its bonds and lone pouches (for the charge badge
 * and the oxidation number), decided in the world's coordinates and turned with the molecule.
 */
const freeCache = new WeakMap<World, Map<string, number>>();
export function stableFreeAngle(w: World, id: string, pos: Map<string, Vec>, extra: number[] = [], prefer = -Math.PI / 4): number {
  const a = w.atoms.get(id);
  if (!a) return prefer;
  const turn = turnOf(w, id, pos);
  const ex = extra.map((x) => x - turn);
  const key = `${id}|${prefer.toFixed(2)}|${ex.map((x) => x.toFixed(1)).join(',')}`;
  let m = freeCache.get(w);
  if (!m) freeCache.set(w, (m = new Map()));
  let best = m.get(key);
  if (best === undefined) {
    const nb = (adjacency(w).get(id) ?? []).filter((o) => w.atoms.has(o)).map((o) => angOf(a, w.atoms.get(o)!));
    const taken = [...nb, ...domainsOf(w, id).map((d) => d.angle), ...ex].map((x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((p, q) => p - q);
    if (!taken.length) best = prefer;
    else {
      // The middle of the widest gap. Among equal gaps: the first one going round from the atom's
      // first bond (so that the choice turns with the molecule), or, for an atom without bonds,
      // the one nearest the preferred direction.
      const ref = nb.length ? ((nb[0] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) : null;
      let bestGap = -1;
      let bestRank = Infinity;
      best = prefer;
      taken.forEach((t0, i) => {
        const t1 = i + 1 < taken.length ? taken[i + 1] : taken[0] + 2 * Math.PI;
        const gap = t1 - t0;
        const mid = t0 + gap / 2;
        const rank = ref !== null ? (((mid - ref) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) : angDist(mid, prefer);
        if (gap > bestGap + 1e-6 || (Math.abs(gap - bestGap) <= 1e-6 && rank < bestRank)) {
          bestGap = gap;
          bestRank = rank;
          best = mid;
        }
      });
    }
    m.set(key, best);
  }
  return best + turn;
}

/** Where along a–b the shared electrons sit: nearer the atom that pulls them harder. */
function shareAt(a: Atom, b: Atom): number {
  const ea = ELECTRONEGATIVITY[a.el] ?? 2.2;
  const eb = ELECTRONEGATIVITY[b.el] ?? 2.2;
  return 0.5 + 0.22 * clamp((eb - ea) / 1.4, -1, 1);
}

export interface PairsOutput {
  /** Drawn under the atoms: the pouches. */
  under: string[];
  /** Drawn over the atoms: the electrons. */
  over: string[];
  /** Charges of atoms that change one electron at a time, at this moment. */
  charges?: Map<string, number>;
  /** Directions around those atoms that pouches occupy, for the charge badge to keep clear of. */
  avoid?: Map<string, number[]>;
  /** Electrodes: how many more (or fewer) electrons a plate keeps at this moment than before the step. */
  plate?: Map<string, number>;
}

/**
 * The atoms of molecules and ions that take no part in any reaction of a scene (the sulfate ions
 * of a cell, say). Their electrons are not drawn: every dot on the stage should be one that
 * matters to what happens. Empty for a scene without reactions, where nothing competes for the eye.
 */
const asideCache = new WeakMap<Timeline, Set<string>>();
export function bystanders(tl: Timeline): Set<string> {
  let out = asideCache.get(tl);
  if (out) return out;
  out = new Set<string>();
  asideCache.set(tl, out);
  if (!tl.steps.some((s) => s.arrows.length > 0 || !!s.shifts?.length)) return out;
  const active = new Set<string>();
  const mark = (w: World, id: string | undefined) => {
    if (id && w.atoms.has(id)) for (const x of component(w, id)) active.add(x);
  };
  for (const s of tl.steps) {
    const ends: (string | undefined)[] = [];
    for (const ar of s.arrows) ends.push(ar.src?.a, ar.src?.b, ar.dst?.a, ar.dst?.b, ar.free?.atom);
    for (const sh of s.shifts ?? []) ends.push(sh.src.a, sh.src.b, sh.dst.a, sh.dst.b);
    for (const pl of s.pulls ?? []) ends.push(pl.a, pl.b);
    // Anything whose electrons or bonds are different after the step took part in it as well.
    for (const [id, a] of s.after.atoms) {
      const b = s.before.atoms.get(id);
      if (b && (b.lp !== a.lp || b.rad !== a.rad)) ends.push(id);
    }
    for (const [k, bd] of s.after.bonds) if ((s.before.bonds.get(k)?.order ?? 0) !== bd.order) ends.push(bd.a, bd.b);
    for (const [k, bd] of s.before.bonds) if (!s.after.bonds.has(k)) ends.push(bd.a, bd.b);
    for (const id of ends) {
      mark(s.before, id);
      mark(s.after, id);
    }
  }
  const all = new Map<string, Atom>(tl.initial.atoms);
  for (const s of tl.steps) for (const [id, a] of s.after.atoms) all.set(id, a);
  for (const [id, a] of all) if (!active.has(id) && !a.crowd && !a.lattice) out.add(id);
  return out;
}

/**
 * How much charge to draw on each atom (the 'glow' look). Not a computed charge distribution: a
 * steady rule of thumb that depends only on the bond graph, so it never flickers. It starts from
 * the formal charges and corrects the three places where formal charge misleads the eye:
 *
 *  - Equal atoms get equal charge. The O atoms of a carboxylate, carbonate, sulfate or phosphate
 *    that are bonded to nothing but the central atom share their formal charge and their bond
 *    order evenly, whichever of them the Lewis structure happens to give the double bond to.
 *  - The + of H3O+ or NH4+ is not on the O or N. It is spread over the H atoms bonded to it.
 *  - Bond electrons lean towards the atom that holds them harder (O in water a little negative,
 *    its H atoms a little positive). A lean too small to show (C–H) is left out at both ends, so
 *    that it cannot tint one atom alone. A coordinate bond gets no lean: its formal charges
 *    already put the whole pair on the donor.
 *
 * The sum over a molecule is always its charge.
 */
const drawnCache = new WeakMap<World, Map<string, number>>();
function drawnCharges(w: World): Map<string, number> {
  let out = drawnCache.get(w);
  if (out) return out;
  out = new Map<string, number>();
  drawnCache.set(w, out);
  const adj = adjacency(w);
  const f = new Map<string, number>();
  const order = new Map<string, number>();
  for (const a of w.atoms.values()) if (!a.crowd) f.set(a.id, formalCharge(w, a));
  for (const [k, b] of w.bonds) order.set(k, b.order);
  const real = (el: string) => el in ELECTRONEGATIVITY && el !== 'Ad';
  // Equal O atoms around one centre.
  for (const z of w.atoms.values()) {
    if (z.crowd) continue;
    const ends = (adj.get(z.id) ?? []).filter((o) => {
      const t = w.atoms.get(o);
      return !!t && t.el === 'O' && (adj.get(o) ?? []).length === 1 && !w.bonds.get(keyOf(z.id, o))?.dative;
    });
    if (ends.length < 2) continue;
    const fm = ends.reduce((sum, o) => sum + (f.get(o) ?? 0), 0) / ends.length;
    const bm = ends.reduce((sum, o) => sum + (order.get(keyOf(z.id, o)) ?? 1), 0) / ends.length;
    for (const o of ends) {
      f.set(o, fm);
      order.set(keyOf(z.id, o), bm);
    }
  }
  // A positive centre with H atoms on it: the charge is drawn on the H atoms.
  for (const x of w.atoms.values()) {
    const fx = f.get(x.id) ?? 0;
    if (x.crowd || fx <= 0 || METAL_ELS.has(x.el)) continue;
    const hs = (adj.get(x.id) ?? []).filter((o) => w.atoms.get(o)?.el === 'H');
    if (!hs.length) continue;
    for (const h of hs) f.set(h, (f.get(h) ?? 0) + fx / hs.length);
    f.set(x.id, 0);
  }
  for (const [id, v] of f) out.set(id, v);
  for (const [k, b] of w.bonds) {
    const A = w.atoms.get(b.a);
    const Z = w.atoms.get(b.b);
    if (!A || !Z || A.crowd || Z.crowd || b.dative || !real(A.el) || !real(Z.el)) continue;
    const unit = 0.25 * clamp(((ELECTRONEGATIVITY[Z.el] ?? 2.2) - (ELECTRONEGATIVITY[A.el] ?? 2.2)) / 1.5, -1, 1);
    if (Math.abs(unit) < 0.07) continue;
    const t = unit * (order.get(k) ?? b.order);
    out.set(A.id, (out.get(A.id) ?? 0) + t);
    out.set(Z.id, (out.get(Z.id) ?? 0) - t);
  }
  return out;
}
export function chargeOn(w: World, a: Atom): number {
  return drawnCharges(w).get(a.id) ?? 0;
}

/**
 * What makes a solid read as a solid: its particles lie on one body. An ionic solid gets a pale
 * angular slab behind its ions, a piece of metal one smooth surface around its atoms. The slab is
 * a mark for "these belong to one solid", from the first pair on; it grows as ions join and
 * shrinks as they leave. It is not a crystal face, and it draws no bond between the ions.
 * `skip`: solids the stage draws itself (electrode plates).
 * `prog`: how far the step's change has come (0..1), for atoms that become part of a solid where they are.
 */
export function drawSolids(before: World, after: World, pos: Map<string, Vec>, prog: number, skip: (name: string) => boolean): string[] {
  const back: string[] = [];
  const front: string[] = [];
  const names = new Set([...before.crystals.keys(), ...after.crystals.keys()]);
  for (const name of names) {
    if (skip(name) || name === 'ice') continue;
    const inB = new Set(before.crystals.get(name) ?? []);
    const inA = new Set(after.crystals.get(name) ?? []);
    const ids = [...new Set([...inB, ...inA])].filter((id) => pos.has(id));
    if (!ids.length) continue;
    const atomOf = (id: string) => after.atoms.get(id) ?? before.atoms.get(id)!;
    // How firmly a particle is in the solid at this moment: fully while it is a member before and
    // after; one that arrives counts as it nears its place, one that leaves until it has moved off.
    const hold = (id: string, home: World, reach: number): number => {
      if (inB.has(id) && inA.has(id)) return 1;
      const h = home.atoms.get(id);
      const p = pos.get(id);
      if (!h || !p) return 0;
      return clamp(1.3 - dist(p, h) / reach, 0, 1);
    };
    const metal = ids.some((id) => atomOf(id).lattice);
    if (metal) {
      // Only atoms that are metal (not ions resting against the piece) are inside the surface.
      const whole: { p: Vec; r: number }[] = [];
      for (const id of ids) {
        const a = atomOf(id);
        const wasMetal = !!before.atoms.get(id)?.lattice && inB.has(id);
        const isMetal = !!after.atoms.get(id)?.lattice && inA.has(id);
        if (!wasMetal && !isMetal) continue;
        const r = element(a.el).r;
        // An atom that turns into metal where it rests is taken in as its electrons arrive; one that leaves, as it moves off.
        const k = wasMetal && isMetal ? 1 : isMetal ? smooth(clamp((prog - 0.55) / 0.45, 0, 1)) : hold(id, before, r * 2.2);
        if (k <= 0.01) continue;
        const p = pos.get(id)!;
        back.push(`<circle class="solid metal edge" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r + 12.5)}" opacity="${f1(k)}"/>`);
        front.push(`<circle class="solid metal" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r + 11)}" opacity="${f1(k)}"/>`);
        if (k > 0.99) whole.push({ p, r });
      }
      // Between atoms that touch, the surface runs straight across: one body, not a bunch of balls.
      for (let i = 0; i < whole.length; i++) {
        for (let j = i + 1; j < whole.length; j++) {
          const A = whole[i];
          const B = whole[j];
          if (dist(A.p, B.p) > A.r + B.r + 8) continue;
          const w = Math.min(A.r, B.r) * 2;
          back.push(`<line class="solid metal edge" x1="${f1(A.p.x)}" y1="${f1(A.p.y)}" x2="${f1(B.p.x)}" y2="${f1(B.p.y)}" stroke-width="${f1(w + 25)}"/>`);
          front.push(`<line class="solid metal" x1="${f1(A.p.x)}" y1="${f1(A.p.y)}" x2="${f1(B.p.x)}" y2="${f1(B.p.y)}" stroke-width="${f1(w + 22)}"/>`);
        }
      }
      continue;
    }
    // Ionic solid: one square tile per ion, as wide as the ions are apart; together they make the slab.
    const world = inA.size ? after : before;
    const units: string[][] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      const w = after.atoms.has(id) ? after : before;
      const c = component(w, id).filter((x) => pos.has(x));
      c.forEach((x) => seen.add(x));
      units.push(c);
    }
    const home = (u: string[], w: World) => {
      const at = u.map((id) => w.atoms.get(id)).filter(Boolean) as Atom[];
      return at.length ? { x: at.reduce((s, a) => s + a.x, 0) / at.length, y: at.reduce((s, a) => s + a.y, 0) / at.length } : null;
    };
    const homes = units.map((u) => home(u, world)).filter(Boolean) as Vec[];
    let side = Infinity;
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) side = Math.min(side, dist(homes[i], homes[j]));
    if (!Number.isFinite(side)) side = 2 * Math.max(...units[0].map((id) => element(atomOf(id).el).r)) + 7;
    for (const u of units) {
      const c = { x: u.reduce((s, id) => s + pos.get(id)!.x, 0) / u.length, y: u.reduce((s, id) => s + pos.get(id)!.y, 0) / u.length };
      const k = Math.min(...u.map((id) => hold(id, inA.has(id) ? after : before, side * 0.4)));
      if (k <= 0.01) continue;
      const h = side / 2 + 5;
      back.push(`<rect class="solid salt edge" x="${f1(c.x - h - 1.5)}" y="${f1(c.y - h - 1.5)}" width="${f1(2 * h + 3)}" height="${f1(2 * h + 3)}" rx="4" opacity="${f1(k)}"/>`);
      front.push(`<rect class="solid salt" x="${f1(c.x - h)}" y="${f1(c.y - h)}" width="${f1(2 * h)}" height="${f1(2 * h)}" rx="3" opacity="${f1(k)}"/>`);
    }
  }
  return [...back, ...front];
}

/*
 * The electrons of a piece of metal. A metal's outer electrons are not kept by single atoms: they
 * are shared by the whole piece. So they are drawn as loose dots between and around the atoms,
 * inside the piece's surface, as many as the atoms brought in (the engine's count). The places are
 * decided from the world's own coordinates and move with the piece; they are not where electrons
 * "really" are. When the piece gives an electron to an ion, one of these very dots goes over.
 */
interface Sea {
  /** An atom of the piece and where it is in the world: the dots keep their place relative to it. */
  anchor: string;
  at: Vec;
  slots: Vec[];
  /** Atoms and their electron counts, to tell whether two worlds have the same sea. */
  sig: string;
}
const seaCache = new WeakMap<World, Map<string, Sea | null>>();
function seaOf(w: World, name: string): Sea | null {
  let m = seaCache.get(w);
  if (!m) seaCache.set(w, (m = new Map()));
  if (m.has(name)) return m.get(name)!;
  const atoms = (w.crystals.get(name) ?? []).map((id) => w.atoms.get(id)).filter((a): a is Atom => !!a && !!a.lattice);
  let sea: Sea | null = null;
  const n = atoms.reduce((s, a) => s + 2 * a.lp + a.rad, 0);
  if (atoms.length && n > 0) {
    const R = (a: Atom) => element(a.el).r;
    const touch = (a: Atom, b: Atom) => a !== b && dist(a, b) < R(a) + R(b) + 6;
    const cand: Vec[] = [];
    const push = (p: Vec, apart: number) => {
      if (!cand.some((q) => dist(p, q) < apart)) cand.push(p);
    };
    const ring = (dense: number) => {
      for (const a of atoms) {
        const nb = atoms.filter((b) => touch(a, b)).sort((p, q) => angOf(a, p) - angOf(a, q));
        if (!nb.length) {
          for (let k = 0; k < 6; k++) push(add(a, fromAngle((Math.PI * k) / 3 + 0.4, R(a) + 6.5)), 8);
          continue;
        }
        nb.forEach((b, i) => {
          const c = nb[(i + 1) % nb.length];
          const a0 = angOf(a, b);
          let width = angOf(a, c) - a0;
          if (width <= 1e-6) width += Math.PI * 2;
          if (nb.length > 1 && width < 1.75 && touch(b, c)) {
            // The gap between three atoms that touch one another.
            push({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, 4);
            return;
          }
          if (width < 1.75) return;
          // The open side of a surface atom: places along it, just outside the atom.
          const count = Math.max(1, Math.round(width / (0.96 / dense)) - 1);
          for (let k = 1; k <= count; k++) {
            const p = add(a, fromAngle(a0 + (width * k) / (count + 1), R(a) + 6.5));
            if (!atoms.some((o) => o !== a && dist(o, p) < R(o) + 4.5)) push(p, 8);
          }
        });
      }
    };
    ring(1);
    if (cand.length < n) ring(2);
    // Spread out: start nearest the middle, then always the place farthest from those taken.
    const mid = { x: atoms.reduce((s, a) => s + a.x, 0) / atoms.length, y: atoms.reduce((s, a) => s + a.y, 0) / atoms.length };
    const slots: Vec[] = [];
    const left = [...cand];
    while (slots.length < n && left.length) {
      let bi = 0;
      let best = -Infinity;
      left.forEach((p, i) => {
        const score = slots.length ? Math.min(...slots.map((q) => dist(p, q))) : -dist(p, mid);
        if (score > best + 1e-6) {
          best = score;
          bi = i;
        }
      });
      slots.push(left.splice(bi, 1)[0]);
    }
    sea = { anchor: atoms[0].id, at: { x: atoms[0].x, y: atoms[0].y }, slots, sig: atoms.map((a) => `${a.id}:${2 * a.lp + a.rad}`).join(' ') };
  }
  m.set(name, sea);
  return sea;
}

/** How the dots of a piece get from their places before a step to their places after it. */
interface SeaPlan {
  b: Sea | null;
  a: Sea | null;
  /** Dots that stay in the piece (from → to), ones that are gone after (to null), new ones (from null). */
  stay: { from: Vec | null; to: Vec | null }[];
  /** Dots that go over to an atom with one of the step's electron moves: where from, and where the electron ends up if that atom becomes part of the piece. */
  fly: Map<ArrowAnim, { from: Vec; to: Vec | null }>;
}
const planCache = new WeakMap<StepAnim, Map<string, SeaPlan | null>>();
function seaPlan(step: StepAnim, name: string): SeaPlan | null {
  let m = planCache.get(step);
  if (!m) planCache.set(step, (m = new Map()));
  if (m.has(name)) return m.get(name)!;
  const b = seaOf(step.before, name);
  const a = seaOf(step.after, name);
  let plan: SeaPlan | null = null;
  if ((b || a) && b?.sig !== a?.sig) {
    const from = [...(b?.slots ?? [])];
    const to = [...(a?.slots ?? [])];
    const take = (list: Vec[], near: Vec): Vec | null => {
      if (!list.length) return null;
      let bi = 0;
      list.forEach((p, i) => {
        if (dist(p, near) < dist(list[bi], near)) bi = i;
      });
      return list.splice(bi, 1)[0];
    };
    const fly = new Map<ArrowAnim, { from: Vec; to: Vec | null }>();
    const inB = new Set(step.before.crystals.get(name) ?? []);
    const inA = new Set(step.after.crystals.get(name) ?? []);
    for (const ar of step.arrows) {
      if (!ar.src || !ar.dst || ar.dst.kind !== 'atom' || ar.src.kind === 'bond') continue;
      const s = step.before.atoms.get(ar.src.a);
      const d0 = step.before.atoms.get(ar.dst.a);
      const d1 = step.after.atoms.get(ar.dst.a);
      if (!s?.lattice || !inB.has(s.id) || !d0) continue;
      const f = take(from, d0);
      if (!f) continue;
      // It goes into the near side of the atom it is given to. Once that atom is part of the
      // piece, the electron is one of the piece's own again (a dot that comes up among the others).
      const end = d1?.lattice && inA.has(d1.id) ? add(d1, scale(norm(sub(f, d1)), element(d1.el).r - 3)) : null;
      fly.set(ar, { from: f, to: end });
    }
    // The rest: nearest pairs first.
    const all: { i: number; j: number; d: number }[] = [];
    from.forEach((p, i) => to.forEach((q, j) => all.push({ i, j, d: dist(p, q) })));
    all.sort((p, q) => p.d - q.d);
    const usedF = new Set<number>();
    const usedT = new Set<number>();
    const stay: SeaPlan['stay'] = [];
    for (const { i, j } of all) {
      if (usedF.has(i) || usedT.has(j)) continue;
      usedF.add(i);
      usedT.add(j);
      stay.push({ from: from[i], to: to[j] });
    }
    from.forEach((p, i) => !usedF.has(i) && stay.push({ from: p, to: null }));
    to.forEach((q, j) => !usedT.has(j) && stay.push({ from: null, to: q }));
    plan = { b, a, stay, fly };
  }
  m.set(name, plan);
  return plan;
}

export function drawPairs(inp: PairsInput): PairsOutput {
  const { step, win, topo, after, pos, isCrowd, opacity } = inp;
  const under: string[] = [];
  const over: string[] = [];
  const byId = new Map(inp.atoms.map((a) => [a.id, a]));
  /** Solvent: drawn plainly (lines, no electrons), whether it is background or a shell around an ion. */
  const crowd = (id: string) => !!byId.get(id)?.crowd;
  const aside = (id: string) => !!inp.aside?.has(id);
  const faint = (id: string) => {
    const a = byId.get(id);
    return !!a && isCrowd(a);
  };
  const R = (id: string) => element((byId.get(id) ?? after.atoms.get(id))!.el).r;

  // ---------------------------------------------------------------- primitives

  // `of`: the atom a lone pouch and its electrons belong to (written into the drawing so that
  // tools can follow them from frame to frame).
  const pouch = (p: Vec, q: Vec, w: number, cls: string, op: number, of = '') => {
    if (op > 0.01)
      under.push(`<line class="pouch${cls}"${of ? ` data-a="${of}"` : ''} x1="${f1(p.x)}" y1="${f1(p.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}" stroke-width="${f1(w)}" opacity="${f1(op)}"/>`);
  };
  const electron = (p: Vec, cls: string, op: number, r = DOT, of = '') => {
    if (op > 0.01) over.push(`<circle class="pe${cls}"${of ? ` data-a="${of}"` : ''} cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}" opacity="${f1(op)}"/>`);
  };
  /** The electrons of a pouch whose electrons are centred on c, the pouch lying along unit vector u. */
  const electrons = (c: Vec, u: Vec, n: number, across: boolean, cls: string, op: number, of = '') => {
    if (n >= 2) {
      const s = scale(across ? perp(u) : u, SIDE);
      electron(add(c, s), cls, op, DOT, of);
      electron(sub(c, s), cls, op, DOT, of);
    } else if (n === 1) electron(c, cls, op, DOT, of);
  };

  /** A lone pouch on atom `id` pointing at `ang`. */
  const lone = (id: string, ang: number, n: number, cls: string, op: number, dots = true) => {
    const p = pos.get(id);
    if (!p || n <= 0) return;
    const u = fromAngle(ang);
    const r = R(id);
    const c = add(p, scale(u, r + OUT));
    pouch(add(p, scale(u, r - 2)), c, n >= 2 ? W2 : W1, cls, op, id);
    if (dots) electrons(c, u, n, true, cls, op, id);
  };

  /** Where the electrons of strand `o` of the bond a–b sit. */
  const sharePoint = (a: string, b: string, o: number): Vec | null => {
    const pa = pos.get(a);
    const pb = pos.get(b);
    const A = byId.get(a) ?? after.atoms.get(a);
    const B = byId.get(b) ?? after.atoms.get(b);
    if (!pa || !pb || !A || !B) return null;
    const u = norm(sub(pb, pa));
    const d = dist(pa, pb);
    const ra = element(A.el).r;
    const rb = element(B.el).r;
    const s = d - ra - rb > 6 ? lerp(ra + 3, d - rb - 3, shareAt(A, B)) : lerp(ra, d - rb, 0.5);
    return add(add(pa, scale(u, s)), scale(perp(u), o));
  };

  /** One strand (one pair) of the bond a–b, `n` strands wide in all. */
  const strand = (a: string, b: string, o: number, n: number, cls: string, op: number, dots = true) => {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb) return;
    const u = norm(sub(pb, pa));
    const nn = scale(perp(u), o);
    pouch(add(add(pa, scale(u, R(a) - 3)), nn), add(sub(pb, scale(u, R(b) - 3)), nn), strandWidth(n), cls, op);
    const c = sharePoint(a, b, o);
    if (dots && c) electrons(c, u, 2, n <= 1, cls, op);
  };

  const plainBond = (a: string, b: string, order: number, op0: number) => {
    const op = op0 * (faint(a) ? 0.55 : 1) / 0.55;
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb) return;
    const n = perp(norm(sub(pb, pa)));
    for (const o of order >= 2 ? [-3.6, 3.6] : [0]) {
      under.push(
        `<line class="bond crowd" x1="${f1(pa.x + n.x * o)}" y1="${f1(pa.y + n.y * o)}" x2="${f1(pb.x + n.x * o)}" y2="${f1(pb.y + n.y * o)}" opacity="${f1(op * 0.55)}"/>`,
      );
    }
  };

  const opOf = (a: string, b: string) => Math.min(opacity(a), opacity(b));

  /** Everything of one world, drawn as it is. `hot` marks pouches to tint (key → strength). */
  /**
   * An atom without bonds that the step turns to face something (its `face` differs before and
   * after): its electrons turn there smoothly through the step instead of snapping round.
   * Returns the turn to apply to the after-world's directions, or null if this is not such an atom.
   */
  const facing = (id: string): number | null => {
    if (!step) return null;
    const b = step.before.atoms.get(id);
    const z = step.after.atoms.get(id);
    if (!b || !z) return null;
    const fb = b.face ?? -Math.PI / 4;
    const fz = z.face ?? -Math.PI / 4;
    if (fb === fz || b.lp !== z.lp || b.rad !== z.rad || (adjacency(step.after).get(id) ?? []).length || (adjacency(step.before).get(id) ?? []).length) return null;
    return -angDelta(fb, fz) * (1 - smooth(clamp(inp.t, 0, 1)));
  };
  const still = (w: World, fade: (id: string) => number, hotLone?: Map<string, Dom[]>, hotBond?: Map<string, number>, hotOp = 0, soft?: Set<string>) => {
    for (const b of w.bonds.values()) {
      if (b.order <= 0 || !byId.has(b.a) || !byId.has(b.b)) continue;
      let op = opOf(b.a, b.b) * Math.min(fade(b.a), fade(b.b));
      // A bond made without its electrons being shown (a net reaction) appears as its atoms come together.
      if (soft?.has(keyOf(b.a, b.b))) {
        const pa = pos.get(b.a);
        const pb = pos.get(b.b);
        if (pa && pb) op *= clamp((80 - (dist(pa, pb) - R(b.a) - R(b.b))) / 50, 0, 1);
      }
      if (crowd(b.a) || crowd(b.b)) {
        plainBond(b.a, b.b, b.order, op);
        continue;
      }
      const n = Math.round(b.order);
      const offs = strandOffsets(n);
      const hot = hotBond?.get(keyOf(b.a, b.b)) ?? 0;
      offs.forEach((o, i) => {
        // The strands that are about to leave (or have just arrived) are the last ones.
        const isHot = i >= n - hot && hotOp > 0.01;
        strand(b.a, b.b, o, n, '', op, !inp.simple && !aside(b.a));
        if (isHot) strand(b.a, b.b, o, n, ' hot', op * hotOp);
      });
    }
    for (const a of inp.atoms) {
      if (inp.simple || crowd(a.id) || a.lattice || packed.has(a.id) || aside(a.id)) continue;
      const wa = w.atoms.get(a.id);
      if (!wa) continue;
      const op = opacity(a.id) * fade(a.id);
      const spin = hotLone ? null : facing(a.id);
      const turn = spin ?? turnOf(w, a.id, pos);
      for (const d of domainsOf(spin !== null ? step!.after : w, a.id)) lone(a.id, d.angle + turn, d.n, '', op);
      for (const h of hotLone?.get(a.id) ?? []) lone(a.id, h.angle + turn, h.n, ' hot', op * hotOp);
    }
  };

  /**
   * Why two molecules come together: where one is a little negative (electrons it holds close)
   * and the other a little positive (its electrons are held by a greedier neighbour), they attract.
   * Marked with a small − and + and a dotted line between the two places.
   */
  const pulls = () => {
    if (!step?.pulls?.length) return;
    const adj = adjacency(topo);
    const en = (id: string) => ELECTRONEGATIVITY[topo.atoms.get(id)?.el ?? ''] ?? 2.2;
    const show = clamp(inp.t / 0.15, 0, 1);
    const Z = step.after;
    for (const { a, b } of step.pulls) {
      const A0 = topo.atoms.get(a);
      const B0 = topo.atoms.get(b);
      const pa = pos.get(a);
      const pb = pos.get(b);
      const za = Z.atoms.get(a);
      const zb = Z.atoms.get(b);
      if (!A0 || !B0 || !pa || !pb || !za || !zb) continue;
      /** +1: short of electrons here; -1: electrons held here; 0: neither. `mark`: no charge badge says so already. */
      const lean = (x: Atom): { sign: number; mark: boolean } => {
        const q = formalCharge(topo, x);
        if (q > 0) return { sign: 1, mark: false };
        if (q < 0) return { sign: -1, mark: false };
        if ((adj.get(x.id) ?? []).some((o) => en(o) - en(x.id) >= 0.4)) return { sign: 1, mark: true };
        if (x.lp > 0 || x.rad > 0) return { sign: -1, mark: x.lp > 0 && en(x.id) >= 2.5 };
        return { sign: 0, mark: false };
      };
      const la = lean(A0);
      const lb = lean(B0);
      if (la.sign * lb.sign !== -1) continue;
      const u = norm(sub(pb, pa));
      // Which of a's pouches faces b is decided where the step ends (there they face each other squarely).
      const endDir = angOf(za, zb);
      const doms = domainsOf(Z, a);
      const facing = doms.length ? doms.reduce((m, d) => (angDist(d.angle, endDir) < angDist(m.angle, endDir) ? d : m), doms[0]) : null;
      const useTip = !!facing && angDist(facing.angle, endDir) < 0.9;
      const from = useTip ? add(pa, fromAngle(facing!.angle + turnOf(Z, a, pos), R(a) + OUT + 7)) : add(pa, scale(u, R(a) + 2));
      const to = sub(pb, scale(u, R(b) + 2));
      const op = show * Math.min(opacity(a), opacity(b));
      if (dist(from, to) > 6 && op > 0.01) over.push(`<line class="pull" x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" opacity="${f1(op)}"/>`);
      // The marks sit beside the two places, on the side of the line that is up where the step ends.
      const endUp = perp(norm(sub(zb, za))).y < 0 ? 1 : -1;
      const up = scale(perp(u), endUp);
      const mark = (c: Vec, l: { sign: number; mark: boolean }) => {
        if (!l.mark || op <= 0.01) return;
        over.push(`<text class="pq ${l.sign > 0 ? 'pos' : 'neg'}" x="${f1(c.x)}" y="${f1(c.y)}" dy="0.35em" opacity="${f1(op)}">${l.sign > 0 ? '+' : '−'}</text>`);
      };
      mark(useTip ? add(sub(from, scale(u, 7)), scale(up, 13)) : add(pa, scale(up, R(a) + 9)), la);
      mark(add(pb, scale(up, R(b) + 9)), lb);
    }
  };
  /**
   * Electrons between an atom and an electrode. Each is one dot from start to end: beside the
   * atom, on its way, or among the electrons the plate keeps. They go one after another, and the
   * atom's charge steps with each.
   */
  const plateElectrons = (o: PairsOutput) => {
    const list = (step?.arrows ?? []).filter((ar) => ar.free && !(ar.src && ar.dst));
    if (!step || !list.length || !inp.electrodes) return;
    const n = list.length;
    const charges = o.charges ?? new Map<string, number>();
    const keep = o.avoid ?? new Map<string, number[]>();
    const plate = new Map<string, number>();
    list.forEach((ar, i) => {
      const f = ar.free!;
      const el = inp.electrodes![f.plate];
      const a0 = step.before.atoms.get(f.atom);
      if (!el || !a0) return;
      const slot = plateSlot(el, f.slot);
      const p0 = f.dir === 'toPlate' ? ar.p0 : slot;
      const p1 = f.dir === 'toPlate' ? slot : ar.p1;
      const u = win.pre ? 0 : win.post ? 1 : smooth(clamp(((win.frac - i / n) * n) / 0.8, 0, 1));
      const gone = u > 0.02;
      const there = u >= 0.999;
      if (!charges.has(f.atom)) charges.set(f.atom, formalCharge(step.before, a0));
      if (!keep.has(f.atom)) keep.set(f.atom, [...domainsOf(step.before, f.atom), ...domainsOf(step.after, f.atom)].map((d) => d.angle));
      if (f.dir === 'toPlate') {
        if (gone) charges.set(f.atom, charges.get(f.atom)! + 1);
        if (there) plate.set(f.plate, (plate.get(f.plate) ?? 0) + 1);
      } else {
        if (gone) plate.set(f.plate, (plate.get(f.plate) ?? 0) - 1);
        if (there) charges.set(f.atom, charges.get(f.atom)! - 1);
      }
      const bend = add(lerpV(p0, p1, 0.5), scale(perp(norm(sub(p1, p0))), Math.min(22, dist(p0, p1) * 0.18) * (i % 2 ? -1 : 1)));
      const at = (v: number): Vec => lerpV(lerpV(p0, bend, v), lerpV(bend, p1, v), v);
      const fade = win.post ? 1 - win.settle : 1;
      if (u > 0.01 && fade > 0.01) {
        let pts = '';
        const nSeg = Math.max(2, Math.round(14 * u));
        for (let j = 0; j <= nSeg; j++) {
          const q = at((u * j) / nSeg);
          pts += `${f1(q.x)},${f1(q.y)} `;
        }
        over.push(`<polyline class="etrail" points="${pts.trim()}" opacity="${f1(0.7 * fade)}"/>`);
      }
      if (gone && !there) electron(at(u), ' hot fly', 1, FLY * inp.eScale);
      // Beside the atom: before it leaves (it shows up as the change nears), or once it has arrived.
      else if (f.dir === 'toPlate' && !gone) electron(p0, ' hot', win.pre ? win.cue : 1, 2.9);
      else if (f.dir === 'fromPlate' && there) electron(p1, ' hot', fade, 2.9);
    });
    o.charges = charges;
    o.avoid = keep;
    o.plate = plate;
  };
  // The loose electrons of pieces of metal (not of electrode plates, which the stage draws).
  const seaNames = [...new Set([...(step ? step.before.crystals.keys() : []), ...(step ? step.after : topo).crystals.keys()])].filter((n) => !inp.electrodes?.[n]);
  const shiftOf = (s: Sea | null): Vec | null => {
    const p = s && pos.get(s.anchor);
    return p && s ? sub(p, s.at) : null;
  };
  /** Where the dot that goes over with this electron move starts and ends, as drawn now. */
  const flyer = (ar: ArrowAnim): { from: Vec; to: Vec | null } | null => {
    if (!step) return null;
    for (const name of seaNames) {
      const plan = seaPlan(step, name);
      const f = plan?.fly.get(ar);
      if (!f || !plan) continue;
      const sb = shiftOf(plan.b);
      const sa = shiftOf(plan.a) ?? sb;
      if (!sb) return null;
      return { from: add(f.from, sb), to: f.to && sa ? add(f.to, sa) : null };
    }
    return null;
  };
  const sea = () => {
    if (inp.simple) return;
    for (const name of seaNames) {
      const plan = step ? seaPlan(step, name) : null;
      if (!plan) {
        const s = seaOf(step ? step.after : topo, name);
        const sh = shiftOf(s);
        if (!s || !sh) continue;
        const op = opacity(s.anchor);
        for (const p of s.slots) electron(add(p, sh), '', op);
        continue;
      }
      const sb = shiftOf(plan.b);
      const sa = shiftOf(plan.a) ?? sb;
      const op = opacity((plan.a ?? plan.b)!.anchor);
      const u = win.pre ? 0 : win.post ? 1 : win.prog;
      for (const d of plan.stay) {
        const p0 = d.from && sb ? add(d.from, sb) : null;
        const p1 = d.to && sa ? add(d.to, sa) : null;
        if (p0 && p1) electron(lerpV(p0, p1, u), '', op);
        else if (p0) electron(p0, '', op * (1 - u));
        else if (p1) electron(p1, '', op * u);
      }
      // The dots that go over: marked where they wait, and plain again where they end up. On the way they are drawn with the move itself.
      for (const f of plan.fly.values()) {
        if (win.pre && sb) electron(add(f.from, sb), ' hot', op);
        else if (win.post && f.to && sa) electron(add(f.to, sa), ' hot', op * (1 - win.settle));
      }
    }
  };

  const finish = (o: PairsOutput): PairsOutput => {
    sea();
    pulls();
    plateElectrons(o);
    return o;
  };

  // Ions packed in a crystal: their own electrons are not what the scene is about, and drawing
  // eight dots on every one of them buries the crystal. They get their electrons once they are out of it.
  const packed = new Set<string>();
  for (const ids of topo.crystals.values()) for (const id of ids) packed.add(id);

  const one = () => 1;
  const netNew = new Set<string>();
  if (step && !step.events.length) for (const [k, b] of step.after.bonds) if (b.order > 0 && !(step.before.bonds.get(k)?.order ?? 0)) netNew.add(k);
  // Electron moves of this step: the ones the script wrote, and for a net reaction the pairs that change holders.
  const bound: ArrowAnim[] = step ? step.arrows.filter((ar) => ar.src && ar.dst) : [];
  /** Part of the change window in which a move happens (the whole of it unless said otherwise). */
  const span = new Map<ArrowAnim, [number, number]>();
  const nShift = step?.shifts?.length ?? 0;
  for (const [i, sh] of (step?.shifts ?? []).entries()) {
    // The source's lone pair is chosen by the direction of p0: toward the atom it will join.
    const other = sh.dst.kind === 'bond' ? (sh.dst.a === sh.src.a ? sh.dst.b! : sh.dst.a) : sh.dst.a;
    const o = step!.before.atoms.get(other);
    const p0 = o ? { x: o.x, y: o.y } : { x: 0, y: 0 };
    const ar: ArrowAnim = { kind: 'pair', p0, c: p0, p1: p0, line: 0, src: sh.src, dst: sh.dst };
    // A net reaction is told two pairs at a time: first one bond is exchanged, then the other.
    if (nShift === 4) span.set(ar, i < 2 ? [0, 0.52] : [0.48, 1]);
    bound.push(ar);
  }
  if (!step || !bound.length || step.events.length) {
    // Nothing is carried by electrons here. A change without them (a net reaction) fades from the old pouches to the new.
    if (step && win.during && !step.events.length) {
      const changed = new Set<string>();
      for (const [k, b] of step.before.bonds) if ((step.after.bonds.get(k)?.order ?? 0) !== b.order) changed.add(b.a).add(b.b);
      for (const [k, b] of step.after.bonds) if ((step.before.bonds.get(k)?.order ?? 0) !== b.order) changed.add(b.a).add(b.b);
      for (const [id, a] of step.after.atoms) {
        const b = step.before.atoms.get(id);
        if (b && (b.lp !== a.lp || b.rad !== a.rad)) changed.add(id);
      }
      if (changed.size) {
        still(step.before, (id) => (changed.has(id) ? 1 - win.prog : step.appear.has(id) ? 0 : 1));
        still(step.after, (id) => (changed.has(id) ? win.prog : step.appear.has(id) ? 1 : 0), undefined, undefined, 0, netNew);
        return finish({ under, over });
      }
    }
    still(topo, one, undefined, undefined, 0, step && win.post ? netNew : undefined);
    return finish({ under, over });
  }

  // ---------------------------------------------------------------- a step in which electrons move

  const B = step.before;
  const A = step.after;
  const turnB = (id: string) => turnOf(B, id, pos);
  const turnA = (id: string) => turnOf(A, id, pos);

  // Lone pouches of every atom the arrows touch, before and after, with the electrons the arrows take or bring counted off.
  const touched = new Set<string>();
  for (const ar of bound) {
    for (const e of [ar.src!, ar.dst!]) {
      touched.add(e.a);
      if (e.b) touched.add(e.b);
    }
  }
  const d0 = new Map<string, (Dom & { left: number })[]>();
  const d1 = new Map<string, (Dom & { left: number })[]>();
  for (const id of touched) {
    d0.set(id, domainsOf(B, id).map((d) => ({ ...d, left: d.n })));
    d1.set(id, domainsOf(A, id).map((d) => ({ ...d, left: d.n })));
  }
  const takeFrom = (list: (Dom & { left: number })[] | undefined, want: number, need: number, preferN?: number): (Dom & { left: number }) | null => {
    let cands = (list ?? []).filter((d) => d.left >= need && (preferN === undefined || d.n === preferN));
    if (!cands.length) cands = (list ?? []).filter((d) => d.left >= need);
    if (!cands.length) return null;
    const best = cands.reduce((b, d) => (angDist(d.angle, want) < angDist(b.angle, want) ? d : b), cands[0]);
    best.left -= need;
    return best;
  };

  interface Move {
    ar: ArrowAnim;
    pair: boolean;
    /** Lone pouch the electrons leave (atom-side source). */
    from: (Dom & { left: number }) | null;
    /** Lone pouch they end in (atom-side destination). */
    to: (Dom & { left: number }) | null;
    /** For a single electron: which of the two places of a pair it leaves and takes (+1 / -1). */
    side0: number;
    side1: number;
  }
  const moves: Move[] = [];
  const fromCount = new Map<string, number>();
  const toCount = new Map<string, number>();
  const nextSide = (m: Map<string, number>, k: string) => {
    const n = m.get(k) ?? 0;
    m.set(k, n + 1);
    return n % 2 ? -1 : 1;
  };
  for (const ar of bound) {
    const S = ar.src!;
    const D = ar.dst!;
    const pair = ar.kind === 'pair';
    const need = pair ? 2 : 1;
    let from: Move['from'] = null;
    let to: Move['to'] = null;
    if (S.kind !== 'bond') {
      const a = B.atoms.get(S.a);
      const want = a ? Math.atan2(ar.p0.y - a.y, ar.p0.x - a.x) : 0;
      const single = !pair && (S.kind === 'e' || (S.kind === 'atom' && (a?.rad ?? 0) > 0));
      from = takeFrom(d0.get(S.a), want, need, pair ? 2 : single ? 1 : undefined);
    }
    if (D.kind === 'atom') {
      // The pouch nearest to where the electrons come from (as the worlds' own coordinates have it).
      const other = S.kind === 'bond' ? (S.a === D.a ? S.b! : S.a) : S.a;
      const p = B.atoms.get(D.a) ?? A.atoms.get(D.a);
      const q = B.atoms.get(other) ?? A.atoms.get(other);
      const want = p && q ? angOf(p, q) : 0;
      // One electron either starts a pouch of its own or completes one that had a single electron.
      to = takeFrom(d1.get(D.a), want, need, pair ? 2 : 1);
    }
    const sk = S.kind === 'bond' ? `b:${keyOf(S.a, S.b!)}` : `a:${S.a}:${from?.angle.toFixed(2)}`;
    const dk = D.kind === 'bond' ? `b:${keyOf(D.a, D.b!)}` : `a:${D.a}:${to?.angle.toFixed(2)}`;
    moves.push({ ar, pair, from, to, side0: nextSide(fromCount, sk), side1: nextSide(toCount, dk) });
  }

  const e = win.during ? win.prog : win.post ? 1 : 0;
  // (Within a move's part of the window, a pouch that takes hold of a new atom goes first and one
  // that lets go of an atom follows, so that in between the atom is held from both sides.)

  /**
   * An electron that goes from one atom to another atom flies there. Everything else stays with
   * an atom throughout and is drawn as a pouch (two electrons) or half a pouch (one) that changes
   * its other end.
   */
  const isJump = (m: Move) => !m.pair && m.ar.src!.kind !== 'bond' && m.ar.dst!.kind === 'atom' && m.ar.dst!.a !== m.ar.src!.a;

  /** Sideways direction of the bond a–b, the same whichever atom it is seen from. */
  const across = (a: string, b: string): Vec => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return perp(norm(sub(pos.get(y)!, pos.get(x)!)));
  };
  const freeTip = (id: string, ang: number) => add(pos.get(id)!, fromAngle(ang, R(id) + OUT));
  /** The end of strand `o` of the bond a–b at atom b. */
  const inner = (a: string, b: string, o: number) => {
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    return add(sub(pb, scale(norm(sub(pb, pa)), R(b) - 3)), scale(across(a, b), o));
  };

  /** Where a single electron sits at its source or destination. */
  const site = (m: Move, end: 'src' | 'dst'): Vec | null => {
    const E = end === 'src' ? m.ar.src! : m.ar.dst!;
    const dom = end === 'src' ? m.from : m.to;
    const side = end === 'src' ? m.side0 : m.side1;
    const p = pos.get(E.a);
    if (!p || E.kind === 'bond') return null;
    const fl = flyer(m.ar);
    if (fl && end === 'src') return fl.from;
    if (fl?.to && end === 'dst') return fl.to;
    if (!dom) return add(p, fromAngle(Math.atan2(m.ar.p0.y - (B.atoms.get(E.a)?.y ?? 0), m.ar.p0.x - (B.atoms.get(E.a)?.x ?? 0)), R(E.a) + OUT));
    const ang = dom.angle + (end === 'src' ? turnB(E.a) : turnA(E.a));
    const c = add(p, fromAngle(ang, R(E.a) + OUT));
    return dom.n >= 2 ? add(c, fromAngle(ang + Math.PI / 2, SIDE * side)) : c;
  };

  // Electrons that fly leave one after another, so that the charges can be seen to change one electron at a time.
  const jumps = moves.filter(isJump);
  const perSource = new Map<string, Move[]>();
  for (const m of jumps) (perSource.get(m.ar.src!.a) ?? perSource.set(m.ar.src!.a, []).get(m.ar.src!.a)!).push(m);
  const flight = new Map<Move, number>();
  for (const list of perSource.values()) {
    list.forEach((m, i) => {
      const t0 = i / list.length;
      // Each flight ends a little before the next begins: a beat in which the charges can be read.
      flight.set(m, win.during ? smooth(clamp(((win.frac - t0) * list.length) / 0.8, 0, 1)) : e);
    });
  }
  const left = (m: Move) => (flight.get(m) ?? 0) > 0.02;
  const arrived = (m: Move) => (flight.get(m) ?? 0) >= 0.999;
  const arc = (m: Move): ((u: number) => Vec) | null => {
    const p0 = site(m, 'src');
    const p1 = site(m, 'dst');
    if (!p0 || !p1) return null;
    const bend = add(lerpV(p0, p1, 0.5), scale(perp(norm(sub(p1, p0))), Math.min(26, dist(p0, p1) * 0.22) * m.side0));
    return (u) => lerpV(lerpV(p0, bend, u), lerpV(bend, p1, u), u);
  };
  const trail = (m: Move, upTo: number, op: number) => {
    const at = arc(m);
    if (!at || upTo <= 0.01 || op <= 0.01) return;
    let pts = '';
    const nSeg = Math.max(2, Math.round(14 * upTo));
    for (let i = 0; i <= nSeg; i++) {
      const q = at((upTo * i) / nSeg);
      pts += `${f1(q.x)},${f1(q.y)} `;
    }
    over.push(`<polyline class="etrail" points="${pts.trim()}" opacity="${f1(op)}"/>`);
  };

  // Directions the flying electrons' pouches take up around their atoms: the charge badge keeps
  // clear of them through the whole step, so that it does not move when the electrons start or stop.
  const avoid = new Map<string, number[]>();
  for (const m of jumps) {
    if (m.from) (avoid.get(m.ar.src!.a) ?? avoid.set(m.ar.src!.a, []).get(m.ar.src!.a)!).push(m.from.angle + turnB(m.ar.src!.a));
    if (m.to) (avoid.get(m.ar.dst!.a) ?? avoid.set(m.ar.dst!.a, []).get(m.ar.dst!.a)!).push(m.to.angle + turnA(m.ar.dst!.a));
  }

  // ---- before the change: everything as it was, the pouches about to change tinted
  if (win.pre) {
    const hotLone = new Map<string, Dom[]>();
    const hotBond = new Map<string, number>();
    for (const m of moves) {
      const S = m.ar.src!;
      if (S.kind === 'bond') hotBond.set(keyOf(S.a, S.b!), 1);
      else if (m.from) (hotLone.get(S.a) ?? hotLone.set(S.a, []).get(S.a)!).push({ angle: m.from.angle, n: m.pair ? 2 : m.from.n });
    }
    still(B, one, hotLone, hotBond, win.cue);
    return finish({ under, over, avoid });
  }

  // ---- after the change: everything as it is now, the pouches that changed still tinted while the atoms settle
  if (win.post) {
    const hotLone = new Map<string, Dom[]>();
    const hotBond = new Map<string, number>();
    for (const m of moves) {
      const D = m.ar.dst!;
      if (D.kind === 'bond') hotBond.set(keyOf(D.a, D.b!), 1);
      else if (m.to) (hotLone.get(D.a) ?? hotLone.set(D.a, []).get(D.a)!).push({ angle: m.to.angle, n: m.pair ? 2 : m.to.n });
    }
    still(A, one, hotLone, hotBond, 1 - win.settle);
    for (const m of jumps) trail(m, 1, 0.7 * (1 - win.settle));
    return finish({ under, over, avoid });
  }

  // ---- during the change

  // Bonds, counted in electrons: those that stay, those that pouches and half pouches carry away or bring.
  const eOut = new Map<string, number>();
  const eIn = new Map<string, number>();
  for (const m of moves) {
    const n = m.pair ? 2 : 1;
    if (m.ar.src!.kind === 'bond') eOut.set(keyOf(m.ar.src!.a, m.ar.src!.b!), (eOut.get(keyOf(m.ar.src!.a, m.ar.src!.b!)) ?? 0) + n);
    if (m.ar.dst!.kind === 'bond') eIn.set(keyOf(m.ar.dst!.a, m.ar.dst!.b!), (eIn.get(keyOf(m.ar.dst!.a, m.ar.dst!.b!)) ?? 0) + n);
  }
  /** Index of the next electron a move takes out of a bond, and of the next one it puts in (counted from the last). */
  const outNext = new Map<string, number>();
  const inNext = new Map<string, number>();
  const keys = new Set([...B.bonds.keys(), ...A.bonds.keys()]);
  for (const k of keys) {
    const bb = B.bonds.get(k);
    const ba = A.bonds.get(k);
    const b = (ba ?? bb)!;
    if (!byId.has(b.a) || !byId.has(b.b)) continue;
    const op = opOf(b.a, b.b);
    const ob = Math.round(bb?.order ?? 0);
    const oa = Math.round(ba?.order ?? 0);
    outNext.set(k, 2 * ob - 1);
    inNext.set(k, 2 * oa - 1);
    if (crowd(b.a) || crowd(b.b)) {
      if (oa > 0) plainBond(b.a, b.b, oa, op);
      continue;
    }
    if (step.appear.has(b.a) || step.appear.has(b.b)) {
      strandOffsets(oa).forEach((o) => strand(b.a, b.b, o, oa, '', op, !aside(b.a)));
      continue;
    }
    const base = 2 * ob - (eOut.get(k) ?? 0);
    const target = 2 * oa - (eIn.get(k) ?? 0);
    const stay = Math.max(0, Math.min(base, target));
    const stable = Math.floor(stay / 2);
    const offB = strandOffsets(ob);
    const offA = strandOffsets(oa);
    const wide = lerp(strandWidth(ob || oa), strandWidth(oa || ob), e);
    const pa = pos.get(b.a)!;
    const pb = pos.get(b.b)!;
    const u = norm(sub(pb, pa));
    for (let i = 0; i < stable; i++) {
      const nn = scale(perp(u), lerp(offB[i] ?? 0, offA[i] ?? 0, e));
      pouch(add(add(pa, scale(u, R(b.a) - 3)), nn), add(sub(pb, scale(u, R(b.b) - 3)), nn), wide, '', op);
      const c = sharePoint(b.a, b.b, lerp(offB[i] ?? 0, offA[i] ?? 0, e));
      if (c && !aside(b.a)) electrons(c, u, 2, Math.max(ob, oa) <= 1, '', op);
    }
    if (stay % 2 === 1) {
      // One electron of a strand stays while its partner leaves or a new one arrives: half a pouch, on the side the others do not use.
      const nn = scale(across(b.a, b.b), (offB[stable] ?? 0) - SIDE);
      pouch(add(add(pa, scale(u, R(b.a) - 3)), nn), add(sub(pb, scale(u, R(b.b) - 3)), nn), WH, '', op);
      const c = sharePoint(b.a, b.b, 0);
      if (c) electron(add(c, nn), '', op);
    }
    // A change that no move accounts for (part of a net reaction): the strand fades.
    for (let i = Math.ceil(stay / 2); i < Math.ceil(base / 2); i++) strand(b.a, b.b, offB[i] ?? 0, ob, ' hot', op * (1 - e));
    for (let i = Math.ceil(stay / 2); i < Math.ceil(target / 2); i++) strand(b.a, b.b, offA[i] ?? 0, oa, ' hot', op * e);
  }

  // Lone pouches. Untouched atoms: as they are. Touched atoms: the pouches that stay turn from
  // their old directions to their new ones while the others leave and arrive.
  for (const a of inp.atoms) {
    if (crowd(a.id) || a.lattice || aside(a.id)) continue;
    const op = opacity(a.id);
    if (!touched.has(a.id) && packed.has(a.id)) continue;
    if (!B.atoms.has(a.id) || !A.atoms.has(a.id)) {
      // Only in one of the two worlds (it appears or is used up in this step): drawn as it is there.
      const w = A.atoms.has(a.id) ? A : B;
      const turn = turnOf(w, a.id, pos);
      for (const d of domainsOf(w, a.id)) lone(a.id, d.angle + turn, d.n, '', op);
      continue;
    }
    // Atoms the moves do not touch are treated the same way: their molecule may be re-drawn in a
    // new shape by the step, and their pouches then turn from the old directions to the new.
    const all0 = d0.get(a.id) ?? domainsOf(B, a.id).map((d) => ({ ...d, left: d.n }));
    const all1 = d1.get(a.id) ?? domainsOf(A, a.id).map((d) => ({ ...d, left: d.n }));
    const s0 = all0.filter((d) => d.left > 0);
    const s1 = all1.filter((d) => d.left > 0);
    let matched = false;
    if (s0.length === s1.length) {
      matched = true;
      const n = s0.length;
      if (n) {
        const x = [...s0].sort((p, q) => p.angle - q.angle);
        const y = [...s1].sort((p, q) => p.angle - q.angle);
        let bestShift = 0;
        let bestCost = Infinity;
        for (let sh = 0; sh < n; sh++) {
          let cost = 0;
          for (let i = 0; i < n; i++) cost += angDist(x[i].angle, y[(i + sh) % n].angle) + (x[i].left === y[(i + sh) % n].left ? 0 : 10);
          if (cost < bestCost) {
            bestCost = cost;
            bestShift = sh;
          }
        }
        for (let i = 0; i < n; i++) {
          const q = y[(i + bestShift) % n];
          lone(a.id, angLerp(x[i].angle + turnB(a.id), q.angle + turnA(a.id), e), Math.min(x[i].left, q.left), '', op);
        }
      }
    }
    if (!matched) {
      for (const d of s0) lone(a.id, d.angle + turnB(a.id), d.left, '', op * (1 - e));
      for (const d of s1) lone(a.id, d.angle + turnA(a.id), d.left, '', op * e);
    }
  }

  // Pouches and half pouches that change one end.
  for (const m of moves) {
    if (isJump(m)) continue;
    const S = m.ar.src!;
    const D = m.ar.dst!;
    const n = m.pair ? 2 : 1;
    const kS = S.kind === 'bond' ? keyOf(S.a, S.b!) : '';
    const kD = D.kind === 'bond' ? keyOf(D.a, D.b!) : '';
    const nS = Math.round(B.bonds.get(kS)?.order ?? 0);
    const nD = Math.round(A.bonds.get(kD)?.order ?? 0);
    let oS = 0;
    let oD = 0;
    if (S.kind === 'bond') {
      const i = outNext.get(kS) ?? 0;
      outNext.set(kS, i - n);
      oS = strandOffsets(nS)[Math.floor(i / 2)] ?? 0;
    }
    if (D.kind === 'bond') {
      const i = inNext.get(kD) ?? 0;
      inNext.set(kD, i - n);
      oD = strandOffsets(nD)[Math.floor(i / 2)] ?? 0;
    }
    const z: Vec = { x: 0, y: 0 };
    let hold: string;
    const [f0, f1] = span.get(m.ar) ?? [0, 1];
    const lf = clamp((win.frac - f0) / (f1 - f0), 0, 1);
    const eTake = smooth(clamp(lf / 0.62, 0, 1));
    const eLet = smooth(clamp((lf - 0.38) / 0.62, 0, 1));
    let g = smooth(lf);
    let tip0: Vec;
    let tip1: Vec;
    let c0: Vec | null;
    let c1: Vec | null;
    let w0 = m.pair ? W2 : W1;
    let w1 = m.pair ? W2 : W1;
    let lat0 = z;
    let lat1 = z;
    let acr0 = true;
    let acr1 = true;
    if (S.kind !== 'bond' && D.kind === 'bond' && m.from && (D.a === S.a || D.b === S.a)) {
      // Electrons of one atom take hold of another atom.
      g = eTake;
      hold = S.a;
      const other = D.a === S.a ? D.b! : D.a;
      if (!pos.has(hold) || !pos.has(other)) continue;
      const a0 = m.from.angle + turnB(hold);
      tip0 = freeTip(hold, a0);
      c0 = tip0;
      if (!m.pair && m.from.n === 2) {
        lat0 = fromAngle(a0 + Math.PI / 2, SIDE * m.side0);
        w0 = WH;
      }
      tip1 = inner(hold, other, oD);
      c1 = sharePoint(hold, other, oD);
      if (m.pair) {
        w1 = strandWidth(nD);
        acr1 = nD <= 1;
      } else {
        lat1 = scale(across(hold, other), SIDE * m.side1);
        w1 = WH;
      }
    } else if (S.kind === 'bond' && D.kind === 'atom' && (D.a === S.a || D.a === S.b)) {
      // Shared electrons let go of one atom and stay on the other.
      g = eLet;
      hold = D.a;
      const other = S.a === D.a ? S.b! : S.a;
      if (!pos.has(hold) || !pos.has(other)) continue;
      tip0 = inner(hold, other, oS);
      c0 = sharePoint(hold, other, oS);
      if (m.pair) {
        w0 = strandWidth(nS);
        acr0 = nS <= 1;
      } else {
        lat0 = scale(across(hold, other), SIDE * m.side0);
        w0 = WH;
      }
      const ang = m.to ? angLerp(angOf(pos.get(hold)!, pos.get(other)!), m.to.angle + turnA(hold), g) : angOf(pos.get(hold)!, pos.get(other)!);
      tip1 = freeTip(hold, ang);
      c1 = tip1;
      if (!m.pair && m.to && m.to.n === 2) {
        lat1 = fromAngle(ang + Math.PI / 2, SIDE * m.side1);
        w1 = WH;
      }
    } else if (S.kind === 'bond' && D.kind === 'bond') {
      // Shared electrons keep one atom and swing from the old partner to a new one.
      g = eTake;
      const shared = [S.a, S.b!].find((x) => x === D.a || x === D.b);
      if (!shared) continue;
      hold = shared;
      const was = S.a === shared ? S.b! : S.a;
      const now = D.a === shared ? D.b! : D.a;
      if (!pos.has(hold) || !pos.has(was) || !pos.has(now)) continue;
      tip0 = inner(hold, was, oS);
      c0 = sharePoint(hold, was, oS);
      tip1 = inner(hold, now, oD);
      c1 = sharePoint(hold, now, oD);
      if (m.pair) {
        w0 = strandWidth(nS);
        w1 = strandWidth(nD);
        acr0 = nS <= 1;
        acr1 = nD <= 1;
      } else {
        lat0 = scale(across(hold, was), SIDE * m.side0);
        lat1 = scale(across(hold, now), SIDE * m.side1);
        w0 = w1 = WH;
      }
    } else continue;
    if (!c0 || !c1) continue;
    const ph = pos.get(hold)!;
    // Turn about the atom that holds them, so that the pouch swings instead of cutting through the atom.
    const swing = (p0: Vec, p1: Vec): Vec => add(ph, fromAngle(angLerp(angOf(ph, p0), angOf(ph, p1), g), lerp(dist(ph, p0), dist(ph, p1), g)));
    const tip = swing(tip0, tip1);
    const c = swing(c0, c1);
    const u = norm(sub(tip, ph));
    const lat = lerpV(lat0, lat1, g);
    const op = opacity(hold);
    pouch(add(add(ph, scale(u, R(hold) - 3)), lat), add(tip, lat), lerp(w0, w1, g), ' hot', op);
    if (m.pair) electrons(c, u, 2, g < 0.5 ? acr0 : acr1, ' hot', op);
    else electron(add(c, lat), ' hot', op);
  }

  // Electrons that fly, one after another. Each is drawn the whole time: waiting, on its way, or arrived.
  const charges = new Map<string, number>();
  const bump = (id: string, d: number) => {
    const a0 = B.atoms.get(id);
    if (!a0) return;
    if (!charges.has(id)) charges.set(id, formalCharge(B, a0));
    charges.set(id, charges.get(id)! + d);
  };
  const waiting = new Map<Dom, number>();
  const landed = new Map<Dom, number>();
  for (const m of jumps) {
    bump(m.ar.src!.a, left(m) ? 1 : 0);
    bump(m.ar.dst!.a, arrived(m) ? -1 : 0);
    if (m.from && !left(m)) waiting.set(m.from, (waiting.get(m.from) ?? 0) + 1);
    if (m.to && arrived(m)) landed.set(m.to, (landed.get(m.to) ?? 0) + 1);
  }
  for (const m of jumps) {
    const at = arc(m);
    if (!at) continue;
    const u = flight.get(m) ?? 0;
    // The pouch an electron waits in or has landed in, when no other electron keeps it drawn.
    if (m.from && m.from.left === 0 && waiting.has(m.from) && !B.atoms.get(m.ar.src!.a)?.lattice) {
      lone(m.ar.src!.a, m.from.angle + turnB(m.ar.src!.a), waiting.get(m.from)!, ' hot', opacity(m.ar.src!.a), false);
      waiting.delete(m.from);
    }
    if (m.to && m.to.left === 0 && landed.has(m.to) && !A.atoms.get(m.ar.dst!.a)?.lattice) {
      lone(m.ar.dst!.a, m.to.angle + turnA(m.ar.dst!.a), landed.get(m.to)!, ' hot', opacity(m.ar.dst!.a), false);
      landed.delete(m.to);
    }
    if (u > 0.01) trail(m, u, 0.7);
    const flying = u > 0.01 && u < 0.999;
    electron(at(u), flying ? ' hot fly' : ' hot', 1, flying ? FLY * inp.eScale : DOT);
  }

  return finish({ under, over, charges, avoid });
}
