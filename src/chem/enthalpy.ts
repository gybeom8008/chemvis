import { allComponents, componentCharge, formalCharge, formulaOf, type World } from '../engine/world';
import type { StageDef } from '../stage/stages';
import { METALS } from './elements';

export type Phase = 'aq' | 'g' | 'l' | 's';
export interface FormationDatum {
  /** 298.15 K, kJ/mol이다. */
  value: number;
  source: string;
  /** 원문에서 이 값과 상을 직접 대조했는가. false는 기억에서 옮긴 잠정값이다. */
  checked: boolean;
  note?: string;
  /** 측정한 물질 상태 대신 화면에서 정한 기준을 쓰는가. */
  convention?: boolean;
  /** 부호 판정에 쓰는 여유 폭(kJ/mol)이다. 통계적 신뢰구간은 아니다. */
  allowance?: number;
}

const CODATA = 'CODATA Key Values (1989), https://codata.info/resources/databases/key1.html';
const NBS = 'NBS Tables (Wagman et al., 1982), https://srd.nist.gov/JPCRD/jpcrdS2Vol11.pdf; 기억에서 옮김, 원문 수치 미대조';
const CRC = 'CRC Handbook, Standard Thermodynamic Properties of Chemical Substances; 기억에서 옮김, 판·원문 수치 미대조';
const WEBBOOK = 'NIST Chemistry WebBook, SRD 69; 기억에서 옮김, 원문 수치 미대조';
const table: Record<string, Partial<Record<Phase, FormationDatum>>> = Object.create(null);
function put(formula: string, values: Partial<Record<Phase, number>>, source: string, checked = false, note?: string): void {
  const row = table[formula] ??= {};
  for (const phase of Object.keys(values) as Phase[]) row[phase] = { value: values[phase]!, source, checked, ...(note ? { note } : {}) };
}

// CODATA 웹 원문을 2026-11-16에 대조했다. 모든 수용액 이온은 H+(aq)=0 약속을 따른다.
const codataRows: [string, Partial<Record<Phase, number>>][] = [
  ['H+', { aq: 0 }], ['H2O', { l: -285.830, g: -241.826 }], ['OH-', { aq: -230.015 }],
  ['H2', { g: 0 }], ['O2', { g: 0 }], ['N2', { g: 0 }], ['F2', { g: 0 }], ['Cl2', { g: 0 }],
  ['Br2', { l: 0, g: 30.91 }], ['I2', { s: 0, g: 62.42 }],
  ['HCl', { g: -92.31 }], ['HBr', { g: -36.29 }], ['HI', { g: 26.50 }], ['HF', { g: -273.30 }],
  ['H2S', { g: -20.6, aq: -38.6 }], ['NH3', { g: -45.94 }], ['NH4+', { aq: -133.26 }],
  ['CO', { g: -110.53 }], ['CO2', { g: -393.51, aq: -413.26 }],
  ['HCO3-', { aq: -689.93 }], ['CO32-', { aq: -675.23 }], ['NO3-', { aq: -206.85 }],
  ['H2PO4-', { aq: -1302.6 }], ['HO4P2-', { aq: -1299.0 }],
  ['HS-', { aq: -16.3 }], ['HO4S-', { aq: -886.9 }], ['SO42-', { aq: -909.34 }],
  ['F-', { aq: -335.35 }], ['Cl-', { aq: -167.080 }], ['Br-', { aq: -121.41 }], ['I-', { aq: -56.78 }],
  ['Li+', { aq: -278.47 }], ['Na+', { aq: -240.34 }], ['K+', { aq: -252.14 }],
  ['Mg2+', { aq: -467.0 }], ['Ca2+', { aq: -543.0 }], ['Al3+', { aq: -538.4 }],
  ['Zn2+', { aq: -153.39 }], ['Cu2+', { aq: 64.9 }], ['Ag+', { aq: 105.79 }],
  ['Li', { s: 0, g: 159.3 }], ['Na', { s: 0, g: 107.5 }], ['K', { s: 0, g: 89.0 }],
  ['Mg', { s: 0, g: 147.1 }], ['Ca', { s: 0, g: 177.8 }], ['Al', { s: 0, g: 330.0 }],
  ['Zn', { s: 0, g: 130.40 }], ['Cu', { s: 0, g: 337.4 }], ['Ag', { s: 0, g: 284.9 }],
  ['H·', { g: 217.998 }], ['Cl·', { g: 121.301 }], ['Br·', { g: 111.87 }],
  ['AgCl', { s: -127.01 }], ['Al2O3', { s: -1675.7 }], ['CaO', { s: -634.92 }],
  ['MgO', { s: -601.60 }], ['ZnO', { s: -350.46 }], ['O2Si', { s: -910.7 }],
  ['O2S', { g: -296.81 }], ['CuSO4', { s: -771.4 }],
];
for (const [f, values] of codataRows) put(f, values, CODATA, true);
// H3O+는 별도 단일 이온 측정값이 아니다. H+(aq)+H2O(l)로 정의한 장면 계산 약속이다.
put('H3O+', { aq: -285.83 }, CODATA, true, 'H+(aq) + H2O(l)에서 계산한 약속값이다.');
// 결합이 남은 HX는 기체를 기준으로 그린 투입 분자이다. 이미 해리된 산은 H+와 X-로 센다.
// 미해리 수용액의 측정값을 뜻하지 않는다. 가상의 분자 수화열을 새로 만들지 않는다.
for (const acid of ['HCl', 'HBr', 'HI']) {
  put(acid, { aq: table[acid].g!.value }, CODATA, false,
    '결합이 남은 HX를 기체 투입 기준으로 센다. 용해와 이온화를 합친 화면 약속이며 미해리 수용액 측정값은 아니다.');
  Object.assign(table[acid].aq!, { convention: true, allowance: 30 });
}

