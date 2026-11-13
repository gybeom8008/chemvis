/** 무대와 엔진을 바꾸지 않는 단계 1 접촉 판정·예약 계획이다. */
import {
  CONTACT_ROWS, DATA_VERSION, EVENT_BY_ID, MATERIAL_BY_ID, MESSAGES,
  NEGATIVE_CERTIFICATES, REVIEW, deriveStage1Numbers, freezeData,
  type CertificateId, type ContactRow, type EventId, type Phase, type SpeciesId,
} from './stage1-data';

export interface Environment {
  readonly medium?: string;
  readonly temperatureC?: number;
  readonly activityPreset?: string;
  readonly excitation?: string;
}

/** 한 분자, 자유 이온, 결정 한 화학식 단위, 금속 표면 원자 하나다.
 * structure와 수소 목록은 연결 계층이 현재 그래프를 대조한 결과다. owner로 만들지 않는다. */
export interface MaterialRef {
  readonly instanceId: string;
  readonly revision: number;
  readonly speciesId: string;
  readonly phase: string;
  readonly charge: number;
  readonly structure: 'matched' | 'unreviewed' | 'invalid';
  readonly atomIds: readonly string[];
  readonly anchorAtomId: string;
  readonly location: 'active' | 'shelf' | 'background';
  readonly aggregateId?: string;
  readonly surface?: 'reviewed' | 'unreviewed';
  readonly transferableHydrogenIds?: readonly string[];
  readonly selectedHydrogenId?: string;
  readonly available?: boolean;
  /** 추가 재료와 접촉 자리 사이 CSS px 거리다. 실제 분자 사이 거리가 아니다. */
  readonly distancePx?: number;
}

export type UnknownReason =
  | 'SPECIES_UNREVIEWED' | 'SPECIATION_UNSUPPORTED' | 'SITE_UNREVIEWED' | 'NO_REVIEWED_RULE'
  | 'ENV_UNSUPPORTED' | 'CONDITION_MISSING' | 'CONDITION_BORDERLINE'
  | 'CONTEXT_UNREVIEWED' | 'COMPETING_PATHWAYS' | 'EQUILIBRIUM_REQUIRED';
export type FailureReason = 'RULE_CONFLICT' | 'REPRESENTATION_UNAVAILABLE';
export type InputErrorReason = 'INVALID_INPUT' | 'SAME_TARGET' | 'STALE_CANDIDATE' | 'UNAVAILABLE_TARGET';

interface Explanation { readonly title: string; readonly detail: string; readonly rowId?: string }
export type Unknown = Explanation & { readonly kind: 'unknown'; readonly reason: UnknownReason };
export type Failure = Explanation & { readonly kind: 'execution-failure'; readonly reason: FailureReason };
export type InputError = { readonly kind: 'input-error'; readonly reason: InputErrorReason };
export type Negative = Explanation & { readonly kind: 'no-reaction'; readonly certificateId: CertificateId };
export interface ContactSnapshot {
  readonly a: MaterialRef;
  readonly b: MaterialRef;
  readonly environment: Environment;
}
type ContactVerdict = Unknown | Failure | InputError | Negative | (Explanation & {
  readonly kind: 'reacts'; readonly eventId: EventId;
  readonly readiness: { readonly kind: 'needs-scene' };
});
export type ContactResult = ContactVerdict & { readonly contact: ContactSnapshot };

export interface AggregateSummary {
  readonly aggregateId: string;
  readonly kind: 'metal' | 'ionic-crystal';
  readonly location: 'active' | 'shelf';
  readonly surface: 'reviewed' | 'unreviewed';
  /** 선택한 표면뿐 아니라 몸체의 모든 실제 재고를 넣는다. 빈 결정은 빈 배열이다. */
  readonly members: readonly MaterialRef[];
}
export interface SceneSummary {
  readonly revision: number;
  readonly environment: Environment;
  /** 고체 구성원은 aggregates에만 넣는다. 배경 물은 재고로 쓰지 않는다. */
  readonly particles: readonly MaterialRef[];
  readonly aggregates: readonly AggregateSummary[];
  readonly capabilities: readonly string[];
  readonly backgroundEffects?: readonly string[];
  /** P01의 명시적 드롭 대상이다. 없으면 거리·안정 ID 순으로 같은 고체를 찾는다. */
  readonly ontoAggregateId?: string;
  readonly aggregateDistancesPx?: Readonly<Record<string, number>>;
  /** 자유 배경 물이 있어야 금속에서 나온 이온을 수화할 수 있다. */
  readonly freeBackgroundWaterCount?: number;
}

