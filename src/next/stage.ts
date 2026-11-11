/**
 * One stage: an SVG the engine draws into, plus an HTML layer on top of it for things that
 * follow atoms (rings to press, handles to drag). Every screen of the app shows scenes through this.
 */
import { element } from '../chem/elements';
import { compile, type CompileResult } from '../engine/compile';
import type { StepAnim, Timeline } from '../engine/timeline';
import type { Atom, Lens, World } from '../engine/world';
import { StageView, trackAt } from '../render/view';
import { Player } from '../ui/player';
import type { Vec } from '../util/math';

const params = new URLSearchParams(location.search);
export const STILL = params.has('still') || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

const live = new Set<Stage>();
let last = performance.now();
const start = last;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const s of live) {
    if (s.host.isConnected) s.tick(dt, (now - start) / 1000);
    else live.delete(s);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

export class Stage {
  readonly host: HTMLElement;
  readonly svg: SVGSVGElement;
  /** HTML layer over the drawing, same size as it. */
  readonly over: HTMLElement;
  readonly view: StageView;
  readonly player = new Player();
  tl: Timeline | null = null;
  src = '';
  lens: Lens = { charge: true, attract: false, numbers: false, oxidation: false, arrows: false };
  speed = 1;
  motion = !STILL;
  /** How electrons are drawn: as pairs in pouches, or the earlier way (lines and curved arrows). */
  style: 'lines' | 'pairs' = 'pairs';
  /** How atoms and charge look: element colours and badges, or plain atoms with charge as light. */
  look: 'color' | 'glow' = 'color';
  /** Runs after each drawn frame. */
  onFrame: (() => void) | null = null;

  constructor(host: HTMLElement, opts: { live?: boolean } = {}) {
    this.host = host;
    host.classList.add('stg');
    host.innerHTML = '<svg class="stage" role="img" aria-label="장면"></svg><div class="ov"></div>';
    this.svg = host.querySelector('svg') as unknown as SVGSVGElement;
    this.over = host.querySelector('.ov')!;
    this.view = new StageView(this.svg);
    this.player.onStepEnter = (k) => {
      const st = this.tl?.steps[k];
      if (st?.lens) Object.assign(this.lens, st.lens);
    };
    if (opts.live !== false) live.add(this);
  }

  /** Compile and show a script. Keeps the previous scene if the new one has errors. */
  load(src: string): CompileResult {
    const res = compile(src);
    if (res.timeline) {
      this.src = src;
      this.tl = res.timeline;
      this.view.setTimeline(res.timeline);
      bleed(this.svg, res.timeline);
      this.lens = { ...this.lens, ...res.timeline.initial.lens };
      this.player.load(res.timeline);
    }
    return res;
  }

  tick(dt: number, clock: number): void {
    this.player.speed = this.speed;
    this.player.tick(dt);
    if (!this.tl) return;
    this.view.draw(this.player.k, this.player.t, { lens: this.lens, clock: this.motion ? clock : 0, motion: this.motion, dt: this.motion ? dt : 0, style: this.style, look: this.look });
    this.onFrame?.();
  }

  /** Draw one moment and hold it. */
  still(k: number, t: number): void {
    this.player.seek(k, t);
    if (this.tl) this.view.draw(this.player.k, this.player.t, { lens: this.lens, clock: 0, motion: false, style: this.style, look: this.look });
    this.onFrame?.();
  }

  get step(): StepAnim | undefined {
    return this.tl?.steps[this.player.k];
  }

  /** The world as it is at the end of the current step. */
  get world(): World | null {
    return this.step?.after ?? this.tl?.initial ?? null;
  }

  /** Where an atom is right now, in stage units (without thermal jiggle). */
  pos(id: string): Vec | null {
    const w = this.world;
    const a = w?.atoms.get(id);
    if (!a) return null;
    const tr = this.step?.tracks.get(id);
    return tr ? trackAt(tr, this.player.t) : { x: a.x, y: a.y };
  }

  /** Stage units → pixels inside the host. */
  toScreen(p: Vec): Vec {
    const m = this.svg.getScreenCTM();
    const r = this.host.getBoundingClientRect();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * p.x + m.e - r.left, y: m.d * p.y + m.f - r.top };
  }

  /** Pointer position → stage units. */
  toWorld(clientX: number, clientY: number): Vec {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: (clientX - m.e) / m.a, y: (clientY - m.f) / m.d };
  }

  /** Pixels per stage unit. */
  get scale(): number {
    return this.svg.getScreenCTM()?.a ?? 1;
  }

  /** The atom under the pointer (nearest one whose disc, grown by `slack` px, holds the point). */
  pick(clientX: number, clientY: number, ok: (a: Atom) => boolean = (a) => !a.crowd, slack = 10): Atom | null {
    const w = this.world;
    if (!w) return null;
    const p = this.toWorld(clientX, clientY);
    const k = this.scale;
    let best: Atom | null = null;
    let bd = Infinity;
    for (const a of w.atoms.values()) {
      if (a.gone || !ok(a)) continue;
      const q = this.pos(a.id)!;
      const d = Math.hypot(q.x - p.x, q.y - p.y) - element(a.el).r;
      if (d * k < slack && d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }
}

/**
 * The stage's regions are drawn as rounded panels inside its bounds. A wide screen shows more
 * than the bounds, so the same colours are laid underneath, far past the edges.
 */
function bleed(svg: SVGSVGElement, tl: Timeline): void {
  const st = tl.stage;
  const B = 4000;
  const big = (cls: string, y0: number, y1: number) => `<rect class="${cls}" x="${-B}" y="${y0}" width="${st.width + 2 * B}" height="${y1 - y0}"/>`;
  let html = '';
  if (st.name === 'solution') html = big('bg-water', -B, st.height + B);
  else if (st.name === 'gas') html = big('bg-air', -B, st.height + B);
  else if (st.name === 'interface') {
    const S = st.regions.surface.y + st.regions.surface.h / 2;
    const yl = S + Math.sin(8 / 37) * 3;
    const yr = S + Math.sin(988 / 37) * 3;
    html = big('bg-air', -B, S) + big('bg-water', S, st.height + B) + `<path class="bg-surface" d="M${-B},${yl.toFixed(1)} L8,${yl.toFixed(1)} M988,${yr.toFixed(1)} L${st.width + B},${yr.toFixed(1)}"/>`;
  }
  if (html) svg.querySelector('.bg')!.insertAdjacentHTML('afterbegin', html);
}

/** `w.O` → the atom the script named so (atom ids are `owner.label`). */
export function atomByRef(w: World, ref: string): Atom | null {
  return w.atoms.get(ref) ?? null;
}