// 원문에서 대조하지 못한 값은 checked:false를 유지한다. aq 빈칸을 g/l 값으로 채우지 않는다.
const nbsRows: [string, Partial<Record<Phase, number>>][] = [
  ['NH3', { aq: -80.29 }], ['HF', { aq: -320.1 }],
  ['H2CO3', { aq: -699.65 }], ['H3PO4', { aq: -1288.3, l: -1271.7 }],
  ['HNO3', { aq: -207.4, l: -174.1, g: -134.3 }], ['H2O4S', { aq: -909.27, l: -814.0 }],
  ['H2O2', { aq: -191.17, l: -187.78, g: -136.11 }],
  ['CH3OH', { aq: -245.93, l: -238.66, g: -201.0 }],
  ['C2H6O', { aq: -288.3, l: -277.69, g: -234.95 }], // 에탄올이다. 에테르와 구별하지 못한다.
  ['C2H4O2', { aq: -487.0, l: -484.5, g: -432.2 }], // 아세트산이다.
  ['C2H3O2-', { aq: -486.01 }], ['CH2O2', { aq: -425.0, l: -424.72, g: -378.6 }],
  ['CHO2-', { aq: -425.55 }], ['CH2O', { g: -108.6 }],
  ['NaCl', { s: -411.12 }], ['KCl', { s: -436.68 }], ['LiCl', { s: -408.27 }],
  ['NaBr', { s: -361.06 }], ['NaI', { s: -287.78 }], ['NaF', { s: -576.6 }],
  ['AgBr', { s: -100.37 }], ['AgI', { s: -61.84 }], ['AgNO3', { s: -124.39 }],
  ['NaNO3', { s: -467.85 }], ['KNO3', { s: -494.63 }],
  ['CaCO3', { s: -1206.9 }], ['CaSO4', { s: -1434.11 }], ['MgCO3', { s: -1095.8 }],
  ['MgSO4', { s: -1284.9 }], ['ZnSO4', { s: -982.8 }], ['Na2SO4', { s: -1387.1 }],
  ['Na2CO3', { s: -1130.68 }], ['NaHCO3', { s: -947.7 }],
  ['CaCl2', { s: -795.8 }], ['MgCl2', { s: -641.8 }], ['ZnCl2', { s: -415.1 }],
  ['NaOH', { s: -425.6 }], ['KOH', { s: -424.7 }], ['Ca(OH)2', { s: -986.1 }],
  ['Mg(OH)2', { s: -924.7 }], ['NH4Cl', { s: -314.43 }], ['NH4NO3', { s: -365.56 }],
];
for (const [f, values] of nbsRows) put(f, values, NBS);
const organicRows: [string, Partial<Record<Phase, number>>][] = [
  ['CH4', { g: -74.87, aq: -87.9 }], ['C2H6', { g: -84.68 }], ['C2H4', { g: 52.47 }],
  ['C2H2', { g: 226.73 }], ['C3H8', { g: -104.7 }], ['C3H6', { g: 20.4 }],
  ['C4H10', { g: -125.6 }], ['C6H6', { g: 82.93, l: 49.04 }],
  ['C6H12', { g: -123.1, l: -156.0 }], // 시클로헥세인이다.
  ['CH3Cl', { g: -82.9 }], ['CH3F', { g: -234.2 }], ['CH3I', { g: 14.6 }],
  ['CH2Cl2', { g: -95.4, l: -124.2 }], ['CHCl3', { g: -103.1, l: -134.1 }],
  ['CCl4', { g: -95.7, l: -135.4 }], ['C2H5Cl', { g: -112.3 }], ['C2H5Br', { g: -62.0 }],
  ['C3H8O', { g: -255.2, l: -302.6 }], // 1-프로판올이다.
  ['C3H6O2', { l: -510.7 }], ['CH5N', { g: -23.0, aq: -68.27 }],
  ['C2H7N', { g: -47.5 }], // 에틸아민이다.
  ['C2H5NO2', { s: -528.6 }], ['C3H7NO2', { s: -560.0 }],
  ['C6H12O6', { s: -1273.3, aq: -1263.1 }], ['C3H4O3', { s: -614.0 }],
  ['OH·', { g: 38.99 }], ['CH3·', { g: 146.7 }],
];
for (const [f, values] of organicRows) put(f, values, WEBBOOK);
put('CH3Br', { g: -34.3 }, 'NIST WebBook, Ferguson/Okafo/Whittle (1973), https://webbook.nist.gov/cgi/cbook.cgi?ID=C74839&Mask=1', true);
for (const [f, values] of [
  ['Fe2+', { aq: -89.1 }], ['Fe3+', { aq: -48.5 }], ['Cu+', { aq: 71.7 }],
  ['Ba2+', { aq: -538.4 }], ['O4P3-', { aq: -1277.4 }], ['NO2-', { aq: -104.6 }],
  ['CuO', { s: -155.2 }], ['Cu2O', { s: -168.6 }], ['Fe2O3', { s: -824.2 }],
  ['Fe3O4', { s: -1118.4 }], ['NO·', { g: 90.25 }], ['NO2·', { g: 33.18 }],
] as [string, Partial<Record<Phase, number>>][]) put(f, values, CRC);

