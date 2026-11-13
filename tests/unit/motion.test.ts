import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { hopProgress, trackAt, type StepAnim, type Timeline } from '../../src/engine/timeline';
import { allComponents, bondKey, cloneWorld, component, formalCharge, neighbors, type World } from '../../src/engine/world';
import { bondLength, element } from '../../src/chem/elements';
import { CHAPTERS } from '../../src/tutorial/chapters';
import { trackAt as renderedTrackAt } from '../../src/render/view';
import { centroid, dist, sub, type Vec } from '../../src/util/math';

const scenes = ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'addition', 'condensation', 'redox', 'coordination', 'radical'];
// 9bfe44c 엔진과 작업 시작 시 chapters.ts에서 기록했다. 좌표·전자 방향만 제외한다.
const chemicalHashes: Record<string, string> = {
  'acid-hcl': '110095219ba54b3356c3720ca0263fcde298756aee3cf37a06c1a37bb952a6b0',
  'base-nh3': '170b12c92643d20b8ee3cea25dd97458643bcbe097ad1613e20a2e3b468c9e1d',
  neutralization: 'c0d6b7e9acef1f159e5d746225f581ea50e1a85783791b88e1a2b89c582d5b73',
  substitution: '35a85a28fb0f73dbbef80d707735cf5749a4fd68fb330f28bd9375f7969c4cd2',
  addition: '95acd52f52f9cb13bf8144eac0e3431c9701e23ce1914bf10af83e66d28eacf6',
  condensation: 'bafca9ea2a08c1298eda83c10b31fbe584a5b71ca53896f2fc58006d9fc83280',
  redox: '503aaf24613fb41484386d59de0801e6b55e112dc7b0bd49559c4a11aaef5089',
  coordination: '83f6616db847f25867846071a3466021628fe90889e3e3438e529f37cd4d3084',
  radical: 'f4a70eb709050703fe452699d47d6d6017cfb23cb113882054ec297726e54b3a',
};
const grid = Array.from({ length: 51 }, (_, i) => i / 50);
const pos = (s: StepAnim, id: string, t: number): Vec => {
  const tr = s.tracks.get(id);
  return tr ? trackAt(tr, t) : s.before.atoms.get(id) ?? s.after.atoms.get(id)!;
};
// 0.02 표본과 함께 변화 경계와 빠른 전달 완료 시점도 검사한다.
const times = (s: StepAnim) => [...new Set([...grid, ...[...s.tracks.values()].flatMap((tr) => tr.map((k) => k.t)),
  ...(s.phase ? [s.phase.b0, s.phase.b1, s.phase.c0, s.phase.c1 ?? 1, s.phase.c0 + 0.35 * ((s.phase.c1 ?? 1) - s.phase.c0)] : [])])].sort((a, b) => a - b);
const signature = (w: World) => ({
  atoms: [...w.atoms].map(([id, { x: _x, y: _y, face: _face, ...a }]) => [id, a]),
  bonds: [...w.bonds], names: [...w.names], counter: w.counter,
});
const chemistry = async (tl: Timeline) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([signature(tl.initial), ...tl.steps.map((s) => signature(s.after))]))))].map((b) => b.toString(16).padStart(2, '0')).join('');

type Criterion = 'retained' | 'contact' | 'handoff' | 'gentle' | 'clear' | 'rotation';

