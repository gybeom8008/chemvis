/**
 * Turns a parsed script into a timeline: the world before and after every
 * step plus the motion that connects them. Every command explains what moves
 * where; the compiler derives products, charges and drawing positions, and
 * checks the chemistry (electron counts, charge balance) as it goes.
 */
import { ELECTRONEGATIVITY, METALS, bondLength, element } from '../chem/elements';
import { domainsInWorld, lonePairDirsInWorld, placeNew, relayout } from '../chem/geometry';
import { SmilesError } from '../chem/smiles';
import { formulaCharge, lookupMolecule, normalizeFormula } from '../chem/library';
import { parse, type Cmd, type Diag, type StepAst } from '../dsl/parser';
import { STAGES, channelArcAtY, getStage, inRegion, randomInRegion, regionCenter, type Region, type StageDef } from '../stage/stages';
import {
  add,
  angleOf,
  centroid,
  clamp,
  dist,
  fromAngle,
  lerp,
  lerpV,
  norm,
  perp,
  polyAt,
  polyLength,
  polyNearest,
  polySlice,
  rotate,
  scale,
  smooth,
  sub,
  wrap,
  type Vec,
} from '../util/math';
import { Rng } from '../util/rng';
import type { ArrowAnim, Keyframe, NoteTarget, StepAnim, Timeline } from './timeline';
import { hopProgress, tallyBox, trackAt as trackPos } from './timeline';
import {
  sameFormula,
  allComponents,
  anchorOf,
  bondKey,
  centerOf,
  cloneWorld,
  component,
  componentCharge,
  electronCount,
  emptyWorld,
  formulaOf,
  formalCharge,
  getBond,
  neighbors,
  type Atom,
  type World,
} from './world';

export interface CompileResult {
  timeline: Timeline | null;
  errors: Diag[];
  warnings: Diag[];
}

export interface EngineEffect {
  kind: 'precipitate';
  stepIndex: number;
  crystalName: string;
  addedAtomIds: string[];
  onto: boolean;
}

export type CompileFromResult =
  | { timeline: Timeline; end: World; effects: EngineEffect[]; errors: []; warnings: Diag[] }
  | { timeline: null; end: null; effects: []; errors: Diag[]; warnings: Diag[] };

export type AddSpeciesResult =
  | { world: World; addedAtomIds: string[]; errors: [] }
  | { world: null; addedAtomIds: []; errors: Diag[] };

/** Bump when continuation geometry/random choices change; independent of scene titles. */
const CONTINUATION_VERSION = 'chemvis-compile-from-v1';
const CREATION_OPS = new Set(['mol', 'place', 'load', 'crystal', 'crowd', 'metal', 'electrode', 'protein']);

/** Stable input encoding: Map/object insertion order must not choose a random seed. */
function canonical(value: unknown): string {
  const ordered = (v: unknown): unknown => {
    if (v instanceof Map) return [...v].sort(([a], [b]) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)
      .map(([k, x]) => [k, ordered(x)]);
    if (v instanceof Set) return [...v].sort().map(ordered);
    if (Array.isArray(v)) return v.map(ordered);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .filter(([, x]) => typeof x !== 'function').map(([k, x]) => [k, ordered(x)]));
    return v;
  };
  return JSON.stringify(ordered(value));
}

/** Validate stored references before a command can dereference them. No chemical rule selection here. */
function worldErrors(w: World): Diag[] {
  const errors: Diag[] = [];
  const bad = (message: string) => errors.push({ line: 1, message });
  for (const [id, a] of w.atoms) {
    if (id !== a.id || !Number.isFinite(a.x) || !Number.isFinite(a.y) ||
        !Number.isInteger(a.lp) || a.lp < 0 || !Number.isInteger(a.rad) || a.rad < 0) bad(`원자 '${id}'의 저장 상태가 올바르지 않아요.`);
  }
  for (const [key, b] of w.bonds) {
    if (!w.atoms.has(b.a) || !w.atoms.has(b.b) || b.a === b.b || key !== bondKey(b.a, b.b) ||
        !Number.isInteger(b.order) || b.order <= 0 || (b.dative && b.dative !== b.a && b.dative !== b.b)) bad(`결합 '${key}'의 저장 상태가 올바르지 않아요.`);
  }
  for (const [name, id] of w.names) if (!w.atoms.has(id)) bad(`이름 '${name}'이 없는 원자를 가리켜요.`);
  const solid = new Set<string>();
  for (const [name, ids] of w.crystals) for (const id of ids) {
    if (!w.atoms.has(id) || solid.has(id)) bad(`고체 '${name}'의 원자 '${id}'가 없거나 중복됐어요.`);
    solid.add(id);
  }
  for (const [id, shell] of w.attached) {
    if (!w.atoms.has(id) || shell.some((x) => !w.atoms.has(x))) bad(`수화 연결 '${id}'이 없는 원자를 가리켜요.`);
  }
  for (const site of w.sites) if (site.occupant && !w.atoms.has(site.occupant)) bad(`자리 '${site.id}'가 없는 원자를 가리켜요.`);
  if (!Number.isInteger(w.counter) || w.counter < 0 || [...w.atoms.values()].some((a) => a.num > w.counter)) bad('원자 번호의 저장 상태가 올바르지 않아요.');
  return errors;
}

/** Compile only steps against a private copy, publishing nothing if any step fails. */
export function compileFrom(base: World, stage: StageDef, steps: string, opts?: { title?: string }): CompileFromResult {
  const ast = parse(steps);
  const ctx = new Ctx();
  ctx.continuation = true;
  ctx.stage = stage;
  ctx.w = cloneWorld(base);
  ctx.errors.push(...ast.errors, ...worldErrors(base));
  for (const cmd of ast.header) ctx.errors.push({ line: cmd.line, message: 'compileFrom에는 step 블록만 적어요. 재료와 무대는 미리 준비해 주세요.' });
  for (const s of ast.steps) for (const cmd of s.cmds) if (CREATION_OPS.has(cmd.op)) {
    ctx.errors.push({ line: cmd.line, message: `compileFrom의 단계 안에서는 '${cmd.op}'으로 재료를 만들 수 없어요.` });
  }
  if (!Number.isFinite(stage.width) || !Number.isFinite(stage.height) || stage.width <= 0 || stage.height <= 0 || !stage.regions[stage.defaultRegion]) {
    ctx.errors.push({ line: 1, message: '무대의 크기나 기본 구역이 올바르지 않아요.' });
  }
  if (ctx.errors.length) return { timeline: null, end: null, effects: [], errors: ctx.errors, warnings: ctx.warnings };
  ctx.rng = new Rng(canonical([CONTINUATION_VERSION, base, stage, ast]));
  // Canonical iteration also makes solvent selection and equal-distance ties reproducible.
  const sorted = <T>(m: Map<string, T>) => new Map([...m].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  ctx.w.atoms = sorted(ctx.w.atoms);
  ctx.w.bonds = sorted(ctx.w.bonds);
  ctx.w.names = sorted(ctx.w.names);
  ctx.w.crystals = sorted(ctx.w.crystals);
  ctx.w.attached = sorted(ctx.w.attached);
  const initial = cloneWorld(base);
  if (!ast.steps.length) ctx.warnings.push({ line: 1, message: 'step이 없어서 있던 상태를 그대로 돌려줘요.' });
  const animations = compileSteps(ctx, ast.steps);
  if (ctx.errors.length) return { timeline: null, end: null, effects: [], errors: ctx.errors, warnings: ctx.warnings };
  return {
    timeline: { title: opts?.title || '제목 없는 장면', stage, initial, steps: animations, warnings: ctx.warnings },
    end: cloneWorld(animations.at(-1)?.after ?? base), effects: ctx.effects, errors: [], warnings: ctx.warnings,
  };
}

/** Add one molecular graph at an exact position; phase/aggregate creation belongs to the lab. */
export function addSpecies(base: World, formulaOrSmiles: string, name: string, at: Vec): AddSpeciesResult {
  const errors = worldErrors(base);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) errors.push({ line: 1, message: '재료 이름은 영문자로 시작하고 영문자, 숫자, 밑줄로 적어요.' });
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) errors.push({ line: 1, message: '재료 위치에는 유한한 좌표를 적어요.' });
  if (errors.length) return { world: null, addedAtomIds: [], errors };
  const ctx = new Ctx();
  ctx.continuation = true;
  ctx.w = cloneWorld(base);
  try {
    const addedAtomIds = ctx.spawn(formulaOrSmiles, name, false, at);
    return { world: ctx.w, addedAtomIds, errors: [] };
  } catch (e) {
    if (!(e instanceof ScriptError || e instanceof SmilesError)) throw e;
    return { world: null, addedAtomIds: [], errors: [{ line: 1, message: e.message }] };
  }
}

class ScriptError extends Error {}

/**
 * The timing of a reaction step. Until b0 the electrons about to move are marked where they sit.
 * From b0 to b1 they travel along their curved path, drawing the arrow behind them, while the
 * atoms hold still so the path stays clear; the bond they leave shrinks away as they go and the
 * bond they make grows in, complete as they arrive. Then (c0 to c1) the new bonds pull the atoms
 * into place while the arrow fades.
 */
const CHANGE = { b0: 0.12, b1: 0.55, c0: 0.5, c1: 0.86 };

const STEP_BASE = 2.6;
const OP_DURATION: Record<string, number> = {
  charge: 4.6,
  discharge: 4.6,
  sei: 4.2,
  approach: 2.2,
  move: 2.6,
  arrow: 2.8,
  transfer: 2.8,
  hop: 3.0,
  light: 3.0,
  ligand: 2.8,
  unligand: 2.8,
  solvate: 2.8,
  diffuse: 4.5,
  spread: 4.5,
  evaporate: 3.8,
  condense: 3.4,
  dissolve: 4.4,
  exchange: 3.6,
  leach: 5.2,
  oxidize: 3.6,
  precipitate: 4.4,
  land: 2.6,
  join: 3.0,
  leave: 3.6,
  freeze: 4.6,
  melt: 4.6,
  'gas-in': 3.6,
  'gas-out': 3.6,
  boil: 4.6,
  condensation: 3.6,
  hydrolysis: 3.6,
  cross: 3.8,
  pump: 5.0,
  osmosis: 4.8,
  wire: 3.2,
  reduce: 3.8,
  bridge: 3.6,
  rain: 3.6,
  heat: 2.4,
  cool: 2.4,
  note: 2.4,
  wait: 1.6,
  mol: 1.8,
  place: 1.8,
  lens: 1.2,
};

export interface CompileOptions {
  /**
   * Lay the motion out for the 'pairs' drawing, where an electron pair is a body that must not be
   * stretched or dragged across things: molecules come right up to each other (so a pair only has
   * to reach across a bond's length), they come in around the other molecule rather than through
   * it, and an atom that passes from one molecule to another does so quickly.
   */
  tight?: boolean;
}

export function compile(src: string, opts: CompileOptions = {}): CompileResult {
  // 거리로 선택하던 H와 물의 ID는 동선을 바꿔도 그대로여야 한다.
  // 해당 명령이 있을 때만 기존 배치로 선택 결과를 먼저 얻는다. 외부 상태는 바꾸지 않는다.
  const needsSelection = opts.tight && parse(src).steps.some((s) => s.cmds.some((c) => c.op === 'condensation' || c.op === 'hydrolysis'));
  const reference = needsSelection ? compileScene(src, opts, true).timeline : null;
  return compileScene(src, opts, false, reference);
}

function compileScene(src: string, opts: CompileOptions, selectionPass: boolean, reference: Timeline | null = null): CompileResult {
  const ast = parse(src);
  const ctx = new Ctx();
  ctx.tight = !!opts.tight;
  ctx.selectionPass = selectionPass;
  ctx.reference = reference;
  ctx.errors.push(...ast.errors);
  if (ast.errors.length) return { timeline: null, errors: ctx.errors, warnings: ctx.warnings };

  // Header: stage first, then everything else in order.
  const stageCmd = ast.header.find((c) => c.op === 'stage');
  const stageName = stageCmd?.args[0] ?? 'solution';
  const stage = getStage(stageName);
  if (!stage) {
    ctx.errors.push({
      line: stageCmd?.line ?? 1,
      message: `무대 '${stageName}'은(는) 없어요. 쓸 수 있는 무대: ${Object.keys(STAGES).join(', ')}`,
    });
    return { timeline: null, errors: ctx.errors, warnings: ctx.warnings };
  }
  ctx.stage = stage;
  ctx.w.lens.attract = stage.attractDefault;
  if (stage.sites) {
    ctx.w.sites = stage.sites.map((s, i) => ({ id: `site${i}`, ...s, occupant: null }));
  }

  let title = '';
  for (const cmd of ast.header) {
    if (cmd.op === 'stage') continue;
    ctx.line = cmd.line;
    try {
      if (cmd.op === 'scene') title = cmd.args.join(' ');
      else ctx.header(cmd);
    } catch (e) {
      if (e instanceof ScriptError || e instanceof SmilesError) ctx.errors.push({ line: cmd.line, message: e.message });
      else throw e;
    }
  }
  resolveOverlaps(ctx, new Set());
  arrangeHydrogenBonds(ctx);
  resolveOverlaps(ctx, new Set());
  const initial = cloneWorld(ctx.w);
  if (ast.steps.length === 0) {
    ctx.warnings.push({ line: 1, message: 'step이 하나도 없어서 처음 모습만 보여요.' });
  }

  const steps = compileSteps(ctx, ast.steps);

  if (ctx.errors.length) return { timeline: null, errors: ctx.errors, warnings: ctx.warnings };
  return {
    timeline: { title: title || '제목 없는 장면', stage, initial, steps, warnings: ctx.warnings },
    errors: [],
    warnings: ctx.warnings,
  };
}

/** Shared step processing; legacy compile retains its original seed, layout and diagnostics. */
function compileSteps(ctx: Ctx, input: StepAst[]): StepAnim[] {
  const steps: StepAnim[] = [];
  input.forEach((s, index) => {
    if (ctx.continuation && ctx.errors.length) return;
    const before = cloneWorld(ctx.w);
    const anim: StepAnim = {
      index,
      text: s.text,
      line: s.line,
      endLine: s.endLine,
      duration: STEP_BASE,
      before,
      mid: before,
      after: before,
      tracks: new Map(),
      arrows: [],
      phase: null,
      notes: [],
      focus: new Set(),
      trails: [],
      flows: [],
      photons: [],
      wires: [],
      bubbles: [],
      events: [],
      tally: [],
      appear: new Set(),
    };
    ctx.anim = anim;
    ctx.mid = null;
    ctx.touched = new Set();
    ctx.causalMotion.clear();
    ctx.afterCommands = [];
    ctx.batteryMode = null;
    ctx.upcoming = input[index + 1]?.cmds ?? [];
    let maxDur = 0;
    for (const cmd of s.cmds) {
      ctx.line = cmd.line;
      try {
        const crystals = ctx.continuation && cmd.op === 'precipitate'
          ? new Map([...ctx.w.crystals].map(([name, ids]) => [name, new Set(ids)])) : null;
        ctx.op(cmd);
        if (crystals) for (const [name, ids] of ctx.w.crystals) {
          const addedAtomIds = ids.filter((id) => !crystals.get(name)?.has(id));
          if (addedAtomIds.length) ctx.effects.push({ kind: 'precipitate', stepIndex: index, crystalName: name, addedAtomIds, onto: crystals.has(name) });
        }
        maxDur = Math.max(maxDur, OP_DURATION[cmd.op] ?? STEP_BASE);
      } catch (e) {
        if (e instanceof ScriptError || e instanceof SmilesError) ctx.errors.push({ line: cmd.line, message: e.message });
        else throw e;
      }
      if (ctx.continuation && ctx.errors.length) return;
    }
    anim.duration = ctx.durationOverride ?? (maxDur || STEP_BASE);
    ctx.durationOverride = null;
    if (ctx.continuation) ctx.layoutMovable = ctx.changedAtoms(before);
    ctx.finishStep(before);
    if (ctx.continuation) ctx.errors.push(...worldErrors(ctx.w).map((d) => ({ ...d, line: s.line })));
    steps.push(anim);
  });
  return steps;
}

// ---------------------------------------------------------------------------

interface ArrowEnd {
  kind: 'lp' | 'bond' | 'atom';
  a: string;
  b?: string;
}

interface HopEnd {
  kind: 'lp' | 'e' | 'bond' | 'atom';
  a: string;
  b?: string;
}

class Ctx {
  w: World = emptyWorld();
  stage!: StageDef;
  rng = new Rng('chemvis');
  errors: Diag[] = [];
  warnings: Diag[] = [];
  line = 0;
  anim: StepAnim | null = null;
  mid: World | null = null;
  touched = new Set<string>();
  /** The commands of the step after this one: how a molecule comes up to another depends on what the two do next. */
  upcoming: Cmd[] = [];
  autoCount = new Map<string, number>();
  continuation = false;
  /** See CompileOptions.tight. */
  tight = false;
  selectionPass = false;
  reference: Timeline | null = null;
  get plannedMotion(): boolean { return this.tight && !this.selectionPass; }
  effects: EngineEffect[] = [];
  /** 접촉 순서를 정한 경로는 단계 끝 배치 보정으로 앞당기지 않는다. */
  causalMotion = new Set<string>();
  afterCommands: (() => void)[] = [];
  /** null preserves legacy whole-scene cleanup; a set limits continuation cleanup. */
  layoutMovable: Set<string> | null = null;

  canLayout(ids: string[]): boolean {
    if (ids.some((id) => this.causalMotion.has(id))) return false;
    return this.layoutMovable === null || ids.some((id) => this.layoutMovable!.has(id));
  }

  changedAtoms(before: World): Set<string> {
    const changed = new Set([...this.touched, ...this.A.tracks.keys(), ...this.A.appear, ...this.drift.flatMap((d) => d.ids)]);
    for (const [id, at] of this.w.atoms) if (canonical(at) !== canonical(before.atoms.get(id))) changed.add(id);
    for (const w of [before, this.w]) {
      const other = w === before ? this.w : before;
      for (const [key, b] of w.bonds) if (canonical(b) !== canonical(other.bonds.get(key))) {
        changed.add(b.a); changed.add(b.b);
      }
      for (const [name, ids] of w.crystals) for (const id of ids) if (!other.crystals.get(name)?.includes(id)) changed.add(id);
      for (const [id, shell] of w.attached) if (canonical(shell) !== canonical(other.attached.get(id))) {
        changed.add(id); shell.forEach((x) => changed.add(x));
      }
    }
    // Include both old/new molecular components (a transferred H keeps its old ID), and shells.
    for (const w of [before, this.w]) for (const id of [...changed]) if (w.atoms.has(id)) {
      for (const x of component(w, id)) {
        changed.add(x);
        for (const sh of w.attached.get(x) ?? []) for (const y of component(w, sh)) changed.add(y);
      }
    }
    return changed;
  }

  nameInUse(name: string): boolean {
    const matches = (key: string) => key === name || key.startsWith(`${name}.`);
    return [...this.w.atoms].some(([id, a]) => matches(id) || a.owner === name) ||
      [...this.w.names.keys(), ...this.w.crystals.keys()].some(matches);
  }

  fail(msg: string): never {
    throw new ScriptError(msg);
  }

  warn(msg: string): void {
    this.warnings.push({ line: this.line, message: msg });
  }

  // ------------------------------------------------------------ header

  header(cmd: Cmd): void {
    switch (cmd.op) {
      case 'lens':
        return this.lens(cmd);
      case 'crowd':
        return this.crowd(cmd);
      case 'crystal':
        return this.crystal(cmd);
      case 'metal':
        return this.metal(cmd);
      case 'electrode':
        return this.electrode(cmd);
      case 'protein':
        return this.protein(cmd);
      case 'load':
        return this.load(cmd.args);
      case 'mol':
      case 'place':
        return this.declare(cmd, false);
      default:
        this.fail(`'${cmd.op}'은(는) 첫 step 앞에 쓸 수 없는 명령이에요. step "…" 아래에 적어 주세요.`);
    }
  }

  lens(cmd: Cmd): void {
    const [name, val] = cmd.args;
    const map: Record<string, 'charge' | 'attract' | 'numbers' | 'oxidation' | 'arrows'> = {
      charge: 'charge',
      attract: 'attract',
      numbers: 'numbers',
      oxidation: 'oxidation',
      arrows: 'arrows',
    };
    const key = map[name];
    if (!key) this.fail(`렌즈 '${name}'은(는) 없어요. 쓸 수 있는 렌즈: charge, attract, numbers, oxidation, arrows`);
    if (val !== 'on' && val !== 'off') this.fail('렌즈는 on 또는 off로 정해 주세요. 예: lens attract on');
    this.w.lens[key] = val === 'on';
    if (this.anim) this.anim.lens = { ...(this.anim.lens ?? {}), [key]: val === 'on' };
  }

  region(name: string): Region {
    const r = this.stage.regions[name];
    if (!r) {
      this.fail(
        `'${this.stage.name}' 무대에는 '${name}' 구역이 없어요. 쓸 수 있는 구역: ${Object.keys(this.stage.regions).join(', ')}`,
      );
    }
    return r;
  }

  /** crowd H2O in water 40 */
  crowd(cmd: Cmd): void {
    const a = cmd.args;
    const formula = a[0];
    if (!formula || !lookupMolecule(formula)) this.fail(`crowd 뒤에는 분자 화학식을 적어 주세요. 예: crowd H2O in water 40`);
    let region = this.region(this.stage.defaultRegion);
    let count = 30;
    for (let i = 1; i < a.length; i++) {
      if (a[i] === 'in' && a[i + 1]) region = this.region(a[++i]);
      else if (/^\d+$/.test(a[i])) count = parseInt(a[i], 10);
    }
    count = clamp(count, 0, 160);
    for (let k = 0; k < count; k++) {
      const p = this.freePoint(region, 30, 26);
      if (!p) break;
      this.spawn(formula, this.autoName(`~${normalizeFormula(formula)}`), true, p, this.rng.range(0, Math.PI * 2));
    }
  }

