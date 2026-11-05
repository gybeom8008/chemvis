/**
 * Draws one moment of a timeline into an SVG element: atoms, bonds, lone
 * pairs, charges, electron arrows, moving electrons, notes and so on.
 */
import { bondLength, element } from '../chem/elements';
import { electronDomains, lonePairAngles } from '../chem/geometry';
import { tallyBox, type ArrowAnim, type Keyframe, type NoteTarget, type StepAnim, type Timeline } from '../engine/timeline';
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
    for (const ph of step.photons) pts.push(ph.p0, ph.p1);
    for (const wr of step.wires) pts.push(...wr.path);
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
    const dirBonds = [...dirWorld.bonds.values()].filter((b) => b.order > 0);

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

    const opacity = (id: string) => {
      if (step && after.atoms.get(id)?.gone) return clamp((0.86 - t) / 0.26, 0, 1);
      return step && step.appear.has(id) ? clamp(t / 0.18, 0, 1) : 1;
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
      for (const id of step.focus) {
        const p = pos.get(id);
        const a = after.atoms.get(id);
        if (!p || !a) continue;
        const ring = 0.9 * (pre ? 0.35 + 0.65 * cue : 1 - 0.55 * prog);
        out.push(`<circle class="focus" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(element(a.el).r + 7)}" opacity="${f1(opacity(id) * ring)}"/>`);
      }
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
    out.push(...this.drawBonds(step, t, { pre, during, prog, cue }, bonds, pos, atoms, isCrowd, opacity));
    // Moving electrons: marked where they are before the change, then carried as the tip of the
    // bond they leave or make. The pieces of bond they drag go under the atoms, the electrons over.
    const moving = step && step.arrows.length ? this.drawElectrons(step, { pre, during, prog, cue }, pos) : { under: [], over: [] };
    out.push(...moving.under);

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

    // Non-bonding electrons: lone pairs as two dots, unpaired electrons as one.
    // (Not for atoms inside a metal electrode: their outer electrons belong to the whole metal.)
    // Electrons on their way between atoms are drawn by drawElectrons; electrons that change
    // without being carried there (a net reaction) fade from the old count to the new one.
    const carriedTo = new Set<string>();
    for (const ar of step?.arrows ?? []) if (ar.dst?.kind === 'atom') carriedTo.add(ar.dst.a);
    for (const a of atoms) {
      if (isCrowd(a) || a.lattice) continue;
      const p = pos.get(a.id)!;
      if (during && step) {
        const m = step.mid.atoms.get(a.id) ?? a;
        const z = after.atoms.get(a.id) ?? a;
        const same = m.lp === z.lp && m.rad === z.rad && (m.skip ?? 0) === (z.skip ?? 0);
        if (same || carriedTo.has(a.id)) out.push(...this.domainDots(m, p, pos, dirBonds, opacity(a.id)));
        else {
          out.push(...this.domainDots(m, p, pos, [...step.mid.bonds.values()].filter((b) => b.order > 0), opacity(a.id) * (1 - prog)));
          out.push(...this.domainDots(z, p, pos, dirBonds, opacity(a.id) * prog));
        }
      } else out.push(...this.domainDots(a, p, pos, dirBonds, opacity(a.id)));
    }

    // Formal charges.
    // While electrons move, the old charge fades out and the new one in, in step with them.
    if (opt.lens.charge) {
      const turn = smooth(clamp((prog - 0.4) / 0.6, 0, 1));
      for (const a of atoms) {
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        const c = add(p, fromAngle(this.freeAngle(a, p, pos, dirBonds), r + 6));
        const badge = (q: number, op: number) => {
          if (q === 0 || op <= 0.01) return;
          const txt = (Math.abs(q) > 1 ? String(Math.abs(q)) : '') + (q > 0 ? '+' : '−');
          out.push(
            `<g class="charge ${q > 0 ? 'pos' : 'neg'}" opacity="${f1(op)}"><circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${txt.length > 1 ? 9 : 7.5}"/><text x="${f1(c.x)}" y="${f1(c.y)}" dy="0.36em">${txt}</text></g>`,
          );
        };
        if (during && step) {
          const b0 = step.before.atoms.get(a.id);
          const qa = formalCharge(after, after.atoms.get(a.id)!);
          const qb = b0 ? formalCharge(step.before, b0) : qa;
          if (qa === qb) badge(qa, opacity(a.id));
          else {
            badge(qb, opacity(a.id) * (1 - turn));
            badge(qa, opacity(a.id) * turn);
          }
          continue;
        }
        const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
        badge(formalCharge(w, w.atoms.get(a.id)!), opacity(a.id));
      }
    }

    // Oxidation states (small signed numbers beside the atom, clear of the charge badge).
    if (opt.lens.oxidation) {
      for (const a of atoms) {
        // Electrode metal is all 0; labelling every atom of the plate only adds noise.
        if (isCrowd(a) || a.lattice) continue;
        const w = chargeWorld.atoms.has(a.id) ? chargeWorld : after;
        const wa = w.atoms.get(a.id)!;
        const ox = oxidationState(w, wa);
        const p = pos.get(a.id)!;
        const r = element(a.el).r;
        const extra: number[] = [];
        if (opt.lens.charge && formalCharge(w, wa) !== 0) extra.push(this.freeAngle(a, p, pos, dirBonds));
        const ang = this.freeAngle(a, p, pos, dirBonds, extra, Math.PI / 4);
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

    // The electrons themselves; the textbook arrow only on request (lens).
    if (step && step.arrows.length && opt.lens.arrows && (pre || during)) out.push(...textbookArrows(step));
    out.push(...moving.over);

    // Electrode stage: electrons waiting in each plate, and electrons running through the wire.
    if (tl.stage.electrodes) {
      const plateWorld = step && step.phase && t < step.phase.b1 ? step.before : after;
      for (const [name, e] of Object.entries(tl.stage.electrodes)) {
        const n = Math.min(12, plateWorld.plate[name] ?? 0);
        for (let i = 0; i < n; i++) {
          out.push(dot({ x: e.x - 9 + (i % 2) * 18, y: e.top + 12 + Math.floor(i / 2) * 11 }, 'e'));
        }
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

    // Battery: where the lithium is, and how much of it can still move (capacity).
    if (tl.stage.battery) out.push(batteryCount(tl, step && t >= 0.88 ? step.after : step ? step.before : tl.initial));

    // Molecule counts over the step (collective mode), in the stage's top-right corner.
    if (step && step.tally.length) out.push(tallyChart(step.tally, t, tl.stage.width));
    // Energy diagram (scenes that use `energy`), under the count chart when both are shown.
    if (step && tl.steps.some((x) => x.energy)) out.push(energyChart(tl.steps, k, t, tl.stage.width, step.tally.length > 0, cam));

    this.dyn.innerHTML = out.join('');
  }

  /** Lone pairs (two dots) and unpaired electrons (one dot) around an atom. */
  private domainDots(a: Atom, p: Vec, pos: Map<string, Vec>, bonds: { a: string; b: string }[], op: number): string[] {
    if (a.lp + a.rad <= 0 || op <= 0.01) return [];
    const out: string[] = [];
    const r = element(a.el).r + 5.5;
    for (const d of electronDomains(p, this.bondDirs(a.id, p, pos, bonds), a.lp, a.rad, a.face, a.skip ?? 0)) {
      const c = add(p, fromAngle(d.angle, r));
      if (d.single) {
        out.push(dot(c, 'lp single', op));
        continue;
      }
      const n = fromAngle(d.angle + Math.PI / 2, 3.3);
      out.push(dot(add(c, n), 'lp', op), dot(sub(c, n), 'lp', op));
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
    const bonds = [...step.before.bonds.values()].filter((b) => b.order > 0);
    const doms = electronDomains(p, this.bondDirs(S.a, p, pos, bonds), atom.lp, atom.rad, atom.face, atom.skip ?? 0);
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
   * Moving electrons. Before the change they are coloured where they sit; during it they travel as
   * the tip of the bond they leave (the line shrinks behind them) or make (the line grows behind
   * them), and land as a lone pair, or melt into the finished bond line.
   */
  private drawElectrons(step: StepAnim, win: Win, pos: Map<string, Vec>): { under: string[]; over: string[] } {
    const under: string[] = [];
    const out: string[] = [];
    const P = (id: string) => pos.get(id);
    const R = (id: string) => element((step.after.atoms.get(id) ?? step.before.atoms.get(id))!.el).r;
    const surf = (x: string, y: string, gap: number) => add(P(x)!, scale(norm(sub(P(y)!, P(x)!)), R(x) + gap));
    const before = (id: string) => step.before.atoms.get(id) ?? step.after.atoms.get(id)!;
    const seg = (p0: Vec, p1: Vec, cls: string, op: number) =>
      op > 0.01 ? under.push(`<line class="${cls}" x1="${f1(p0.x)}" y1="${f1(p0.y)}" x2="${f1(p1.x)}" y2="${f1(p1.y)}" opacity="${f1(op)}"/>`) : 0;
    const formIdx = new Map<string, number>();
    const brkIdx = new Map<string, number>();
    const slotFor = (k: string, kind: 'form' | 'brk') => {
      const m = kind === 'form' ? formIdx : brkIdx;
      const j = m.get(k) ?? 0;
      m.set(k, j + 1);
      const ord = (kind === 'form' ? step.after : step.before).bonds.get(k)?.order ?? 1;
      const L = lineCount(ord);
      return slotsOf(L)[L - 1 - j] ?? 0;
    };
    const normalOf = (k: string) => {
      const b = (step.after.bonds.get(k) ?? step.before.bonds.get(k))!;
      const pa = P(b.a);
      const pb = P(b.b);
      return pa && pb ? perp(norm(sub(pb, pa))) : { x: 0, y: 0 };
    };
    const off = Math.max(3.3, FLY_R * eScale * 1.1);
    const dots = (tip: Vec, dir: Vec, pair: boolean, op: number, cls = 'e fly') => {
      if (op <= 0.01) return;
      const nn = perp(norm(dir));
      if (pair) out.push(dot(add(tip, scale(nn, off)), cls, op), dot(sub(tip, scale(nn, off)), cls, op));
      else out.push(dot(tip, cls, op));
    };

    const fromAtom = new Map<string, number>();
    for (const ar of step.arrows) {
      const pair = ar.kind === 'pair';
      const S = ar.src;
      const D = ar.dst;
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
      if (!win.during) continue;
      const p = win.prog;

      // Electrons that belong to no atom (into or out of an electrode) fly freely.
      if (!S || !D || !P(S.a) || !P(D.a)) {
        const q = qbez(ar.p0, ar.c, ar.p1, p);
        dots(q, qbezTangent(ar.p0, ar.c, ar.p1, p), pair, 1);
        continue;
      }

      // Each case gives the electrons' position for a progress u, and the bond piece they drag.
      let at: (u: number) => { tip: Vec; piece?: { from: Vec; o: number; n: Vec; cls: string; op: number } };
      let melt = 0; // how far the electrons have melted into a finished bond line
      if (S.kind !== 'bond' && D.kind === 'bond') {
        // From an atom into a bond it makes: the bond line grows from the atom behind the electrons.
        const from = S.a;
        const to = D.a === from ? D.b! : D.a;
        const k = keyOf(D.a, D.b!);
        const o = slotFor(k, 'form');
        const n = normalOf(k);
        const start = site ? (pair ? site.c : site.one) : surf(from, to, 5.5);
        const end = pair ? surf(to, from, 3) : lerpV(P(from)!, P(to)!, 0.5);
        const ctrl = surf(from, to, 14);
        const ink = smooth(clamp((p - 0.72) / 0.28, 0, 1));
        melt = pair ? smooth(clamp((p - 0.8) / 0.2, 0, 1)) : 0;
        at = (u) => ({ tip: qbez(start, ctrl, end, u), piece: { from: P(from)!, o, n, cls: pair ? 'bond' : 'bond half', op: ink } });
        const { tip, piece } = at(p);
        // The growing line is pink while the electrons make it, and turns into an ordinary bond as they arrive.
        seg(add(piece!.from, scale(n, o)), add(tip, scale(n, o)), `bond hot${pair ? '' : ' half'}`, 1 - ink);
        seg(add(piece!.from, scale(n, o)), add(tip, scale(n, o)), piece!.cls, ink);
        dots(tip, sub(at(Math.min(1, p + 0.02)).tip, at(Math.max(0, p - 0.02)).tip), pair, 1 - melt);
        continue;
      }
      if (S.kind === 'bond' && D.kind === 'atom' && (D.a === S.a || D.a === S.b)) {
        // From a bond onto one of its atoms: the line shrinks into that atom, carrying the electrons,
        // which then settle beside it as a lone pair (or an unpaired electron).
        const r = D.a;
        const other = S.a === r ? S.b! : S.a;
        const k = keyOf(S.a, S.b!);
        const o = slotFor(k, 'brk');
        const n = normalOf(k);
        const start = pair ? surf(other, r, 2) : lerpV(P(r)!, P(other)!, 0.5);
        const land = surf(r, other, 2);
        const b0 = before(r);
        const goal = Math.atan2(ar.p1.y - b0.y, ar.p1.x - b0.x);
        const from = Math.atan2(land.y - P(r)!.y, land.x - P(r)!.x);
        const split = 0.7;
        at = (u) => {
          if (u <= split) return { tip: lerpV(start, land, u / split), piece: { from: P(r)!, o, n, cls: 'bond hot', op: 1 } };
          const v = (u - split) / (1 - split);
          return { tip: add(P(r)!, fromAngle(from + angDelta(from, goal) * v, R(r) + 2 + 3.5 * v)) };
        };
        const { tip, piece } = at(p);
        if (piece) seg(add(piece.from, scale(n, o)), add(tip, scale(n, o)), `bond hot${pair ? '' : ' half'}`, 1);
        dots(tip, sub(at(Math.min(1, p + 0.02)).tip, at(Math.max(0, p - 0.02)).tip), pair, 1);
        continue;
      }
      if (S.kind === 'bond' && D.kind === 'bond') {
        // From one bond into a neighbouring one: the old line shrinks into the shared atom while the new one grows out of it.
        const y = [S.a, S.b!].find((id) => id === D.a || id === D.b)!;
        const x = S.a === y ? S.b! : S.a;
        const z = D.a === y ? D.b! : D.a;
        const ks = keyOf(S.a, S.b!);
        const kd = keyOf(D.a, D.b!);
        const os = slotFor(ks, 'brk');
        const od = slotFor(kd, 'form');
        const ns = normalOf(ks);
        const nd = normalOf(kd);
        const start = pair ? surf(x, y, 2) : lerpV(P(x)!, P(y)!, 0.5);
        const inY = surf(y, x, 2);
        const outY = surf(y, z, 2);
        const end = pair ? surf(z, y, 3) : lerpV(P(y)!, P(z)!, 0.5);
        const a1 = Math.atan2(inY.y - P(y)!.y, inY.x - P(y)!.x);
        const a2 = Math.atan2(outY.y - P(y)!.y, outY.x - P(y)!.x);
        at = (u) => {
          if (u < 0.42) return { tip: lerpV(start, inY, u / 0.42), piece: { from: P(y)!, o: os, n: ns, cls: 'bond hot', op: 1 } };
          if (u < 0.58) return { tip: add(P(y)!, fromAngle(a1 + angDelta(a1, a2) * ((u - 0.42) / 0.16), R(y) + 2)) };
          return { tip: lerpV(outY, end, (u - 0.58) / 0.42), piece: { from: P(y)!, o: od, n: nd, cls: 'bond', op: 1 } };
        };
        const { tip, piece } = at(p);
        const ink = smooth(clamp((p - 0.8) / 0.2, 0, 1));
        if (piece && p < 0.42) seg(add(piece.from, scale(ns, os)), add(tip, scale(ns, os)), `bond hot${pair ? '' : ' half'}`, 1);
        if (piece && p >= 0.58) {
          seg(add(piece.from, scale(nd, od)), add(tip, scale(nd, od)), `bond hot${pair ? '' : ' half'}`, 1 - ink);
          seg(add(piece.from, scale(nd, od)), add(tip, scale(nd, od)), `bond${pair ? '' : ' half'}`, ink);
        }
        melt = pair ? smooth(clamp((p - 0.85) / 0.15, 0, 1)) : 0;
        dots(tip, sub(at(Math.min(1, p + 0.02)).tip, at(Math.max(0, p - 0.02)).tip), pair, 1 - melt);
        continue;
      }
      // Electrons passing from one atom to another without a bond between them (electron transfer).
      {
        const start = S.kind === 'bond' ? lerpV(P(S.a)!, P(S.b!)!, 0.5) : site ? (pair ? site.c : site.one) : ar.p0;
        const b1 = before(D.a);
        const end =
          D.kind === 'atom'
            ? add(P(D.a)!, fromAngle(Math.atan2(ar.p1.y - b1.y, ar.p1.x - b1.x), R(D.a) + 5.5))
            : lerpV(P(D.a)!, P(D.b!)!, 0.5);
        const ctrl = add(lerpV(start, end, 0.5), sub(ar.c, lerpV(ar.p0, ar.p1, 0.5)));
        const q = qbez(start, ctrl, end, p);
        dots(q, qbezTangent(start, ctrl, end, p), pair, 1);
      }
    }
    return { under, over: out };
  }

  /** Direction around an atom that is clear of bonds and lone pairs (for the charge badge). */
  private bondDirs(id: string, p: Vec, pos: Map<string, Vec>, bonds: { a: string; b: string }[]): number[] {
    return bonds
      .filter((b) => (b.a === id || b.b === id) && pos.has(b.a === id ? b.b : b.a))
      .map((b) => {
        const q = pos.get(b.a === id ? b.b : b.a)!;
        return Math.atan2(q.y - p.y, q.x - p.x);
      });
  }

  /** Direction around an atom clear of bonds, electrons and `extra` directions (preferring `pref`). */
  private freeAngle(
    a: Atom,
    p: Vec,
    pos: Map<string, Vec>,
    bonds: { a: string; b: string }[],
    extra: number[] = [],
    prefer = -Math.PI / 4,
  ): number {
    const dirs = this.bondDirs(a.id, p, pos, bonds);
    const taken = [...dirs, ...electronDomains(p, dirs, a.lp, a.rad, a.face, a.skip ?? 0).map((d) => d.angle), ...extra];
    const pref = prefer;
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

/** The parts of the change window the drawing needs. */
interface Win {
  pre: boolean;
  during: boolean;
  prog: number;
  cue: number;
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

/** Textbook curved arrows (lens): two-line arrow with a full head for a pair, one line with a half head for one electron. */
function textbookArrows(step: StepAnim): string[] {
  const out: string[] = [];
  const LANE = 3;
  for (const ar of step.arrows) {
    const pair = ar.kind === 'pair';
    const tip = ar.p1;
    const tan = qbezTangent(ar.p0, ar.c, ar.p1, 1);
    const nn = perp(tan);
    const base = sub(tip, scale(tan, 13));
    const lane = (o: number) => {
      const pts: string[] = [];
      for (let i = 0; i <= 18; i++) {
        const u = i / 18;
        const q = add(qbez(ar.p0, ar.c, base, u), scale(perp(qbezTangent(ar.p0, ar.c, base, u)), o));
        pts.push(`${f1(q.x)},${f1(q.y)}`);
      }
      return `<polyline points="${pts.join(' ')}"/>`;
    };
    if (pair) {
      const head = `${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * 8)},${f1(base.y + nn.y * 8)} ${f1(base.x - nn.x * 8)},${f1(base.y - nn.y * 8)}`;
      out.push(`<g class="arrow pair" opacity="0.5">${lane(LANE)}${lane(-LANE)}<polygon points="${head}"/></g>`);
    } else {
      const head = `${f1(tip.x)},${f1(tip.y)} ${f1(base.x + nn.x * 8)},${f1(base.y + nn.y * 8)} ${f1(base.x)},${f1(base.y)}`;
      out.push(`<g class="arrow hook" opacity="0.5">${lane(0)}<polygon points="${head}"/></g>`);
    }
  }
  return out;
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

function dot(p: Vec, cls: string, op = 1): string {
  const base = cls.includes('wire-e') ? 5 : cls.includes('fly') ? FLY_R : cls === 'e' ? 2.9 : cls.includes('single') ? 2.6 : 2.2;
  // Electrons in an electrode sit 11 apart, so they grow less than the ones on the move.
  const grow = cls.includes('wire-e') || cls.includes('fly') ? eScale : cls === 'e' ? Math.min(eScale, 1.5) : 1;
  const r = f1(base * grow);
  return `<circle class="${cls}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}" opacity="${f1(op)}"/>`;
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