export interface Reservation {
  readonly speciesId: SpeciesId;
  readonly instanceIds: readonly string[];
  readonly atomIds: readonly string[];
  readonly consumed: boolean;
}
export interface EventPlan {
  readonly eventId: EventId;
  readonly rowId: string;
  readonly inputRevision: number;
  readonly dataVersion: string;
  readonly environment: Environment;
  readonly reservations: readonly Reservation[];
  readonly atomRoles: Readonly<Record<string, string>>;
  readonly expectedProducts: readonly {
    readonly speciesId: SpeciesId;
    readonly phase: Phase;
    readonly atomIds: readonly string[];
    /** 새 침전은 effects가 이름을 줄 때까지 aggregateId를 만들지 않는다. */
    readonly aggregateId?: string;
  }[];
  readonly unchangedAtomIds: readonly string[];
  readonly ontoAggregateId?: string;
  readonly electronTransfers: number;
  readonly extent: 'one-stoichiometric-event';
  readonly review: typeof REVIEW;
  /** 아직 원자 매핑·보존·컴파일·끝 상태 대조를 하지 않았다. */
  readonly canExecute: false;
}
export type PlannedResult = Unknown | Failure | InputError | Negative | (Explanation & {
  readonly kind: 'reacts'; readonly eventId: EventId;
  readonly readiness:
    | { readonly kind: 'needs-material'; readonly missing: readonly {
      readonly speciesId: SpeciesId; readonly count: number; readonly bringInstanceIds: readonly string[]; readonly message: string;
    }[] }
    | { readonly kind: 'preflight'; readonly plan: EventPlan };
});

const withPrefix = (detail: string) => `${MESSAGES.detailPrefix} ${detail}`;
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const species = (id: string) => Object.hasOwn(MATERIAL_BY_ID, id) ? MATERIAL_BY_ID[id as SpeciesId] : undefined;
const key = (a: string, b: string) => [a, b].sort().join('|');
const pairRows = new Map<string, ContactRow[]>();
for (const row of CONTACT_ROWS) {
  const k = key(row.pair[0], row.pair[1]);
  pairRows.set(k, [...(pairRows.get(k) ?? []), row]);
}

export function unknownMessage(reason: UnknownReason): string {
  if (reason === 'EQUILIBRIUM_REQUIRED') return MESSAGES.equilibrium;
  if (reason === 'CONTEXT_UNREVIEWED' || reason === 'COMPETING_PATHWAYS') return MESSAGES.context;
  if (reason === 'ENV_UNSUPPORTED' || reason === 'CONDITION_MISSING' || reason === 'CONDITION_BORDERLINE') return MESSAGES.condition;
  return MESSAGES.unreviewed;
}
const unknown = (reason: UnknownReason, detail = '', rowId?: string): Unknown => ({
  kind: 'unknown', reason, title: unknownMessage(reason), detail: withPrefix(detail || unknownMessage(reason)), rowId,
});
const failure = (reason: FailureReason, rowId?: string): Failure => ({
  kind: 'execution-failure', reason, title: MESSAGES.executionFailure, detail: withPrefix(MESSAGES.executionFailure), rowId,
});
const inputError = (reason: InputErrorReason): InputError => ({ kind: 'input-error', reason });

function invalidRef(m: MaterialRef): boolean {
  const row = species(m.speciesId);
  return !m.instanceId || !Number.isSafeInteger(m.revision) || m.revision < 0 ||
    !m.speciesId || !m.phase || !Number.isInteger(m.charge) || m.structure === 'invalid' ||
    !m.atomIds.length || m.atomIds.some(id => !id) || new Set(m.atomIds).size !== m.atomIds.length ||
    !m.atomIds.includes(m.anchorAtomId) ||
    (m.structure === 'matched' && !!row && m.atomIds.length !== row.atomCount) ||
    new Set(m.transferableHydrogenIds ?? []).size !== (m.transferableHydrogenIds ?? []).length ||
    (m.transferableHydrogenIds ?? []).some(id => !m.atomIds.includes(id) || id === m.anchorAtomId) ||
    (m.distancePx !== undefined && (!Number.isFinite(m.distancePx) || m.distancePx < 0));
}

