import type { Diag } from '../dsl/parser';
import type { StageDef } from '../stage/stages';
import type { Vec } from '../util/math';
import { clamp, lerp, smooth } from '../util/math';
import type { Lens, World } from './world';

export interface Keyframe {
  t: number;
  x: number;
  y: number;
  /**
   * How the segment that ends at this keyframe is travelled. true: starts and stops gently.
   * 'snap': leaves at once and lands softly (an atom passed from one molecule to another).
   */
  ease?: boolean | 'snap';
}

/** 렌더러와 같은 보간이다. 표본 사이도 실제 재생 좌표로 검사한다. */
export function trackAt(kf: Keyframe[], t: number): Vec {
  if (t <= kf[0].t) return kf[0];
  const last = kf[kf.length - 1];
  if (t >= last.t) return last;
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i].t) {
      const a = kf[i - 1], b = kf[i];
      const span = b.t - a.t;
      let u = span < 1e-9 ? 1 : (t - a.t) / span;
      if (b.ease === 'snap') u = 1 - Math.pow(1 - u, 3);
      else if (b.ease) u = smooth(u);
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
    }
  }
  return last;
}

/**
 * A single electron that goes from one atom to another, over its turn (0..1). Plainly it glides.
 * `instant` (CompileOptions.instant): it stays where it is for most of its turn and is then across
 * in a few frames, like everything else that changes hands.
 */
export const HOP_WAIT = 0.86;
export function hopFlight(x: number, instant = false): number {
  const u = clamp(x, 0, 1);
  if (!instant) return smooth(u);
  return u <= HOP_WAIT ? 0 : 1 - Math.pow(1 - (u - HOP_WAIT) / (1 - HOP_WAIT), 2.5);
}

/** pairs 렌더러가 같은 원자에서 출발하는 홑전자를 차례로 보내는 진행률이다. */
export function hopProgress(phase: { b0: number; b1: number }, index: number, count: number, t: number, instant = false): number {
  const fraction = clamp((t - phase.b0) / Math.max(1e-9, phase.b1 - phase.b0), 0, 1);
  return hopFlight((fraction * count - index) / 0.8, instant);
}

/**
 * An atom snatched from one molecule by another, as fractions of the electrons' window: the pair
 * that held it has drawn back by `free`; the taker's pair reaches for it from `grab`; it lands at
 * `hit`. Between `free` and `grab` no pair touches the atom. The engine moves the atom by
 * `snatchAt`, the drawing times the two pairs by `snatchPairs`: one clock for both.
 */
export const SNATCH = { free: 0.42, slide: 0.5, grab: 0.6, hit: 0.7 };

/**
 * How far a snatched atom has come from its old place (0) to its new one (1): it slides a little
 * way off as it is let go, is then pulled across faster and faster, lands, presses in a little
 * and springs back (values just over 1).
 */
export function snatchAt(f: number): number {
  const u = clamp(f, 0, 1);
  const loose = 0.16;
  if (u <= SNATCH.slide) return loose * Math.pow(u / SNATCH.slide, 1.6);
  if (u <= SNATCH.hit) {
    const x = (u - SNATCH.slide) / (SNATCH.hit - SNATCH.slide);
    // Leaves the slide at the speed it had, then accelerates all the way in.
    const v = (loose * 1.6 / SNATCH.slide) * (SNATCH.hit - SNATCH.slide);
    return loose + v * x + (1 - loose - v) * x * x * x;
  }
  const x = (u - SNATCH.hit) / (1 - SNATCH.hit);
  return 1 + 0.2 * Math.exp(-5 * x) * Math.sin(9 * x) * (1 - x);
}

/** Progress of the pair that lets a snatched atom go, and of the pair that takes it. */
export function snatchPairs(f: number): { let: number; take: number } {
  return {
    let: smooth(clamp(f / SNATCH.free, 0, 1)),
    take: smooth(clamp((f - SNATCH.grab) / (SNATCH.hit - SNATCH.grab), 0, 1)),
  };
}

/**
 * The same hand-over as a reach (CompileOptions.reach), in fractions of the two pairs' window.
 * From `start` the taker's pair reaches out for the atom like a hand (as far as `reachTo` of the
 * way to it), and the atom is drawn toward it on its own bond, which grows a little longer and
 * thinner. At `snap` the old bond lets go and the atom is on the taker by `hit`, like a piece of
 * iron on a magnet; it presses in and rings like something springy (`ring`).
 *  - `tug`: how much of its way the atom has been drawn out when it snaps across;
 *  - `pow`: how late the drawing out comes (higher: nothing for long, then it strains);
 *  - `thin`: how much of its width the stretched bond loses;
 *  - `strain`: the hand goes out fast and then creeps, as against a stiff pull;
 *  - `recoil`: how far (px) the pair that let go springs back on itself.
 */
export interface Reach {
  start: number;
  snap: number;
  hit: number;
  tug: number;
  pow: number;
  reachTo: number;
  thin: number;
  strain: boolean;
  recoil: number;
  ring: { amp: number; damp: number; freq: number };
}