// q13: 원문 또는 공개된 연구 자료에서 수치와 상을 대조한 값이다.
const AMINES = '2024 GCA amine thermodynamics, Table S1 (J/mol을 kJ/mol로 환산), https://www.sciencedirect.com/science/article/am/pii/S0016703724001376; https://prod-dcd-datasets-public-files-eu-west-1.s3.eu-west-1.amazonaws.com/da1402f2-8c30-416f-9ce2-5f04fd9ae278';
put('CH5N', { aq: -68.27 }, AMINES, true, '기체 생성열과 실측 수화열에서 유도한 값이다.');
put('CH6N+', { aq: -123.50 }, AMINES, true, '메틸아민 값과 양성자 결합열에서 유도했다. Table S1 주석 l을 따른다.');
put('NH3', { aq: -81.34 }, AMINES, true, 'Table S1 주석 rr: Vanderzee & King (1972). q12 잠정값 -80.29를 바꿨다.');
put('CH3OH', { aq: -246.30 }, AMINES, true, 'Table S1: Shock & Helgeson (1990), 기체 값과 수화열에서 유도했다.');
const COPPER = 'Puigdomenech & Taxen, SKB TR-00-13 (2000), p.87, section 7.7.1.2; Bertocci & Wagman (1985), https://skb.se/upload/publications/pdf/TR-00-13.pdf';
for (const [n, dh] of [[1, -24], [2, -45], [3, -68], [4, -90]]) {
  const formula = n === 1 ? 'CuH3N2+' : `CuH${3 * n}N${n}2+`;
  put(formula, { aq: table['Cu2+'].aq!.value + n * table.NH3.aq!.value + dh }, COPPER, true,
    `Cu2+(aq) + ${n} NH3(aq)의 착물 생성열 ${dh} kJ/mol에서 유도했다. 배위된 물은 용매에 포함한다.`);
}
const webbook = (cas: string, mask: string) => `https://webbook.nist.gov/cgi/cbook.cgi?ID=C${cas}&Mask=${mask}`;
put('C2H4', { g: 52.47 }, `NIST WebBook, Chase (1998), ${webbook('74851', '1')}`, true);
put('C2H5Br', { g: -63.6 }, `NIST WebBook, Kudchadker & Kudchadker (1979), ${webbook('74964', '1')}`, true);
put('C2H5Br', { l: -95.5 }, `NIST WebBook, Pedley et al. (1986), ${webbook('74964', '2')}`, true);
// 용해도형 헨리 상수의 기울기 A에서 ΔsolH = -R A이다. 압력/농도형의 부호와 반대이다.
const R = 0.008314462618; // kJ/(mol K)
for (const [formula, slope, source, allowance] of [
  ['CH3Br', 3100, `NIST WebBook Henry 표; Sander (2023), Wilhelm et al. (1977), ${webbook('74839', '10')}; https://henrys-law.org/henry/casrn/74-83-9`, 6],
  ['C2H4', 1800, `NIST WebBook Henry 표, ${webbook('74851', '10')}`, 3],
  ['C2H5Br', 3900, 'Sander (2023), Rex (1906), https://henrys-law.org/henry/casrn/74-96-4', 6],
] as const) {
  put(formula, { aq: table[formula].g!.value - R * slope }, `${table[formula].g!.source}; ${source}`, true,
    `기체 생성열에 -R × ${slope} K인 용해열을 더했다. 독립적으로 측정한 aq 생성열은 아니다.`);
  table[formula].aq!.allowance = allowance;
}
const GLYCINE = 'Ruscic & Bross (2025), ATcT glycine evaluation, https://pubs.rsc.org/en/content/articlehtml/2025/fd/d4fd00110a';
put('C2H5NO2', { aq: -514.22, g: -394.70, s: -528.37 }, GLYCINE, true,
  'aq는 쌍성 이온, g는 중성 분자, s는 알파 결정이다. 공개 초록에서 수치와 상을 대조했다.');