  /** crystal s = NaCl at bottom 4x3 / crystal s = CaCO3 at water 4x2 / crystal s = Ca2+ CO32- … */
  crystal(cmd: Cmd): void {
    const a = cmd.args;
    if (a[1] !== '=' || !a[0] || !a[2]) this.fail('결정은 이렇게 적어요: crystal s = NaCl at bottom 4x3');
    const name = a[0];
    let rest = 3;
    let ions = saltIons(a[2]);
    if (!ions && a[3] && lookupMolecule(a[2]) && lookupMolecule(a[3])) {
      ions = [normalizeFormula(a[2]), normalizeFormula(a[3])];
      rest = 4;
    }
    if (!ions || formulaCharge(ions[0]) <= 0 || formulaCharge(ions[0]) !== -formulaCharge(ions[1])) {
      this.fail(
        `'${a[2]}' 결정은 아직 못 그려요. 전하 크기가 같은 양이온·음이온 짝(NaCl, AgCl, CaCO3, CaSO4 등)만 돼요. 두 이온을 직접 적어도 돼요: crystal s = Ca2+ CO32-`,
      );
    }
    const [cat, an] = ions;
    let region = this.region(this.stage.defaultRegion);
    let nx = 4;
    let ny = 3;
    for (let i = rest; i < a.length; i++) {
      if ((a[i] === 'at' || a[i] === 'in') && a[i + 1]) region = this.region(a[++i]);
      const d = a[i].match(/^(\d+)x(\d+)$/);
      if (d) {
        nx = clamp(parseInt(d[1], 10), 1, 10);
        ny = clamp(parseInt(d[2], 10), 1, 8);
      }
    }
    // Make every ion first; the grid spacing follows from their sizes.
    const units: string[][] = [];
    let k = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const f = (i + j) % 2 === 0 ? cat : an;
        const ids = this.spawn(f, `${name}${++k}`, false, { x: 0, y: 0 });
        this.turnUpright(ids);
        units.push(ids);
      }
    }
    const big = Math.max(this.ionRadius(units[0]), this.ionRadius(units[1] ?? units[0]));
    const s = this.ionRadius(units[0]) + this.ionRadius(units[1] ?? units[0]) + 7;
    const c = regionCenter(region);
    const x0 = c.x - ((nx - 1) * s) / 2;
    const y0 = region.y + region.h - Math.max(50, big + 22) - (ny - 1) * s;
    units.forEach((ids, n) => {
      const goal = { x: x0 + (n % nx) * s, y: y0 + Math.floor(n / nx) * s };
      const d = sub(goal, centerOf(this.w, ids));
      for (const id of ids) shift(this.w.atoms.get(id)!, d);
    });
    this.w.crystals.set(name, units.flat());
    this.w.names.set(name, units[0][0]);
  }

  /** Distance from an ion's centre to the far edge of its outermost atom. */
  ionRadius(ids: string[]): number {
    const c = centerOf(this.w, ids);
    return Math.max(...ids.map((id) => {
      const at = this.w.atoms.get(id)!;
      return dist(at, c) + element(at.el).r;
    }));
  }

  /** How far to turn a polyatomic ion so one outer atom points straight up (as in a crystal). */
  uprightTurn(ids: string[]): number {
    if (ids.length < 2) return 0;
    const c = centerOf(this.w, ids);
    const outer = ids.map((id) => this.w.atoms.get(id)!).filter((at) => dist(at, c) > 4);
    if (!outer.length) return 0;
    const up = -Math.PI / 2;
    const best = outer.reduce((b, at) => (angDiff(angleOf(sub(at, c)), up) < angDiff(angleOf(sub(b, c)), up) ? at : b));
    return signedAng(angleOf(sub(best, c)), up);
  }

  turnUpright(ids: string[]): void {
    const rot = this.uprightTurn(ids);
    if (!rot) return;
    const c = centerOf(this.w, ids);
    for (const id of ids) {
      const at = this.w.atoms.get(id)!;
      const p = add(c, rotate(sub(at, c), rot));
      at.x = p.x;
      at.y = p.y;
    }
  }

  /** A crystal's ions, each as a whole molecule (including atoms added later, such as an H). */
  latticeUnits(lattice: string[]): string[][] {
    const seen = new Set<string>();
    const out: string[][] = [];
    for (const id of lattice) {
      if (seen.has(id) || !this.w.atoms.has(id)) continue;
      const c = component(this.w, id);
      c.forEach((x) => seen.add(x));
      out.push(c);
    }
    return out;
  }

  /** mol w = H2O at center / mol c x3 = Ca2+ on clay in topsoil / place Na+ in left x2 */
  declare(cmd: Cmd, inStep: boolean): void {
    const a = cmd.args;
    let names: string[];
    let formula: string;
    let rest: string[];
    let count = 1;
    if (cmd.op === 'mol') {
      const eq = a.indexOf('=');
      if (eq < 1 || !a[eq + 1]) this.fail('분자는 이렇게 적어요: mol w = H2O at center');
      const head = a.slice(0, eq);
      const mult = head.find((x) => /^x\d+$/.test(x));
      if (mult) count = parseInt(mult.slice(1), 10);
      const base = head[0];
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(base)) this.fail(`이름 '${base}'은(는) 영문자로 시작하고 영문자와 숫자만 써서 지어 주세요.`);
      formula = a[eq + 1];
      rest = a.slice(eq + 2);
      names = count === 1 ? [base] : Array.from({ length: count }, (_, i) => `${base}${i + 1}`);
    } else {
      formula = a[0];
      rest = a.slice(1);
      const mult = rest.find((x) => /^x\d+$/.test(x));
      if (mult) count = parseInt(mult.slice(1), 10);
      names = Array.from({ length: count }, () => this.autoName(normalizeFormula(formula ?? '')));
    }
    rest = rest.filter((x) => !/^x\d+$/.test(x));
    count = clamp(count, 1, 40);
    if (!formula || !lookupMolecule(formula)) this.fail(unknownFormula(formula));
    for (const n of names) if (this.w.names.has(n)) this.fail(`이름 '${n}'은(는) 이미 썼어요.`);

    const placement = this.parsePlacement(rest);
    names.forEach((name, i) => {
      if (placement.kind === 'clay') {
        const ids = this.spawn(formula, name, false, { x: 0, y: 0 });
        this.adsorbNew(ids, placement.region);
      } else {
        const p = this.placementPoint(placement, i, names.length);
        const ids = this.spawn(formula, name, false, p);
        if (inStep && this.anim) for (const id of ids) this.anim.appear.add(id);
      }
    });
  }

  parsePlacement(rest: string[]):
    | { kind: 'region'; region: Region; exact: boolean }
    | { kind: 'point'; p: Vec }
    | { kind: 'near'; ref: string; dir: string }
    | { kind: 'clay'; region: Region | null } {
    if (rest.length === 0) return { kind: 'region', region: this.region(this.stage.defaultRegion), exact: false };
    const [kw, arg, ...more] = rest;
    if (kw === 'on' && arg === 'clay') {
      const r = more[0] === 'in' && more[1] ? this.region(more[1]) : null;
      if (!this.stage.plates) this.fail(`'${this.stage.name}' 무대에는 점토가 없어요. on clay는 soil, root 무대에서 써요.`);
      return { kind: 'clay', region: r };
    }
    if (kw === 'at' && arg) {
      const xy = arg.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
      if (xy) return { kind: 'point', p: { x: parseFloat(xy[1]), y: parseFloat(xy[2]) } };
      return { kind: 'region', region: this.region(arg), exact: true };
    }
    if (kw === 'in' && arg) return { kind: 'region', region: this.region(arg), exact: false };
    if (kw === 'near' && arg) return { kind: 'near', ref: arg, dir: more[0] ?? 'right' };
    this.fail(`위치를 알아듣지 못했어요: '${rest.join(' ')}'. at 구역, in 구역, near 이름, on clay 중 하나로 적어 주세요.`);
  }

  placementPoint(
    pl: { kind: 'region'; region: Region; exact: boolean } | { kind: 'point'; p: Vec } | { kind: 'near'; ref: string; dir: string },
    i: number,
    n: number,
  ): Vec {
    if (pl.kind === 'point') return add(pl.p, { x: i * 70, y: 0 });
    if (pl.kind === 'near') {
      const ids = this.mol(pl.ref);
      const c = centerOf(this.w, ids);
      const dirs: Record<string, Vec> = {
        right: { x: 1, y: 0 },
        left: { x: -1, y: 0 },
        above: { x: 0, y: -1 },
        below: { x: 0, y: 1 },
      };
      const d = dirs[pl.dir] ?? dirs.right;
      return add(c, scale(d, 110 + i * 70));
    }
    if (pl.exact && n === 1) return regionCenter(pl.region);
    if (pl.exact) {
      const c = regionCenter(pl.region);
      return { x: c.x + (i - (n - 1) / 2) * 80, y: c.y };
    }
    return this.freePoint(pl.region, 40, 60) ?? randomInRegion(pl.region, this.rng);
  }

  /** Random point in a region, away from existing atoms. */
  freePoint(r: Region, clearance: number, margin: number): Vec | null {
    const atoms = [...this.w.atoms.values()];
    for (let tries = 0; tries < 80; tries++) {
      const p = randomInRegion(r, this.rng, margin);
      let ok = true;
      for (const a of atoms) {
        if (Math.hypot(a.x - p.x, a.y - p.y) < clearance + element(a.el).r) {
          ok = false;
          break;
        }
      }
      if (ok && this.stage.grains) ok = !this.inGrain(p, 40);
      // Keep clear of clay plates.
      for (const pl of this.stage.plates ?? []) {
        if (!ok) break;
        const u = fromAngle(pl.angle);
        const along = clamp((p.x - pl.center.x) * u.x + (p.y - pl.center.y) * u.y, -pl.length / 2, pl.length / 2);
        if (dist(p, add(pl.center, scale(u, along))) < 40) ok = false;
      }
      if (ok) return p;
    }
    return null;
  }

  inGrain(p: Vec, pad: number): boolean {
    for (const g of this.stage.grains ?? []) {
      const c = centroid(g.pts);
      const r = Math.max(...g.pts.map((q) => dist(q, c)));
      if (dist(p, c) < r + pad) return true;
    }
    return false;
  }

  autoName(base: string): string {
    let n = (this.autoCount.get(base) ?? 0) + 1;
    if (this.continuation) while (this.nameInUse(`${base}#${n}`)) n++;
    this.autoCount.set(base, n);
    return `${base}#${n}`;
  }

  spawn(formula: string, owner: string, crowd: boolean, center: Vec, rotation = 0): string[] {
    const def = lookupMolecule(formula);
    if (!def) this.fail(unknownFormula(formula));
    const ids = def.atoms.map((a) => `${owner}.${a.label}`);
    if (this.continuation && (this.nameInUse(owner) || ids.some((id) => this.nameInUse(id)))) this.fail(`이름 '${owner}' 또는 그 원자 ID가 이미 있어요.`);
    def.atoms.forEach((a, i) => {
      const atom: Atom = {
        id: ids[i],
        el: a.el,
        x: 0,
        y: 0,
        lp: a.lp,
        rad: a.rad ?? 0,
        owner,
        label: a.label,
        num: crowd ? 0 : ++this.w.counter,
        crowd,
      };
      this.w.atoms.set(atom.id, atom);
    });
    for (const [i, j, order] of def.bonds) {
      this.w.bonds.set(bondKey(ids[i], ids[j]), { a: ids[i], b: ids[j], order });
    }
    placeNew(this.w, ids, center, rotation);
    if (!crowd) this.w.names.set(owner, anchorOf(this.w, ids));
    return ids;
  }

  // ------------------------------------------------------------ references

  /** Atoms of the molecule a name or formula points to. */
  mol(word: string, prefer?: (ids: string[]) => boolean): string[] {
    const anchor = this.w.names.get(word);
    if (anchor && this.w.atoms.has(anchor)) return component(this.w, anchor);
    if (word.includes('.')) {
      const id = this.atom(word);
      return component(this.w, id);
    }
    const f = normalizeFormula(word);
    if (lookupMolecule(f) || /^[A-Z]/.test(f)) {
      const comps = allComponents(this.w).filter((c) => !this.w.atoms.get(c[0])!.crowd && sameFormula(this.w, c, f));
      comps.sort((p, q) => this.w.atoms.get(anchorOf(this.w, p))!.num - this.w.atoms.get(anchorOf(this.w, q))!.num);
      const hit = prefer ? comps.find(prefer) ?? comps[0] : comps[0];
      if (hit) return hit;
      this.fail(`장면에 ${f}이(가) 없어요. 먼저 mol이나 place로 넣어 주세요.`);
    }
    this.fail(`'${word}'이(가) 뭔지 알 수 없어요. mol로 지은 이름이나 화학식을 적어 주세요.`);
  }

  /** "w.O" → atom id. */
  atom(ref: string): string {
    const dot = ref.indexOf('.');
    if (dot < 1) this.fail(`원자는 '이름.원자'로 적어요. 예: w.O, a.H`);
    const name = ref.slice(0, dot);
    const label = ref.slice(dot + 1);
    const direct = `${name}.${label}`;
    if (this.w.atoms.has(direct)) return direct;
    const owner = this.ownerOf(name);
    const exact = `${owner}.${label}`;
    if (this.w.atoms.has(exact)) return exact;
    const cands = [...this.w.atoms.values()].filter((a) => a.owner === owner && new RegExp(`^${escapeRe(label)}\\d*$`).test(a.label));
    if (cands.length === 1) return cands[0].id;
    if (cands.length > 1) {
      this.fail(`'${ref}'이(가) 여러 개예요(${cands.map((c) => `${name}.${c.label}`).join(', ')}). 번호까지 적어 주세요.`);
    }
    const labels = [...this.w.atoms.values()].filter((a) => a.owner === owner).map((a) => a.label);
    if (labels.length === 0) this.fail(`'${name}'이라는 분자가 없어요.`);
    this.fail(`'${name}'에는 '${label}' 원자가 없어요. 있는 원자: ${labels.join(', ')}`);
  }

  ownerOf(name: string): string {
    const anchor = this.w.names.get(name);
    if (anchor) return this.w.atoms.get(anchor)?.owner ?? name;
    return name;
  }

  arrowEnd(word: string): ArrowEnd {
    if (word.endsWith(':lp')) return { kind: 'lp', a: this.atom(word.slice(0, -3)) };
    if (word.includes('~')) {
      const [x, y] = word.split('~');
      return { kind: 'bond', a: this.atom(x), b: this.atom(y) };
    }
    return { kind: 'atom', a: this.atom(word) };
  }

  // ------------------------------------------------------------ steps

  op(cmd: Cmd): void {
    const a = cmd.args;
    switch (cmd.op) {
      case 'mol':
      case 'place':
        return this.declare(cmd, true);
      case 'lens':
        return this.lens(cmd);
      case 'note':
        return this.note(a);
      case 'arrow':
        return this.arrow(a);
      case 'transfer':
        return this.transfer(a);
      case 'hop':
        return this.hop(a);
      case 'ligand':
        return this.ligand(a);
      case 'unligand':
        return this.unligand(a);
      case 'light':
        return this.light(a);
      case 'approach':
        return this.approach(a);
      case 'move':
        return this.move(a);
      case 'solvate':
        return this.solvate(a);
      case 'diffuse':
        return this.diffuse(a);
      case 'spread':
        return this.spread(a);
      case 'evaporate':
        return this.evaporate(a);
      case 'condense':
        return this.condense(a);
      case 'dissolve':
        return this.dissolve(a);
      case 'exchange':
        return this.exchange(a);
      case 'leach':
        return this.leach(a);
      case 'rain':
        return this.rain();
      case 'oxidize':
        return this.oxidize(a);
      case 'wire':
        return this.wireOp(a);
      case 'reduce':
        return this.reduce(a);
      case 'bridge':
        return this.bridgeOp(a);
      case 'ensemble':
        return this.ensemble(a);
      case 'precipitate':
        return a[0] === 'using' ? this.precipitateUsing(a) : this.precipitate(a);
      case 'land':
        return this.land(a);
      case 'join':
        return this.join(a);
      case 'leave':
        return this.leave(a);
      case 'freeze':
        return this.freeze(a);
      case 'melt':
        return this.melt(a);
      case 'gas-in':
        return this.condense(a.length ? a : ['CO2']);
      case 'gas-out':
        return this.evaporate(a.length ? a : ['CO2']);
      case 'boil':
        return this.boil(a);
      case 'condensation':
        return this.condensation(a);
      case 'hydrolysis':
        return this.hydrolysis(a);
      case 'cross':
        return this.cross(a);
      case 'pump':
        return this.pump(a);
      case 'osmosis':
        return this.osmosis(a);
      case 'heat':
      case 'cool':
        return this.temperature(cmd.op, a);
      case 'energy':
        return this.energy(a);
      case 'charge':
      case 'discharge':
        return this.shuttle(cmd.op, a);
      case 'sei':
        return this.sei(a);
      case 'wait':
        return;
      case 'crowd':
      case 'crystal':
      case 'metal':
      case 'load':
      case 'scene':
      case 'stage':
        this.fail(`${cmd.op}은(는) 첫 step 앞에 적어야 해요.`);
      default:
        this.fail(`'${cmd.op}'은(는) 모르는 명령이에요. 쓸 수 있는 명령은 안내서(ai-guide.md)에 있어요.`);
    }
  }

  get A(): StepAnim {
    return this.anim!;
  }

  // ------------------------------------------------------------ motion helpers

  /** Atoms that travel with a molecule: the molecule plus solvent shells attached to it. */
  group(ids: string[]): string[] {
    const out = new Set(ids);
    for (const id of ids) {
      for (const sh of this.w.attached.get(id) ?? []) {
        if (this.w.atoms.has(sh)) for (const x of component(this.w, sh)) out.add(x);
      }
    }
    return [...out];
  }

  detach(ids: string[]): void {
    for (const id of ids) this.w.attached.delete(id);
    const set = new Set(ids.flatMap((i) => component(this.w, i)));
    for (const [k, l] of this.w.attached) {
      const kept = l.filter((x) => !set.has(x));
      if (kept.length) this.w.attached.set(k, kept);
      else this.w.attached.delete(k);
    }
  }

  pushKf(id: string, kf: Keyframe): void {
    const tr = this.A.tracks.get(id);
    if (!tr) {
      this.A.tracks.set(id, [kf]);
      return;
    }
    const last = tr[tr.length - 1];
    if (kf.t < last.t - 1e-6) return;
    tr.push(kf);
  }

  /**
   * Move a set of atoms rigidly along a path of the pivot, optionally turning
   * by `rotation` radians, between step times t0 and t1.
   */
  moveGroup(ids: string[], pivot: Vec, path: Vec[], rotation: number, t0: number, t1: number, turnBy = 1): void {
    const pts = resample(path, 14);
    const total = polyLength(pts) || 1;
    const fr: number[] = [0];
    for (let i = 1; i < pts.length; i++) fr.push(fr[i - 1] + dist(pts[i - 1], pts[i]) / total);
    // Where the pivot is after the fraction f of the way.
    const along = (f: number): Vec => {
      for (let i = 1; i < pts.length; i++) {
        if (f <= fr[i] || i === pts.length - 1) {
          const span = fr[i] - fr[i - 1];
          return lerpV(pts[i - 1], pts[i], span > 1e-9 ? clamp((f - fr[i - 1]) / span, 0, 1) : 1);
        }
      }
      return pts[pts.length - 1];
    };
    // Moves start and stop gently: the same stretch of time covers little ground at both ends
    // and most in the middle. The turn is finished after `turnBy` of the way.
    const N = Math.max(this.plannedMotion ? 120 : 18, pts.length);
    const offsets = ids.map((id) => {
      const at = this.w.atoms.get(id)!;
      return { id, off: sub(at, pivot), start: { x: at.x, y: at.y } };
    });
    for (const { id, off, start } of offsets) {
      const tr = this.A.tracks.get(id);
      if (!tr) {
        if (t0 > 0) this.pushKf(id, { t: 0, x: start.x, y: start.y });
        if (t0 > 0 && this.plannedMotion) this.pushKf(id, { t: t0, x: start.x, y: start.y });
      } else if (tr[tr.length - 1].t < t0) {
        const l = tr[tr.length - 1];
        this.pushKf(id, { t: t0, x: l.x, y: l.y });
      }
      if (this.tight) {
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const f = this.plannedMotion ? gentle(u) : smooth(u);
          const q = add(along(f), rotate(off, rotation * smooth(clamp(f / Math.max(turnBy, 1e-6), 0, 1))));
          if (i === 0 && this.A.tracks.get(id)?.length) continue;
          this.pushKf(id, { t: t0 + (t1 - t0) * u, x: q.x, y: q.y });
        }
      } else {
        pts.forEach((p, i) => {
          const f = fr[i];
          const t = t0 + (t1 - t0) * smooth(f);
          const q = add(p, rotate(off, rotation * f));
          if (i === 0 && this.A.tracks.get(id)?.length) return;
          this.pushKf(id, { t, x: q.x, y: q.y });
        });
      }
      const fin = add(pts[pts.length - 1], rotate(off, rotation));
      const at = this.w.atoms.get(id)!;
      at.x = fin.x;
      at.y = fin.y;
    }
  }

  /** 회전하는 분자 전체를 원자 반지름으로 검사한 뒤 우회 경로를 고른다. */
  clearRoute(ids: string[], pivot: Vec, goal: Vec, rotation: number, t0: number, t1: number,
    original: { path: Vec[]; turnBy: number }): { path: Vec[]; turnBy: number } {
    const moving = ids.map((id) => ({ off: sub(this.w.atoms.get(id)!, pivot), r: element(this.w.atoms.get(id)!.el).r }));
    const obstacles = [...this.w.atoms.values()].filter((a) => !ids.includes(a.id) && !a.crowd && !a.gone);
    const clear = (path: Vec[], turnBy: number): boolean => {
      const pts = resample(path, 14);
      const count = Math.max(120, pts.length);
      let previous: Vec[] | null = null;
      for (let i = 0; i <= count; i++) {
        const u = i / count, f = gentle(u);
        const center = polyAt(pts, f);
        const angle = rotation * smooth(clamp(f / turnBy, 0, 1));
        const positions = moving.map((a) => add(center, rotate(a.off, angle)));
        for (let j = 0; j < moving.length; j++) for (const o of obstacles) {
          const tr = this.A.tracks.get(o.id);
          const at = (v: number) => tr ? trackPos(tr, t0 + (t1 - t0) * v) : o;
          const min = moving[j].r + element(o.el).r - 0.5;
          if (dist(positions[j], at(u)) < min) return false;
          // 실제 렌더러가 직선 보간하는 표본 사이도 확인한다.
          if (previous && dist(lerpV(previous[j], positions[j], 0.5), at((i - 0.5) / count)) < min) return false;
        }
        previous = positions;
      }
      return true;
    };
    if (clear(original.path, original.turnBy)) return original;
    const candidates: { path: Vec[]; turnBy: number; length: number }[] = [];
    for (const radius of [60, 110, 180]) for (let i = 0; i < 16; i++) {
      const offset = fromAngle(i * Math.PI / 8, radius);
      for (const points of [[pivot, add(lerpV(pivot, goal, 0.5), offset), goal],
        [pivot, add(pivot, offset), add(goal, offset), goal]]) {
        const path = rounded(points, 3);
        const length = polyLength(path);
        for (const turnBy of [0.2, 0.5, 0.8, 1]) candidates.push({ path, turnBy, length });
      }
    }
    candidates.sort((a, b) => a.length - b.length);
    for (const candidate of candidates) if (clear(candidate.path, candidate.turnBy)) return candidate;
    // 정해진 후보만 비교하므로 모든 입력에서 충돌 없는 경로를 보장하지는 않는다.
    return original;
  }

  /** Random-looking walk from p0 to p1 (for diffusion), kept inside a region. */
  wander(p0: Vec, p1: Vec, r: Region | null, wiggle = 1): Vec[] {
    const n = 12;
    const pts: Vec[] = [p0];
    const amp = Math.min(48, dist(p0, p1) / 5 + 16) * wiggle;
    for (let i = 1; i < n; i++) {
      const base = lerpV(p0, p1, i / n);
      let q = { x: base.x + this.rng.range(-amp, amp), y: base.y + this.rng.range(-amp, amp) };
      if (r) q = { x: clamp(q.x, r.x + 24, r.x + r.w - 24), y: clamp(q.y, r.y + 24, r.y + r.h - 24) };
      pts.push(q);
    }
    pts.push(p1);
    // Round the corners (three times): a particle drifts, it does not turn on the spot, and the trail it
    // leaves should read as one path rather than a zigzag.
    let out = pts;
    for (let pass = 0; pass < 3; pass++) {
      const next: Vec[] = [out[0]];
      for (let i = 0; i + 1 < out.length; i++) {
        next.push(lerpV(out[i], out[i + 1], 0.25), lerpV(out[i], out[i + 1], 0.75));
      }
      next.push(out[out.length - 1]);
      out = next;
    }
    return out;
  }

  focus(ids: string[]): void {
    for (const id of ids) this.A.focus.add(id);
  }

  /** Mark a whole molecule as the subject of a step (one ring on its main atom). */
  focusMol(ids: string[]): void {
    this.A.focus.add(anchorOf(this.w, ids));
  }

  // ------------------------------------------------------------ ops: notes & bonds

  note(a: string[]): void {
    const [ref, text] = a;
    if (!ref || text === undefined) this.fail('note는 이렇게 적어요: note w.O:lp "비공유 전자쌍"');
    this.A.notes.push({ target: this.noteTarget(ref), text });
  }

  noteTarget(ref: string): NoteTarget {
    if (ref.endsWith(':lp')) {
      const id = this.atom(ref.slice(0, -3));
      if (this.w.atoms.get(id)!.lp === 0) this.fail(`${ref.slice(0, -3)}에는 비공유 전자쌍이 없어요.`);
      return { kind: 'lp', id };
    }
    if (ref.includes('~')) {
      const [x, y] = ref.split('~');
      const ia = this.atom(x);
      const ib = this.atom(y);
      if (!getBond(this.w, ia, ib)) this.fail(`${x}와 ${y}는 결합해 있지 않아요.`);
      return { kind: 'bond', a: ia, b: ib };
    }
    if (ref.includes('.')) return { kind: 'atom', id: this.atom(ref) };
    if (this.stage.regions[ref]) return { kind: 'point', p: regionCenter(this.stage.regions[ref]) };
    if (ref === 'clay' && this.w.sites.length) {
      const s = this.w.sites[0];
      return { kind: 'point', p: { x: s.x, y: s.y } };
    }
    if (ref === 'surface' && this.stage.surfaceY) return { kind: 'point', p: { x: 500, y: this.stage.surfaceY } };
    if (this.w.crystals.has(ref)) return { kind: 'group', ids: [...this.w.crystals.get(ref)!] };
    const prot = this.w.proteins.find((p) => p.name === ref);
    if (prot && this.stage.membrane) {
      return { kind: 'point', p: { x: prot.x, y: this.stage.membrane.y0 - 30 } };
    }
    return { kind: 'group', ids: this.mol(ref) };
  }

  ensureMid(): World {
    if (!this.mid) {
      this.mid = cloneWorld(this.A.before);
      this.A.mid = this.mid;
    }
    return this.mid;
  }

  /** arrow SRC -> DST : one electron pair moves. */
  arrow(a: string[]): void {
    if (a.length !== 3 || (a[1] !== '->' && a[1] !== '→')) {
      this.fail('화살표는 이렇게 적어요: arrow w.O:lp -> w.O~a.H  (출발: 원자:lp 또는 원자~원자, 도착: 원자 또는 원자~원자)');
    }
    const src = this.arrowEnd(a[0]);
    const dst = this.arrowEnd(a[2]);
    this.applyArrow(src, dst);
  }

  applyArrow(src: ArrowEnd, dst: ArrowEnd, dative = false): void {
    const w = this.w;
    const before = this.A.before;
    const mid = this.ensureMid();
    // Validate shape.
    if (src.kind === 'atom') this.fail('화살표는 비공유 전자쌍(w.O:lp)이나 결합(a.H~a.Cl)에서 출발해야 해요.');
    if (dst.kind === 'lp') this.fail('도착점은 :lp 없이 원자(a.Cl)나 새 결합(w.O~a.H)으로 적어 주세요.');
    if (src.kind === 'lp') {
      if (w.atoms.get(src.a)!.lp <= 0) this.fail(`${label(w, src.a)}에는 옮길 비공유 전자쌍이 없어요.`);
      if (dst.kind === 'atom') {
        this.fail('비공유 전자쌍은 다른 원자로 통째로 옮겨 갈 수 없어요. 새 결합(예: w.O~a.H)으로 보내 주세요.');
      }
      if (dst.a !== src.a && dst.b !== src.a) {
        this.fail(`비공유 전자쌍은 ${label(w, src.a)}에서 이어지는 결합으로만 갈 수 있어요.`);
      }
    } else {
      const bnd = getBond(w, src.a, src.b!);
      if (!bnd || bnd.order <= 0) this.fail(`${label(w, src.a)}와 ${label(w, src.b!)}는 결합해 있지 않아요.`);
      if (dst.kind === 'atom' && dst.a !== src.a && dst.a !== src.b) {
        this.fail('결합 전자쌍은 그 결합을 이루는 두 원자 가운데 하나로만 갈 수 있어요.');
      }
      if (dst.kind === 'bond') {
        const share = [dst.a, dst.b].some((x) => x === src.a || x === src.b);
        if (!share) this.fail('결합 전자쌍은 그 결합을 이루는 원자에서 이어지는 새 결합으로만 갈 수 있어요.');
      }
    }

    // Geometry from the "before" picture.
    const P = (id: string) => before.atoms.get(id) ?? w.atoms.get(id)!;
    let p0: Vec;
    let p1: Vec;
    const dstPoint = (): Vec => {
      if (dst.kind === 'atom') {
        const other = src.kind === 'bond' ? (src.a === dst.a ? src.b! : src.a) : dst.a;
        const at = P(dst.a);
        const toward = norm(sub(P(other), at));
        return add(at, scale(toward, element(at.el).r + 7));
      }
      return lerpV(P(dst.a), P(dst.b!), 0.5);
    };
    p1 = dstPoint();
    if (src.kind === 'bond' && dst.kind === 'atom') {
      // The pair slides off the bond onto the atom: end the arrow on the atom's side so it stays visible.
      const at = P(dst.a);
      const other = P(src.a === dst.a ? src.b! : src.a);
      const base = angleOf(sub(other, at));
      const rest = neighbors(before.atoms.has(dst.a) ? before : w, dst.a)
        .filter((n) => n.id !== src.a && n.id !== src.b)
        .map((n) => angleOf(sub(P(n.id), at)));
      const score = (ang: number) => Math.min(Math.PI, ...rest.map((r) => angDiff(r, ang)));
      const cand = [base + 1.15, base - 1.15];
      const best = score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1];
      p1 = add(at, fromAngle(best, element(at.el).r + 7));
    }
    if (src.kind === 'lp') {
      const at = P(src.a);
      const dirs = lonePairDirsInWorld(before.atoms.has(src.a) ? before : w, src.a, P(src.a).lp);
      const want = angleOf(sub(p1, at));
      let best = dirs[0] ?? want;
      for (const d of dirs) if (angDiff(d, want) < angDiff(best, want)) best = d;
      p0 = add(at, fromAngle(best, element(at.el).r + 6));
    } else {
      p0 = lerpV(P(src.a), P(src.b!), 0.5);
    }
    const involved = [src.a, src.b, dst.a, dst.b].filter(Boolean).map((id) => P(id!));
    const cen = centroid(involved);
    const mm = lerpV(p0, p1, 0.5);
    let side = perp(norm(sub(p1, p0)));
    if (dist(add(mm, side), cen) < dist(add(mm, scale(side, -1)), cen)) side = scale(side, -1);
    const bow = Math.max(30, dist(p0, p1) * 0.5);
    const c = add(mm, scale(side, bow));
    const arrow: ArrowAnim = {
      kind: 'pair',
      p0,
      c,
      p1,
      line: this.line,
      src: { kind: src.kind === 'lp' ? 'lp' : 'bond', a: src.a, ...(src.b ? { b: src.b } : {}) },
      dst: { kind: dst.kind === 'bond' ? 'bond' : 'atom', a: dst.a, ...(dst.b ? { b: dst.b } : {}) },
    };
    this.A.arrows.push(arrow);

    // Topology: remove from source (both in mid and final), add to destination (final only).
    for (const world of [mid, w]) {
      if (src.kind === 'lp') world.atoms.get(src.a)!.lp -= 1;
      else {
        const b = getBond(world, src.a, src.b!)!;
        b.order -= 1;
        if (b.order <= 0) world.bonds.delete(bondKey(src.a, src.b!));
      }
    }
    if (dst.kind === 'atom') w.atoms.get(dst.a)!.lp += 1;
    else {
      const k = bondKey(dst.a, dst.b!);
      const b = w.bonds.get(k);
      if (b) b.order += 1;
      else w.bonds.set(k, { a: dst.a, b: dst.b!, order: 1, ...(dative && src.kind === 'lp' ? { dative: src.a } : {}) });
    }
    for (const id of [src.a, src.b, dst.a, dst.b]) if (id) this.touched.add(id);
    this.A.phase = { ...CHANGE };
    this.focus([...this.touched]);
  }

  /** ligand n.N -> c.Cu : the ligand's lone pair forms a coordinate bond to the metal. */
  ligand(a: string[]): void {
    if (a.length !== 3 || (a[1] !== '->' && a[1] !== '→')) this.fail('배위 결합은 이렇게 적어요: ligand n.N -> c.Cu  (전자쌍을 내주는 원자 -> 금속)');
    const donor = this.atom(a[0].replace(/:lp$/, ''));
    const metal = this.atom(a[2]);
    if (this.w.atoms.get(donor)!.lp <= 0) this.fail(`${a[0]}에는 내줄 비공유 전자쌍이 없어요.`);
    if (getBond(this.w, donor, metal)) this.fail(`${a[0]}와 ${a[2]}는 이미 결합해 있어요.`);
    this.applyArrow({ kind: 'lp', a: donor }, { kind: 'bond', a: donor, b: metal }, true);
  }

  /** unligand c.Cu~n.N : a coordinate bond breaks; the pair returns to the ligand. */
  unligand(a: string[]): void {
    const ref = a[0];
    if (!ref || !ref.includes('~')) this.fail('배위 결합을 없애려면 이렇게 적어요: unligand c.Cu~n.N');
    const [x, y] = ref.split('~').map((r) => this.atom(r));
    const b = getBond(this.w, x, y);
    if (!b) this.fail(`${ref}는 결합해 있지 않아요.`);
    const donor = b.dative ?? (METALS.has(this.w.atoms.get(x)!.el) ? y : x);
    this.applyArrow({ kind: 'bond', a: x, b: y }, { kind: 'atom', a: donor });
  }

  /** transfer a.H to w.O : the acceptor's lone pair takes the H, the old bond's pair stays behind. */
  transfer(a: string[]): void {
    const [hRef, kw, accRef] = a;
    if (!hRef || kw !== 'to' || !accRef) this.fail('양성자 이동은 이렇게 적어요: transfer a.H to w.O');
    const h = this.atom(hRef);
    const acc = this.atom(accRef);
    if (this.w.atoms.get(h)!.el !== 'H') this.fail(`${hRef}는 수소 원자가 아니에요. transfer는 H(양성자)를 옮길 때 써요.`);
    const ns = neighbors(this.w, h);
    this.applyArrow({ kind: 'lp', a: acc }, { kind: 'bond', a: acc, b: h });
    if (ns.length === 1) this.applyArrow({ kind: 'bond', a: h, b: ns[0].id }, { kind: 'atom', a: ns[0].id });
  }

  // ------------------------------------------------------------ ops: single electrons

  hopEnd(word: string, isSource: boolean): HopEnd {
    if (word.endsWith(':lp') || word.endsWith(':e')) {
      if (!isSource) this.fail('도착점은 :lp나 :e 없이 원자(c.Cu)나 결합(c.Cl~m.H)으로 적어 주세요.');
      const kind = word.endsWith(':lp') ? 'lp' : 'e';
      return { kind, a: this.atom(word.slice(0, word.lastIndexOf(':'))) };
    }
    if (word.includes('~')) {
      const [x, y] = word.split('~');
      return { kind: 'bond', a: this.atom(x), b: this.atom(y) };
    }
    return { kind: 'atom', a: this.atom(word) };
  }

  /**
   * hop [N] SRC -> DST : one electron moves (fishhook arrow); N repeats it.
   * Sources: atom (its unpaired electron first, else one from a lone pair), atom:e, atom:lp,
   * or a bond (one of its two electrons). Destinations: an atom or a bond (new or existing).
   */
  hop(a: string[]): void {
    let i = 0;
    let n = 1;
    if (/^\d+$/.test(a[0] ?? '')) {
      n = clamp(parseInt(a[0], 10), 1, 4);
      i = 1;
    }
    if (a.length - i !== 3 || (a[i + 1] !== '->' && a[i + 1] !== '→')) {
      this.fail('전자 하나의 이동은 이렇게 적어요: hop z.Zn -> c.Cu  ·  hop 2 z.Zn -> c.Cu  ·  hop c.Cl1~c.Cl2 -> c.Cl1');
    }
    const src = this.hopEnd(a[i], true);
    const dst = this.hopEnd(a[i + 2], false);
    for (let k = 0; k < n; k++) this.applyHop(src, dst);
    this.lastHopLine = this.line;
  }

  lastHopLine = 0;
  hopCount = new Map<string, number>();

  applyHop(src: HopEnd, dst: HopEnd): void {
    const w = this.w;
    const before = this.A.before;
    const mid = this.ensureMid();
    const S = w.atoms.get(src.a)!;
    // What is there to move?
    if (src.kind === 'e' && S.rad <= 0) this.fail(`${label(w, src.a)}에는 홑전자가 없어요.`);
    if (src.kind === 'lp' && S.lp <= 0) this.fail(`${label(w, src.a)}에는 비공유 전자쌍이 없어요.`);
    if (src.kind === 'atom' && S.rad <= 0 && S.lp <= 0) this.fail(`${label(w, src.a)}에는 옮길 비결합 전자가 없어요.`);
    if (src.kind === 'bond') {
      const b = getBond(w, src.a, src.b!);
      if (!b || b.order < 0.5) this.fail(`${label(w, src.a)}와 ${label(w, src.b!)} 사이에 옮길 결합 전자가 없어요.`);
    }
    if (dst.kind === 'atom' && src.kind !== 'bond' && dst.a === src.a) this.fail('전자가 출발한 원자로 다시 가게 적혔어요.');
    if (dst.kind === 'bond') {
      const srcAtoms = src.kind === 'bond' ? [src.a, src.b!] : [src.a];
      if (!srcAtoms.some((x) => x === dst.a || x === dst.b)) {
        this.fail('전자는 출발한 원자(결합에서 출발했다면 그 결합의 원자)에서 이어지는 결합으로만 갈 수 있어요.');
      }
    }

    // Geometry from the "before" picture.
    const P = (id: string) => before.atoms.get(id) ?? w.atoms.get(id)!;
    const srcKey = src.kind === 'bond' ? bondKey(src.a, src.b!) : src.a;
    const dstKey = dst.kind === 'bond' ? bondKey(dst.a, dst.b!) : dst.a;
    const fromSame = this.hopCount.get(srcKey) ?? 0;
    this.hopCount.set(srcKey, fromSame + 1);
    const pairKey = `${srcKey}>${dstKey}`;
    const same = this.hopCount.get(pairKey) ?? 0;
    this.hopCount.set(pairKey, same + 1);

    // For electrons leaving a bond: the open side of the bond (away from the rest of the molecule, else up).
    let bondSide: Vec | null = null;
    if (src.kind === 'bond') {
      const A0 = P(src.a);
      const B0 = P(src.b!);
      let side = perp(norm(sub(B0, A0)));
      const others = [...neighbors(before, src.a), ...neighbors(before, src.b!)]
        .map((x) => x.id)
        .filter((id) => id !== src.a && id !== src.b)
        .map((id) => P(id));
      const m = lerpV(A0, B0, 0.5);
      if (others.length) {
        const c = centroid(others);
        if (dist(add(m, side), c) < dist(add(m, scale(side, -1)), c)) side = scale(side, -1);
      } else if (side.y > 0) side = scale(side, -1);
      bondSide = side;
    }
    let p1: Vec;
    if (dst.kind === 'bond') p1 = lerpV(P(dst.a), P(dst.b!), 0.5);
    else if (src.kind === 'bond' && bondSide && (dst.a === src.a || dst.a === src.b)) {
      // The electron slides off the bond onto one of its atoms, ending on that atom's open outer side.
      const at = P(dst.a);
      const away = norm(sub(at, lerpV(P(src.a), P(src.b!), 0.5)));
      p1 = add(at, scale(norm(add(scale(bondSide, 0.9), scale(away, 0.55))), element(at.el).r + 7));
    } else {
      const at = P(dst.a);
      p1 = add(at, scale(norm(sub(P(src.a), at)), element(at.el).r + 7));
    }
    let p0: Vec;
    if (src.kind === 'bond') {
      const m = lerpV(P(src.a), P(src.b!), 0.5);
      const along = norm(sub(P(src.b!), P(src.a)));
      // The two electrons of the bond start side by side, just off the bond line.
      p0 = add(add(m, scale(bondSide!, 4)), scale(along, fromSame % 2 ? 3.5 : -3.5));
    } else {
      const at = P(src.a);
      const doms = domainsInWorld(before.atoms.has(src.a) ? before : w, src.a);
      const wantSingle = src.kind === 'e' || (src.kind === 'atom' && P(src.a).rad > 0);
      let cands = doms.filter((d) => d.single === wantSingle);
      if (!cands.length) cands = doms;
      const want = angleOf(sub(p1, at));
      const best = cands.reduce((b, d) => (angDiff(d.angle, want) < angDiff(b.angle, want) ? d : b), cands[0]);
      const ang = best ? best.angle : want;
      p0 = add(add(at, fromAngle(ang, element(at.el).r + 6)), fromAngle(ang + Math.PI / 2, fromSame % 2 ? -3.3 : 3.3));
    }
    const involved = [src.a, src.b, dst.a, dst.b].filter(Boolean).map((id) => P(id!));
    const cen = centroid(involved);
    const mm = lerpV(p0, p1, 0.5);
    let side = perp(norm(sub(p1, p0)));
    if (bondSide) {
      // Electrons leaving a bond arc out over its open side.
      if (side.x * bondSide.x + side.y * bondSide.y < 0) side = scale(side, -1);
    } else {
      if (dist(add(mm, side), cen) < dist(add(mm, scale(side, -1)), cen)) side = scale(side, -1);
      if (same % 2 === 1) side = scale(side, -1);
    }
    const bow = Math.max(bondSide ? 22 : 30, dist(p0, p1) * 0.45) * (1 + 0.3 * Math.floor(same / 2));
    this.A.arrows.push({
      kind: 'single',
      p0,
      c: add(mm, scale(side, bow)),
      p1,
      line: this.line,
      src: { kind: src.kind, a: src.a, ...(src.b ? { b: src.b } : {}) },
      dst: { kind: dst.kind === 'bond' ? 'bond' : 'atom', a: dst.a, ...(dst.b ? { b: dst.b } : {}) },
    });

    // Electron bookkeeping: take one from the source (mid and final), give one to the destination.
    const takeOne = (world: World, inFlight: boolean) => {
      const at = world.atoms.get(src.a)!;
      const lone = neighbors(world, src.a).length === 0;
      if (src.kind === 'e' || (src.kind === 'atom' && at.rad > 0 && inFlight && lone)) {
        // An unpaired electron leaves; while in flight its place stays empty.
        at.rad -= 1;
        if (inFlight && lone) at.skip = (at.skip ?? 0) + 1;
      } else if (src.kind === 'lp') {
        at.lp -= 1;
        at.rad += 1;
      } else if (src.kind === 'atom') {
        if (at.rad > 0) at.rad -= 1;
        else {
          at.lp -= 1;
          at.rad += 1;
        }
      } else {
        const b = getBond(world, src.a, src.b!)!;
        b.order -= 0.5;
        if (b.order <= 1e-9) world.bonds.delete(bondKey(src.a, src.b!));
      }
    };
    takeOne(mid, true);
    takeOne(w, false);
    if (dst.kind === 'atom') {
      const at = w.atoms.get(dst.a)!;
      if (at.rad > 0) {
        at.rad -= 1;
        at.lp += 1;
      } else at.rad += 1;
    } else {
      const k = bondKey(dst.a, dst.b!);
      const b = w.bonds.get(k);
      if (b) b.order += 0.5;
      else w.bonds.set(k, { a: dst.a, b: dst.b!, order: 0.5 });
    }
    for (const id of [src.a, src.b, dst.a, dst.b]) if (id) this.touched.add(id);
    this.A.phase = { ...CHANGE };
    this.focus([...this.touched]);
  }

  /** light c : a photon (hν) arrives and is absorbed. */
  light(a: string[]): void {
    const ref = a[0];
    if (!ref) this.fail('빛 흡수는 이렇게 적어요: light c  (분자 이름이나 원자)');
    const ids = ref.includes('.') ? [this.atom(ref)] : this.mol(ref);
    const p1 = centerOf(this.w, ids);
    const p0 = add(p1, { x: -170, y: -115 });
    this.A.photons.push({ p0, p1, t0: 0, t1: 0.2 });
    this.focusMol(ids);
  }

  // ------------------------------------------------------------ ops: moving whole molecules

  /** approach w.O a.H : bring w so that its O (lone pair first) faces a.H. */
  approach(a: string[]): void {
    const [mRef, tRef] = a;
    if (!mRef || !tRef) this.fail('approach는 이렇게 적어요: approach w.O a.H (다가가는 원자, 목표 원자)');
    const mover = this.atom(mRef);
    const target = this.atom(tRef);
    const comp = component(this.w, mover);
    if (comp.includes(target)) this.fail('같은 분자 안의 원자끼리는 approach를 쓰지 않아요.');
    const ids = this.group(comp);
    const T = this.w.atoms.get(target)!;
    const M = this.w.atoms.get(mover)!;
    const tn = neighbors(this.w, target).map((n) => this.w.atoms.get(n.id)!);
    let dir: Vec;
    // Come in from the target's open side. If its bonds are spread evenly (no open side), come in
    // through a gap between two of them, so that nothing stands between the two atoms: the widest
    // gap, away from the neighbour that pulls electrons hardest (the one likely to leave), and
    // otherwise on the side the mover is already on.
    if (tn.length && dist(T, centroid(tn)) > 6) dir = norm(sub(T, centroid(tn)));
    else if (tn.length >= 2) {
      const angs = tn.map((n) => Math.atan2(n.y - T.y, n.x - T.x)).sort((p, q) => p - q);
      const greedy = tn.reduce((b, n) => ((ELECTRONEGATIVITY[n.el] ?? 0) > (ELECTRONEGATIVITY[b.el] ?? 0) ? n : b), tn[0]);
      const away = Math.atan2(greedy.y - T.y, greedy.x - T.x);
      const side = Math.atan2(M.y - T.y, M.x - T.x);
      let best = side;
      let bestScore = -Infinity;
      angs.forEach((a0, i) => {
        const a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI;
        const mid = (a0 + a1) / 2;
        const score = (a1 - a0) + 0.5 * angDiff(mid, away) - 0.2 * angDiff(mid, side);
        if (score > bestScore) {
          bestScore = score;
          best = mid;
        }
      });
      dir = fromAngle(best);
    } else dir = norm(sub(M, T));
    // Tight: so close that the pair which reaches across has only a bond's length to go.
    const gap = element(T.el).r + element(M.el).r + (this.tight ? 15 : 58);
    const mn = neighbors(this.w, mover).map((n) => this.w.atoms.get(n.id)!);
    const pivot = { x: M.x, y: M.y };
    // Where the mover ends up when it comes in from `d`, and how far it turns: its unpaired
    // electron (radicals), else a lone pair, else its free side faces the target.
    const pose = (d: Vec): { goal: Vec; rot: number; want: number } => {
      const want = angleOf(scale(d, -1));
      let face: number;
      if (!mn.length) face = want;
      else if (M.rad > 0 || M.lp > 0) {
        const doms = domainsInWorld(this.w, mover);
        const pick = doms.filter((x) => x.single === M.rad > 0);
        const list = pick.length ? pick : doms;
        face = list.reduce((b, x) => (angDiff(x.angle, want) < angDiff(b, want) ? x.angle : b), list[0].angle);
      } else face = angleOf(sub(M, centroid(mn)));
      return { goal: add(T, scale(d, gap)), rot: signedAng(face, want), want };
    };
    // If the two are about to condense, the H that will leave has to end up beside the -OH it
    // leaves with. Otherwise the electron pair that takes the H crosses the one that makes the
    // new bond. Among the gaps around the target, take the one that brings them closest.
    const oh = this.leavingOH(target, mover);
    if (oh && tn.length >= 2 && mn.length) {
      const hs = mn.filter((h) => h.el === 'H');
      const angs = tn.map((n) => Math.atan2(n.y - T.y, n.x - T.x)).sort((p, q) => p - q);
      const gaps = angs.map((a0, i) => ({ mid: (a0 + (i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI)) / 2, width: (i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI) - a0 }));
      const widest = Math.max(...gaps.map((g) => g.width));
      let bestD = Infinity;
      for (const g of gaps) {
        if (g.width < widest - 0.5 || !hs.length) continue;
        const d = fromAngle(g.mid);
        const ps = pose(d);
        let near = Math.min(...hs.map((h) => dist(add(ps.goal, rotate(sub(h, pivot), ps.rot)), oh)));
        // Not a way in that leaves the two molecules lying over each other.
        if (this.tight) {
          const others = component(this.w, target).map((id) => this.w.atoms.get(id)!);
          for (const id of comp) {
            const at = this.w.atoms.get(id)!;
            const p = add(ps.goal, rotate(sub(at, pivot), ps.rot));
            for (const o of others) {
              if (id === mover && o.id === target) continue;
              if (dist(p, o) < element(at.el).r + element(o.el).r + 9) near += 200;
            }
          }
        }
        if (near < bestD - 1e-6) {
          bestD = near;
          dir = d;
        }
      }
    }
    if (this.plannedMotion && oh) {
      const ps = pose(dir);
      const selected = this.reference?.steps[this.A.index + 1]?.shifts?.find((s) => s.src.kind === 'lp' && s.src.a === oh.id && s.dst.kind === 'bond')?.dst.b;
      const h = mn.find((x) => x.id === selected) ?? mn.filter((x) => x.el === 'H').sort((a, b) =>
        dist(add(ps.goal, rotate(sub(a, pivot), ps.rot)), oh) - dist(add(ps.goal, rotate(sub(b, pivot), ps.rot)), oh))[0];
      if (h) {
        this.condensationApproach(target, mover, oh.id, h.id);
        this.focusMol(comp);
        this.focusMol(component(this.w, target));
        (this.A.pulls ??= []).push({ a: mover, b: target });
        return;
      }
    }
    // 치환에서는 떠날 원자 반대쪽을 먼저 비운다. 새 결합 뒤 큰 회전은 하지 않는다.
    let prepared = false;
    if (this.plannedMotion) for (const cmd of this.upcoming) {
      if (cmd.op !== 'arrow' || !cmd.args[0]?.includes('~')) continue;
      const src = this.arrowEnd(cmd.args[0]);
      const dst = cmd.args[2] ? this.arrowEnd(cmd.args[2]) : null;
      if (src.kind !== 'bond' || !dst || dst.kind !== 'atom') continue;
      const leaving = src.a === target ? src.b : src.b === target ? src.a : undefined;
      if (!leaving || dst.a !== leaving || !['F', 'Cl', 'Br', 'I'].includes(this.w.atoms.get(leaving)!.el)) continue;
      dir = norm(sub(T, this.w.atoms.get(leaving)!));
      const axis = angleOf(dir);
      const hs = tn.filter((x) => x.el === 'H');
      const slots = [axis - 2 * Math.PI / 3, axis - Math.PI / 3, axis + Math.PI / 2];
      // 현재 순서에서 가까운 빈 자리를 고르며 H ID를 그대로 유지한다.
      for (const h of hs) {
        slots.sort((a, b) => angDiff(a, angleOf(sub(h, T))) - angDiff(b, angleOf(sub(h, T))));
        this.turnBranch(target, h.id, slots.shift() ?? axis + Math.PI, 0, 0.3);
      }
      prepared = true;
      break;
    }
    const { goal, rot, want } = pose(dir);
    // A lone atom: just turn its electrons; the first unpaired electron (or first pair) faces the target.
    if (!mn.length) M.face = want;
    if (this.tight) {
      // Come in along the line of approach, going round the other molecule if it is in the way,
      // and be turned the right way before the last stretch.
      const tc = component(this.w, target).map((id) => this.w.atoms.get(id)!);
      const mc = comp.map((id) => this.w.atoms.get(id)!);
      const around = centroid(tc);
      const clear = Math.max(...tc.map((x) => dist(x, around) + element(x.el).r)) + Math.max(...mc.map((x) => dist(x, M) + element(x.el).r)) + 14;
      const { path, turnBy } = routeIn(pivot, goal, dir, around, clear);
      const t0 = prepared ? 0.3 : 0;
      const rotation = mn.length ? rot : 0;
      const route = this.plannedMotion ? this.clearRoute(ids, pivot, goal, rotation, t0, 1, { path, turnBy }) : { path, turnBy };
      this.moveGroup(ids, pivot, route.path, rotation, t0, 1, route.turnBy);
    } else this.moveGroup(ids, pivot, [pivot, goal], mn.length ? rot : 0, 0, 1);
    this.focusMol(comp);
    // The molecule it comes up to is part of the scene too.
    this.focusMol(component(this.w, target));
    (this.A.pulls ??= []).push({ a: mover, b: target });
  }

  /** 중심 원자를 축으로 가지 전체를 돌린다. 고리가 축으로 되돌아오면 건드리지 않는다. */
  turnBranch(root: string, child: string, angle: number, t0: number, t1: number, clear = false): void {
    const ids = new Set([child]);
    const queue = [child];
    for (const id of queue) for (const n of neighbors(this.w, id)) {
      if (n.id === root) { if (id !== child) return; continue; }
      if (!ids.has(n.id)) { ids.add(n.id); queue.push(n.id); }
    }
    const pivot = { ...this.w.atoms.get(root)! };
    let rotation = signedAng(angleOf(sub(this.w.atoms.get(child)!, pivot)), angle);
    if (clear) {
      const penalty = this.posePenalty([...ids]);
      const pose = (theta: number) => new Map([...ids].map((id) =>
        [id, add(pivot, rotate(sub(this.w.atoms.get(id)!, pivot), theta))]));
      const preferred = rotation;
      let best = penalty(pose(rotation));
      for (let degrees = 2; degrees <= 90 && best > 0; degrees += 2) for (const sign of [-1, 1]) {
        const theta = preferred + sign * degrees * Math.PI / 180;
        const score = penalty(pose(theta));
        if (score < best) { best = score; rotation = theta; }
        if (best === 0) break;
      }
    }
    this.moveGroup([...ids], pivot, [pivot, pivot], rotation, t0, t1);
  }

  /** 분자 안팎에서 결합도 공통 이웃도 없는 원자쌍에 필요한 여백을 계산한다. */
  posePenalty(ids: string[], margin = 3.5, during = false): (pose: Map<string, Vec>) => number {
    const moved = new Set(ids);
    const atoms = [...this.w.atoms.values()].filter((a) => !a.gone && (!a.crowd || moved.has(a.id)));
    const adjacent = new Map(atoms.map((a) => [a.id, new Set(neighbors(this.w, a.id).map((n) => n.id))]));
    const pairs: { a: Atom; b: Atom; min: number }[] = [];
    for (let i = 0; i < atoms.length; i++) for (const b of atoms.slice(i + 1)) {
      const a = atoms[i];
      if (!moved.has(a.id) && !moved.has(b.id)) continue;
      if (adjacent.get(a.id)!.has(b.id) || [...adjacent.get(a.id)!].some((id) => adjacent.get(b.id)!.has(id))) continue;
      if (during && (getBond(this.A.before, a.id, b.id) || neighbors(this.A.before, a.id)
        .some((n) => !!getBond(this.A.before, n.id, b.id)))) continue;
      // 보간 오차가 끝점 여백을 깎지 않도록 반 단위를 더 둔다.
      pairs.push({ a, b, min: element(a.el).r + element(b.el).r + margin });
    }
    return (pose) => pairs.reduce((sum, { a, b, min }) =>
      sum + Math.max(0, min - dist(pose.get(a.id) ?? a, pose.get(b.id) ?? b)) ** 2, 0);
  }

  /** C–N 접촉과 O–H 전달을 동시에 준비한다. 각도는 화면 배치를 위한 값이다. */
  condensationApproach(carbon: string, nitrogen: string, oxygen: string, hydrogen: string): void {
    const C = this.w.atoms.get(carbon)!;
    const N = this.w.atoms.get(nitrogen)!;
    // 반응할 O를 먼저 놓고 나머지 가지를 빈틈으로 돌린다. 가지 내부 결합 길이는 유지한다.
    const branches = neighbors(this.w, carbon).sort((a, b) =>
      Number(a.id !== oxygen && a.order === 1) - Number(b.id !== oxygen && b.order === 1));
    for (const n of branches) {
      const flexible = n.id !== oxygen && n.order === 1;
      this.turnBranch(carbon, n.id, n.id === oxygen ? Math.PI / 2 : n.order === 2 ? 0 : -Math.PI / 3, 0, 0.3, flexible);
    }
    const oldH = neighbors(this.w, oxygen).find((n) => n.id !== carbon)!.id;
    this.turnBranch(oxygen, oldH, 14.5 * Math.PI / 180, 0.3, 0.45);
    for (const n of neighbors(this.w, nitrogen)) {
      this.turnBranch(nitrogen, n.id, n.id === hydrogen ? Math.PI / 2 : this.w.atoms.get(n.id)!.el === 'H' ? -Math.PI / 2 : Math.PI, 0, 0.3);
    }
    const from = { x: N.x, y: N.y };
    const goal = add(C, { x: -bondLength(C.el, N.el, 1), y: 0 });
    const target = component(this.w, carbon).map((id) => this.w.atoms.get(id)!);
    const moving = component(this.w, nitrogen);
    const clearance = Math.max(...target.map((a) => dist(a, C) + element(a.el).r)) +
      Math.max(...moving.map((id) => dist(this.w.atoms.get(id)!, N) + element(this.w.atoms.get(id)!.el).r)) + 20;
    // 아래쪽 외곽으로 들어간다. 마지막 구간에서는 회전하지 않는다.
    const low = Math.max(C.y, from.y) + clearance;
    const path = rounded([from, { x: from.x, y: low }, { x: goal.x - clearance, y: low }, { x: goal.x - clearance, y: goal.y }, goal], 3);
    const ids = this.group(moving);
    const route = this.clearRoute(ids, from, goal, 0, 0.45, 1, { path, turnBy: 1 });
    this.moveGroup(ids, from, route.path, 0, 0.45, 1);
  }

  /** The O of the -OH that `a` gives up, if the next step condenses `a` with `b`. */
  leavingOH(a: string, b: string): Atom | null {
    for (const c of this.upcoming) {
      if (c.op !== 'condensation' || c.args.length < 2) continue;
      try {
        if (this.atom(c.args[0]) !== a || this.atom(c.args[1]) !== b) continue;
      } catch {
        continue;
      }
      const oh = neighbors(this.w, a)
        .map((n) => this.w.atoms.get(n.id)!)
        .find((o) => o.el === 'O' && neighbors(this.w, o.id).length === 2 && neighbors(this.w, o.id).some((x) => this.w.atoms.get(x.id)!.el === 'H'));
      if (oh) return oh;
    }
    return null;
  }

  /** move w to right / move w to 300,200 / move w near a */
  move(a: string[]): void {
    const [ref, kw, ...rest] = a;
    if (!ref || (kw !== 'to' && kw !== 'near')) this.fail('move는 이렇게 적어요: move w to right');
    const comp = this.mol(ref);
    const ids = this.group(comp);
    const c = centerOf(this.w, comp);
    let goal: Vec;
    if (kw === 'near') goal = this.placementPoint({ kind: 'near', ref: rest[0], dir: rest[1] ?? 'right' }, 0, 1);
    else {
      const xy = rest[0]?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
      goal = xy ? { x: parseFloat(xy[1]), y: parseFloat(xy[2]) } : regionCenter(this.region(rest[0]));
    }
    this.moveGroup(ids, c, [c, goal], 0, 0, 1);
    this.focusMol(comp);
  }

  // ------------------------------------------------------------ ops: solvent

  freeSolvent(): string[][] {
    const attached = new Set([...this.w.attached.values()].flat());
    return allComponents(this.w).filter((c) => {
      const a = this.w.atoms.get(c[0])!;
      if (!a.crowd) return false;
      if (formulaOf(this.w, c) !== 'H2O') return false;
      return !c.some((x) => attached.has(x));
    });
  }

  /** Where the water molecules of a hydration shell go, and which end faces the ion. */
  shellTargets(comp: string[], n?: number): { pos: Vec; u: Vec; mode: 'O' | 'H' }[] {
    const q = componentCharge(this.w, comp);
    const out: { pos: Vec; u: Vec; mode: 'O' | 'H' }[] = [];
    if (comp.length === 1) {
      const at = this.w.atoms.get(comp[0])!;
      const r = element(at.el).r;
      const k = n ?? (Math.abs(q) >= 2 ? 6 : 4);
      const off = this.rng.range(0, Math.PI / 2);
      for (let i = 0; i < k; i++) {
        const u = fromAngle(off + (2 * Math.PI * i) / k);
        // Six waters need a little more room than four so their H atoms do not collide.
        if (q > 0) out.push({ pos: add(at, scale(u, r + element('O').r + (k >= 6 ? 14 : 7))), u, mode: 'O' });
        else out.push({ pos: add(at, scale(u, r + element('H').r + 12)), u, mode: 'H' });
      }
      return out;
    }
    // Polyatomic: find the charged atom.
    const charged = comp.map((id) => this.w.atoms.get(id)!).find((a) => {
      const fc = element(a.el).valence - a.lp * 2 - a.rad - neighbors(this.w, a.id).reduce((s, x) => s + x.order, 0);
      return fc !== 0;
    });
    if (!charged) return out;
    if (q > 0) {
      for (const nb of neighbors(this.w, charged.id)) {
        const h = this.w.atoms.get(nb.id)!;
        if (h.el !== 'H') continue;
        const u = norm(sub(h, charged));
        out.push({ pos: add(h, scale(u, 50)), u, mode: 'O' });
      }
    } else {
      const dirs = lonePairDirsInWorld(this.w, charged.id, charged.lp);
      for (const d of dirs) {
        const u = fromAngle(d);
        out.push({ pos: add(charged, scale(u, element(charged.el).r + 40)), u, mode: 'H' });
      }
    }
    return out.slice(0, n ?? out.length);
  }

  /** Pose (atom positions) of a water molecule placed at a shell target. */
  waterPose(water: string[], target: { pos: Vec; u: Vec; mode: 'O' | 'H' }): { pivot: Vec; goal: Vec; rot: number } {
    const O = water.map((id) => this.w.atoms.get(id)!).find((a) => a.el === 'O')!;
    const Hs = water.map((id) => this.w.atoms.get(id)!).filter((a) => a.el === 'H');
    const bis = norm(add(sub(Hs[0], O), sub(Hs[1], O)));
    if (target.mode === 'O') {
      // O faces the ion: the H end points away along u.
      const rot = signedAng(angleOf(bis), angleOf(target.u));
      return { pivot: { x: O.x, y: O.y }, goal: target.pos, rot };
    }
    // One H points at the ion: O–H1 bond along −u, O sits further out.
    const oh = sub(Hs[0], O);
    const rot = signedAng(angleOf(oh), angleOf(scale(target.u, -1)));
    const goalO = add(target.pos, scale(target.u, bondLength('O', 'H')));
    return { pivot: { x: O.x, y: O.y }, goal: goalO, rot };
  }

  /** Bring solvent molecules around a solute; returns the anchors of the shell. */
  hydrate(comp: string[], t0: number, t1: number, n?: number): string[] {
    const targets = this.shellTargets(comp, n);
    if (!targets.length) return [];
    const pool = this.freeSolvent();
    // Pair places and water molecules shortest first, so that their paths do not cross.
    const pairs: { ti: number; wi: number; d: number }[] = [];
    targets.forEach((tg, ti) =>
      pool.forEach((c, wi) => {
        const d = dist(centerOf(this.w, c), tg.pos);
        if (d <= 420) pairs.push({ ti, wi, d });
      }),
    );
    pairs.sort((p, q) => p.d - q.d);
    const byTarget = new Map<number, { wi: number; d: number }>();
    const used = new Set<number>();
    for (const pr of pairs) {
      if (byTarget.has(pr.ti) || used.has(pr.wi)) continue;
      byTarget.set(pr.ti, { wi: pr.wi, d: pr.d });
      used.add(pr.wi);
    }
    // The nearest water arrives first and the others follow one by one, rather than all at once.
    const order = targets.map((_, ti) => ti).sort((p, q) => (byTarget.get(p)?.d ?? 999) - (byTarget.get(q)?.d ?? 999));
    const span = t1 - t0;
    const shell: string[] = [];
    order.forEach((ti, i) => {
      const tg = targets[ti];
      const got = byTarget.get(ti);
      let water: string[];
      if (!got) {
        // No free water close by: a water molecule drifts in from outside.
        const start = add(tg.pos, scale(tg.u, 140));
        water = this.spawn('H2O', this.autoName('~H2O'), true, start, this.rng.range(0, 6.28));
        for (const id of water) this.A.appear.add(id);
      } else water = pool[got.wi];
      const s0 = t0 + (order.length > 1 ? (0.4 * span * i) / (order.length - 1) : 0);
      const pose = this.waterPose(water, tg);
      // Come in from outside the shell along its own direction, not across the ion.
      const outside = add(pose.goal, scale(tg.u, 60));
      this.moveGroup(water, pose.pivot, [pose.pivot, outside, pose.goal], pose.rot, s0, s0 + 0.6 * span);
      shell.push(anchorOf(this.w, water));
    });
    const key = anchorOf(this.w, comp);
    this.w.attached.set(key, [...(this.w.attached.get(key) ?? []), ...shell]);
    return shell;
  }

  /** solvate a / solvate all */
  solvate(a: string[]): void {
    const [ref, nStr] = a;
    if (!ref) this.fail('solvate는 이렇게 적어요: solvate a  또는  solvate all');
    const n = nStr && /^\d+$/.test(nStr) ? parseInt(nStr, 10) : undefined;
    let comps: string[][];
    if (ref === 'all') {
      const inCrystal = new Set([...this.w.crystals.values()].flat());
      const adsorbed = new Set(this.w.sites.map((s) => s.occupant).filter(Boolean) as string[]);
      comps = allComponents(this.w).filter((c) => {
        const at = this.w.atoms.get(c[0])!;
        if (at.crowd || c.some((x) => inCrystal.has(x) || adsorbed.has(x))) return false;
        if (this.w.attached.has(anchorOf(this.w, c))) return false;
        return componentCharge(this.w, c) !== 0;
      });
      if (!comps.length) this.warn('물 분자가 둘러쌀 이온이 없어요.');
    } else {
      const c = this.mol(ref);
      if (componentCharge(this.w, c) === 0) {
        this.warn(`${formulaOf(this.w, c)}는 전하가 없어서 물 분자가 둘러싸지 않아요.`);
        return;
      }
      comps = [c];
    }
    for (const c of comps) {
      this.hydrate(c, 0.05, 1, n);
      this.focusMol(c);
    }
  }

  // ------------------------------------------------------------ ops: diffusion

  /** diffuse a b to right */
  diffuse(a: string[]): void {
    const to = a.indexOf('to');
    if (to < 1 || !a[to + 1]) this.fail('diffuse는 이렇게 적어요: diffuse a to right');
    const region = this.region(a[to + 1]);
    for (const ref of a.slice(0, to)) {
      const comp = this.mol(ref);
      const c = centerOf(this.w, comp);
      const goal = this.freePoint(region, 30, 50) ?? randomInRegion(region, this.rng);
      const path = this.wander(c, goal, this.stage.regions[this.stage.defaultRegion] ?? null);
      this.moveGroup(this.group(comp), c, path, this.rng.range(-2, 2), 0, 1);
      this.A.trails.push(anchorOf(this.w, comp));
      this.focusMol(comp);
    }
  }

  /** spread Na+ Cl- in water : every matching particle wanders off to its own spot. */
  spread(a: string[]): void {
    const inI = a.indexOf('in');
    const refs = inI >= 0 ? a.slice(0, inI) : a;
    const region = inI >= 0 ? this.region(a[inI + 1]) : this.region(this.stage.defaultRegion);
    if (!refs.length) this.fail('spread는 이렇게 적어요: spread Na+ Cl- in water');
    const comps: string[][] = [];
    for (const ref of refs) {
      if (this.w.names.has(ref)) comps.push(this.mol(ref));
      else {
        const f = normalizeFormula(ref);
        const hits = allComponents(this.w).filter((c) => !this.w.atoms.get(c[0])!.crowd && sameFormula(this.w, c, f));
        if (!hits.length) this.fail(`장면에 ${f}이(가) 없어요.`);
        comps.push(...hits);
      }
    }
    const n = comps.length;
    const cols = Math.ceil(Math.sqrt(n * (region.w / region.h)));
    const rows = Math.ceil(n / cols);
    const slots: Vec[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        slots.push({
          x: region.x + ((i + 0.5) / cols) * region.w + this.rng.range(-20, 20),
          y: region.y + ((j + 0.5) / rows) * region.h + this.rng.range(-20, 20),
        });
      }
    }
    // Shuffle slots so neighbours do not stay neighbours.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    comps.forEach((comp, i) => {
      const c = centerOf(this.w, comp);
      const path = this.wander(c, slots[i], region);
      this.moveGroup(this.group(comp), c, path, this.rng.range(-2, 2), 0, 1);
      this.A.trails.push(anchorOf(this.w, comp));
      this.focusMol(comp);
    });
  }

  // ------------------------------------------------------------ ops: phase changes

  needSurface(op: string): number {
    if (this.stage.surfaceY === undefined) this.fail(`${op}는 수면이 있는 interface 무대에서 써요.`);
    return this.stage.surfaceY;
  }

  pickSolvent(ref: string, pred: (c: string[]) => boolean, score: (c: string[]) => number): string[] {
    if (this.w.names.has(ref)) return this.mol(ref);
    const f = normalizeFormula(ref);
    const cands = allComponents(this.w).filter((c) => sameFormula(this.w, c, f) && pred(c));
    if (!cands.length) this.fail(`조건에 맞는 ${f}이(가) 없어요.`);
    cands.sort((p, q) => score(p) - score(q));
    return cands[0];
  }

  /** evaporate H2O : the water molecule nearest the surface breaks away into the air. */
  evaporate(a: string[]): void {
    const S = this.needSurface('evaporate');
    const ref = a[0] ?? 'H2O';
    const comp = this.pickSolvent(
      ref,
      (c) => centerOf(this.w, c).y > S && !this.A.focus.has(anchorOf(this.w, c)),
      (c) => centerOf(this.w, c).y,
    );
    this.detach(comp);
    const c = centerOf(this.w, comp);
    const air = this.stage.regions.air;
    const goal = { x: clamp(c.x + this.rng.range(-160, 160), air.x + 40, air.x + air.w - 40), y: this.rng.range(air.y + 40, S - 90) };
    const path = [c, { x: c.x, y: S + 6 }, { x: c.x + this.rng.range(-20, 20), y: S - 40 }, ...this.wander({ x: c.x, y: S - 40 }, goal, air, 0.6).slice(1)];
    this.moveGroup(comp, c, path, this.rng.range(-3, 3), 0, 1);
    this.A.trails.push(anchorOf(this.w, comp));
    this.focusMol(comp);
  }

  /** condense H2O : a water molecule in the air drops back into the liquid. */
  condense(a: string[]): void {
    const S = this.needSurface('condense');
    const ref = a[0] ?? 'H2O';
    const comp = this.pickSolvent(
      ref,
      (c) => centerOf(this.w, c).y < S && !this.A.focus.has(anchorOf(this.w, c)),
      (c) => -centerOf(this.w, c).y,
    );
    const c = centerOf(this.w, comp);
    const goal = { x: c.x + this.rng.range(-40, 40), y: S + 38 };
    const path = [c, ...this.wander(c, { x: goal.x, y: S - 30 }, this.stage.regions.air, 0.5).slice(1), goal];
    this.moveGroup(comp, c, path, this.rng.range(-2, 2), 0, 1);
    this.A.trails.push(anchorOf(this.w, comp));
    this.focusMol(comp);
  }

  /** dissolve 2 from s : ions at the crystal's edge get a water shell and leave. dissolve s1 s2 from s : these ions. */
  dissolve(a: string[]): void {
    const from = a.indexOf('from');
    const name = from >= 0 ? a[from + 1] : undefined;
    const head = from >= 0 ? a.slice(0, from) : [];
    const count = head.length === 1 && /^\d+$/.test(head[0]) ? parseInt(head[0], 10) : 0;
    if (!name || !head.length) this.fail('dissolve는 이렇게 적어요: dissolve 2 from s  (이온을 골라 녹이려면 dissolve s1 s2 from s)');
    const lattice = this.w.crystals.get(name);
    if (!lattice) this.fail(`'${name}'이라는 결정이 없어요.`);
    const picked = count
      ? []
      : head.map((ref) => {
          const c = this.mol(ref);
          if (!c.some((x) => lattice.includes(x))) this.fail(`${ref}은(는) ${name} 결정에 없어요.`);
          return c;
        });
    const n = count || picked.length;
    let lastCharge = 0;
    for (let k = 0; k < n; k++) {
      const units = this.latticeUnits(lattice);
      if (!units.length) {
        this.warn('결정이 다 녹았어요.');
        break;
      }
      const centers = units.map((u) => centerOf(this.w, u));
      let spacing = Infinity;
      for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) spacing = Math.min(spacing, dist(centers[i], centers[j]));
      if (!Number.isFinite(spacing)) spacing = 40;
      let unit: string[];
      if (picked.length) unit = picked[k];
      else {
        const score = (i: number) => {
          let nb = 0;
          for (let j = 0; j < centers.length; j++) if (j !== i && dist(centers[i], centers[j]) < spacing * 1.1) nb++;
          return nb * 10000 + centers[i].y * 10 + centers[i].x / 100;
        };
        const order = units.map((_, i) => i).sort((p, q) => score(p) - score(q));
        const best =
          order.find((i) => Math.sign(componentCharge(this.w, units[i])) !== lastCharge && score(i) < score(order[0]) + 10000) ?? order[0];
        unit = units[best];
      }
      lastCharge = Math.sign(componentCharge(this.w, unit));
      for (const id of unit) {
        const i = lattice.indexOf(id);
        if (i >= 0) lattice.splice(i, 1);
      }
      const pick = anchorOf(this.w, unit);
      const ion = centerOf(this.w, unit);
      const rest = this.latticeUnits(lattice).map((u) => centerOf(this.w, u));
      // Free directions: no lattice neighbour that way.
      const free: Vec[] = [];
      for (let i = 0; i < 8; i++) {
        const u = fromAngle((Math.PI * 2 * i) / 8 - Math.PI / 2);
        const probe = add(ion, scale(u, spacing));
        if (!rest.some((p) => dist(p, probe) < spacing * 0.6)) free.push(u);
      }
      const shellN = Math.min(3, Math.max(1, free.length));
      const q = componentCharge(this.w, unit);
      const r = this.ionRadius(unit);
      const sum = free.reduce((s, u) => add(s, u), { x: 0, y: 0 });
      const out = Math.hypot(sum.x, sum.y) > 1e-6 ? norm(sum) : { x: 0, y: -1 };
      // Water molecules of the shell sit at least a right angle apart, so they never overlap.
      const chosen: Vec[] = [];
      for (const u of [...free].sort((p, q2) => dist(p, out) - dist(q2, out))) {
        if (chosen.length >= shellN) break;
        if (chosen.every((v) => u.x * v.x + u.y * v.y < 0.05)) chosen.push(u);
      }
      const targets = chosen.map((u) =>
        q > 0
          ? { pos: add(ion, scale(u, r + element('O').r + 7)), u, mode: 'O' as const }
          : { pos: add(ion, scale(u, r + element('H').r + 12)), u, mode: 'H' as const },
      );
      const pool = this.freeSolvent();
      const shell: string[] = [];
      const used = new Set<number>();
      for (const tg of targets) {
        let bi = -1;
        let bd = Infinity;
        pool.forEach((c, i) => {
          if (used.has(i)) return;
          const d = dist(centerOf(this.w, c), tg.pos);
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        let water: string[];
        if (bi < 0) {
          water = this.spawn('H2O', this.autoName('~H2O'), true, add(tg.pos, scale(tg.u, 140)), 0);
          for (const id of water) this.A.appear.add(id);
        } else {
          used.add(bi);
          water = pool[bi];
        }
        const pose = this.waterPose(water, tg);
        this.moveGroup(water, pose.pivot, [pose.pivot, pose.goal], pose.rot, 0, 0.42);
        shell.push(anchorOf(this.w, water));
      }
      this.w.attached.set(pick, shell);
      const region = this.region(this.stage.defaultRegion);
      const groupIds = new Set(this.group(unit));
      const solutes = [...this.w.atoms.values()].filter((x) => !x.crowd && !groupIds.has(x.id) && !lattice.includes(x.id));
      let goal = { x: ion.x, y: ion.y - 160 };
      let bestScore = -Infinity;
      for (let i = 0; i < 40; i++) {
        const cand = {
          x: clamp(ion.x + out.x * 120 + this.rng.range(-170, 170), region.x + 70, region.x + region.w - 70),
          // Far enough below the top of the water that the shell around the ion stays in it too.
          y: clamp(ion.y + out.y * 80 - this.rng.range(110, 230), region.y + Math.max(70, r + 66), region.y + region.h - 70),
        };
        let near = 400;
        for (const o of solutes) near = Math.min(near, dist(o, cand));
        for (const j of lattice) near = Math.min(near, dist(this.w.atoms.get(j)!, cand) + 40);
        const score = Math.min(near, 220) - dist(cand, ion) * 0.15;
        if (score > bestScore) {
          bestScore = score;
          goal = cand;
        }
      }
      const start = { x: ion.x, y: ion.y };
      const path = this.wander(start, goal, region, 0.5);
      if (this.plannedMotion) {
        // 물이 모인 쪽으로 빠져나온다. 물이 닿기 전에는 이온을 움직이지 않는다.
        const held = this.group(unit);
        const pull = chosen.reduce((s, u) => add(s, u), { x: 0, y: 0 });
        const direction = Math.hypot(pull.x, pull.y) > 1e-6 ? norm(pull) : out;
        let reach = Math.max(80, dist(start, goal));
        // 물까지 화면 안에 남을 수 있는 거리만 같은 방향으로 이동한다.
        for (const id of held) {
          const at = this.w.atoms.get(id)!, radius = element(at.el).r;
          for (const [value, delta, low, high] of [
            [at.x, direction.x, 14 + radius, this.stage.width - 14 - radius],
            [at.y, direction.y, Math.max(14, (this.stage.surfaceY ?? 2) + 12) + radius, this.stage.height - 14 - radius],
          ]) {
            if (delta > 1e-6) reach = Math.min(reach, Math.max(0, (high - value) / delta));
            if (delta < -1e-6) reach = Math.min(reach, Math.max(0, (low - value) / delta));
          }
        }
        goal = add(start, scale(direction, reach));
        this.moveGroup(held, start, [start, goal], 0, 0.45, 1);
        [...held, ...lattice].forEach((id) => this.causalMotion.add(id));
      } else this.moveGroup(this.group(unit), start, path, 0, 0.45, 1);
      this.A.trails.push(pick);
      this.focusMol(unit);
    }
  }

  // ------------------------------------------------------------ ops: soil

  needSoil(op: string): Vec[][] {
    if (!this.stage.channels) this.fail(`${op}는 soil 무대에서 써요.`);
    return this.stage.channels;
  }

  sitesOf(anchorIds: string[]): typeof this.w.sites {
    const set = new Set(anchorIds);
    return this.w.sites.filter((s) => s.occupant && set.has(s.occupant));
  }

  /** Put a new cation on free clay sites (one site per unit of charge). */
  adsorbNew(ids: string[], region: Region | null): void {
    const q = componentCharge(this.w, ids);
    if (q <= 0) this.fail('점토 표면(음전하)에는 양이온만 흡착할 수 있어요.');
    const need = q;
    const byPlate = new Map<number, typeof this.w.sites>();
    for (const s of this.w.sites) {
      if (s.occupant) continue;
      if (region && s.region !== region.name) continue;
      if (!byPlate.has(s.plate)) byPlate.set(s.plate, []);
      byPlate.get(s.plate)!.push(s);
    }
    let chosen: typeof this.w.sites | null = null;
    const plates = [...byPlate.keys()].sort((p, q2) => p - q2);
    for (const p of plates) {
      const free = byPlate.get(p)!;
      const idxs = free.map((s) => this.w.sites.indexOf(s)).sort((x, y) => x - y);
      for (let i = 0; i + need - 1 < idxs.length; i++) {
        const run = idxs.slice(i, i + need);
        if (run[run.length - 1] - run[0] === need - 1) {
          chosen = run.map((k) => this.w.sites[k]);
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) this.fail(`${region ? region.label + '의 ' : ''}점토에 빈 음전하 부위가 모자라요.`);
    const key = anchorOf(this.w, ids);
    for (const s of chosen) s.occupant = key;
    const p = this.sitePoint(chosen, ids);
    for (const id of ids) {
      const at = this.w.atoms.get(id)!;
      at.x = p.x;
      at.y = p.y;
    }
  }

  sitePoint(sites: { x: number; y: number; nx: number; ny: number }[], ids: string[]): Vec {
    const m = centroid(sites);
    const n = norm(sites.reduce((s, x) => add(s, { x: x.nx, y: x.ny }), { x: 0, y: 0 }));
    const r = Math.max(...ids.map((i) => element(this.w.atoms.get(i)!.el).r));
    return add(m, scale(n, r + 4));
  }

  nearestChannel(p: Vec): { ch: Vec[]; s: number; point: Vec } {
    const chans = this.needSoil('이 명령');
    let best = { ch: chans[0], s: 0, point: chans[0][0], d: Infinity };
    for (const ch of chans) {
      const n = polyNearest(ch, p);
      const d = dist(n.point, p);
      if (d < best.d) best = { ch, s: n.s, point: n.point, d };
    }
    return best;
  }

  /** exchange c1 with 2 H+ on clay */
  exchange(a: string[]): void {
    if (!this.stage.plates) this.fail('exchange는 점토가 있는 무대(soil, root)에서 써요.');
    const wi = a.indexOf('with');
    if (wi !== 1 || !a[wi + 1]) this.fail('이온 교환은 이렇게 적어요: exchange Ca2+ with 2 H+ on clay');
    let n = 1;
    let fI = wi + 1;
    if (/^\d+$/.test(a[fI])) {
      n = parseInt(a[fI], 10);
      fI++;
    }
    const f = normalizeFormula(a[fI] ?? '');
    if (!lookupMolecule(f)) this.fail(unknownFormula(f));
    const isAdsorbed = (c: string[]) => this.w.sites.some((s) => s.occupant === anchorOf(this.w, c));
    const out = this.mol(a[0], isAdsorbed);
    const key = anchorOf(this.w, out);
    const sites = this.w.sites.filter((s) => s.occupant === key);
    if (!sites.length) this.fail(`${a[0]}은(는) 점토 표면에 흡착돼 있지 않아요.`);
    const qOut = componentCharge(this.w, out);
    const qIn = formulaCharge(f);
    if (qIn <= 0) this.fail('점토의 음전하 부위에는 양이온만 들어갈 수 있어요.');
    if (qIn * n !== qOut) {
      const fmt = (q: number) => (q > 0 ? `+${q}` : `${q}`);
      this.fail(
        `전하가 맞지 않아요. ${formulaOf(this.w, out)}(${fmt(qOut)}) 하나가 떠난 부위를 ${f}(${fmt(qIn)}) ${n}개(${fmt(qIn * n)})가 대신하게 적혔어요.`,
      );
    }
    // The outgoing ion leaves the surface into the water (in soil: into the pore).
    const ch = this.stage.channels ? this.nearestChannel(centerOf(this.w, out)) : null;
    for (const s of sites) s.occupant = null;
    const outStart = centerOf(this.w, out);
    const face = norm(sites.reduce((acc, x) => add(acc, { x: x.nx, y: x.ny }), { x: 0, y: 0 }));
    if (ch) {
      const outGoal = add(ch.point, scale(norm(sub(ch.point, outStart)), 6));
      this.moveGroup(this.group(out), outStart, [outStart, lerpV(outStart, outGoal, 0.5), add(outGoal, { x: 0, y: 26 })], 0, 0.15, 0.85);
    } else {
      const outGoal = add(outStart, add(scale(face, 80), { x: this.rng.range(-60, 60), y: 0 }));
      this.moveGroup(this.group(out), outStart, [outStart, lerpV(outStart, outGoal, 0.5), outGoal], 0, 0.15, 0.85);
    }
    this.focusMol(out);
    // Incoming ions: ones already free in the water go first; otherwise new ones arrive with the water.
    const held = new Set(this.w.sites.map((x) => x.occupant).filter(Boolean) as string[]);
    const waiting = allComponents(this.w)
      .filter((c) => !this.w.atoms.get(c[0])!.crowd && sameFormula(this.w, c, f) && !held.has(anchorOf(this.w, c)))
      .sort((p, q) => dist(centerOf(this.w, p), outStart) - dist(centerOf(this.w, q), outStart));
    const tangent = ch ? norm(sub(ch.point, add(ch.point, { x: 0, y: -1 }))) : { x: 0, y: 1 };
    for (let i = 0; i < n; i++) {
      let ids: string[];
      let start: Vec;
      if (waiting.length) {
        ids = waiting.shift()!;
        start = centerOf(this.w, ids);
        this.detach(ids);
      } else {
        start = ch
          ? add(ch.point, add(scale(tangent, -60 - i * 46), { x: (i % 2 ? 1 : -1) * 14, y: 0 }))
          : add(outStart, add(scale(face, 150 + i * 40), { x: (i % 2 ? 1 : -1) * 30, y: 0 }));
        ids = this.spawn(f, this.autoName(f), false, start);
        for (const id of ids) this.A.appear.add(id);
      }
      const mySites = sites.slice(i * qIn, i * qIn + qIn);
      const k2 = anchorOf(this.w, ids);
      for (const s of mySites) s.occupant = k2;
      const goal = this.sitePoint(mySites, ids);
      this.moveGroup(ids, start, [start, lerpV(start, goal, 0.6), goal], 0, 0.1, 0.9);
      this.focusMol(ids);
    }
  }

  /** leach c1 from topsoil to subsoil : the ion, with its water shell, travels down a pore. */
  leach(a: string[]): void {
    this.needSoil('leach');
    const ref = a[0];
    const toI = a.indexOf('to');
    if (!ref || toI < 0 || !a[toI + 1]) this.fail('씻겨 내려감은 이렇게 적어요: leach Ca2+ from topsoil to subsoil');
    const target = this.region(a[toI + 1]);
    const fromI = a.indexOf('from');
    const fromRegion = fromI >= 0 && a[fromI + 1] ? this.region(a[fromI + 1]) : null;
    const comp = this.mol(ref, (c) => (fromRegion ? inRegion(fromRegion, centerOf(this.w, c)) : true));
    const start = centerOf(this.w, comp);
    if (fromRegion && !inRegion(fromRegion, start, -40)) this.warn(`${ref}은(는) 지금 ${fromRegion.label}에 있지 않아요.`);
    if (target.y + target.h <= start.y) this.fail('씻겨 내려가는 방향은 아래쪽이에요. 목표 구역이 지금 위치보다 위에 있어요.');
    // Leave the clay if it was adsorbed.
    const key = anchorOf(this.w, comp);
    for (const s of this.w.sites) if (s.occupant === key) s.occupant = null;

    const near = this.nearestChannel(start);
    const sEnter = Math.max(near.s + 30, channelArcAtY(near.ch, target.y));
    const already = this.A.flows.filter((f) => f.path === near.ch).length;
    let sGoal = Math.min(polyLength(near.ch) - 30, sEnter + target.h * 0.4 + already * 34);
    const plates = this.stage.plates ?? [];
    for (let tries = 0; tries < 6; tries++) {
      const p = polyAt(near.ch, sGoal / polyLength(near.ch));
      if (!plates.some((pl) => dist(pl.center, p) < 110)) break;
      sGoal = Math.min(polyLength(near.ch) - 30, sGoal + 55);
    }
    const lateral = (already % 2 ? 1 : -1) * 12;
    const route = polySlice(near.ch, near.s, sGoal).map((p, i, arr) => {
      const nx = i < arr.length - 1 ? norm(perp(sub(arr[i + 1], p))) : norm(perp(sub(p, arr[i - 1])));
      return add(p, scale(nx, lateral));
    });
    // Water molecules from the rain wrap the ion first.
    if (!this.w.attached.get(key)?.length) this.hydrateFromNothing(comp, 0, 0.2);
    this.moveGroup(this.group(comp), start, [start, ...route], 0, 0.2, 1);
    if (!this.A.flows.some((f) => f.path === near.ch)) {
      this.A.flows.push({ path: near.ch, count: 18, t0: 0, t1: 1, seed: this.A.flows.length + 1 });
    }
    this.A.trails.push(key);
    this.focusMol(comp);
  }

  /** Hydration shell made of water molecules arriving with rain (soil has no standing solvent). */
  hydrateFromNothing(comp: string[], t0: number, t1: number): void {
    const targets = this.shellTargets(comp, 4);
    const shell: string[] = [];
    for (const tg of targets) {
      const water = this.spawn('H2O', this.autoName('~H2O'), true, add(tg.pos, { x: 0, y: -70 }), this.rng.range(0, 6.28));
      for (const id of water) this.A.appear.add(id);
      const pose = this.waterPose(water, tg);
      this.moveGroup(water, pose.pivot, [pose.pivot, pose.goal], pose.rot, t0, t1);
      shell.push(anchorOf(this.w, water));
    }
    const key = anchorOf(this.w, comp);
    this.w.attached.set(key, shell);
  }

  rain(): void {
    const chans = this.needSoil('rain');
    chans.forEach((ch, i) => this.A.flows.push({ path: ch, count: 14, t0: 0, t1: 1, seed: i + 11 }));
  }

  // ------------------------------------------------------------ ops: lithium-ion battery

  needBattery(op: string): NonNullable<StageDef['battery']> {
    const b = this.stage.battery;
    if (!b) this.fail(`${op}는 battery 무대에서 써요.`);
    return b;
  }

  batteryName(region: string): string {
    return region === 'anode' ? '음극(흑연)' : '양극(금속 산화물)';
  }

  /** load cathode 8 / load anode 3 : lithium already sitting between an electrode's sheets. */
  load(a: string[]): void {
    this.needBattery('load');
    const where = a[0];
    if (where !== 'anode' && where !== 'cathode') this.fail('load는 이렇게 적어요: load cathode 8  (또는 load anode 3)');
    const n = clamp(parseInt(a[1] ?? '1', 10) || 1, 1, 25);
    const free = this.w.sites.filter((x) => x.region === where && !x.occupant);
    if (free.length < n) this.fail(`${this.batteryName(where)}에는 리튬이 ${free.length}개까지만 더 들어가요.`);
    // Spread the lithium over the gaps instead of filling one row after another.
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    // In graphite the lithium holds the electron it came with (Li); in the oxide it is an ion (Li+).
    const f = where === 'anode' ? 'Li' : 'Li+';
    for (const site of free.slice(0, n)) {
      const ids = this.spawn(f, this.autoName(f), false, { x: site.x, y: site.y });
      site.occupant = ids[0];
    }
  }

  /** The way a lithium ion takes through the electrolyte, crossing the separator. */
  ionPath(from: Vec, to: Vec, fromFace: number, toFace: number): Vec[] {
    const B = this.stage.battery!;
    const dir = Math.sign(toFace - fromFace);
    const region = this.region('electrolyte');
    const exit = { x: fromFace + dir * 30, y: from.y };
    const cross = { x: B.separatorX, y: clamp(lerp(from.y, to.y, 0.5) + this.rng.range(-40, 40), B.top + 30, B.bottom - 30) };
    const entry = { x: toFace - dir * 30, y: to.y };
    return [from, exit, ...this.wander(exit, cross, region, 0.5).slice(1), ...this.wander(cross, entry, region, 0.5).slice(1), to];
  }

  /** charge 2 / discharge 2 : lithium ions move between the electrodes through the electrolyte; electrons go round the wire. */
  shuttle(op: string, a: string[]): void {
    const B = this.needBattery(op);
    const charging = op === 'charge';
    if (this.A.phase && this.batteryMode && this.batteryMode !== op) this.fail('charge와 discharge는 한 단계에 함께 쓸 수 없어요. 단계를 나눠 주세요.');
    this.batteryMode = op;
    const n = clamp(parseInt(a[0] ?? '1', 10) || 1, 1, 12);
    const src = charging ? 'cathode' : 'anode';
    const dst = charging ? 'anode' : 'cathode';
    const srcFace = charging ? B.cathodeFace : B.anodeFace;
    const dstFace = charging ? B.anodeFace : B.cathodeFace;
    const full = this.w.sites.filter((x) => x.region === src && x.occupant && this.w.atoms.has(x.occupant));
    const free = this.w.sites.filter((x) => x.region === dst && !x.occupant);
    if (full.length < n) this.fail(`${this.batteryName(src)}에 리튬이 ${full.length}개뿐이에요.`);
    if (free.length < n) this.fail(`${this.batteryName(dst)}에 리튬이 들어갈 빈 곳이 ${free.length}개뿐이에요.`);
    // Lithium nearest the electrolyte leaves first, and goes into the free gap nearest the other face.
    full.sort((p, q) => Math.abs(p.x - srcFace) - Math.abs(q.x - srcFace) || p.y - q.y);
    free.sort((p, q) => Math.abs(p.x - dstFace) - Math.abs(q.x - dstFace) || p.y - q.y);
    for (let i = 0; i < n; i++) {
      const from = full[i];
      const to = free[i];
      const id = from.occupant!;
      from.occupant = null;
      to.occupant = id;
      const at = this.w.atoms.get(id)!;
      const start = { x: at.x, y: at.y };
      this.moveGroup([id], start, this.ionPath(start, to, srcFace, dstFace), 0, 0.06 + i * 0.05, Math.min(0.95, 0.8 + i * 0.03));
      // In graphite the ion takes an electron from the wire; leaving it, it gives one back.
      at.rad = charging ? 1 : 0;
      this.A.trails.push(id);
      this.focus([id]);
    }
    const wire = this.stage.wire!;
    this.A.wires.push({ path: charging ? [...wire].reverse() : wire, count: n, t0: 0.1, t1: 0.85 });
    // The lithium gains its electron as it arrives (charging) or gives it up as it leaves (discharging).
    const sw = charging ? 0.9 : 0.1;
    this.A.phase = { b0: sw - 0.1, b1: sw, c0: 0 };
  }

  batteryMode: string | null = null;

  /** sei 1 : on the graphite surface, lithium and electrolyte react into a film; that lithium is lost for good. */
  sei(a: string[]): void {
    const B = this.needBattery('sei');
    if (this.batteryMode === 'discharge') this.fail('sei는 충전 때 생겨요. discharge와 다른 단계에 적어 주세요.');
    this.batteryMode = 'charge';
    const n = clamp(parseInt(a[0] ?? '1', 10) || 1, 1, 6);
    const full = this.w.sites.filter((x) => x.region === 'cathode' && x.occupant && this.w.atoms.has(x.occupant));
    if (full.length < n) this.fail(`양극에 리튬이 ${full.length}개뿐이에요.`);
    full.sort((p, q) => Math.abs(p.x - B.cathodeFace) - Math.abs(q.x - B.cathodeFace) || p.y - q.y);
    const trapped = [...this.w.atoms.values()].filter((x) => x.sei && x.el === 'Li').length;
    const gap = 80;
    const rows = Math.floor((B.bottom - B.top - 70) / gap);
    const solvent = allComponents(this.w).filter((c) => sameFormula(this.w, c, 'EC') && !this.w.atoms.get(c[0])!.gone);
    for (let i = 0; i < n; i++) {
      const site = full[i];
      const id = site.occupant!;
      site.occupant = null;
      const k = trapped + i;
      const layer = Math.floor(k / rows);
      // Film spots line the graphite face from top to bottom, then a second layer further out.
      const spot = { x: B.anodeFace + 22 + layer * 34, y: B.top + 70 + (k % rows) * gap + (layer % 2 ? gap / 2 : 0) };
      const at = this.w.atoms.get(id)!;
      const start = { x: at.x, y: at.y };
      this.moveGroup([id], start, this.ionPath(start, spot, B.cathodeFace, B.anodeFace), 0, 0.06 + i * 0.05, Math.min(0.95, 0.8 + i * 0.03));
      at.sei = true;
      this.A.trails.push(id);
      this.focus([id]);
      // A solvent molecule reacts there too: it comes to the surface and is used up into the film.
      if (solvent.length) {
        solvent.sort((p, q) => dist(centerOf(this.w, p), spot) - dist(centerOf(this.w, q), spot));
        const ec = solvent.shift()!;
        const c = centerOf(this.w, ec);
        const goal = { x: spot.x + 30, y: spot.y };
        this.moveGroup(ec, c, [c, lerpV(c, goal, 0.5), goal], this.rng.range(-1.5, 1.5), 0.25, 0.8);
        for (const x of ec) this.w.atoms.get(x)!.gone = true;
      }
    }
    this.A.wires.push({ path: [...this.stage.wire!].reverse(), count: n, t0: 0.1, t1: 0.85 });
  }

  // ------------------------------------------------------------ ops: energy diagram

  energyLevel = 0;
  energyUnit = '';

  /** energy -212 kJ/mol [barrier 40] : the energy goes down (or up) by this much during the step. */
  energy(a: string[]): void {
    const d = parseFloat((a[0] ?? '').replace('−', '-'));
    if (!Number.isFinite(d)) this.fail('energy는 이렇게 적어요: energy -57 kJ/mol  (에너지 언덕까지 그리려면 energy -57 kJ/mol barrier 40)');
    let unit = '';
    let barrier: number | undefined;
    for (let i = 1; i < a.length; i++) {
      if (a[i] === 'barrier') {
        barrier = parseFloat(a[++i] ?? '');
        if (!(barrier >= 0)) this.fail('barrier 뒤에는 0 이상인 숫자를 적어요(출발점에서 언덕 꼭대기까지 높이).');
      } else unit = a[i];
    }
    const cur = this.A.energy;
    const from = cur ? cur.from : this.energyLevel;
    const to = (cur ? cur.to : this.energyLevel) + d;
    if (unit) this.energyUnit = unit;
    this.A.energy = { from, to, barrier: barrier ?? cur?.barrier, unit: this.energyUnit };
    this.energyLevel = to;
  }

  // ------------------------------------------------------------ ops: collective mode

  durationOverride: number | null = null;

  /**
   * ensemble H2 + I2 <=> 2 HI for 8s : every molecule of these kinds flies about, bounces,
   * and reacts when the right pair collides (forward, and backward with <=>). Shows how an
   * equilibrium is reached and kept by both reactions running at once.
   */
  ensemble(a: string[]): void {
    const arrowI = a.findIndex((x) => x === '<=>' || x === '->' || x === '⇌' || x === '→');
    const forI = a.indexOf('for');
    if (arrowI < 0) this.fail('집단 모드는 이렇게 적어요: ensemble H2 + I2 <=> 2 HI for 8s');
    const reversible = a[arrowI] === '<=>' || a[arrowI] === '⇌';
    const seconds = forI >= 0 ? parseFloat(a[forI + 1]) : 8;
    const D = clamp(Number.isFinite(seconds) ? seconds : 8, 3, 15);
    const left = a.slice(0, arrowI).filter((x) => x !== '+');
    const right = a.slice(arrowI + 1, forI >= 0 ? forI : undefined).filter((x) => x !== '+');
    const expand = (side: string[]) => {
      const out: string[] = [];
      for (let i = 0; i < side.length; i++) {
        if (/^\d+$/.test(side[i])) {
          for (let k = 0; k < parseInt(side[i], 10); k++) out.push(normalizeFormula(side[i + 1]));
          i++;
        } else out.push(normalizeFormula(side[i]));
      }
      return out;
    };
    const L = expand(left);
    const R = expand(right);
    const diatomic = (f: string) => {
      const d = lookupMolecule(f);
      return d && d.atoms.length === 2 && d.bonds.length === 1 ? d : null;
    };
    const dA = diatomic(L[0] ?? '');
    const dB = diatomic(L[1] ?? '');
    const dP = diatomic(R[0] ?? '');
    const ok =
      L.length === 2 && R.length === 2 && R[0] === R[1] && dA && dB && dP &&
      dA.atoms[0].el === dA.atoms[1].el && dB.atoms[0].el === dB.atoms[1].el &&
      new Set(dP.atoms.map((x) => x.el)).size === 2 &&
      dP.atoms.some((x) => x.el === dA.atoms[0].el) && dP.atoms.some((x) => x.el === dB.atoms[0].el);
    if (!ok) this.fail('지금 집단 모드는 X2 + Y2 <=> 2 XY 꼴만 그려요(예: H2 + I2 <=> 2 HI, H2 + Cl2 -> 2 HCl).');
    const elA = dA!.atoms[0].el;
    const region = this.region(this.stage.defaultRegion);
    type Mol = { atoms: [string, string]; kind: 'A' | 'B' | 'P'; c: Vec; v: Vec; ang: number; spin: number };
    const kindOf = (c: string[]): Mol['kind'] | null => {
      const f = formulaOf(this.w, c);
      return f === L[0] ? 'A' : f === L[1] ? 'B' : f === R[0] ? 'P' : null;
    };
    const mols: Mol[] = [];
    for (const c of allComponents(this.w)) {
      if (this.w.atoms.get(c[0])!.crowd || c.length !== 2) continue;
      const kind = kindOf(c);
      if (!kind) continue;
      const [p, q] = c.map((id) => this.w.atoms.get(id)!);
      // Products keep the A-element atom first so reverse reactions know who goes where.
      const ordered: [string, string] = kind === 'P' && p.el !== elA ? [q.id, p.id] : [p.id, q.id];
      const pa = this.w.atoms.get(ordered[0])!;
      const pb = this.w.atoms.get(ordered[1])!;
      const speed = 150 * Math.sqrt(this.w.temp[region.name] ?? 1);
      mols.push({
        atoms: ordered,
        kind,
        c: lerpV(pa, pb, 0.5),
        v: fromAngle(this.rng.range(0, Math.PI * 2), speed * this.rng.range(0.6, 1.2)),
        ang: angleOf(sub(pb, pa)),
        spin: this.rng.range(-3, 3),
      });
    }
    if (mols.length < 2) this.fail(`장면에 ${L[0]}, ${L[1]}, ${R[0]} 분자가 거의 없어요. place ${L[0]} in ${region.name} x10 처럼 먼저 넣어 주세요.`);
    const blen = (m: Mol) => bondLength(this.w.atoms.get(m.atoms[0])!.el, this.w.atoms.get(m.atoms[1])!.el);
    const place = (m: Mol) => {
      const h = fromAngle(m.ang, blen(m) / 2);
      const p = this.w.atoms.get(m.atoms[0])!;
      const q = this.w.atoms.get(m.atoms[1])!;
      p.x = m.c.x - h.x;
      p.y = m.c.y - h.y;
      q.x = m.c.x + h.x;
      q.y = m.c.y + h.y;
    };
    const dt = 1 / 40;
    const steps = Math.round(D / dt);
    const sampleEvery = 4;
    const pF = 0.4;
    const pB = 0.1;
    const counts = () => {
      const n = { A: 0, B: 0, P: 0 };
      for (const m of mols) n[m.kind]++;
      return [
        [L[0], n.A],
        [L[1], n.B],
        [R[0], n.P],
      ] as [string, number][];
    };
    const kf = (time: number) => {
      for (const m of mols) {
        place(m);
        for (const id of m.atoms) {
          const at = this.w.atoms.get(id)!;
          const tr = this.A.tracks.get(id) ?? [];
          tr.push({ t: time / D, x: at.x, y: at.y });
          this.A.tracks.set(id, tr);
        }
      }
      this.A.tally.push({ t: time / D, counts: counts() });
    };
    const m0 = 26;
    // The count chart sits in the top-right corner; molecules keep out of it (and leave it if they start there).
    const chart = tallyBox(this.stage.width);
    const radius = (id: string) => element(this.w.atoms.get(id)!.el).r;
    const ends = (m: Mol): [Vec, Vec] => {
      const h = fromAngle(m.ang, blen(m) / 2);
      return [sub(m.c, h), add(m.c, h)];
    };
    /** Smallest gap between the atom surfaces of two molecules. */
    const gap = (p: Mol, q: Mol) => {
      const ep = ends(p);
      const eq = ends(q);
      let g = Infinity;
      for (let u = 0; u < 2; u++) {
        for (let v = 0; v < 2; v++) g = Math.min(g, dist(ep[u], eq[v]) - radius(p.atoms[u]) - radius(q.atoms[v]));
      }
      return g;
    };
    kf(0);
    for (let s = 1; s <= steps; s++) {
      const time = s * dt;
      for (const m of mols) {
        m.c = add(m.c, scale(m.v, dt));
        m.ang += m.spin * dt;
        if (m.c.x < region.x + m0 || m.c.x > region.x + region.w - m0) {
          m.v.x = -m.v.x;
          m.c.x = clamp(m.c.x, region.x + m0, region.x + region.w - m0);
        }
        if (m.c.y < region.y + m0 || m.c.y > region.y + region.h - m0) {
          m.v.y = -m.v.y;
          m.c.y = clamp(m.c.y, region.y + m0, region.y + region.h - m0);
        }
        const mc = 34;
        if (m.c.x > chart.x - mc && m.c.y < chart.y + chart.h + mc) {
          // Head out through the nearer free side (left or bottom).
          if (m.c.x - (chart.x - mc) < chart.y + chart.h + mc - m.c.y) m.v.x = -Math.abs(m.v.x);
          else m.v.y = Math.abs(m.v.y);
        }
      }
      for (let i = 0; i < mols.length; i++) {
        for (let j = i + 1; j < mols.length; j++) {
          const p = mols[i];
          const q = mols[j];
          const d = sub(q.c, p.c);
          const dd = Math.hypot(d.x, d.y);
          if (dd > 120 || dd < 1e-6) continue;
          const g = gap(p, q);
          if (g > 3) continue;
          const nrm = scale(d, 1 / dd);
          // Molecules that spun into each other are eased apart so they never overlap for long.
          if (g < 0) {
            p.c = sub(p.c, scale(nrm, -g / 2 + 0.5));
            q.c = add(q.c, scale(nrm, -g / 2 + 0.5));
          }
          const rel = sub(q.v, p.v);
          if (rel.x * nrm.x + rel.y * nrm.y >= 0) continue; // already separating
          const forward = (p.kind === 'A' && q.kind === 'B') || (p.kind === 'B' && q.kind === 'A');
          const backward = reversible && p.kind === 'P' && q.kind === 'P';
          if ((forward && this.rng.next() < pF) || (backward && this.rng.next() < pB)) {
            const tn = time / D;
            const [x1, x2] = p.atoms;
            const [y1, y2] = q.atoms;
            for (const [u, w] of [
              [x1, x2],
              [y1, y2],
            ]) {
              this.A.events.push({ t: tn, a: u, b: w, order: 0 });
              this.w.bonds.delete(bondKey(u, w));
            }
            let np: [string, string];
            let nq: [string, string];
            let kp: Mol['kind'];
            let kq: Mol['kind'];
            if (forward) {
              const aMol = p.kind === 'A' ? p : q;
              const bMol = p.kind === 'A' ? q : p;
              // Each atom takes the nearer partner, so nothing jumps across the collision.
              const at = (id: string) => this.w.atoms.get(id)!;
              const [a0, a1] = aMol.atoms;
              const [b0, b1] = bMol.atoms;
              const straight = dist(at(a0), at(b0)) + dist(at(a1), at(b1));
              const crossed = dist(at(a0), at(b1)) + dist(at(a1), at(b0));
              np = [a0, straight <= crossed ? b0 : b1];
              nq = [a1, straight <= crossed ? b1 : b0];
              kp = 'P';
              kq = 'P';
            } else {
              // Products keep the A-element atom first: the two A atoms pair up, so do the two B atoms.
              np = [p.atoms[0], q.atoms[0]];
              nq = [p.atoms[1], q.atoms[1]];
              kp = 'A';
              kq = 'B';
            }
            for (const [u, w] of [np, nq]) {
              this.A.events.push({ t: tn, a: u, b: w, order: 1 });
              this.w.bonds.set(bondKey(u, w), { a: u, b: w, order: 1 });
            }
            const pos = (id: string) => this.w.atoms.get(id)!;
            p.atoms = np;
            p.kind = kp;
            q.atoms = nq;
            q.kind = kq;
            p.c = lerpV(pos(np[0]), pos(np[1]), 0.5);
            q.c = lerpV(pos(nq[0]), pos(nq[1]), 0.5);
            p.ang = angleOf(sub(pos(np[1]), pos(np[0])));
            q.ang = angleOf(sub(pos(nq[1]), pos(nq[0])));
          }
          // Elastic bounce along the line of centres.
          const k = rel.x * nrm.x + rel.y * nrm.y;
          p.v = add(p.v, scale(nrm, k));
          q.v = sub(q.v, scale(nrm, k));
        }
      }
      if (s % sampleEvery === 0) kf(time);
      else for (const m of mols) place(m);
    }
    this.durationOverride = D;
  }

  // ------------------------------------------------------------ ops: more phase changes

  /** 빈 이웃 자리 두 곳 중 다가오는 한 쌍에서 가장 가까운 곳을 고른다. */
  nearestPairSlots(lattice: string[], cat: string[], an: string[], spacing: number): [Vec, Vec] {
    const pts = this.latticeUnits(lattice).map((u) => ({ p: centerOf(this.w, u), plus: componentCharge(this.w, u) > 0 }));
    const dirs = [{ x: spacing, y: 0 }, { x: -spacing, y: 0 }, { x: 0, y: spacing }, { x: 0, y: -spacing }];
    const here = lerpV(centerOf(this.w, cat), centerOf(this.w, an), 0.5);
    const free = (p: Vec, plus: boolean) => !pts.some((x) => dist(x.p, p) < spacing * 0.5 ||
      (x.plus === plus && dist(x.p, p) < spacing * 1.1));
    let best: { pair: [Vec, Vec]; distance: number } | null = null;
    for (const x of pts) for (const d of dirs) {
      const p = add(x.p, d);
      if (!free(p, !x.plus)) continue;
      for (const d2 of dirs) {
        const q = add(p, d2);
        if (!free(q, x.plus)) continue;
        const distance = dist(here, lerpV(p, q, 0.5));
        if (!best || distance < best.distance - 1e-6) best = { pair: x.plus ? [q, p] : [p, q], distance };
      }
    }
    if (!best) this.fail('고체에 이온 한 쌍이 들어갈 빈 곳이 없어요.');
    return best.pair;
  }

  /** 물을 붙인 채 접근하고, 접촉 직전에 물을 밀어낸 다음 한 쌍으로 자리 잡는다. */
  precipitatePair(cat: string[], an: string[], goals: [Vec, Vec], lattice: string[]): void {
    const starts = [centerOf(this.w, cat), centerOf(this.w, an)];
    const middle = lerpV(starts[0], starts[1], 0.5);
    const axis = dist(starts[0], starts[1]) > 1e-6 ? norm(sub(starts[1], starts[0])) : { x: 1, y: 0 };
    const contact = dist(goals[0], goals[1]);
    const release = Math.min(dist(starts[0], starts[1]), contact + 40);
    const comps = [cat, an];
    for (let i = 0; i < 2; i++) {
      const comp = comps[i], sign = i === 0 ? -1 : 1;
      const held = this.group(comp);
      const near = add(middle, scale(axis, sign * release / 2));
      const touch = add(middle, scale(axis, sign * contact / 2));
      // 여러 원자로 된 이온은 전하를 띤 바깥 원자가 상대를 향하도록 물과 함께 돌린다.
      const facing = angleOf(scale(axis, -sign));
      const charged = comp.map((id) => this.w.atoms.get(id)!).filter((at) =>
        formalCharge(this.w, at) * componentCharge(this.w, comp) > 0 && dist(at, starts[i]) > 1);
      charged.sort((a, b) => angDiff(angleOf(sub(a, starts[i])), facing) - angDiff(angleOf(sub(b, starts[i])), facing));
      const turn = charged.length ? signedAng(angleOf(sub(charged[0], starts[i])), facing) : 0;
      this.moveGroup(held, starts[i], [starts[i], near], turn, 0, 0.42);
      const waters = [...new Set(comp.flatMap((id) => this.w.attached.get(id) ?? []))];
      for (const anchor of waters) {
        const water = component(this.w, anchor);
        const p = centerOf(this.w, water);
        const away = dist(p, middle) > 1e-6 ? norm(sub(p, middle)) : scale(axis, sign);
        this.moveGroup(water, p, [p, add(p, scale(away, 65))], 0, 0.42, 0.60);
      }
      this.detach(comp);
      this.moveGroup(comp, near, [near, touch], 0, 0.42, 0.64);
      held.forEach((id) => this.causalMotion.add(id));
    }
    // 만난 뒤에는 둘 사이 간격을 유지하며 함께 격자로 간다.
    const goalMiddle = lerpV(goals[0], goals[1], 0.5);
    const turn = signedAng(angleOf(axis), angleOf(sub(goals[1], goals[0])));
    this.moveGroup([...cat, ...an], middle, [middle, goalMiddle], turn, 0.64, 1);
    lattice.push(...cat, ...an);
    lattice.forEach((id) => this.causalMotion.add(id));
    this.focusMol(cat);
    this.focusMol(an);
    this.A.pulls = [...(this.A.pulls ?? []), { a: anchorOf(this.w, cat), b: anchorOf(this.w, an) }];
  }

  /** precipitate Ag+ Cl- x3 [onto s] : dissolved ions shed their water and lock into a solid lattice. */
  precipitate(a: string[]): void {
    const mult = a.find((x) => /^x\d+$/.test(x));
    const n = mult ? clamp(parseInt(mult.slice(1), 10), 1, 12) : 1;
    const ontoI = a.indexOf('onto');
    const onto = ontoI >= 0 ? a[ontoI + 1] : null;
    const [catF, anF] = a.filter((x, i) => !/^x\d+$/.test(x) && x !== 'onto' && (ontoI < 0 || i !== ontoI + 1));
    if (!catF || !anF) this.fail('석출은 이렇게 적어요: precipitate Ag+ Cl- x3  (있던 결정에 더하려면 onto s)');
    if (formulaCharge(catF) <= 0 || formulaCharge(anF) >= 0) this.fail('precipitate는 양이온, 음이온 순서로 적어요. 예: precipitate Ag+ Cl-');
    if (formulaCharge(catF) !== -formulaCharge(anF)) this.fail('지금은 전하 크기가 같은 이온 짝(Ag+와 Cl-, Ca2+와 CO32- 등)만 석출할 수 있어요.');
    const inLattice = new Set([...this.w.crystals.values()].flat());
    const pick = (f: string) =>
      allComponents(this.w)
        .filter((c) => !this.w.atoms.get(c[0])!.crowd && sameFormula(this.w, c, normalizeFormula(f)) && !c.some((x) => inLattice.has(x)))
        .slice(0, n);
    const cats = pick(catF);
    const ans = pick(anF);
    if (cats.length < n || ans.length < n) this.fail(`녹아 있는 ${catF}·${anF}가 ${n}개씩 있어야 해요(지금 ${cats.length}개, ${ans.length}개).`);
    const all = [...cats, ...ans];
    let s = this.ionRadius(cats[0]) + this.ionRadius(ans[0]) + 7;
    // Lattice positions: existing crystal's free neighbours, or a new block where the ions are.
    let name = onto;
    let slots: { p: Vec; parity: number }[] = [];
    let catParity = 0;
    if (onto) {
      const lat = this.w.crystals.get(onto);
      if (!lat) this.fail(`'${onto}'이라는 결정이 없어요.`);
      const units = this.latticeUnits(lat);
      if (!units.length) this.fail(`'${onto}' 결정이 다 녹아서 덧붙일 곳이 없어요.`);
      const pts = units.map((u) => centerOf(this.w, u));
      // Keep the crystal's own spacing.
      let m = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i], pts[j]));
      if (Number.isFinite(m) && m < s * 1.6) s = m;
      const first = pts[0];
      catParity = componentCharge(this.w, units[0]) > 0 ? 0 : 1;
      const occupied = (p: Vec) => pts.some((x) => dist(x, p) < s * 0.5);
      for (const p of pts) {
        for (const d of [
          { x: s, y: 0 },
          { x: -s, y: 0 },
          { x: 0, y: s },
          { x: 0, y: -s },
        ]) {
          const q = add(p, d);
          if (occupied(q) || slots.some((sl) => dist(sl.p, q) < s * 0.5)) continue;
          const parity = (Math.round((q.x - first.x) / s) + Math.round((q.y - first.y) / s)) & 1;
          slots.push({ p: q, parity });
        }
      }
      // Holes inside the crystal first (most neighbours), then the top face.
      const nb = (q: Vec) => pts.filter((x) => dist(x, q) < s * 1.1).length;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const inside = (q: Vec) =>
        q.x > Math.min(...xs) - 2 && q.x < Math.max(...xs) + 2 && q.y > Math.min(...ys) - 2 && q.y < Math.max(...ys) + 2 ? 1 : 0;
      slots.sort((p, q) => inside(q.p) - inside(p.p) || nb(q.p) - nb(p.p) || p.p.y - q.p.y);
    } else {
      name = this.autoName('ppt');
      const c = centroid(all.map((x) => centerOf(this.w, x)));
      const cols = Math.max(2, Math.ceil(Math.sqrt(2 * n)));
      const rows = Math.ceil((2 * n) / cols) + 1;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          slots.push({ p: { x: c.x + (i - (cols - 1) / 2) * s, y: c.y + (j - (rows - 1) / 2) * s }, parity: (i + j) & 1 });
        }
      }
      this.w.crystals.set(name!, []);
    }
    const lattice = this.w.crystals.get(name!)!;
    if (this.plannedMotion) {
      const previous = [...lattice];
      for (let k = 0; k < cats.length; k++) {
        const goals: [Vec, Vec] = lattice.length
          ? this.nearestPairSlots(lattice, cats[k], ans[k], s)
          : [centerOf(this.w, cats[k]), centerOf(this.w, ans[k])];
        if (!lattice.length) {
          const middle = lerpV(goals[0], goals[1], 0.5);
          const sign = goals[0].x <= goals[1].x ? -1 : 1;
          goals[0] = add(middle, { x: sign * s / 2, y: 0 });
          goals[1] = add(middle, { x: -sign * s / 2, y: 0 });
        }
        this.precipitatePair(cats[k], ans[k], goals, lattice);
      }
      lattice.splice(0, lattice.length, ...previous, ...all.flat());
      return;
    }
    const take = (parity: number) => {
      const k = slots.findIndex((sl) => sl.parity === parity);
      if (k < 0) this.fail('결정에 이온이 들어갈 빈 곳이 모자라요.');
      return slots.splice(k, 1)[0].p;
    };
    // The first cation of a new crystal takes parity 0; for an existing one, cations go where cations sit.
    all.forEach((comp, k) => {
      const isCat = k < cats.length;
      const goal = take(isCat ? catParity : 1 - catParity);
      this.detach(comp);
      const start = centerOf(this.w, comp);
      this.moveGroup(comp, start, this.wander(start, goal, null, 0.3), this.uprightTurn(comp), 0.05, 0.95);
      lattice.push(...comp);
      this.focusMol(comp);
    });
  }

  /**
   * precipitate using a b [onto s] [as s] : exactly these two dissolved ions (by their declared
   * names, cation first) shed their water and become one solid; with `onto`, they join a solid of
   * the same salt that is already there. Nothing is chosen by formula, so no other ion is used up.
   */
  precipitateUsing(a: string[]): void {
    const usage = 'precipitate using a b  (있던 고체에 더하려면 onto s, 새 고체에 이름을 붙이려면 as s)';
    const refs: string[] = [];
    let onto: string | null = null;
    let asName: string | null = null;
    for (let i = 1; i < a.length; i++) {
      if (a[i] === 'onto') onto = a[++i] ?? '';
      else if (a[i] === 'as') asName = a[++i] ?? '';
      else refs.push(a[i]);
    }
    if (refs.length !== 2 || onto === '' || asName === '') this.fail(`고른 이온의 석출은 이렇게 적어요: ${usage}`);
    if (onto && asName) this.fail('onto와 as는 함께 쓰지 않아요. 있던 고체에 더하면 그 고체의 이름을 그대로 써요.');
    const unknown = refs.filter((r) => !this.w.names.has(r));
    if (unknown.length) this.fail(`precipitate using에는 mol로 선언한 이름을 적어요(${unknown.join(', ')}은(는) 선언한 이름이 아니에요).`);
    const cat = component(this.w, this.w.names.get(refs[0])!);
    const an = component(this.w, this.w.names.get(refs[1])!);
    if (cat[0] === an[0]) this.fail('같은 이온을 두 번 적었어요.');
    const inSolid = new Set([...this.w.crystals.values()].flat());
    const adsorbed = new Set(this.w.sites.map((x) => x.occupant).filter(Boolean) as string[]);
    [cat, an].forEach((c, i) => {
      const at = this.w.atoms.get(c[0])!;
      if (c.length !== 1) this.fail(`${refs[i]}은(는) 원자 하나로 된 이온이 아니에요.`);
      if (at.crowd || at.lattice || at.gone || at.sei || inSolid.has(at.id) || adsorbed.has(at.id)) this.fail(`${refs[i]}은(는) 물에 녹아 있는 이온이 아니에요.`);
    });
    const qc = componentCharge(this.w, cat);
    const qa = componentCharge(this.w, an);
    if (qc <= 0 || qa >= 0) this.fail('precipitate using은 양이온, 음이온 순서로 적어요.');
    if (qc !== -qa) this.fail('전하 크기가 같은 이온 짝만 석출할 수 있어요.');
    let s = this.ionRadius(cat) + this.ionRadius(an) + 7;
    let name: string;
    let goalCat: Vec;
    let goalAn: Vec;
    if (onto) {
      const lat = this.w.crystals.get(onto);
      if (!lat) this.fail(`'${onto}'이라는 고체가 없어요.`);
      const units = this.latticeUnits(lat);
      if (!units.length) this.fail(`'${onto}'에는 이온이 남아 있지 않아요.`);
      const kinds = new Set(units.map((u) => formulaOf(this.w, u)));
      if (kinds.size !== 2 || !kinds.has(formulaOf(this.w, cat)) || !kinds.has(formulaOf(this.w, an))) this.fail(`'${onto}'은(는) 같은 염의 고체가 아니에요.`);
      const pts = units.map((u) => ({ p: centerOf(this.w, u), plus: componentCharge(this.w, u) > 0 }));
      let m = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i].p, pts[j].p));
      if (Number.isFinite(m) && m < s * 1.6) s = m;
      const taken = (q: Vec) => pts.some((x) => dist(x.p, q) < s * 0.5);
      const dirs = [
        { x: s, y: 0 },
        { x: -s, y: 0 },
        { x: 0, y: s },
        { x: 0, y: -s },
      ];
      // A place for the pair: two free neighbouring spots, each beside ions of the other sign.
      // The spots with the most neighbours come first (the solid stays compact), then the ones
      // nearest the middle of the solid and nearest the pair.
      const here = lerpV(centerOf(this.w, cat), centerOf(this.w, an), 0.5);
      const cen = centroid(pts.map((x) => x.p));
      const nb = (q: Vec) => pts.filter((y) => dist(y.p, q) < s * 1.1).length;
      let best: { c: Vec; a: Vec; score: number } | null = null;
      for (const x of pts) {
        for (const d of dirs) {
          const q1 = add(x.p, d);
          if (taken(q1)) continue;
          for (const d2 of dirs) {
            const q2 = add(q1, d2);
            if (taken(q2) || dist(q2, x.p) < 1) continue;
            // q1 sits beside x, so it takes the other sign; q2, one step further, the same sign as x.
            const mid = lerpV(q1, q2, 0.5);
            const score = (nb(q1) + nb(q2)) * 1000 - dist(mid, cen) * 4 - dist(mid, here) * 0.2;
            if (!best || score > best.score) best = { c: x.plus ? q2 : q1, a: x.plus ? q1 : q2, score };
          }
        }
      }
      if (!best) this.fail('고체에 이온 한 쌍이 들어갈 빈 곳이 없어요.');
      name = onto;
      goalCat = best.c;
      goalAn = best.a;
    } else {
      name = asName ?? this.autoName('ppt');
      if (this.w.crystals.has(name) || this.w.names.has(name) || (this.continuation && this.nameInUse(name))) this.fail(`'${name}'이라는 이름은 이미 쓰고 있어요.`);
      const c = lerpV(centerOf(this.w, cat), centerOf(this.w, an), 0.5);
      // Side by side where they meet, each on the side it came from.
      const left = centerOf(this.w, cat).x <= centerOf(this.w, an).x;
      goalCat = { x: c.x + (left ? -s / 2 : s / 2), y: c.y };
      goalAn = { x: c.x + (left ? s / 2 : -s / 2), y: c.y };
      this.w.crystals.set(name, []);
    }
    const lattice = this.w.crystals.get(name)!;
    if (this.plannedMotion) {
      const goals: [Vec, Vec] = onto ? this.nearestPairSlots(lattice, cat, an, s) : [goalCat, goalAn];
      this.precipitatePair(cat, an, goals, lattice);
      return;
    }
    const moves: [string[], Vec][] = [
      [cat, goalCat],
      [an, goalAn],
    ];
    for (const u of this.latticeUnits(lattice)) this.focusMol(u);
    for (const [comp, goal] of moves) {
      this.detach(comp);
      const start = centerOf(this.w, comp);
      this.moveGroup(comp, start, this.wander(start, goal, null, 0.3), 0, 0.05, 0.95);
      lattice.push(...comp);
      this.focusMol(comp);
    }
  }

  // ------------------------------------------------------------ ops: a piece of metal in a solution

  /**
   * metal m = Zn at center 3x2 : a piece of metal, its atoms named m1, m2, … row by row. The outer
   * electrons of these atoms belong to the piece as a whole, so no dots are drawn on them.
   */
  metal(cmd: Cmd): void {
    const a = cmd.args;
    const mol = a[2] ? lookupMolecule(a[2]) : undefined;
    if (a[1] !== '=' || !a[0] || !mol) this.fail('금속 조각은 이렇게 적어요: metal m = Zn at center 3x2');
    if (mol.atoms.length !== 1 || !METALS.has(mol.atoms[0].el)) this.fail(`'${a[2]}'은(는) 금속 조각으로 쓸 수 없어요. Zn, Cu, Ag 같은 금속 원자를 적어 주세요.`);
    const name = a[0];
    let nx = 3;
    let ny = 2;
    let c = regionCenter(this.region(this.stage.defaultRegion));
    for (let i = 3; i < a.length; i++) {
      if (a[i] === 'at' && a[i + 1]) {
        const xy = a[i + 1].match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
        c = xy ? { x: parseFloat(xy[1]), y: parseFloat(xy[2]) } : regionCenter(this.region(a[i + 1]));
        i++;
        continue;
      }
      const d = a[i].match(/^(\d+)x(\d+)$/);
      if (d) {
        nx = clamp(parseInt(d[1], 10), 1, 6);
        ny = clamp(parseInt(d[2], 10), 1, 4);
      }
    }
    const r = element(mol.atoms[0].el).r;
    const step = r * 2 + 2;
    const rowH = step * 0.87;
    const ids: string[] = [];
    let k = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        // Rows are set half a step apart, as close-packed atoms sit.
        const x = c.x + (i - (nx - 1) / 2) * step + (j % 2 ? step / 4 : -step / 4);
        const y = c.y + (j - (ny - 1) / 2) * rowH;
        const got = this.spawn(a[2], `${name}${++k}`, false, { x, y });
        for (const id of got) this.w.atoms.get(id)!.lattice = true;
        ids.push(...got);
      }
    }
    this.w.crystals.set(name, ids);
    this.w.names.set(name, ids[0]);
  }

  /** The piece of metal an atom is part of. */
  pieceOf(id: string): string | null {
    if (!this.w.atoms.get(id)?.lattice) return null;
    for (const [name, ids] of this.w.crystals) if (ids.includes(id)) return name;
    return null;
  }

  /**
   * land a1 a2 on m1 : dissolved metal ions come to rest against a surface atom of a piece of
   * metal, each on its own free spot. Their water stays behind.
   */
  land(a: string[]): void {
    const onI = a.indexOf('on');
    const refs = onI > 0 ? a.slice(0, onI) : [];
    if (!refs.length || !a[onI + 1]) this.fail('land는 이렇게 적어요: land a1 a2 on m1  (금속 표면에 닿을 이온들, 닿을 표면 원자)');
    const spot = this.w.atoms.get(this.mol(a[onI + 1])[0])!;
    const piece = this.pieceOf(spot.id);
    if (!piece) this.fail(`${a[onI + 1]}은(는) 금속 조각의 원자가 아니에요.`);
    const members = this.w.crystals.get(piece)!.map((id) => this.w.atoms.get(id)!);
    const cen = centroid(members);
    const out = angleOf(dist(spot, cen) > 1 ? sub(spot, cen) : { x: 0, y: -1 });
    const rs = element(spot.el).r;
    const ions = refs.map((ref) => {
      const c = this.mol(ref);
      const at = this.w.atoms.get(c[0])!;
      if (c.length !== 1 || !METALS.has(at.el) || at.lattice || this.w.crystals.get(piece)!.includes(at.id)) this.fail(`${ref}은(는) 물에 녹아 있는 금속 이온이 아니에요.`);
      return at;
    });
    // Places touching the surface atom and clear of every other atom of the piece, nearest the outward side first.
    const places: Vec[] = [];
    const r0 = element(ions[0].el).r;
    for (let k = 0; k < 24; k++) {
      const ang = out + ((k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI) / 12;
      const p = add(spot, fromAngle(ang, rs + r0 + 2));
      if (members.some((m) => m.id !== spot.id && dist(m, p) < element(m.el).r + r0 + 1)) continue;
      if (places.some((q) => dist(q, p) < r0 * 2 + 2)) continue;
      places.push(p);
    }
    if (places.length < ions.length) this.fail('이 표면 원자 둘레에 이온이 닿을 자리가 모자라요.');
    // Each ion takes the free place nearest to it, so that their paths do not cross.
    const free = places.slice(0, ions.length);
    for (const ion of [...ions].sort((p, q) => dist(p, spot) - dist(q, spot))) {
      free.sort((p, q) => dist(p, ion) - dist(q, ion));
      const goal = free.shift()!;
      const start = { x: ion.x, y: ion.y };
      this.detach([ion.id]);
      this.moveGroup([ion.id], start, [start, lerpV(start, goal, 0.6), goal], 0, 0, 1);
      // Its electrons, when they come, arrive on the side that touches the metal.
      ion.face = angleOf(sub(spot, goal));
      // From here on it stays where it touches the piece and moves with it.
      this.w.crystals.get(piece)!.push(ion.id);
    }
    this.focus(this.w.crystals.get(piece)!);
  }

  /** join a1 a2 to m : atoms that have become neutral where they touch a piece of metal are part of it from now on. */
  join(a: string[]): void {
    const toI = a.indexOf('to');
    const refs = toI > 0 ? a.slice(0, toI) : [];
    const piece = a[toI + 1];
    if (!refs.length || !piece) this.fail('join은 이렇게 적어요: join a1 a2 to m');
    const lat = this.w.crystals.get(piece);
    if (!lat || !lat.some((id) => this.w.atoms.get(id)?.lattice)) this.fail(`'${piece}'이라는 금속 조각이 없어요.`);
    for (const ref of refs) {
      const c = this.mol(ref);
      const at = this.w.atoms.get(c[0])!;
      if (c.length !== 1 || !METALS.has(at.el)) this.fail(`${ref}은(는) 금속 원자가 아니에요.`);
      if (componentCharge(this.w, c) !== 0) this.fail(`${ref}은(는) 아직 이온이에요. 전자를 받아 원자가 된 뒤에 금속에 붙어요.`);
      if (!lat.includes(at.id)) this.fail(`${ref}은(는) ${piece}에 닿아 있지 않아요. 먼저 land로 표면에 닿게 해 주세요.`);
      at.lattice = true;
      this.touched.add(at.id);
    }
    this.focus(lat);
  }

  /** leave m1 from m : a surface atom that has given up its electrons leaves the piece as an ion and goes out into the water. */
  leave(a: string[]): void {
    const ref = a[0];
    const piece = a[2];
    if (a[1] !== 'from' || !ref || !piece) this.fail('leave는 이렇게 적어요: leave m1 from m');
    const lat = this.w.crystals.get(piece);
    if (!lat) this.fail(`'${piece}'이라는 금속 조각이 없어요.`);
    const c = this.mol(ref);
    const at = this.w.atoms.get(c[0])!;
    if (!lat.includes(at.id)) this.fail(`${ref}은(는) ${piece}의 원자가 아니에요.`);
    if (componentCharge(this.w, c) <= 0) this.fail(`${ref}은(는) 전자를 내주지 않았어요. 이온이 된 원자만 금속에서 떨어져 나와요.`);
    lat.splice(lat.indexOf(at.id), 1);
    at.lattice = false;
    const rest = lat.map((id) => this.w.atoms.get(id)!);
    const cen = rest.length ? centroid(rest) : { x: at.x, y: at.y + 1 };
    // Out through the widest opening between the atoms around it.
    const near = rest
      .filter((m) => dist(m, at) < element(m.el).r + element(at.el).r + 10)
      .map((m) => angleOf(sub(m, at)))
      .sort((p, q) => p - q);
    let dirAng = angleOf(sub(at, cen));
    if (near.length >= 2) {
      let bestGap = -1;
      near.forEach((a0, i) => {
        const a1 = i + 1 < near.length ? near[i + 1] : near[0] + 2 * Math.PI;
        if (a1 - a0 > bestGap) {
          bestGap = a1 - a0;
          dirAng = (a0 + a1) / 2;
        }
      });
    }
    const region = this.region(this.stage.defaultRegion);
    const start = { x: at.x, y: at.y };
    const far = add(start, fromAngle(dirAng, 150));
    const goal = { x: clamp(far.x, region.x + 80, region.x + region.w - 80), y: clamp(far.y, region.y + 90, region.y + region.h - 80) };
    if (this.plannedMotion) {
      this.afterCommands.push(() => {
        const hops = this.A.arrows.filter((a) => a.kind === 'single' && a.src?.a === at.id && a.src.kind !== 'bond' &&
          a.dst?.kind === 'atom' && a.dst.a !== at.id);
        if (hops.length && this.A.phase) {
          const phase = this.A.phase;
          // 첫 전자가 출발하기 전에는 그대로다. 마지막 전자가 도착할 때까지 표면에서 4만큼만 나온다.
          const tr: Keyframe[] = [];
          const count = hops.length;
          let lo = phase.b0, hi = phase.b1;
          for (let i = 0; i < 50; i++) {
            const mid = (lo + hi) / 2;
            if (hopProgress(phase, 0, count, mid) <= 0.02) lo = mid;
            else hi = mid;
          }
          const samples = [...new Set([lo, phase.b0, phase.b1, 0.90, ...Array.from({ length: 401 }, (_, i) => i / 400)])].sort((a, b) => a - b);
          for (const t of samples) {
            const gone = hops.reduce((sum, _, j) => sum + clamp((hopProgress(phase, j, count, t) - 0.02) / 0.98, 0, 1), 0) / count;
            const drift = gentle(clamp((t - phase.b1) / Math.max(1e-9, 0.90 - phase.b1), 0, 1));
            const fraction = (4 / Math.max(4, dist(start, goal))) * gone;
            tr.push({ t, ...lerpV(start, goal, fraction + (1 - fraction) * drift) });
          }
          this.A.tracks.set(at.id, tr);
          Object.assign(at, goal);
        } else this.moveGroup([at.id], start, [start, goal], 0, 0, 0.6);
        if (this.freeSolvent().length) this.hydrate([at.id], hops.length ? 0.90 : 0.6, 1);
        [...this.group([at.id]), ...lat].forEach((id) => this.causalMotion.add(id));
      });
    } else {
      this.moveGroup([at.id], start, [start, lerpV(start, goal, 0.5), goal], 0, 0, 0.6);
      if (this.freeSolvent().length) this.hydrate([at.id], 0.35, 1);
    }
    this.focus([at.id, ...lat]);
    this.touched.add(at.id);
  }

  /** freeze water : water molecules settle into the ordered hydrogen-bond network of ice. */
  freeze(a: string[]): void {
    const r = this.region(a[0] ?? this.stage.defaultRegion);
    const waters = allComponents(this.w).filter(
      (c) => this.w.atoms.get(c[0])!.crowd && formulaOf(this.w, c) === 'H2O' && inRegion(r, centerOf(this.w, c)),
    );
    if (waters.length < 6) this.fail(`${r.label}에 얼 물 분자가 모자라요(crowd H2O로 먼저 깔아 주세요).`);
    // Honeycomb positions for the O atoms (O···O about 2.75 Å apart).
    const d = bondLength('O', 'H') * 2.5;
    const slots: Vec[] = [];
    const c = regionCenter(r);
    const dx = d * Math.sqrt(3);
    for (let row = -6; row <= 6; row++) {
      for (let col = -8; col <= 8; col++) {
        const base = { x: c.x + col * dx + (row & 1 ? dx / 2 : 0), y: c.y + row * 1.5 * d };
        for (const p of [base, { x: base.x, y: base.y + d }]) {
          if (inRegion(r, p, 34)) slots.push(p);
        }
      }
    }
    slots.sort((p, q) => dist(p, c) - dist(q, c));
    const use = slots.slice(0, waters.length);
    // Each slot gets the nearest remaining water.
    const left = [...waters];
    const plan: { comp: string[]; slot: Vec }[] = [];
    for (const slot of use) {
      let bi = 0;
      for (let i = 1; i < left.length; i++) if (dist(centerOf(this.w, left[i]), slot) < dist(centerOf(this.w, left[bi]), slot)) bi = i;
      plan.push({ comp: left.splice(bi, 1)[0], slot });
    }
    // Work out final orientations on a scratch copy, then animate there.
    const before = new Map(plan.flatMap((p) => p.comp.map((id) => [id, { x: this.w.atoms.get(id)!.x, y: this.w.atoms.get(id)!.y }] as const)));
    for (const { comp, slot } of plan) {
      const O = comp.map((id) => this.w.atoms.get(id)!).find((x) => x.el === 'O')!;
      const sh = sub(slot, O);
      for (const id of comp) shift(this.w.atoms.get(id)!, sh);
    }
    orientWaters(this.w, plan.map((p) => p.comp), 3);
    const ids: string[] = [];
    for (const { comp } of plan) {
      const O = comp.map((id) => this.w.atoms.get(id)!).find((x) => x.el === 'O')!;
      const Hs = comp.map((id) => this.w.atoms.get(id)!).filter((x) => x.el === 'H');
      const finalPos = new Map(comp.map((id) => [id, { x: this.w.atoms.get(id)!.x, y: this.w.atoms.get(id)!.y }]));
      const b0 = before.get(O.id)!;
      const bis0 = add(sub(before.get(Hs[0].id)!, b0), sub(before.get(Hs[1].id)!, b0));
      const bis1 = add(sub(finalPos.get(Hs[0].id)!, finalPos.get(O.id)!), sub(finalPos.get(Hs[1].id)!, finalPos.get(O.id)!));
      // Back to the start pose, then a rigid move with turn to the final pose.
      for (const id of comp) {
        const p = before.get(id)!;
        this.w.atoms.get(id)!.x = p.x;
        this.w.atoms.get(id)!.y = p.y;
      }
      const rot = signedAng(angleOf(bis0), angleOf(bis1));
      this.moveGroup(comp, b0, [b0, finalPos.get(O.id)!], rot, 0.05, 0.95);
      // moveGroup turns about O, which reproduces the scratch orientation.
      ids.push(...comp);
    }
    this.w.crystals.set('ice', ids);
    this.w.temp[r.name] = 0.35;
  }

  /** melt water : the ice network loosens and the molecules wander off. */
  melt(a: string[]): void {
    const r = this.region(a[0] ?? this.stage.defaultRegion);
    const ice = this.w.crystals.get('ice');
    if (!ice?.length) this.fail('녹을 얼음이 없어요. 먼저 freeze로 얼려 주세요.');
    const comps = allComponents(this.w).filter((c) => c.some((x) => ice.includes(x)));
    this.w.crystals.delete('ice');
    for (const comp of comps) {
      const start = centerOf(this.w, comp);
      const goal = {
        x: clamp(start.x + this.rng.range(-70, 70), r.x + 30, r.x + r.w - 30),
        y: clamp(start.y + this.rng.range(-70, 70), r.y + 30, r.y + r.h - 30),
      };
      this.moveGroup(comp, start, this.wander(start, goal, r, 0.4), this.rng.range(-2, 2), 0.05, 1);
    }
    this.w.temp[r.name] = 1.6;
  }

  /** boil : a vapour bubble forms inside the liquid, rises and bursts at the surface. */
  boil(a: string[]): void {
    const S = this.needSurface('boil');
    const water = this.stage.regions.water;
    const air = this.stage.regions.air;
    const k = a[0] && /^\d+$/.test(a[0]) ? clamp(parseInt(a[0], 10), 2, 6) : 3;
    const x = this.rng.range(water.x + 120, water.x + water.w - 120);
    const start = { x, y: water.y + water.h - 70 };
    const top = { x: x + this.rng.range(-20, 20), y: S + 26 };
    this.A.bubbles.push({ p0: start, p1: top, r: 38, t0: 0, t1: 0.85 });
    const pool = allComponents(this.w)
      .filter((c) => this.w.atoms.get(c[0])!.crowd && formulaOf(this.w, c) === 'H2O' && centerOf(this.w, c).y > S)
      .sort((p, q) => dist(centerOf(this.w, p), start) - dist(centerOf(this.w, q), start))
      .slice(0, k);
    // Timed to the bubble: gather while it grows, rise with it, then escape when it bursts.
    const riseStart = 0.3 * 0.85;
    pool.forEach((comp, i) => {
      this.detach(comp);
      const c = centerOf(this.w, comp);
      const off = fromAngle((2 * Math.PI * i) / k, 14);
      const goal = { x: clamp(x + this.rng.range(-200, 200), air.x + 40, air.x + air.w - 40), y: this.rng.range(air.y + 40, S - 90) };
      this.moveGroup(comp, c, [c, add(start, off)], this.rng.range(-2, 2), 0, riseStart);
      const p1 = add(start, off);
      this.moveGroup(comp, p1, [p1, add(top, off)], 0, riseStart, 0.85);
      const p2 = add(top, off);
      this.moveGroup(comp, p2, [p2, add(top, { x: off.x * 2, y: -60 }), goal], this.rng.range(-2, 2), 0.85, 1);
      this.focusMol(comp);
    });
  }

  // ------------------------------------------------------------ ops: condensation / hydrolysis

  /** Molecules that should slide apart a little more at the end of the step (e.g. released water). */
  drift: { ids: string[]; from: Vec }[] = [];
  /** 완성될 물에서 원래 붙어 있던 H가 돌아갈 자리다. */
  waterTurns: { oxygen: string; hydrogen: string; angle: number }[] = [];
  /** Groups of atoms that were moved as one body in this step, and how far each was turned. */
  rigid: { ids: string[]; theta: number }[] = [];
  /** 새 결합점에 맞춘 조각은 접촉 원자를 중심으로 돌며 내부 길이를 유지한다. */
  dockTurns: { ids: string[]; pivot: string; angle: number }[] = [];

  /**
   * Put the atoms `g` back into the shape they had (`pre`), turned and shifted as one body so as
   * to match where they have just been laid out as closely as a rigid move can. The atoms that
   * bond to the rest of the molecule count most, so the new bond comes out right.
   */
  dock(g: string[], pre: Map<string, Vec>, contact?: { inside: string; outside: string }): void {
    if (contact) {
      // 새 결합 길이와 조각 내부 길이는 고정하고, 겹치면 접촉 방향만 조금 바꾼다.
      const a = this.w.atoms.get(contact.inside)!;
      const b = this.w.atoms.get(contact.outside)!;
      const bond = getBond(this.w, a.id, b.id)!;
      const length = bondLength(a.el, b.el, bond.order);
      const direction = norm(sub(pre.get(a.id)!, pre.get(b.id)!));
      const pose = (angle: number, turn: number) => {
        const goal = add(b, scale(rotate(direction, angle), length));
        return new Map(g.map((id) => [id, add(goal, rotate(sub(pre.get(id)!, pre.get(a.id)!), turn))]));
      };
      const penalty = this.posePenalty(g);
      const movingPenalty = this.posePenalty(g, -0.5, true);
      const scorePose = (candidate: Map<string, Vec>, turn: number) => {
        let score = penalty(candidate);
        // 끝점이 비어 있어도 직선 이동 중 다른 가지를 스칠 수 있다.
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const positions = new Map([...this.w.atoms].map(([id, at]) =>
            [id, lerpV(pre.get(id) ?? at, candidate.get(id) ?? at, u)]));
          const center = positions.get(a.id)!;
          for (const id of g) positions.set(id, add(center, rotate(sub(pre.get(id)!, pre.get(a.id)!), turn * u)));
          score += movingPenalty(positions);
        }
        return score;
      };
      let best = pose(0, 0), turn = 0, score = scorePose(best, 0);
      for (let degrees = 2; degrees <= 180 && score > 0; degrees += 2) for (const sign of [-1, 1]) {
        const candidate = pose(sign * degrees * Math.PI / 180, 0);
        const next = scorePose(candidate, 0);
        if (next < score) { best = candidate; score = next; }
        if (score === 0) break;
      }
      // 평행 이동으로 틈을 찾지 못하면 붙는 조각도 돌린다. 큰 쪽 분자는 그대로 둔다.
      if (g.length > 1 && score > 0) {
        for (let degrees = 2; degrees <= 90 && score > 0; degrees += 2) for (const sign of [-1, 1]) {
          const theta = sign * degrees * Math.PI / 180;
          for (const offset of [0, -2, 2, -4, 4, -8, 8, -16, 16, -32, 32]) {
            const candidate = pose(offset * Math.PI / 180, theta);
            const next = scorePose(candidate, theta);
            if (next < score) { best = candidate; score = next; turn = theta; }
            if (score === 0) break;
          }
          if (score === 0) break;
        }
      }
      for (const [id, p] of best) Object.assign(this.w.atoms.get(id)!, p);
      if (turn) this.dockTurns.push({ ids: g, pivot: a.id, angle: turn });
      return;
    }
    const inG = new Set(g);
    const wt = (id: string) => (neighbors(this.w, id).some((n) => !inG.has(n.id)) ? 8 : 1);
    let sw = 0;
    const cp = { x: 0, y: 0 };
    const cq = { x: 0, y: 0 };
    for (const id of g) {
      const p = pre.get(id);
      const q = this.w.atoms.get(id);
      if (!p || !q) return;
      const k = wt(id);
      sw += k;
      cp.x += p.x * k;
      cp.y += p.y * k;
      cq.x += q.x * k;
      cq.y += q.y * k;
    }
    cp.x /= sw;
    cp.y /= sw;
    cq.x /= sw;
    cq.y /= sw;
    let sin = 0;
    let cos = 0;
    for (const id of g) {
      const p = sub(pre.get(id)!, cp);
      const q = sub(this.w.atoms.get(id)!, cq);
      const k = wt(id);
      sin += k * (p.x * q.y - p.y * q.x);
      cos += k * (p.x * q.x + p.y * q.y);
    }
    const theta = Math.atan2(sin, cos);
    for (const id of g) {
      const at = this.w.atoms.get(id)!;
      const p = add(cq, rotate(sub(pre.get(id)!, cp), theta));
      at.x = p.x;
      at.y = p.y;
    }
    this.rigid.push({ ids: g, theta });
  }

  /**
   * condensation g1.C2 g2.N : A loses its OH, B loses an H, A–B bond forms and the OH + H
   * leave together as a water molecule (net reaction, drawn without electron arrows).
   */
  condensation(a: string[]): void {
    const [ra, rb] = a;
    if (!ra || !rb) this.fail('축합은 이렇게 적어요: condensation g1.C2 g2.N  (OH를 내보내는 원자, H를 내보내는 원자)');
    const A = this.atom(ra);
    const B = this.atom(rb);
    if (component(this.w, A).includes(B)) this.fail('같은 분자 안의 두 원자는 축합으로 잇지 않아요.');
    const oh = neighbors(this.w, A)
      .map((n) => this.w.atoms.get(n.id)!)
      .find((o) => o.el === 'O' && neighbors(this.w, o.id).length === 2 && neighbors(this.w, o.id).some((x) => this.w.atoms.get(x.id)!.el === 'H'));
    if (!oh) this.fail(`${ra}에 결합한 -OH가 없어요. 축합은 -OH와 결합한 원자를 먼저 적어요.`);
    // Of B's hydrogens, the one nearest the -OH leaves with it.
    const selectedH = this.reference?.steps[this.A.index]?.shifts?.find((s) => s.src.kind === 'lp' && s.src.a === oh.id && s.dst.kind === 'bond')?.dst.b;
    const hb = (selectedH && this.w.atoms.get(selectedH)) || neighbors(this.w, B)
      .map((n) => this.w.atoms.get(n.id)!)
      .filter((h) => h.el === 'H')
      .sort((p, q) => dist(p, oh!) - dist(q, oh!))[0];
    if (!hb) this.fail(`${rb}에 결합한 H가 없어요.`);
    // Where each electron pair ends up: B's lone pair joins A, the A–OH pair stays on O, a lone
    // pair of that O takes the H, and the B–H pair stays on B.
    if (this.w.atoms.get(B)!.lp > 0 && oh.lp > 0) {
      this.A.shifts = [
        { src: { kind: 'lp', a: B }, dst: { kind: 'bond', a: B, b: A } },
        { src: { kind: 'bond', a: A, b: oh.id }, dst: { kind: 'atom', a: oh.id } },
        { src: { kind: 'lp', a: oh.id }, dst: { kind: 'bond', a: oh.id, b: hb.id } },
        { src: { kind: 'bond', a: B, b: hb.id }, dst: { kind: 'atom', a: B } },
      ];
    }
    for (const [x, y] of [
      [A, oh.id],
      [B, hb.id],
    ]) {
      this.w.bonds.delete(bondKey(x, y));
    }
    this.w.bonds.set(bondKey(A, B), { a: A, b: B, order: 1 });
    this.w.bonds.set(bondKey(oh.id, hb.id), { a: oh.id, b: hb.id, order: 1 });
    for (const id of [A, B, oh.id, hb.id]) this.touched.add(id);
    const water = component(this.w, oh.id);
    this.drift.push({ ids: water, from: lerpV(this.w.atoms.get(A)!, this.w.atoms.get(B)!, 0.5) });
    this.focus([A, B, ...water]);
    // The old bonds shrink and the new ones grow while the pieces move into place and the water leaves.
    this.A.phase = { ...CHANGE };
  }

  /** hydrolysis g1.C2~g2.N [with w] : a water molecule splits the bond: OH goes to the first atom, H to the second. */
  hydrolysis(a: string[]): void {
    const ref = a[0];
    if (!ref || !ref.includes('~')) this.fail('가수분해는 이렇게 적어요: hydrolysis g1.C2~g2.N  (with w 로 물 분자를 고를 수 있어요)');
    const [A, B] = ref.split('~').map((r) => this.atom(r));
    if (!getBond(this.w, A, B)) this.fail(`${ref}는 결합해 있지 않아요.`);
    const withI = a.indexOf('with');
    let water: string[];
    const referenceShifts = this.reference?.steps[this.A.index]?.shifts;
    const selectedO = referenceShifts?.find((s) => s.dst.kind === 'bond' && s.dst.b === A && s.src.kind === 'lp')?.src.a;
    if (withI >= 0 && a[withI + 1]) water = this.mol(a[withI + 1]);
    else if (selectedO && this.w.atoms.has(selectedO)) water = component(this.w, selectedO);
    else {
      // The nearest free water molecule: one released earlier counts as much as background water.
      const mid = lerpV(this.w.atoms.get(A)!, this.w.atoms.get(B)!, 0.5);
      const attached = new Set([...this.w.attached.values()].flat());
      const pool = allComponents(this.w)
        .filter((c) => formulaOf(this.w, c) === 'H2O' && !c.some((x) => attached.has(x)))
        .sort((p, q) => dist(centerOf(this.w, p), mid) - dist(centerOf(this.w, q), mid));
      water = pool[0] ?? this.spawn('H2O', this.autoName('~H2O'), true, add(mid, { x: 0, y: -90 }));
    }
    if (formulaOf(this.w, water) !== 'H2O') this.fail('가수분해에 쓸 분자는 물(H2O)이어야 해요.');
    this.detach(water);
    const O = water.map((id) => this.w.atoms.get(id)!).find((x) => x.el === 'O')!;
    const Hs = water.map((id) => this.w.atoms.get(id)!).filter((x) => x.el === 'H');
    // The H nearer to B goes to B.
    const Bpos = this.w.atoms.get(B)!;
    Hs.sort((p, q) => dist(p, Bpos) - dist(q, Bpos));
    const selectedH = referenceShifts?.find((s) => s.src.kind === 'lp' && s.src.a === B && s.dst.kind === 'bond')?.dst.b;
    const hToB = Hs.find((h) => h.id === selectedH) ?? Hs[0];
    if (this.tight) {
      // The water comes right up first: its O beside A, in the opening next to B, with the H that
      // B will take turned towards B. Then its pairs only have a bond's length to reach.
      const Aat = this.w.atoms.get(A)!;
      const mol = component(this.w, A).map((id) => this.w.atoms.get(id)!);
      const angs = neighbors(this.w, A)
        .map((n) => angleOf(sub(this.w.atoms.get(n.id)!, Aat)))
        .sort((p, q) => p - q);
      const reach = element(Aat.el).r + element('O').r + 15;
      let spot: Vec = add(Aat, scale(norm(sub(Aat, centroid(mol))), reach));
      let bestScore = -Infinity;
      angs.forEach((a0, i) => {
        const a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI;
        const p = add(Aat, fromAngle((a0 + a1) / 2, reach));
        const room = Math.min(...mol.filter((o) => o.id !== A).map((o) => dist(o, p) - element(o.el).r));
        const score = Math.min(room, 34) - dist(p, Bpos) * 0.5;
        if (score > bestScore) {
          bestScore = score;
          spot = p;
        }
      });
      const from = { x: O.x, y: O.y };
      const rot = signedAng(angleOf(sub(hToB, O)), angleOf(sub(Bpos, spot)));
      const around = centroid(mol);
      const clear = Math.max(...mol.map((x) => dist(x, around) + element(x.el).r)) + 34;
      const { path, turnBy } = routeIn(from, spot, norm(sub(spot, Aat)), around, clear);
      const route = this.plannedMotion ? this.clearRoute(water, from, spot, rot, 0, 0.36, { path, turnBy }) : { path, turnBy };
      this.moveGroup(water, from, route.path, rot, 0, 0.36, route.turnBy);
    }
    // Where each electron pair ends up: a lone pair of the water's O joins A, the A–B pair stays
    // on B, a lone pair of B takes the H, and the O–H pair stays on O.
    if (O.lp > 0 && this.w.atoms.get(B)!.lp > 0) {
      this.A.shifts = [
        { src: { kind: 'lp', a: O.id }, dst: { kind: 'bond', a: O.id, b: A } },
        { src: { kind: 'bond', a: A, b: B }, dst: { kind: 'atom', a: B } },
        { src: { kind: 'lp', a: B }, dst: { kind: 'bond', a: B, b: hToB.id } },
        { src: { kind: 'bond', a: O.id, b: hToB.id }, dst: { kind: 'atom', a: O.id } },
      ];
    }
    this.w.bonds.delete(bondKey(A, B));
    this.w.bonds.delete(bondKey(O.id, hToB.id));
    this.w.bonds.set(bondKey(A, O.id), { a: A, b: O.id, order: 1 });
    this.w.bonds.set(bondKey(B, hToB.id), { a: B, b: hToB.id, order: 1 });
    // The water's atoms now belong to the named molecules: draw them as such.
    for (const at of [O, ...Hs]) {
      if (at.crowd) {
        at.crowd = false;
        at.num = ++this.w.counter;
      }
    }
    for (const id of [A, B, O.id, hToB.id]) this.touched.add(id);
    this.focus([A, B, O.id, ...Hs.map((h) => h.id)]);
    this.A.phase = this.tight ? { b0: 0.42, b1: 0.76, c0: 0.72, c1: 0.96 } : { ...CHANGE };
  }

  // ------------------------------------------------------------ ops: membrane

  needMembrane(op: string) {
    if (!this.stage.membrane) this.fail(`${op}는 membrane 무대에서 써요. stage membrane`);
    return this.stage.membrane;
  }

  /** protein k = channel K+ at 330 / protein p = pump at 680 */
  protein(cmd: Cmd): void {
    this.needMembrane('protein');
    const a = cmd.args;
    const [name, eq, kind] = a;
    if (eq !== '=' || !name || (kind !== 'channel' && kind !== 'pump' && kind !== 'synthase')) {
      this.fail('막 단백질은 이렇게 적어요: protein k = channel K+ at 330  /  protein p = pump at 680  /  protein a = synthase at 700');
    }
    const atI = a.indexOf('at');
    const x = atI >= 0 ? parseFloat(a[atI + 1]) : 500;
    if (!Number.isFinite(x)) this.fail('단백질 위치는 x 좌표 숫자로 적어 주세요. 예: at 330');
    const carries =
      kind === 'synthase' ? 'H+' : kind === 'channel' ? (a[3] && a[3] !== 'at' ? normalizeFormula(a[3]) : undefined) : undefined;
    if (this.w.proteins.some((p) => p.name === name)) this.fail(`이름 '${name}'은(는) 이미 썼어요.`);
    this.w.proteins.push({ name, kind, x: clamp(x, 60, this.stage.width - 60), carries });
  }

  proteinNamed(name: string) {
    const p = this.w.proteins.find((x) => x.name === name);
    if (!p) this.fail(`'${name}'이라는 막 단백질이 없어요. protein ${name} = channel ... 으로 먼저 넣어 주세요.`);
    return p;
  }

  sideOf(p: Vec): 'outside' | 'inside' {
    const m = this.stage.membrane!;
    return p.y < (m.y0 + m.y1) / 2 ? 'outside' : 'inside';
  }

  /** Path through the membrane at x, from one side to a free spot on the other. */
  crossPath(start: Vec, x: number, to: 'outside' | 'inside', spread = 150): Vec[] {
    const m = this.stage.membrane!;
    const down = to === 'inside';
    const near = down ? m.y0 - 26 : m.y1 + 26;
    const far = down ? m.y1 + 26 : m.y0 - 26;
    const region = this.region(down ? m.inside : m.outside);
    let goal = this.freePoint(region, 36, 50) ?? randomInRegion(region, this.rng);
    goal = { x: clamp(x + this.rng.range(-spread, spread), region.x + 40, region.x + region.w - 40), y: goal.y };
    return [start, { x, y: near }, { x, y: (m.y0 + m.y1) / 2 }, { x, y: far }, goal];
  }

  /** Molecules of a formula (or a name) on one side, nearest to x first. */
  onSide(ref: string, side: 'outside' | 'inside' | null, x: number): string[][] {
    if (this.w.names.has(ref)) return [this.mol(ref)];
    const f = normalizeFormula(ref);
    const crowdOk = f === 'H2O';
    const comps = allComponents(this.w).filter((c) => {
      const at = this.w.atoms.get(c[0])!;
      if (at.crowd && !crowdOk) return false;
      if (!sameFormula(this.w, c, f)) return false;
      return side === null || this.sideOf(centerOf(this.w, c)) === side;
    });
    comps.sort((p, q) => Math.abs(centerOf(this.w, p).x - x) - Math.abs(centerOf(this.w, q).x - x));
    return comps;
  }

  /** cross K+ via k : one particle passes through a channel to the other side (by default from the crowded side). */
  cross(a: string[]): void {
    this.needMembrane('cross');
    // cross 3 H+ via a : the same crossing several times, one after another.
    if (/^\d+$/.test(a[0] ?? '')) {
      const n = clamp(parseInt(a[0], 10), 1, 8);
      for (let i = 0; i < n; i++) this.crossOne(a.slice(1), i, n);
      return;
    }
    this.crossOne(a, 0, 1);
  }

  crossOne(a: string[], i: number, n: number): void {
    const ref = a[0];
    if (!ref) this.fail('막 통과는 이렇게 적어요: cross K+ via k  (통로 없이 지나가는 작은 분자는 cross O2)');
    const viaI = a.indexOf('via');
    const ch = viaI >= 0 ? this.proteinNamed(a[viaI + 1]) : null;
    let comp: string[];
    if (this.w.names.has(ref)) comp = this.mol(ref);
    else {
      const outN = this.onSide(ref, 'outside', 0).length;
      const inN = this.onSide(ref, 'inside', 0).length;
      const from = outN >= inN ? 'outside' : 'inside';
      const list = this.onSide(ref, from, ch?.x ?? 500);
      if (!list.length) this.fail(`${ref}이(가) 막 양쪽 어디에도 없어요.`);
      comp = list[0];
    }
    if (ch?.carries && formulaOf(this.w, comp) !== ch.carries) {
      this.warn(`통로 ${ch.name}은(는) ${ch.carries}용인데 ${formulaOf(this.w, comp)}이(가) 지나가게 적혔어요.`);
    }
    const c = centerOf(this.w, comp);
    const to = this.sideOf(c) === 'outside' ? 'inside' : 'outside';
    this.detach(comp); // the water shell stays at the mouth
    const path = this.crossPath(c, ch ? ch.x : c.x, to);
    const t0 = n > 1 ? (i / n) * 0.55 : 0;
    this.moveGroup(comp, c, path, 0, t0, n > 1 ? t0 + 0.45 : 1);
    this.A.trails.push(anchorOf(this.w, comp));
    this.focusMol(comp);
  }

  /** pump p 3 Na+ out 2 K+ in : active transport through a pump, one group after the other. */
  pump(a: string[]): void {
    this.needMembrane('pump');
    const p = this.proteinNamed(a[0]);
    if (p.kind !== 'pump') this.fail(`${p.name}은(는) 펌프가 아니라 통로예요.`);
    const groups: { n: number; f: string; dir: 'out' | 'in' }[] = [];
    for (let i = 1; i < a.length; i += 3) {
      const n = parseInt(a[i], 10);
      const f = a[i + 1];
      const dir = a[i + 2];
      if (!(n > 0) || !f || (dir !== 'out' && dir !== 'in')) this.fail('펌프는 이렇게 적어요: pump p 3 Na+ out 2 K+ in');
      groups.push({ n, f, dir });
    }
    if (!groups.length) this.fail('펌프는 이렇게 적어요: pump p 3 Na+ out 2 K+ in');
    groups.forEach((g, gi) => {
      const from = g.dir === 'out' ? 'inside' : 'outside';
      const list = this.onSide(g.f, from, p.x);
      if (list.length < g.n) this.fail(`${from === 'inside' ? '안쪽' : '바깥'}에 ${g.f}이(가) ${list.length}개뿐이에요. ${g.n}개가 필요해요.`);
      const span = 1 / groups.length;
      const t0 = gi * span * 0.9;
      const t1 = Math.min(1, t0 + span * 1.1);
      list.slice(0, g.n).forEach((comp, k) => {
        const c = centerOf(this.w, comp);
        this.detach(comp);
        const path = this.crossPath(c, p.x + (k - (g.n - 1) / 2) * 12, g.dir === 'out' ? 'outside' : 'inside', 130);
        this.moveGroup(comp, c, path, 0, t0, t1);
        this.focusMol(comp);
      });
    });
  }

  /** osmosis [n] : water moves across toward the side with more dissolved particles. */
  osmosis(a: string[]): void {
    this.needMembrane('osmosis');
    const n = a[0] && /^\d+$/.test(a[0]) ? clamp(parseInt(a[0], 10), 1, 12) : 4;
    const solutes = (side: 'outside' | 'inside') =>
      allComponents(this.w).filter((c) => !this.w.atoms.get(c[0])!.crowd && this.sideOf(centerOf(this.w, c)) === side && formulaOf(this.w, c) !== 'H2O')
        .length;
    const so = solutes('outside');
    const si = solutes('inside');
    if (so === si) this.warn('막 양쪽에 녹아 있는 입자 수가 같아서 물이 어느 한쪽으로 더 건너가지 않아요.');
    const to: 'outside' | 'inside' = si >= so ? 'inside' : 'outside';
    const from = to === 'inside' ? 'outside' : 'inside';
    const aq = this.w.proteins.find((p) => p.kind === 'channel' && p.carries === 'H2O');
    const x = aq?.x ?? 500;
    const movers = this.onSide('H2O', from, x).filter((c) => this.w.atoms.get(c[0])!.crowd).slice(0, n);
    const back = n >= 4 ? this.onSide('H2O', to, x).filter((c) => this.w.atoms.get(c[0])!.crowd).slice(0, Math.floor(n / 4)) : [];
    const all = [...movers.map((c) => [c, to] as const), ...back.map((c) => [c, from] as const)];
    all.forEach(([comp, dest], k) => {
      const c = centerOf(this.w, comp);
      const t0 = (k / Math.max(1, all.length)) * 0.55;
      const path = this.crossPath(c, aq ? x + this.rng.range(-6, 6) : c.x, dest, 160);
      this.moveGroup(comp, c, path, this.rng.range(-2, 2), t0, Math.min(1, t0 + 0.45));
      this.focusMol(comp);
    });
  }

  // ------------------------------------------------------------ ops: electrodes (cell stage)

  needElectrode(name: string) {
    const e = this.stage.electrodes?.[name];
    if (!this.stage.electrodes) this.fail('전극 명령은 cell 무대에서 써요. stage cell');
    if (!e) this.fail(`전극 '${name}'이 없어요. left(산화 전극) 또는 right(환원 전극)를 써요.`);
    return e;
  }

  /** electrode left = Zn : a metal plate made of metal atoms. */
  electrode(cmd: Cmd): void {
    const [name, eq, metal] = cmd.args;
    if (eq !== '=' || !name || !metal) this.fail('전극은 이렇게 적어요: electrode left = Zn');
    const e = this.needElectrode(name);
    if (!lookupMolecule(metal) || lookupMolecule(metal)!.atoms.length !== 1 || !METALS.has(lookupMolecule(metal)!.atoms[0].el)) {
      this.fail(`'${metal}'은(는) 전극 금속으로 쓸 수 없어요. Zn, Cu, Ag 같은 금속 원자를 적어 주세요.`);
    }
    const r = element(lookupMolecule(metal)!.atoms[0].el).r;
    const step = r * 2 + 2;
    const ids: string[] = [];
    let k = 0;
    for (let y = e.top + r + 4; y <= e.bottom; y += step) {
      for (const dx of [-step / 2, step / 2]) {
        const got = this.spawn(metal, `${name}${++k}`, false, { x: e.x + dx, y });
        for (const id of got) this.w.atoms.get(id)!.lattice = true;
        ids.push(...got);
      }
    }
    this.w.crystals.set(name, ids);
    this.w.plate[name] = 0;
  }

  /** oxidize left : a surface atom of the plate leaves its electrons in the plate and goes into solution as an ion. */
  oxidize(a: string[]): void {
    const name = a[0] ?? 'left';
    const e = this.needElectrode(name);
    const lattice = this.w.crystals.get(name);
    if (!lattice?.length) this.fail(`${name} 전극에 금속 원자가 없어요. electrode ${name} = Zn 처럼 먼저 만들어 주세요.`);
    const liquidTop = this.region(e.region).y + 10;
    const faceX = (id: string) => this.w.atoms.get(id)!.x * e.face;
    const cands = lattice.filter((id) => this.w.atoms.get(id)!.y > liquidTop + 20);
    if (!cands.length) this.fail('용액에 잠긴 금속 원자가 없어요.');
    const maxFace = Math.max(...cands.map(faceX));
    const surface = cands.filter((id) => faceX(id) > maxFace - 4);
    const midY = (liquidTop + e.bottom) / 2;
    surface.sort((p, q) => Math.abs(this.w.atoms.get(p)!.y - midY) - Math.abs(this.w.atoms.get(q)!.y - midY));
    const pick = surface[0];
    const at = this.w.atoms.get(pick)!;
    const nOut = at.lp * 2 + at.rad;
    if (nOut <= 0) this.fail('이 금속 원자에는 내줄 전자가 없어요.');
    // Electrons step back into the plate.
    const inner = { x: at.x - e.face * 34, y: at.y };
    const mid = this.ensureMid();
    for (let i = 0; i < nOut; i++) {
      const p0 = add(at, { x: e.face * 4, y: (i - (nOut - 1) / 2) * 7 - 14 });
      const c = add(lerpV(p0, inner, 0.5), { x: 0, y: -26 - 10 * i });
      const free = { atom: pick, plate: name, slot: (this.w.plate[name] ?? 0) + i, dir: 'toPlate' as const };
      this.A.arrows.push({ kind: 'single', p0, c, p1: add(inner, { x: 0, y: -10 }), line: this.line, free });
    }
    for (const world of [mid, this.w]) {
      const x = world.atoms.get(pick)!;
      x.lp = 0;
      x.rad = 0;
    }
    this.w.plate[name] = (this.w.plate[name] ?? 0) + nOut;
    at.lattice = false;
    lattice.splice(lattice.indexOf(pick), 1);
    // The new ion drifts out into the solution, picking up a water shell if there is water around.
    const region = this.region(e.region);
    const start = { x: at.x, y: at.y };
    const goal = {
      x: clamp(at.x + e.face * this.rng.range(110, 170), region.x + 50, region.x + region.w - 50),
      y: clamp(at.y + this.rng.range(-60, 60), region.y + 50, region.y + region.h - 50),
    };
    this.moveGroup([pick], start, [start, lerpV(start, goal, 0.5), goal], 0, 0.56, 1);
    if (this.freeSolvent().length) this.hydrate([pick], 0.62, 1);
    this.A.phase = { b0: 0.22, b1: 0.56, c0: 0.56 };
    this.focus([pick]);
  }

  /** wire 2 : electrons run through the wire from the oxidation electrode to the reduction electrode. */
  wireOp(a: string[]): void {
    if (!this.stage.wire) this.fail('wire는 cell 무대에서 써요.');
    const n = a[0] && /^\d+$/.test(a[0]) ? parseInt(a[0], 10) : this.w.plate.left ?? 0;
    if (n <= 0) this.fail('도선으로 보낼 전자가 없어요. 먼저 oxidize left로 전자를 만들어 주세요.');
    if ((this.w.plate.left ?? 0) < n) this.fail(`산화 전극에 전자가 ${this.w.plate.left ?? 0}개뿐이에요. ${n}개를 보낼 수 없어요.`);
    this.w.plate.left -= n;
    this.w.plate.right = (this.w.plate.right ?? 0) + n;
    this.A.wires.push({ path: this.stage.wire, count: n, t0: 0.05, t1: 0.95, from: 'left', to: 'right' });
  }

  /** reduce Cu2+ at right : an ion meets the plate surface and takes electrons from it, joining the metal. */
  reduce(a: string[]): void {
    const at = a.indexOf('at');
    const name = at >= 0 ? a[at + 1] : 'right';
    const e = this.needElectrode(name);
    const ref = a[0];
    if (!ref) this.fail('환원은 이렇게 적어요: reduce Cu2+ at right');
    const region = this.region(e.region);
    const comp = this.mol(ref, (c) => inRegion(region, centerOf(this.w, c)));
    if (comp.length !== 1) this.fail('reduce는 금속 이온 하나(Cu2+, Ag+ 등)에 써요.');
    const ion = this.w.atoms.get(comp[0])!;
    const q = componentCharge(this.w, comp);
    if (q <= 0) this.fail(`${ref}는 양이온이 아니에요.`);
    if ((this.w.plate[name] ?? 0) < q) {
      this.fail(`${name} 전극에 전자가 ${this.w.plate[name] ?? 0}개뿐이에요. ${ref}에는 ${q}개가 필요해요. 먼저 wire로 보내 주세요.`);
    }
    const lattice = this.w.crystals.get(name) ?? [];
    // Spot on the plate's working face, at the row nearest the ion.
    const faceX = Math.max(...lattice.map((id) => this.w.atoms.get(id)!.x * e.face)) * e.face;
    const r = element(ion.el).r;
    const step = r * 2 + 2;
    const rows = lattice.map((id) => this.w.atoms.get(id)!).filter((x) => Math.abs(x.x - faceX) < 4);
    const liquidTop = region.y + 10;
    let spotY = clamp(ion.y, liquidTop + 30, e.bottom);
    const taken = (y: number) => [...this.w.atoms.values()].some((x) => x.lattice && Math.abs(x.x - (faceX + e.face * step)) < 4 && Math.abs(x.y - y) < step * 0.8);
    const rowYs = rows.map((x) => x.y).filter((y) => y > liquidTop + 20).sort((p, q2) => Math.abs(p - spotY) - Math.abs(q2 - spotY));
    spotY = rowYs.find((y) => !taken(y)) ?? spotY;
    const spot = { x: faceX + e.face * step, y: spotY };
    const start = { x: ion.x, y: ion.y };
    // Its water shell stays behind.
    this.detach(comp);
    this.moveGroup(comp, start, [start, lerpV(start, spot, 0.6), spot], 0, 0, 0.48);
    this.ensureMid();
    const plateAtom = { x: faceX, y: spotY };
    for (let i = 0; i < q; i++) {
      const p0 = add(plateAtom, { x: 0, y: -12 + 10 * i });
      const p1 = add(spot, { x: -e.face * (r + 4), y: -6 + 8 * i });
      const c = add(lerpV(p0, p1, 0.5), { x: 0, y: -24 - 12 * i });
      const free = { atom: ion.id, plate: name, slot: (this.w.plate[name] ?? 0) - 1 - i, dir: 'fromPlate' as const };
      this.A.arrows.push({ kind: 'single', p0, c, p1, line: this.line, free });
    }
    ion.lp += Math.floor(q / 2);
    ion.rad += q % 2;
    ion.lattice = true;
    this.w.plate[name] -= q;
    lattice.push(ion.id);
    this.A.phase = { b0: 0.5, b1: 0.8, c0: 0.8 };
    this.focus(comp);
  }

  /** bridge Cl- K+ [x2] : salt-bridge ions move in to keep each beaker neutral (anion → left, cation → right). */
  bridgeOp(a: string[]): void {
    const br = this.stage.bridge;
    if (!br) this.fail('bridge는 cell 무대에서 써요.');
    const mult = a.find((x) => /^x\d+$/.test(x));
    const n = mult ? parseInt(mult.slice(1), 10) : 1;
    const [anion, cation] = a.filter((x) => !/^x\d+$/.test(x));
    if (!anion || !cation) this.fail('염다리는 이렇게 적어요: bridge Cl- K+ x2 (음이온은 왼쪽, 양이온은 오른쪽으로)');
    if (formulaCharge(anion) >= 0) this.fail(`${anion}은(는) 음이온이 아니에요. 음이온을 앞에 적어 주세요.`);
    if (formulaCharge(cation) <= 0) this.fail(`${cation}은(는) 양이온이 아니에요. 양이온을 뒤에 적어 주세요.`);
    for (let k = 0; k < n; k++) {
      for (const [f, mouth, regionName] of [
        [anion, br.left, 'left'],
        [cation, br.right, 'right'],
      ] as const) {
        const ids = this.spawn(f, this.autoName(normalizeFormula(f)), false, mouth);
        for (const id of ids) this.A.appear.add(id);
        const region = this.region(regionName);
        const goal = this.freePoint(region, 40, 60) ?? randomInRegion(region, this.rng);
        const c = centerOf(this.w, ids);
        this.moveGroup(ids, c, this.wander(c, goal, region, 0.4), 0, 0.05, 1);
        this.focusMol(ids);
      }
    }
  }

  temperature(op: string, a: string[]): void {
    const r = this.region(a[0] ?? this.stage.defaultRegion);
    this.w.temp[r.name] = op === 'heat' ? 2.6 : 0.4;
  }

  // ------------------------------------------------------------ end of step

  /** 남아 있는 결합으로 연결된 조각을 보존하고 새 결합점만 맞춘다. */
  tightLayout(before: World): void {
    const retained = cloneWorld(this.w);
    for (const key of retained.bonds.keys()) if (!before.bonds.has(key)) retained.bonds.delete(key);
    const groups = allComponents(retained);
    const groupOf = new Map(groups.flatMap((g) => g.map((id) => [id, g] as const)));
    const heavy = (g: string[]) => g.filter((id) => this.w.atoms.get(id)!.el !== 'H').length;
    const pre = new Map([...this.w.atoms].map(([id, a]) => [id, { x: a.x, y: a.y }]));
    for (const comp of allComponents(this.w)) {
      if (!comp.some((id) => this.touched.has(id))) continue;
      const pieces = [...new Set(comp.map((id) => groupOf.get(id)!))];
      pieces.sort((a, b) => heavy(b) - heavy(a) || b.length - a.length);
      const placed = new Set(pieces[0]);
      while (placed.size < comp.length) {
        const join = [...this.w.bonds.values()].find((b) => comp.includes(b.a) && placed.has(b.a) !== placed.has(b.b));
        if (!join) break;
        const outside = placed.has(join.a) ? join.a : join.b;
        const inside = outside === join.a ? join.b : join.a;
        const g = groupOf.get(inside)!;
        this.dock(g, pre, { inside, outside });
        g.forEach((id) => placed.add(id));
      }
    }
    // 완전히 떨어진 조각만 반응면 바깥으로 보낸다. 결합이 남은 분자는 돌리지 않는다.
    for (const g of groups) {
      if (!g.some((id) => this.touched.has(id)) || g.some((id) => this.drift.some((d) => d.ids.includes(id)))) continue;
      if (g.some((id) => neighbors(this.w, id).some((n) => !g.includes(n.id)))) continue;
      const broken = [...before.bonds.values()].find((b) => g.includes(b.a) !== g.includes(b.b) && !this.w.bonds.has(bondKey(b.a, b.b)));
      if (!broken || g.length > 2) continue;
      const inside = g.includes(broken.a) ? broken.a : broken.b;
      const outside = inside === broken.a ? broken.b : broken.a;
      const delta = scale(norm(sub(pre.get(inside)!, pre.get(outside)!)), 60);
      for (const id of g) shift(this.w.atoms.get(id)!, delta);
    }
    for (const d of this.drift) {
      const oxygen = d.ids.find((id) => this.w.atoms.get(id)!.el === 'O');
      if (!oxygen) continue;
      const original = neighbors(before, oxygen).find((n) => d.ids.includes(n.id));
      const received = neighbors(this.w, oxygen).find((n) => n.id !== original?.id);
      if (!original || !received) continue;
      const O = this.w.atoms.get(oxygen)!;
      const angle = angleOf(sub(this.w.atoms.get(received.id)!, O));
      const targetAngle = angle - 104.5 * Math.PI / 180;
      const H = this.w.atoms.get(original.id)!;
      this.waterTurns.push({ oxygen, hydrogen: H.id, angle: signedAng(angleOf(sub(H, O)), targetAngle) });
      Object.assign(H, add(O, fromAngle(targetAngle, dist(H, O))));
    }
  }

  /** 접근 경로 뒤에 반응을 잇는다. H 전달과 완성된 물 이동은 서로 다른 구간이다. */
  tightMotion(before: World, start: Map<string, Vec>): void {
    const A = this.A;
    if (A.phase) {
      A.phase.c0 = Math.max(A.phase.c0, A.phase.b1);
      if (this.drift.length) A.phase.c1 = Math.max(A.phase.c0 + 0.12, 0.70);
    }
    const c0 = A.phase?.c0 ?? 0, c1 = A.phase?.c1 ?? 1;
    const handed = new Map<string, string>();
    if (A.phase) for (const id of before.atoms.keys()) {
      const was = neighbors(before, id).map((n) => n.id);
      const now = neighbors(this.w, id).map((n) => n.id);
      if (was.length && now.length && !now.some((n) => was.includes(n))) handed.set(id, now[0]);
    }
    const prefix = new Map([...A.tracks].map(([id, tr]) => [id, tr.map((k) => ({ ...k }))]));
    for (const [id, at] of this.w.atoms) {
      const b = before.atoms.get(id);
      if (!b || handed.has(id)) continue;
      if (this.causalMotion.has(id)) continue;
      const old = prefix.get(id);
      const p = start.get(id)!;
      const end = { x: at.x, y: at.y };
      if (!old && dist(b, end) < 1e-9) continue;
      if (old && old.at(-1)!.t > c0 + 1e-6) {
        // 전체 단계 경로를 유지하면서 끝점 보정도 같은 완만한 시간 곡선으로 더한다.
        const correction = sub(end, old.at(-1)!);
        const tr = old.map((k) => ({ ...k, ...add(k, scale(correction, gentle(k.t / old.at(-1)!.t))) }));
        if (tr.at(-1)!.t < 1) tr.push({ t: 1, ...end });
        A.tracks.set(id, tr);
      } else {
        const tr = old ? old.filter((k) => k.t < c0) : [{ t: 0, x: b.x, y: b.y }];
        for (let i = 0; i <= 80; i++) {
          const q = lerpV(p, end, gentle(i / 80));
          tr.push({ t: c0 + (c1 - c0) * i / 80, ...q });
        }
        if (c1 < 1) tr.push({ t: 1, ...end });
        A.tracks.set(id, tr);
      }
    }
    for (const { ids, pivot, angle } of this.dockTurns) {
      const centerAt = (t: number) => A.tracks.has(pivot) ? trackPos(A.tracks.get(pivot)!, t) : this.w.atoms.get(pivot)!;
      for (const id of ids) {
        if (id === pivot) continue;
        const off = sub(start.get(id)!, start.get(pivot)!);
        const initial = before.atoms.get(id)!;
        const tr = prefix.get(id)?.filter((k) => k.t < c0) ?? [{ t: 0, x: initial.x, y: initial.y }];
        for (let i = 0; i <= 160; i++) {
          const t = c0 + (c1 - c0) * i / 160;
          tr.push({ t, ...add(centerAt(t), rotate(off, angle * gentle(i / 160))) });
        }
        const end = this.w.atoms.get(id)!;
        tr.push({ t: 1, x: end.x, y: end.y });
        A.tracks.set(id, tr);
      }
    }
    this.dockTurns = [];
    // 상대 원자 경로가 완성된 뒤 전달한다. 앞선 경로가 있어도 빠뜨리지 않는다.
    for (const [id, partner] of handed) {
      const old = prefix.get(id);
      const p = start.get(id)!;
      const partnerEnd = this.w.atoms.get(partner)!;
      const at = this.w.atoms.get(id)!;
      const partnerAt = (t: number) => A.tracks.has(partner) ? trackPos(A.tracks.get(partner)!, t) : partnerEnd;
      const off0 = sub(p, partnerAt(c0)), off1 = sub(at, partnerEnd);
      const tr = old ? old.filter((k) => k.t < c0) : [{ t: 0, ...before.atoms.get(id)! }];
      for (let i = 0; i <= 100; i++) {
        const t = c0 + (c1 - c0) * i / 100;
        const u = clamp((t - c0) / ((c1 - c0) * 0.5), 0, 1);
        tr.push({ t, ...add(partnerAt(t), lerpV(off0, off1, 1 - (1 - u) ** 3)) });
      }
      tr.push({ t: 1, x: at.x, y: at.y });
      A.tracks.set(id, tr);
    }
    for (const { oxygen, hydrogen, angle } of this.waterTurns) {
      const O = start.get(oxygen)!;
      const off = sub(start.get(hydrogen)!, O);
      const tr: Keyframe[] = [{ t: 0, ...start.get(hydrogen)! }];
      for (let i = 0; i <= 80; i++) {
        const t = c0 + (c1 - c0) * i / 80;
        const center = A.tracks.has(oxygen) ? trackPos(A.tracks.get(oxygen)!, t) : this.w.atoms.get(oxygen)!;
        tr.push({ t, ...add(center, rotate(off, angle * gentle(i / 80))) });
      }
      A.tracks.set(hydrogen, tr);
    }
    this.waterTurns = [];
    if (!A.phase) {
      // 짧은 하위 경로가 있어도 단계 전체 시작과 끝은 완만하다. 모든 원자에 같은 시간을 쓴다.
      for (const [id, tr] of A.tracks) if (!this.causalMotion.has(id)) A.tracks.set(id, Array.from({ length: 201 }, (_, i) => ({
        t: i / 200, ...trackPos(tr, gentle(i / 200)),
      })));
    }
    for (const d of this.drift) {
      const c = centerOf(this.w, d.ids);
      const delta = scale(norm(sub(c, d.from)), 60);
      const t0 = Math.max(c1, A.phase?.b1 ?? 0);
      for (const id of d.ids) {
        const at = this.w.atoms.get(id)!;
        const formed = { x: at.x, y: at.y };
        const tr = (A.tracks.get(id) ?? [{ t: 0, ...formed }]).filter((k) => k.t < t0);
        for (let i = 0; i <= 80; i++) tr.push({ t: t0 + (1 - t0) * i / 80, ...add(formed, scale(delta, gentle(i / 80))) });
        shift(at, delta);
        A.tracks.set(id, tr);
      }
    }
    this.drift = [];
    this.rigid = [];
    A.after = cloneWorld(this.w);
    if (!this.mid) A.mid = A.before;
  }

  finishStep(before: World): void {
    const A = this.A;
    for (const plan of this.afterCommands) plan();
    this.afterCommands = [];
    const start = new Map([...this.w.atoms].map(([id, a]) => [id, { x: a.x, y: a.y }]));
    // Re-draw molecules whose bonds changed, then check electron counts.
    if (this.touched.size) {
      if (this.plannedMotion) this.tightLayout(before);
      const done = new Set<string>();
      for (const id of this.plannedMotion ? [] : this.touched) {
        if (done.has(id) || !this.w.atoms.has(id)) continue;
        const comp = component(this.w, id);
        comp.forEach((x) => done.add(x));
        // The molecule that was there before keeps its place; atoms that came from another
        // molecule (an H passed over, a water joining) move to it, not the other way round.
        const groups = new Map<string, string[]>();
        for (const x of comp) {
          const key = before.atoms.has(x) ? component(before, x).sort()[0] : x;
          groups.set(key, [...(groups.get(key) ?? []), x]);
        }
        const heavy = (g: string[]) => g.filter((x) => this.w.atoms.get(x)!.el !== 'H').length;
        const anchor = [...groups.values()].sort((p, q) => heavy(q) - heavy(p) || q.length - p.length)[0];
        const pre = new Map(comp.map((x) => [x, { x: this.w.atoms.get(x)!.x, y: this.w.atoms.get(x)!.y }]));
        relayout(this.w, comp, anchor.length >= 2 ? anchor : comp);
        // A molecule that joins another keeps its own shape: it is turned and moved as one body to
        // where the new bond wants it, not redrawn atom by atom (which would fold it on the way).
        if (this.tight && anchor.length >= 2) {
          for (const g of groups.values()) if (g !== anchor && g.length >= 2) this.dock(g, pre);
        }
      }
      for (const id of this.touched) {
        const at = this.w.atoms.get(id);
        if (!at) continue;
        const e = electronCount(this.w, at);
        const info = element(at.el);
        const where = A.arrows.find((x) => x.line)?.line ?? A.line;
        if (e > info.softMax) {
          this.errors.push({
            line: where,
            message: `${label(this.w, id)} 둘레의 전자가 ${e}개가 돼요(${info.name}${josa(info.name, '은', '는')} 최대 ${info.maxElectrons}개). 화살표를 다시 확인해 주세요.`,
          });
        } else if (e > info.maxElectrons && at.el !== 'P' && at.el !== 'S') {
          // P and S in phosphates and sulfates are usually drawn with P=O / S=O, so that is not worth a note.
          this.warnings.push({ line: where, message: `${label(this.w, id)} 둘레의 전자가 ${e}개예요(옥텟 확장).` });
        }
      }
      // Molecules that just split apart drift a little away from each other.
      if (!this.plannedMotion) separateComponents(this, [...this.touched]);
    }
    // Released small molecules (water from a condensation) move clearly away from where they formed.
    for (const d of this.plannedMotion ? [] : this.drift) {
      const ids = d.ids.filter((id) => this.w.atoms.has(id));
      if (!ids.length) continue;
      const c = centerOf(this.w, ids);
      let u = norm(sub(c, d.from));
      if (Math.hypot(c.x - d.from.x, c.y - d.from.y) < 1) u = { x: 0, y: -1 };
      for (const id of ids) shift(this.w.atoms.get(id)!, scale(u, 85));
    }
    if (!this.plannedMotion) this.drift = [];
    // A bond is two electrons: one left alone means a hop was forgotten.
    for (const [k, b] of [...this.w.bonds]) {
      if (Math.abs(b.order - Math.round(b.order)) > 1e-6) {
        this.errors.push({
          line: this.lastHopLine || A.line,
          message: `${label(this.w, b.a)}–${label(this.w, b.b)} 결합에 전자가 홀수 개(${Math.round(b.order * 2)}개) 남아요. 결합 하나는 전자 2개이니, 같은 단계에서 나머지 전자도 hop으로 옮겨 주세요.`,
        });
        b.order = Math.round(b.order);
        if (b.order <= 0) this.w.bonds.delete(k);
      }
    }
    this.hopCount.clear();
    this.lastHopLine = 0;
    if (!this.plannedMotion || (!A.pulls?.length && !A.phase)) separateSolutes(this);
    resolveOverlaps(this, new Set(A.focus));
    keepInside(this);

    // Light comes first: what it sets off starts only once it has been absorbed.
    if (A.phase && A.photons.length) {
      const hit = Math.max(...A.photons.map((p) => p.t1)) + 0.03;
      if (A.phase.b0 < hit) {
        // Shift the whole sequence after the light, squeezing it to end by 0.95.
        const { b0, b1, c0 } = A.phase;
        const c1 = A.phase.c1 ?? 1;
        const end = Math.max(b1, c1);
        const k = Math.min(1, (0.95 - hit) / Math.max(1e-6, end - b0));
        const at = (x: number) => hit + (x - b0) * k;
        A.phase = { b0: hit, b1: at(b1), c0: Math.max(hit, at(c0)), c1: at(c1) };
      }
    }
    if (this.plannedMotion) {
      this.tightMotion(before, start);
      return;
    }
    // Atoms that moved without an explicit path glide inside the change window, together with the
    // electrons and bonds that make them move.
    const c0 = A.phase ? A.phase.c0 : 0;
    const c1 = A.phase?.c1 ?? 1;
    // Bodies that were turned as a whole travel as a whole: round the atom they hang on, so that
    // no bond in them shortens on the way (a straight line between two positions of a turn would).
    const rigidDone = new Set<string>();
    for (const rec of this.rigid) {
      if (Math.abs(rec.theta) < 0.03 || rec.ids.some((id) => A.tracks.has(id) || !before.atoms.has(id) || !this.w.atoms.has(id))) continue;
      const inG = new Set(rec.ids);
      const cb = centroid(rec.ids.map((id) => before.atoms.get(id)!));
      const cf = centroid(rec.ids.map((id) => this.w.atoms.get(id)!));
      let pivot: Vec = cb;
      for (const id of rec.ids) {
        const out = neighbors(this.w, id).find((n) => !inG.has(n.id) && before.atoms.has(n.id) && !A.tracks.has(n.id));
        if (out) {
          const o = before.atoms.get(out.id)!;
          pivot = { x: o.x, y: o.y };
          break;
        }
      }
      const shiftBy = sub(sub(cf, pivot), rotate(sub(cb, pivot), rec.theta));
      const n = 14;
      for (const id of rec.ids) {
        const b = before.atoms.get(id)!;
        const at = this.w.atoms.get(id)!;
        const kfs: Keyframe[] = [];
        for (let i = 0; i <= n; i++) {
          const s = smooth(i / n);
          const p = add(add(pivot, rotate(sub(b, pivot), rec.theta * s)), scale(shiftBy, s));
          kfs.push({ t: c0 + ((c1 - c0) * i) / n, x: p.x, y: p.y });
        }
        kfs.push({ t: 1, x: at.x, y: at.y });
        A.tracks.set(id, kfs);
        rigidDone.add(id);
      }
    }
    // Atoms handed from one molecule to another (none of its old neighbours is a new one).
    const handed = new Map<string, string>();
    if (this.tight) {
      for (const [id, at] of this.w.atoms) {
        const b = before.atoms.get(id);
        if (!b || A.tracks.has(id) || (Math.abs(b.x - at.x) <= 0.5 && Math.abs(b.y - at.y) <= 0.5)) continue;
        const was = new Set(neighbors(before, id).map((n) => n.id));
        const now = neighbors(this.w, id).map((n) => n.id);
        if (was.size > 0 && now.length > 0 && !now.some((n) => was.has(n))) handed.set(id, now[0]);
      }
    }
    for (const [id, at] of this.w.atoms) {
      const b = before.atoms.get(id);
      const tr = A.tracks.get(id);
      if (tr) {
        const last = tr[tr.length - 1];
        if (Math.abs(last.x - at.x) > 0.5 || Math.abs(last.y - at.y) > 0.5) {
          if (last.t >= 1 - 1e-6) {
            // The path already runs to the end of the step, and where the atom ends was adjusted
            // afterwards (kept clear of a neighbour, kept inside the stage). Bend the whole path
            // to the new end, more and more toward its end, instead of jumping there at the last moment.
            const dx = at.x - last.x;
            const dy = at.y - last.y;
            const t0 = tr[0].t;
            for (const kf of tr) {
              const u = smooth(clamp((kf.t - t0) / Math.max(1e-6, 1 - t0), 0, 1));
              kf.x += dx * u;
              kf.y += dy * u;
            }
          } else {
            // A path that ended before the change began: wait there until it begins.
            if (this.tight && last.t < c0 - 1e-6) tr.push({ t: c0, x: last.x, y: last.y });
            if (this.tight && last.t < c1 - 1e-6) tr.push({ t: c1, x: at.x, y: at.y, ease: true });
            tr.push({ t: 1, x: at.x, y: at.y, ease: !this.tight });
          }
        } else if (last.t < 1) tr.push({ t: 1, x: at.x, y: at.y });
        continue;
      }
      if (rigidDone.has(id) || handed.has(id)) continue;
      if (!b) continue;
      if (Math.abs(b.x - at.x) > 0.5 || Math.abs(b.y - at.y) > 0.5) {
        A.tracks.set(id, [
          { t: c0, x: b.x, y: b.y },
          { t: c1, x: at.x, y: at.y, ease: true },
          { t: 1, x: at.x, y: at.y },
        ]);
      }
    }
    // The atoms handed over: quickly across to the new partner, then with it wherever it goes.
    for (const [id, partner] of handed) {
      const b = before.atoms.get(id)!;
      const at = this.w.atoms.get(id)!;
      const P1 = this.w.atoms.get(partner)!;
      const P0 = before.atoms.get(partner) ?? P1;
      const ptr = A.tracks.get(partner);
      const pAt = (t: number): Vec => (ptr ? trackPos(ptr, t) : t < c0 ? P0 : P1);
      const off0 = sub(b, pAt(c0));
      const off1 = sub(at, P1);
      const quick = Math.min(c1 - c0, 0.17);
      const kfs: Keyframe[] = [{ t: c0, x: b.x, y: b.y }];
      const n = 14;
      for (let i = 1; i <= n; i++) {
        const t = c0 + ((c1 - c0) * i) / n;
        const u = clamp((t - c0) / quick, 0, 1);
        const p = add(pAt(t), lerpV(off0, off1, 1 - Math.pow(1 - u, 3)));
        kfs.push({ t, x: p.x, y: p.y });
      }
      kfs.push({ t: 1, x: at.x, y: at.y });
      A.tracks.set(id, kfs);
    }
    this.rigid = [];
    A.after = cloneWorld(this.w);
    if (!this.mid) A.mid = A.before;
  }
}

