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
import { ELECTRONEGATIVITY, element } from '../chem/elements';
import { electronDomains } from '../chem/geometry';
import { plateSlot, type ArrowAnim, type StepAnim } from '../engine/timeline';
import { formalCharge, type Atom, type World } from '../engine/world';
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

function adjacency(w: World): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const b of w.bonds.values()) {
    if (b.order <= 0) continue;
    (m.get(b.a) ?? m.set(b.a, []).get(b.a)!).push(b.b);
    (m.get(b.b) ?? m.set(b.b, []).get(b.b)!).push(b.a);
  }
  return m;
}

function domainsOf(w: World, adj: Map<string, string[]>, id: string, pos: Map<string, Vec>): Dom[] {
  const a = w.atoms.get(id);
  const p = pos.get(id);
  if (!a || !p || a.lp + a.rad <= 0) return [];
  const dirs = (adj.get(id) ?? []).filter((o) => pos.has(o)).map((o) => angOf(p, pos.get(o)!));
  return electronDomains(p, dirs, a.lp, a.rad, a.face, a.skip ?? 0).map((d) => ({ angle: d.angle, n: d.single ? 1 : 2 }));
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

export function drawPairs(inp: PairsInput): PairsOutput {
  const { step, win, topo, after, pos, isCrowd, opacity } = inp;
  const under: string[] = [];
  const over: string[] = [];
  const byId = new Map(inp.atoms.map((a) => [a.id, a]));
  /** Solvent: drawn plainly (lines, no electrons), whether it is background or a shell around an ion. */
  const crowd = (id: string) => !!byId.get(id)?.crowd;
  const faint = (id: string) => {
    const a = byId.get(id);
    return !!a && isCrowd(a);
  };
  const R = (id: string) => element((byId.get(id) ?? after.atoms.get(id))!.el).r;

  // ---------------------------------------------------------------- primitives

  const pouch = (p: Vec, q: Vec, w: number, cls: string, op: number) => {
    if (op > 0.01) under.push(`<line class="pouch${cls}" x1="${f1(p.x)}" y1="${f1(p.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}" stroke-width="${f1(w)}" opacity="${f1(op)}"/>`);
  };
  const electron = (p: Vec, cls: string, op: number, r = DOT) => {
    if (op > 0.01) over.push(`<circle class="pe${cls}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}" opacity="${f1(op)}"/>`);
  };
  /** The electrons of a pouch whose electrons are centred on c, the pouch lying along unit vector u. */
  const electrons = (c: Vec, u: Vec, n: number, across: boolean, cls: string, op: number) => {
    if (n >= 2) {
      const s = scale(across ? perp(u) : u, SIDE);
      electron(add(c, s), cls, op);
      electron(sub(c, s), cls, op);
    } else if (n === 1) electron(c, cls, op);
  };

  /** A lone pouch on atom `id` pointing at `ang`. */
  const lone = (id: string, ang: number, n: number, cls: string, op: number, dots = true) => {
    const p = pos.get(id);
    if (!p || n <= 0) return;
    const u = fromAngle(ang);
    const r = R(id);
    const c = add(p, scale(u, r + OUT));
    pouch(add(p, scale(u, r - 2)), c, n >= 2 ? W2 : W1, cls, op);
    if (dots) electrons(c, u, n, true, cls, op);
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
  const still = (w: World, fade: (id: string) => number, hotLone?: Map<string, Dom[]>, hotBond?: Map<string, number>, hotOp = 0, soft?: Set<string>) => {
    const adj = adjacency(w);
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
        strand(b.a, b.b, o, n, '', op, !inp.simple);
        if (isHot) strand(b.a, b.b, o, n, ' hot', op * hotOp);
      });
    }
    for (const a of inp.atoms) {
      if (inp.simple || crowd(a.id) || a.lattice || packed.has(a.id)) continue;
      const wa = w.atoms.get(a.id);
      if (!wa) continue;
      const op = opacity(a.id) * fade(a.id);
      const doms = domainsOf(w, adj, a.id, pos);
      for (const d of doms) lone(a.id, d.angle, d.n, '', op);
      for (const h of hotLone?.get(a.id) ?? []) lone(a.id, h.angle, h.n, ' hot', op * hotOp);
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
    for (const { a, b } of step.pulls) {
      const A0 = topo.atoms.get(a);
      const B0 = topo.atoms.get(b);
      const pa = pos.get(a);
      const pb = pos.get(b);
      if (!A0 || !B0 || !pa || !pb) continue;
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
      // From the electrons that face the other atom (if this atom has some) to the other atom's edge.
      const doms = domainsOf(topo, adj, a, pos);
      const facing = doms.length ? doms.reduce((m, d) => (angDist(d.angle, angOf(pa, pb)) < angDist(m.angle, angOf(pa, pb)) ? d : m), doms[0]) : null;
      const from = facing && angDist(facing.angle, angOf(pa, pb)) < 0.9 ? add(pa, fromAngle(facing.angle, R(a) + OUT + 7)) : add(pa, scale(u, R(a) + 2));
      const to = sub(pb, scale(u, R(b) + 2));
      const op = show * Math.min(opacity(a), opacity(b));
      if (dist(from, to) > 6 && op > 0.01) over.push(`<line class="pull" x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" opacity="${f1(op)}"/>`);
      // The marks sit beside the two places, on the upper side of the line between them.
      const up = perp(u).y < 0 ? perp(u) : scale(perp(u), -1);
      const mark = (c: Vec, l: { sign: number; mark: boolean }) => {
        if (!l.mark || op <= 0.01) return;
        over.push(`<text class="pq ${l.sign > 0 ? 'pos' : 'neg'}" x="${f1(c.x)}" y="${f1(c.y)}" dy="0.35em" opacity="${f1(op)}">${l.sign > 0 ? '+' : '−'}</text>`);
      };
      const useTip = !!facing && angDist(facing.angle, angOf(pa, pb)) < 0.9;
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
    o.plate = plate;
  };
  const finish = (o: PairsOutput): PairsOutput => {
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
  const adjB = adjacency(B);
  const adjA = adjacency(A);

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
    d0.set(id, domainsOf(B, adjB, id, pos).map((d) => ({ ...d, left: d.n })));
    d1.set(id, domainsOf(A, adjA, id, pos).map((d) => ({ ...d, left: d.n })));
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
      // The pouch nearest to where the electrons come from.
      const p = pos.get(D.a);
      const other = S.kind === 'bond' ? (S.a === D.a ? S.b! : S.a) : S.a;
      const q = pos.get(other);
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
    if (!dom) return add(p, fromAngle(Math.atan2(m.ar.p0.y - (B.atoms.get(E.a)?.y ?? 0), m.ar.p0.x - (B.atoms.get(E.a)?.x ?? 0)), R(E.a) + OUT));
    const c = add(p, fromAngle(dom.angle, R(E.a) + OUT));
    return dom.n >= 2 ? add(c, fromAngle(dom.angle + Math.PI / 2, SIDE * side)) : c;
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
    return finish({ under, over });
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
    return finish({ under, over });
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
      strandOffsets(oa).forEach((o) => strand(b.a, b.b, o, oa, '', op));
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
      if (c) electrons(c, u, 2, Math.max(ob, oa) <= 1, '', op);
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
    if (crowd(a.id) || a.lattice) continue;
    const op = opacity(a.id);
    if (!touched.has(a.id)) {
      if (packed.has(a.id)) continue;
      const w = A.atoms.has(a.id) ? A : B;
      for (const d of domainsOf(w, w === A ? adjA : adjB, a.id, pos)) lone(a.id, d.angle, d.n, '', op);
      continue;
    }
    const s0 = (d0.get(a.id) ?? []).filter((d) => d.left > 0);
    const s1 = (d1.get(a.id) ?? []).filter((d) => d.left > 0);
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
          lone(a.id, angLerp(x[i].angle, q.angle, e), Math.min(x[i].left, q.left), '', op);
        }
      }
    }
    if (!matched) {
      for (const d of s0) lone(a.id, d.angle, d.left, '', op * (1 - e));
      for (const d of s1) lone(a.id, d.angle, d.left, '', op * e);
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
      tip0 = freeTip(hold, m.from.angle);
      c0 = tip0;
      if (!m.pair && m.from.n === 2) {
        lat0 = fromAngle(m.from.angle + Math.PI / 2, SIDE * m.side0);
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
      const ang = m.to ? angLerp(angOf(pos.get(hold)!, pos.get(other)!), m.to.angle, g) : angOf(pos.get(hold)!, pos.get(other)!);
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
  const avoid = new Map<string, number[]>();
  for (const m of jumps) {
    if (m.from) (avoid.get(m.ar.src!.a) ?? avoid.set(m.ar.src!.a, []).get(m.ar.src!.a)!).push(m.from.angle);
    if (m.to) (avoid.get(m.ar.dst!.a) ?? avoid.set(m.ar.dst!.a, []).get(m.ar.dst!.a)!).push(m.to.angle);
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
    if (m.from && m.from.left === 0 && waiting.has(m.from)) {
      lone(m.ar.src!.a, m.from.angle, waiting.get(m.from)!, ' hot', opacity(m.ar.src!.a), false);
      waiting.delete(m.from);
    }
    if (m.to && m.to.left === 0 && landed.has(m.to)) {
      lone(m.ar.dst!.a, m.to.angle, landed.get(m.to)!, ' hot', opacity(m.ar.dst!.a), false);
      landed.delete(m.to);
    }
    if (u > 0.01) trail(m, u, 0.7);
    const flying = u > 0.01 && u < 0.999;
    electron(at(u), flying ? ' hot fly' : ' hot', 1, flying ? FLY * inp.eScale : DOT);
  }

  return finish({ under, over, charges, avoid });
}