put('C4H8N2O3', { s: -747.70 }, `NIST WebBook, Diaz et al. (1992), ${webbook('556503', '2')}`, true);
put('C4H8N2O3', { aq: -747.70 + 11.56 },
  `${table.C4H8N2O3.s!.source}; Smirnov & Badelin (2010), p.56, https://doi.org/10.1016/j.tca.2010.01.006; https://www.electronicsandbooks.com/edt/manual/Magazine/T/Thermochimica%20Acta/451_520/S0040603110000146.pdf`, true,
  '고체 생성열에 물에서 무한 희석 용해열 +11.56 ± 0.17을 더했다. 검색 도구가 제공한 원문 p.56 문단을 대조했다.');
table.C2H5NO2.aq!.allowance = 0.20;
table.C4H8N2O3.aq!.allowance = 1.47;
put('CH4', { g: -74.87 }, `NIST WebBook, Chase (1998), ${webbook('74828', '1')}`, true);
put('CH3·', { g: 147.0 }, `NIST WebBook, Tsang (1996), 147 ± 1, ${webbook('2229074', '1')}`, true);
table['CH3·'].g!.allowance = 1;

/** 값과 출처를 함께 볼 수 있는 표이다. 분자는 formulaOf, 묶어 센 염은 관용식을 쓴다. */
export const FORMATION_ENTHALPIES: Readonly<Record<string, Readonly<Partial<Record<Phase, Readonly<FormationDatum>>>>>> = table;

