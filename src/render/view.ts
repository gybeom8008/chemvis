/**
 * Draws one moment of a timeline into an SVG element: atoms, bonds, lone
 * pairs, charges, electron arrows, moving electrons, notes and so on.
 */
import { bondLength, element } from '../chem/elements';
import { lonePairAngles } from '../chem/geometry';
import type { Keyframe, NoteTarget, StepAnim, Timeline } from '../engine/timeline';
import { formalCharge, type Atom, type Lens, type World } from '../engine/world';
import { inRegion } from '../stage/stages';
import {
  add,
  centroid,
  clamp,
  deg,
  dist,
  fromAngle,
  lerp,
  norm,
  perp,
  polyAt,
  qbez,
  qbezTangent,
  scale,
  smooth,
  sub,
  type Vec,
} from '../util/math';
import { hashString } from '../util/rng';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = (n: number) => n.toFixed(1);

export function trackAt(kf: Keyframe[], t: number): Vec {
  if (t <= kf[0].t) return kf[0];
  const last = kf[kf.length - 1];
  if (t >= last.t) return last;
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i].t) {
      const a = kf[i - 1];
      const b = kf[i];
      const span = b.t - a.t;
      let u = span < 1e-9 ? 1 : (t - a.t) / span;
      if (b.ease) u = smooth(u);
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
    }
  }
  return last;
}

export interface DrawOptions {
  lens: Lens;
  /** Seconds since start, drives thermal motion. */
  clock: number;
  /** Thermal motion on/off (off for tests and reduced motion). */
  motion: boolean;
  /** Seconds since the last frame; 0 snaps the camera. */
  dt?: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class StageView {
  private svg: SVGSVGElement;
  private bg: SVGGElement;
  private dyn: SVGGElement;
  private tl: Timeline | null = null;
  private boxes: Box[] = [];
  private cam: Box | null = null;
  /** Where each note box sits relative to its target, decided once per step so it never jumps. */
  private notePlace = new Map<string, { dx: number; dy: number }>();

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    svg.innerHTML = '<g class="bg"></g><g class="dyn"></g>';
    this.bg = svg.querySelector('.bg')!;
    this.dyn = svg.querySelector('.dyn')!;
  }

  clear(): void {
    this.tl = null;
    this.boxes = [];
    this.cam = null;
    this.notePlace.clear();
    this.bg.innerHTML = '';
    this.dyn.innerHTML = '';
  }

  setTimeline(tl: Timeline): void {
    this.tl = tl;
    const st = tl.stage;
    this.svg.setAttribute('viewBox', `0 0 ${st.width} ${st.height}`);
    this.svg.dataset.stage = st.name;
    this.bg.innerHTML = st.background();
    this.boxes = tl.steps.map((step) => this.stepBox(step));
    this.cam = null;
    this.notePlace.clear();
  }

  /** Part of the stage worth showing during a step: everything that matters, padded. */
  private stepBox(step: StepAnim): Box {
    const st = this.tl!.stage;
    const pts: Vec[] = [];
    let full = false;
    for (const w of [step.before, step.after]) {
      for (const a of w.atoms.values()) if (!a.crowd) pts.push(a);
    }
    for (const id of step.focus) {
      for (const kf of step.tracks.get(id) ?? []) pts.push(kf);
      const a = step.after.atoms.get(id);
      if (a) pts.push(a);
    }
    for (const id of step.trails) for (const kf of step.tracks.get(id) ?? []) pts.push(kf);
    for (const fl of step.flows) pts.push(...fl.path);
    for (const n of step.notes) {
      const tg = n.target;
      if (tg.kind === 'point') {
        const r = Object.values(st.regions).find((g) => g.x + g.w / 2 === tg.p.x && g.y + g.h / 2 === tg.p.y);
        if (r) full = true;
        pts.push(tg.p);
      }
    }
    if (!pts.length || full) return { x: 0, y: 0, w: st.width, h: st.height };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    const pad = 0.12 * st.width;
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    let w = Math.max(x1 - x0, 0.5 * st.width);
    let h = Math.max(y1 - y0, 0.5 * st.height);
    const aspect = st.width / st.height;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    w = Math.min(w, st.width);
    h = Math.min(h, st.height);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return {
      x: clamp(cx - w / 2, 0, st.width - w),
      y: clamp(cy - h / 2, 0, st.height - h),
      w,
      h,
    };
  }

