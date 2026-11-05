/**
 * 2D drawing geometry. Bond angles follow a flattened VSEPR picture so that
 * molecules look like textbook drawings (bent H2O, tripod NH3, cross NH4+),
 * and lone pairs are placed in the widest gaps between bonds.
 */
import { bondLength, element } from './elements';
import type { World } from '../engine/world';
import { neighbors, getBond } from '../engine/world';
import { add, angleOf, deg, fromAngle, sub, wrap, type Vec } from '../util/math';

/** Bond directions (degrees) relative to the first bond, given bonds and lone pairs on an atom. */
export function idealBondAngles(nb: number, nlp: number, isRoot: boolean): number[] {
  if (nb <= 1) return [0];
  if (nb === 2) {
    if (nlp === 0) return [0, 180];
    if (nlp === 1) return [0, 120];
    return [0, 104.5];
  }
  if (nb === 3) {
    if (nlp === 0) return [0, 120, 240];
    return isRoot ? [0, 60, 120] : [0, 120, 240];
  }
  if (nb === 4) return [0, 90, 180, 270];
  return Array.from({ length: nb }, (_, i) => (360 * i) / nb);
}

/** Small rings of a molecule (one cycle per non-tree bond of a DFS spanning tree). */
export function findRings(ids: string[], nb: (id: string) => { id: string }[]): string[][] {
  const parent = new Map<string, string | null>();
  const depth = new Map<string, number>();
  const rings: string[][] = [];
  const seenEdge = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const start = ids[0];
  parent.set(start, null);
  depth.set(start, 0);
  const stack = [start];
  const order: string[] = [];
  while (stack.length) {
    const u = stack.pop()!;
    order.push(u);
    for (const { id: v } of nb(u)) {
      if (!depth.has(v)) {
        parent.set(v, u);
        depth.set(v, depth.get(u)! + 1);
        seenEdge.add(key(u, v));
        stack.push(v);
      }
    }
  }
  for (const u of order) {
    for (const { id: v } of nb(u)) {
      const k = key(u, v);
      if (seenEdge.has(k)) continue;
      seenEdge.add(k);
      // Walk both ends up to their common ancestor.
      const pathU = [u];
      const pathV = [v];
      let a = u;
      let b = v;
      while (a !== b) {
        if ((depth.get(a) ?? 0) >= (depth.get(b) ?? 0)) {
          a = parent.get(a)!;
          pathU.push(a);
        } else {
          b = parent.get(b)!;
          pathV.push(b);
        }
        if (a === undefined || b === undefined) break;
      }
      pathV.pop();
      const ring = [...pathU, ...pathV.reverse()];
      if (ring.length >= 3 && ring.length <= 10) rings.push(ring);
    }
  }
  return rings;
}