function environmentReason(env: Environment): UnknownReason | undefined {
  // 기본 환경 경계가 묽기 미지정보다 먼저다.
  if ((env.medium !== undefined && env.medium !== 'water' && env.medium !== 'unspecified') ||
    (env.temperatureC !== undefined && env.temperatureC !== 25) ||
    (env.excitation !== undefined && env.excitation !== 'none')) return 'ENV_UNSUPPORTED';
  if (!env.medium || env.medium === 'unspecified' || env.temperatureC === undefined ||
    !env.activityPreset || env.activityPreset === 'unspecified' || !env.excitation) return 'CONDITION_MISSING';
  return env.activityPreset === 'ordinary' ? undefined : 'ENV_UNSUPPORTED';
}

function identityReason(m: MaterialRef): UnknownReason | undefined {
  if ((m.speciesId === 'HCl' || m.speciesId === 'hydrogen-chloride') && m.phase === 'aq' && m.charge === 0) return 'SPECIATION_UNSUPPORTED';
  const row = species(m.speciesId);
  if (!row || m.structure !== 'matched') return 'SPECIES_UNREVIEWED';
  if (m.phase !== row.phase || m.charge !== row.charge) return 'SITE_UNREVIEWED';
  if (row.graphKind !== 'component' && (!m.aggregateId || m.surface !== 'reviewed')) return 'SITE_UNREVIEWED';
  if (row.graphKind === 'component' && m.aggregateId) return 'SITE_UNREVIEWED';
  return undefined;
}

function directionSupported(id: EventId): boolean {
  const n = deriveStage1Numbers();
  switch (id) {
    case 'A01': return n.C03.logK >= 4;
    case 'A02': return n.C04.logK >= 4;
    case 'A05': return n.C05.logK >= 4 && n.C15.kOverQ[0] > 1;
    case 'P01': return n.C06.ratio[0] >= 100;
    case 'R01': return n.C09.e[0] >= 0.2;
    case 'R02': return n.C10.e[0] >= 0.2;
    case 'R03': return n.C11.e[0] >= 0.2;
    case 'D01': return true; // S01·S03의 정성 근거다. 가짜 Ksp를 만들지 않는다.
  }
}

/** 조건부 후보다. 이 반환값만으로 화면에 최종 양성·부정을 표시하지 않는다. */
export function classifyContact(a: MaterialRef, b: MaterialRef, env: Environment): ContactResult {
  const contact: ContactSnapshot = {
    a: { ...a, atomIds: [...a.atomIds], transferableHydrogenIds: a.transferableHydrogenIds && [...a.transferableHydrogenIds] },
    b: { ...b, atomIds: [...b.atomIds], transferableHydrogenIds: b.transferableHydrogenIds && [...b.transferableHydrogenIds] },
    environment: { ...env },
  };
  const finish = (result: ContactVerdict) => freezeData({ ...result, contact }) as ContactResult;
  if (invalidRef(a) || invalidRef(b)) return finish(inputError('INVALID_INPUT'));
  if (a.instanceId === b.instanceId || a.atomIds.some(id => b.atomIds.includes(id)) ||
    (a.aggregateId && a.aggregateId === b.aggregateId)) return finish(inputError('SAME_TARGET'));
  if (a.revision !== b.revision) return finish(inputError('STALE_CANDIDATE'));
  if (a.location !== 'active' || b.location !== 'active' || a.available === false || b.available === false) return finish(inputError('UNAVAILABLE_TARGET'));
  const envReason = environmentReason(env);
  if (envReason) return finish(unknown(envReason));
  const identities = [identityReason(a), identityReason(b)];
  // 입력 순서 때문에 알려진 경계가 가려지지 않도록 둘 다 확인한다.
  for (const reason of ['SPECIATION_UNSUPPORTED', 'SPECIES_UNREVIEWED', 'SITE_UNREVIEWED'] as const) {
    if (identities.includes(reason)) return finish(unknown(reason));
  }
  const matches = pairRows.get(key(a.speciesId, b.speciesId)) ?? [];
  if (!matches.length) return finish(unknown('NO_REVIEWED_RULE'));
  if (matches.length !== 1) return finish(failure('RULE_CONFLICT'));
  const row = matches[0];
  if (row.kind === 'unknown') return finish(unknown(row.reason, row.detail, row.id));
  if (row.kind === 'no-reaction') {
    const certificate = NEGATIVE_CERTIFICATES.find(c => c.id === row.certificateId)!;
    const n = deriveStage1Numbers();
    const reverse = certificate.id === 'N15' ? n.C12 : certificate.id === 'N16' ? n.C13 : certificate.id === 'N17' ? n.C14 : undefined;
    if (reverse && reverse.e[1] > -0.2) return finish(unknown('CONDITION_BORDERLINE', row.detail, row.id));
    return finish({ kind: 'no-reaction', certificateId: certificate.id, title: certificate.title, detail: withPrefix(certificate.detail), rowId: row.id });
  }
  const event = EVENT_BY_ID[row.eventId];
  if (row.eventId.startsWith('A')) {
    const donor = [a, b].find(m => m.speciesId === event.requirements[0].speciesId)!;
    if (donor.transferableHydrogenIds?.length !== donor.atomIds.length - 1 || (donor.selectedHydrogenId && !donor.transferableHydrogenIds.includes(donor.selectedHydrogenId))) {
      return finish(unknown('SITE_UNREVIEWED', row.detail, row.id));
    }
  }
  if (!directionSupported(row.eventId)) return finish(unknown('CONDITION_BORDERLINE', row.detail, row.id));
  return finish({ kind: 'reacts', eventId: row.eventId, rowId: row.id, title: event.title,
    detail: withPrefix(event.detail), readiness: { kind: 'needs-scene' } });
}