describe('causal motion at a solid surface', () => {
  const dense = Array.from({ length: 501 }, (_, i) => i / 500);
  const run = (src: string) => {
    const r = compile(src, { tight: true });
    expect(r.errors).toEqual([]);
    return r.timeline!;
  };
  const unchangedChemistry = (src: string, tl: Timeline) => {
    const legacy = compile(src);
    expect(legacy.errors).toEqual([]);
    tl.steps.forEach((s, i) => {
      expect(signature(s.after)).toEqual(signature(legacy.timeline!.steps[i].after));
      expect([...s.after.crystals]).toEqual([...legacy.timeline!.steps[i].after.crystals]);
    });
  };
  const endpoints = (tl: Timeline) => {
    for (const s of tl.steps) for (const [id, tr] of s.tracks) {
      expect(dist(trackAt(tr, 1), s.after.atoms.get(id)!)).toBeLessThan(1e-6);
      if (s.before.atoms.has(id)) expect(dist(trackAt(tr, 0), s.before.atoms.get(id)!)).toBeLessThan(1e-6);
      for (const t of dense) expect(trackAt(tr, t)).toEqual(renderedTrackAt(tr, t));
    }
  };
  for (const solvent of ['', 'crowd H2O in water 26\n']) it(`waits for every water, then carries the shell toward the water (${solvent ? 'existing' : 'new'} water)`, () => {
    const src = `stage solution\n${solvent}crystal s = NaCl at bottom 4x3\nstep "물에 녹아요"\n dissolve s1 s2 from s`;
    const tl = run(src), s = tl.steps[0];
    for (const ion of ['s1.Na', 's2.Cl']) {
      const atom = s.after.atoms.get(ion)!;
      const plus = formalCharge(s.after, atom) > 0;
      const waters = s.after.attached.get(ion)!.map((id) => component(s.after, id));
      expect(waters.length).toBeGreaterThan(0);
      const contacts = waters.map((water) => water.filter((id) => s.after.atoms.get(id)!.el === (plus ? 'O' : 'H'))
        .sort((a, b) => dist(pos(s, a, 0.42), pos(s, ion, 0.42)) - dist(pos(s, b, 0.42), pos(s, ion, 0.42)))[0]);
      const contact = element(atom.el).r + element(plus ? 'O' : 'H').r + (plus ? 7 : 12);
      for (const t of dense) {
        if (contacts.some((id) => dist(pos(s, id, t), pos(s, ion, t)) > contact + 0.1)) {
          expect(dist(pos(s, ion, t), pos(s, ion, 0))).toBeLessThan(2);
        }
        if (t <= 0.45) expect(dist(pos(s, ion, t), pos(s, ion, 0))).toBeLessThan(1e-6);
        if (t >= 0.42) for (const id of contacts) expect(dist(pos(s, id, t), pos(s, ion, t)), `${ion} ${id} at ${t}`).toBeLessThanOrEqual(contact + 0.01);
        if (t >= 0.45) for (const id of waters.flat()) {
          expect(dist(sub(pos(s, id, t), pos(s, ion, t)), sub(pos(s, id, 0.45), pos(s, ion, 0.45)))).toBeLessThan(1e-6);
        }
      }
      const towardWater = centroid(contacts.map((id) => sub(pos(s, id, 0.45), pos(s, ion, 0.45))));
      const displacement = sub(pos(s, ion, 1), pos(s, ion, 0));
      expect(displacement.x * towardWater.x + displacement.y * towardWater.y).toBeGreaterThan(0);
      for (const water of waters) {
        const O = water.find((id) => s.after.atoms.get(id)!.el === 'O')!;
        const Hs = water.filter((id) => s.after.atoms.get(id)!.el === 'H');
        for (const h of Hs) for (const t of dense) expect(Math.abs(dist(pos(s, O, t), pos(s, h, t)) - bondLength('O', 'H'))).toBeLessThan(0.05);
        if (plus) for (const h of Hs) expect(dist(pos(s, h, 0.42), pos(s, ion, 0.42))).toBeGreaterThan(dist(pos(s, O, 0.42), pos(s, ion, 0.42)));
        else expect(Math.min(...Hs.map((h) => dist(pos(s, h, 0.42), pos(s, ion, 0.42))))).toBeLessThan(dist(pos(s, O, 0.42), pos(s, ion, 0.42)));
      }
    }
    unchangedChemistry(src, tl);
    endpoints(tl);
  });

  const ions = `stage solution
crowd H2O in water 26
mol a1 = Ag+ at 300,220
mol b1 = Cl- at 470,250
mol a2 = Ag+ at 690,200
mol b2 = Cl- at 640,400
step "물 분자가 둘러싸요"
 solvate all
`;
  for (const chapter of ['dissolving', 'precipitation']) it(`preserves chemistry across the complete ${chapter} scene`, () => {
    const src = CHAPTERS.find((c) => c.id === chapter)!.script;
    const tl = run(src);
    unchangedChemistry(src, tl);
    endpoints(tl);
  });
  it('keeps polyatomic ions intact when dissolving and returning to the crystal', () => {
    const src = `stage solution
crowd H2O in water 20
crystal s = CaCO3 at water 4x2
step "물에 녹아요"
 dissolve s1 s2 from s
step "다시 붙어요"
 precipitate Ca2+ CO32- onto s`;
    const tl = run(src);
    unchangedChemistry(src, tl);
    endpoints(tl);
    for (const s of tl.steps) for (const b of s.before.bonds.values()) for (const t of dense) {
      expect(Math.abs(dist(pos(s, b.a, t), pos(s, b.b, t)) - dist(pos(s, b.a, 0), pos(s, b.b, 0)))).toBeLessThan(0.05);
    }
    const s = tl.steps[1];
    const carbonate = component(s.before, 's2.C');
    const center = centroid(carbonate.map((id) => pos(s, id, 0.42)));
    const toward = sub(pos(s, 's1.Ca', 0.42), center);
    expect(carbonate.filter((id) => formalCharge(s.before, s.before.atoms.get(id)!) < 0).some((id) => {
      const offset = sub(pos(s, id, 0.42), center);
      return (offset.x * toward.x + offset.y * toward.y) / (Math.hypot(offset.x, offset.y) * Math.hypot(toward.x, toward.y)) > 0.999;
    })).toBe(true);
  });
  for (const named of [true, false]) it(`approaches before releasing water and settles as a pair (${named ? 'using' : 'formula'}, then onto)`, () => {
    const src = ions + (named
      ? 'step "만나요"\n precipitate using a1 b1 as s\nstep "붙어요"\n precipitate using a2 b2 onto s'
      : 'step "만나요"\n precipitate Ag+ Cl-\nstep "붙어요"\n precipitate Ag+ Cl- onto ppt#1');
    const tl = run(src);
    for (let i = 1; i <= 2; i++) {
      const s = tl.steps[i], cat = `a${i}.Ag`, an = `b${i}.Cl`;
      const contact = element('Ag').r + element('Cl').r + 7;
      const axis = sub(pos(s, an, 0), pos(s, cat, 0));
      let previous = dist(pos(s, cat, 0), pos(s, an, 0));
      for (const t of dense) {
        const gap = dist(pos(s, cat, t), pos(s, an, t));
        if (t <= 0.64) {
          expect(gap).toBeLessThanOrEqual(previous + 1e-6);
          for (const id of [cat, an]) {
            const d = sub(pos(s, id, t), pos(s, id, 0));
            expect(Math.abs(d.x * axis.y - d.y * axis.x)).toBeLessThan(1e-5);
          }
        } else expect(Math.abs(gap - contact)).toBeLessThan(0.02);
        previous = gap;
        if (gap >= contact + 40 - 1e-6) for (const id of [cat, an]) for (const w of s.before.attached.get(id)!) {
          for (const atom of component(s.before, w)) expect(dist(sub(pos(s, atom, t), pos(s, id, t)), sub(pos(s, atom, 0), pos(s, id, 0)))).toBeLessThan(1e-5);
        }
      }
      const middle = centroid([pos(s, cat, 0.42), pos(s, an, 0.42)]);
      for (const id of [cat, an]) {
        expect(s.after.attached.has(id)).toBe(false);
        for (const w of s.before.attached.get(id)!) {
          expect(dist(pos(s, w, 0.60), middle) - dist(pos(s, w, 0.42), middle)).toBeGreaterThan(50);
          expect(dist(pos(s, w, 0.60), pos(s, id, 0.60))).toBeGreaterThan(dist(pos(s, w, 0.42), pos(s, id, 0.42)) + 30);
        }
      }
      if (i === 2) {
        const old = [...s.before.crystals.values()].flat();
        for (const id of old) expect(dist(pos(s, id, 0), pos(s, id, 1))).toBeLessThan(1e-6);
        const all = [...old, cat, an];
        for (const id of [cat, an]) for (const other of all.filter((x) => x !== id)) {
          const gap = dist(pos(s, id, 1), pos(s, other, 1));
          expect(gap).toBeGreaterThanOrEqual(contact - 1e-6);
          if (gap < contact * 1.1) expect(formalCharge(s.after, s.after.atoms.get(id)!) * formalCharge(s.after, s.after.atoms.get(other)!)).toBeLessThan(0);
        }
        // 두 자리 모두 빈 이웃 자리인 모든 후보와 중점 거리를 비교한다.
        const here = centroid([pos(s, cat, 0), pos(s, an, 0)]);
        const finalDistance = dist(here, centroid([pos(s, cat, 1), pos(s, an, 1)]));
        const dirs = [{ x: contact, y: 0 }, { x: -contact, y: 0 }, { x: 0, y: contact }, { x: 0, y: -contact }];
        for (const id of old) for (const d of dirs) for (const e of dirs) {
          const base = pos(s, id, 0), p = { x: base.x + d.x, y: base.y + d.y }, q = { x: p.x + e.x, y: p.y + e.y };
          const sign = formalCharge(s.before, s.before.atoms.get(id)!);
          const valid = (point: Vec, charge: number) => old.every((x) => dist(point, pos(s, x, 0)) >= contact * 0.5 &&
            (formalCharge(s.before, s.before.atoms.get(x)!) * charge < 0 || dist(point, pos(s, x, 0)) >= contact * 1.1));
          if (valid(p, -sign) && valid(q, sign)) expect(finalDistance).toBeLessThanOrEqual(dist(here, centroid([p, q])) + 1e-6);
        }
      }
    }
    unchangedChemistry(src, tl);
    endpoints(tl);
  });

  const metal = `stage solution
crowd H2O in water 26
metal m = Zn at 420,330 3x2
mol a1 = Ag+ at 640,200
mol a2 = Ag+ at 700,330
step "표면에 닿아요"
 land a1 a2 on m3
step "전자가 건너가요"
 hop m4.Zn -> a1.Ag
 hop m4.Zn -> a2.Ag
 join a1 a2 to m
`;
  for (const separate of [false, true]) it(`leaves with its electrons (${separate ? 'separate step' : 'same step'})`, () => {
    const src = metal + (separate ? 'step "물속으로 나와요"\n' : '') + ' leave m4 from m';
    const tl = run(src), s = tl.steps.at(-1)!;
    const zn = 'm4.Zn';
    expect(formalCharge(s.after, s.after.atoms.get(zn)!)).toBe(2);
    expect(s.after.crystals.get('m')).not.toContain(zn);
    for (const id of ['a1.Ag', 'a2.Ag']) {
      expect(s.after.atoms.get(id)!.lattice).toBe(true);
      expect(formalCharge(s.after, s.after.atoms.get(id)!)).toBe(0);
    }
    if (!separate) {
      for (const t of dense) {
        const displacement = dist(pos(s, zn, t), pos(s, zn, 0));
        const first = hopProgress(s.phase!, 0, 2, t), last = hopProgress(s.phase!, 1, 2, t);
        if (first <= 0.02) expect(displacement).toBeLessThan(1e-6);
        if (last < 0.999) {
          expect(displacement).toBeLessThanOrEqual(4.001);
          const gap = Math.min(...s.after.crystals.get('m')!.map((id) => dist(pos(s, zn, t), pos(s, id, t)) -
            element('Zn').r - element(s.after.atoms.get(id)!.el).r));
          expect(gap).toBeLessThan(10);
        }
      }
      expect(dist(pos(s, zn, 0.30), pos(s, zn, 0))).toBeGreaterThan(1);
      expect(dist(pos(s, zn, 0.55), pos(s, zn, 0))).toBeCloseTo(4, 5);
    }
    expect(dist(pos(s, zn, 1), pos(s, zn, 0))).toBeGreaterThan(80);
    for (const id of s.after.crystals.get('m')!) expect(dist(pos(s, zn, 1), pos(s, id, 1))).toBeGreaterThan(50);
    unchangedChemistry(src, tl);
    endpoints(tl);
  });
  it('uses the existing renderer flight windows, including the pause between electrons', () => {
    const phase = { b0: 0.12, b1: 0.55 };
    const at = (fraction: number) => phase.b0 + fraction * (phase.b1 - phase.b0);
    expect(hopProgress(phase, 0, 2, at(0))).toBe(0);
    expect(hopProgress(phase, 0, 2, at(0.2))).toBeCloseTo(0.5, 10);
    expect(hopProgress(phase, 0, 2, at(0.45))).toBe(1);
    expect(hopProgress(phase, 1, 2, at(0.45))).toBe(0);
    expect(hopProgress(phase, 1, 2, at(0.7))).toBeCloseTo(0.5, 10);
    expect(hopProgress(phase, 1, 2, at(0.9))).toBeCloseTo(1, 10);
  });
});

