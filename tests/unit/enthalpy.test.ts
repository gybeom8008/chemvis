import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { allComponents, cloneWorld, emptyWorld, formulaOf } from '../../src/engine/world';
import { formationEnthalpy, stepEnthalpy, FORMATION_ENTHALPIES, UNAVAILABLE_FORMATION_ENTHALPIES } from '../../src/chem/enthalpy';
import { LIBRARY } from '../../src/chem/library';
import { CHAPTERS } from '../../src/tutorial/chapters';
import { EXAMPLES } from '../../src/tutorial/examples';
import compareSource from '../../src/next/compare.ts?raw';

const timeline = (script: string) => {
  const result = compile(script);
  expect(result.errors).toEqual([]);
  expect(result.timeline).not.toBeNull();
  return result.timeline!;
};
const chapter = (id: string) => CHAPTERS.find((c) => c.id === id)!.script;
const results = (script: string) => {
  const t = timeline(script);
  return t.steps.map((s) => stepEnthalpy(s.before, s.after, t.stage));
};

// 화면 모듈을 import하지 않고 실제 SCENES 배열과 대본 상수를 읽는다. 새 장면을 빠뜨리면 실패한다.
const literals = new Map([...compareSource.matchAll(/const\s+(\w+)\s*=\s*`(scene[\s\S]*?)`;/g)].map((m) => [m[1], m[2]]));
const sceneArray = compareSource.match(/const SCENES[^=]*=\s*\[([\s\S]*?)\];/)![1];
const compareScenes = [...sceneArray.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?src:\s*(chapter\('([^']+)'\)|(\w+))\s*\}/g)]
  .map((m) => ({ id: m[1], script: m[3] ? chapter(m[3]) : literals.get(m[4])! }));
const lessonSources = import.meta.glob<string>('../../docs/plan/lessons/*.md', { query: '?raw', import: 'default', eager: true });
const lessons = Object.entries(lessonSources).flatMap(([path, source]) => {
  const name = path.split('/').at(-1)!;
  return [...source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].filter((m) => /^\s*scene\s/m.test(m[1]))
    .map((m, i) => ({ id: `${name}:${i + 1}`, script: m[1] }));
});

describe('생성 엔탈피로 실제 대본을 계산한다', () => {
  it('H3O+ + OH- → 2 H2O: -55.815이며 crowd를 세지 않는다', () => {
    const r = results(chapter('neutralization'))[2];
    expect(r.dH).toBeCloseTo(-55.815, 6);
    expect(r.estimated).toBe(false);
    expect(r.terms.find((t) => t.formula === 'H2O')).toMatchObject({ phase: 'l', change: 2 });
  });
  it('분자로 그린 HCl은 기체 투입 기준이며 물과 반응하면 뚜렷한 발열이다', () => {
    expect(formationEnthalpy('HCl', 'aq')).toBe(-92.31);
    const r = results(chapter('acid-hcl'))[1];
    expect(r.dH).toBeCloseTo(-74.77, 6);
    expect(r.dH).toBeLessThan(-60);
    expect(r.dH).toBeGreaterThan(-90);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: true });
    expect(r.terms.find((t) => t.formula === 'HCl')).toMatchObject({ checked: false, convention: true });
    expect(r.terms).toHaveLength(4);
  });
  it.each([['HBr', -85.12], ['HI', -83.28]] as const)('%s 분자의 용해와 이온화도 발열이다', (acid, dh) => {
    const r = results(chapter('acid-hcl').replaceAll('HCl', acid))[1];
    expect(r.dH).toBeCloseTo(dh, 6);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: true });
  });
  it('CH3Br + OH- → CH3OH + Br-: 수화열이 있는 표 값으로 계산한다', () => {
    const r = results(chapter('energy'))[2];
    expect(r.dH).toBeCloseTo(-77.6201658842, 6);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: false });
    expect(r.missing).toEqual([]);
    expect(r.terms.find((t) => t.formula === 'CH3Br')).toMatchObject({ phase: 'aq', estimated: false, checked: true });
  });
  it('NH3 + CH3Br → CH3NH3+ + Br-는 약 100 kJ/mol을 내놓는다', () => {
    const r = results(chapter('substitution'))[2];
    expect(r.dH).toBeGreaterThan(-120);
    expect(r.dH).toBeLessThan(-90);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: false, missing: [] });
    expect(r.terms.find((t) => t.formula === 'CH6N+')).toMatchObject({ phase: 'aq', value: -123.50, change: 1 });
  });
  it('Cu2+ + 4 NH3 배위 결합은 문헌의 전체 생성열 -90 kJ/mol과 맞는다', () => {
    const r = results(chapter('coordination'))[2];
    expect(r.dH).toBeCloseTo(-90, 6);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: false, missing: [] });
    expect(r.terms.find((t) => t.formula === 'CuH12N42+')).toMatchObject({ phase: 'aq', change: 1, checked: true });
  });
  it('에텐에 HBr을 더하는 두 반응 단계를 합치면 약 100 kJ/mol 발열이다', () => {
    const t = timeline(chapter('addition'));
    const r = stepEnthalpy(t.steps[2].before, t.steps[4].after, t.stage);
    expect(r.dH).toBeGreaterThan(-120);
    expect(r.dH).toBeLessThan(-75);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: true, missing: [] });
    // 현재 heat()가 중간체를 건너뛰어 끝에서 한 번만 표시하는지도 확인한다.
    const c = compile(chapter('addition'), { tight: true, tangible: true });
    expect(c.errors).toEqual([]);
    expect(c.timeline!.steps[2].heat).toBeUndefined();
    expect(c.timeline!.steps[3].heat).toBeUndefined();
    expect(c.timeline!.steps[4].heat).toBeCloseTo(r.dH!, 6);
  });
  it('글라이신 축합은 약한 흡열이며 같은 물을 쓰는 역반응은 발열이다', () => {
    const t = timeline(chapter('condensation')), s = t.steps[2];
    const r = stepEnthalpy(s.before, s.after, t.stage);
    // -736.14 - 285.83 - 2*(-514.22) = +6.47. 기체 결합 어림은 부호가 반대였다.
    expect(r.dH).toBeGreaterThan(2);
    expect(r.dH).toBeLessThan(12);
    expect(r.dH).toBeCloseTo(6.47, 6);
    expect(r).toMatchObject({ estimated: false, reliable: true, convention: true });
    const reverse = stepEnthalpy(s.after, s.before, t.stage);
    expect(reverse.dH).toBeCloseTo(-6.47, 6);
    expect(reverse.reliable).toBe(true);
    // 현재 대본의 가수분해는 제외했던 둘레 물을 쓰므로 역반응 값으로 표시하면 안 된다.
    const hydrolysis = stepEnthalpy(t.steps[4].before, t.steps[4].after, t.stage);
    expect(hydrolysis.reliable).toBe(false);
    expect(hydrolysis.why).toContain('원자가 달라져');
  });
  it('Zn(s) + 2 Ag+(aq) → Zn2+(aq) + 2 Ag(s): -364.970이다', () => {
    // compare의 단계 구분은 화면 작업 중 바뀔 수 있어 분리된 단계 대본을 여기서 고정한다.
    const script = `stage solution
metal m = Zn at 420,330 3x2
mol a1 = Ag+ at 640,200
mol a2 = Ag+ at 700,330
step "처음이에요"
  wait
step "표면에 닿아요"
  land a1 a2 on m3
step "전자를 받아요"
  hop m3.Zn -> a1.Ag
  hop m3.Zn -> a2.Ag
  join a1 a2 to m
step "아연 이온이 나와요"
  leave m3 from m`;
    const t = timeline(script), r = results(script);
    expect(r[1].dH).toBe(0); // land는 침전도 환원도 아니다.
    expect(r[2].dH).toBeCloseTo(-211.58, 6);
    expect(r[3].dH).toBeCloseTo(-153.39, 6); // lattice 약속 때문에 leave 단계에 배정된다.
    expect(stepEnthalpy(t.initial, t.steps.at(-1)!.after, t.stage).dH).toBeCloseTo(-364.97, 6);
    expect(r.reduce((sum, x) => sum + x.dH!, 0)).toBeCloseTo(-364.97, 6);
  });
  it('AgCl 침전 한 쌍마다 -65.720이며 세 쌍은 세 배이다', () => {
    const r = results(compareScenes.find((s) => s.id === 'solid')!.script);
    for (const s of r.slice(1)) {
      expect(s.dH).toBeCloseTo(-65.72, 6);
      expect(s.terms.find((t) => t.formula === 'AgCl')).toMatchObject({ phase: 's', change: 1, value: -127.01 });
    }
    expect(results(chapter('precipitation'))[1].dH).toBeCloseTo(-197.16, 6);
  });
  it('NaCl 용해는 상이 바뀌므로 0이 아니다. 홀수 개 격자도 화학식 단위로 나눈다', () => {
    const r = results(chapter('dissolving'));
    expect(r[1].dH).toBeCloseTo(3.7, 6);
    expect(r[1].terms.find((t) => t.formula === 'NaCl')).toMatchObject({ phase: 's', change: -1 });
    expect(r[2].dH).toBeCloseTo(3.7, 6);
  });
  it('분자 이온 결정은 원자 개수가 아닌 이온 개수로 센다', () => {
    const r = results(`stage solution\ncrystal s = CaCO3 at bottom 2x1\nstep "녹아요"\n dissolve 2 from s`)[0];
    expect(r.dH).toBeCloseTo(-11.33, 6);
    expect(r.terms.find((t) => t.formula === 'CaCO3')!.change).toBe(-1);
  });
  it('모르는 염을 자유 이온으로 세지 않는다', () => {
    const r = results(`stage solution\ncrystal s = Li+ Br- at bottom 2x1\nstep "녹아요"\n dissolve 2 from s`)[0];
    expect(r.dH).toBeNull();
    expect(r.missing).toEqual(['Br-', 'Li+']);
  });
  it('용매화·이동·노트는 변화 0이고, 바뀌지 않은 미지 이온도 상쇄한다', () => {
    expect(results(chapter('acid-hcl'))[2]).toEqual({ dH: 0, estimated: false, reliable: true, convention: false, missing: [], terms: [] });
    const r = results(`stage solution\nmol x = smiles:[CH3+] at center\nstep "그대로예요"\n wait`)[0];
    expect(r).toEqual({ dH: 0, estimated: false, reliable: true, convention: false, missing: [], terms: [] });
  });
  it('값 없는 이온은 결합 엔탈피로 어림하지 않고 null과 missing을 돌려준다', () => {
    const r = results(chapter('addition'));
    for (const k of [2, 4]) {
      expect(r[k].dH).toBeNull();
      expect(r[k].reliable).toBe(false);
      expect(r[k].why).toContain('표에 없는 물질');
      expect(r[k].missing).toEqual(['C2H5+']);
      expect(r[k].terms.some((t) => t.formula === 'C2H5+')).toBe(false);
    }
  });
  it('등록되지 않은 중성 분자는 실제 결합으로 어림하고 결과를 표시한다', () => {
    const t = timeline(`stage gas\nmol x = smiles:CCCCC at center\nstep "그대로예요"\n wait`);
    const r = stepEnthalpy(emptyWorld(), t.initial, t.stage);
    expect(formationEnthalpy('C5H12', 'g')).toBeNull();
    expect(r.dH).toBeCloseTo(5 * 716.68 + 12 * 217.998 - 12 * 413 - 4 * 347, 6);
    expect(r.estimated).toBe(true);
    expect(r.reliable).toBe(false);
  });
  it('지원하지 않는 결합과 생략 원자는 모름으로 남긴다', () => {
    const t = timeline(`stage gas\nmol x = smiles:[SiH3][SiH3] at center\nstep "그대로예요"\n wait`);
    expect(stepEnthalpy(emptyWorld(), t.initial, t.stage)).toMatchObject({ dH: null, missing: ['H6Si2'] });
    const atp = timeline(`stage solution\nmol x = ATP at center\nstep "그대로예요"\n wait`);
    expect(stepEnthalpy(emptyWorld(), atp.initial, atp.stage)).toMatchObject({ dH: null, missing: ['ATP'] });
  });
  it('기체와 물속을 구별하고 표의 다른 상을 몰래 쓰지 않는다', () => {
    const t = timeline(`stage interface\nmol c = CO2 at 330,120\nstep "물에 녹아요"\n gas-in c`);
    expect(stepEnthalpy(t.initial, t.steps[0].after, t.stage).dH).toBeCloseTo(-19.75, 6);
    expect(formationEnthalpy('CH3Br', 'aq')).toBeCloseTo(-60.0748341158, 6);
    expect(formationEnthalpy('C4H8N2O3', 'g')).toBeNull();
    expect(formationEnthalpy('C2H5OH', 'l')).toBeNull(); // formulaOf는 C2H6O이다.
    expect(formationEnthalpy('C2H6O', 'l')).toBe(-277.69);
  });
  it('둘레 물만 증발·동결하면 제외 규칙에 따라 0이다', () => {
    for (const id of ['evaporation', 'boiling', 'ice']) expect(results(chapter(id)).every((r) => r.dH === 0)).toBe(true);
  });
  it('입력 World를 바꾸지 않는다', () => {
    const t = timeline(chapter('neutralization')), s = t.steps[2];
    const before = cloneWorld(s.before), after = cloneWorld(s.after);
    stepEnthalpy(s.before, s.after, t.stage);
    expect(s.before).toEqual(before);
    expect(s.after).toEqual(after);
  });
  it('라이브러리 전부를 실제 화학식 키 또는 미확보 사유로 추적한다', () => {
    for (const name of LIBRARY.keys()) {
      const w = timeline(`stage solution\nmol m = ${name} at center\nstep "그대로예요"\n wait`).initial;
      const f = formulaOf(w, allComponents(w)[0]);
      expect(FORMATION_ENTHALPIES[f] ?? UNAVAILABLE_FORMATION_ENTHALPIES[f], `${name} → ${f}`).toBeDefined();
    }
    for (const phases of Object.values(FORMATION_ENTHALPIES)) for (const value of Object.values(phases)) {
      expect(Number.isFinite(value.value)).toBe(true);
      expect(value.source.length).toBeGreaterThan(10);
      expect(typeof value.checked).toBe('boolean');
    }
  });
  it('compare 목록을 빠뜨리지 않고 읽는다', () => {
    expect(compareScenes.length).toBe([...sceneArray.matchAll(/\bid:\s*'/g)].length);
    expect(compareScenes.length).toBeGreaterThan(0);
    for (const scene of compareScenes) expect(typeof scene.script).toBe('string');
    expect(lessons.length).toBeGreaterThan(0);
  });
});

describe('화면·교육 대본 전체를 예외 없이 계산한다', () => {
  for (const [group, scenes] of [['compare', compareScenes], ['chapters', CHAPTERS], ['examples', EXAMPLES], ['lessons', lessons]] as const) {
    for (const scene of scenes) it(`${group}/${scene.id}`, () => {
      const rows = results(scene.script);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.dH === null || Number.isFinite(row.dH)).toBe(true);
        expect(row.dH === null).toBe(row.missing.length > 0);
        expect(row.terms.every((t) => Number.isFinite(t.value) && t.change !== 0)).toBe(true);
        expect(typeof row.reliable).toBe('boolean');
        expect(row.reliable).toBe(row.why === undefined);
        if (row.estimated || row.dH === null) expect(row.reliable).toBe(false);
        if (row.dH !== null) expect(row.dH).toBeCloseTo(row.terms.reduce((s, t) => s + t.change * t.value, 0), 6);
      }
    });
  }
});