/** 범위 조사에서 발견했지만 표준값을 확보하지 못한 항목이다. 숫자를 만들어 넣지 않는다. */
export const UNAVAILABLE_FORMATION_ENTHALPIES: Readonly<Record<string, string>> = {
  ADP: 'Ad로 아데노신 부분을 생략했다. 실제 분자와 전하·양성자화 조건을 먼저 대응해야 한다.',
  ATP: 'Ad로 아데노신 부분을 생략했다. 생화학 ΔG를 생성 엔탈피로 대신하지 않는다.',
  'C2H5+': '물속 에틸 양이온 중간체 값이 없다. 기체 이온 값을 대신 넣지 않는다.',
  C6H11N3O4: '글라이신 삼량체는 기체 중합 수업에 나온다. 기체 생성열을 확보하지 못했다. 수용액 용해열이나 고체 값만으로 대신하지 않는다.',
};

/** 표에 있는 값이다. 해당 상에 없으면 null이다. 다른 상으로 대체하지 않는다. */
export function formationEnthalpy(formula: string, phase: Phase): number | null {
  return table[formula]?.[phase]?.value ?? null;
}

/** 원소 표준 상태 → 기체 중성 원자, kJ/mol. CODATA 원문을 대조했다. */
export const ATOMIZATION_ENTHALPIES: Readonly<Record<string, FormationDatum>> = Object.fromEntries(
  Object.entries({ H: 217.998, C: 716.68, N: 472.68, O: 249.18, F: 79.38, Cl: 121.301,
    Br: 111.87, I: 106.76, S: 277.17, P: 316.5, Si: 450.0 })
    .map(([el, value]) => [el, { value, source: CODATA, checked: true }]),
);
const BOND_SOURCE = 'CRC Handbook, 평균 결합 엔탈피의 교과서 반올림값; 기억에서 옮김, 원문 미대조';
/** 두 원소는 알파벳순, 끝 숫자는 결합 차수이다. 단위는 kJ/mol이다. */
export const MEAN_BOND_ENTHALPIES: Readonly<Record<string, FormationDatum>> = Object.fromEntries(
  Object.entries({
    'H-H:1': 436, 'C-H:1': 413, 'H-N:1': 391, 'H-O:1': 463, 'F-H:1': 565,
    'Cl-H:1': 431, 'Br-H:1': 366, 'H-I:1': 299, 'H-S:1': 347,
    'C-C:1': 347, 'C-C:2': 614, 'C-C:3': 839, 'C-N:1': 293, 'C-N:2': 615, 'C-N:3': 891,
    'C-O:1': 358, 'C-O:2': 745, 'C-O:3': 1072, 'C-F:1': 485, 'C-Cl:1': 339,
    'Br-C:1': 276, 'C-I:1': 240, 'C-S:1': 272, 'C-S:2': 573,
    'N-N:1': 163, 'N-N:2': 418, 'N-N:3': 945, 'N-O:1': 201, 'N-O:2': 607,
    'O-O:1': 146, 'O-O:2': 495, 'F-F:1': 155, 'Cl-Cl:1': 243,
    'Br-Br:1': 193, 'I-I:1': 151, 'O-P:1': 335, 'O-P:2': 544,
    'O-S:1': 364, 'O-S:2': 523, 'S-S:1': 266, 'H-Si:1': 318, 'O-Si:1': 452,
  }).map(([bond, value]) => [bond, { value, source: BOND_SOURCE, checked: false }]),
);

