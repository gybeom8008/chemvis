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
  appear: Set<string>;
  lens?: Partial<Lens>;
}

export interface Timeline {
  title: string;
  stage: StageDef;
  initial: World;
  steps: StepAnim[];
  warnings: Diag[];
}