/** Layout for molecules with rings: rings as regular polygons, substituents pointing outward. */
function ringLayout(w: World, ids: string[], nb: (id: string) => { id: string; order: number }[], rings: string[][]): Map<string, Vec> {
  const pos = new Map<string, Vec>();
  const L = (a: string, b: string) => bondLength(w.atoms.get(a)!.el, w.atoms.get(b)!.el);
  const placeRingAround = (ring: string[], center: Vec, startAngle: number) => {
    const n = ring.length;
    let avg = 0;
    for (let i = 0; i < n; i++) avg += L(ring[i], ring[(i + 1) % n]);
    avg /= n;
    const R = avg / (2 * Math.sin(Math.PI / n));
    ring.forEach((id, i) => {
      if (!pos.has(id)) pos.set(id, add(center, fromAngle(startAngle + (2 * Math.PI * i) / n, R)));
    });
  };
  const sorted = [...rings].sort((p, q) => q.length - p.length);
  placeRingAround(sorted[0], { x: 0, y: 0 }, -Math.PI / 2);
  const pending = sorted.slice(1);
  // Fused rings: share an edge with something already placed.
  for (let guard = 0; guard < 20 && pending.length; guard++) {
    const idx = pending.findIndex((r) => r.some((id, i) => pos.has(id) && pos.has(r[(i + 1) % r.length])));
    if (idx < 0) break;
    const ring = pending.splice(idx, 1)[0];
    const n = ring.length;
    const i0 = ring.findIndex((id, i) => pos.has(id) && pos.has(ring[(i + 1) % n]));
    const u = pos.get(ring[i0])!;
    const v = pos.get(ring[(i0 + 1) % n])!;
    const mid = { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 };
    const placedC = centroidOf([...pos.values()]);
    let nrm = { x: -(v.y - u.y), y: v.x - u.x };
    const nl = Math.hypot(nrm.x, nrm.y) || 1;
    nrm = { x: nrm.x / nl, y: nrm.y / nl };
    if ((placedC.x - mid.x) * nrm.x + (placedC.y - mid.y) * nrm.y > 0) nrm = { x: -nrm.x, y: -nrm.y };
    const edge = Math.hypot(v.x - u.x, v.y - u.y);
    const apothem = edge / (2 * Math.tan(Math.PI / n));
    const center = add(mid, { x: nrm.x * apothem, y: nrm.y * apothem });
    const R = edge / (2 * Math.sin(Math.PI / n));
    // Walk around the new ring from u in the direction that does not pass v first.
    const angU = Math.atan2(u.y - center.y, u.x - center.x);
    const angV = Math.atan2(v.y - center.y, v.x - center.x);
    let dir = Math.sign(Math.atan2(Math.sin(angV - angU), Math.cos(angV - angU))) || 1;
    dir = -dir;
    for (let k = 1; k < n - 1; k++) {
      const id = ring[(i0 - k + n) % n];
      if (!pos.has(id)) pos.set(id, add(center, fromAngle(angU + dir * ((2 * Math.PI * k) / n), R)));
    }
  }
  const ringOf = new Map<string, string[]>();
  for (const r of rings) for (const id of r) if (!ringOf.has(id)) ringOf.set(id, r);

  // Everything else grows outward from placed atoms.
  const queue = [...pos.keys()];
  for (let qi = 0; qi < queue.length; qi++) {
    const a = queue[qi];
    const pa = pos.get(a)!;
    const placedNb = nb(a).filter((x) => pos.has(x.id));
    const free = nb(a).filter((x) => !pos.has(x.id));
    if (!free.length) continue;
    let angles: number[];
    if (placedNb.length === 1) {
      const atom = w.atoms.get(a)!;
      const back = angleOf(sub(pos.get(placedNb[0].id)!, pa));
      const ideal = idealBondAngles(placedNb.length + free.length, atom.lp + (atom.rad > 0 ? 1 : 0), false).slice(1);
      angles = free.map((_, i) => back + deg(ideal[i] ?? 180));
    } else {
      let ox = 0;
      let oy = 0;
      for (const p of placedNb) {
        const d = sub(pa, pos.get(p.id)!);
        const l = Math.hypot(d.x, d.y) || 1;
        ox += d.x / l;
        oy += d.y / l;
      }
      const out = Math.atan2(oy, ox);
      const spread = free.length === 1 ? [0] : free.length === 2 ? [-0.9, 0.9] : [-1.2, 0, 1.2];
      angles = free.map((_, i) => out + (spread[i] ?? 0));
    }
    free.forEach((f, i) => {
      if (pos.has(f.id)) return;
      const ring = ringOf.get(f.id);
      const dirAng = angles[i];
      const l = L(a, f.id);
      const p = add(pa, fromAngle(dirAng, l));
      if (ring && ring.every((id) => !pos.has(id) || id === f.id)) {
        // A ring hanging off a chain: its centre lies straight out beyond the entry atom.
        const n = ring.length;
        const R = l / (2 * Math.sin(Math.PI / n));
        const center = add(p, fromAngle(dirAng, R));
        const k0 = ring.indexOf(f.id);
        const start = dirAng + Math.PI;
        ring.forEach((id, k) => {
          if (!pos.has(id)) pos.set(id, add(center, fromAngle(start + (2 * Math.PI * (k - k0)) / n, R)));
          queue.push(id);
        });
        return;
      }
      pos.set(f.id, p);
      queue.push(f.id);
    });
  }
  // Anything unreachable (should not happen): put it on a small circle.
  ids.forEach((id, i) => {
    if (!pos.has(id)) pos.set(id, fromAngle((2 * Math.PI * i) / ids.length, 40));
  });
  // Substituents on neighbouring ring atoms can bump into each other: nudge them apart,
  // keeping bond lengths and leaving the ring itself in place.
  const pinned = new Set(rings.flat());
  const bonds: [string, string, number][] = [];
  for (const id of ids) for (const n of nb(id)) if (id < n.id) bonds.push([id, n.id, L(id, n.id)]);
  const bonded = new Set(bonds.map(([a, b]) => `${a}|${b}`));
  const r = (id: string) => element(w.atoms.get(id)!.el).r;
  for (let iter = 0; iter < 120; iter++) {
    const f = new Map<string, Vec>(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (const [a, b, l] of bonds) {
      const pa = pos.get(a)!;
      const pb = pos.get(b)!;
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      const k = ((d - l) / d) * 0.5;
      f.get(a)!.x += (pb.x - pa.x) * k;
      f.get(a)!.y += (pb.y - pa.y) * k;
      f.get(b)!.x -= (pb.x - pa.x) * k;
      f.get(b)!.y -= (pb.y - pa.y) * k;
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        if (bonded.has(a < b ? `${a}|${b}` : `${b}|${a}`)) continue;
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        const d = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 0.01;
        const want = r(a) + r(b) + 7;
        if (d >= want) continue;
        const k = ((want - d) / d) * 0.5;
        f.get(a)!.x -= (pb.x - pa.x) * k;
        f.get(a)!.y -= (pb.y - pa.y) * k;
        f.get(b)!.x += (pb.x - pa.x) * k;
        f.get(b)!.y += (pb.y - pa.y) * k;
      }
    }
    let moved = 0;
    for (const id of ids) {
      if (pinned.has(id)) continue;
      const v = f.get(id)!;
      const p = pos.get(id)!;
      pos.set(id, { x: p.x + v.x * 0.6, y: p.y + v.y * 0.6 });
      moved += Math.abs(v.x) + Math.abs(v.y);
    }
    if (moved < 0.05) break;
  }
  return pos;
}

