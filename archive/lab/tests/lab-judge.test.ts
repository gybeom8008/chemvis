import { describe, expect, it, vi } from 'vitest';
import document from '../../docs/plan/lab-rows-stage1.md?raw';
import {
  CONTACT_ROWS, DEFAULT_ENVIRONMENT, DERIVED_ROWS, EVENTS, EVENT_BY_ID, MATERIALS,
  MATERIAL_BY_ID, MESSAGES, NEGATIVE_CERTIFICATES, NUMERIC_ROWS, SOURCE_ROWS, deriveStage1Numbers,
  type EventId, type SpeciesId,
} from '../../src/lab/stage1-data';
import {
  classifyContact, planEvent, unknownMessage, type AggregateSummary, type Environment,
  type MaterialRef, type PlannedResult, type SceneSummary,
} from '../../src/lab/judge';
import { compile, compileFrom } from '../../src/engine/compile';
import { formalCharge } from '../../src/engine/world';
import { getStage } from '../../src/stage/stages';

const env = DEFAULT_ENVIRONMENT;
const cells = (pattern: RegExp) => document.split(/\r?\n/).filter(line => pattern.test(line))
  .map(line => line.trim().slice(1, -1).split('|').map(cell => cell.trim()));
const section = (id: EventId) => document.split(`### ${id} — `)[1].split(/\n##/)[0];
const blocks = (id: EventId) => [...section(id).matchAll(/```text\r?\n([\s\S]*?)```/g)].map(m => m[1].trim());
const labelToId = new Map(MATERIALS.map(m => [m.label as string, m.id]));

function material(speciesId: SpeciesId, id = speciesId as string, overrides: Partial<MaterialRef> = {}): MaterialRef {
  const row = MATERIAL_BY_ID[speciesId];
  const atomIds = [id + '.center'];
  const donor = speciesId === 'hydronium' || speciesId === 'ammonium';
  for (let i = 1; i < row.atomCount; i++) atomIds.push(`${id}.${row.graphKind === 'ionic-crystal' ? 'Cl' : 'H' + i}`);
  return { instanceId: id, revision: 1, speciesId, phase: row.phase, charge: row.charge,
    structure: 'matched', atomIds, anchorAtomId: atomIds[0], location: 'active',
    ...(donor ? { transferableHydrogenIds: atomIds.slice(1) } : {}),
    ...(row.graphKind !== 'component' ? { aggregateId: id + '-solid', surface: 'reviewed' as const } : {}),
    ...overrides };
}
function scene(units: readonly MaterialRef[], overrides: Partial<SceneSummary> = {}): SceneSummary {
  const aggregates: AggregateSummary[] = [];
  for (const id of new Set(units.map(u => u.aggregateId).filter((id): id is string => !!id))) {
    const members = units.filter(u => u.aggregateId === id);
    const row = MATERIAL_BY_ID[members[0].speciesId as SpeciesId];
    aggregates.push({ aggregateId: id, kind: row.graphKind === 'metal' ? 'metal' : 'ionic-crystal',
      location: members[0].location as 'active' | 'shelf', surface: 'reviewed', members });
  }
  return { revision: 1, environment: env, particles: units.filter(u => !u.aggregateId), aggregates,
    capabilities: ['compile-from', 'selected-precipitation', 'metal-surface-v1'], freeBackgroundWaterCount: 12, ...overrides };
}
function planned(a: MaterialRef, b: MaterialRef, others: readonly MaterialRef[] = [], overrides: Partial<SceneSummary> = {}) {
  return planEvent(classifyContact(a, b, env), scene([a, b, ...others], overrides));
}
function ready(result: PlannedResult) {
  expect(result.kind).toBe('reacts');
  if (result.kind !== 'reacts' || result.readiness.kind !== 'preflight') throw new Error(JSON.stringify(result));
  return result.readiness.plan;
}

describe('3판 자료 전사', () => {
  it('수치·근거·유도값·재료·부정·120행의 셀을 원문과 그대로 대조한다', () => {
    expect(NUMERIC_ROWS.map(r => r.documentCells)).toEqual(cells(/^\| V\d\d /));
    expect(SOURCE_ROWS.map(r => r.documentCells)).toEqual(cells(/^\| S\d\d \|/));
    expect(DERIVED_ROWS.map(r => r.documentCells)).toEqual(cells(/^\| C\d\d /));
    expect(NEGATIVE_CERTIFICATES.map(r => r.documentCells)).toEqual(cells(/^\| N\d\d \|/));
    expect(CONTACT_ROWS.map(r => r.documentCells)).toEqual(cells(/^\| T\d{3} \|/));
    for (const row of MATERIALS) expect(row.documentCells).toEqual(cells(new RegExp(`^\\| ${row.id} \\|`))[0]);
    expect([MATERIALS.length, NUMERIC_ROWS.length, SOURCE_ROWS.length, DERIVED_ROWS.length, EVENTS.length]).toEqual([15, 8, 8, 15, 8]);
    expect(Object.isFrozen(CONTACT_ROWS[0].pair)).toBe(true);
  });
  it('기계가 쓰는 값과 출처도 보관한 원문 셀에 대응한다', () => {
    for (const row of NUMERIC_ROWS) {
      expect([row.printedValue, row.unit, row.definition, row.locator, row.authorReadingNote])
        .toEqual([row.documentCells[1], row.documentCells[2], row.documentCells[3], row.documentCells[5], row.documentCells[6]]);
      expect(row.documentCells[4]).toContain(`(${row.sourceUrl})`);
    }
    for (const row of DERIVED_ROWS) {
      expect([row.formula, row.resultAndUnit, row.definition, row.sourceText]).toEqual(row.documentCells.slice(1, 5));
    }
    for (const row of NEGATIVE_CERTIFICATES) {
      expect([row.scope, row.title, row.detail]).toEqual(row.documentCells.slice(1));
    }
  });
  it('120개 쌍은 빠짐·중복 없이 8/13/99이며 draft를 보존한다', () => {
    const pairs = CONTACT_ROWS.map(r => [...r.pair].sort().join('|'));
    const expected = MATERIALS.flatMap((a, i) => MATERIALS.slice(i).map(b => [a.id, b.id].sort().join('|')));
    expect(pairs.slice().sort()).toEqual(expected.sort());
    expect(new Set(CONTACT_ROWS.map(r => r.id)).size).toBe(120);
    expect(['reacts', 'no-reaction', 'unknown'].map(kind => CONTACT_ROWS.filter(r => r.kind === kind).length)).toEqual([8, 13, 99]);
    for (const row of [...MATERIALS, ...NUMERIC_ROWS, ...SOURCE_ROWS, ...DERIVED_ROWS, ...EVENTS, ...NEGATIVE_CERTIFICATES, ...CONTACT_ROWS]) {
      expect(row.review).toEqual({ status: 'draft', reviewer: null });
      expect(row.conditions).toEqual({ medium: 'water', temperatureC: 25, activityPresets: ['ordinary'], excitation: 'none', activityRange: [1e-3, 1e-2] });
    }
  });
  it.each(EVENTS)('$id의 제목·자세히·대본·허용 맥락은 문서와 같다', event => {
    const s = section(event.id);
    expect(s).toContain(`“${event.title}”`);
    expect(s).toContain(`- 자세히: “${event.detail}”`);
    expect(event.template).toBe(blocks(event.id).filter(b => b.startsWith('step '))[0]);
    const context = cells(new RegExp(`^\\| ${event.id} \\|`)).find(r => r.length === 3 && r[1].includes('H₂O'))!;
    expect(event.contextDocumentCells).toEqual(context);
    expect(event.allowedContextSpecies).toEqual(context[1].split(',').map(s => labelToId.get(s.trim())));
    if (event.id === 'P01') expect(event.ontoTemplate).toBe(blocks(event.id)[1]);
  });
  it('C01–C15를 계산하고 인쇄한 정밀도에서 비교한다', () => {
    const n = deriveStage1Numbers();
    expect(NUMERIC_ROWS.map(r => r.value)).toEqual([1e-14, 1.8e-5, 1.6e-10, .7996, .337, -.7618, 8.314462618, 96485.33212]);
    expect(n.C01.pKw).toBe(14);
    expect(n.C02.ka).toBeCloseTo(5.5556e-10, 14);
    expect(n.C02.pKa).toBeCloseTo(9.2552725, 7);
    expect(n.C03.logK).toBe(14);
    expect(n.C04.logK).toBeCloseTo(9.2552725, 7);
    expect(n.C05.logK).toBeCloseTo(4.7447275, 7);
    n.C06.ratio.forEach((x, i) => expect(x).toBeCloseTo([6250, 625000][i], 6));
    expect(n.C07.logK).toBeCloseTo(9.7958800, 7);
    expect(n.C08.b).toBeCloseTo(.0591593497, 10);
    expect(n.C08.roundedB).toBe(.05916);
    for (const [actual, expected] of [
      [n.C09.e, [1.06922, 1.12838]], [n.C10.e, [1.44308, 1.53182]], [n.C11.e, [.34428, .43302]],
      [n.C12.e, [-1.12838, -1.06922]], [n.C13.e, [-1.53182, -1.44308]], [n.C14.e, [-.43302, -.34428]],
    ]) actual.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 5));
    [n.C09.logK, n.C10.logK, n.C11.logK].forEach((x, i) => expect(x).toBeCloseTo([37.1471, 52.7862, 15.6391][i], 4));
    expect(n.C15.q).toEqual([10, 1e4]);
    expect(n.C15.kOverQ[0]).toBeCloseTo(5.5556, 4);
    expect(n.C15.kOverQ[1]).toBeCloseTo(5555.56, 2);
  });
});