function violations(tl: Timeline, criterion: Criterion): string[] {
  const failures: string[] = [];
  const fail = (s: StepAnim, message: string) => { if (failures.length < 12) failures.push(`step ${s.index}: ${message}`); };
  for (const s of tl.steps) {
    const ts = times(s);
    if (criterion === 'retained') for (const [key, b] of s.before.bonds) {
      if (!s.after.bonds.has(key)) continue;
      const initial = dist(pos(s, b.a, 0), pos(s, b.b, 0));
      for (const t of ts) {
        const ratio = dist(pos(s, b.a, t), pos(s, b.b, t)) / initial;
        if (ratio < 0.85 - 1e-6 || ratio > 1.2 + 1e-6) { fail(s, `${key} t=${t.toFixed(3)} ratio=${ratio.toFixed(3)}`); break; }
      }
    }
    if (criterion === 'contact' && s.phase) {
      for (const [world, other, forming] of [[s.after, s.before, true], [s.before, s.after, false]] as const) {
        for (const [key, b] of world.bonds) {
          if (other.bonds.has(key)) continue;
          const reference = dist(world.atoms.get(b.a)!, world.atoms.get(b.b)!);
          for (const t of ts.filter((t) => forming ? t >= s.phase!.b0 : t <= s.phase!.b1)) {
            const ratio = dist(pos(s, b.a, t), pos(s, b.b, t)) / reference;
            if (ratio > 1.25 + 1e-6) { fail(s, `${forming ? 'new' : 'broken'} ${key} t=${t.toFixed(3)} ratio=${ratio.toFixed(3)}`); break; }
          }
        }
      }
    }
    if (criterion === 'handoff' && s.phase) for (const id of s.before.atoms.keys()) {
      const was = neighbors(s.before, id).map((n) => n.id);
      const now = neighbors(s.after, id).map((n) => n.id);
      if (!was.length || !now.length || now.some((n) => was.includes(n))) continue;
      const partner = now[0];
      const c0 = s.phase.c0, c1 = s.phase.c1 ?? 1;
      const relative = (t: number) => sub(pos(s, id, t), pos(s, partner, t));
      const total = dist(relative(c0), relative(c1));
      if (total < 1e-6) continue;
      const remaining = dist(relative(c0 + 0.35 * (c1 - c0)), relative(c1)) / total;
      if (remaining > 0.05 + 1e-6) fail(s, `${id} -> ${partner}: remaining=${remaining.toFixed(4)}`);
    }
    if (criterion === 'gentle' && !s.phase) for (const [id] of s.tracks) {
      let length = 0;
      for (let i = 1; i < grid.length; i++) length += dist(pos(s, id, grid[i - 1]), pos(s, id, grid[i]));
      if (length < 1e-6) continue;
      for (const [a, b] of [[0, 0.02], [0.98, 1]]) {
        const speed = dist(pos(s, id, a), pos(s, id, b)) / 0.02;
        if (speed > length * 0.25 + 1e-6) fail(s, `${id} t=${a}: speed/mean=${(speed / length).toFixed(3)}`);
      }
    }
    if (criterion === 'clear') {
      // 렌더러가 경로 표본 사이를 잇는 동안에도 원자가 겹치지 않는지 검사한다.
      const clearanceTimes = ts.flatMap((t, i) => i ? [(ts[i - 1] + t) / 2, t] : [t]);
      const ids = [...s.before.atoms.keys()].filter((id) => s.after.atoms.has(id) && !(s.before.atoms.get(id)!.crowd && s.after.atoms.get(id)!.crowd));
      for (let i = 0; i < ids.length; i++) for (const b of ids.slice(i + 1)) {
        const a = ids[i], key = bondKey(a, b);
        const radii = element(s.before.atoms.get(a)!.el).r + element(s.before.atoms.get(b)!.el).r;
        // 같은 원자에 붙은 두 이웃(1–3 관계)만 제외한다. 분자 내부도 검사한다.
        const exempt = (w: World) => w.bonds.has(key) || neighbors(w, a).some((n) => w.bonds.has(bondKey(n.id, b)));
        const beforeExempt = exempt(s.before), afterExempt = exempt(s.after);
        for (const t of clearanceTimes) {
          // 끝점은 그때 결합 상태를 쓴다. 도중에 바뀌는 결합은 contact에서 검사한다.
          if (t === 0 ? beforeExempt : t === 1 ? afterExempt : beforeExempt || afterExempt) continue;
          const min = radii + (t === 0 || t === 1 ? 3 : -1);
          const d = dist(pos(s, a, t), pos(s, b, t));
          if (d < min - 1e-6) { fail(s, `${key} t=${t.toFixed(3)} distance=${d.toFixed(2)} < ${min}`); break; }
        }
      }
    }
    if (criterion === 'rotation' && s.phase) {
      const retained = cloneWorld(s.before);
      for (const key of retained.bonds.keys()) if (!s.after.bonds.has(key)) retained.bonds.delete(key);
      // 떨어져 나가는 물은 큰 분자 회전 측정에 넣지 않는다.
      const groups = allComponents(retained).filter((g) => !s.before.atoms.get(g[0])!.crowd)
        .sort((a, b) => b.filter((id) => s.before.atoms.get(id)!.el !== 'H').length - a.filter((id) => s.before.atoms.get(id)!.el !== 'H').length || b.length - a.length);
      const g = groups[0]?.filter((id) => neighbors(s.before, id).some((n) => s.after.bonds.has(bondKey(id, n.id))));
      if (!g || g.length < 2) continue;
      const origin = g.map((id) => pos(s, id, s.phase!.b0));
      const cp = centroid(origin);
      for (const t of ts.filter((t) => t >= s.phase!.b1)) {
        const current = g.map((id) => pos(s, id, t)), cq = centroid(current);
        let sin = 0, cos = 0;
        origin.forEach((p, i) => { const a = sub(p, cp), b = sub(current[i], cq); sin += a.x * b.y - a.y * b.x; cos += a.x * b.x + a.y * b.y; });
        const degrees = Math.abs(Math.atan2(sin, cos)) * 180 / Math.PI;
        if (degrees > 5 + 1e-6) { fail(s, `rotation t=${t.toFixed(3)}: ${degrees.toFixed(2)} degrees`); break; }
      }
    }
  }
  return failures;
}

