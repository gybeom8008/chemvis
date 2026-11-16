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

/** pairs 렌더러가 같은 원자에서 출발하는 홑전자를 차례로 보내는 진행률이다. */
export function hopProgress(phase: { b0: number; b1: number }, index: number, count: number, t: number): number {
  const fraction = clamp((t - phase.b0) / Math.max(1e-9, phase.b1 - phase.b0), 0, 1);
  return smooth(clamp((fraction * count - index) / 0.8, 0, 1));
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
  handed?: { id: string; from: string; to: string; t0: number; t1: number }[];
  /** The moment (step time) at which the reaction happens: the new bond closes, the two ions touch. */
  strike?: number;
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
  stage: StageDef;
  initial: World;
  steps: StepAnim[];
  warnings: Diag[];
}