/** The first reach: the hand goes all the way, the bond stretches by a good sixth, the atom crosses in about 0.07 s. */
export const REACH: Reach = {
  start: 0.08, snap: 0.62, hit: 0.72, tug: 0.38, pow: 1.7, reachTo: 1, thin: 0.32, strain: false, recoil: 0,
  ring: { amp: 0.3, damp: 5, freq: 9 },
};

/**
 * Stiff and springy: the bond hardly gives (a few percent longer, a little thinner), the hand
 * strains most of the way out, and then the atom is across in a frame or two, all but at once.
 * What was under tension springs back: the pair that let go, the atom on its new bond.
 */
export const REACH_STIFF: Reach = {
  start: 0.08, snap: 0.56, hit: 0.59, tug: 0.13, pow: 2.4, reachTo: 0.62, thin: 0.12, strain: true, recoil: 3.4,
  ring: { amp: 0.26, damp: 5.5, freq: 17 },
};

/**
 * As stiff, and the taker's pair is stiff too: it leans out a quarter of the way and no more (it
 * is not drawn out long like something elastic), and the atom, once on it, hardly rings: the bond
 * does not give, so the blow goes into the molecule as a whole (which is knocked and comes back).
 */
export const REACH_FIRM: Reach = {
  ...REACH_STIFF, reachTo: 0.24, ring: { amp: 0.08, damp: 7, freq: 21 },
};

export type ReachKind = 'soft' | 'stiff' | 'firm';

export function reachOf(kind: ReachKind): Reach {
  return kind === 'firm' ? REACH_FIRM : kind === 'stiff' ? REACH_STIFF : REACH;
}

/** How far the atom has come from its old place (0) to its new one (1); a little over 1 as it presses in and springs back. */
export function reachAt(f: number, k: Reach = REACH): number {
  const u = clamp(f, 0, 1);
  const { start, snap, hit, tug, pow } = k;
  if (u <= start) return 0;
  // Drawn out harder and harder as the hand comes near.
  if (u <= snap) return tug * Math.pow((u - start) / (snap - start), pow);
  if (u <= hit) {
    const y = (u - snap) / (hit - snap);
    // Goes on at the speed it was drawn out with, and is across in a few frames.
    const v = ((tug * pow) / (snap - start)) * (hit - snap);
    return tug + v * y + (1 - tug - v) * Math.pow(y, 2.5);
  }
  const x = (u - hit) / (1 - hit);
  return 1 + k.ring.amp * Math.exp(-k.ring.damp * x) * Math.sin(k.ring.freq * x) * (1 - x);
}

/**
 * The two pairs of a reach. `take`: how far the taker's pair has reached (`reachTo` at `snap`, 1 at
 * `hit`, when it has the atom). `let`: how far the old pair has drawn back (0 until `snap`: it holds
 * the atom until then). `thin`: the old bond's width while it is stretched. `charge`: how far the
 * atom has changed hands, for the reckoning of charge (at the snap, not while the hand is only
 * reaching). `spring`: px by which the pair that let go is shorter (negative) or longer than at
 * rest, as it springs back.
 */
export function reachPairs(f: number, k: Reach = REACH): { take: number; let: number; thin: number; charge: number; spring: number } {
  const u = clamp(f, 0, 1);
  const { start, snap, hit, tug } = k;
  const x = clamp((u - snap) / (hit - snap), 0, 1);
  const r = clamp((u - start) / (snap - start), 0, 1);
  const z = clamp((u - hit) / (1 - hit), 0, 1);
  return {
    take: k.reachTo * (k.strain ? 1 - Math.pow(1 - r, 2.5) : smooth(r)) + (1 - k.reachTo) * smooth(x),
    let: 1 - Math.pow(1 - x, 3),
    thin: 1 - k.thin * (reachAt(Math.min(u, snap), k) / tug),
    charge: smooth(x),
    spring: u > hit && k.recoil ? -k.recoil * Math.exp(-5 * z) * Math.sin(15 * z) * (1 - z) : 0,
  };
}

/** Where moving electrons start or end, when that is on atoms (lone pair, unpaired electron, bond, atom). */
export interface ElectronEnd {
  kind: 'lp' | 'e' | 'atom' | 'bond';
  a: string;
  b?: string;
}

/**
 * Electrons moving in a step. With `src` and `dst` the electrons belong to atoms: the renderer
 * moves them as the tip of the bond they leave or form. Without, they fly freely from p0 to p1
 * (electrons going into or out of an electrode). p0/c/p1 also give the textbook curved arrow.
 */
export interface ArrowAnim {
  /** 'pair' = two electrons (full arrowhead), 'single' = one electron (fishhook). */
  kind: 'pair' | 'single';
  p0: Vec;
  c: Vec;
  p1: Vec;
  line: number;
  src?: ElectronEnd;
  dst?: ElectronEnd;
  /**
   * An electron that goes between an atom and the electrons kept in an electrode: the atom, the
   * electrode, and which of the kept electrons' places it takes or leaves.
   */
  free?: { atom: string; plate: string; slot: number; dir: 'toPlate' | 'fromPlate' };
}