describe('tight motion', () => {
  for (const name of scenes) describe(name, () => {
    const chapter = CHAPTERS.find((c) => c.id === name)!;
    const result = compile(chapter.script, { tight: true });
    const tl = result.timeline!;
    it('compiles and preserves the recorded chemical states', async () => {
      expect(result.errors).toEqual([]);
      expect(await chemistry(tl)).toBe(chemicalHashes[name]);
    });
    it('keeps the default and explicit legacy outputs identical', () => {
      // 무대가 만드는 함수 인스턴스는 제외하고 기존 legacy 검사와 같은 출력 형식을 쓴다.
      const encode = (value: unknown) => JSON.stringify(value, (_, v) => v instanceof Map || v instanceof Set ? [...v] : v);
      expect(encode(compile(chapter.script))).toBe(encode(compile(chapter.script, { tight: false })));
    });
    for (const criterion of ['retained', 'contact', 'handoff', 'gentle', 'clear', 'rotation'] as const) {
      it(criterion, () => expect(violations(tl, criterion)).toEqual([]));
    }
    it('preserves retained bond lengths at stored endpoints', () => {
      for (const s of tl.steps) for (const [key, b] of s.before.bonds) {
        if (s.after.bonds.get(key)?.order !== b.order) continue;
        expect(dist(s.after.atoms.get(b.a)!, s.after.atoms.get(b.b)!))
          .toBeCloseTo(dist(s.before.atoms.get(b.a)!, s.before.atoms.get(b.b)!), 6);
      }
    });
    it('uses the renderer interpolation and reaches the stored endpoints', () => {
      for (const s of tl.steps) for (const [id, tr] of s.tracks) {
        for (const t of times(s)) expect(trackAt(tr, t)).toEqual(renderedTrackAt(tr, t));
        expect(dist(pos(s, id, 0), s.before.atoms.get(id) ?? s.after.atoms.get(id)!)).toBeLessThan(1e-6);
        expect(dist(pos(s, id, 1), s.after.atoms.get(id)!)).toBeLessThan(1e-6);
      }
    });
  });

  it('matches every interpolation mode supported by the renderer', () => {
    for (const ease of [undefined, false, true, 'snap'] as const) {
      const tr = [{ t: 0.2, x: 3, y: 8 }, { t: 0.8, x: -20, y: 40, ease }];
      for (const t of grid) expect(trackAt(tr, t)).toEqual(renderedTrackAt(tr, t));
    }
  });

  it('prepares both condensation contacts and releases completed water by exactly 60', () => {
    const tl = compile(CHAPTERS.find((c) => c.id === 'condensation')!.script, { tight: true }).timeline!;
    const s = tl.steps.find((s) => s.shifts?.some((x) => x.src.kind === 'lp' && x.src.a === 'g2.N'))!;
    const formed = s.phase!.c1!;
    expect(dist(pos(s, 'g1.C2', 0), pos(s, 'g2.N', 0))).toBeCloseTo(bondLength('C', 'N', 1), 6);
    expect(dist(pos(s, 'g1.O2', 0), pos(s, 'g2.H2', 0))).toBeLessThan(1.25 * bondLength('O', 'H', 1));
    const water = ['g1.O2', 'g1.H5', 'g2.H2'];
    const displacement = sub(pos(s, water[0], 1), pos(s, water[0], formed));
    expect(Math.hypot(displacement.x, displacement.y)).toBeCloseTo(60, 6);
    for (const id of water) expect(dist(sub(pos(s, id, 1), pos(s, id, formed)), displacement)).toBeLessThan(1e-6);
    for (const t of grid.filter((t) => t >= formed)) for (const h of water.slice(1)) {
      expect(dist(pos(s, water[0], t), pos(s, h, t))).toBeCloseTo(34, 5);
    }
    const a = sub(pos(s, water[1], formed), pos(s, water[0], formed));
    const b = sub(pos(s, water[2], formed), pos(s, water[0], formed));
    expect(Math.acos((a.x * b.x + a.y * b.y) / (34 * 34)) * 180 / Math.PI).toBeCloseTo(104.5, 5);
  });

  it('keeps the hydrolysis approach, then transfers H and keeps the remaining OH together', () => {
    const tl = compile(CHAPTERS.find((c) => c.id === 'condensation')!.script, { tight: true }).timeline!;
    const s = tl.steps.at(-1)!;
    const O = '~H2O#15.O', H = '~H2O#15.H1', otherH = '~H2O#15.H2';
    expect(s.tracks.get(H)!.some((k) => k.t === 0.36)).toBe(true);
    expect(dist(pos(s, H, 0), pos(s, H, 0.36))).toBeGreaterThan(1);
    expect(dist(pos(s, H, 0.36), pos(s, H, s.phase!.c0))).toBeLessThan(1e-6);
    // 렌더러가 회전 표본 사이를 직선으로 잇는 오차만 허용한다(원래 실패는 17.96까지 줄었다).
    for (const t of times(s)) expect(Math.abs(dist(pos(s, O, t), pos(s, otherH, t)) - 34)).toBeLessThan(0.05);
    expect(violations({ ...tl, steps: [s] }, 'handoff')).toEqual([]);
  });

  it('prepares substitution opposite Br and keeps the methyl branches after bonding', () => {
    const tl = compile(CHAPTERS.find((c) => c.id === 'substitution')!.script, { tight: true }).timeline!;
    const s = tl.steps.find((s) => s.arrows.length > 0)!;
    const entry = sub(pos(s, 'n.N', 0), pos(s, 'm.C', 0));
    const exit = sub(pos(s, 'm.Br', 0), pos(s, 'm.C', 0));
    expect((entry.x * exit.x + entry.y * exit.y) / (Math.hypot(entry.x, entry.y) * Math.hypot(exit.x, exit.y))).toBeCloseTo(-1, 6);
    for (const h of ['m.H1', 'm.H2', 'm.H3']) for (const t of times(s)) {
      expect(dist(sub(pos(s, h, t), pos(s, 'm.C', t)), sub(pos(s, h, 0), pos(s, 'm.C', 0)))).toBeLessThan(1e-6);
    }
  });

  // 실제 주머니 두께·소유 원자·그리는 순서는 pairs.ts에만 있다. 엔진 좌표로 대신 합격시키지 않는다.
  it.todo('checks electron-pair bodies against atoms and other pairs once the renderer exposes their geometry and ownership');
});