// 각 염은 이온 종류와 화학식 단위당 이온 수로 식별한다. 결정 이름에는 의존하지 않는다.
const SALTS: [string, Record<string, number>][] = [
  ['AgCl', { 'Ag+': 1, 'Cl-': 1 }], ['AgBr', { 'Ag+': 1, 'Br-': 1 }], ['AgI', { 'Ag+': 1, 'I-': 1 }],
  ['NaCl', { 'Na+': 1, 'Cl-': 1 }], ['KCl', { 'K+': 1, 'Cl-': 1 }], ['LiCl', { 'Li+': 1, 'Cl-': 1 }],
  ['NaBr', { 'Na+': 1, 'Br-': 1 }], ['NaI', { 'Na+': 1, 'I-': 1 }], ['NaF', { 'Na+': 1, 'F-': 1 }],
  ['CaCO3', { 'Ca2+': 1, 'CO32-': 1 }], ['MgCO3', { 'Mg2+': 1, 'CO32-': 1 }],
  ['CaSO4', { 'Ca2+': 1, 'SO42-': 1 }], ['MgSO4', { 'Mg2+': 1, 'SO42-': 1 }],
  ['CuSO4', { 'Cu2+': 1, 'SO42-': 1 }], ['ZnSO4', { 'Zn2+': 1, 'SO42-': 1 }],
  ['Na2SO4', { 'Na+': 2, 'SO42-': 1 }], ['Na2CO3', { 'Na+': 2, 'CO32-': 1 }],
  ['NaHCO3', { 'Na+': 1, 'HCO3-': 1 }], ['CaCl2', { 'Ca2+': 1, 'Cl-': 2 }],
  ['MgCl2', { 'Mg2+': 1, 'Cl-': 2 }], ['ZnCl2', { 'Zn2+': 1, 'Cl-': 2 }],
  ['AgNO3', { 'Ag+': 1, 'NO3-': 1 }], ['NaNO3', { 'Na+': 1, 'NO3-': 1 }], ['KNO3', { 'K+': 1, 'NO3-': 1 }],
  ['NaOH', { 'Na+': 1, 'OH-': 1 }], ['KOH', { 'K+': 1, 'OH-': 1 }],
  ['Ca(OH)2', { 'Ca2+': 1, 'OH-': 2 }], ['Mg(OH)2', { 'Mg2+': 1, 'OH-': 2 }],
  ['NH4Cl', { 'NH4+': 1, 'Cl-': 1 }], ['NH4NO3', { 'NH4+': 1, 'NO3-': 1 }],
];

interface Species { formula: string; phase: Phase; count: number; ids: string[]; solid: boolean }
function phaseOf(w: World, ids: string[], stage: StageDef, formula: string): Phase {
  const atoms = ids.map((id) => w.atoms.get(id)!);
  if (atoms.every((a) => a.lattice)) return 's';
  if (stage.name === 'gas') return 'g';
  // 경계 무대만 높이로 기체/액체를 나눈다. 전극·막·점토·전지는 수용액으로 가정한다.
  if (stage.name === 'interface' && stage.surfaceY !== undefined &&
      atoms.reduce((sum, a) => sum + a.y, 0) / atoms.length < stage.surfaceY) return 'g';
  // 수용액 장면의 단독 중성 금속도 작은 고체 조각을 대표한다고 본다.
  if (atoms.length === 1 && METALS.has(atoms[0].el) && componentCharge(w, ids) === 0) return 's';
  return formula === 'H2O' ? 'l' : 'aq';
}