function centroidOf(ps: Vec[]): Vec {
  let x = 0;
  let y = 0;
  for (const p of ps) {
    x += p.x;
    y += p.y;
  }
  return { x: x / (ps.length || 1), y: y / (ps.length || 1) };
}

/** Relative layout of one connected molecule. */
export function relativeLayout(w: World, ids: string[]): Map<string, Vec> {
  const pos = new Map<string, Vec>();
  if (ids.length === 1) {
    pos.set(ids[0], { x: 0, y: 0 });
    return pos;
  }
  const inSet = new Set(ids);
  const nb = (id: string) => neighbors(w, id).filter((n) => inSet.has(n.id));
  const rings = findRings(ids, nb);
  if (rings.length) return ringLayout(w, ids, nb, rings);
  // Root: heaviest branching atom.
  const root = [...ids].sort((p, q) => {
    const dp = nb(p).length;
    const dq = nb(q).length;
    if (dp !== dq) return dq - dp;
    const hp = w.atoms.get(p)!.el === 'H' ? 1 : 0;
    const hq = w.atoms.get(q)!.el === 'H' ? 1 : 0;
    if (hp !== hq) return hp - hq;
    return p < q ? -1 : 1;
  })[0];

  pos.set(root, { x: 0, y: 0 });
  const queue: { id: string; parent: string | null; inAngle: number }[] = [{ id: root, parent: null, inAngle: 0 }];
  const visited = new Set([root]);
  let ringFallback = false;
  while (queue.length) {
    const { id, parent, inAngle } = queue.shift()!;
    const atom = w.atoms.get(id)!;
    const ns = nb(id);
    const children = ns.filter((n) => n.id !== parent).sort((p, q) => (p.id < q.id ? -1 : 1));
    const angles = idealBondAngles(ns.length, atom.lp + (atom.rad > 0 ? 1 : 0), parent === null);
    // With a parent, angle[0] points at the parent; children take the rest.
    const childAngles = parent === null ? angles : angles.slice(1);
    children.forEach((c, i) => {
      if (visited.has(c.id)) {
        ringFallback = true;
        return;
      }
      visited.add(c.id);
      // inAngle points from this atom back to its parent; ideal angles are measured from there.
      const a = parent === null ? deg(childAngles[i] ?? 0) : inAngle + deg(childAngles[i] ?? 0);
      const l = bondLength(atom.el, w.atoms.get(c.id)!.el, c.order);
      pos.set(c.id, add(pos.get(id)!, fromAngle(a, l)));
      queue.push({ id: c.id, parent: id, inAngle: a + Math.PI });
    });
  }
  if (ringFallback || pos.size !== ids.length) {
    // Should not happen now that rings have their own layout; keep a safe fallback.
    const r = 20 + ids.length * 6;
    ids.forEach((id, i) => pos.set(id, fromAngle((2 * Math.PI * i) / ids.length, r)));
    return pos;
  }

  // Default orientation: bond bisector of the root points down, linear molecules lie flat.
  const rootNb = nb(root);
  let sx = 0;
  let sy = 0;
  for (const n of rootNb) {
    const d = sub(pos.get(n.id)!, pos.get(root)!);
    const l = Math.hypot(d.x, d.y);
    sx += d.x / l;
    sy += d.y / l;
  }
  let rot: number;
  if (Math.hypot(sx, sy) > 0.3 && rootNb.length >= 2) rot = Math.PI / 2 - Math.atan2(sy, sx);
  else if (rootNb.length === 1 || rootNb.length === 2) rot = Math.PI - angleOf(sub(pos.get(rootNb[0].id)!, pos.get(root)!));
  else rot = -angleOf(sub(pos.get(rootNb[0].id)!, pos.get(root)!)) - Math.PI / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (const [k, p] of pos) pos.set(k, { x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  return pos;
}

/**
 * Best rigid placement (rotation, optional mirror, translation) of `rel` onto
 * `target` points (2D Kabsch). Returns world positions.
 */
export function alignTo(rel: Map<string, Vec>, target: Map<string, Vec>): Map<string, Vec> {
  const keys = [...rel.keys()].filter((k) => target.has(k));
  if (keys.length === 0) return rel;
  const tryMirror = (mirror: boolean) => {
    const P = keys.map((k) => {
      const p = rel.get(k)!;
      return mirror ? { x: -p.x, y: p.y } : p;
    });
    const Q = keys.map((k) => target.get(k)!);
    const pc = mean(P);
    const qc = mean(Q);
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < P.length; i++) {
      const p = sub(P[i], pc);
      const q = sub(Q[i], qc);
      sxx += p.x * q.x + p.y * q.y;
      sxy += p.x * q.y - p.y * q.x;
    }
    const ang = keys.length === 1 ? 0 : Math.atan2(sxy, sxx);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const out = new Map<string, Vec>();
    let err = 0;
    for (const [k, p0] of rel) {
      const p = mirror ? { x: -p0.x, y: p0.y } : p0;
      const d = sub(p, pc);
      const q = { x: d.x * c - d.y * s + qc.x, y: d.x * s + d.y * c + qc.y };
      out.set(k, q);
      if (target.has(k)) err += (q.x - target.get(k)!.x) ** 2 + (q.y - target.get(k)!.y) ** 2;
    }
    return { out, err };
  };
  const a = tryMirror(false);
  if (keys.length < 3) return a.out;
  const b = tryMirror(true);
  return b.err < a.err - 1e-6 ? b.out : a.out;
}

function mean(ps: Vec[]): Vec {
  let x = 0;
  let y = 0;
  for (const p of ps) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ps.length, y: y / ps.length };
}