describe('120행 전체의 양방향 접촉 판정', () => {
  // 기대값은 코드 자료가 아니라 문서의 결과 열에서 별도로 읽는다.
  it.each(cells(/^\| T\d{3} \|/))('%s: %s / %s', (id, labelA, labelB, expected, detail) => {
    const a = material(labelToId.get(labelA)!, 'a');
    const b = material(labelToId.get(labelB)!, 'b');
    const code = expected.split(' · ')[1].replaceAll('`', '');
    for (const [x, y] of [[a, b], [b, a]]) {
      const candidate = classifyContact(x, y, env);
      expect(candidate).toMatchObject({ rowId: id });
      if (expected.startsWith('양성')) expect(candidate).toMatchObject({ kind: 'reacts', eventId: code });
      else if (expected.startsWith('검토')) expect(candidate).toMatchObject({ kind: 'no-reaction', certificateId: code });
      else expect(candidate).toMatchObject({ kind: 'unknown', reason: code, detail: `${MESSAGES.detailPrefix} ${detail}` });
      const final = planEvent(candidate, scene([a, b]));
      expect(final.kind).toBe(candidate.kind);
      if (candidate.kind === 'unknown') expect(final).toMatchObject({ reason: candidate.reason });
      if (candidate.kind === 'no-reaction') expect(final).toMatchObject({ certificateId: candidate.certificateId });
    }
  });
});

