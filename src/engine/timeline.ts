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

/** A curved electron arrow and the electrons travelling along it. */
export interface ArrowAnim {
  /** 'pair' = two electrons (full arrowhead), 'single' = one electron (fishhook). */
  kind: 'pair' | 'single';
  p0: Vec;
  c: Vec;
  p1: Vec;
  line: number;
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
  /** Phase boundaries when electron arrows are present. */
  phase: { b0: number; b1: number; c0: number } | null;
  notes: NoteAnim[];
  focus: Set<string>;
  trails: string[];
  flows: FlowAnim[];
  photons: PhotonAnim[];
  /** Electrons running along the external wire (electrode stage). */
  wires: { path: Vec[]; count: number; t0: number; t1: number }[];
  /** Vapour bubbles rising through a liquid (boiling). */
  bubbles: { p0: Vec; p1: Vec; r: number; t0: number; t1: number }[];
  /** Bonds that change part-way through a step (collective mode): order 0 removes the bond. */
  events: { t: number; a: string; b: string; order: number }[];
  /** Molecule counts over the step (collective mode). */
  tally: { t: number; counts: [string, number][] }[];
  appear: Set<string>;
  lens?: Partial<Lens>;
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