/** Where the i-th electron kept in an electrode is drawn (near the top of the plate, in two columns). */
export function plateSlot(e: { x: number; top: number }, i: number): Vec {
  return { x: e.x - 9 + (i % 2) * 18, y: e.top + 12 + Math.floor(i / 2) * 11 };
}

export type NoteTarget =
  | { kind: 'atom'; id: string }
  | { kind: 'lp'; id: string }
  | { kind: 'bond'; a: string; b: string }
  | { kind: 'group'; ids: string[] }
  | { kind: 'point'; p: Vec };

export interface NoteAnim {
  target: NoteTarget;
  text: string;
}

/** Water molecules streaming along a path (rain soaking through soil pores). */
export interface FlowAnim {
  path: Vec[];
  count: number;
  t0: number;
  t1: number;
  seed: number;
}

/** A photon (drawn as a wavy line, hν) travelling to the molecule that absorbs it. */
export interface PhotonAnim {
  p0: Vec;
  p1: Vec;
  t0: number;
  t1: number;
}

export interface StepAnim {
  index: number;
  text: string;
  line: number;
  endLine: number;
  duration: number;
  before: World;
  /** Topology while electrons are in flight (sources removed, targets not yet formed). */
  mid: World;
  after: World;
  tracks: Map<string, Keyframe[]>;
  arrows: ArrowAnim[];
  /**
   * The change window. Before b0 the things about to change are marked where they are; between
   * b0 and b1 everything changes together (electrons travel, bonds grow or shrink, lone pairs and
   * charges turn over, atoms glide from c0 to c1); after b1 the result holds.
   */
  phase: { b0: number; b1: number; c0: number; c1?: number } | null;
  notes: NoteAnim[];
  focus: Set<string>;
  trails: string[];
  flows: FlowAnim[];
  photons: PhotonAnim[];
  /** Electrons running along the external wire (electrode stage). */
  wires: { path: Vec[]; count: number; t0: number; t1: number; from?: string; to?: string }[];
  /** Vapour bubbles rising through a liquid (boiling). */
  bubbles: { p0: Vec; p1: Vec; r: number; t0: number; t1: number }[];
  /** Bonds that change part-way through a step (collective mode): order 0 removes the bond. */
  events: { t: number; a: string; b: string; order: number }[];
  /** Molecule counts over the step (collective mode). */
  tally: { t: number; counts: [string, number][] }[];
  appear: Set<string>;
  lens?: Partial<Lens>;
  /**
   * A net reaction drawn without its mechanism still has a clear outcome for each electron pair:
   * which atoms hold it afterwards. Only the 'pairs' style draws these (as pouches changing ends).
   */
  shifts?: { src: ElectronEnd; dst: ElectronEnd }[];
  /** Atoms that are drawn together in this step: the one that comes (a) and the one it comes to (b). */
  pulls?: { a: string; b: string }[];
  /** Energy before and after the step (energy diagram); barrier = height of the hump above `from`. */
  energy?: { from: number; to: number; barrier?: number; unit: string };
  /**
   * Atoms snatched from one molecule by another in this step (see SNATCH): the pair that held the
   * atom lets go first, the atom crosses bare, and the taker's pair closes on it as it lands.
   * `t0`..`t1`: the part of the step in which that happens (the two pairs' part of the change window).
   */
  handed?: { id: string; from: string; to: string; t0: number; t1: number; reach?: ReachKind }[];
  /** The moment (step time) at which the reaction happens: the new bond closes, the two ions touch. */
  strike?: number;
  /**
   * Every change of bonds in this step is one event (CompileOptions.instant): what will change is
   * under strain until the instant, and then pairs, atoms, charge and heat all change at once, by
   * this profile (reachOf). Every pair of the step keeps this one clock.
   */
  instant?: ReachKind;
  /** When the step has several such instants (single electrons that leap one after another): each of them. */
  strikes?: number[];
  /** Heat given off (negative) or taken in (positive) at `strike`, in kJ per mole of this reaction. */
  heat?: number;
}

/**
 * Where the molecule-count chart of collective mode sits: the stage's top-right corner.
 * Shared by the compiler (molecules keep out of it) and the renderer (draws it there).
 */
export function tallyBox(stageWidth: number): { x: number; y: number; w: number; h: number } {
  const s = stageWidth / 1000;
  const w = 318 * s;
  const h = 104 * s;
  return { x: stageWidth - 20 * s - w, y: 20 * s, w, h };
}

export interface Timeline {
  title: string;
  /** What the scene is about, in a sentence or two (`intro "…"`), shown above the stage. */
  intro?: string;
  stage: StageDef;
  initial: World;
  steps: StepAnim[];
  warnings: Diag[];
}