  /** Stretch a box to the element's shape; if it is wider/taller than the stage, centre the stage in it. */
  private fitToElement(b: Box): Box {
    const st = this.tl!.stage;
    const ew = this.svg.clientWidth;
    const eh = this.svg.clientHeight;
    if (!ew || !eh) return b;
    const aspect = ew / eh;
    let { w, h } = b;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const x = w >= st.width ? (st.width - w) / 2 : clamp(cx - w / 2, 0, st.width - w);
    const y = h >= st.height ? (st.height - h) / 2 : clamp(cy - h / 2, 0, st.height - h);
    return { x, y, w, h };
  }

  private updateCamera(k: number, dt: number): Box {
    const st = this.tl!.stage;
    const target = this.fitToElement(this.boxes[k] ?? { x: 0, y: 0, w: st.width, h: st.height });
    if (!this.cam || dt <= 0) this.cam = { ...target };
    else {
      const a = 1 - Math.exp(-dt * 3.2);
      this.cam = {
        x: lerp(this.cam.x, target.x, a),
        y: lerp(this.cam.y, target.y, a),
        w: lerp(this.cam.w, target.w, a),
        h: lerp(this.cam.h, target.h, a),
      };
    }
    const c = this.cam;
    this.svg.setAttribute('viewBox', `${f1(c.x)} ${f1(c.y)} ${f1(c.w)} ${f1(c.h)}`);
    return c;
  }

