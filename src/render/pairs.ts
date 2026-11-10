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
import type { ArrowAnim, StepAnim } from '../engine/timeline';
import type { Atom, World } from '../engine/world';
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
}

const f1 = (n: number) => n.toFixed(1);
/** Width of a pouch with two electrons, and with one. */
const W2 = 13;
const W1 = 8.5;
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

export function drawPairs(inp: PairsInput): { under: string[]; over: string[] } {
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
        strand(b.a, b.b, o, n, '', op);
        if (isHot) strand(b.a, b.b, o, n, ' hot', op * hotOp);
      });
    }
    for (const a of inp.atoms) {
      if (crowd(a.id) || a.lattice) continue;
      const wa = w.atoms.get(a.id);
      if (!wa) continue;
      const op = opacity(a.id) * fade(a.id);
      const doms = domainsOf(w, adj, a.id, pos);
      for (const d of doms) lone(a.id, d.angle, d.n, '', op);
      for (const h of hotLone?.get(a.id) ?? []) lone(a.id, h.angle, h.n, ' hot', op * hotOp);
    }
  };

  const one = () => 1;
  const netNew = new Set<string>();
  if (step && !step.events.length) for (const [k, b] of step.after.bonds) if (b.order > 0 && !(step.before.bonds.get(k)?.order ?? 0)) netNew.add(k);
  if (!step || !step.arrows.some((ar) => ar.src && ar.dst) || step.events.length) {
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
        return { under, over };
      }
    }
    still(topo, one, undefined, undefined, 0, step && win.post ? netNew : undefined);
    return { under, over };
  }

  // ---------------------------------------------------------------- a step in which electrons move

  const B = step.before;
  const A = step.after;
  const adjB = adjacency(B);
  const adjA = adjacency(A);
  const bound = step.arrows.filter((ar) => ar.src && ar.dst);

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

  // Strands of each bond: how many pairs leave by pair moves, arrive by pair moves, and change otherwise.
  const pairOut = new Map<string, number>();
  const pairIn = new Map<string, number>();
  for (const m of moves) {
    if (!m.pair) continue;
    if (m.ar.src!.kind === 'bond') pairOut.set(keyOf(m.ar.src!.a, m.ar.src!.b!), (pairOut.get(keyOf(m.ar.src!.a, m.ar.src!.b!)) ?? 0) + 1);
    if (m.ar.dst!.kind === 'bond') pairIn.set(keyOf(m.ar.dst!.a, m.ar.dst!.b!), (pairIn.get(keyOf(m.ar.dst!.a, m.ar.dst!.b!)) ?? 0) + 1);
  }

  const e = win.during ? win.prog : win.post ? 1 : 0;
  // A pair that takes hold of a new atom goes first and a pair that lets go of one follows, so
  // that in between the atom is held from both sides: nothing is ever left hanging loose.
  const eTake = win.during ? smooth(clamp(win.frac / 0.62, 0, 1)) : e;
  const eLet = win.during ? smooth(clamp((win.frac - 0.38) / 0.62, 0, 1)) : e;

  // ---- before the change: everything as it was, the pouches about to change tinted
  if (win.pre) {
    const hotLone = new Map<string, Dom[]>();
    const hotBond = new Map<string, number>();
    for (const m of moves) {
      const S = m.ar.src!;
      if (S.kind === 'bond') {
        if (m.pair) hotBond.set(keyOf(S.a, S.b!), (hotBond.get(keyOf(S.a, S.b!)) ?? 0) + 1);
      } else if (m.from) (hotLone.get(S.a) ?? hotLone.set(S.a, []).get(S.a)!).push({ angle: m.from.angle, n: m.pair ? 2 : m.from.n });
    }
    still(B, one, hotLone, hotBond, win.cue);
    return { under, over };
  }

  // ---- after the change: everything as it is now, the pouches that changed still tinted while the atoms settle
  if (win.post) {
    const hotLone = new Map<string, Dom[]>();
    const hotBond = new Map<string, number>();
    for (const m of moves) {
      const D = m.ar.dst!;
      if (D.kind === 'bond') {
        if (m.pair) hotBond.set(keyOf(D.a, D.b!), (hotBond.get(keyOf(D.a, D.b!)) ?? 0) + 1);
      } else if (m.to && m.pair) (hotLone.get(D.a) ?? hotLone.set(D.a, []).get(D.a)!).push({ angle: m.to.angle, n: 2 });
    }
    still(A, one, hotLone, hotBond, 1 - win.settle);
    return { under, over };
  }

  // ---- during the change

  // Bonds.
  const keys = new Set([...B.bonds.keys(), ...A.bonds.keys()]);
  /** Offset of the strand a pair move leaves (index from the end) and of the one it makes. */
  const outSlot = new Map<string, number>();
  const inSlot = new Map<string, number>();
  for (const k of keys) {
    const bb = B.bonds.get(k);
    const ba = A.bonds.get(k);
    const b = (ba ?? bb)!;
    if (!byId.has(b.a) || !byId.has(b.b)) continue;
    const op = opOf(b.a, b.b);
    const ob = Math.round(bb?.order ?? 0);
    const oa = Math.round(ba?.order ?? 0);
    if (crowd(b.a) || crowd(b.b)) {
      if (oa > 0) plainBond(b.a, b.b, oa, op);
      continue;
    }
    if (step.appear.has(b.a) || step.appear.has(b.b)) {
      strandOffsets(oa).forEach((o) => strand(b.a, b.b, o, oa, '', op));
      continue;
    }
    const base = ob - (pairOut.get(k) ?? 0);
    const target = oa - (pairIn.get(k) ?? 0);
    const stable = Math.max(0, Math.min(base, target));
    const offB = strandOffsets(ob);
    const offA = strandOffsets(oa);
    const wide = lerp(strandWidth(ob || oa), strandWidth(oa || ob), e);
    for (let i = 0; i < stable; i++) {
      const o = lerp(offB[i] ?? 0, offA[i] ?? 0, e);
      const pa = pos.get(b.a)!;
      const pb = pos.get(b.b)!;
      const u = norm(sub(pb, pa));
      const nn = scale(perp(u), o);
      pouch(add(add(pa, scale(u, R(b.a) - 3)), nn), add(sub(pb, scale(u, R(b.b) - 3)), nn), wide, '', op);
      const c = sharePoint(b.a, b.b, o);
      if (c) electrons(c, u, 2, Math.max(ob, oa) <= 1, '', op);
    }
    // Strands that single electrons (or a net change) remove or add: the pouch fades, the electrons are drawn by their moves.
    for (let i = stable; i < base; i++) strand(b.a, b.b, offB[i] ?? 0, ob, ' hot', op * (1 - e), false);
    for (let i = stable; i < target; i++) strand(b.a, b.b, offA[i] ?? 0, oa, ' hot', op * e, false);
    outSlot.set(k, ob - 1);
    inSlot.set(k, oa - 1);
  }

  // Lone pouches. Untouched atoms: as they are. Touched atoms: the pouches that stay turn from
  // their old directions to their new ones while the others leave and arrive.
  for (const a of inp.atoms) {
    if (crowd(a.id) || a.lattice) continue;
    const op = opacity(a.id);
    if (!touched.has(a.id)) {
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

  // The electrons that move.
  for (const m of moves) {
    const S = m.ar.src!;
    const D = m.ar.dst!;
    if (m.pair) {
      // One pouch from start to end. `hold` is the atom it stays on; its other end goes from `tip0` to `tip1`.
      let hold: string;
      let tip0: Vec | null = null;
      let tip1: Vec | null = null;
      let c0: Vec | null = null;
      let c1: Vec | null = null;
      let across0 = true;
      let across1 = true;
      let w0 = W2;
      let w1 = W2;
      const freeTip = (id: string, ang: number) => add(pos.get(id)!, fromAngle(ang, R(id) + OUT));
      const inner = (a: string, b: string, o: number) => {
        // The end of strand o at atom b, seen from a.
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        const u = norm(sub(pb, pa));
        return add(sub(pb, scale(u, R(b) - 3)), scale(perp(u), o));
      };
      const kS = S.kind === 'bond' ? keyOf(S.a, S.b!) : '';
      const kD = D.kind === 'bond' ? keyOf(D.a, D.b!) : '';
      const nS = Math.round(B.bonds.get(kS)?.order ?? 0);
      const nD = Math.round(A.bonds.get(kD)?.order ?? 0);
      const oS = S.kind === 'bond' ? strandOffsets(nS)[outSlot.get(kS) ?? 0] ?? 0 : 0;
      const oD = D.kind === 'bond' ? strandOffsets(nD)[inSlot.get(kD) ?? 0] ?? 0 : 0;
      if (S.kind === 'bond') {
        outSlot.set(kS, (outSlot.get(kS) ?? 0) - 1);
        w0 = strandWidth(nS);
        across0 = nS <= 1;
      }
      if (D.kind === 'bond') {
        inSlot.set(kD, (inSlot.get(kD) ?? 0) - 1);
        w1 = strandWidth(nD);
        across1 = nD <= 1;
      }
      let g = e;
      if (S.kind !== 'bond' && D.kind === 'bond' && m.from) {
        // A lone pair takes hold of another atom.
        g = eTake;
        hold = S.a;
        const other = D.a === S.a ? D.b! : D.a;
        if (!pos.has(hold) || !pos.has(other)) continue;
        tip0 = freeTip(hold, m.from.angle);
        c0 = tip0;
        tip1 = inner(hold, other, oD);
        c1 = sharePoint(hold, other, oD);
      } else if (S.kind === 'bond' && D.kind === 'atom') {
        // A shared pair lets go of one atom and stays on the other.
        g = eLet;
        hold = D.a;
        const other = S.a === D.a ? S.b! : S.a;
        if (!pos.has(hold) || !pos.has(other)) continue;
        tip0 = inner(hold, other, oS);
        c0 = sharePoint(hold, other, oS);
        const ang = m.to ? angLerp(angOf(pos.get(hold)!, pos.get(other)!), m.to.angle, g) : angOf(pos.get(hold)!, pos.get(other)!);
        tip1 = freeTip(hold, ang);
        c1 = tip1;
      } else if (S.kind === 'bond' && D.kind === 'bond') {
        // A shared pair keeps one atom and swings from its old partner to a new one.
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
      } else continue;
      if (!tip0 || !tip1 || !c0 || !c1) continue;
      const ph = pos.get(hold)!;
      // Turn about the atom that holds it, so that the pouch swings instead of cutting through the atom.
      const swing = (p0: Vec, p1: Vec): Vec => {
        const a0 = angOf(ph, p0);
        const a1 = angOf(ph, p1);
        return add(ph, fromAngle(angLerp(a0, a1, g), lerp(dist(ph, p0), dist(ph, p1), g)));
      };
      const tip = swing(tip0, tip1);
      const c = swing(c0, c1);
      const u = norm(sub(tip, ph));
      const op = opacity(hold);
      const base = add(ph, scale(u, R(hold) - 3));
      pouch(base, tip, lerp(w0, w1, g), ' hot', op);
      const across = g < 0.5 ? across0 : across1;
      electrons(c, u, 2, across, ' hot', op);
      continue;
    }

    // One electron: it flies from where it was to where it will be.
    const site = (end: 'src' | 'dst'): Vec | null => {
      const E = end === 'src' ? S : D;
      const dom = end === 'src' ? m.from : m.to;
      const side = end === 'src' ? m.side0 : m.side1;
      if (E.kind === 'bond') {
        const w = end === 'src' ? B : A;
        const n = Math.round(w.bonds.get(keyOf(E.a, E.b!))?.order ?? 1);
        const c = sharePoint(E.a, E.b!, strandOffsets(n)[n - 1] ?? 0);
        const pa = pos.get(E.a);
        const pb = pos.get(E.b!);
        if (!c || !pa || !pb) return null;
        const u = norm(sub(pb, pa));
        return add(c, scale(n <= 1 ? perp(u) : u, SIDE * side));
      }
      const p = pos.get(E.a);
      if (!p) return null;
      if (!dom) return add(p, fromAngle(end === 'src' ? Math.atan2(m.ar.p0.y - (B.atoms.get(E.a)?.y ?? 0), m.ar.p0.x - (B.atoms.get(E.a)?.x ?? 0)) : 0, R(E.a) + OUT));
      const c = add(p, fromAngle(dom.angle, R(E.a) + OUT));
      return dom.n >= 2 ? add(c, fromAngle(dom.angle + Math.PI / 2, SIDE * side)) : c;
    };
    const p0 = site('src');
    const p1 = site('dst');
    if (!p0 || !p1) continue;
    const d = dist(p0, p1);
    // A slight arc, bent to opposite sides for two electrons that go the same way.
    const bend = add(lerpV(p0, p1, 0.5), scale(perp(norm(sub(p1, p0))), Math.min(26, d * 0.22) * m.side0));
    const at = (u: number): Vec => {
      const a = lerpV(p0, bend, u);
      const b = lerpV(bend, p1, u);
      return lerpV(a, b, u);
    };
    let trail = '';
    const nSeg = Math.max(2, Math.round(14 * e));
    for (let i = 0; i <= nSeg; i++) {
      const q = at((e * i) / nSeg);
      trail += `${f1(q.x)},${f1(q.y)} `;
    }
    over.push(`<polyline class="etrail" points="${trail.trim()}"/>`);
    electron(at(e), ' hot fly', 1, FLY * inp.eScale);
  }

  return { under, over };
}