function sameRef(a: MaterialRef, b: MaterialRef): boolean {
  return a.instanceId === b.instanceId && a.revision === b.revision && a.speciesId === b.speciesId &&
    a.phase === b.phase && a.charge === b.charge && a.structure === b.structure && a.location === b.location &&
    a.aggregateId === b.aggregateId && a.surface === b.surface && a.anchorAtomId === b.anchorAtomId &&
    a.available === b.available && keyList(a.atomIds) === keyList(b.atomIds) &&
    keyList(a.transferableHydrogenIds ?? []) === keyList(b.transferableHydrogenIds ?? []);
}
const keyList = (ids: readonly string[]) => JSON.stringify([...ids].sort());

/** 무대 전체를 재검사하고 한 사건만 예약한다. 대본 생성·컴파일·상태 적용은 하지 않는다. */
export function planEvent(candidate: ContactResult, scene: SceneSummary): PlannedResult {
  if (!Number.isSafeInteger(scene.revision) || scene.revision < 0) return inputError('INVALID_INPUT');
  if (candidate.contact.a.revision !== scene.revision || candidate.contact.b.revision !== scene.revision) return inputError('STALE_CANDIDATE');
  const units = [...scene.particles];
  const aggregateIds = new Set<string>();
  for (const aggregate of scene.aggregates) {
    if (!aggregate.aggregateId || aggregateIds.has(aggregate.aggregateId)) return inputError('INVALID_INPUT');
    aggregateIds.add(aggregate.aggregateId);
    for (const member of aggregate.members) {
      if (member.aggregateId !== aggregate.aggregateId || member.location !== aggregate.location) return inputError('INVALID_INPUT');
      const material = species(member.speciesId);
      if (material && material.graphKind !== aggregate.kind) return inputError('INVALID_INPUT');
      units.push(member);
    }
  }
  if (scene.particles.some(m => m.aggregateId)) return inputError('INVALID_INPUT');
  if (units.some(invalidRef)) return inputError('INVALID_INPUT');
  const ids = units.map(m => m.instanceId);
  const atoms = units.flatMap(m => [...m.atomIds]);
  if (new Set(ids).size !== ids.length || new Set(atoms).size !== atoms.length) return inputError('INVALID_INPUT');
  const a = units.find(m => m.instanceId === candidate.contact.a.instanceId);
  const b = units.find(m => m.instanceId === candidate.contact.b.instanceId);
  if (!a || !b || !sameRef(a, candidate.contact.a) || !sameRef(b, candidate.contact.b)) return inputError('STALE_CANDIDATE');
  if (Object.keys({ ...scene.environment, ...candidate.contact.environment }).some(k =>
    scene.environment[k as keyof Environment] !== candidate.contact.environment[k as keyof Environment])) return inputError('STALE_CANDIDATE');
  // 전달받은 kind/eventId를 신뢰하지 않고 현재 자료로 다시 찾는다.
  const current = classifyContact({ ...a, selectedHydrogenId: candidate.contact.a.selectedHydrogenId },
    { ...b, selectedHydrogenId: candidate.contact.b.selectedHydrogenId }, scene.environment);
  if (current.kind !== 'reacts' && current.kind !== 'no-reaction') {
    const { contact: _contact, ...result } = current;
    return result;
  }
  const rowId = current.rowId!;
  const active = units.filter(m => m.location === 'active');
  const event = current.kind === 'reacts' ? EVENT_BY_ID[current.eventId] : undefined;
  if (event && active.some(m => (event.competingSpecies as readonly string[]).includes(m.speciesId))) {
    return unknown('COMPETING_PATHWAYS', '', rowId);
  }
  const allowed: readonly string[] = event?.allowedContextSpecies ?? NEGATIVE_CERTIFICATES.find(c => c.id === (current as Negative).certificateId)!.allowedContextSpecies;
  if (scene.backgroundEffects?.length || active.some(m => !allowed.includes(m.speciesId) || identityReason(m)) ||
    units.some(m => m.location === 'background' && (m.speciesId !== 'water' || identityReason(m))) ||
    scene.aggregates.some(g => g.location === 'active' && g.members.length > 0 && g.surface !== 'reviewed')) {
    return unknown('CONTEXT_UNREVIEWED', '', rowId);
  }
  if (current.kind === 'no-reaction') {
    const { contact: _contact, ...result } = current;
    return result;
  }
  const selected = [a, b];
  const reservations: Reservation[] = [];
  const missing: { speciesId: SpeciesId; count: number; bringInstanceIds: string[]; message: string }[] = [];
  for (const term of event!.requirements) {
    const chosen = selected.filter(m => m.speciesId === term.speciesId);
    const extra = active.filter(m => m.speciesId === term.speciesId && m.available !== false && !selected.includes(m))
      .sort((x, y) => (x.distancePx ?? Infinity) - (y.distancePx ?? Infinity) || compareId(x.anchorAtomId, y.anchorAtomId));
    chosen.push(...extra.filter(m => m.distancePx !== undefined && m.distancePx <= 120).slice(0, term.count - chosen.length));
    if (chosen.length < term.count) {
      const count = term.count - chosen.length;
      missing.push({ speciesId: term.speciesId, count,
        bringInstanceIds: extra.filter(m => !chosen.includes(m)).slice(0, count).map(m => m.instanceId),
        message: `${MATERIAL_BY_ID[term.speciesId].label} ${count}개가 더 필요해요` });
    }
    reservations.push({ speciesId: term.speciesId, instanceIds: chosen.map(m => m.instanceId),
      atomIds: chosen.flatMap(m => [...m.atomIds]), consumed: term.consumed });
  }
  if (missing.length) return { kind: 'reacts', eventId: current.eventId, rowId, title: current.title,
    detail: current.detail, readiness: { kind: 'needs-material', missing } };
  if (event!.requiredCapabilities.some(c => !scene.capabilities.includes(c)) ||
    (current.eventId.startsWith('R') && !(Number.isInteger(scene.freeBackgroundWaterCount) && scene.freeBackgroundWaterCount! > 0))) {
    return failure('REPRESENTATION_UNAVAILABLE', rowId);
  }
  let ontoAggregateId: string | undefined;
  if (current.eventId === 'P01') {
    const validTarget = (g: AggregateSummary) => g.location === 'active' && g.kind === 'ionic-crystal' && g.surface === 'reviewed' &&
      g.members.length > 0 && g.members.every(m => m.speciesId === 'silver-chloride' && !identityReason(m));
    if (scene.ontoAggregateId !== undefined) {
      const target = scene.aggregates.find(g => g.aggregateId === scene.ontoAggregateId);
      if (!target || !validTarget(target)) return failure('REPRESENTATION_UNAVAILABLE', rowId);
      ontoAggregateId = target.aggregateId;
    } else {
      ontoAggregateId = scene.aggregates.filter(validTarget).sort((x, y) =>
        (scene.aggregateDistancesPx?.[x.aggregateId] ?? Infinity) - (scene.aggregateDistancesPx?.[y.aggregateId] ?? Infinity) ||
        compareId(x.aggregateId, y.aggregateId))[0]?.aggregateId;
    }
  }
  const atomRoles: Record<string, string> = {};
  const expectedProducts: { speciesId: SpeciesId; phase: Phase; atomIds: string[]; aggregateId?: string }[] = [];
  const product = (speciesId: SpeciesId, atomIds: readonly string[], aggregateId?: string) => {
    expectedProducts.push({ speciesId, phase: MATERIAL_BY_ID[speciesId].phase, atomIds: [...atomIds], aggregateId });
  };
  const first = selected.find(m => m.speciesId === event!.requirements[0].speciesId)!;
  const second = selected.find(m => m.speciesId === event!.requirements[1].speciesId)!;
  if (current.eventId.startsWith('A')) {
    const donor = first;
    const selectedDonor = donor.instanceId === a.instanceId ? candidate.contact.a : candidate.contact.b;
    atomRoles.donor = donor.anchorAtomId;
    atomRoles.hydrogen = selectedDonor.selectedHydrogenId ?? [...donor.transferableHydrogenIds!].sort(compareId)[0];
    atomRoles.acceptor = second.anchorAtomId;
    product(current.eventId === 'A05' ? 'ammonia' : 'water', donor.atomIds.filter(id => id !== atomRoles.hydrogen));
    product(current.eventId === 'A02' ? 'ammonium' : 'water', [...second.atomIds, atomRoles.hydrogen]);
  } else if (current.eventId === 'P01') {
    atomRoles.cation = first.anchorAtomId;
    atomRoles.anion = second.anchorAtomId;
    product('silver-chloride', [atomRoles.cation, atomRoles.anion], ontoAggregateId);
  } else if (current.eventId === 'D01') {
    // 대조된 결정 한 단위의 기준 원자는 양이온이며 다른 원자는 Cl이다.
    atomRoles.cation = first.anchorAtomId;
    atomRoles.anion = first.atomIds.find(id => id !== first.anchorAtomId)!;
    product('sodium-ion', [atomRoles.cation]);
    product('chloride', [atomRoles.anion]);
  } else {
    atomRoles.donor = first.anchorAtomId;
    product(current.eventId === 'R03' ? 'copper-ion' : 'zinc-ion', [first.anchorAtomId]);
    const acceptors = reservations[1].instanceIds.map(id => units.find(m => m.instanceId === id)!);
    acceptors.forEach((m, index) => {
      atomRoles[`acceptor${index + 1}`] = m.anchorAtomId;
      product(current.eventId === 'R01' ? 'copper-metal' : 'silver-metal', m.atomIds, first.aggregateId);
    });
  }
  const consumed = reservations.filter(r => r.consumed);
  const consumedAtoms = consumed.flatMap(r => [...r.atomIds]);
  const productAtoms = expectedProducts.flatMap(p => p.atomIds);
  const beforeCharge = consumed.reduce((sum, r) => sum + MATERIAL_BY_ID[r.speciesId].charge * r.instanceIds.length, 0);
  const afterCharge = expectedProducts.reduce((sum, p) => sum + MATERIAL_BY_ID[p.speciesId].charge, 0);
  const beforeElectrons = consumed.reduce((sum, r) => sum + MATERIAL_BY_ID[r.speciesId].modelElectrons * r.instanceIds.length, 0);
  const afterElectrons = expectedProducts.reduce((sum, p) => sum + MATERIAL_BY_ID[p.speciesId].modelElectrons, 0);
  if (keyList(consumedAtoms) !== keyList(productAtoms) || new Set(productAtoms).size !== productAtoms.length ||
    expectedProducts.some(p => p.atomIds.length !== MATERIAL_BY_ID[p.speciesId].atomCount) ||
    beforeCharge !== afterCharge || beforeElectrons !== afterElectrons) return failure('REPRESENTATION_UNAVAILABLE', rowId);
  const plan: EventPlan = { eventId: current.eventId, rowId, inputRevision: scene.revision,
    dataVersion: DATA_VERSION, environment: { ...scene.environment }, reservations, atomRoles, expectedProducts,
    unchangedAtomIds: units.filter(m => m.location !== 'background').flatMap(m => [...m.atomIds]).filter(id => !consumedAtoms.includes(id)), ontoAggregateId,
    electronTransfers: event!.electronTransfers, extent: 'one-stoichiometric-event', review: REVIEW, canExecute: false };
  return freezeData({ kind: 'reacts', eventId: current.eventId, rowId,
    title: ontoAggregateId && current.eventId === 'P01' ? EVENT_BY_ID.P01.ontoTitle : current.title,
    detail: current.detail, readiness: { kind: 'preflight', plan } });
}

/** 연결 계층의 상 타입이다. 임의 화학식 문자열로 대신 판별하지 않는다. */
export type MaterialPhase = Phase;
