/**
 * Turns a parsed script into a timeline: the world before and after every
 * step plus the motion that connects them. Every command explains what moves
 * where; the compiler derives products, charges and drawing positions, and
 * checks the chemistry (electron counts, charge balance) as it goes.
 */
import { METALS, bondLength, element } from '../chem/elements';
import { domainsInWorld, lonePairDirsInWorld, placeNew, relayout } from '../chem/geometry';
import { SmilesError } from '../chem/smiles';
import { formulaCharge, lookupMolecule, normalizeFormula } from '../chem/library';
import { parse, type Cmd, type Diag } from '../dsl/parser';
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
import { tallyBox } from './timeline';
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

class ScriptError extends Error {}

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

export function compile(src: string): CompileResult {
  const ast = parse(src);
  const ctx = new Ctx();
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

  const steps: StepAnim[] = [];
  ast.steps.forEach((s, index) => {
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
    ctx.batteryMode = null;
    let maxDur = 0;
    for (const cmd of s.cmds) {
      ctx.line = cmd.line;
      try {
        ctx.op(cmd);
        maxDur = Math.max(maxDur, OP_DURATION[cmd.op] ?? STEP_BASE);
      } catch (e) {
        if (e instanceof ScriptError || e instanceof SmilesError) ctx.errors.push({ line: cmd.line, message: e.message });
        else throw e;
      }
    }
    anim.duration = ctx.durationOverride ?? (maxDur || STEP_BASE);
    ctx.durationOverride = null;
    ctx.finishStep(before);
    steps.push(anim);
  });

  if (ctx.errors.length) return { timeline: null, errors: ctx.errors, warnings: ctx.warnings };
  return {
    timeline: { title: title || '제목 없는 장면', stage, initial, steps, warnings: ctx.warnings },
    errors: [],
    warnings: ctx.warnings,
  };
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
  autoCount = new Map<string, number>();

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
    const map: Record<string, 'charge' | 'attract' | 'numbers' | 'oxidation'> = {
      charge: 'charge',
      attract: 'attract',
      numbers: 'numbers',
      oxidation: 'oxidation',
    };
    const key = map[name];
    if (!key) this.fail(`렌즈 '${name}'은(는) 없어요. 쓸 수 있는 렌즈: charge, attract, numbers, oxidation`);
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
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(base)) this.fail(`이름 '${base}'은(는) 영문자로 시작하는 영문·숫자로 지어 주세요.`);
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
    const n = (this.autoCount.get(base) ?? 0) + 1;
    this.autoCount.set(base, n);
    return `${base}#${n}`;
  }

  spawn(formula: string, owner: string, crowd: boolean, center: Vec, rotation = 0): string[] {
    const def = lookupMolecule(formula);
    if (!def) this.fail(unknownFormula(formula));
    const ids = def.atoms.map((a) => `${owner}.${a.label}`);
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
      this.fail(`장면에 ${f}이(가) 없어요. 먼저 mol 또는 place로 놓아 주세요.`);
    }
    this.fail(`'${word}'이(가) 무엇인지 몰라요. mol로 지은 이름이나 화학식을 적어 주세요.`);
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
    if (labels.length === 0) this.fail(`'${name}'이라는 이름의 분자가 없어요.`);
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
        return this.precipitate(a);
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
  moveGroup(ids: string[], pivot: Vec, path: Vec[], rotation: number, t0: number, t1: number): void {
    const pts = resample(path, 14);
    const total = polyLength(pts) || 1;
    const fr: number[] = [0];
    for (let i = 1; i < pts.length; i++) fr.push(fr[i - 1] + dist(pts[i - 1], pts[i]) / total);
    const offsets = ids.map((id) => {
      const at = this.w.atoms.get(id)!;
      return { id, off: sub(at, pivot), start: { x: at.x, y: at.y } };
    });
    for (const { id, off, start } of offsets) {
      const tr = this.A.tracks.get(id);
      if (!tr) {
        if (t0 > 0) this.pushKf(id, { t: 0, x: start.x, y: start.y });
      } else if (tr[tr.length - 1].t < t0) {
        const l = tr[tr.length - 1];
        this.pushKf(id, { t: t0, x: l.x, y: l.y });
      }
      pts.forEach((p, i) => {
        const f = fr[i];
        const t = t0 + (t1 - t0) * smooth(f);
        const q = add(p, rotate(off, rotation * f));
        if (i === 0 && this.A.tracks.get(id)?.length) return;
        this.pushKf(id, { t, x: q.x, y: q.y });
      });
      const fin = add(pts[pts.length - 1], rotate(off, rotation));
      const at = this.w.atoms.get(id)!;
      at.x = fin.x;
      at.y = fin.y;
    }
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
    return pts;
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
    if (src.kind === 'atom') this.fail('화살표의 출발점은 비공유 전자쌍(w.O:lp)이나 결합(a.H~a.Cl)이어야 해요.');
    if (dst.kind === 'lp') this.fail('도착점에는 :lp를 붙이지 않아요. 원자(a.Cl)나 새 결합(w.O~a.H)으로 적어 주세요.');
    if (src.kind === 'lp') {
      if (w.atoms.get(src.a)!.lp <= 0) this.fail(`${label(w, src.a)}에는 옮길 비공유 전자쌍이 없어요.`);
      if (dst.kind === 'atom') {
        this.fail('비공유 전자쌍은 다른 원자로 홀로 옮겨 갈 수 없어요. 새 결합(예: w.O~a.H)으로 보내 주세요.');
      }
      if (dst.a !== src.a && dst.b !== src.a) {
        this.fail(`비공유 전자쌍은 그 원자(${label(w, src.a)})가 포함된 결합으로만 갈 수 있어요.`);
      }
    } else {
      const bnd = getBond(w, src.a, src.b!);
      if (!bnd || bnd.order <= 0) this.fail(`${label(w, src.a)}와 ${label(w, src.b!)}는 결합해 있지 않아요.`);
      if (dst.kind === 'atom' && dst.a !== src.a && dst.a !== src.b) {
        this.fail('결합의 전자쌍은 그 결합의 두 원자 중 하나로만 갈 수 있어요.');
      }
      if (dst.kind === 'bond') {
        const share = [dst.a, dst.b].some((x) => x === src.a || x === src.b);
        if (!share) this.fail('결합의 전자쌍은 그 결합의 원자가 포함된 새 결합으로만 갈 수 있어요.');
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
    const arrow: ArrowAnim = { kind: 'pair', p0, c, p1, line: this.line };
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
    this.A.phase = { b0: 0.22, b1: 0.56, c0: 0.56 };
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
    if (!ref || !ref.includes('~')) this.fail('배위 결합 풀기는 이렇게 적어요: unligand c.Cu~n.N');
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
      if (!isSource) this.fail('도착점에는 :lp나 :e를 붙이지 않아요. 원자(c.Cu)나 결합(c.Cl~m.H)으로 적어 주세요.');
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
    if (dst.kind === 'atom' && src.kind !== 'bond' && dst.a === src.a) this.fail('전자가 같은 원자로 옮겨 가게 적혔어요.');
    if (dst.kind === 'bond') {
      const srcAtoms = src.kind === 'bond' ? [src.a, src.b!] : [src.a];
      if (!srcAtoms.some((x) => x === dst.a || x === dst.b)) {
        this.fail('전자는 출발한 원자(또는 결합의 원자)가 포함된 결합으로만 갈 수 있어요.');
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
    this.A.arrows.push({ kind: 'single', p0, c: add(mm, scale(side, bow)), p1, line: this.line });

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
    this.A.phase = { b0: 0.22, b1: 0.56, c0: 0.56 };
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
    // Come in from the target's open side; if its bonds are spread evenly (no open side), from where the mover is.
    if (tn.length && dist(T, centroid(tn)) > 6) dir = norm(sub(T, centroid(tn)));
    else dir = norm(sub(M, T));
    const gap = element(T.el).r + element(M.el).r + 58;
    const goal = add(T, scale(dir, gap));
    // Turn so that the unpaired electron (radicals), else a lone pair, else the free side faces the target.
    const want = angleOf(scale(dir, -1));
    const mn = neighbors(this.w, mover).map((n) => this.w.atoms.get(n.id)!);
    let face: number;
    if (!mn.length) {
      // A lone atom: just turn its electrons; the first unpaired electron (or first pair) faces the target.
      face = want;
      M.face = want;
    } else if (M.rad > 0 || M.lp > 0) {
      const doms = domainsInWorld(this.w, mover);
      const pick = doms.filter((d) => d.single === M.rad > 0);
      const list = pick.length ? pick : doms;
      face = list.reduce((b, d) => (angDiff(d.angle, want) < angDiff(b, want) ? d.angle : b), list[0].angle);
    } else {
      face = angleOf(sub(M, centroid(mn)));
    }
    const rot = signedAng(face, want);
    const pivot = { x: M.x, y: M.y };
    this.moveGroup(ids, pivot, [pivot, goal], mn.length ? rot : 0, 0, 1);
    this.focusMol(comp);
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
    const used = new Set<number>();
    const shell: string[] = [];
    for (const tg of targets) {
      let bestI = -1;
      let bestD = Infinity;
      pool.forEach((c, i) => {
        if (used.has(i)) return;
        const d = dist(centerOf(this.w, c), tg.pos);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });
      let water: string[];
      if (bestI < 0 || bestD > 420) {
        // No free water close by: a water molecule drifts in from outside.
        const start = add(tg.pos, scale(tg.u, 140));
        water = this.spawn('H2O', this.autoName('~H2O'), true, start, this.rng.range(0, 6.28));
        for (const id of water) this.A.appear.add(id);
      } else {
        used.add(bestI);
        water = pool[bestI];
      }
      const pose = this.waterPose(water, tg);
      this.moveGroup(water, pose.pivot, [pose.pivot, pose.goal], pose.rot, t0, t1);
      shell.push(anchorOf(this.w, water));
    }
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
        this.warn(`${formulaOf(this.w, c)}는 전하가 없어서 지금은 물 분자를 둘러싸게 하지 않았어요.`);
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
      const chosen = [...free].sort((p, q2) => dist(p, out) - dist(q2, out)).slice(0, shellN);
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
          y: clamp(ion.y + out.y * 80 - this.rng.range(110, 230), region.y + 70, region.y + region.h - 70),
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
      this.moveGroup(this.group(unit), start, this.wander(start, goal, region, 0.5), 0, 0.45, 1);
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
    if (q <= 0) this.fail('점토 표면(음전하)에는 양이온만 흡착시킬 수 있어요.');
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
    if (this.A.phase && this.batteryMode && this.batteryMode !== op) this.fail('한 단계에 charge와 discharge를 같이 쓰지 않아요. 단계를 나눠 주세요.');
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
    const sw = charging ? 0.9 : 0.08;
    this.A.phase = { b0: sw, b1: sw, c0: 0 };
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
        if (!(barrier >= 0)) this.fail('barrier 뒤에는 0 이상의 숫자를 적어요(출발점에서 언덕 꼭대기까지의 높이).');
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
    if (mols.length < 2) this.fail(`장면에 ${L[0]}, ${L[1]}, ${R[0]} 분자가 거의 없어요. place ${L[0]} in ${region.name} x10 처럼 먼저 놓아 주세요.`);
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

  /** precipitate Ag+ Cl- x3 [onto s] : dissolved ions shed their water and lock into a solid lattice. */
  precipitate(a: string[]): void {
    const mult = a.find((x) => /^x\d+$/.test(x));
    const n = mult ? clamp(parseInt(mult.slice(1), 10), 1, 12) : 1;
    const ontoI = a.indexOf('onto');
    const onto = ontoI >= 0 ? a[ontoI + 1] : null;
    const [catF, anF] = a.filter((x, i) => !/^x\d+$/.test(x) && x !== 'onto' && (ontoI < 0 || i !== ontoI + 1));
    if (!catF || !anF) this.fail('석출은 이렇게 적어요: precipitate Ag+ Cl- x3  (결정에 덧붙이려면 onto s)');
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

  /**
   * condensation g1.C2 g2.N : A loses its OH, B loses an H, A–B bond forms and the OH + H
   * leave together as a water molecule (net reaction, drawn without electron arrows).
   */
  condensation(a: string[]): void {
    const [ra, rb] = a;
    if (!ra || !rb) this.fail('축합은 이렇게 적어요: condensation g1.C2 g2.N  (OH를 내놓는 원자, H를 내놓는 원자)');
    const A = this.atom(ra);
    const B = this.atom(rb);
    if (component(this.w, A).includes(B)) this.fail('같은 분자 안의 두 원자는 축합으로 잇지 않아요.');
    const oh = neighbors(this.w, A)
      .map((n) => this.w.atoms.get(n.id)!)
      .find((o) => o.el === 'O' && neighbors(this.w, o.id).length === 2 && neighbors(this.w, o.id).some((x) => this.w.atoms.get(x.id)!.el === 'H'));
    if (!oh) this.fail(`${ra}에 붙은 -OH가 없어요. 축합은 -OH를 가진 원자를 먼저 적어요.`);
    const hb = neighbors(this.w, B)
      .map((n) => this.w.atoms.get(n.id)!)
      .find((h) => h.el === 'H');
    if (!hb) this.fail(`${rb}에 붙은 H가 없어요.`);
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
    // Bonds switch a little into the step, then the new molecule settles and the water drifts off.
    this.A.phase = { b0: 0.3, b1: 0.3, c0: 0.3 };
  }

  /** hydrolysis g1.C2~g2.N [with w] : a water molecule splits the bond: OH goes to the first atom, H to the second. */
  hydrolysis(a: string[]): void {
    const ref = a[0];
    if (!ref || !ref.includes('~')) this.fail('가수분해는 이렇게 적어요: hydrolysis g1.C2~g2.N  (with w 로 물 분자를 고를 수 있어요)');
    const [A, B] = ref.split('~').map((r) => this.atom(r));
    if (!getBond(this.w, A, B)) this.fail(`${ref}는 결합해 있지 않아요.`);
    const withI = a.indexOf('with');
    let water: string[];
    if (withI >= 0 && a[withI + 1]) water = this.mol(a[withI + 1]);
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
    const hToB = Hs[0];
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
    this.A.phase = { b0: 0.3, b1: 0.3, c0: 0.3 };
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
    if (!p) this.fail(`'${name}'이라는 막 단백질이 없어요. protein ${name} = channel ... 으로 먼저 놓아 주세요.`);
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
    if (so === si) this.warn('막 양쪽의 용질 수가 같아서 삼투가 한쪽으로 일어나지 않아요.');
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
    if (!lattice?.length) this.fail(`${name} 전극에 금속 원자가 없어요. electrode ${name} = Zn 처럼 먼저 놓아 주세요.`);
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
      this.A.arrows.push({ kind: 'single', p0, c, p1: add(inner, { x: 0, y: -10 }), line: this.line });
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
    this.A.wires.push({ path: this.stage.wire, count: n, t0: 0.05, t1: 0.95 });
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
      this.A.arrows.push({ kind: 'single', p0, c, p1, line: this.line });
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
    if (formulaCharge(anion) >= 0) this.fail(`${anion}은(는) 음이온이 아니에요. 첫째 자리에 음이온을 적어 주세요.`);
    if (formulaCharge(cation) <= 0) this.fail(`${cation}은(는) 양이온이 아니에요. 둘째 자리에 양이온을 적어 주세요.`);
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

  finishStep(before: World): void {
    const A = this.A;
    // Re-draw molecules whose bonds changed, then check electron counts.
    if (this.touched.size) {
      const done = new Set<string>();
      for (const id of this.touched) {
        if (done.has(id) || !this.w.atoms.has(id)) continue;
        const comp = component(this.w, id);
        comp.forEach((x) => done.add(x));
        relayout(this.w, comp);
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
            message: `${label(this.w, id)} 주위 전자가 ${e}개가 돼요(${info.name}은 최대 ${info.maxElectrons}개). 화살표를 다시 확인해 주세요.`,
          });
        } else if (e > info.maxElectrons && at.el !== 'P' && at.el !== 'S') {
          // P and S in phosphates and sulfates are usually drawn with P=O / S=O, so that is not worth a note.
          this.warnings.push({ line: where, message: `${label(this.w, id)} 주위 전자가 ${e}개예요(옥텟 확장).` });
        }
      }
      // Molecules that just split apart drift a little away from each other.
      separateComponents(this, [...this.touched]);
    }
    // Released small molecules (water from a condensation) move clearly away from where they formed.
    for (const d of this.drift) {
      const ids = d.ids.filter((id) => this.w.atoms.has(id));
      if (!ids.length) continue;
      const c = centerOf(this.w, ids);
      let u = norm(sub(c, d.from));
      if (Math.hypot(c.x - d.from.x, c.y - d.from.y) < 1) u = { x: 0, y: -1 };
      for (const id of ids) shift(this.w.atoms.get(id)!, scale(u, 85));
    }
    this.drift = [];
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
    separateSolutes(this);
    resolveOverlaps(this, new Set(A.focus));
    keepInside(this);

    // Atoms that moved without an explicit path glide over the last part of the step.
    const c0 = A.phase ? A.phase.c0 : 0;
    for (const [id, at] of this.w.atoms) {
      const b = before.atoms.get(id);
      const tr = A.tracks.get(id);
      if (tr) {
        const last = tr[tr.length - 1];
        if (Math.abs(last.x - at.x) > 0.5 || Math.abs(last.y - at.y) > 0.5) {
          tr.push({ t: 1, x: at.x, y: at.y, ease: true });
        } else if (last.t < 1) tr.push({ t: 1, x: at.x, y: at.y });
        continue;
      }
      if (!b) continue;
      if (Math.abs(b.x - at.x) > 0.5 || Math.abs(b.y - at.y) > 0.5) {
        A.tracks.set(id, [
          { t: c0, x: b.x, y: b.y },
          { t: 1, x: at.x, y: at.y, ease: true },
        ]);
      }
    }
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
  for (const s of w.sites) if (s.occupant) component(w, s.occupant).forEach((x) => pinned.add(x));
  for (const a of w.atoms.values()) if (a.sei) pinned.add(a.id);
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
  const free = live.filter((c) => w.atoms.get(c[0])!.crowd && !c.some((x) => attached.has(x) || inLattice.has(x) || w.atoms.get(x)!.sei));
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
  return `'${f ?? ''}'은(는) 아직 등록되지 않은 분자예요. 등록된 분자: H2O, H3O+, OH-, HCl, Cl-, Na+, K+, Ca2+, Mg2+, H+, NH3, NH4+, CO2, CH4, O2, N2, H2, Cl2 등 (안내서 참고)`;
}