  /** k = step index, t = progress 0..1 inside that step. */
  draw(k: number, t: number, opt: DrawOptions): void {
    const tl = this.tl;
    if (!tl) return;
    const step = tl.steps[k] as StepAnim | undefined;
    const cam = this.updateCamera(k, opt.dt ?? 0);
    const out: string[] = [];

    // Which bonds/lone pairs exist at this moment.
    let topo: World;
    let chargeWorld: World;
    const after = step ? step.after : tl.initial;
    if (!step) {
      topo = tl.initial;
      chargeWorld = tl.initial;
    } else if (step.phase) {
      topo = t < step.phase.b0 ? step.before : t < step.phase.b1 ? step.mid : step.after;
      chargeWorld = t < step.phase.b1 ? step.before : step.after;
    } else {
      topo = t <= 0 ? step.before : step.after;
      chargeWorld = topo;
    }

    const atoms: Atom[] = [];
    for (const [id, a] of after.atoms) {
      const ta = topo.atoms.get(id);
      atoms.push(ta ?? a);
    }
    const bonds = [...topo.bonds.values()].filter((b) => b.order > 0);
    if (step) {
      // Molecules that appear in this step bring their own bonds.
      for (const b of step.after.bonds.values()) {
        if (step.appear.has(b.a) && !topo.bonds.has(`${b.a < b.b ? b.a : b.b}|${b.a < b.b ? b.b : b.a}`)) bonds.push(b);
      }
    }

    // Positions.
    const pos = new Map<string, Vec>();
    for (const a of atoms) {
      const tr = step?.tracks.get(a.id);
      pos.set(a.id, tr ? trackAt(tr, t) : { x: after.atoms.get(a.id)!.x, y: after.atoms.get(a.id)!.y });
    }

    // Thermal motion, molecule by molecule.
    if (opt.motion) {
      const parent = new Map<string, string>();
      const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r)!;
        parent.set(x, r);
        return r;
      };
      for (const a of atoms) parent.set(a.id, a.id);
      for (const b of bonds) {
        if (!parent.has(b.a) || !parent.has(b.b)) continue;
        const ra = find(b.a);
        const rb = find(b.b);
        if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
      }
      const comps = new Map<string, string[]>();
      for (const a of atoms) {
        const r = find(a.id);
        if (!comps.has(r)) comps.set(r, []);
        comps.get(r)!.push(a.id);
      }
      const moving = (id: string) => step && t > 0 && t < 1 && step.tracks.has(id);
      for (const [root, ids] of comps) {
        if (ids.some(moving)) continue;
        const c = centroid(ids.map((i) => pos.get(i)!));
        const temp = this.tempAt(c, step, t);
        const h = hashString(root);
        const amp = 1.3 * temp;
        const fq = 0.8 * Math.sqrt(temp);
        const ph1 = (h % 1000) / 159;
        const ph2 = ((h >> 10) % 1000) / 159;
        const off = {
          x: amp * Math.sin(opt.clock * fq * 6.283 + ph1),
          y: amp * Math.cos(opt.clock * fq * 1.13 * 6.283 + ph2),
        };
        for (const id of ids) pos.set(id, add(pos.get(id)!, off));
      }
    }

    const opacity = (id: string) => (step && step.appear.has(id) ? clamp(t / 0.18, 0, 1) : 1);
    const isCrowd = (a: Atom) => a.crowd && !(step && step.focus.has(a.id));

    // Trails of wandering particles.
    if (step) {
      for (const id of step.trails) {
        const tr = step.tracks.get(id);
        if (!tr) continue;
        const pts = tr.filter((kf) => kf.t <= t).map((kf) => ({ x: kf.x, y: kf.y }));
        if (pts.length < 1) continue;
        pts.push(pos.get(id) ?? pts[pts.length - 1]);
        out.push(`<polyline class="trail" points="${pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')}"/>`);
      }
      // Water flowing through pores.
      for (const fl of step.flows) {
        const u = clamp((t - fl.t0) / (fl.t1 - fl.t0), 0, 1);
        for (let i = 0; i < fl.count; i++) {
          const f = u * 1.45 - i * (0.75 / fl.count) * 1.2;
          if (f < 0 || f > 1) continue;
          const h = hashString(`${fl.seed}:${i}`);
          const lat = ((h % 100) / 100 - 0.5) * 34;
          const p0 = polyAt(fl.path, f);
          const p1 = polyAt(fl.path, Math.min(1, f + 0.005));
          const n = perp(norm(sub(p1, p0)));
          const p = add(p0, scale(n, lat));
          const ang = ((h >> 8) % 628) / 100 + f * 6;
          const a = clamp(Math.min(f, 1 - f) * 12, 0, 1) * 0.85;
          out.push(waterSvg(p, ang, a));
        }
      }
    }

    // Attractions between molecules (hydrogen bonds, ion–water).
    if (opt.lens.attract) out.push(this.attractions(atoms, pos, chargeWorld, topo));

    // Focus rings.
    if (step) {
      for (const id of step.focus) {
        const p = pos.get(id);
        const a = after.atoms.get(id);
        if (!p || !a) continue;
        out.push(`<circle class="focus" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(element(a.el).r + 7)}" opacity="${opacity(id)}"/>`);
      }
    }

    // Bonds.
    for (const b of bonds) {
      const pa = pos.get(b.a);
      const pb = pos.get(b.b);
      if (!pa || !pb) continue;
      const crowd = isCrowd(atoms.find((x) => x.id === b.a)!);
      const op = Math.min(opacity(b.a), opacity(b.b)) * (crowd ? 0.55 : 1);
      const fresh = step?.phase && t >= step.phase.b1 && !step.before.bonds.has(keyOf(b.a, b.b));
      const fade = fresh ? clamp((t - step!.phase!.b1) / 0.06, 0, 1) : 1;
      const n = perp(norm(sub(pb, pa)));
      const offs = b.order === 1 ? [0] : b.order === 2 ? [-3.6, 3.6] : [-5.5, 0, 5.5];
      for (const o of offs) {
        const q0 = add(pa, scale(n, o));
        const q1 = add(pb, scale(n, o));
        out.push(
          `<line class="bond${crowd ? ' crowd' : ''}" x1="${f1(q0.x)}" y1="${f1(q0.y)}" x2="${f1(q1.x)}" y2="${f1(q1.y)}" opacity="${f1(op * fade)}"/>`,
        );
      }
    }

    // Atoms.
    for (const a of atoms) {
      const p = pos.get(a.id)!;
      const e = element(a.el);
      const crowd = isCrowd(a);
      const op = opacity(a.id) * (crowd ? 0.55 : 1);
      out.push(
        `<circle class="atom${crowd ? ' crowd' : ''}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${e.r}" fill="${e.color}" opacity="${f1(op)}"/>`,
      );
      if (!crowd) {
        const size = a.el.length > 1 ? e.r * 0.92 : e.r * 1.08;
        out.push(
          `<text class="sym" x="${f1(p.x)}" y="${f1(p.y)}" dy="0.36em" font-size="${f1(size)}" fill="${e.ink}" opacity="${f1(op)}">${a.el}</text>`,
        );
      }
    }

    // Lone pairs.
    for (const a of atoms) {
      if (a.lp <= 0 || isCrowd(a)) continue;
      const p = pos.get(a.id)!;
      const dirs = bonds
        .filter((b) => b.a === a.id || b.b === a.id)
        .map((b) => {
          const q = pos.get(b.a === a.id ? b.b : b.a)!;
          return Math.atan2(q.y - p.y, q.x - p.x);
        });
      const r = element(a.el).r + 5.5;
      for (const ang of lonePairAngles(p, dirs, a.lp)) {
        const c = add(p, fromAngle(ang, r));
        const n = fromAngle(ang + Math.PI / 2, 3.3);
        out.push(dot(add(c, n), 'lp', opacity(a.id)), dot(sub(c, n), 'lp', opacity(a.id)));
      }
    }

    // Formal charges.
    if (opt.lens.charge) {
      for (const a of atoms) {
        const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
        const q = formalCharge(w, w.atoms.get(a.id)!);
        if (q === 0) continue;
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        const c = add(p, fromAngle(this.freeAngle(a, p, pos, bonds), r + 6));
        const txt = (Math.abs(q) > 1 ? String(Math.abs(q)) : '') + (q > 0 ? '+' : '−');
        out.push(
          `<g class="charge ${q > 0 ? 'pos' : 'neg'}" opacity="${f1(opacity(a.id))}"><circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${txt.length > 1 ? 9 : 7.5}"/><text x="${f1(c.x)}" y="${f1(c.y)}" dy="0.36em">${txt}</text></g>`,
        );
      }
    }

    // Tracking numbers.
    if (opt.lens.numbers) {
      for (const a of atoms) {
        if (!a.num) continue;
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        out.push(`<text class="num" x="${f1(p.x + r * 0.7)}" y="${f1(p.y + r + 10)}">${a.num}</text>`);
      }
    }

    // Electron arrows and electrons in flight.
    if (step && step.arrows.length && step.phase) {
      const alpha = t < 0.12 ? t / 0.12 : t < 0.8 ? 1 : clamp(1 - (t - 0.8) / 0.15, 0, 1);
      for (const ar of step.arrows) {
        if (alpha > 0) {
          const tip = ar.p1;
          const tan = qbezTangent(ar.p0, ar.c, ar.p1, 1);
          const nn = perp(tan);
          const base = sub(tip, scale(tan, 11));
          const head =
            ar.kind === 'pair'
              ? `${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * 5.5)},${f1(base.y + nn.y * 5.5)} ${f1(base.x - nn.x * 5.5)},${f1(base.y - nn.y * 5.5)}`
              : `${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * 6)},${f1(base.y + nn.y * 6)} ${f1(base.x)},${f1(base.y)}`;
          out.push(
            `<g class="arrow" opacity="${f1(alpha)}"><path d="M${f1(ar.p0.x)},${f1(ar.p0.y)} Q${f1(ar.c.x)},${f1(ar.c.y)} ${f1(base.x)},${f1(base.y)}"/><polygon points="${head}"/></g>`,
          );
        }
        const { b0, b1 } = step.phase;
        if (t >= b0 && t < b1) {
          const s = smooth((t - b0) / (b1 - b0));
          const p = qbez(ar.p0, ar.c, ar.p1, s);
          const tn = perp(qbezTangent(ar.p0, ar.c, ar.p1, s));
          if (ar.kind === 'pair') out.push(dot(add(p, scale(tn, 3.4)), 'e'), dot(sub(p, scale(tn, 3.4)), 'e'));
          else out.push(dot(p, 'e'));
        }
      }
    }

    // Notes. Box positions are chosen once per step from the still (end-of-step) picture,
    // then follow their target; choosing them every frame made them flicker.
    if (step) {
      const alpha = clamp(t / 0.1, 0, 1);
      const view = this.boxes[k] ?? cam;
      const nfs = view.w / 1000;
      const basePos = new Map<string, Vec>();
      for (const [id, a] of step.after.atoms) basePos.set(id, { x: a.x, y: a.y });
      const baseBonds = [...step.after.bonds.values()].filter((b) => b.order > 0);
      const baseAtoms = [...step.after.atoms.values()];
      const placed: Box[] = [];
      const obstacles = baseAtoms.filter((a) => !a.crowd).map((a) => ({ p: basePos.get(a.id)!, r: element(a.el).r + 6 }));
      step.notes.forEach((nt, i) => {
        const target = this.notePoint(nt.target, pos, bonds, atoms);
        if (!target) return;
        let rr = 0;
        if (nt.target.kind === 'atom') {
          const at = atoms.find((x) => x.id === (nt.target as { id: string }).id);
          if (at) rr = element(at.el).r;
        }
        const key = `${k}:${i}`;
        let off = this.notePlace.get(key);
        if (!off) {
          const base = this.notePoint(nt.target, basePos, baseBonds, baseAtoms) ?? target;
          let avoid: number | null = null;
          if (nt.target.kind === 'atom') {
            const at = step.after.atoms.get(nt.target.id);
            if (at && opt.lens.charge && formalCharge(step.after, at) !== 0) avoid = this.freeAngle(at, base, basePos, baseBonds);
          }
          const b = placeNote(base, nt.text, view, nfs, avoid, placed, obstacles);
          off = { dx: b.x - base.x, dy: b.y - base.y };
          this.notePlace.set(key, off);
        }
        const box = noteBox(nt.text, nfs);
        const bx = target.x + off.dx;
        const by = target.y + off.dy;
        placed.push({ x: bx, y: by, w: box.w, h: box.h });
        out.push(drawNote(target, nt.text, bx, by, nfs, alpha, rr));
      });
    }

    this.dyn.innerHTML = out.join('');
  }

  /** Direction around an atom that is clear of bonds and lone pairs (for the charge badge). */
  private freeAngle(a: Atom, p: Vec, pos: Map<string, Vec>, bonds: { a: string; b: string }[]): number {
    const taken = bonds
      .filter((b) => b.a === a.id || b.b === a.id)
      .map((b) => {
        const q = pos.get(b.a === a.id ? b.b : b.a)!;
        return Math.atan2(q.y - p.y, q.x - p.x);
      });
    taken.push(...lonePairAngles(p, [...taken], a.lp));
    const pref = -Math.PI / 4;
    let best = pref;
    let bestScore = -Infinity;
    for (let i = 0; i < 24; i++) {
      const ang = pref + (i * Math.PI) / 12;
      let gap = Math.PI;
      for (const t of taken) {
        const d = Math.abs(Math.atan2(Math.sin(ang - t), Math.cos(ang - t)));
        gap = Math.min(gap, d);
      }
      const score = gap - 0.08 * Math.abs(Math.atan2(Math.sin(ang - pref), Math.cos(ang - pref)));
      if (score > bestScore) {
        bestScore = score;
        best = ang;
      }
    }
    return best;
  }

  private tempAt(p: Vec, step: StepAnim | undefined, t: number): number {
    const tl = this.tl!;
    const w0 = step ? step.before : tl.initial;
    const w1 = step ? step.after : tl.initial;
    for (const r of Object.values(tl.stage.regions)) {
      if (!inRegion(r, p)) continue;
      const a = w0.temp[r.name];
      const b = w1.temp[r.name];
      if (a === undefined && b === undefined) continue;
      return lerp(a ?? 1, b ?? 1, smooth(t));
    }
    return 1;
  }

  private attractions(atoms: Atom[], pos: Map<string, Vec>, w: World, topo: World): string {
    // δ+ ends: H on O/N/F, and cations. δ− ends: O/N/F with lone pairs, and anions.
    const owner = new Map<string, string>();
    const nbs = new Map<string, string[]>();
    for (const b of topo.bonds.values()) {
      if (b.order <= 0) continue;
      if (!nbs.has(b.a)) nbs.set(b.a, []);
      if (!nbs.has(b.b)) nbs.set(b.b, []);
      nbs.get(b.a)!.push(b.b);
      nbs.get(b.b)!.push(b.a);
    }
    // Molecule membership via flood fill.
    const seen = new Set<string>();
    for (const a of atoms) {
      if (seen.has(a.id)) continue;
      const stack = [a.id];
      seen.add(a.id);
      while (stack.length) {
        const c = stack.pop()!;
        owner.set(c, a.id);
        for (const n of nbs.get(c) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
      }
    }
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const plus: Atom[] = [];
    const minus: Atom[] = [];
    for (const a of atoms) {
      const ww = w.atoms.has(a.id) ? w : topo;
      const q = ww.atoms.has(a.id) ? formalCharge(ww, ww.atoms.get(a.id)!) : 0;
      const ns = nbs.get(a.id) ?? [];
      if (a.el === 'H' && ns.length === 1 && ['O', 'N', 'F'].includes(byId.get(ns[0])?.el ?? '')) plus.push(a);
      else if (q > 0 && ns.length === 0) plus.push(a);
      if ((['O', 'N', 'F'].includes(a.el) && a.lp > 0) || (q < 0 && ns.length === 0)) minus.push(a);
    }
    let s = '';
    for (const p of plus) {
      const pp = pos.get(p.id)!;
      for (const m of minus) {
        if (owner.get(p.id) === owner.get(m.id)) continue;
        const pm = pos.get(m.id)!;
        const d = dist(pp, pm);
        const ion = p.el !== 'H' || (nbs.get(m.id) ?? []).length === 0;
        const cutoff = ion ? element(p.el).r + element(m.el).r + 26 : bondLength('O', 'H') * 1.95;
        if (d > cutoff || d < 4) continue;
        const u = norm(sub(pm, pp));
        const a0 = add(pp, scale(u, element(p.el).r + 1));
        const a1 = sub(pm, scale(u, element(m.el).r + 1));
        s += `<line class="attract" x1="${f1(a0.x)}" y1="${f1(a0.y)}" x2="${f1(a1.x)}" y2="${f1(a1.y)}"/>`;
      }
    }
    return s;
  }

  private notePoint(
    tg: NoteTarget,
    pos: Map<string, Vec>,
    bonds: { a: string; b: string; order: number }[],
    atoms: Atom[],
  ): Vec | null {
    switch (tg.kind) {
      case 'atom':
        return pos.get(tg.id) ?? null;
      case 'bond': {
        const a = pos.get(tg.a);
        const b = pos.get(tg.b);
        return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
      }
      case 'lp': {
        const p = pos.get(tg.id);
        const at = atoms.find((x) => x.id === tg.id);
        if (!p || !at) return null;
        const dirs = bonds
          .filter((b) => b.a === tg.id || b.b === tg.id)
          .map((b) => {
            const q = pos.get(b.a === tg.id ? b.b : b.a)!;
            return Math.atan2(q.y - p.y, q.x - p.x);
          });
        const angs = lonePairAngles(p, dirs, Math.max(1, at.lp));
        const up = -Math.PI / 2;
        // Two lone pairs often sit symmetrically about "up"; round the score so floating-point noise
        // from thermal motion cannot flip the choice between them from frame to frame.
        const score = (a: number) => Math.round(Math.abs(Math.sin((a - up) / 2)) * 1e4);
        const best = [...angs].sort((p2, q2) => score(p2) - score(q2) || Math.cos(q2) - Math.cos(p2))[0];
        return add(p, fromAngle(best, element(at.el).r + 6));
      }
      case 'group': {
        const ps = tg.ids.map((i) => pos.get(i)).filter(Boolean) as Vec[];
        return ps.length ? centroid(ps) : null;
      }
      case 'point':
        return tg.p;
    }
  }
}