describe('조건과 현재 구조의 경계', () => {
  const patches: [Partial<Environment>, string][] = [
    [{ medium: 'gas' }, 'ENV_UNSUPPORTED'], [{ medium: 'unspecified' }, 'CONDITION_MISSING'],
    [{ temperatureC: 80 }, 'ENV_UNSUPPORTED'], [{ temperatureC: 24.99 }, 'ENV_UNSUPPORTED'],
    [{ temperatureC: NaN }, 'ENV_UNSUPPORTED'], [{ temperatureC: undefined }, 'CONDITION_MISSING'],
    [{ activityPreset: 'veryDilute' }, 'ENV_UNSUPPORTED'], [{ activityPreset: 'unspecified' }, 'CONDITION_MISSING'],
    [{ excitation: 'heated' }, 'ENV_UNSUPPORTED'], [{ excitation: 'irradiated' }, 'ENV_UNSUPPORTED'],
    [{ excitation: 'unknown' }, 'ENV_UNSUPPORTED'], [{ excitation: undefined }, 'CONDITION_MISSING'],
  ];
  it.each(patches)('지원 조건 밖 %j는 %s다', (patch, reason) => {
    // 양성뿐 아니라 부정 인증에도 조건을 적용한다.
    for (const row of CONTACT_ROWS) {
      const a = material(row.pair[0], 'a'); const b = material(row.pair[1], 'b');
      expect(classifyContact(a, b, { ...env, ...patch })).toMatchObject({ kind: 'unknown', reason, title: MESSAGES.condition });
    }
  });
  it('빠진 환경과 미지원 구조를 양성이나 부정으로 바꾸지 않는다', () => {
    const a = material('hydronium'); const b = material('hydroxide');
    expect(classifyContact(a, b, {})).toMatchObject({ kind: 'unknown', reason: 'CONDITION_MISSING' });
    expect(classifyContact({ ...a, structure: 'unreviewed' }, b, env)).toMatchObject({ reason: 'SPECIES_UNREVIEWED' });
    expect(classifyContact({ ...a, speciesId: 'CH4' }, { ...b, speciesId: 'O2' }, env)).toMatchObject({ reason: 'SPECIES_UNREVIEWED' });
    for (const pair of [[{ ...a, speciesId: 'HCl', phase: 'aq', charge: 0 }, b], [b, { ...a, speciesId: 'HCl', phase: 'aq', charge: 0 }]]) {
      expect(classifyContact(pair[0], pair[1], env)).toMatchObject({ reason: 'SPECIATION_UNSUPPORTED' });
    }
    expect(classifyContact({ ...a, phase: 'gas' }, b, env)).toMatchObject({ reason: 'SITE_UNREVIEWED' });
    expect(classifyContact({ ...a, charge: 0 }, b, env)).toMatchObject({ reason: 'SITE_UNREVIEWED' });
    expect(classifyContact({ ...a, selectedHydrogenId: 'fake.H4' }, b, env)).toMatchObject({ reason: 'SITE_UNREVIEWED' });
  });
  it('조작 오류를 화학적 부정으로 표시하지 않는다', () => {
    const a = material('water'); const b = material('water', 'b');
    expect(classifyContact(a, a, env)).toMatchObject({ kind: 'input-error', reason: 'SAME_TARGET' });
    expect(classifyContact({ ...a, structure: 'invalid' }, b, env)).toMatchObject({ kind: 'input-error', reason: 'INVALID_INPUT' });
    expect(classifyContact({ ...a, location: 'background' }, b, env)).toMatchObject({ kind: 'input-error', reason: 'UNAVAILABLE_TARGET' });
    expect(classifyContact({ ...a, revision: 2 }, b, env)).toMatchObject({ kind: 'input-error', reason: 'STALE_CANDIDATE' });
  });
  it('네 묶음의 모름 문장을 그대로 쓴다', () => {
    expect(unknownMessage('EQUILIBRIUM_REQUIRED')).toBe('얼마나 반응하는지는 계산하지 않아요.');
    expect(unknownMessage('CONDITION_BORDERLINE')).toBe('이 조건에서는 판단할 수 없어요.');
    expect(unknownMessage('COMPETING_PATHWAYS')).toBe('함께 있는 재료 때문에 판단할 수 없어요.');
    expect(unknownMessage('SITE_UNREVIEWED')).toBe('아직 이 조합은 판단할 수 없어요.');
  });
  it('같은 쌍에 양성·부정 행을 주입하면 임의로 우선순위를 정하지 않는다', async () => {
    vi.resetModules();
    vi.doMock('../../src/lab/stage1-data', async importOriginal => {
      const actual = await importOriginal<typeof import('../../src/lab/stage1-data')>();
      return { ...actual, CONTACT_ROWS: [...actual.CONTACT_ROWS, {
        id: 'TEST-CONFLICT', pair: ['hydronium', 'hydroxide'], kind: 'no-reaction', certificateId: 'N07', detail: '',
      }] };
    });
    try {
      const isolated = await import('../../src/lab/judge');
      expect(isolated.classifyContact(material('hydronium'), material('hydroxide'), env))
        .toMatchObject({ kind: 'execution-failure', reason: 'RULE_CONFLICT', title: MESSAGES.executionFailure });
    } finally {
      vi.doUnmock('../../src/lab/stage1-data');
      vi.resetModules();
    }
  });
});