// ---------------------------------------------------------------------------

function separateComponents(ctx: Ctx, ids: string[]): void {
  const w = ctx.w;
  const pinned = new Set<string>([...w.crystals.values()].flat());
  const comps: string[][] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id) || !w.atoms.has(id)) continue;
    const c = component(w, id);
    c.forEach((x) => seen.add(x));
    comps.push(c);
  }
  for (let iter = 0; iter < 12; iter++) {
    let moved = false;
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        let need = 0;
        for (const x of comps[i]) {
          for (const y of comps[j]) {
            const ax = w.atoms.get(x)!;
            const ay = w.atoms.get(y)!;
            const want = element(ax.el).r + element(ay.el).r + 26;
            need = Math.max(need, want - dist(ax, ay));
          }
        }
        if (need > 0) {
          // Ions held in a crystal stay put; the other molecule moves the whole way.
          const pi = comps[i].some((x) => pinned.has(x));
          const pj = comps[j].some((x) => pinned.has(x));
          if (pi && pj) continue;
          const fi = pi ? 0 : pj ? 1 : 0.5;
          const d = norm(sub(centerOf(w, comps[j]), centerOf(w, comps[i])));
          for (const x of comps[i]) shift(w.atoms.get(x)!, scale(d, -(need + 2) * fi));
          for (const y of comps[j]) shift(w.atoms.get(y)!, scale(d, (need + 2) * (1 - fi)));
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/**
 * Liquid water is a network of hydrogen bonds, but randomly scattered molecules form few of
 * them. Turn the background water so its H atoms point at neighbouring O atoms, and bring a
 * water molecule next to each free O–H of the named molecules. Uses the same test as the
 * renderer (H···acceptor within reach, O–H pointing at the acceptor within 40°).
 */
function arrangeHydrogenBonds(ctx: Ctx): void {
  const w = ctx.w;
  const st = ctx.stage;
  const liquid = st.liquid.map((n) => st.regions[n]).filter(Boolean);
  const inLiquid = (p: Vec) => liquid.some((r) => inRegion(r, p));
  const reach = bondLength('O', 'H') * 1.95;
  const comps = allComponents(w);
  const waters = comps.filter((c) => formulaOf(w, c) === 'H2O');
  const crowdWaters = waters.filter((c) => w.atoms.get(c[0])!.crowd && inLiquid(centerOf(w, c)));
  if (!crowdWaters.length) return;
  const oxygenOf = (c: string[]) => c.map((id) => w.atoms.get(id)!).find((a) => a.el === 'O')!;

  // 1. A water molecule docks onto each O–H of the named (non-background) molecules.
  const used = new Set<string>();
  for (const a of [...w.atoms.values()]) {
    if (a.crowd || a.el !== 'H') continue;
    const ns = neighbors(w, a.id);
    if (ns.length !== 1) continue;
    const d = w.atoms.get(ns[0].id)!;
    if (!['O', 'N', 'F'].includes(d.el)) continue;
    const u = norm(sub(a, d));
    const spot = add(a, scale(u, reach * 0.82));
    if (!inLiquid(spot)) continue;
    const blocked = [...w.atoms.values()].some((o) => !o.crowd && component(w, a.id).indexOf(o.id) < 0 && dist(o, spot) < 40);
    if (blocked) continue;
    let best: string[] | null = null;
    let bestD = Infinity;
    for (const c of crowdWaters) {
      if (used.has(c[0])) continue;
      const dd = dist(oxygenOf(c), spot);
      if (dd < bestD) {
        bestD = dd;
        best = c;
      }
    }
    if (!best || bestD > 260) continue;
    used.add(best[0]);
    const O = oxygenOf(best);
    const shiftBy = sub(spot, O);
    for (const id of best) {
      const at = w.atoms.get(id)!;
      at.x += shiftBy.x;
      at.y += shiftBy.y;
    }
  }

  // 1b. ... and onto each lone pair of their O/N, so the named molecule also accepts bonds.
  for (const a of [...w.atoms.values()]) {
    if (a.crowd || !['O', 'N'].includes(a.el) || a.lp <= 0) continue;
    if (!inLiquid(a)) continue;
    for (const ang of lonePairDirsInWorld(w, a.id, a.lp)) {
      const u = fromAngle(ang);
      const spot = add(a, scale(u, reach * 0.82 + bondLength('O', 'H')));
      if (!inLiquid(spot)) continue;
      const mine = component(w, a.id);
      if ([...w.atoms.values()].some((o) => !o.crowd && !mine.includes(o.id) && dist(o, spot) < 40)) continue;
      let best: string[] | null = null;
      let bestD = Infinity;
      for (const c of crowdWaters) {
        if (used.has(c[0])) continue;
        const dd = dist(oxygenOf(c), spot);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (!best || bestD > 260) continue;
      used.add(best[0]);
      const O = oxygenOf(best);
      const by = sub(spot, O);
      for (const id of best) {
        const at = w.atoms.get(id)!;
        at.x += by.x;
        at.y += by.y;
      }
    }
  }

  // 2. Each background water turns about its O to donate as many hydrogen bonds as it can.
  orientWaters(w, crowdWaters, 2);
}

/** Turn each water molecule about its O so its H atoms point at nearby acceptors (O/N/F with lone pairs). */
function orientWaters(w: World, waters: string[][], passes: number): void {
  const reach = bondLength('O', 'H') * 1.95;
  const acc = [...w.atoms.values()].filter((a) => ['O', 'N', 'F'].includes(a.el) && a.lp > 0);
  const oxygenOf = (c: string[]) => c.map((id) => w.atoms.get(id)!).find((a) => a.el === 'O')!;
  const hsOf = (c: string[]) => c.map((id) => w.atoms.get(id)!).filter((a) => a.el === 'H');
  for (let pass = 0; pass < passes; pass++) {
    for (const c of waters) {
      const O = oxygenOf(c);
      const Hs = hsOf(c);
      const rel = Hs.map((h) => sub(h, O));
      const score = (ang: number) => {
        let n = 0;
        let near = 0;
        for (const r of rel) {
          const hp = add(O, rotate(r, ang));
          const along = norm(rotate(r, ang));
          let bestHere = Infinity;
          for (const m of acc) {
            if (c.includes(m.id)) continue;
            const dd = dist(hp, m);
            if (dd > reach || dd < 4) continue;
            const u = norm(sub(m, hp));
            if (along.x * u.x + along.y * u.y < Math.cos((40 * Math.PI) / 180)) continue;
            bestHere = Math.min(bestHere, dd);
          }
          if (bestHere < Infinity) {
            n++;
            near += bestHere;
          }
          for (const o of w.atoms.values()) {
            if (c.includes(o.id)) continue;
            if (dist(hp, o) < element('H').r + element(o.el).r + 4) n -= 2;
          }
        }
        return n * 1000 - near;
      };
      let bestAng = 0;
      let bestScore = score(0);
      for (let k = 1; k < 36; k++) {
        const ang = (k * Math.PI) / 18;
        const sc = score(ang);
        if (sc > bestScore) {
          bestScore = sc;
          bestAng = ang;
        }
      }
      if (bestAng !== 0) {
        Hs.forEach((h, i) => {
          const q = add(O, rotate(rel[i], bestAng));
          h.x = q.x;
          h.y = q.y;
        });
      }
    }
  }
}

/** Free solutes (with their water shells) must not sit on top of each other. */
function separateSolutes(ctx: Ctx): void {
  const w = ctx.w;
  const pinned = new Set<string>([...w.crystals.values()].flat());
  for (const id of ctx.causalMotion) pinned.add(id);
  for (const s of w.sites) if (s.occupant) component(w, s.occupant).forEach((x) => pinned.add(x));
  for (const a of w.atoms.values()) if (a.sei) pinned.add(a.id);
  if (ctx.layoutMovable) for (const c of allComponents(w)) if (!ctx.canLayout(c)) c.forEach((id) => pinned.add(id));
  const groups = allComponents(w)
    .filter((c) => !w.atoms.get(c[0])!.crowd && !c.some((x) => pinned.has(x)))
    .map((c) => ctx.group(c));
  const all = allComponents(w)
    .filter((c) => !w.atoms.get(c[0])!.crowd && c.some((x) => pinned.has(x)))
    .flat();
  for (let iter = 0; iter < 14; iter++) {
    let moved = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        let need = 0;
        for (const x of groups[i]) {
          for (const y of groups[j]) {
            const ax = w.atoms.get(x)!;
            const ay = w.atoms.get(y)!;
            need = Math.max(need, element(ax.el).r + element(ay.el).r + 8 - dist(ax, ay));
          }
        }
        if (need > 0) {
          const d = norm(sub(centerOf(w, groups[j]), centerOf(w, groups[i])));
          for (const x of groups[i]) shift(w.atoms.get(x)!, scale(d, -need / 2 - 1));
          for (const y of groups[j]) shift(w.atoms.get(y)!, scale(d, need / 2 + 1));
          moved = true;
        }
      }
      // Keep clear of pinned things (crystals, adsorbed ions).
      let push = 0;
      let dir = { x: 0, y: 0 };
      for (const x of groups[i]) {
        for (const y of all) {
          const ax = w.atoms.get(x)!;
          const ay = w.atoms.get(y)!;
          const n = element(ax.el).r + element(ay.el).r + 8 - dist(ax, ay);
          if (n > push) {
            push = n;
            dir = norm(sub(ax, ay));
          }
        }
      }
      if (push > 0) {
        for (const x of groups[i]) shift(w.atoms.get(x)!, scale(dir, push + 1));
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** Molecules that grew or moved past the stage edge (or into a membrane) come back to where they can be seen. */
function keepInside(ctx: Ctx): void {
  const w = ctx.w;
  const st = ctx.stage;
  const pinned = new Set<string>([...w.crystals.values()].flat());
  for (const s of w.sites) if (s.occupant) pinned.add(s.occupant);
  for (const c of allComponents(w)) {
    if (!ctx.canLayout(c)) continue;
    if (c.some((x) => pinned.has(x) || w.atoms.get(x)!.sei || w.atoms.get(x)!.gone)) continue;
    const ids = ctx.group(c);
    const atoms = ids.map((x) => w.atoms.get(x)!);
    const x0 = Math.min(...atoms.map((a) => a.x - element(a.el).r));
    const x1 = Math.max(...atoms.map((a) => a.x + element(a.el).r));
    const y0 = Math.min(...atoms.map((a) => a.y - element(a.el).r));
    const y1 = Math.max(...atoms.map((a) => a.y + element(a.el).r));
    const m = 14;
    let dx = x0 < m ? m - x0 : x1 > st.width - m ? st.width - m - x1 : 0;
    let dy = y0 < m ? m - y0 : y1 > st.height - m ? st.height - m - y1 : 0;
    const mb = st.membrane;
    if (mb && !atoms[0].crowd) {
      const cy = (y0 + y1) / 2;
      if (cy > (mb.y0 + mb.y1) / 2 && y0 + dy < mb.y1 + 10) dy = mb.y1 + 10 - y0;
      if (cy <= (mb.y0 + mb.y1) / 2 && y1 + dy > mb.y0 - 10) dy = mb.y0 - 10 - y1;
    }
    // An ion in water keeps its whole water shell under the surface, not poking into the air.
    const S = st.surfaceY;
    if (S !== undefined && ids.length > c.length && centerOf(w, c).y > S && y0 + dy < S + 12) dy = S + 12 - y0;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    for (const a of atoms) shift(a, { x: dx, y: dy });
  }
}

function shift(a: Atom, d: Vec): void {
  a.x += d.x;
  a.y += d.y;
}

/** Push background solvent out of the way of everything else; keep molecules inside the stage. */
function resolveOverlaps(ctx: Ctx, _focus: Set<string>): void {
  const w = ctx.w;
  const stage = ctx.stage;
  const attached = new Set<string>();
  for (const l of w.attached.values()) for (const a of l) if (w.atoms.has(a)) component(w, a).forEach((x) => attached.add(x));
  const comps = allComponents(w);
  const inLattice = new Set([...w.crystals.values()].flat());
  const live = comps.filter((c) => !w.atoms.get(c[0])!.gone);
  const candidates = live.filter((c) => w.atoms.get(c[0])!.crowd && !c.some((x) => attached.has(x) || inLattice.has(x) || w.atoms.get(x)!.sei || ctx.causalMotion.has(x)));
  const active = ctx.layoutMovable ? [...ctx.layoutMovable].map((id) => w.atoms.get(id)).filter((a): a is Atom => !!a) : [];
  const free = ctx.layoutMovable ? candidates.filter((c) => ctx.canLayout(c) || c.some((id) => {
    const a = w.atoms.get(id)!;
    return active.some((b) => !c.includes(b.id) && dist(a, b) < element(a.el).r + element(b.el).r + 18);
  })) : candidates;
  if (ctx.layoutMovable) for (const c of free) for (const id of c) ctx.layoutMovable.add(id);
  const solid = live.filter((c) => !free.includes(c)).flat();
  const S = stage.surfaceY;
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (const c of free) {
      let push = { x: 0, y: 0 };
      for (const id of c) {
        const a = w.atoms.get(id)!;
        for (const s of solid) {
          const b = w.atoms.get(s)!;
          const want = element(a.el).r + element(b.el).r + 18;
          const d = dist(a, b);
          if (d < want) push = add(push, scale(norm(sub(a, b)), want - d));
        }
      }
      for (const o of free) {
        if (o === c) continue;
        for (const id of c) {
          const a = w.atoms.get(id)!;
          for (const s of o) {
            const b = w.atoms.get(s)!;
            const want = element(a.el).r + element(b.el).r + 3;
            const d = dist(a, b);
            if (d < want) push = add(push, scale(norm(sub(a, b)), (want - d) / 2));
          }
        }
      }
      if (Math.hypot(push.x, push.y) > 0.3) {
        const cen = centerOf(w, c);
        let goal = add(cen, push);
        goal = { x: clamp(goal.x, 30, stage.width - 30), y: clamp(goal.y, 30, stage.height - 30) };
        if (S !== undefined) goal.y = cen.y > S ? Math.max(goal.y, S + 18) : Math.min(goal.y, S - 18);
        const mb = stage.membrane;
        // Pushed molecules never get shoved into the membrane: they stay on their own side.
        if (mb) goal.y = cen.y < (mb.y0 + mb.y1) / 2 ? Math.min(goal.y, mb.y0 - 22) : Math.max(goal.y, mb.y1 + 22);
        const d = sub(goal, cen);
        for (const id of c) shift(w.atoms.get(id)!, d);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** 이동 전체에서 출발·도착 속도와 가속도를 0으로 만드는 진행률이다. */
function gentle(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
}

/** Round the corners of a path (Chaikin), keeping its ends. */
function rounded(path: Vec[], passes: number): Vec[] {
  let out = path;
  for (let pass = 0; pass < passes; pass++) {
    if (out.length < 3) break;
    const next: Vec[] = [out[0]];
    for (let i = 0; i + 1 < out.length; i++) next.push(lerpV(out[i], out[i + 1], 0.25), lerpV(out[i], out[i + 1], 0.75));
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/**
 * A way from `start` to `goal` that arrives along `dir` (the direction from the place approached
 * out to the goal) and keeps `clear` away from the point `around` on the way, going round it the
 * short way. `turnBy`: the fraction of the way after which only the straight run in is left.
 */
function routeIn(start: Vec, goal: Vec, dir: Vec, around: Vec, clear: number): { path: Vec[]; turnBy: number } {
  const lead = Math.min(70, Math.max(0, dist(start, goal) - 8));
  const far = add(goal, scale(dir, lead));
  const pts: Vec[] = [start];
  const segDist = (p: Vec, a: Vec, b: Vec) => {
    const d = sub(b, a);
    const l2 = d.x * d.x + d.y * d.y;
    const u = l2 ? clamp(((p.x - a.x) * d.x + (p.y - a.y) * d.y) / l2, 0, 1) : 0;
    return dist(p, add(a, scale(d, u)));
  };
  if (dist(start, around) > 1 && dist(far, around) > 1 && segDist(around, start, far) < clear) {
    const a0 = angleOf(sub(start, around));
    const turn = signedAng(a0, angleOf(sub(far, around)));
    const n = Math.max(2, Math.ceil(Math.abs(turn) / (Math.PI / 5)));
    for (let i = 1; i < n; i++) {
      const r = Math.max(clear * 1.08, lerp(dist(start, around), dist(far, around), i / n));
      pts.push(add(around, fromAngle(a0 + (turn * i) / n, r)));
    }
  }
  if (lead > 4) pts.push(far);
  pts.push(goal);
  const path = pts.length > 3 ? [...rounded(pts.slice(0, -1), 2), goal] : pts;
  const total = polyLength(path) || 1;
  return { path, turnBy: clamp(1 - lead / total, 0.15, 1) };
}

function resample(path: Vec[], minPts: number): Vec[] {
  if (path.length >= minPts) return path;
  const total = polyLength(path);
  if (total < 1e-6) return [path[0], path[path.length - 1]];
  const out: Vec[] = [];
  const per = Math.max(1, Math.ceil(minPts / Math.max(1, path.length - 1)));
  for (let i = 1; i < path.length; i++) {
    for (let k = 0; k < per; k++) out.push(lerpV(path[i - 1], path[i], k / per));
  }
  out.push(path[path.length - 1]);
  return out;
}

/** Splits a salt into a library cation and anion of the same charge size: CaCO3 → Ca2+ and CO32-. */
function saltIons(f: string): [string, string] | null {
  const s = normalizeFormula(f);
  if (/[+-]$/.test(s)) return null;
  for (let i = 1; i < s.length; i++) {
    const head = s.slice(0, i);
    const tail = s.slice(i);
    for (const q of ['', '2', '3']) {
      const cat = `${head}${q}+`;
      const an = `${tail}${q}-`;
      if (lookupMolecule(cat) && lookupMolecule(an)) return [cat, an];
    }
  }
  return null;
}

/** 은/는, 이/가 … picked by whether the Korean word ends in a final consonant. */
function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${withFinal}(${without})`;
  return (c - 0xac00) % 28 ? withFinal : without;
}

function angDiff(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, Math.PI * 2 - d);
}

function signedAng(from: number, to: number): number {
  let d = wrap(to) - wrap(from);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function label(w: World, id: string): string {
  const a = w.atoms.get(id);
  if (!a) return id;
  return a.owner.startsWith('~') ? `${a.el}` : `${a.owner}.${a.label}`;
}

function unknownFormula(f: string | undefined): string {
  return `'${f ?? ''}'은(는) 아직 등록되지 않은 분자예요. 자주 쓰는 분자: H2O, H3O+, OH-, HCl, Cl-, Na+, K+, Ca2+, Mg2+, H+, NH3, NH4+, CO2, CH4, O2, N2, H2, Cl2(전체 목록은 안내서에 있어요). 목록에 없는 분자는 smiles:로 적을 수 있어요.`;
}