function inventory(w: World, stage: StageDef): Map<string, Species> {
  const result = new Map<string, Species>();
  const comps = allComponents(w).filter((ids) => !ids.every((id) => w.atoms.get(id)!.crowd) &&
    !ids.some((id) => w.atoms.get(id)!.gone));
  const byAtom = new Map(comps.flatMap((ids) => ids.map((id) => [id, ids] as const)));
  const used = new Set<string[]>();
  const add = (formula: string, phase: Phase, count: number, ids: string[], solid = false) => {
    const key = `${formula}|${phase}`;
    const prev = result.get(key);
    if (prev) prev.count += count;
    else result.set(key, { formula, phase, count, ids, solid });
  };
  for (const crystal of w.crystals.values()) {
    const units = [...new Set(crystal.map((id) => byAtom.get(id)).filter((ids): ids is string[] => !!ids))];
    if (!units.length) continue;
    // land로 붙은 Ag+도 금속 결정 명단에 들어간다. lattice가 아니면 aq로 남겨 둔다.
    if (units.some((ids) => ids.some((id) => w.atoms.get(id)!.lattice))) continue;
    const types = [...new Set(units.map((ids) => formulaOf(w, ids)))].sort();
    const salt = SALTS.find(([, ions]) => Object.keys(ions).sort().join('|') === types.join('|'));
    if (salt) {
      // 화면 결정은 홀수 개 이온으로 끝나기도 한다. 표면 잉여 이온도 같은 비중으로 센다.
      add(salt[0], 's', units.length / Object.values(salt[1]).reduce((a, b) => a + b, 0), units.flat(), true);
    } else if (units.every((ids) => componentCharge(w, ids) === 0)) {
      for (const ids of units) add(formulaOf(w, ids), 's', 1, ids, true);
    } else {
      // 혼합 결정·양성자를 받은 표면·등록 안 된 염을 수용액 이온으로 오인하지 않는다.
      for (const ids of units) add(formulaOf(w, ids), 's', 1, ids, true);
    }
    units.forEach((ids) => used.add(ids));
  }
  for (const ids of comps) {
    if (used.has(ids)) continue;
    const atoms = ids.map((id) => w.atoms.get(id)!);
    // lattice는 전자를 내준 직후에도 leave 전까지 유지된다. 그동안 원소 고체 0으로 센다.
    const formula = atoms.length === 1 && atoms[0].lattice ? atoms[0].el : formulaOf(w, ids);
    add(formula, phaseOf(w, ids, stage, formula), 1, ids);
  }
  return result;
}

function estimateGas(w: World, ids: string[]): number | null {
  if (componentCharge(w, ids) !== 0) return null; // 이온은 어림하지 않는다.
  const set = new Set(ids);
  let value = 0;
  for (const id of ids) {
    const atom = w.atoms.get(id)!;
    const atomization = ATOMIZATION_ENTHALPIES[atom.el];
    if (!atomization || atom.sei) return null; // Ad 같은 생략 원자나 정체를 모르는 막은 제외한다.
    value += atomization.value;
  }
  for (const bond of w.bonds.values()) {
    if (bond.order <= 0 || !set.has(bond.a) || !set.has(bond.b)) continue;
    if (bond.dative) return null;
    const key = `${[w.atoms.get(bond.a)!.el, w.atoms.get(bond.b)!.el].sort().join('-')}:${bond.order}`;
    const energy = MEAN_BOND_ENTHALPIES[key];
    if (!energy) return null;
    value -= energy.value;
  }
  return value;
}

export interface StepEnthalpy {
  dH: number | null;
  estimated: boolean;
  /** 어림이나 물질 상태를 고려해도 부호와 대략적인 크기를 믿고 열로 표시할 수 있는가. */
  reliable: boolean;
  /** reliable이 false인 까닭이다. 화면에 바로 쓸 수 있는 해요체로 적는다. */
  why?: string;
  /** 화면에서 정한 물질 상태 기준이 계산에 포함됐는가. */
  convention: boolean;
  missing: string[];
  terms: { formula: string; phase: Phase; change: number; value: number; estimated: boolean;
    checked: boolean; convention: boolean; note?: string }[];
}