describe('활성 무대 맥락과 경쟁 경로', () => {
  it.each(EVENTS)('$id에서 허용 종은 유지하고 목록 밖 종은 막는다', event => {
    const a = material(event.requirements[0].speciesId, 'a');
    const b = material(event.requirements[1].speciesId, 'b');
    const second = event.requirements[1].count === 2 ? [material('silver-ion', 'second', { distancePx: 10 })] : [];
    for (const row of MATERIALS) {
      const extra = material(row.id, 'extra');
      const result = planned(a, b, [...second, extra]);
      if ((event.competingSpecies as readonly string[]).includes(row.id)) expect(result).toMatchObject({ kind: 'unknown', reason: 'COMPETING_PATHWAYS' });
      else if (!(event.allowedContextSpecies as readonly string[]).includes(row.id)) expect(result).toMatchObject({ kind: 'unknown', reason: 'CONTEXT_UNREVIEWED' });
      else expect(ready(result).eventId).toBe(event.id);
    }
  });
  it.each(NEGATIVE_CERTIFICATES)('$id의 좁은 부정을 제3 재료로 확대하지 않는다', cert => {
    const a = material(cert.pair[0], 'a'); const b = material(cert.pair[1], 'b');
    for (const row of MATERIALS) {
      const result = planned(a, b, [material(row.id, 'extra')]);
      if ((cert.allowedContextSpecies as readonly string[]).includes(row.id)) expect(result).toMatchObject({ kind: 'no-reaction', certificateId: cert.id });
      else expect(result).toMatchObject({ kind: 'unknown', reason: 'CONTEXT_UNREVIEWED' });
    }
  });
  it('R01 뒤 조각 속 Zn 다섯 개를 포함해 R03을 막는다', () => {
    const cu = material('copper-metal', 'cu', { aggregateId: 'm' });
    const zn = Array.from({ length: 5 }, (_, i) => material('zinc-metal', `zn${i}`, { aggregateId: 'm' }));
    const a1 = material('silver-ion', 'a1'); const a2 = material('silver-ion', 'a2', { distancePx: 30 });
    const zincIon = material('zinc-ion');
    expect(planned(cu, a1, [...zn, a2, zincIon])).toMatchObject({ kind: 'unknown', reason: 'COMPETING_PATHWAYS' });
    expect(ready(planned(cu, a1, [a2, zincIon])).eventId).toBe('R03');
    const separateZn = zn.map(m => ({ ...m, aggregateId: 'shelf-metal', location: 'shelf' as const }));
    expect(ready(planned(cu, a1, [a2, zincIon, ...separateZn])).eventId).toBe('R03');
  });
  it('R01 수용체 경쟁과 R02 공여체·수용체 경쟁은 부족보다 먼저다', () => {
    const zn = material('zinc-metal'); const cuIon = material('copper-ion'); const ag = material('silver-ion');
    expect(planned(zn, cuIon, [ag])).toMatchObject({ reason: 'COMPETING_PATHWAYS' });
    expect(planned(zn, ag, [cuIon])).toMatchObject({ reason: 'COMPETING_PATHWAYS' });
    expect(planned(zn, ag, [material('copper-metal')])).toMatchObject({ reason: 'COMPETING_PATHWAYS' });
  });
  it('착물·피막·묽기 밖 배경을 추측해 무시하지 않는다', () => {
    const a = material('silver-ion'); const b = material('chloride');
    expect(planned(a, b, [material('ammonia')])).toMatchObject({ reason: 'CONTEXT_UNREVIEWED' });
    expect(planned(a, b, [material('hydroxide')])).toMatchObject({ reason: 'CONTEXT_UNREVIEWED' });
    expect(planned(a, b, [material('chloride', 'br', { speciesId: 'bromide' })])).toMatchObject({ reason: 'CONTEXT_UNREVIEWED' });
    expect(planned(a, b, [], { backgroundEffects: ['unknown-film'] })).toMatchObject({ reason: 'CONTEXT_UNREVIEWED' });
    expect(ready(planned(a, b, [material('ammonia', 'shelf', { location: 'shelf' })])).eventId).toBe('P01');
    expect(planned(material('sodium-chloride'), material('water'), [a])).toMatchObject({ reason: 'CONTEXT_UNREVIEWED' });
    expect(classifyContact(material('sodium-chloride'), a, env)).toMatchObject({ reason: 'NO_REVIEWED_RULE' });
  });
});