function keyOf(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function dot(p: Vec, cls: string, op = 1): string {
  return `<circle class="${cls}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${cls === 'e' ? 2.9 : 2.2}" opacity="${f1(op)}"/>`;
}

function waterSvg(p: Vec, ang: number, alpha: number): string {
  const l = bondLength('O', 'H');
  const h1 = add(p, fromAngle(ang - deg(52.25), l));
  const h2 = add(p, fromAngle(ang + deg(52.25), l));
  const O = element('O');
  const H = element('H');
  return (
    `<g class="flow" opacity="${f1(alpha)}">` +
    `<line class="bond crowd" x1="${f1(p.x)}" y1="${f1(p.y)}" x2="${f1(h1.x)}" y2="${f1(h1.y)}"/>` +
    `<line class="bond crowd" x1="${f1(p.x)}" y1="${f1(p.y)}" x2="${f1(h2.x)}" y2="${f1(h2.y)}"/>` +
    `<circle class="atom crowd" cx="${f1(h1.x)}" cy="${f1(h1.y)}" r="${H.r}" fill="${H.color}"/>` +
    `<circle class="atom crowd" cx="${f1(h2.x)}" cy="${f1(h2.y)}" r="${H.r}" fill="${H.color}"/>` +
    `<circle class="atom crowd" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${O.r}" fill="${O.color}"/>` +
    `</g>`
  );
}

function overlap(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0x1100 ? size * 0.98 : size * 0.58;
  return w;
}

function noteBox(text: string, fs: number): { w: number; h: number; size: number; lines: string[] } {
  const size = 17 * fs;
  const lines = wrapText(text, 15);
  const w = Math.max(...lines.map((l) => textWidth(l, size))) + 22 * fs;
  const h = lines.length * size * 1.35 + 14 * fs;
  return { w, h, size, lines };
}

/** Pick a spot for a note box near its target, clear of other notes, molecules and the charge badge. */
function placeNote(
  target: Vec,
  text: string,
  view: Box,
  fs: number,
  avoid: number | null,
  placed: Box[],
  obstacles: { p: Vec; r: number }[],
): Box {
  const { w, h } = noteBox(text, fs);
  const dirs: Vec[] = [
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  let best: { bx: number; by: number; score: number } | null = null;
  for (const off of [70 * fs, 120 * fs, 175 * fs]) {
    dirs.forEach((d, k) => {
      let bx = target.x + d.x * off - (d.x < 0 ? w : 0);
      let by = target.y + d.y * off - (d.y < 0 ? h : 0);
      bx = clamp(bx, view.x + 8 * fs, view.x + view.w - w - 8 * fs);
      by = clamp(by, view.y + 8 * fs, view.y + view.h - h - 8 * fs);
      let score = off * 0.02 + k * 0.5;
      for (const b of placed) score += overlap({ x: bx - 6, y: by - 6, w: w + 12, h: h + 12 }, b) / 40;
      for (const o of obstacles) {
        const cx = clamp(o.p.x, bx, bx + w);
        const cy = clamp(o.p.y, by, by + h);
        // Margin keeps borderline cases decided the same way every time.
        if (Math.hypot(cx - o.p.x, cy - o.p.y) < o.r + 8) score += 60;
      }
      if (avoid !== null) {
        const a = Math.atan2(d.y, d.x);
        if (Math.abs(Math.atan2(Math.sin(a - avoid), Math.cos(a - avoid))) < 0.9) score += 30;
      }
      if (!best || score < best.score - 1e-6) best = { bx, by, score };
    });
  }
  const b = best!;
  return { x: b.bx, y: b.by, w, h };
}

function drawNote(target: Vec, text: string, bx: number, by: number, fs: number, alpha: number, edge = 0): string {
  const { w, h, size, lines } = noteBox(text, fs);
  const anchor = { x: clamp(target.x, bx, bx + w), y: clamp(target.y, by, by + h) };
  const tip = edge > 0 ? add(target, scale(norm(sub(anchor, target)), edge + 2)) : target;
  let s = `<g class="note" opacity="${f1(alpha)}">`;
  s += `<line x1="${f1(tip.x)}" y1="${f1(tip.y)}" x2="${f1(anchor.x)}" y2="${f1(anchor.y)}"/>`;
  s += `<circle class="note-dot" cx="${f1(tip.x)}" cy="${f1(tip.y)}" r="${f1(3.5 * fs)}"/>`;
  s += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(8 * fs)}"/>`;
  lines.forEach((l, k) => {
    s += `<text x="${f1(bx + 11 * fs)}" y="${f1(by + 7 * fs + size * (k + 1) * 1.2)}" font-size="${f1(size)}">${esc(l)}</text>`;
  });
  return s + '</g>';
}

/** Wraps Korean/English text to roughly `max` wide characters per line. */
function wrapText(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  const width = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x1100 ? 1 : 0.6), 0);
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (width(next) > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