/** Re-draw a molecule in its ideal shape, keeping it where it was as much as possible. */
export function relayout(w: World, ids: string[]): void {
  const rel = relativeLayout(w, ids);
  const target = new Map<string, Vec>();
  for (const id of ids) {
    const a = w.atoms.get(id)!;
    target.set(id, { x: a.x, y: a.y });
  }
  const placed = alignTo(rel, target);
  for (const [id, p] of placed) {
    const a = w.atoms.get(id)!;
    a.x = p.x;
    a.y = p.y;
  }
}

/** Place a brand-new molecule with its default orientation centred on `center`. */
export function placeNew(w: World, ids: string[], center: Vec, rotation = 0): void {
  const rel = relativeLayout(w, ids);
  let cx = 0;
  let cy = 0;
  for (const p of rel.values()) {
    cx += p.x;
    cy += p.y;
  }
  cx /= rel.size;
  cy /= rel.size;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  for (const [id, p] of rel) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const a = w.atoms.get(id)!;
    a.x = center.x + dx * c - dy * s;
    a.y = center.y + dx * s + dy * c;
  }
}

/**
 * Directions (radians) of an atom's lone pairs: spread through the widest
 * gaps between its bonds. Works from whatever positions are given, so it
 * follows the molecule while it moves or turns.
 */