describe('한 사건 재고 예약과 단계 1에 해당하는 설계서 10절 사례', () => {
  it.each(['zinc-metal', 'copper-metal'] as const)('%s + Ag⁺ 하나는 부족이고 두 번째가 가까워야 예약한다', donor => {
    const m = material(donor); const a1 = material('silver-ion', 'a1');
    const missing = planned(m, a1);
    expect(missing).toMatchObject({ kind: 'reacts', readiness: { kind: 'needs-material', missing: [{ speciesId: 'silver-ion', count: 1, message: 'Ag⁺ 1개가 더 필요해요' }] } });
    const a2 = material('silver-ion', 'a2', { distancePx: 121 });
    expect(planned(m, a1, [a2])).toMatchObject({ readiness: { kind: 'needs-material', missing: [{ bringInstanceIds: ['a2'] }] } });
    for (const overrides of [{ distancePx: undefined }, { location: 'shelf' as const }, { available: false }]) {
      expect(planned(m, a1, [{ ...a2, distancePx: 1, ...overrides }])).toMatchObject({ readiness: { kind: 'needs-material' } });
    }
    const p = ready(planned(m, a1, [{ ...a2, distancePx: 120 }]));
    expect(p.reservations[1].instanceIds).toEqual(['a1', 'a2']);
    expect(p.electronTransfers).toBe(2);
  });
  it('선택한 Ag⁺를 우선하고 거리·AtomId 순으로 하나만 더 예약한다', () => {
    const m = material('zinc-metal', 'm');
    const chosen = material('silver-ion', 'chosen');
    const extras = [material('silver-ion', 'z', { distancePx: 20 }), material('silver-ion', 'a', { distancePx: 20 }), material('silver-ion', 'far', { distancePx: 50 }), material('zinc-metal', 'm2'), material('zinc-metal', 'm3')];
    const p = ready(planned(chosen, m, extras));
    expect(p.reservations.map(r => r.instanceIds)).toEqual([['m'], ['chosen', 'a']]);
    expect(p.extent).toBe('one-stoichiometric-event');
    expect(p.canExecute).toBe(false);
    expect(p.review.status).toBe('draft');
    expect(p.expectedProducts.map(x => x.speciesId)).toEqual(['zinc-ion', 'silver-metal', 'silver-metal']);
    expect(p.expectedProducts.map(x => x.atomIds)).toEqual([['m.center'], ['chosen.center'], ['a.center']]);
    expect(p.unchangedAtomIds).toEqual(expect.arrayContaining(['m2.center', 'm3.center', 'z.center', 'far.center']));
    expect(Object.isFrozen(p.expectedProducts[0].atomIds)).toBe(true);
  });
  it('P01은 고른 a3만 예약하고 onto 대상은 순수한 활성 AgCl이다', () => {
    const a3 = material('silver-ion', 'a3'); const b = material('chloride', 'b');
    const other = [material('silver-ion', 'a1'), material('silver-ion', 'a2')];
    expect(ready(planned(a3, b, other)).reservations.map(r => r.instanceIds)).toEqual([['a3'], ['b']]);
    const s1 = material('silver-chloride', 's1'); const s2 = material('silver-chloride', 's2');
    const result = planned(a3, b, [...other, s1, s2], { aggregateDistancesPx: { 's1-solid': 50, 's2-solid': 10 } });
    expect(ready(result).ontoAggregateId).toBe('s2-solid');
    expect(result).toMatchObject({ title: '염화 은 고체가 커졌어요.' });
    expect(ready(planned(a3, b, [s1, s2], { ontoAggregateId: 's1-solid' })).ontoAggregateId).toBe('s1-solid');
    expect(planned(a3, b, [], { ontoAggregateId: 'absent' })).toMatchObject({ kind: 'execution-failure', reason: 'REPRESENTATION_UNAVAILABLE' });
    expect(planned(a3, b, [], { ontoAggregateId: 'empty', aggregates: [{ aggregateId: 'empty', kind: 'ionic-crystal', members: [], location: 'active', surface: 'reviewed' }] })).toMatchObject({ kind: 'execution-failure' });
    for (const wrong of [material('sodium-chloride'), material('zinc-metal')]) {
      expect(planned(a3, b, [wrong], { ontoAggregateId: wrong.aggregateId }).kind).not.toBe('reacts');
    }
  });
  it('D01의 물은 손잡이이며 생성 Cl⁻는 Na⁺와 함께 P01에 다시 쓸 수 있다', () => {
    const p = ready(planned(material('sodium-chloride'), material('water')));
    expect(p.reservations.find(r => r.speciesId === 'water')).toMatchObject({ consumed: false, instanceIds: ['water'] });
    expect(ready(planned(material('silver-ion'), material('chloride'), [material('sodium-ion')])).eventId).toBe('P01');
    expect(planned(material('water', 'w1'), material('water', 'w2'))).toMatchObject({ reason: 'EQUILIBRIUM_REQUIRED' });
    expect(planned(material('silver-chloride'), material('water'))).toMatchObject({ reason: 'EQUILIBRIUM_REQUIRED' });
  });
  it('A02의 H3와 이어진 A05의 원래 a.H1을 이름 변경 없이 예약한다', () => {
    const a = material('hydronium', 'a', { selectedHydrogenId: 'a.H3' }); const b = material('ammonia', 'b');
    expect(ready(planned(a, b)).atomRoles.hydrogen).toBe('a.H3');
    const ammonium = material('ammonium', 'new-b', { atomIds: ['b.N', 'b.H1', 'b.H2', 'b.H3', 'a.H1'], anchorAtomId: 'b.N',
      transferableHydrogenIds: ['b.H1', 'b.H2', 'b.H3', 'a.H1'], selectedHydrogenId: 'a.H1' });
    const p = ready(planned(ammonium, material('hydroxide', 'c'), [material('water', 'old-water')]));
    expect(p.atomRoles).toEqual({ donor: 'b.N', hydrogen: 'a.H1', acceptor: 'c.center' });
    expect(p.expectedProducts.map(x => x.atomIds)).toEqual([['b.N', 'b.H1', 'b.H2', 'b.H3'], ['c.center', 'c.H1', 'a.H1']]);
    const reverse = ready(planned(b, a));
    expect(reverse.atomRoles).toEqual(ready(planned(a, b)).atomRoles);
  });
  it('오래된 후보·중복 참조·빠진 기능은 상태를 바꾸지 않는다', () => {
    const a = material('silver-ion'); const b = material('chloride');
    const c = classifyContact(a, b, env); const s = scene([a, b]);
    const before = JSON.stringify({ a, b, s });
    expect(planEvent(c, { ...s, revision: 2 })).toMatchObject({ kind: 'input-error', reason: 'STALE_CANDIDATE' });
    expect(planEvent(c, { ...s, particles: [a] })).toMatchObject({ reason: 'STALE_CANDIDATE' });
    expect(planEvent(c, { ...s, environment: { ...env, temperatureC: 80 } })).toMatchObject({ reason: 'STALE_CANDIDATE' });
    expect(planEvent(c, { ...s, particles: [a, b, a] })).toMatchObject({ reason: 'INVALID_INPUT' });
    expect(planEvent(c, { ...s, capabilities: ['compile-from'] })).toMatchObject({ kind: 'execution-failure', reason: 'REPRESENTATION_UNAVAILABLE', title: MESSAGES.executionFailure });
    expect(planEvent(c, s)).toEqual(planEvent(c, s));
    expect(JSON.stringify({ a, b, s })).toBe(before);
    expect(Object.isFrozen(a)).toBe(false);
  });
  it('금속 표현 기능과 자유 배경 물이 없으면 실행 검사를 통과시키지 않는다', () => {
    const a = material('zinc-metal'); const b = material('copper-ion');
    expect(planned(a, b, [], { capabilities: ['compile-from'] })).toMatchObject({ kind: 'execution-failure' });
    expect(planned(a, b, [material('water')], { freeBackgroundWaterCount: 0 })).toMatchObject({ kind: 'execution-failure' });
  });
});

