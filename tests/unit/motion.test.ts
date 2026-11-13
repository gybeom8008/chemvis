import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { trackAt, type StepAnim, type Timeline } from '../../src/engine/timeline';
import { allComponents, bondKey, cloneWorld, neighbors, type World } from '../../src/engine/world';
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