/**
 * 생긴 물질 합에서 없어진 물질 합을 뺀다. crowd는 제외하고, 변화가 없는 항은 먼저 지운다.
 * 수치는 화면 개수를 계수로 삼은 kJ 척도이다. 실제 분자 몇 개가 내는 kJ가 아니다.
 * 표에 없는 중성 용질은 기체 원자화/결합 모형으로 어림하며 수화열은 포함하지 않는다.
 */
export function stepEnthalpy(before: World, after: World, stage: StageDef): StepEnthalpy {
  const b = inventory(before, stage), a = inventory(after, stage);
  const terms: StepEnthalpy['terms'] = [];
  const missing = new Set<string>();
  let sum = 0, allowance = 0;
  for (const key of [...new Set([...b.keys(), ...a.keys()])].sort()) {
    const change = (a.get(key)?.count ?? 0) - (b.get(key)?.count ?? 0);
    if (Math.abs(change) < 1e-10) continue;
    const species = (change > 0 ? a : b).get(key)!;
    const { formula, phase, ids, solid } = species;
    const datum = table[formula]?.[phase];
    let value = datum?.value ?? null;
    const estimated = value === null;
    if (estimated && !solid && phase !== 's') value = estimateGas(change > 0 ? after : before, ids);
    if (value === null) { missing.add(formula); continue; }
    // 대본의 NH2/COOH 그림은 물속에서 주로 존재하는 쌍성 이온을 대표한다.
    const peptideConvention = phase === 'aq' && ['C2H5NO2', 'C4H8N2O3'].includes(formula) &&
      ids.every((id) => {
        const w = change > 0 ? after : before;
        return formalCharge(w, w.atoms.get(id)!) === 0;
      });
    terms.push({ formula, phase, change, value, estimated, checked: datum?.checked ?? false,
      convention: !!datum?.convention || peptideConvention,
      ...(peptideConvention ? { note: '중성으로 그린 아미노산·펩타이드를 물속 쌍성 이온으로 센다.' } :
        datum?.note ? { note: datum.note } : {}) });
    allowance += Math.abs(change) * (datum?.allowance ?? 0);
    sum += change * value;
  }
  const dH = missing.size ? null : Math.abs(sum) < 1e-9 ? 0 : sum;
  const estimated = terms.some((term) => term.estimated);
  const countedComponents = (w: World) => allComponents(w)
    .filter((ids) => !ids.every((id) => w.atoms.get(id)!.crowd) && !ids.some((id) => w.atoms.get(id)!.gone));
  const counted = (w: World) => countedComponents(w).flat().sort().join(' ');
  const charge = (w: World) => countedComponents(w).reduce((sum, ids) => sum + componentCharge(w, ids), 0);
  const why = missing.size ? '표에 없는 물질이 있어 열을 끝까지 계산하지 못했어요.' :
    counted(before) !== counted(after) ? '계산에 들어간 원자가 달라져 반응열만 구할 수 없어요.' :
    stage.electrodes ? '전극에서는 전기적 일을 따로 계산해야 해요.' :
    charge(before) !== charge(after) ? '전자가 드나든 반쪽 반응은 열로 바로 표시할 수 없어요.' :
    estimated ? '결합으로 어림한 값이 섞여 있어 열의 방향을 확신할 수 없어요.' :
    terms.some((t) => !t.checked && !table[t.formula]?.[t.phase]?.convention) ?
      '원문 수치를 대조하지 못한 표 값이 들어 있어요.' :
    allowance > 0 && Math.abs(dH!) <= 2 * allowance ? '자료와 화면 약속에 따른 오차에 비해 열이 작아요.' : undefined;
  return { dH, estimated, reliable: !why, ...(why ? { why } : {}),
    convention: terms.some((term) => term.convention), missing: [...missing].sort(), terms };
}