describe('엔진과 연결할 원본 대본 계약', () => {
  const headers: Record<EventId, string> = {
    A01: 'mol a = H3O+ at 280,260\nmol b = OH- at 500,300',
    A02: 'mol a = H3O+ at 280,260\nmol b = NH3 at 500,300',
    A05: 'mol n = NH4+ at 280,260\nmol o = OH- at 500,300',
    P01: 'mol a = Ag+ at 300,260\nmol b = Cl- at 500,300',
    D01: 'crystal s = NaCl at bottom 2x1\nmol w = H2O at 220,260',
    R01: EVENT_BY_ID.R01.fixtureHeader, R02: EVENT_BY_ID.R02.fixtureHeader, R03: EVENT_BY_ID.R03.fixtureHeader,
  };
  it.each(EVENTS)('$id은 compileFrom으로 컴파일되고 base를 보존한다', event => {
    const fixture = compile(`stage solution\n${headers[event.id]}`);
    expect(fixture.errors).toEqual([]);
    const base = fixture.timeline!.initial;
    const saved = structuredClone(base);
    const result = compileFrom(base, getStage('solution')!, event.template);
    expect(result.errors).toEqual([]);
    expect(result.end).not.toBeNull();
    expect(base).toEqual(saved);
  });
  it.each(MATERIALS)('$id의 엔진 화학식과 상별 생성 방식은 유효하다', row => {
    const header = row.graphKind === 'metal' ? `metal m = ${row.engineFormula} at 420,330 3x2`
      : row.graphKind === 'ionic-crystal' ? `crystal s = ${row.engineFormula} at bottom 2x1`
      : `mol x = ${row.engineFormula} at 300,260`;
    const result = compile(`stage solution\n${header}`);
    expect(result.errors).toEqual([]);
    const world = result.timeline!.initial;
    const atoms = [...world.atoms.values()].filter(a => !a.crowd);
    const copies = row.graphKind === 'metal' ? 6 : 1;
    expect(atoms.length).toBe(row.atomCount * copies);
    expect(atoms.reduce((s, a) => s + formalCharge(world, a), 0)).toBe(row.charge * copies);
    const bonds = [...world.bonds.values()].filter(b => !world.atoms.get(b.a)!.crowd && !world.atoms.get(b.b)!.crowd);
    expect(atoms.reduce((s, a) => s + 2 * a.lp + a.rad, 0) + bonds.reduce((s, b) => s + 2 * b.order, 0)).toBe(row.modelElectrons * copies);
  });
});