export function lonePairAngles(center: Vec, bondDirs: number[], count: number): number[] {
  if (count <= 0) return [];
  if (bondDirs.length === 0) {
    return Array.from({ length: count }, (_, i) => wrap(-Math.PI / 4 + (2 * Math.PI * i) / count));
  }
  void center;
  const dirs = bondDirs.map(wrap).sort((p, q) => p - q);
  const gaps = dirs.map((d, i) => {
    const next = i === dirs.length - 1 ? dirs[0] + Math.PI * 2 : dirs[i + 1];
    return { start: d, size: next - d, n: 0 };
  });
  for (let k = 0; k < count; k++) {
    let best = gaps[0];
    for (const g of gaps) if (g.size / (g.n + 1) > best.size / (best.n + 1)) best = g;
    best.n++;
  }
  const out: number[] = [];
  for (const g of gaps) {
    for (let i = 1; i <= g.n; i++) out.push(wrap(g.start + (g.size * i) / (g.n + 1)));
  }
  return out;
}

export interface ElectronDomain {
  angle: number;
  /** true = one unpaired electron, false = a lone pair. */
  single: boolean;
}

/**
 * Where an atom's non-bonding electrons sit: lone pairs and unpaired electrons
 * share the gaps between bonds. An atom without bonds spreads them evenly,
 * starting from `face` with the unpaired electrons first, so a radical can be
 * turned to face whatever it is about to react with.
 */
export function electronDomains(
  center: Vec,
  bondDirs: number[],
  lp: number,
  rad: number,
  face?: number,
  skip = 0,
): ElectronDomain[] {
  const n = lp + rad;
  if (n <= 0) return [];
  if (bondDirs.length === 0) {
    // `skip` keeps the places of electrons that just left empty, so the rest do not jump.
    const slots = n + skip;
    const base = face ?? -Math.PI / 4;
    return Array.from({ length: n }, (_, i) => ({
      angle: wrap(base + (2 * Math.PI * (i < rad ? i : i + skip)) / slots),
      single: i < rad,
    }));
  }
  return lonePairAngles(center, bondDirs, n).map((angle, i) => ({ angle, single: i >= lp }));
}

/** Electron domains of an atom in a world, from its current bonds. */
export function domainsInWorld(w: World, id: string): ElectronDomain[] {
  const a = w.atoms.get(id)!;
  const dirs = neighbors(w, id).map((n) => {
    const b = w.atoms.get(n.id)!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  return electronDomains(a, dirs, a.lp, a.rad, a.face, a.skip ?? 0);
}

/** Lone-pair directions of an atom in a world, from its current bonds. */
export function lonePairDirsInWorld(w: World, id: string, _lp?: number): number[] {
  return domainsInWorld(w, id)
    .filter((d) => !d.single)
    .map((d) => d.angle);
}

export { getBond };
