/**
 * Draws one moment of a timeline into an SVG element: atoms, bonds, lone
 * pairs, charges, electron arrows, moving electrons, notes and so on.
 */
import { bondLength, element } from '../chem/elements';
import { electronDomains, lonePairAngles } from '../chem/geometry';
import { plateSlot, tallyBox, type ArrowAnim, type Keyframe, type NoteTarget, type StepAnim, type Timeline } from '../engine/timeline';
import { component, formalCharge, oxidationState, type Atom, type Lens, type World } from '../engine/world';
import { inRegion } from '../stage/stages';
import {
  add,
  centroid,
  clamp,
  deg,
  dist,
  fromAngle,
  lerp,
  lerpV,
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
import { blendDomains, bystanders, chargeOn, drawPairs, drawSolids, stableDomains, stableFreeAngle } from './pairs';

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
  /**
   * How electrons are drawn. 'lines' (the default): bonds as lines, moving electrons along curved
   * arrows. 'pairs': every electron pair as a pouch that lets go of an atom or takes hold of one.
   */
  style?: 'lines' | 'pairs';
  /**
   * How atoms and charge look. 'color': each element its own colour, charges as small badges.
   * 'glow': atoms without colour (symbol and size tell them apart), and charge as light around
   * the atom: red where electrons are short, blue where there are more of them.
   */
  look?: 'color' | 'glow';
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
  /** The molecules each step is about: framed by the camera, drawn clearly while the rest steps back. */
  private actors: Set<string>[] = [];
  private cam: Box | null = null;
  /** The scene shows many molecules colliding (collective mode): electrons are left out of the drawing. */
  private collective = false;
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
    this.actors = [];
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
    this.collective = tl.steps.some((s) => s.tally.length > 0);
    this.actors = tl.steps.map((step) => stepActors(step));
    this.boxes = tl.steps.map((step, k) => this.stepBox(step, this.actors[k]));
    this.cam = null;
    this.notePlace.clear();
  }

  /**
   * Part of the stage a step is shown in: the molecules it is about, close up, so that their
   * electrons and bonds are big enough to read (on a phone too). Steps about nothing in
   * particular show every named molecule.
   */
  private stepBox(step: StepAnim, actors: Set<string>): Box {
    const st = this.tl!.stage;
    const pts: Vec[] = [];
    let full = false;
    // The step's molecules where they start and where they end; helpers that only come to them
    // (water molecules joining an ion) only where they end, so a far start does not widen the view.
    const core = new Set<string>();
    for (const w of [step.before, step.after]) for (const id of step.focus) if (w.atoms.has(id)) for (const x of component(w, id)) core.add(x);
    for (const w of [step.before, step.after]) {
      for (const a of w.atoms.values()) {
        if (!actors.size) {
          if (!a.crowd) pts.push(a);
        } else if (core.has(a.id) || (w === step.after && actors.has(a.id))) pts.push(a);
      }
    }
    for (const id of step.focus) {
      for (const kf of step.tracks.get(id) ?? []) pts.push(kf);
      const a = step.after.atoms.get(id);
      if (a) pts.push(a);
    }
    for (const id of step.trails) for (const kf of step.tracks.get(id) ?? []) pts.push(kf);
    for (const fl of step.flows) pts.push(...fl.path);
    for (const ph of step.photons) pts.push(ph.p0, ph.p1);
    for (const wr of step.wires) pts.push(...wr.path);
    // Electrons that go between an atom and an electrode: keep the place they are kept in view,
    // so that they do not fly out of the picture.
    for (const ar of step.arrows) {
      const e = ar.free && st.electrodes?.[ar.free.plate];
      if (e) pts.push(plateSlot(e, ar.free!.slot));
    }
    for (const n of step.notes) {
      const tg = n.target;
      if (tg.kind === 'point') {
        const r = Object.values(st.regions).find((g) => g.x + g.w / 2 === tg.p.x && g.y + g.h / 2 === tg.p.y);
        if (r) full = true;
        pts.push(tg.p);
      }
    }
    // Collective mode: molecules fly all over, so show the whole stage.
    if (step.tally.length) full = true;
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
    // Room around the molecules for their electrons, charges and notes.
    const pad = 0.07 * st.width + (step.notes.length ? 0.06 * st.width : 0);
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    // Only the molecules' own extent (with a minimum); the shape of the screen is matched later
    // (fitToElement), so a tall phone screen is not first widened to the stage's landscape shape.
    let w = Math.max(x1 - x0, 0.3 * st.width);
    let h = Math.max(y1 - y0, 0.3 * st.height);
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

  /**
   * The camera moves from the previous step's view to this one's at the very start of the step and
   * holds still before anything changes, so the change itself is never mixed up with camera motion.
   * It depends only on (k, t): scrubbing shows exactly what playing shows.
   */
  private updateCamera(k: number, t: number): Box {
    const st = this.tl!.stage;
    const whole = { x: 0, y: 0, w: st.width, h: st.height };
    const to = this.fitToElement(this.boxes[k] ?? whole);
    const from = this.fitToElement(this.boxes[k - 1] ?? this.boxes[k] ?? whole);
    const u = smooth(clamp(t / this.settleTime(k), 0, 1));
    this.cam = { x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u), w: lerp(from.w, to.w, u), h: lerp(from.h, to.h, u) };
    const c = this.cam;
    this.svg.setAttribute('viewBox', `${f1(c.x)} ${f1(c.y)} ${f1(c.w)} ${f1(c.h)}`);
    return c;
  }

  /** How long into a step the camera and the stepping back of the other molecules take. */
  private settleTime(k: number): number {
    const ph = this.tl?.steps[k]?.phase;
    return ph && ph.b0 > 0.05 ? Math.min(ph.b0, 0.22) : 0.16;
  }

  /** k = step index, t = progress 0..1 inside that step. */
  draw(k: number, t: number, opt: DrawOptions): void {
    const tl = this.tl;
    if (!tl) return;
    const step = tl.steps[k] as StepAnim | undefined;
    const cam = this.updateCamera(k, t);
    const out: string[] = [];
    // On a small screen the whole scene shrinks with the stage, and an electron would end up
    // a pixel or two across. Moving electrons keep a size you can see instead.
    const ew = this.svg.clientWidth;
    const ppu = ew ? Math.min(ew / cam.w, this.svg.clientHeight / cam.h) : 1;
    eScale = clamp(0.95 / ppu, 1, 2.6);

    // The change window. Until w0 what is about to change is marked where it is; between w0 and
    // w1 everything changes together (electrons travel, bonds grow or shrink, lone pairs and
    // charges turn over, atoms glide); after w1 the result holds.
    const ph = step?.phase ?? null;
    const w0 = ph ? ph.b0 : 0.1;
    const w1 = ph ? Math.max(ph.b0, ph.b1) : 0.8;
    const evented = !!step && step.events.length > 0;
    const pre = !!step && !evented && t < w0;
    const during = !!step && !evented && t >= w0 && t < w1;
    const post = !!step && !evented && t >= w1;
    const c1 = ph?.c1 ?? 1;
    const settle = post ? smooth(clamp((t - w1) / Math.max(0.05, c1 - w1), 0, 1)) : 0;
    const prog = !step ? 1 : w1 > w0 ? smooth(clamp((t - w0) / (w1 - w0), 0, 1)) : t >= w0 ? 1 : 0;
    const cue = pre && w0 > 0 ? smooth(clamp(t / w0, 0, 1)) : 0;

    // Which bonds/lone pairs exist at this moment.
    let topo: World;
    let chargeWorld: World;
    const after = step ? step.after : tl.initial;
    if (!step) {
      topo = tl.initial;
      chargeWorld = tl.initial;
    } else if (!evented) {
      topo = pre ? step.before : during ? step.mid : step.after;
      chargeWorld = pre || (during && prog < 0.5) ? step.before : step.after;
    } else if (t > 0 && t < 1) {
      // Collective mode: bonds break and form one collision at a time.
      const m = new Map(step.before.bonds);
      for (const e of step.events) {
        if (e.t > t) break;
        const key = keyOf(e.a, e.b);
        if (e.order > 0) m.set(key, { a: e.a, b: e.b, order: e.order });
        else m.delete(key);
      }
      topo = { ...step.before, bonds: m };
      chargeWorld = topo;
    } else {
      topo = t <= 0 ? step.before : step.after;
      chargeWorld = topo;
    }
    // Bonds that steer lone pairs and charge badges: during the change, the bonds being made.
    const dirWorld = during ? after : topo;

    const atoms: Atom[] = [];
    for (const [id, a] of after.atoms) {
      // Used-up atoms fade out in their step and are gone afterwards.
      if (a.gone && (!step || step.before.atoms.get(id)?.gone)) continue;
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

    // Positions before thermal motion: used to decide which attractions exist, so that the
    // decorative jiggle alone never makes a line appear or vanish.
    const basePos = new Map(pos);

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

    // Molecules the step is not about step back (fainter), so the ones that change stand out;
    // between steps this hands over smoothly from the previous step's molecules to this one's.
    const nowActors = this.actors[k];
    const prevActors = this.actors[k - 1] ?? nowActors;
    const hand = step ? smooth(clamp(t / this.settleTime(k), 0, 1)) : 1;
    const back = (set: Set<string> | undefined, id: string) => (set && set.size && !set.has(id) ? 0.38 : 1);
    const presence = (id: string) => lerp(back(prevActors, id), back(nowActors, id), hand);
    const opacity = (id: string) => {
      const p = presence(id);
      if (step && after.atoms.get(id)?.gone) return p * clamp((0.86 - t) / 0.26, 0, 1);
      return p * (step && step.appear.has(id) ? clamp(t / 0.18, 0, 1) : 1);
    };
    // Water molecules around an ion (a hydration shell) move with it, so they are drawn as
    // clearly as the ion; otherwise they would look like stray water being dragged along.
    const shell = new Set<string>();
    for (const list of after.attached.values()) {
      for (const id of list) if (after.atoms.has(id)) for (const x of component(after, id)) shell.add(x);
    }
    const isCrowd = (a: Atom) => a.crowd && !shell.has(a.id) && !(step && step.focus.has(a.id));

    // Vapour bubbles (boiling): grow in place, rise, burst at the surface.
    for (const b of step?.bubbles ?? []) {
      const u = clamp((t - b.t0) / (b.t1 - b.t0), 0, 1);
      const fade = t <= b.t1 ? 1 : clamp(1 - (t - b.t1) / 0.12, 0, 1);
      if (t <= b.t0 || fade <= 0) continue;
      const grow = clamp(u / 0.3, 0, 1);
      const rise = clamp((u - 0.3) / 0.7, 0, 1);
      const p = lerpV(b.p0, b.p1, smooth(rise));
      out.push(`<circle class="bubble" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(6 + (b.r - 6) * grow)}" opacity="${f1(fade)}"/>`);
    }

    // Membrane proteins (drawn under the molecules that pass through them).
    if (tl.stage.membrane) {
      const mb = tl.stage.membrane;
      for (const p of after.proteins) {
        const y0 = mb.y0 - 22;
        const h = mb.y1 - mb.y0 + 44;
        if (p.kind === 'channel' || p.kind === 'synthase') {
          // Two halves with a pore between them.
          const cls = p.kind === 'synthase' ? 'protein synthase' : 'protein';
          out.push(`<rect class="${cls}" x="${f1(p.x - 36)}" y="${f1(y0)}" width="26" height="${f1(h)}" rx="11"/>`);
          out.push(`<rect class="${cls}" x="${f1(p.x + 10)}" y="${f1(y0)}" width="26" height="${f1(h)}" rx="11"/>`);
          if (p.kind === 'synthase') {
            // ATP synthase: a stalk and a round head on the inner side, where ATP is made.
            out.push(`<rect class="${cls}" x="${f1(p.x - 7)}" y="${f1(y0 + h - 4)}" width="14" height="30" rx="5"/>`);
            out.push(`<circle class="${cls} head" cx="${f1(p.x)}" cy="${f1(y0 + h + 52)}" r="34"/>`);
          }
        } else {
          out.push(`<rect class="protein pump" x="${f1(p.x - 44)}" y="${f1(y0 - 6)}" width="88" height="${f1(h + 12)}" rx="22"/>`);
          out.push(`<line class="pore" x1="${f1(p.x)}" y1="${f1(y0)}" x2="${f1(p.x)}" y2="${f1(y0 + h)}"/>`);
        }
      }
    }

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

    // The film (SEI) on a battery's graphite: lithium and used-up electrolyte locked together.
    for (const a of atoms) {
      if (!after.atoms.get(a.id)?.sei) continue;
      const p = pos.get(a.id)!;
      const was = step?.before.atoms.get(a.id);
      const old = was ? !!was.sei : true;
      const alpha = old ? 1 : clamp((t - 0.78) / 0.18, 0, 1);
      if (alpha <= 0) continue;
      out.push(`<circle class="sei" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(element(a.el).r + 20)}" opacity="${f1(alpha)}"/>`);
    }

    // Attractions between molecules (hydrogen bonds, ion–water).
    if (opt.lens.attract) out.push(this.attractions(atoms, pos, basePos, chargeWorld, topo));

    // Focus rings.
    if (step) {
      // Collective mode: a short ring where a collision has just made new bonds.
      for (const e of step.events) {
        if (e.order <= 0) continue;
        const since = (t - e.t) * step.duration;
        if (since < 0) break;
        if (since > 0.5) continue;
        const pa = pos.get(e.a);
        const pb = pos.get(e.b);
        if (!pa || !pb) continue;
        const c = lerpV(pa, pb, 0.5);
        const q = since / 0.5;
        out.push(`<circle class="spark" cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(14 + 26 * q)}" opacity="${f1(0.9 * (1 - q))}"/>`);
      }
    }

    // Bonds. Outside the change they are drawn as they are; inside it, a bond that is made or
    // broken grows or shrinks while it happens (see drawBonds).
    const frac = !step ? 1 : w1 > w0 ? clamp((t - w0) / (w1 - w0), 0, 1) : t >= w0 ? 1 : 0;
    const win = { pre, during, post, settle, prog, cue, frac };
    if (this.svg.dataset.style !== (opt.style ?? 'lines')) this.svg.dataset.style = opt.style ?? 'lines';
    const glow = opt.look === 'glow';
    if (this.svg.dataset.look !== (opt.look ?? 'color')) this.svg.dataset.look = opt.look ?? 'color';
    // Where electrons are the subject (a scene with reactions), the solvent steps back to one quiet
    // colour. Where the solvent itself is the subject (evaporation, ice), it keeps its colours.
    const quiet = tl.steps.some((s) => s.arrows.length > 0 || !!s.shifts?.length) ? 'quiet' : 'plain';
    if (this.svg.dataset.crowd !== quiet) this.svg.dataset.crowd = quiet;
    const pairs = opt.style === 'pairs' ? drawPairs({ step, win, topo, after, atoms, pos, isCrowd, opacity, eScale, t, electrodes: tl.stage.electrodes, simple: this.collective, aside: bystanders(tl) }) : null;
    if (pairs) out.push(...drawSolids(step?.before ?? topo, step ? after : topo, pos, !step ? 1 : pre ? 0 : during ? prog : 1, (n) => !!tl.stage.electrodes?.[n]));
    // Charge as light: under the atoms and their electrons, so that it reads as something the
    // place has rather than a thing of its own. While charges change, the light changes with them.
    if (glow) {
      const turn = smooth(clamp((prog - 0.4) / 0.6, 0, 1));
      const lights: string[] = [];
      for (const a of atoms) {
        if (a.crowd) continue;
        let q: number;
        const b0 = step?.before.atoms.get(a.id);
        const z0 = after.atoms.get(a.id);
        if (during && step && b0 && z0) {
          const stepped = pairs?.charges?.get(a.id);
          const qa = chargeOn(after, z0);
          const qb = chargeOn(step.before, b0);
          // An atom whose electrons leave or arrive one at a time: its light steps with them.
          q = stepped !== undefined ? stepped + (qa - formalCharge(after, z0)) : qb + (qa - qb) * turn;
        } else {
          const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
          q = chargeOn(w, w.atoms.get(a.id)!);
        }
        const mag = Math.abs(q);
        if (mag < 0.09) continue;
        const p = pos.get(a.id)!;
        const r = element(a.el).r + 9 + 15 * Math.pow(Math.min(mag, 2), 0.7);
        const op = clamp(0.2 + 0.62 * mag, 0, 0.95) * opacity(a.id);
        lights.push(`<circle class="glow ${q > 0 ? 'pos' : 'neg'}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}" opacity="${op.toFixed(2)}"/>`);
      }
      if (lights.length) {
        out.push(
          '<defs><radialGradient id="glow-pos"><stop offset="0.25" stop-color="#ff4b3e" stop-opacity="0.95"/><stop offset="1" stop-color="#ff4b3e" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="glow-neg"><stop offset="0.25" stop-color="#2f7df6" stop-opacity="0.95"/><stop offset="1" stop-color="#2f7df6" stop-opacity="0"/></radialGradient></defs>',
          ...lights,
        );
      }
    }
    if (pairs) out.push(...pairs.under);
    else out.push(...this.drawBonds(step, t, win, bonds, pos, atoms, isCrowd, opacity));
    // Moving electrons: marked where they are before the change, then carried as the tip of the
    // bond they leave or make. The pieces of bond they drag go under the atoms, the electrons over.
    const moving = step && step.arrows.length ? this.drawElectrons(step, win, pos, !!pairs) : { under: [], over: [] };
    out.push(...moving.under);

    // Atoms.
    for (const a of atoms) {
      const p = pos.get(a.id)!;
      const e = element(a.el);
      const crowd = isCrowd(a);
      const op = opacity(a.id) * (crowd ? 0.55 : 1);
      out.push(
        `<circle class="atom${crowd ? ' crowd' : ''}"${crowd ? '' : ` data-id="${a.id}"`} cx="${f1(p.x)}" cy="${f1(p.y)}" r="${e.r}" fill="${e.color}" opacity="${f1(op)}"/>`,
      );
      if (!crowd) {
        const size = a.el.length > 1 ? e.r * 0.92 : e.r * 1.08;
        out.push(
          `<text class="sym" x="${f1(p.x)}" y="${f1(p.y)}" dy="0.36em" font-size="${f1(size)}" fill="${e.ink}" opacity="${f1(op)}">${a.el}</text>`,
        );
      }
    }

    // Non-bonding electrons: lone pairs as two dots, unpaired electrons as one.
    // (Not for atoms inside a metal electrode: their outer electrons belong to the whole metal.)
    // Electrons on their way between atoms are drawn by drawElectrons; electrons that change
    // without being carried there (a net reaction) fade from the old count to the new one.
    const carriedTo = new Set<string>();
    for (const ar of step?.arrows ?? []) if (ar.dst?.kind === 'atom') carriedTo.add(ar.dst.a);
    for (const a of atoms) {
      if (pairs || isCrowd(a) || a.lattice) continue;
      const p = pos.get(a.id)!;
      if (during && step) {
        const m = step.mid.atoms.get(a.id) ?? a;
        const z = after.atoms.get(a.id) ?? a;
        const same = m.lp === z.lp && m.rad === z.rad && (m.skip ?? 0) === (z.skip ?? 0);
        if (same || carriedTo.has(a.id)) {
          // The electrons it keeps turn from where they were to where the new bonds leave room.
          const to = stableDomains(after, a.id, pos, m);
          const mix = step.before.atoms.has(a.id) && after.atoms.has(a.id) ? blendDomains(stableDomains(step.before, a.id, pos), to, smooth(clamp(prog / 0.45, 0, 1))) : null;
          out.push(...this.domainDots(after, m, p, pos, opacity(a.id), mix ?? undefined));
        } else {
          const had = step.before.atoms.has(a.id) && step.mid.atoms.has(a.id) ? blendDomains(stableDomains(step.before, a.id, pos), stableDomains(step.mid, a.id, pos, m), smooth(clamp(prog / 0.45, 0, 1))) : null;
          out.push(...this.domainDots(step.mid, m, p, pos, opacity(a.id) * (1 - prog), had ?? undefined));
          out.push(...this.domainDots(after, z, p, pos, opacity(a.id) * prog));
        }
      } else out.push(...this.domainDots(dirWorld, a, p, pos, opacity(a.id)));
    }

    // Formal charges.
    // While electrons move, the old charge fades out and the new one in, in step with them.
    if (opt.lens.charge) {
      const turn = smooth(clamp((prog - 0.4) / 0.6, 0, 1));
      for (const a of atoms) {
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        const keepOff = [...(pairs?.avoid?.get(a.id) ?? []), ...this.touching(after, a.id)];
        // Where the badge sits: decided once from the world's own coordinates and turned with the
        // molecule, so that it does not hop about.
        const at = (w: World, sweep = true) => {
          let ang = stableFreeAngle(w, a.id, pos, keepOff);
          if (sweep && during && step && step.before.atoms.has(a.id) && after.atoms.has(a.id)) {
            // While the atom's surroundings change, the badge goes round from its old place to its new one.
            const from = stableFreeAngle(step.before, a.id, pos, keepOff);
            const to = stableFreeAngle(after, a.id, pos, keepOff);
            let d = to - from;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            ang = from + d * prog;
          }
          return add(p, fromAngle(ang, r + 6));
        };
        const badge = (q: number, op: number, c: Vec) => {
          if (q === 0 || op <= 0.01) return;
          const txt = (Math.abs(q) > 1 ? String(Math.abs(q)) : '') + (q > 0 ? '+' : '−');
          out.push(
            `<g class="charge ${q > 0 ? 'pos' : 'neg'}" data-a="${a.id}" opacity="${f1(op)}"><circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${txt.length > 1 ? 9 : 7.5}"/><text x="${f1(c.x)}" y="${f1(c.y)}" dy="0.36em">${txt}</text></g>`,
          );
        };
        if (during && step && pairs?.charges?.has(a.id)) {
          // An atom that gives up or gains electrons one at a time: its charge steps with each of them.
          badge(pairs.charges.get(a.id)!, opacity(a.id), at(step.before.atoms.has(a.id) ? step.before : after));
          continue;
        }
        if (during && step) {
          const b0 = step.before.atoms.get(a.id);
          const qa = formalCharge(after, after.atoms.get(a.id)!);
          const qb = b0 ? formalCharge(step.before, b0) : qa;
          if (qa === qb) badge(qa, opacity(a.id), at(after));
          else {
            // A charge that changes: the old badge fades where it was and the new one comes up in
            // its own place. Neither travels round the atom, across the electron pairs that are moving.
            badge(qb, opacity(a.id) * (1 - turn), at(b0 ? step.before : after, false));
            badge(qa, opacity(a.id) * turn, at(after, false));
          }
          continue;
        }
        const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
        badge(formalCharge(w, w.atoms.get(a.id)!), opacity(a.id), at(w));
      }
    }

    // Oxidation states (small signed numbers beside the atom, clear of the charge badge).
    if (opt.lens.oxidation) {
      for (const a of atoms) {
        // Electrode metal is all 0; labelling every atom of the plate only adds noise.
        // ('pairs' style: nor is the solvent labelled, shell around an ion or not.)
        if (isCrowd(a) || a.lattice || (pairs && a.crowd)) continue;
        const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
        const wa = w.atoms.get(a.id)!;
        let ox = oxidationState(w, wa);
        let q = formalCharge(w, wa);
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        // An atom whose electrons leave or arrive one at a time: its number steps with them, like its charge.
        const stepped = during && step ? pairs?.charges?.get(a.id) : undefined;
        const b0 = step?.before.atoms.get(a.id);
        if (stepped !== undefined && b0) {
          ox = oxidationState(step!.before, b0) + (stepped - formalCharge(step!.before, b0));
          q = stepped;
        }
        const keep = pairs?.avoid?.get(a.id) ?? [];
        const extra: number[] = [...keep];
        if (opt.lens.charge && q !== 0) extra.push(stableFreeAngle(w, a.id, pos, keep));
        const ang = stableFreeAngle(w, a.id, pos, extra, Math.PI / 4);
        const c = add(p, fromAngle(ang, r + 9));
        const txt = ox > 0 ? `+${ox}` : ox < 0 ? `−${-ox}` : '0';
        out.push(`<text class="ox" x="${f1(c.x)}" y="${f1(c.y)}" dy="0.35em" opacity="${f1(opacity(a.id))}">${txt}</text>`);
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

    // The electrons themselves, over the atoms.
    out.push(...moving.over);
    if (pairs) out.push(...pairs.over);

    // Electrode stage: electrons waiting in each plate, and electrons running through the wire.
    if (tl.stage.electrodes) {
      const plateWorld = step && step.phase && t < step.phase.b1 ? step.before : after;
      let counts: Record<string, number> = plateWorld.plate;
      if (pairs && step) {
        // 'pairs' style: an electron is in the plate exactly while it is neither on its way there nor gone from it.
        counts = { ...step.before.plate };
        for (const [name, d] of pairs.plate ?? []) counts[name] = (counts[name] ?? 0) + d;
        for (const wf of step.wires) {
          if (!wf.from || !wf.to) continue;
          const u = clamp((t - wf.t0) / (wf.t1 - wf.t0), 0, 1);
          const gap = Math.min(0.12, 0.6 / wf.count);
          for (let i = 0; i < wf.count; i++) {
            const f = clamp((u - i * gap) / (1 - (wf.count - 1) * gap), 0, 1);
            if (f > 0) counts[wf.from] = (counts[wf.from] ?? 0) - 1;
            if (f >= 1) counts[wf.to] = (counts[wf.to] ?? 0) + 1;
          }
        }
      }
      for (const [name, e] of Object.entries(tl.stage.electrodes)) {
        const n = Math.min(12, counts[name] ?? 0);
        for (let i = 0; i < n; i++) out.push(dot(plateSlot(e, i), 'e'));
      }
    }
    for (const wf of step?.wires ?? []) {
      const u = clamp((t - wf.t0) / (wf.t1 - wf.t0), 0, 1);
      const gap = Math.min(0.12, 0.6 / wf.count);
      for (let i = 0; i < wf.count; i++) {
        const f = clamp((u - i * gap) / (1 - (wf.count - 1) * gap), 0, 1);
        if (f <= 0 || f >= 1) continue;
        const q = polyAt(wf.path, f);
        // Inside the charger or device box the electron is out of sight, not drawn over its name.
        const dv = tl.stage.device;
        const m = 5 * eScale;
        if (dv && q.x > dv.x - m && q.x < dv.x + dv.w + m && q.y > dv.y - m && q.y < dv.y + dv.h + m) continue;
        out.push(dot(q, 'e wire-e'));
      }
    }

    // Light: a wavy line (hν) runs to the molecule, then a brief flash where it is absorbed.
    if (step) {
      for (const ph of step.photons) {
        const u = clamp((t - ph.t0) / (ph.t1 - ph.t0), 0, 1);
        const fade = t <= ph.t1 ? 1 : clamp(1 - (t - ph.t1) / 0.18, 0, 1);
        if (fade <= 0 || t <= ph.t0) continue;
        const dir = norm(sub(ph.p1, ph.p0));
        const nrm = perp(dir);
        const total = dist(ph.p0, ph.p1) - 26;
        const head = add(ph.p0, scale(dir, total * u));
        const pts: string[] = [];
        for (let s = 0; s <= total * u; s += 3) {
          const q = add(add(ph.p0, scale(dir, s)), scale(nrm, Math.sin(s / 6) * 7));
          pts.push(`${f1(q.x)},${f1(q.y)}`);
        }
        const tipBase = sub(head, scale(dir, 9));
        const tri = `${f1(head.x)},${f1(head.y)} ${f1(tipBase.x + nrm.x * 5)},${f1(tipBase.y + nrm.y * 5)} ${f1(tipBase.x - nrm.x * 5)},${f1(tipBase.y - nrm.y * 5)}`;
        let svg = `<g class="photon" opacity="${f1(fade)}"><polyline points="${pts.join(' ')}"/><polygon points="${tri}"/>`;
        svg += `<text x="${f1(ph.p0.x - 6)}" y="${f1(ph.p0.y - 12)}">hν</text>`;
        if (t > ph.t1) {
          const k2 = clamp((t - ph.t1) / 0.18, 0, 1);
          svg += `<circle class="flash" cx="${f1(ph.p1.x)}" cy="${f1(ph.p1.y)}" r="${f1(18 + 30 * k2)}" opacity="${f1(1 - k2)}"/>`;
        }
        out.push(svg + '</g>');
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
      const obstacles = baseAtoms.map((a) => ({ p: basePos.get(a.id)!, r: element(a.el).r + 6, w: a.crowd ? 12 : 60 }));
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
            if (at && opt.lens.charge && formalCharge(step.after, at) !== 0) avoid = stableFreeAngle(step.after, at.id, basePos);
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

    // Battery: where the lithium is, and how much of it can still move (capacity).
    if (tl.stage.battery) out.push(batteryCount(tl, step && t >= 0.88 ? step.after : step ? step.before : tl.initial));

    // Molecule counts over the step (collective mode), in the stage's top-right corner.
    if (step && step.tally.length) out.push(tallyChart(step.tally, t, tl.stage.width));
    // Energy diagram (scenes that use `energy`), under the count chart when both are shown.
    if (step && tl.steps.some((x) => x.energy)) out.push(energyChart(tl.steps, k, t, tl.stage.width, step.tally.length > 0, cam));

    this.dyn.innerHTML = out.join('');
  }

  /** Lone pairs (two dots) and unpaired electrons (one dot) around an atom. */
  /** Directions from an atom of a solid to the atoms packed against it (a charge badge keeps clear of them). */
  private touchCache = new WeakMap<World, Map<string, number[]>>();
  private touching(w: World, id: string): number[] {
    let m = this.touchCache.get(w);
    if (!m) {
      m = new Map();
      for (const ids of w.crystals.values()) {
        for (const x of ids) {
          const a = w.atoms.get(x);
          if (!a) continue;
          const out: number[] = [];
          for (const y of ids) {
            const b = w.atoms.get(y);
            if (!b || y === x) continue;
            if (Math.hypot(b.x - a.x, b.y - a.y) < element(a.el).r + element(b.el).r + 12) out.push(Math.atan2(b.y - a.y, b.x - a.x));
          }
          m.set(x, out);
        }
      }
      this.touchCache.set(w, m);
    }
    return m.get(id) ?? [];
  }

  private domainDots(w: World, a: Atom, p: Vec, pos: Map<string, Vec>, op: number, given?: { angle: number; single: boolean }[]): string[] {
    if (a.lp + a.rad <= 0 || op <= 0.01) return [];
    const out: string[] = [];
    const r = element(a.el).r + 5.5;
    // Directions come from the world's stored coordinates and turn with the molecule; taken from
    // the positions of the moment they would flip between near-equal choices as the atoms jiggle.
    const doms = given ?? (w.atoms.has(a.id) ? stableDomains(w, a.id, pos, a) : electronDomains(p, [], a.lp, a.rad, a.face, a.skip ?? 0));
    for (const d of doms) {
      const c = add(p, fromAngle(d.angle, r));
      if (d.single) {
        out.push(dot(c, 'lp single', op, a.id));
        continue;
      }
      const n = fromAngle(d.angle + Math.PI / 2, 3.3);
      out.push(dot(add(c, n), 'lp', op, a.id), dot(sub(c, n), 'lp', op, a.id));
    }
    return out;
  }

  /**
   * Bonds at this moment. Outside the change window they are drawn as they are (with the bonds
   * about to break marked during the cue). Inside it, bonds that stay slide into their new
   * spacing, and a bond that is made or broken grows or shrinks while it happens: carried by
   * moving electrons (drawElectrons draws those), or, in a net reaction, from both atoms at once.
   */
  private drawBonds(
    step: StepAnim | undefined,
    t: number,
    win: Win,
    bonds: { a: string; b: string; order: number; dative?: string }[],
    pos: Map<string, Vec>,
    atoms: Atom[],
    isCrowd: (a: Atom) => boolean,
    opacity: (id: string) => number,
  ): string[] {
    const out: string[] = [];
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const look = (id: string, op: number) => op * (byId.get(id) && isCrowd(byId.get(id)!) ? 0.55 : 1);
    const seg = (p0: Vec, p1: Vec, cls: string, op: number) =>
      op > 0.01 ? out.push(`<line class="${cls}" x1="${f1(p0.x)}" y1="${f1(p0.y)}" x2="${f1(p1.x)}" y2="${f1(p1.y)}" opacity="${f1(op)}"/>`) : 0;
    const crowdCls = (id: string) => (byId.get(id) && isCrowd(byId.get(id)!) ? ' crowd' : '');
    /** A whole bond: one line per electron pair, dashed for a lone electron; plus the coordinate-bond mark. */
    const whole = (b: { a: string; b: string; order: number; dative?: string }, op: number, skipSlot = -1) => {
      const pa = pos.get(b.a);
      const pb = pos.get(b.b);
      if (!pa || !pb) return;
      const n = perp(norm(sub(pb, pa)));
      const lines = lineCount(b.order);
      slotsOf(lines).forEach((o, i) => {
        if (i === skipSlot) return;
        const half = isHalf(b.order) && i === lines - 1;
        seg(add(pa, scale(n, o)), add(pb, scale(n, o)), `bond${crowdCls(b.a)}${half ? ' half' : ''}`, op);
      });
      if (b.dative) {
        const from = b.dative === b.a ? pa : pb;
        const to = b.dative === b.a ? pb : pa;
        const u = norm(sub(to, from));
        const tip = add(from, scale(sub(to, from), 0.62));
        const base = sub(tip, scale(u, 8));
        const pn = perp(u);
        out.push(
          `<polygon class="dative" points="${f1(tip.x)},${f1(tip.y)} ${f1(base.x + pn.x * 4.5)},${f1(base.y + pn.y * 4.5)} ${f1(base.x - pn.x * 4.5)},${f1(base.y - pn.y * 4.5)}" opacity="${f1(op)}"/>`,
        );
      }
    };
    const opOf = (a: string, b: string) => look(a, Math.min(opacity(a), opacity(b)));

    // Collective mode: a bond made in a collision grows from both atoms, a broken one shrinks back to them.
    if (step && step.events.length) {
      const span = 0.35 / step.duration;
      const growing = new Map<string, number>();
      const shrinking: { a: string; b: string; q: number }[] = [];
      for (const e of step.events) {
        const q = (t - e.t) / span;
        if (q < 0) break;
        if (q >= 1) continue;
        if (e.order > 0) growing.set(keyOf(e.a, e.b), smooth(q));
        else shrinking.push({ a: e.a, b: e.b, q: smooth(q) });
      }
      for (const b of bonds) {
        const q = growing.get(keyOf(b.a, b.b));
        if (q === undefined) whole(b, opOf(b.a, b.b));
        else this.meet(b.a, b.b, q, 0, false, pos, (p0, p1) => seg(p0, p1, `bond${crowdCls(b.a)}`, opOf(b.a, b.b)));
      }
      for (const x of shrinking) {
        if (bonds.some((b) => keyOf(b.a, b.b) === keyOf(x.a, x.b))) continue;
        this.meet(x.a, x.b, 1 - x.q, 0, false, pos, (p0, p1) => seg(p0, p1, `bond${crowdCls(x.a)}`, opOf(x.a, x.b)));
      }
      return out;
    }

    const claims = step ? electronClaims(step) : { form: new Map<string, number>(), brk: new Map<string, number>() };
    const driven = step ? drivenPieces(step) : new Map<string, Piece[]>();
    if (!step || !win.during) {
      for (const b of bonds) whole(b, opOf(b.a, b.b));
      // Cue: a bond about to break is coloured as the electrons that will leave it (pink), or,
      // in a net reaction, in the colour of the things that change.
      if (step && win.pre && win.cue > 0) {
        for (const [k, bb] of step.before.bonds) {
          const ob = bb.order;
          const oa = step.after.bonds.get(k)?.order ?? 0;
          if (oa >= ob) continue;
          const pa = pos.get(bb.a);
          const pb = pos.get(bb.b);
          if (!pa || !pb) continue;
          const n = perp(norm(sub(pb, pa)));
          const nb = lineCount(ob);
          const stable = lineCount(Math.min(ob, oa));
          let carried = claims.brk.get(k) ?? 0;
          let units = ob - Math.min(ob, oa);
          let jE = 0;
          let jU = 0;
          while (units > 0.25) {
            const u = units >= 0.75 ? 1 : 0.5;
            const byElectrons = carried >= u - 1e-9;
            const slot = byElectrons ? slotsOf(nb)[nb - 1 - jE++] ?? 0 : slotsOf(nb)[stable + jU++] ?? 0;
            seg(add(pa, scale(n, slot)), add(pb, scale(n, slot)), byElectrons ? 'bond hot' : 'bond brk', win.cue * opOf(bb.a, bb.b));
            if (byElectrons) carried -= u;
            units -= u;
          }
        }
      }
      return out;
    }

    // Inside the change window.
    const keys = new Set([...step.before.bonds.keys(), ...step.after.bonds.keys()]);
    for (const k of keys) {
      const bb = step.before.bonds.get(k);
      const ba = step.after.bonds.get(k);
      const b = (ba ?? bb)!;
      const pa = pos.get(b.a);
      const pb = pos.get(b.b);
      if (!pa || !pb) continue;
      const op = opOf(b.a, b.b);
      // A molecule that arrives in this step brings its bonds with it.
      if (step.appear.has(b.a) || step.appear.has(b.b)) {
        if (ba && ba.order > 0) whole(ba, op);
        continue;
      }
      const ob = bb?.order ?? 0;
      const oa = ba?.order ?? 0;
      if (Math.abs(ob - oa) < 1e-9) {
        if (oa > 0) whole(ba!, op);
        continue;
      }
      const n = perp(norm(sub(pb, pa)));
      const nb = lineCount(ob);
      const na = lineCount(oa);
      const stable = Math.min(ob, oa);
      const ns = lineCount(stable);
      // Bonds that stay slide from their old spacing to their new one.
      for (let i = 0; i < ns; i++) {
        const o = lerp(slotsOf(nb)[i] ?? 0, slotsOf(na)[i] ?? 0, win.prog);
        const half = isHalf(stable) && i === ns - 1;
        seg(add(pa, scale(n, o)), add(pb, scale(n, o)), `bond${crowdCls(b.a)}${half ? ' half' : ''}`, op);
      }
      // A net reaction (no electrons drawn): the new bond grows from both atoms and meets in the middle;
      // the old bond splits in the middle and shrinks back into both atoms.
      let form = oa - stable - (claims.form.get(k) ?? 0);
      for (let j = 0; form > 0.25; j++) {
        const u = form >= 0.75 ? 1 : 0.5;
        const o = slotsOf(na)[ns + j] ?? 0;
        this.meet(b.a, b.b, win.prog, o, u < 1, pos, (p0, p1) => seg(p0, p1, `bond${u < 1 ? ' half' : ''}`, op));
        form -= u;
      }
      let brk = ob - stable - (claims.brk.get(k) ?? 0);
      for (let j = 0; brk > 0.25; j++) {
        const u = brk >= 0.75 ? 1 : 0.5;
        const o = slotsOf(nb)[ns + j] ?? 0;
        this.meet(b.a, b.b, 1 - win.prog, o, u < 1, pos, (p0, p1) => seg(p0, p1, `bond brk${u < 1 ? ' half' : ''}`, op));
        brk -= u;
      }
      // Bonds changed by moving electrons, in step with them: the bond they leave shrinks into the
      // atom they go to during the first half of their trip (it stays pink, the colour of the
      // leaving electrons); the bond they make grows out of the atom they come from and is
      // complete when they arrive.
      const pieces = driven.get(k) ?? [];
      let jf = 0;
      let jb = 0;
      for (const pc of pieces) {
        const from = pos.get(pc.at);
        const other = pos.get(pc.at === b.a ? b.b : b.a);
        if (!from || !other) continue;
        const m = lerpV(from, other, 0.5);
        if (pc.kind === 'form') {
          const o = slotsOf(na)[na - 1 - jf++] ?? 0;
          const q = smooth(clamp((win.prog - 0.4) / 0.6, 0, 1));
          const end = lerpV(from, pc.half ? m : other, q);
          // Pink while the electrons are still on their way (it is their bond), ordinary once they arrive.
          const ink = smooth(clamp((win.prog - 0.85) / 0.15, 0, 1));
          seg(add(from, scale(n, o)), add(end, scale(n, o)), `bond hot${pc.half ? ' half' : ''}`, op * (1 - ink));
          seg(add(from, scale(n, o)), add(end, scale(n, o)), `bond${pc.half ? ' half' : ''}`, op * ink);
        } else {
          const o = slotsOf(nb)[nb - 1 - jb++] ?? 0;
          const q = smooth(clamp(win.prog / 0.55, 0, 1));
          if (pc.at === '') {
            this.meet(b.a, b.b, 1 - q, o, pc.half, pos, (p0, p1) => seg(p0, p1, `bond hot${pc.half ? ' half' : ''}`, op));
            continue;
          }
          const start = lerpV(pc.half ? m : other, from, q);
          seg(add(from, scale(n, o)), add(start, scale(n, o)), `bond hot${pc.half ? ' half' : ''}`, op);
        }
      }
    }
    return out;
  }

  /** Two pieces of a bond line, each from one atom toward the middle, `q` of the way (1 = they meet). */
  private meet(a: string, b: string, q: number, o: number, _half: boolean, pos: Map<string, Vec>, draw: (p0: Vec, p1: Vec) => void): void {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb || q <= 0.001) return;
    const n = scale(perp(norm(sub(pb, pa))), o);
    const m = lerpV(pa, pb, 0.5);
    draw(add(pa, n), add(lerpV(pa, m, q), n));
    draw(add(pb, n), add(lerpV(pb, m, q), n));
  }

  /** Where electrons that are about to leave an atom sit now (a lone pair or unpaired electron facing their way). */
  private electronSite(step: StepAnim, ar: ArrowAnim, pos: Map<string, Vec>, nth = 0): { c: Vec; ang: number; pairDots: boolean; one: Vec } | null {
    const S = ar.src;
    if (!S || S.kind === 'bond') return null;
    const atom = step.before.atoms.get(S.a);
    const p = pos.get(S.a);
    if (!atom || !p) return null;
    const doms = stableDomains(step.before, S.a, pos);
    const want = Math.atan2(ar.p0.y - atom.y, ar.p0.x - atom.x);
    const wantSingle = S.kind === 'e' || (S.kind === 'atom' && atom.rad > 0);
    let cands = doms.filter((d) => d.single === wantSingle);
    if (!cands.length) cands = doms;
    if (!cands.length) {
      const c = add(p, fromAngle(want, element(atom.el).r + 5.5));
      return { c, ang: want, pairDots: false, one: c };
    }
    const best = cands.reduce((b, d) => (angDist(d.angle, want) < angDist(b.angle, want) ? d : b), cands[0]);
    const c = add(p, fromAngle(best.angle, element(atom.el).r + 5.5));
    // One electron taken from a pair: the first one from one side, the next from the other.
    const one = best.single ? c : add(c, fromAngle(best.angle + Math.PI / 2, nth % 2 ? -3.3 : 3.3));
    return { c, ang: best.angle, pairDots: !best.single, one };
  }

  /**
   * Moving electrons. Before the change they turn pink where they sit. During it they travel along
   * the curve a textbook arrow takes, following the atoms as those move, and draw that arrow behind
   * them; on arrival the arrowhead closes it, at the moment the bonds they leave or make have
   * finished changing (drawBonds). The arrow then stays, fainter, until the step ends, so a paused
   * frame still says what happened.
   */
  private drawElectrons(step: StepAnim, win: Win, pos: Map<string, Vec>, freeOnly = false): { under: string[]; over: string[] } {
    const under: string[] = [];
    const out: string[] = [];
    const k = Math.min(eScale, 2);
    const off = Math.max(3.3, FLY_R * eScale * 1.1);
    const lane = 3 * k;

    const fromAtom = new Map<string, number>();
    for (const ar of step.arrows) {
      // In 'pairs' style the electrons that belong to atoms are drawn as pouches; only free ones (into a wire) are left.
      if (freeOnly && ((ar.src && ar.dst) || ar.free)) continue;
      const pair = ar.kind === 'pair';
      const S = ar.src;
      const nth = S && S.kind !== 'bond' ? fromAtom.get(S.a) ?? 0 : 0;
      if (S && S.kind !== 'bond') fromAtom.set(S.a, nth + 1);
      const site = this.electronSite(step, ar, pos, nth);

      // Cue: the electrons that are about to move turn pink where they are.
      if (win.pre) {
        if (win.cue <= 0) continue;
        if (site) {
          const n = fromAngle(site.ang + Math.PI / 2, 3.3);
          if (pair && site.pairDots) out.push(dot(add(site.c, n), 'e cue', win.cue), dot(sub(site.c, n), 'e cue', win.cue));
          else out.push(dot(site.one, 'e cue', win.cue));
        } else if (!S) out.push(dot(ar.p0, 'e cue', win.cue));
        continue;
      }
      if (!win.during && !win.post) continue;

      // The arrow's curve. The atoms hold still while the electrons travel, so it is drawn where
      // they are; it starts exactly at the electrons that were marked.
      const p0 = site ? (pair ? site.c : site.one) : ar.p0;
      const p1 = ar.p1;
      const c = ar.c;
      const u = win.during ? win.prog : 1;
      if (win.post && win.settle >= 1) continue;

      // The arrow drawn so far: two lines for a pair, one for a single electron, with the head
      // added when the electrons arrive.
      const tan1 = qbezTangent(p0, c, p1, 1);
      const head = 12 * k;
      const end = u >= 0.985 ? 1 : u;
      const reach = Math.max(0.02, end - (end >= 1 ? head / Math.max(30, dist(p0, p1) * 1.15) : 0));
      const lanes = pair ? [lane, -lane] : [0];
      const pts = (o: number) => {
        const q: string[] = [];
        const nSeg = Math.max(2, Math.round(18 * reach));
        for (let i = 0; i <= nSeg; i++) {
          const v = (reach * i) / nSeg;
          const at = add(qbez(p0, c, p1, v), scale(perp(qbezTangent(p0, c, p1, v)), o));
          q.push(`${f1(at.x)},${f1(at.y)}`);
        }
        return q.join(' ');
      };
      // While the new bonds pull the atoms into place, the arrow fades: what it said is now the structure.
      const fade = win.post ? 0.85 * (1 - win.settle) : 0.85;
      let g = `<g class="arrow ${pair ? 'pair' : 'hook'}" opacity="${f1(fade)}">`;
      for (const o of lanes) g += `<polyline points="${pts(o)}" style="stroke-width:${f1(2.2 * k)}px"/>`;
      if (end >= 1) {
        const tip = p1;
        const nn = perp(tan1);
        const base = sub(tip, scale(tan1, head));
        const w = 7.5 * k;
        g += pair
          ? `<polygon points="${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * w)},${f1(base.y + nn.y * w)} ${f1(base.x - nn.x * w)},${f1(base.y - nn.y * w)}"/>`
          : `<polygon points="${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * w)},${f1(base.y + nn.y * w)} ${f1(base.x)},${f1(base.y)}"/>`;
      }
      // Over the atoms, as in a textbook, so that a short arrow inside a molecule stays visible.
      out.push(g + '</g>');

      // The electrons at the front of the arrow; they melt into their new place as they arrive.
      if (win.during) {
        const at = qbez(p0, c, p1, u);
        const nn = perp(qbezTangent(p0, c, p1, u));
        const op = 1 - smooth(clamp((u - 0.9) / 0.1, 0, 1));
        if (op > 0.01) {
          if (pair) out.push(dot(add(at, scale(nn, off)), 'e fly', op), dot(sub(at, scale(nn, off)), 'e fly', op));
          else out.push(dot(at, 'e fly', op));
        }
      }
    }
    return { under, over: out };
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

  /**
   * Hydrogen bonds and ion–water attractions. Which pairs are attracted is decided from the
   * positions without thermal motion (base), so lines change only when molecules really move.
   * Each H holds at most one hydrogen bond and only when it points at the acceptor; an O or N
   * accepts at most one per lone pair.
   */
  private attractions(atoms: Atom[], pos: Map<string, Vec>, base: Map<string, Vec>, w: World, topo: World): string {
    const nbs = new Map<string, string[]>();
    for (const b of topo.bonds.values()) {
      if (b.order <= 0) continue;
      if (!nbs.has(b.a)) nbs.set(b.a, []);
      if (!nbs.has(b.b)) nbs.set(b.b, []);
      nbs.get(b.a)!.push(b.b);
      nbs.get(b.b)!.push(b.a);
    }
    const owner = new Map<string, string>();
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
    const charge = (a: Atom) => {
      const ww = w.atoms.has(a.id) ? w : topo;
      return ww.atoms.has(a.id) ? formalCharge(ww, ww.atoms.get(a.id)!) : 0;
    };
    const polar = ['O', 'N', 'F'];
    const donors: { h: Atom; d: Atom }[] = [];
    const cations: Atom[] = [];
    const acceptors: Atom[] = [];
    for (const a of atoms) {
      const ns = nbs.get(a.id) ?? [];
      if (a.el === 'H' && ns.length === 1 && polar.includes(byId.get(ns[0])?.el ?? '')) donors.push({ h: a, d: byId.get(ns[0])! });
      else if (ns.length === 0 && charge(a) > 0) cations.push(a);
      if ((polar.includes(a.el) && a.lp > 0) || (ns.length === 0 && charge(a) < 0)) acceptors.push(a);
    }
    const capacity = new Map(acceptors.map((a) => [a.id, Math.max(1, a.lp)]));
    const pairs: { p: Atom; m: Atom; d: number }[] = [];
    const reach = bondLength('O', 'H') * 1.95;
    for (const { h, d } of donors) {
      const ph = base.get(h.id)!;
      const along = norm(sub(ph, base.get(d.id)!));
      let best: { m: Atom; d: number } | null = null;
      for (const m of acceptors) {
        if (owner.get(m.id) === owner.get(h.id)) continue;
        const pm = base.get(m.id)!;
        const dd = dist(ph, pm);
        if (dd > reach || dd < 4) continue;
        const u = norm(sub(pm, ph));
        if (along.x * u.x + along.y * u.y < Math.cos((40 * Math.PI) / 180)) continue;
        if (!best || dd < best.d) best = { m, d: dd };
      }
      if (best) pairs.push({ p: h, m: best.m, d: best.d });
    }
    for (const c of cations) {
      const pc = base.get(c.id)!;
      for (const m of acceptors) {
        if (owner.get(m.id) === owner.get(c.id)) continue;
        const dd = dist(pc, base.get(m.id)!);
        if (dd <= element(c.el).r + element(m.el).r + 26) pairs.push({ p: c, m, d: dd - 1000 });
      }
    }
    // Closest pairs first; an acceptor takes no more partners than it has lone pairs (ions excepted).
    pairs.sort((x, y) => x.d - y.d);
    let s = '';
    for (const { p, m } of pairs) {
      const isIon = p.el !== 'H' || (nbs.get(m.id) ?? []).length === 0;
      if (!isIon) {
        const left = capacity.get(m.id) ?? 0;
        if (left <= 0) continue;
        capacity.set(m.id, left - 1);
      }
      const pp = pos.get(p.id)!;
      const pm = pos.get(m.id)!;
      const u = norm(sub(pm, pp));
      const a0 = add(pp, scale(u, element(p.el).r + 1));
      const a1 = sub(pm, scale(u, element(m.el).r + 1));
      s += `<line class="attract" x1="${f1(a0.x)}" y1="${f1(a0.y)}" x2="${f1(a1.x)}" y2="${f1(a1.y)}"/>`;
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
        const doms = electronDomains(p, dirs, at.lp, at.rad, at.face, at.skip ?? 0);
        const pairs = doms.filter((d) => !d.single).map((d) => d.angle);
        const angs = pairs.length ? pairs : doms.length ? doms.map((d) => d.angle) : lonePairAngles(p, dirs, 1);
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

/** The molecules a step is about: whole molecules of the atoms it changes or moves on purpose. */
function stepActors(step: StepAnim): Set<string> {
  const out = new Set<string>();
  for (const w of [step.before, step.after]) {
    for (const id of step.focus) {
      if (!w.atoms.has(id)) continue;
      for (const x of component(w, id)) out.add(x);
    }
  }
  for (const n of step.notes) {
    const tg = n.target;
    const ids = tg.kind === 'atom' || tg.kind === 'lp' ? [tg.id] : tg.kind === 'bond' ? [tg.a, tg.b] : tg.kind === 'group' ? tg.ids : [];
    for (const id of ids) if (step.after.atoms.has(id)) for (const x of component(step.after, id)) out.add(x);
  }
  // Water molecules around an ion belong to it.
  for (const w of [step.before, step.after]) {
    for (const [anchor, shell] of w.attached) {
      if (!out.has(anchor)) continue;
      for (const id of shell) if (w.atoms.has(id)) for (const x of component(w, id)) out.add(x);
    }
  }
  return out;
}

/** The parts of the change window the drawing needs. */
interface Win {
  pre: boolean;
  during: boolean;
  /** After the change, still inside the step. */
  post: boolean;
  /** How far the atoms have settled after the change (0..1): the arrow fades meanwhile. */
  settle: number;
  prog: number;
  cue: number;
  /** Progress through the change window before easing (0..1). */
  frac: number;
}

/** Number of lines a bond of this order is drawn with (a lone electron counts as a dashed line). */
function lineCount(o: number): number {
  const w = Math.floor(o + 1e-9);
  return w + (o - w > 0.25 ? 1 : 0);
}

function isHalf(o: number): boolean {
  return o - Math.floor(o + 1e-9) > 0.25;
}

/** Sideways offsets of the lines of a bond drawn with n lines. */
function slotsOf(n: number): number[] {
  return n <= 1 ? [0] : n === 2 ? [-3.6, 3.6] : [-5.5, 0, 5.5];
}

/** Turning from angle a to angle b the short way round. */
function angDelta(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function angDist(a: number, b: number): number {
  return Math.abs(angDelta(a, b));
}

/** A piece of bond that moving electrons make (grows out of `at`) or leave (shrinks into `at`; '' = into both atoms). */
interface Piece {
  kind: 'form' | 'brk';
  at: string;
  half: boolean;
}

function drivenPieces(step: StepAnim): Map<string, Piece[]> {
  const out = new Map<string, Piece[]>();
  const add1 = (k: string, p: Piece) => out.set(k, [...(out.get(k) ?? []), p]);
  for (const ar of step.arrows) {
    const S = ar.src;
    const D = ar.dst;
    if (!S || !D) continue;
    const half = ar.kind !== 'pair';
    const shared = S.kind === 'bond' && D.kind === 'bond' ? [S.a, S.b].find((x) => x === D.a || x === D.b) : undefined;
    if (D.kind === 'bond' && D.b) {
      const at = S.kind !== 'bond' ? S.a : shared;
      if (at) add1(keyOf(D.a, D.b), { kind: 'form', at, half });
    }
    if (S.kind === 'bond' && S.b) {
      const at = D.kind === 'atom' && (D.a === S.a || D.a === S.b) ? D.a : shared ?? '';
      add1(keyOf(S.a, S.b), { kind: 'brk', at, half });
    }
  }
  return out;
}

/** How many electron pairs moving electrons bring into each bond, and take out of each bond. */
function electronClaims(step: StepAnim): { form: Map<string, number>; brk: Map<string, number> } {
  const form = new Map<string, number>();
  const brk = new Map<string, number>();
  for (const ar of step.arrows) {
    if (!ar.src || !ar.dst) continue;
    const u = ar.kind === 'pair' ? 1 : 0.5;
    if (ar.dst.kind === 'bond' && ar.dst.b) {
      const k = keyOf(ar.dst.a, ar.dst.b);
      form.set(k, (form.get(k) ?? 0) + u);
    }
    if (ar.src.kind === 'bond' && ar.src.b) {
      const k = keyOf(ar.src.a, ar.src.b);
      brk.set(k, (brk.get(k) ?? 0) + u);
    }
  }
  return { form, brk };
}

function keyOf(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "H2" → "H₂", "Ca2+" → "Ca²⁺". */
function prettyFormula(f: string): string {
  const m = f.match(/^(.*?)(\d*[+-])?$/)!;
  const body = m[1].replace(/\d/g, (d) => SUB[+d]);
  const charge = (m[2] ?? '').replace(/\d/g, (d) => SUP[+d]).replace('+', '⁺').replace('-', '⁻');
  return body + charge;
}

/** Lithium in each electrode and in the SEI film, with the share that can still carry charge. */
function batteryCount(tl: Timeline, w: World): string {
  const count = (world: World, region: string) => world.sites.filter((x) => x.region === region && x.occupant).length;
  const sei = (world: World) => [...world.atoms.values()].filter((a) => a.sei && a.el === 'Li').length;
  const total = (world: World) => count(world, 'anode') + count(world, 'cathode') + sei(world);
  const all = total(tl.initial) || total(w);
  const usable = count(w, 'anode') + count(w, 'cathode');
  const text = `흑연 속 리튬 ${count(w, 'anode')} · 산화물 속 리튬 ${count(w, 'cathode')} · SEI에 갇힌 리튬 ${sei(w)}`;
  const cx = tl.stage.width / 2;
  const y = tl.stage.height - 26;
  let s = `<g class="bat-count">`;
  s += `<rect x="${f1(cx - 330)}" y="${f1(y - 22)}" width="660" height="34" rx="17"/>`;
  s += `<text x="${f1(cx - 310)}" y="${f1(y)}">${esc(text)}</text>`;
  s += `<text class="cap" x="${f1(cx + 310)}" y="${f1(y)}" text-anchor="end">쓸 수 있는 리튬 ${usable}/${all}</text>`;
  return s + '</g>';
}

/** Energy over the whole scene: one stretch per step, drawn up to the current moment. */
function energyChart(steps: StepAnim[], k: number, t: number, stageWidth: number, below: boolean, cam: Box): string {
  // Under the count chart (whole stage in view), else pinned to the view's top-right corner.
  let fs: number;
  let box: Box;
  if (below) {
    fs = stageWidth / 1000;
    const tb = tallyBox(stageWidth);
    box = { x: tb.x, y: tb.y + tb.h + 12 * fs, w: tb.w, h: 132 * fs };
  } else {
    fs = cam.w / 1000;
    const w = 280 * fs;
    box = { x: cam.x + cam.w - 20 * fs - w, y: cam.y + 20 * fs, w, h: 124 * fs };
  }
  const pad = 14 * fs;
  const head = 30 * fs;
  const cx = box.x + pad;
  const cy = box.y + head;
  const cw = box.w - 2 * pad;
  const ch = box.h - head - pad;
  type Seg = { from: number; to: number; peak: number | null };
  const segs: Seg[] = [];
  let level = 0;
  for (const st of steps) {
    const e = st.energy;
    if (e) {
      segs.push({ from: e.from, to: e.to, peak: e.barrier !== undefined ? Math.max(e.from + e.barrier, e.from, e.to) : null });
      level = e.to;
    } else segs.push({ from: level, to: level, peak: null });
  }
  const vals = segs.flatMap((sg) => [sg.from, sg.to, sg.peak ?? sg.from]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-9) {
    hi += 1;
    lo -= 1;
  }
  const Y = (v: number) => cy + ch - ((v - lo) / (hi - lo)) * ch;
  const X = (i: number, u: number) => cx + ((i + u) / steps.length) * cw;
  const at = (sg: Seg, u: number) => {
    if (u <= 0.2) return sg.from;
    if (u >= 0.8) return sg.to;
    const v = (u - 0.2) / 0.6;
    if (sg.peak === null) return sg.from + (sg.to - sg.from) * smooth(v);
    return v < 0.5 ? sg.from + (sg.peak - sg.from) * smooth(v * 2) : sg.peak + (sg.to - sg.peak) * smooth(v * 2 - 1);
  };
  const line = (i: number, u1: number) => {
    const pts: string[] = [];
    const n = Math.max(2, Math.round(28 * u1));
    for (let j = 0; j <= n; j++) {
      const u = (u1 * j) / n;
      pts.push(`${f1(X(i, u))},${f1(Y(at(segs[i], u)))}`);
    }
    return pts.join(' ');
  };
  const size = 14 * fs;
  let s = `<g class="energy">`;
  s += `<rect x="${f1(box.x)}" y="${f1(box.y)}" width="${f1(box.w)}" height="${f1(box.h)}" rx="${f1(12 * fs)}"/>`;
  s += `<text x="${f1(cx)}" y="${f1(box.y + 21 * fs)}" font-size="${f1(size)}">에너지</text>`;
  for (let i = 0; i < k && i < segs.length; i++) s += `<polyline class="past" points="${line(i, 1)}" stroke-width="${f1(2.2 * fs)}"/>`;
  const cur = segs[k];
  if (cur) {
    const u = clamp(t, 0, 1);
    s += `<polyline class="now" points="${line(k, Math.max(u, 0.02))}" stroke-width="${f1(2.8 * fs)}"/>`;
    s += `<circle class="dot" cx="${f1(X(k, u))}" cy="${f1(Y(at(cur, u)))}" r="${f1(4.5 * fs)}"/>`;
    const e = steps[k].energy;
    if (e) {
      const d = e.to - e.from;
      const num = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(Math.abs(v))) : Math.abs(v).toFixed(1));
      let label = `${d < 0 ? '−' : d > 0 ? '+' : '±'}${num(d)}${e.unit ? ` ${e.unit}` : ''}`;
      if (e.barrier !== undefined) label = `활성화 에너지 ${num(e.barrier)} · ${label}`;
      const cls = d < 0 ? 'down' : d > 0 ? 'up' : '';
      s += `<text class="delta ${cls}" x="${f1(box.x + box.w - pad)}" y="${f1(box.y + 21 * fs)}" font-size="${f1(size)}" text-anchor="end">${esc(label)}</text>`;
    }
  }
  return s + '</g>';
}

/** How many molecules of each kind there are, drawn as lines growing over the step. */
function tallyChart(tally: StepAnim['tally'], t: number, stageWidth: number): string {
  const box = tallyBox(stageWidth);
  const fs = stageWidth / 1000;
  const pad = 14 * fs;
  const legend = 100 * fs;
  const cw = box.w - legend - 2 * pad;
  const ch = box.h - 2 * pad;
  const cx = box.x + pad;
  const cy = box.y + pad;
  const names = tally[0].counts.map((c) => c[0]);
  const max = Math.max(1, ...tally.flatMap((e) => e.counts.map((c) => c[1])));
  let last = tally[0];
  const pts: string[][] = names.map(() => []);
  for (const e of tally) {
    if (e.t > t + 1e-9) break;
    last = e;
    e.counts.forEach((c, i) => pts[i].push(`${f1(cx + e.t * cw)},${f1(cy + ch - (c[1] / max) * ch)}`));
  }
  const size = 15 * fs;
  let s = `<g class="tally">`;
  s += `<rect x="${f1(box.x)}" y="${f1(box.y)}" width="${f1(box.w)}" height="${f1(box.h)}" rx="${f1(12 * fs)}"/>`;
  s += `<line class="axis" x1="${f1(cx)}" y1="${f1(cy + ch)}" x2="${f1(cx + cw)}" y2="${f1(cy + ch)}"/>`;
  // Earlier series are drawn wider, so lines that coincide still show every colour.
  names.forEach((_, i) => {
    const wdt = 2.4 * fs * (1 + 0.9 * (names.length - 1 - i));
    if (pts[i].length > 1) s += `<polyline class="s${i}" points="${pts[i].join(' ')}" stroke-width="${f1(wdt)}"/>`;
  });
  names.forEach((name, i) => {
    const ly = cy + size * 0.95 + i * size * 1.75;
    const lx = cx + cw + 16 * fs;
    s += `<circle class="s${i}" cx="${f1(lx + 4.5 * fs)}" cy="${f1(ly - size * 0.33)}" r="${f1(4.5 * fs)}"/>`;
    s += `<text x="${f1(lx + 15 * fs)}" y="${f1(ly)}" font-size="${f1(size)}">${esc(prettyFormula(name))}</text>`;
    s += `<text class="n" x="${f1(lx + legend - 18 * fs)}" y="${f1(ly)}" font-size="${f1(size)}" text-anchor="end">${last.counts[i][1]}</text>`;
  });
  return s + '</g>';
}

/** Radius of an electron on its way along an arrow. */
const FLY_R = 4.2;
/** How much moving electrons are enlarged on this frame (1 on a large screen, more on a phone). */
let eScale = 1;

function dot(p: Vec, cls: string, op = 1, of = ''): string {
  const base = cls.includes('wire-e') ? 5 : cls.includes('fly') ? FLY_R : cls === 'e' ? 2.9 : cls.includes('single') ? 2.6 : 2.2;
  // Electrons in an electrode sit 11 apart, so they grow less than the ones on the move.
  const grow = cls.includes('wire-e') || cls.includes('fly') ? eScale : cls === 'e' ? Math.min(eScale, 1.5) : 1;
  const r = f1(base * grow);
  return `<circle class="${cls}"${of ? ` data-a="${of}"` : ''} cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}" opacity="${f1(op)}"/>`;
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
  obstacles: { p: Vec; r: number; w: number }[],
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
        if (Math.hypot(cx - o.p.x, cy - o.p.y) < o.r + 8) score += o.w;
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
