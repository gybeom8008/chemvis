import type { Diag } from '../dsl/parser';
import type { StageDef } from '../stage/stages';
import type { Vec } from '../util/math';
import type { Lens, World } from './world';

export interface Keyframe {
  t: number;
  x: number;
  y: number;
  /** Ease the segment that ends at this keyframe. */
  ease?: boolean;
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
