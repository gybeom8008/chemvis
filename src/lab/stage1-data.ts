/** 단계 1 자료 3판을 옮긴 값이다. 문서의 draft 상태를 승인으로 바꾸지 않는다.
 * documentCells는 표의 각 셀을 그대로 보관한다.
 * authorReadingNote는 문서 작성 당시 기록이며 이번 구현에서 원문을 다시 읽었다는 뜻이 아니다.
 * 이 모듈은 파일·DOM·엔진을 읽지 않는다. */
export function freezeData<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
export const DATA_VERSION = 'stage1-v3-draft-2026-11-12';
export const REVIEW = freezeData({ status: 'draft', reviewer: null } as const);
export const CONDITIONS = freezeData({ medium: 'water', temperatureC: 25, activityPresets: ['ordinary'], excitation: 'none', activityRange: [1e-3, 1e-2] } as const);
export const DEFAULT_ENVIRONMENT = freezeData({ medium: 'water', temperatureC: 25, activityPreset: 'ordinary', excitation: 'none' } as const);
export const MESSAGES = freezeData({
  stage: '입자 몇 개로 반응 한 번을 봐요.',
  environment: '25 °C의 묽은 물속',
  detailPrefix: '화면의 입자는 수많은 입자를 대표해요. 입자 수는 농도나 반응한 비율이 아니에요.',
  unreviewed: '아직 이 조합은 판단할 수 없어요.',
  condition: '이 조건에서는 판단할 수 없어요.',
  context: '함께 있는 재료 때문에 판단할 수 없어요.',
  equilibrium: '얼마나 반응하는지는 계산하지 않아요.',
  executionFailure: '장면을 정확히 만들지 못했어요.',
  source: '출처와 대조한 자료이고 전문가가 검토한 것은 아니에요.',
} as const);

export const MATERIALS = freezeData(([
  {
    "id": "water",
    "atomCount": 3,
    "modelElectrons": 8,
    "label": "H₂O",
    "phase": "l",
    "charge": 0,
    "engineFormula": "H2O",
    "graphKind": "component",
    "documentCells": [
      "water",
      "H₂O(l), 선택한 물 / 배경 물 구별",
      "x.O–x.H1, x.O–x.H2 / x.O",
      "O lp2; q0",
      "선택한 물은 D01 손잡이; 배경 수화 물은 반응 재고 아님",
      "V01, S03"
    ]
  },
  {
    "id": "hydronium",
    "atomCount": 4,
    "modelElectrons": 8,
    "label": "H₃O⁺",
    "phase": "aq",
    "charge": 1,
    "engineFormula": "H3O+",
    "graphKind": "component",
    "documentCells": [
      "hydronium",
      "H₃O⁺(aq)",
      "x.O–x.H1/H2/H3 / x.O",
      "O lp1; q+1",
      "A01·A02의 결합된 H 선택",
      "V01, C03–C04"
    ]
  },
  {
    "id": "hydroxide",
    "atomCount": 2,
    "modelElectrons": 8,
    "label": "OH⁻",
    "phase": "aq",
    "charge": -1,
    "engineFormula": "OH-",
    "graphKind": "component",
    "documentCells": [
      "hydroxide",
      "OH⁻(aq)",
      "x.O–x.H / x.O",
      "O lp3; q−1",
      "O가 H를 받음; 원래 H ID 유지",
      "V01, C03·C05"
    ]
  },
  {
    "id": "ammonia",
    "atomCount": 4,
    "modelElectrons": 8,
    "label": "NH₃",
    "phase": "aq",
    "charge": 0,
    "engineFormula": "NH3",
    "graphKind": "component",
    "documentCells": [
      "ammonia",
      "NH₃(aq)",
      "x.N–x.H1/H2/H3 / x.N",
      "N lp1; q0",
      "N이 H를 받음; 금속 착물은 미지원",
      "V02, S05"
    ]
  },
  {
    "id": "ammonium",
    "atomCount": 5,
    "modelElectrons": 8,
    "label": "NH₄⁺",
    "phase": "aq",
    "charge": 1,
    "engineFormula": "NH4+",
    "graphKind": "component",
    "documentCells": [
      "ammonium",
      "NH₄⁺(aq)",
      "x.N–x.H1/H2/H3/H4 / x.N",
      "N lp0; q+1",
      "현재 N에 결합한 H를 줌; 생성 NH₄⁺의 H 이름을 재작성하지 않음",
      "C02, C05"
    ]
  },
  {
    "id": "silver-ion",
    "atomCount": 1,
    "modelElectrons": 0,
    "label": "Ag⁺",
    "phase": "aq",
    "charge": 1,
    "engineFormula": "Ag+",
    "graphKind": "component",
    "documentCells": [
      "silver-ion",
      "Ag⁺(aq)",
      "x.Ag / x.Ag",
      "lp0 rad0; q+1",
      "P01 또는 금속 사건의 예약 대상",
      "V03–V04"
    ]
  },
  {
    "id": "chloride",
    "atomCount": 1,
    "modelElectrons": 8,
    "label": "Cl⁻",
    "phase": "aq",
    "charge": -1,
    "engineFormula": "Cl-",
    "graphKind": "component",
    "documentCells": [
      "chloride",
      "Cl⁻(aq)",
      "x.Cl / x.Cl",
      "lp4 rad0; q−1",
      "P01; 공유 결합 생성 없음",
      "V03, S01"
    ]
  },
  {
    "id": "silver-chloride",
    "atomCount": 2,
    "modelElectrons": 8,
    "label": "AgCl(s)",
    "phase": "s",
    "charge": 0,
    "engineFormula": "AgCl",
    "graphKind": "ionic-crystal",
    "documentCells": [
      "silver-chloride",
      "AgCl(s), 이온 고체",
      "1:1 Ag·Cl ID 집합 / aggregateId",
      "Ag+1, Cl−1; 합0",
      "자유 Ag⁺·Cl⁻로 자동 취급하지 않음; P01의 onto 대상",
      "V03, S04·S08"
    ]
  },
  {
    "id": "sodium-ion",
    "atomCount": 1,
    "modelElectrons": 0,
    "label": "Na⁺",
    "phase": "aq",
    "charge": 1,
    "engineFormula": "Na+",
    "graphKind": "component",
    "documentCells": [
      "sodium-ion",
      "Na⁺(aq)",
      "x.Na / x.Na",
      "lp0 rad0; q+1",
      "관찰자; 전자 장부가 0이라고 무전하 원자가 아님",
      "S01–S03"
    ]
  },
  {
    "id": "sodium-chloride",
    "atomCount": 2,
    "modelElectrons": 8,
    "label": "NaCl(s)",
    "phase": "s",
    "charge": 0,
    "engineFormula": "NaCl",
    "graphKind": "ionic-crystal",
    "documentCells": [
      "sodium-chloride",
      "NaCl(s), 이온 고체",
      "1:1 Na·Cl ID 집합 / aggregateId",
      "Na+1, Cl−1; 합0",
      "D01은 표면 한 쌍만 분리; 공유 Na–Cl 결합 없음",
      "S01·S03·S08"
    ]
  },
  {
    "id": "zinc-metal",
    "atomCount": 1,
    "modelElectrons": 2,
    "label": "Zn(s)",
    "phase": "s",
    "charge": 0,
    "engineFormula": "Zn",
    "graphKind": "metal",
    "documentCells": [
      "zinc-metal",
      "Zn(s), 금속",
      "z1.Zn…z6.Zn / aggregateId+표면 AtomId",
      "각 lp1 rad0; q0",
      "6개 모두 실제 재고, 표면 원자 하나가 전자 2개 제공",
      "V06, S07·S08"
    ]
  },
  {
    "id": "zinc-ion",
    "atomCount": 1,
    "modelElectrons": 0,
    "label": "Zn²⁺",
    "phase": "aq",
    "charge": 2,
    "engineFormula": "Zn2+",
    "graphKind": "component",
    "documentCells": [
      "zinc-ion",
      "Zn²⁺(aq)",
      "x.Zn / x.Zn",
      "lp0 rad0; q+2",
      "수화는 표시, 상세 배위수·가수분해는 미지원",
      "V06"
    ]
  },
  {
    "id": "copper-metal",
    "atomCount": 1,
    "modelElectrons": 2,
    "label": "Cu(s)",
    "phase": "s",
    "charge": 0,
    "engineFormula": "Cu",
    "graphKind": "metal",
    "documentCells": [
      "copper-metal",
      "Cu(s), 금속",
      "c1.Cu…c6.Cu / aggregateId+표면 AtomId",
      "각 lp1 rad0; q0",
      "R03 공여체; 생성 Cu도 금속상으로 등록",
      "V05, S07·S08"
    ]
  },
  {
    "id": "copper-ion",
    "atomCount": 1,
    "modelElectrons": 0,
    "label": "Cu²⁺",
    "phase": "aq",
    "charge": 2,
    "engineFormula": "Cu2+",
    "graphKind": "component",
    "documentCells": [
      "copper-ion",
      "Cu²⁺(aq)",
      "x.Cu / x.Cu",
      "lp0 rad0; q+2",
      "R01 수용체; 착물·수산화물은 미지원",
      "V05"
    ]
  },
  {
    "id": "silver-metal",
    "atomCount": 1,
    "modelElectrons": 1,
    "label": "Ag(s)",
    "phase": "s",
    "charge": 0,
    "engineFormula": "Ag",
    "graphKind": "metal",
    "documentCells": [
      "silver-metal",
      "Ag(s), 금속",
      "g1.Ag…g6.Ag 또는 생성 Ag ID / aggregateId",
      "각 lp0 rad1; q0",
      "금속에서 홑전자 주머니를 그리지 않음",
      "V04, S07·S08"
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const NUMERIC_ROWS = freezeData(([
  {
    "id": "V01",
    "key": "kw-water",
    "value": 1e-14,
    "printedValue": "1.0×10⁻¹⁴",
    "unit": "평형상수, 무차원 관례",
    "definition": "25 °C 수용액, 용매 물 제외; 원문은 농도곱 표기",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh",
    "locator": "`Kw=[H3O+][OH−]` 식 뒤 25 °C 문단",
    "authorReadingNote": "예",
    "documentCells": [
      "V01 `kw-water`",
      "1.0×10⁻¹⁴",
      "평형상수, 무차원 관례",
      "25 °C 수용액, 용매 물 제외; 원문은 농도곱 표기",
      "[OpenStax 14.2](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
      "`Kw=[H3O+][OH−]` 식 뒤 25 °C 문단",
      "예"
    ]
  },
  {
    "id": "V02",
    "key": "kb-ammonia",
    "value": 1.8e-05,
    "printedValue": "1.8×10⁻⁵",
    "unit": "평형상수, 무차원 관례",
    "definition": "25 °C 수용액, NH₃+H₂O⇌NH₄⁺+OH⁻",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases",
    "locator": "Table I1, ammonia",
    "authorReadingNote": "예",
    "documentCells": [
      "V02 `kb-ammonia`",
      "1.8×10⁻⁵",
      "평형상수, 무차원 관례",
      "25 °C 수용액, NH₃+H₂O⇌NH₄⁺+OH⁻",
      "[OpenStax Appendix I](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases)",
      "Table I1, ammonia",
      "예"
    ]
  },
  {
    "id": "V03",
    "key": "ksp-agcl",
    "value": 1.6e-10,
    "printedValue": "1.6×10⁻¹⁰",
    "unit": "용해도곱, 무차원 관례",
    "definition": "25 °C 수용액, AgCl(s)⇌Ag⁺+Cl⁻; 1:1",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/j-solubility-products",
    "locator": "Table J1, silver → AgCl",
    "authorReadingNote": "예",
    "documentCells": [
      "V03 `ksp-agcl`",
      "1.6×10⁻¹⁰",
      "용해도곱, 무차원 관례",
      "25 °C 수용액, AgCl(s)⇌Ag⁺+Cl⁻; 1:1",
      "[OpenStax Appendix J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products)",
      "Table J1, silver → AgCl",
      "예"
    ]
  },
  {
    "id": "V04",
    "key": "E-Ag",
    "value": 0.7996,
    "printedValue": "+0.7996",
    "unit": "V vs SHE",
    "definition": "표준 환원 전위, Ag⁺+e⁻→Ag(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials",
    "locator": "Table L1, Ag⁺+e⁻→Ag",
    "authorReadingNote": "예; 2판에서 온도 근거도 재열람",
    "documentCells": [
      "V04 `E-Ag`",
      "+0.7996",
      "V vs SHE",
      "표준 환원 전위, Ag⁺+e⁻→Ag(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음",
      "[OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials)",
      "Table L1, Ag⁺+e⁻→Ag",
      "예; 2판에서 온도 근거도 재열람"
    ]
  },
  {
    "id": "V05",
    "key": "E-Cu",
    "value": 0.337,
    "printedValue": "+0.337",
    "unit": "V vs SHE",
    "definition": "표준 환원 전위, Cu²⁺+2e⁻→Cu(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials)과 Figure 17.6의 T=298 K. 수치는 온도 근거 표의 반올림값 +0.34가 아닌 부록 L에서 취함",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials",
    "locator": "Table L1, Cu²⁺+2e⁻→Cu",
    "authorReadingNote": "예; 2판에서 온도 근거도 재열람",
    "documentCells": [
      "V05 `E-Cu`",
      "+0.337",
      "V vs SHE",
      "표준 환원 전위, Cu²⁺+2e⁻→Cu(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials)과 Figure 17.6의 T=298 K. 수치는 온도 근거 표의 반올림값 +0.34가 아닌 부록 L에서 취함",
      "[OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials)",
      "Table L1, Cu²⁺+2e⁻→Cu",
      "예; 2판에서 온도 근거도 재열람"
    ]
  },
  {
    "id": "V06",
    "key": "E-Zn",
    "value": -0.7618,
    "printedValue": "−0.7618",
    "unit": "V vs SHE",
    "definition": "표준 환원 전위, Zn²⁺+2e⁻→Zn(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials",
    "locator": "Table L1, Zn²⁺+2e⁻→Zn",
    "authorReadingNote": "예; 2판에서 온도 근거도 재열람",
    "documentCells": [
      "V06 `E-Zn`",
      "−0.7618",
      "V vs SHE",
      "표준 환원 전위, Zn²⁺+2e⁻→Zn(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음",
      "[OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials)",
      "Table L1, Zn²⁺+2e⁻→Zn",
      "예; 2판에서 온도 근거도 재열람"
    ]
  },
  {
    "id": "V07",
    "key": "R",
    "value": 8.314462618,
    "printedValue": "8.314462618…",
    "unit": "J mol⁻¹ K⁻¹",
    "definition": "2022 CODATA, 정의상 정확한 상수의 표시 자릿수",
    "sourceUrl": "https://physics.nist.gov/cuu/Constants/Table/allascii.txt",
    "locator": "`molar gas constant`",
    "authorReadingNote": "예",
    "documentCells": [
      "V07 `R`",
      "8.314462618…",
      "J mol⁻¹ K⁻¹",
      "2022 CODATA, 정의상 정확한 상수의 표시 자릿수",
      "[NIST 상수 전체 표](https://physics.nist.gov/cuu/Constants/Table/allascii.txt)",
      "`molar gas constant`",
      "예"
    ]
  },
  {
    "id": "V08",
    "key": "F",
    "value": 96485.33212,
    "printedValue": "96485.33212…",
    "unit": "C mol⁻¹",
    "definition": "2022 CODATA, 정의상 정확한 상수의 표시 자릿수",
    "sourceUrl": "https://physics.nist.gov/cuu/Constants/Table/allascii.txt",
    "locator": "`Faraday constant`",
    "authorReadingNote": "예",
    "documentCells": [
      "V08 `F`",
      "96485.33212…",
      "C mol⁻¹",
      "2022 CODATA, 정의상 정확한 상수의 표시 자릿수",
      "[NIST 상수 전체 표](https://physics.nist.gov/cuu/Constants/Table/allascii.txt)",
      "`Faraday constant`",
      "예"
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const SOURCE_ROWS = freezeData(([
  {
    "id": "S01",
    "basis": "Na⁺ 염·NH₄⁺ 염의 가용성, AgCl 예외, 순이온식",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions",
    "locator": "Table 4.1의 Group 1/NH₄⁺/Cl⁻/OH⁻ 행, 뒤 AgCl 예",
    "authorReadingNote": "예",
    "documentCells": [
      "S01",
      "Na⁺ 염·NH₄⁺ 염의 가용성, AgCl 예외, 순이온식",
      "[OpenStax 4.2](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions)",
      "Table 4.1의 Group 1/NH₄⁺/Cl⁻/OH⁻ 행, 뒤 AgCl 예",
      "예"
    ]
  },
  {
    "id": "S02",
    "basis": "염화 이온·나트륨 이온의 무시할 수 있는 산·염기 가수분해, NH₄⁺의 가수분해",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts",
    "locator": "Salts with Basic Ions의 Na⁺, Salts with Acidic Ions의 NH₄Cl",
    "authorReadingNote": "예",
    "documentCells": [
      "S02",
      "염화 이온·나트륨 이온의 무시할 수 있는 산·염기 가수분해, NH₄⁺의 가수분해",
      "[OpenStax 14.4](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts)",
      "Salts with Basic Ions의 Na⁺, Salts with Acidic Ions의 NH₄Cl",
      "예"
    ]
  },
  {
    "id": "S03",
    "basis": "이온 고체의 해리·수화, HCl의 사실상 완전 이온화",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/11-2-electrolytes",
    "locator": "Ionic Electrolytes, Covalent Electrolytes의 HCl",
    "authorReadingNote": "예; 수화 그림의 예시는 KCl이며 NaCl 전용 측정 자료가 아님",
    "documentCells": [
      "S03",
      "이온 고체의 해리·수화, HCl의 사실상 완전 이온화",
      "[OpenStax 11.2](https://openstax.org/books/chemistry-2e/pages/11-2-electrolytes)",
      "Ionic Electrolytes, Covalent Electrolytes의 HCl",
      "예; 수화 그림의 예시는 KCl이며 NaCl 전용 측정 자료가 아님"
    ]
  },
  {
    "id": "S04",
    "basis": "Q와 Ksp에 따른 방향, AgCl의 유한한 용해도",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution",
    "locator": "The Solubility Product 및 침전 예측 부분",
    "authorReadingNote": "예",
    "documentCells": [
      "S04",
      "Q와 Ksp에 따른 방향, AgCl의 유한한 용해도",
      "[OpenStax 15.1](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution)",
      "The Solubility Product 및 침전 예측 부분",
      "예"
    ]
  },
  {
    "id": "S05",
    "basis": "NH₃와 Ag⁺의 착물, NH₃에 의한 AgCl 용해 증가",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/15-2-lewis-acids-and-bases",
    "locator": "도입부 Ag⁺와 NH₃, Formation of Complex Ions",
    "authorReadingNote": "예; 단계 1의 양성 행으로 등록하지 않음",
    "documentCells": [
      "S05",
      "NH₃와 Ag⁺의 착물, NH₃에 의한 AgCl 용해 증가",
      "[OpenStax 15.2](https://openstax.org/books/chemistry-2e/pages/15-2-lewis-acids-and-bases)",
      "도입부 Ag⁺와 NH₃, Formation of Complex Ions",
      "예; 단계 1의 양성 행으로 등록하지 않음"
    ]
  },
  {
    "id": "S06",
    "basis": "Nernst 식과 E°, K의 관계",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium",
    "locator": "E° and K, Potentials at Nonstandard Conditions: The Nernst Equation",
    "authorReadingNote": "예",
    "documentCells": [
      "S06",
      "Nernst 식과 E°, K의 관계",
      "[OpenStax 17.4](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "E° and K, Potentials at Nonstandard Conditions: The Nernst Equation",
      "예"
    ]
  },
  {
    "id": "S07",
    "basis": "Zn/Cu/Ag의 치환 장면에 대한 정성 대조",
    "sourceUrl": "https://www.envisioningchemistry.com/metal-displacement-2",
    "locator": "본문의 금속 조각과 구리·은 용액 설명",
    "authorReadingNote": "예; 제작자가 기록한 장면 설명이며 이 문서의 온도·활동도 구간을 검증한 실험은 아님",
    "documentCells": [
      "S07",
      "Zn/Cu/Ag의 치환 장면에 대한 정성 대조",
      "[Envisioning Chemistry, Metal Displacement 2](https://www.envisioningchemistry.com/metal-displacement-2)",
      "본문의 금속 조각과 구리·은 용액 설명",
      "예; 제작자가 기록한 장면 설명이며 이 문서의 온도·활동도 구간을 검증한 실험은 아님"
    ]
  },
  {
    "id": "S08",
    "basis": "이온 고체와 금속의 전자·배열 표현",
    "sourceUrl": "https://openstax.org/books/chemistry-2e/pages/10-5-the-solid-state-of-matter",
    "locator": "Ionic Solids, Metallic Solids, Figures 10.39–10.40",
    "authorReadingNote": "예",
    "documentCells": [
      "S08",
      "이온 고체와 금속의 전자·배열 표현",
      "[OpenStax 10.5](https://openstax.org/books/chemistry-2e/pages/10-5-the-solid-state-of-matter)",
      "Ionic Solids, Metallic Solids, Figures 10.39–10.40",
      "예"
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const DERIVED_ROWS = freezeData(([
  {
    "id": "C01",
    "formula": "pKw=−log(1.0×10⁻¹⁴)",
    "resultAndUnit": "14.0000, 무차원",
    "definition": "25 °C 물",
    "sources": [
      {
        "locator": "14.2, Kw 뒤 문단",
        "url": "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
      }
    ],
    "sourceText": "[14.2, Kw 뒤 문단](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
    "authorReadingNote": "입력·pKw 예, 결과 계산",
    "documentCells": [
      "C01",
      "pKw=−log(1.0×10⁻¹⁴)",
      "14.0000, 무차원",
      "25 °C 물",
      "[14.2, Kw 뒤 문단](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
      "입력·pKw 예, 결과 계산"
    ]
  },
  {
    "id": "C02",
    "formula": "Ka(NH₄⁺)=Kw/Kb=(1.0×10⁻¹⁴)/(1.8×10⁻⁵); pKa=−log Ka",
    "resultAndUnit": "Ka=5.5556×10⁻¹⁰, pKa=9.2552725",
    "definition": "같은 용매·온도, 물 활동도 1",
    "sources": [
      {
        "locator": "I, ammonia",
        "url": "https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases"
      },
      {
        "locator": "14.4, NH₄Cl의 Ka 관계",
        "url": "https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts"
      },
      {
        "locator": "14.2, Kw",
        "url": "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
      }
    ],
    "sourceText": "[I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), [14.4, NH₄Cl의 Ka 관계](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), [14.2, Kw](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
    "authorReadingNote": "입력·관계 예, 결과 계산",
    "documentCells": [
      "C02",
      "Ka(NH₄⁺)=Kw/Kb=(1.0×10⁻¹⁴)/(1.8×10⁻⁵); pKa=−log Ka",
      "Ka=5.5556×10⁻¹⁰, pKa=9.2552725",
      "같은 용매·온도, 물 활동도 1",
      "[I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), [14.4, NH₄Cl의 Ka 관계](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), [14.2, Kw](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
      "입력·관계 예, 결과 계산"
    ]
  },
  {
    "id": "C03",
    "formula": "K=1/Kw=10¹⁴; logK=pKw",
    "resultAndUnit": "logK=14.0000",
    "definition": "H₃O⁺+OH⁻→2H₂O",
    "sources": [
      {
        "locator": "14.2, Kw 식",
        "url": "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
      }
    ],
    "sourceText": "[14.2, Kw 식](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
    "authorReadingNote": "입력 예, 역반응 계산",
    "documentCells": [
      "C03 A01",
      "K=1/Kw=10¹⁴; logK=pKw",
      "logK=14.0000",
      "H₃O⁺+OH⁻→2H₂O",
      "[14.2, Kw 식](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh)",
      "입력 예, 역반응 계산"
    ]
  },
  {
    "id": "C04",
    "formula": "K=1/Ka(NH₄⁺)=1.8×10⁹; logK=pKa",
    "resultAndUnit": "logK=9.2552725",
    "definition": "H₃O⁺+NH₃→H₂O+NH₄⁺",
    "sources": [
      {
        "locator": "14.4, NH₄⁺ 가수분해",
        "url": "https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts"
      }
    ],
    "sourceText": "[14.4, NH₄⁺ 가수분해](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), C02",
    "authorReadingNote": "입력 예, 역반응 계산",
    "documentCells": [
      "C04 A02",
      "K=1/Ka(NH₄⁺)=1.8×10⁹; logK=pKa",
      "logK=9.2552725",
      "H₃O⁺+NH₃→H₂O+NH₄⁺",
      "[14.4, NH₄⁺ 가수분해](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), C02",
      "입력 예, 역반응 계산"
    ]
  },
  {
    "id": "C05",
    "formula": "K=1/Kb(NH₃)=55555.5556; logK=−log(1.8×10⁻⁵)",
    "resultAndUnit": "logK=4.7447275",
    "definition": "NH₄⁺+OH⁻→NH₃+H₂O",
    "sources": [
      {
        "locator": "I, ammonia",
        "url": "https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases"
      }
    ],
    "sourceText": "[I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases)",
    "authorReadingNote": "입력 예, 역반응 계산",
    "documentCells": [
      "C05 A05",
      "K=1/Kb(NH₃)=55555.5556; logK=−log(1.8×10⁻⁵)",
      "logK=4.7447275",
      "NH₄⁺+OH⁻→NH₃+H₂O",
      "[I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases)",
      "입력 예, 역반응 계산"
    ]
  },
  {
    "id": "C06",
    "formula": "Q=aAg·aCl=[10⁻⁶,10⁻⁴]; Q/Ksp=Q/(1.6×10⁻¹⁰)",
    "resultAndUnit": "[6250,625000], 무차원",
    "definition": "자유 Ag⁺·Cl⁻ 각각 ordinary",
    "sources": [
      {
        "locator": "J, AgCl",
        "url": "https://openstax.org/books/chemistry-2e/pages/j-solubility-products"
      },
      {
        "locator": "15.1, 침전 예측",
        "url": "https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution"
      }
    ],
    "sourceText": "[J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products), [15.1, 침전 예측](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution)",
    "authorReadingNote": "입력·관계 예, 구간은 제품 정책, 결과 계산",
    "documentCells": [
      "C06 P01",
      "Q=aAg·aCl=[10⁻⁶,10⁻⁴]; Q/Ksp=Q/(1.6×10⁻¹⁰)",
      "[6250,625000], 무차원",
      "자유 Ag⁺·Cl⁻ 각각 ordinary",
      "[J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products), [15.1, 침전 예측](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution)",
      "입력·관계 예, 구간은 제품 정책, 결과 계산"
    ]
  },
  {
    "id": "C07",
    "formula": "Kprecip=1/Ksp=6.25×10⁹; logK=−log(1.6×10⁻¹⁰)",
    "resultAndUnit": "logK=9.7958800",
    "definition": "Ag⁺+Cl⁻→AgCl(s)",
    "sources": [
      {
        "locator": "J, AgCl",
        "url": "https://openstax.org/books/chemistry-2e/pages/j-solubility-products"
      }
    ],
    "sourceText": "[J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products)",
    "authorReadingNote": "입력 예, 결과 계산",
    "documentCells": [
      "C07 P01",
      "Kprecip=1/Ksp=6.25×10⁹; logK=−log(1.6×10⁻¹⁰)",
      "logK=9.7958800",
      "Ag⁺+Cl⁻→AgCl(s)",
      "[J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products)",
      "입력 예, 결과 계산"
    ]
  },
  {
    "id": "C08",
    "formula": "b=ln(10)RT/F; R=8.314462618, T=298.15, F=96485.33212",
    "resultAndUnit": "b=0.0591593497 V, 계산용 반올림 0.05916 V",
    "definition": "25 °C",
    "sources": [
      {
        "locator": "NIST, R·F 항목",
        "url": "https://physics.nist.gov/cuu/Constants/Table/allascii.txt"
      },
      {
        "locator": "17.4, Nernst 식",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[NIST, R·F 항목](https://physics.nist.gov/cuu/Constants/Table/allascii.txt), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "상수·식 예, 결과 계산; 교재의 0.0592와 자릿수 다름",
    "documentCells": [
      "C08",
      "b=ln(10)RT/F; R=8.314462618, T=298.15, F=96485.33212",
      "b=0.0591593497 V, 계산용 반올림 0.05916 V",
      "25 °C",
      "[NIST, R·F 항목](https://physics.nist.gov/cuu/Constants/Table/allascii.txt), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "상수·식 예, 결과 계산; 교재의 0.0592와 자릿수 다름"
    ]
  },
  {
    "id": "C09",
    "formula": "E°=0.337−(−0.7618)=1.0988; Q=aZn²⁺/aCu²⁺∈[0.1,10]; E=E°−b·logQ/2; logK=2E°/b",
    "resultAndUnit": "E°=1.0988 V; E∈[1.06922,1.12838] V; logK≈37.1471",
    "definition": "Zn+Cu²⁺→Zn²⁺+Cu, n=2, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Zn·Cu",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 및 E° and K",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C09 R01",
      "E°=0.337−(−0.7618)=1.0988; Q=aZn²⁺/aCu²⁺∈[0.1,10]; E=E°−b·logQ/2; logK=2E°/b",
      "E°=1.0988 V; E∈[1.06922,1.12838] V; logK≈37.1471",
      "Zn+Cu²⁺→Zn²⁺+Cu, n=2, 25 °C ordinary",
      "[L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C10",
    "formula": "E°=0.7996−(−0.7618)=1.5614; Q=aZn²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b",
    "resultAndUnit": "E°=1.5614 V; E∈[1.44308,1.53182] V; logK≈52.7862",
    "definition": "Zn+2Ag⁺→Zn²⁺+2Ag, n=2, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Zn·Ag",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 및 E° and K",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C10 R02",
      "E°=0.7996−(−0.7618)=1.5614; Q=aZn²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b",
      "E°=1.5614 V; E∈[1.44308,1.53182] V; logK≈52.7862",
      "Zn+2Ag⁺→Zn²⁺+2Ag, n=2, 25 °C ordinary",
      "[L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C11",
    "formula": "E°=0.7996−0.337=0.4626; Q=aCu²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b",
    "resultAndUnit": "E°=0.4626 V; E∈[0.34428,0.43302] V; logK≈15.6391",
    "definition": "Cu+2Ag⁺→Cu²⁺+2Ag, n=2, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Cu·Ag",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 및 E° and K",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C11 R03",
      "E°=0.7996−0.337=0.4626; Q=aCu²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b",
      "E°=0.4626 V; E∈[0.34428,0.43302] V; logK≈15.6391",
      "Cu+2Ag⁺→Cu²⁺+2Ag, n=2, 25 °C ordinary",
      "[L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C12",
    "formula": "같은 참고 상태에서 Ereverse=−E(R01); 입력 범위 C09",
    "resultAndUnit": "[−1.12838,−1.06922] V",
    "definition": "Cu+Zn²⁺→Cu²⁺+Zn, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Zn·Cu",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 식",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C12 N15",
      "같은 참고 상태에서 Ereverse=−E(R01); 입력 범위 C09",
      "[−1.12838,−1.06922] V",
      "Cu+Zn²⁺→Cu²⁺+Zn, 25 °C ordinary",
      "[L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C13",
    "formula": "같은 참고 상태에서 Ereverse=−E(R02); 입력 범위 C10",
    "resultAndUnit": "[−1.53182,−1.44308] V",
    "definition": "2Ag+Zn²⁺→2Ag⁺+Zn, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Zn·Ag",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 식",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C13 N16",
      "같은 참고 상태에서 Ereverse=−E(R02); 입력 범위 C10",
      "[−1.53182,−1.44308] V",
      "2Ag+Zn²⁺→2Ag⁺+Zn, 25 °C ordinary",
      "[L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C14",
    "formula": "같은 참고 상태에서 Ereverse=−E(R03); 입력 범위 C11",
    "resultAndUnit": "[−0.43302,−0.34428] V",
    "definition": "2Ag+Cu²⁺→2Ag⁺+Cu, 25 °C ordinary",
    "sources": [
      {
        "locator": "L, Table L1 Cu·Ag",
        "url": "https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials"
      },
      {
        "locator": "17.4, Nernst 식",
        "url": "https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium"
      }
    ],
    "sourceText": "[L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
    "authorReadingNote": "입력·식 예, 결과 계산",
    "documentCells": [
      "C14 N17",
      "같은 참고 상태에서 Ereverse=−E(R03); 입력 범위 C11",
      "[−0.43302,−0.34428] V",
      "2Ag+Cu²⁺→2Ag⁺+Cu, 25 °C ordinary",
      "[L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)",
      "입력·식 예, 결과 계산"
    ]
  },
  {
    "id": "C15",
    "formula": "Q=aNH3/(aNH4·aOH); 각 a∈[10⁻³,10⁻²]; K=1/(1.8×10⁻⁵)",
    "resultAndUnit": "Q∈[10,10⁴], K/Q∈[5.5556,5555.56], 무차원",
    "definition": "NH₄⁺+OH⁻→NH₃+H₂O, 25 °C ordinary",
    "sources": [
      {
        "locator": "I, Table I1 ammonia",
        "url": "https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases"
      }
    ],
    "sourceText": "[I, Table I1 ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), C05 및 §2",
    "authorReadingNote": "입력 예, 구간은 제품 정책, 결과 계산",
    "documentCells": [
      "C15 A05",
      "Q=aNH3/(aNH4·aOH); 각 a∈[10⁻³,10⁻²]; K=1/(1.8×10⁻⁵)",
      "Q∈[10,10⁴], K/Q∈[5.5556,5555.56], 무차원",
      "NH₄⁺+OH⁻→NH₃+H₂O, 25 °C ordinary",
      "[I, Table I1 ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), C05 및 §2",
      "입력 예, 구간은 제품 정책, 결과 계산"
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const CONTACT_ROWS = freezeData(([
  {
    "id": "T001",
    "pair": [
      "water",
      "water"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "물의 자동 이온화·역반응의 평형 분포를 계산하지 않는다.",
    "documentCells": [
      "T001",
      "H₂O",
      "H₂O",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "물의 자동 이온화·역반응의 평형 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T002",
    "pair": [
      "water",
      "hydronium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "물 사이 양성자 교환을 새 생성물 한 사건으로 등록하지 않는다.",
    "documentCells": [
      "T002",
      "H₂O",
      "H₃O⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "물 사이 양성자 교환을 새 생성물 한 사건으로 등록하지 않는다."
    ]
  },
  {
    "id": "T003",
    "pair": [
      "water",
      "hydroxide"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "OH⁻와 물의 양성자 교환·평형 분포를 계산하지 않는다.",
    "documentCells": [
      "T003",
      "H₂O",
      "OH⁻",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "OH⁻와 물의 양성자 교환·평형 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T004",
    "pair": [
      "water",
      "ammonia"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "NH₃+H₂O⇌NH₄⁺+OH⁻는 부분 이온화 평형이다(V02).",
    "documentCells": [
      "T004",
      "H₂O",
      "NH₃",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "NH₃+H₂O⇌NH₄⁺+OH⁻는 부분 이온화 평형이다(V02)."
    ]
  },
  {
    "id": "T005",
    "pair": [
      "water",
      "ammonium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "NH₄⁺의 산 가수분해 비율을 계산하지 않는다(C02, S02).",
    "documentCells": [
      "T005",
      "H₂O",
      "NH₄⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "NH₄⁺의 산 가수분해 비율을 계산하지 않는다(C02, S02)."
    ]
  },
  {
    "id": "T006",
    "pair": [
      "water",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "수화와 가수분해의 종 분포를 단독 은 이온 사건으로 등록하지 않는다.",
    "documentCells": [
      "T006",
      "H₂O",
      "Ag⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "수화와 가수분해의 종 분포를 단독 은 이온 사건으로 등록하지 않는다."
    ]
  },
  {
    "id": "T007",
    "pair": [
      "water",
      "chloride"
    ],
    "kind": "no-reaction",
    "certificateId": "N21",
    "detail": "Cl⁻의 눈에 띄는 산·염기 가수분해 생성물을 부정한다(S02). 수화는 허용한다.",
    "documentCells": [
      "T007",
      "H₂O",
      "Cl⁻",
      "검토된 부정 · N21",
      "Cl⁻의 눈에 띄는 산·염기 가수분해 생성물을 부정한다(S02). 수화는 허용한다."
    ]
  },
  {
    "id": "T008",
    "pair": [
      "water",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "AgCl은 유한하게 녹는다. 녹는 양·평형 없이 D01을 복사하지 않는다(V03, S04).",
    "documentCells": [
      "T008",
      "H₂O",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "AgCl은 유한하게 녹는다. 녹는 양·평형 없이 D01을 복사하지 않는다(V03, S04)."
    ]
  },
  {
    "id": "T009",
    "pair": [
      "water",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N22",
    "detail": "Na⁺의 산·염기 가수분해에 의한 새 종 생성을 부정한다(S02). 수화는 허용한다.",
    "documentCells": [
      "T009",
      "H₂O",
      "Na⁺",
      "검토된 부정 · N22",
      "Na⁺의 산·염기 가수분해에 의한 새 종 생성을 부정한다(S02). 수화는 허용한다."
    ]
  },
  {
    "id": "T010",
    "pair": [
      "water",
      "sodium-chloride"
    ],
    "kind": "reacts",
    "eventId": "D01",
    "detail": "선택한 물 손잡이와 NaCl 표면 한 쌍; 물은 소모하지 않는다(S01, S03).",
    "documentCells": [
      "T010",
      "H₂O",
      "NaCl(s)",
      "양성 · D01",
      "선택한 물 손잡이와 NaCl 표면 한 쌍; 물은 소모하지 않는다(S01, S03)."
    ]
  },
  {
    "id": "T011",
    "pair": [
      "water",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "아연의 물·공기·피막에 따른 부식 경로는 미등록이다.",
    "documentCells": [
      "T011",
      "H₂O",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "아연의 물·공기·피막에 따른 부식 경로는 미등록이다."
    ]
  },
  {
    "id": "T012",
    "pair": [
      "water",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "수화 아연 이온의 가수분해·pH 분포를 계산하지 않는다.",
    "documentCells": [
      "T012",
      "H₂O",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "수화 아연 이온의 가수분해·pH 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T013",
    "pair": [
      "water",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "구리의 물·공기·피막에 따른 부식 경로는 미등록이다.",
    "documentCells": [
      "T013",
      "H₂O",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "구리의 물·공기·피막에 따른 부식 경로는 미등록이다."
    ]
  },
  {
    "id": "T014",
    "pair": [
      "water",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "수화 구리 이온의 가수분해·pH 분포를 계산하지 않는다.",
    "documentCells": [
      "T014",
      "H₂O",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "수화 구리 이온의 가수분해·pH 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T015",
    "pair": [
      "water",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "은의 물·공기·표면 반응을 일반 부정할 인증이 없다.",
    "documentCells": [
      "T015",
      "H₂O",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "은의 물·공기·표면 반응을 일반 부정할 인증이 없다."
    ]
  },
  {
    "id": "T016",
    "pair": [
      "hydronium",
      "hydronium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "동종 산의 양성자 교환·평형을 별도 사건으로 등록하지 않는다.",
    "documentCells": [
      "T016",
      "H₃O⁺",
      "H₃O⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "동종 산의 양성자 교환·평형을 별도 사건으로 등록하지 않는다."
    ]
  },
  {
    "id": "T017",
    "pair": [
      "hydronium",
      "hydroxide"
    ],
    "kind": "reacts",
    "eventId": "A01",
    "detail": "H₃O⁺의 결합된 H 한 개를 OH⁻의 O로 옮긴다(C03).",
    "documentCells": [
      "T017",
      "H₃O⁺",
      "OH⁻",
      "양성 · A01",
      "H₃O⁺의 결합된 H 한 개를 OH⁻의 O로 옮긴다(C03)."
    ]
  },
  {
    "id": "T018",
    "pair": [
      "hydronium",
      "ammonia"
    ],
    "kind": "reacts",
    "eventId": "A02",
    "detail": "H₃O⁺의 결합된 H 한 개를 NH₃의 N으로 옮긴다(C04).",
    "documentCells": [
      "T018",
      "H₃O⁺",
      "NH₃",
      "양성 · A02",
      "H₃O⁺의 결합된 H 한 개를 NH₃의 N으로 옮긴다(C04)."
    ]
  },
  {
    "id": "T019",
    "pair": [
      "hydronium",
      "ammonium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "두 산을 서로 중화한다고 추정하지 않고 양성자 분포는 미계산으로 둔다.",
    "documentCells": [
      "T019",
      "H₃O⁺",
      "NH₄⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "두 산을 서로 중화한다고 추정하지 않고 양성자 분포는 미계산으로 둔다."
    ]
  },
  {
    "id": "T020",
    "pair": [
      "hydronium",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "산성 맥락의 은 이온에 대한 독립 두 재료 행이 없다.",
    "documentCells": [
      "T020",
      "H₃O⁺",
      "Ag⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "산성 맥락의 은 이온에 대한 독립 두 재료 행이 없다."
    ]
  },
  {
    "id": "T021",
    "pair": [
      "hydronium",
      "chloride"
    ],
    "kind": "no-reaction",
    "certificateId": "N09",
    "detail": "HCl 분자가 주된 생성물로 남는 순변화를 부정한다(S03).",
    "documentCells": [
      "T021",
      "H₃O⁺",
      "Cl⁻",
      "검토된 부정 · N09",
      "HCl 분자가 주된 생성물로 남는 순변화를 부정한다(S03)."
    ]
  },
  {
    "id": "T022",
    "pair": [
      "hydronium",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "산성 용액의 AgCl 용해·종 분포를 계산하지 않는다.",
    "documentCells": [
      "T022",
      "H₃O⁺",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "산성 용액의 AgCl 용해·종 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T023",
    "pair": [
      "hydronium",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N23",
    "detail": "Na⁺가 H₃O⁺를 중화하여 새 산·염기 생성물을 만드는 순변화를 부정한다(S02). 수화·물 사이 H 교환은 제외한다.",
    "documentCells": [
      "T023",
      "H₃O⁺",
      "Na⁺",
      "검토된 부정 · N23",
      "Na⁺가 H₃O⁺를 중화하여 새 산·염기 생성물을 만드는 순변화를 부정한다(S02). 수화·물 사이 H 교환은 제외한다."
    ]
  },
  {
    "id": "T024",
    "pair": [
      "hydronium",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "산성 맥락의 고체 용해를 D01에 자동 결합하지 않는다.",
    "documentCells": [
      "T024",
      "H₃O⁺",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "산성 맥락의 고체 용해를 D01에 자동 결합하지 않는다."
    ]
  },
  {
    "id": "T025",
    "pair": [
      "hydronium",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "수소 발생을 포함한 산과 아연의 반응 계열이 미등록이다.",
    "documentCells": [
      "T025",
      "H₃O⁺",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "수소 발생을 포함한 산과 아연의 반응 계열이 미등록이다."
    ]
  },
  {
    "id": "T026",
    "pair": [
      "hydronium",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "아연 이온의 산성 용액 종 분포를 계산하지 않는다.",
    "documentCells": [
      "T026",
      "H₃O⁺",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "아연 이온의 산성 용액 종 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T027",
    "pair": [
      "hydronium",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "구리와 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다.",
    "documentCells": [
      "T027",
      "H₃O⁺",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "구리와 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다."
    ]
  },
  {
    "id": "T028",
    "pair": [
      "hydronium",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "구리 이온의 산성 용액 종 분포를 계산하지 않는다.",
    "documentCells": [
      "T028",
      "H₃O⁺",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "구리 이온의 산성 용액 종 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T029",
    "pair": [
      "hydronium",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "은과 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다.",
    "documentCells": [
      "T029",
      "H₃O⁺",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "은과 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다."
    ]
  },
  {
    "id": "T030",
    "pair": [
      "hydroxide",
      "hydroxide"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "동종 염기의 물과의 양성자 교환·분포를 별도 사건으로 계산하지 않는다.",
    "documentCells": [
      "T030",
      "OH⁻",
      "OH⁻",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "동종 염기의 물과의 양성자 교환·분포를 별도 사건으로 계산하지 않는다."
    ]
  },
  {
    "id": "T031",
    "pair": [
      "hydroxide",
      "ammonia"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "NH₃의 염기 평형에 대한 공통 OH⁻ 효과를 계산하지 않는다.",
    "documentCells": [
      "T031",
      "OH⁻",
      "NH₃",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "NH₃의 염기 평형에 대한 공통 OH⁻ 효과를 계산하지 않는다."
    ]
  },
  {
    "id": "T032",
    "pair": [
      "hydroxide",
      "ammonium"
    ],
    "kind": "reacts",
    "eventId": "A05",
    "detail": "NH₄⁺의 현재 N–H 결합에서 H 한 개를 OH⁻의 O로 옮긴다(C05).",
    "documentCells": [
      "T032",
      "OH⁻",
      "NH₄⁺",
      "양성 · A05",
      "NH₄⁺의 현재 N–H 결합에서 H 한 개를 OH⁻의 O로 옮긴다(C05)."
    ]
  },
  {
    "id": "T033",
    "pair": [
      "hydroxide",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "은 산화물 계열은 미등록이다. 단순 AgOH 고체를 만들지 않는다.",
    "documentCells": [
      "T033",
      "OH⁻",
      "Ag⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "은 산화물 계열은 미등록이다. 단순 AgOH 고체를 만들지 않는다."
    ]
  },
  {
    "id": "T034",
    "pair": [
      "hydroxide",
      "chloride"
    ],
    "kind": "no-reaction",
    "certificateId": "N24",
    "detail": "Cl⁻가 OH⁻를 중화하거나 HCl을 주된 생성물로 만드는 순변화를 부정한다(S02, S03).",
    "documentCells": [
      "T034",
      "OH⁻",
      "Cl⁻",
      "검토된 부정 · N24",
      "Cl⁻가 OH⁻를 중화하거나 HCl을 주된 생성물로 만드는 순변화를 부정한다(S02, S03)."
    ]
  },
  {
    "id": "T035",
    "pair": [
      "hydroxide",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "AgCl와 OH⁻의 결합된 용해·고체 전환은 미등록이다.",
    "documentCells": [
      "T035",
      "OH⁻",
      "AgCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "AgCl와 OH⁻의 결합된 용해·고체 전환은 미등록이다."
    ]
  },
  {
    "id": "T036",
    "pair": [
      "hydroxide",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N07",
    "detail": "NaOH 공유 분자 또는 침전의 생성을 부정한다(S01).",
    "documentCells": [
      "T036",
      "OH⁻",
      "Na⁺",
      "검토된 부정 · N07",
      "NaOH 공유 분자 또는 침전의 생성을 부정한다(S01)."
    ]
  },
  {
    "id": "T037",
    "pair": [
      "hydroxide",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "OH⁻가 있는 고체 용해를 D01에 자동 결합하지 않는다.",
    "documentCells": [
      "T037",
      "OH⁻",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "OH⁻가 있는 고체 용해를 D01에 자동 결합하지 않는다."
    ]
  },
  {
    "id": "T038",
    "pair": [
      "hydroxide",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "아연의 염기성 부식·아연산염·피막 계열은 미등록이다.",
    "documentCells": [
      "T038",
      "OH⁻",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "아연의 염기성 부식·아연산염·피막 계열은 미등록이다."
    ]
  },
  {
    "id": "T039",
    "pair": [
      "hydroxide",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "아연 수산화물·착물과 그 화학량론은 미등록이다.",
    "documentCells": [
      "T039",
      "OH⁻",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "아연 수산화물·착물과 그 화학량론은 미등록이다."
    ]
  },
  {
    "id": "T040",
    "pair": [
      "hydroxide",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "구리 표면의 염기성·산소·피막 반응은 미등록이다.",
    "documentCells": [
      "T040",
      "OH⁻",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "구리 표면의 염기성·산소·피막 반응은 미등록이다."
    ]
  },
  {
    "id": "T041",
    "pair": [
      "hydroxide",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Cu(OH)₂ 침전은 이 단계의 1:1 침전 행이 아니다.",
    "documentCells": [
      "T041",
      "OH⁻",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Cu(OH)₂ 침전은 이 단계의 1:1 침전 행이 아니다."
    ]
  },
  {
    "id": "T042",
    "pair": [
      "hydroxide",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "은 표면의 염기성·산소·산화물 반응은 미등록이다.",
    "documentCells": [
      "T042",
      "OH⁻",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "은 표면의 염기성·산소·산화물 반응은 미등록이다."
    ]
  },
  {
    "id": "T043",
    "pair": [
      "ammonia",
      "ammonia"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "암모니아와 물의 평형을 동종 분자 접촉으로 실행하지 않는다.",
    "documentCells": [
      "T043",
      "NH₃",
      "NH₃",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "암모니아와 물의 평형을 동종 분자 접촉으로 실행하지 않는다."
    ]
  },
  {
    "id": "T044",
    "pair": [
      "ammonia",
      "ammonium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "NH₃/NH₄⁺ 짝의 완충·양성자 교환·조성은 계산하지 않는다.",
    "documentCells": [
      "T044",
      "NH₃",
      "NH₄⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "NH₃/NH₄⁺ 짝의 완충·양성자 교환·조성은 계산하지 않는다."
    ]
  },
  {
    "id": "T045",
    "pair": [
      "ammonia",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Ag–NH₃ 착물이 알려져 있지만 단계 1 규칙은 없다(S05).",
    "documentCells": [
      "T045",
      "NH₃",
      "Ag⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Ag–NH₃ 착물이 알려져 있지만 단계 1 규칙은 없다(S05)."
    ]
  },
  {
    "id": "T046",
    "pair": [
      "ammonia",
      "chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "NH₃·Cl⁻ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다.",
    "documentCells": [
      "T046",
      "NH₃",
      "Cl⁻",
      "모름 · `NO_REVIEWED_RULE`",
      "NH₃·Cl⁻ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다."
    ]
  },
  {
    "id": "T047",
    "pair": [
      "ammonia",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "착물 형성과 AgCl 용해가 결합된 경우다(S05).",
    "documentCells": [
      "T047",
      "NH₃",
      "AgCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "착물 형성과 AgCl 용해가 결합된 경우다(S05)."
    ]
  },
  {
    "id": "T048",
    "pair": [
      "ammonia",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N25",
    "detail": "Na⁺가 NH₃와 산·염기 순반응을 하여 NH₄⁺를 만드는 것을 부정한다(S02, V02). NH₃와 물의 평형은 제외한다.",
    "documentCells": [
      "T048",
      "NH₃",
      "Na⁺",
      "검토된 부정 · N25",
      "Na⁺가 NH₃와 산·염기 순반응을 하여 NH₄⁺를 만드는 것을 부정한다(S02, V02). NH₃와 물의 평형은 제외한다."
    ]
  },
  {
    "id": "T049",
    "pair": [
      "ammonia",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "암모니아 용액의 고체 용해를 D01에 자동 결합하지 않는다.",
    "documentCells": [
      "T049",
      "NH₃",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "암모니아 용액의 고체 용해를 D01에 자동 결합하지 않는다."
    ]
  },
  {
    "id": "T050",
    "pair": [
      "ammonia",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "암모니아·금속·공기가 얽힌 표면 반응은 미등록이다.",
    "documentCells": [
      "T050",
      "NH₃",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "암모니아·금속·공기가 얽힌 표면 반응은 미등록이다."
    ]
  },
  {
    "id": "T051",
    "pair": [
      "ammonia",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "아연–암모니아 배위·종 분포 규칙이 없다.",
    "documentCells": [
      "T051",
      "NH₃",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "아연–암모니아 배위·종 분포 규칙이 없다."
    ]
  },
  {
    "id": "T052",
    "pair": [
      "ammonia",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "암모니아·구리·공기가 얽힌 표면 반응은 미등록이다.",
    "documentCells": [
      "T052",
      "NH₃",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "암모니아·구리·공기가 얽힌 표면 반응은 미등록이다."
    ]
  },
  {
    "id": "T053",
    "pair": [
      "ammonia",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "구리–암모니아 착물·침전의 결합 규칙이 없다.",
    "documentCells": [
      "T053",
      "NH₃",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "구리–암모니아 착물·침전의 결합 규칙이 없다."
    ]
  },
  {
    "id": "T054",
    "pair": [
      "ammonia",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "암모니아·은·공기가 얽힌 표면 반응은 미등록이다.",
    "documentCells": [
      "T054",
      "NH₃",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "암모니아·은·공기가 얽힌 표면 반응은 미등록이다."
    ]
  },
  {
    "id": "T055",
    "pair": [
      "ammonium",
      "ammonium"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "암모늄의 가수분해 평형을 동종 이온 접촉으로 실행하지 않는다.",
    "documentCells": [
      "T055",
      "NH₄⁺",
      "NH₄⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "암모늄의 가수분해 평형을 동종 이온 접촉으로 실행하지 않는다."
    ]
  },
  {
    "id": "T056",
    "pair": [
      "ammonium",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "NH₄⁺·Ag⁺에 대한 독립 두 재료 행이 없다.",
    "documentCells": [
      "T056",
      "NH₄⁺",
      "Ag⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "NH₄⁺·Ag⁺에 대한 독립 두 재료 행이 없다."
    ]
  },
  {
    "id": "T057",
    "pair": [
      "ammonium",
      "chloride"
    ],
    "kind": "no-reaction",
    "certificateId": "N12",
    "detail": "NH₄Cl 공유 분자·침전 생성을 부정한다(S01). NH₄⁺ 가수분해는 부정하지 않는다.",
    "documentCells": [
      "T057",
      "NH₄⁺",
      "Cl⁻",
      "검토된 부정 · N12",
      "NH₄Cl 공유 분자·침전 생성을 부정한다(S01). NH₄⁺ 가수분해는 부정하지 않는다."
    ]
  },
  {
    "id": "T058",
    "pair": [
      "ammonium",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "암모늄이 있는 AgCl 용해·종 분포를 계산하지 않는다.",
    "documentCells": [
      "T058",
      "NH₄⁺",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "암모늄이 있는 AgCl 용해·종 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T059",
    "pair": [
      "ammonium",
      "sodium-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "NH₄⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다.",
    "documentCells": [
      "T059",
      "NH₄⁺",
      "Na⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "NH₄⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다."
    ]
  },
  {
    "id": "T060",
    "pair": [
      "ammonium",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "암모늄 용액의 고체 용해를 D01에 자동 결합하지 않는다.",
    "documentCells": [
      "T060",
      "NH₄⁺",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "암모늄 용액의 고체 용해를 D01에 자동 결합하지 않는다."
    ]
  },
  {
    "id": "T061",
    "pair": [
      "ammonium",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "약산성 이온과 아연의 수소 발생·부식은 미등록이다.",
    "documentCells": [
      "T061",
      "NH₄⁺",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "약산성 이온과 아연의 수소 발생·부식은 미등록이다."
    ]
  },
  {
    "id": "T062",
    "pair": [
      "ammonium",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "암모늄·아연 이온의 가수분해·산도 분포를 계산하지 않는다.",
    "documentCells": [
      "T062",
      "NH₄⁺",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "암모늄·아연 이온의 가수분해·산도 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T063",
    "pair": [
      "ammonium",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "약산성 이온과 구리의 표면 반응은 미등록이다.",
    "documentCells": [
      "T063",
      "NH₄⁺",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "약산성 이온과 구리의 표면 반응은 미등록이다."
    ]
  },
  {
    "id": "T064",
    "pair": [
      "ammonium",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "암모늄·구리 이온의 가수분해·산도 분포를 계산하지 않는다.",
    "documentCells": [
      "T064",
      "NH₄⁺",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "암모늄·구리 이온의 가수분해·산도 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T065",
    "pair": [
      "ammonium",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "약산성 이온과 은의 표면 반응은 미등록이다.",
    "documentCells": [
      "T065",
      "NH₄⁺",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "약산성 이온과 은의 표면 반응은 미등록이다."
    ]
  },
  {
    "id": "T066",
    "pair": [
      "silver-ion",
      "silver-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Ag⁺끼리 전자 공급 없이 금속으로 바꾸지 않는다. 이 쌍의 포괄 부정 인증도 없다.",
    "documentCells": [
      "T066",
      "Ag⁺",
      "Ag⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Ag⁺끼리 전자 공급 없이 금속으로 바꾸지 않는다. 이 쌍의 포괄 부정 인증도 없다."
    ]
  },
  {
    "id": "T067",
    "pair": [
      "silver-ion",
      "chloride"
    ],
    "kind": "reacts",
    "eventId": "P01",
    "detail": "선택한 자유 Ag⁺·Cl⁻ 각 하나를 같은 AgCl 고체로 넣는다(C06).",
    "documentCells": [
      "T067",
      "Ag⁺",
      "Cl⁻",
      "양성 · P01",
      "선택한 자유 Ag⁺·Cl⁻ 각 하나를 같은 AgCl 고체로 넣는다(C06)."
    ]
  },
  {
    "id": "T068",
    "pair": [
      "silver-ion",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "공통 이온이 있는 용해 평형이다. Cl⁻ 없이 Ag⁺만 onto에 넣지 않는다.",
    "documentCells": [
      "T068",
      "Ag⁺",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "공통 이온이 있는 용해 평형이다. Cl⁻ 없이 Ag⁺만 onto에 넣지 않는다."
    ]
  },
  {
    "id": "T069",
    "pair": [
      "silver-ion",
      "sodium-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Ag⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다.",
    "documentCells": [
      "T069",
      "Ag⁺",
      "Na⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Ag⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다."
    ]
  },
  {
    "id": "T070",
    "pair": [
      "silver-ion",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "NaCl 용해와 AgCl 침전이 결합된 경우로 단일 P01·D01에 대신 넣지 않는다.",
    "documentCells": [
      "T070",
      "Ag⁺",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "NaCl 용해와 AgCl 침전이 결합된 경우로 단일 P01·D01에 대신 넣지 않는다."
    ]
  },
  {
    "id": "T071",
    "pair": [
      "silver-ion",
      "zinc-metal"
    ],
    "kind": "reacts",
    "eventId": "R02",
    "detail": "표면 Zn 하나와 자유 Ag⁺ 두 개가 필요하다. 한 개뿐이면 needs-material이다(C10).",
    "documentCells": [
      "T071",
      "Ag⁺",
      "Zn(s)",
      "양성 · R02",
      "표면 Zn 하나와 자유 Ag⁺ 두 개가 필요하다. 한 개뿐이면 needs-material이다(C10)."
    ]
  },
  {
    "id": "T072",
    "pair": [
      "silver-ion",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Ag⁺·Zn²⁺의 독립 두 재료 행이 없다. 금속 Zn으로 오인하지 않는다.",
    "documentCells": [
      "T072",
      "Ag⁺",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Ag⁺·Zn²⁺의 독립 두 재료 행이 없다. 금속 Zn으로 오인하지 않는다."
    ]
  },
  {
    "id": "T073",
    "pair": [
      "silver-ion",
      "copper-metal"
    ],
    "kind": "reacts",
    "eventId": "R03",
    "detail": "독립 Cu 표면 하나와 자유 Ag⁺ 두 개가 필요하다(C11).",
    "documentCells": [
      "T073",
      "Ag⁺",
      "Cu(s)",
      "양성 · R03",
      "독립 Cu 표면 하나와 자유 Ag⁺ 두 개가 필요하다(C11)."
    ]
  },
  {
    "id": "T074",
    "pair": [
      "silver-ion",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Ag⁺·Cu²⁺의 독립 두 재료 행이 없다. 금속 Cu로 오인하지 않는다.",
    "documentCells": [
      "T074",
      "Ag⁺",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Ag⁺·Cu²⁺의 독립 두 재료 행이 없다. 금속 Cu로 오인하지 않는다."
    ]
  },
  {
    "id": "T075",
    "pair": [
      "silver-ion",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Ag/Ag⁺의 전극 교환·평형을 새 순석출 사건으로 계산하지 않는다.",
    "documentCells": [
      "T075",
      "Ag⁺",
      "Ag(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Ag/Ag⁺의 전극 교환·평형을 새 순석출 사건으로 계산하지 않는다."
    ]
  },
  {
    "id": "T076",
    "pair": [
      "chloride",
      "chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Cl⁻끼리의 쌍을 산화제 없이 Cl₂로 바꾸지 않는다. 포괄 부정 인증은 없다.",
    "documentCells": [
      "T076",
      "Cl⁻",
      "Cl⁻",
      "모름 · `NO_REVIEWED_RULE`",
      "Cl⁻끼리의 쌍을 산화제 없이 Cl₂로 바꾸지 않는다. 포괄 부정 인증은 없다."
    ]
  },
  {
    "id": "T077",
    "pair": [
      "chloride",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "공통 이온·용해·염화물 착물의 범위를 계산하지 않는다.",
    "documentCells": [
      "T077",
      "Cl⁻",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "공통 이온·용해·염화물 착물의 범위를 계산하지 않는다."
    ]
  },
  {
    "id": "T078",
    "pair": [
      "chloride",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N01",
    "detail": "ordinary에서 NaCl의 순침전을 부정한다(S01).",
    "documentCells": [
      "T078",
      "Cl⁻",
      "Na⁺",
      "검토된 부정 · N01",
      "ordinary에서 NaCl의 순침전을 부정한다(S01)."
    ]
  },
  {
    "id": "T079",
    "pair": [
      "chloride",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Cl⁻ 공통 이온·포화가 있는 용해 양을 계산하지 않는다.",
    "documentCells": [
      "T079",
      "Cl⁻",
      "NaCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Cl⁻ 공통 이온·포화가 있는 용해 양을 계산하지 않는다."
    ]
  },
  {
    "id": "T080",
    "pair": [
      "chloride",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "염화물과 아연 표면의 부식·피막 효과는 미등록이다.",
    "documentCells": [
      "T080",
      "Cl⁻",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "염화물과 아연 표면의 부식·피막 효과는 미등록이다."
    ]
  },
  {
    "id": "T081",
    "pair": [
      "chloride",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "아연–염화물 종 분포에 대한 행·부정 인증이 없다.",
    "documentCells": [
      "T081",
      "Cl⁻",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "아연–염화물 종 분포에 대한 행·부정 인증이 없다."
    ]
  },
  {
    "id": "T082",
    "pair": [
      "chloride",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "염화물과 구리 표면의 부식·피막 효과는 미등록이다.",
    "documentCells": [
      "T082",
      "Cl⁻",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "염화물과 구리 표면의 부식·피막 효과는 미등록이다."
    ]
  },
  {
    "id": "T083",
    "pair": [
      "chloride",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "구리–염화물 종 분포에 대한 행·부정 인증이 없다.",
    "documentCells": [
      "T083",
      "Cl⁻",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "구리–염화물 종 분포에 대한 행·부정 인증이 없다."
    ]
  },
  {
    "id": "T084",
    "pair": [
      "chloride",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "염화물과 은 표면의 산화·피막 효과는 미등록이다.",
    "documentCells": [
      "T084",
      "Cl⁻",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "염화물과 은 표면의 산화·피막 효과는 미등록이다."
    ]
  },
  {
    "id": "T085",
    "pair": [
      "silver-chloride",
      "silver-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "두 고체의 접촉·응집·용해 평형을 침전 한 사건으로 대신하지 않는다.",
    "documentCells": [
      "T085",
      "AgCl(s)",
      "AgCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "두 고체의 접촉·응집·용해 평형을 침전 한 사건으로 대신하지 않는다."
    ]
  },
  {
    "id": "T086",
    "pair": [
      "silver-chloride",
      "sodium-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "AgCl의 배경 전해질·용해 평형은 계산하지 않는다.",
    "documentCells": [
      "T086",
      "AgCl(s)",
      "Na⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "AgCl의 배경 전해질·용해 평형은 계산하지 않는다."
    ]
  },
  {
    "id": "T087",
    "pair": [
      "silver-chloride",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "서로 다른 고체의 용해·공통 이온 결합 경로는 미등록이다.",
    "documentCells": [
      "T087",
      "AgCl(s)",
      "NaCl(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "서로 다른 고체의 용해·공통 이온 결합 경로는 미등록이다."
    ]
  },
  {
    "id": "T088",
    "pair": [
      "silver-chloride",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R02와 다른 행이다.",
    "documentCells": [
      "T088",
      "AgCl(s)",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R02와 다른 행이다."
    ]
  },
  {
    "id": "T089",
    "pair": [
      "silver-chloride",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "아연 이온이 있는 AgCl 용해·종 분포는 미계산이다.",
    "documentCells": [
      "T089",
      "AgCl(s)",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "아연 이온이 있는 AgCl 용해·종 분포는 미계산이다."
    ]
  },
  {
    "id": "T090",
    "pair": [
      "silver-chloride",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R03과 다른 행이다.",
    "documentCells": [
      "T090",
      "AgCl(s)",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R03과 다른 행이다."
    ]
  },
  {
    "id": "T091",
    "pair": [
      "silver-chloride",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "구리 이온이 있는 AgCl 용해·종 분포는 미계산이다.",
    "documentCells": [
      "T091",
      "AgCl(s)",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "구리 이온이 있는 AgCl 용해·종 분포는 미계산이다."
    ]
  },
  {
    "id": "T092",
    "pair": [
      "silver-chloride",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Ag/AgCl/Cl⁻ 전극·용해 평형은 미지원이다.",
    "documentCells": [
      "T092",
      "AgCl(s)",
      "Ag(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Ag/AgCl/Cl⁻ 전극·용해 평형은 미지원이다."
    ]
  },
  {
    "id": "T093",
    "pair": [
      "sodium-ion",
      "sodium-ion"
    ],
    "kind": "no-reaction",
    "certificateId": "N26",
    "detail": "두 Na⁺의 접촉을 산·염기 반응이나 새 중성 분자·염 결정 생성으로 처리하는 것을 부정한다(S01, S02).",
    "documentCells": [
      "T093",
      "Na⁺",
      "Na⁺",
      "검토된 부정 · N26",
      "두 Na⁺의 접촉을 산·염기 반응이나 새 중성 분자·염 결정 생성으로 처리하는 것을 부정한다(S01, S02)."
    ]
  },
  {
    "id": "T094",
    "pair": [
      "sodium-ion",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Na⁺ 공통 이온·포화가 있는 용해 양을 계산하지 않는다.",
    "documentCells": [
      "T094",
      "Na⁺",
      "NaCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Na⁺ 공통 이온·포화가 있는 용해 양을 계산하지 않는다."
    ]
  },
  {
    "id": "T095",
    "pair": [
      "sodium-ion",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "물속 아연의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다.",
    "documentCells": [
      "T095",
      "Na⁺",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "물속 아연의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다."
    ]
  },
  {
    "id": "T096",
    "pair": [
      "sodium-ion",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Na⁺·Zn²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다.",
    "documentCells": [
      "T096",
      "Na⁺",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Na⁺·Zn²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다."
    ]
  },
  {
    "id": "T097",
    "pair": [
      "sodium-ion",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "물속 구리의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다.",
    "documentCells": [
      "T097",
      "Na⁺",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "물속 구리의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다."
    ]
  },
  {
    "id": "T098",
    "pair": [
      "sodium-ion",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "Na⁺·Cu²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다.",
    "documentCells": [
      "T098",
      "Na⁺",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "Na⁺·Cu²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다."
    ]
  },
  {
    "id": "T099",
    "pair": [
      "sodium-ion",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "물속 은의 표면 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다.",
    "documentCells": [
      "T099",
      "Na⁺",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "물속 은의 표면 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다."
    ]
  },
  {
    "id": "T100",
    "pair": [
      "sodium-chloride",
      "sodium-chloride"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "두 소금 조각을 접촉시켜 용해량·포화·응집을 자동 결정하지 않는다.",
    "documentCells": [
      "T100",
      "NaCl(s)",
      "NaCl(s)",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "두 소금 조각을 접촉시켜 용해량·포화·응집을 자동 결정하지 않는다."
    ]
  },
  {
    "id": "T101",
    "pair": [
      "sodium-chloride",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "소금 용해와 아연 표면의 염화물 효과가 결합된 경우다.",
    "documentCells": [
      "T101",
      "NaCl(s)",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "소금 용해와 아연 표면의 염화물 효과가 결합된 경우다."
    ]
  },
  {
    "id": "T102",
    "pair": [
      "sodium-chloride",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "고체 용해와 아연 이온의 용액 종 분포를 묶은 행이 없다.",
    "documentCells": [
      "T102",
      "NaCl(s)",
      "Zn²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "고체 용해와 아연 이온의 용액 종 분포를 묶은 행이 없다."
    ]
  },
  {
    "id": "T103",
    "pair": [
      "sodium-chloride",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "소금 용해와 구리 표면의 염화물 효과가 결합된 경우다.",
    "documentCells": [
      "T103",
      "NaCl(s)",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "소금 용해와 구리 표면의 염화물 효과가 결합된 경우다."
    ]
  },
  {
    "id": "T104",
    "pair": [
      "sodium-chloride",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "고체 용해와 구리 이온의 용액 종 분포를 묶은 행이 없다.",
    "documentCells": [
      "T104",
      "NaCl(s)",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "고체 용해와 구리 이온의 용액 종 분포를 묶은 행이 없다."
    ]
  },
  {
    "id": "T105",
    "pair": [
      "sodium-chloride",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "소금 용해와 은 표면의 염화물 효과가 결합된 경우다.",
    "documentCells": [
      "T105",
      "NaCl(s)",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "소금 용해와 은 표면의 염화물 효과가 결합된 경우다."
    ]
  },
  {
    "id": "T106",
    "pair": [
      "zinc-metal",
      "zinc-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다.",
    "documentCells": [
      "T106",
      "Zn(s)",
      "Zn(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다."
    ]
  },
  {
    "id": "T107",
    "pair": [
      "zinc-metal",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Zn/Zn²⁺ 전극 교환·평형과 표면 상태를 계산하지 않는다.",
    "documentCells": [
      "T107",
      "Zn(s)",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Zn/Zn²⁺ 전극 교환·평형과 표면 상태를 계산하지 않는다."
    ]
  },
  {
    "id": "T108",
    "pair": [
      "zinc-metal",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "두 금속 접촉의 전기적 연결·부식을 R01로 대신하지 않는다. Cu²⁺가 없다.",
    "documentCells": [
      "T108",
      "Zn(s)",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "두 금속 접촉의 전기적 연결·부식을 R01로 대신하지 않는다. Cu²⁺가 없다."
    ]
  },
  {
    "id": "T109",
    "pair": [
      "zinc-metal",
      "copper-ion"
    ],
    "kind": "reacts",
    "eventId": "R01",
    "detail": "Zn 표면 원자 하나가 Cu²⁺ 하나에 전자 두 개를 준다(C09).",
    "documentCells": [
      "T109",
      "Zn(s)",
      "Cu²⁺",
      "양성 · R01",
      "Zn 표면 원자 하나가 Cu²⁺ 하나에 전자 두 개를 준다(C09)."
    ]
  },
  {
    "id": "T110",
    "pair": [
      "zinc-metal",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "두 금속 접촉의 전기적 연결·부식을 R02로 대신하지 않는다. Ag⁺가 없다.",
    "documentCells": [
      "T110",
      "Zn(s)",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "두 금속 접촉의 전기적 연결·부식을 R02로 대신하지 않는다. Ag⁺가 없다."
    ]
  },
  {
    "id": "T111",
    "pair": [
      "zinc-ion",
      "zinc-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "수화 아연 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다.",
    "documentCells": [
      "T111",
      "Zn²⁺",
      "Zn²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "수화 아연 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다."
    ]
  },
  {
    "id": "T112",
    "pair": [
      "zinc-ion",
      "copper-metal"
    ],
    "kind": "no-reaction",
    "certificateId": "N15",
    "detail": "Cu에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C12).",
    "documentCells": [
      "T112",
      "Zn²⁺",
      "Cu(s)",
      "검토된 부정 · N15",
      "Cu에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C12)."
    ]
  },
  {
    "id": "T113",
    "pair": [
      "zinc-ion",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "두 금속 이온의 가수분해·종 분포에 대한 독립 행이 없다.",
    "documentCells": [
      "T113",
      "Zn²⁺",
      "Cu²⁺",
      "모름 · `NO_REVIEWED_RULE`",
      "두 금속 이온의 가수분해·종 분포에 대한 독립 행이 없다."
    ]
  },
  {
    "id": "T114",
    "pair": [
      "zinc-ion",
      "silver-metal"
    ],
    "kind": "no-reaction",
    "certificateId": "N16",
    "detail": "Ag에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C13).",
    "documentCells": [
      "T114",
      "Zn²⁺",
      "Ag(s)",
      "검토된 부정 · N16",
      "Ag에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C13)."
    ]
  },
  {
    "id": "T115",
    "pair": [
      "copper-metal",
      "copper-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다.",
    "documentCells": [
      "T115",
      "Cu(s)",
      "Cu(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다."
    ]
  },
  {
    "id": "T116",
    "pair": [
      "copper-metal",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "Cu/Cu²⁺의 전극 교환·다른 산화수 분포를 계산하지 않는다.",
    "documentCells": [
      "T116",
      "Cu(s)",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "Cu/Cu²⁺의 전극 교환·다른 산화수 분포를 계산하지 않는다."
    ]
  },
  {
    "id": "T117",
    "pair": [
      "copper-metal",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "두 금속 접촉의 전기적 연결·부식을 R03으로 대신하지 않는다. Ag⁺가 없다.",
    "documentCells": [
      "T117",
      "Cu(s)",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "두 금속 접촉의 전기적 연결·부식을 R03으로 대신하지 않는다. Ag⁺가 없다."
    ]
  },
  {
    "id": "T118",
    "pair": [
      "copper-ion",
      "copper-ion"
    ],
    "kind": "unknown",
    "reason": "EQUILIBRIUM_REQUIRED",
    "detail": "수화 구리 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다.",
    "documentCells": [
      "T118",
      "Cu²⁺",
      "Cu²⁺",
      "모름 · `EQUILIBRIUM_REQUIRED`",
      "수화 구리 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다."
    ]
  },
  {
    "id": "T119",
    "pair": [
      "copper-ion",
      "silver-metal"
    ],
    "kind": "no-reaction",
    "certificateId": "N17",
    "detail": "Ag에 의한 Cu²⁺의 지속적인 Cu 순석출을 참고 구간에서 부정한다(C14).",
    "documentCells": [
      "T119",
      "Cu²⁺",
      "Ag(s)",
      "검토된 부정 · N17",
      "Ag에 의한 Cu²⁺의 지속적인 Cu 순석출을 참고 구간에서 부정한다(C14)."
    ]
  },
  {
    "id": "T120",
    "pair": [
      "silver-metal",
      "silver-metal"
    ],
    "kind": "unknown",
    "reason": "NO_REVIEWED_RULE",
    "detail": "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다.",
    "documentCells": [
      "T120",
      "Ag(s)",
      "Ag(s)",
      "모름 · `NO_REVIEWED_RULE`",
      "금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다."
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const NEGATIVE_CERTIFICATES = freezeData(([
  {
    "id": "N01",
    "pair": [
      "chloride",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "chloride",
      "sodium-ion"
    ],
    "scope": "ordinary에서 Na⁺+Cl⁻의 NaCl 순침전; S01",
    "title": "소금 결정으로 뭉치지 않아요",
    "detail": "이 묽은 물속에서는 두 이온이 따로 남아요. 농축하거나 물을 말리는 경우는 다루지 않아요.",
    "documentCells": [
      "N01",
      "ordinary에서 Na⁺+Cl⁻의 NaCl 순침전; S01",
      "소금 결정으로 뭉치지 않아요",
      "이 묽은 물속에서는 두 이온이 따로 남아요. 농축하거나 물을 말리는 경우는 다루지 않아요."
    ]
  },
  {
    "id": "N07",
    "pair": [
      "hydroxide",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "hydroxide",
      "sodium-ion"
    ],
    "scope": "NaOH 공유 분자·침전의 생성; S01의 알칼리 금속 가용성",
    "title": "두 이온은 따로 남아요",
    "detail": "이 조건에서는 Na⁺와 OH⁻를 한 분자로 묶지 않아요.",
    "documentCells": [
      "N07",
      "NaOH 공유 분자·침전의 생성; S01의 알칼리 금속 가용성",
      "두 이온은 따로 남아요",
      "이 조건에서는 Na⁺와 OH⁻를 한 분자로 묶지 않아요."
    ]
  },
  {
    "id": "N09",
    "pair": [
      "hydronium",
      "chloride"
    ],
    "allowedContextSpecies": [
      "water",
      "hydronium",
      "chloride"
    ],
    "scope": "HCl 분자가 주된 생성물로 남는 순변화; S03",
    "title": "이온으로 남아요",
    "detail": "이 묽은 물속에서는 H₃O⁺와 Cl⁻로 나타내요. 순간적인 만남까지 없다는 뜻은 아니에요.",
    "documentCells": [
      "N09",
      "HCl 분자가 주된 생성물로 남는 순변화; S03",
      "이온으로 남아요",
      "이 묽은 물속에서는 H₃O⁺와 Cl⁻로 나타내요. 순간적인 만남까지 없다는 뜻은 아니에요."
    ]
  },
  {
    "id": "N12",
    "pair": [
      "ammonium",
      "chloride"
    ],
    "allowedContextSpecies": [
      "water",
      "ammonium",
      "chloride"
    ],
    "scope": "NH₄Cl 공유 분자·침전의 생성; S01",
    "title": "두 이온은 따로 남아요",
    "detail": "NH₄⁺와 Cl⁻를 한 분자나 결정으로 묶지 않아요. NH₄⁺와 물 사이의 평형은 따로 계산하지 않아요.",
    "documentCells": [
      "N12",
      "NH₄Cl 공유 분자·침전의 생성; S01",
      "두 이온은 따로 남아요",
      "NH₄⁺와 Cl⁻를 한 분자나 결정으로 묶지 않아요. NH₄⁺와 물 사이의 평형은 따로 계산하지 않아요."
    ]
  },
  {
    "id": "N15",
    "pair": [
      "zinc-ion",
      "copper-metal"
    ],
    "allowedContextSpecies": [
      "water",
      "zinc-ion",
      "copper-metal"
    ],
    "scope": "Cu에 의한 Zn²⁺의 지속적인 Zn 순석출; C12의 참고 구간",
    "title": "아연 금속이 생기지 않아요",
    "detail": "이 참고 조건에서 구리가 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요.",
    "documentCells": [
      "N15",
      "Cu에 의한 Zn²⁺의 지속적인 Zn 순석출; C12의 참고 구간",
      "아연 금속이 생기지 않아요",
      "이 참고 조건에서 구리가 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요."
    ]
  },
  {
    "id": "N16",
    "pair": [
      "zinc-ion",
      "silver-metal"
    ],
    "allowedContextSpecies": [
      "water",
      "zinc-ion",
      "silver-metal"
    ],
    "scope": "Ag에 의한 Zn²⁺의 지속적인 Zn 순석출; C13",
    "title": "아연 금속이 생기지 않아요",
    "detail": "이 참고 조건에서 은이 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요.",
    "documentCells": [
      "N16",
      "Ag에 의한 Zn²⁺의 지속적인 Zn 순석출; C13",
      "아연 금속이 생기지 않아요",
      "이 참고 조건에서 은이 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요."
    ]
  },
  {
    "id": "N17",
    "pair": [
      "copper-ion",
      "silver-metal"
    ],
    "allowedContextSpecies": [
      "water",
      "copper-ion",
      "silver-metal"
    ],
    "scope": "Ag에 의한 Cu²⁺의 지속적인 Cu 순석출; C14",
    "title": "구리 금속이 생기지 않아요",
    "detail": "이 참고 조건에서 은이 구리 이온을 구리 금속으로 바꾸는 방향은 지지되지 않아요.",
    "documentCells": [
      "N17",
      "Ag에 의한 Cu²⁺의 지속적인 Cu 순석출; C14",
      "구리 금속이 생기지 않아요",
      "이 참고 조건에서 은이 구리 이온을 구리 금속으로 바꾸는 방향은 지지되지 않아요."
    ]
  },
  {
    "id": "N21",
    "pair": [
      "water",
      "chloride"
    ],
    "allowedContextSpecies": [
      "water",
      "chloride"
    ],
    "scope": "Cl⁻의 물 가수분해로 눈에 띄는 HCl·OH⁻ 생성; S02",
    "title": "염화 이온으로 남아요",
    "detail": "물이 주변을 둘러쌀 수 있지만, 이 조건에서 가수분해로 바뀌는 양은 무시할 수 있어요.",
    "documentCells": [
      "N21",
      "Cl⁻의 물 가수분해로 눈에 띄는 HCl·OH⁻ 생성; S02",
      "염화 이온으로 남아요",
      "물이 주변을 둘러쌀 수 있지만, 이 조건에서 가수분해로 바뀌는 양은 무시할 수 있어요."
    ]
  },
  {
    "id": "N22",
    "pair": [
      "water",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion"
    ],
    "scope": "Na⁺ 수화 이온의 산·염기 가수분해로 새 종 생성; S02",
    "title": "나트륨 이온으로 남아요",
    "detail": "물이 주변을 둘러싸도, 이 조건에서는 산·염기 반응으로 새 물질이 생기는 것으로 다루지 않아요.",
    "documentCells": [
      "N22",
      "Na⁺ 수화 이온의 산·염기 가수분해로 새 종 생성; S02",
      "나트륨 이온으로 남아요",
      "물이 주변을 둘러싸도, 이 조건에서는 산·염기 반응으로 새 물질이 생기는 것으로 다루지 않아요."
    ]
  },
  {
    "id": "N23",
    "pair": [
      "hydronium",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "hydronium",
      "sodium-ion"
    ],
    "scope": "Na⁺에 의한 H₃O⁺ 중화·산염기 생성물 형성; S02의 Salts with Basic Ions, Na⁺ 문단",
    "title": "나트륨 이온은 중화에 참여하지 않아요",
    "detail": "Na⁺가 H₃O⁺의 수소를 받아 중화하는 반응은 없어요. 물의 움직임이나 수소 교환까지 없다는 뜻은 아니에요.",
    "documentCells": [
      "N23",
      "Na⁺에 의한 H₃O⁺ 중화·산염기 생성물 형성; S02의 Salts with Basic Ions, Na⁺ 문단",
      "나트륨 이온은 중화에 참여하지 않아요",
      "Na⁺가 H₃O⁺의 수소를 받아 중화하는 반응은 없어요. 물의 움직임이나 수소 교환까지 없다는 뜻은 아니에요."
    ]
  },
  {
    "id": "N24",
    "pair": [
      "hydroxide",
      "chloride"
    ],
    "allowedContextSpecies": [
      "water",
      "hydroxide",
      "chloride"
    ],
    "scope": "OH⁻·Cl⁻의 중화 및 HCl이 주된 생성물이 되는 순변화; S02의 Salts with Acidic Ions, Cl⁻ 문단과 S03의 HCl 설명",
    "title": "두 이온은 서로 중화하지 않아요",
    "detail": "Cl⁻는 OH⁻와 만나 물을 만드는 산으로 작용하지 않아요. 이 묽은 물속에서 HCl 분자로 바꾸어 그리지 않아요.",
    "documentCells": [
      "N24",
      "OH⁻·Cl⁻의 중화 및 HCl이 주된 생성물이 되는 순변화; S02의 Salts with Acidic Ions, Cl⁻ 문단과 S03의 HCl 설명",
      "두 이온은 서로 중화하지 않아요",
      "Cl⁻는 OH⁻와 만나 물을 만드는 산으로 작용하지 않아요. 이 묽은 물속에서 HCl 분자로 바꾸어 그리지 않아요."
    ]
  },
  {
    "id": "N25",
    "pair": [
      "ammonia",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "ammonia",
      "sodium-ion"
    ],
    "scope": "Na⁺가 참여하는 NH₃의 산·염기 전환; S02 Na⁺ 문단과 V02",
    "title": "나트륨 이온은 이 반응에 참여하지 않아요",
    "detail": "Na⁺가 암모니아에 수소를 주거나 받는 반응은 없어요. 암모니아와 물은 일부 반응할 수 있지만, 그 비율은 계산하지 않아요.",
    "documentCells": [
      "N25",
      "Na⁺가 참여하는 NH₃의 산·염기 전환; S02 Na⁺ 문단과 V02",
      "나트륨 이온은 이 반응에 참여하지 않아요",
      "Na⁺가 암모니아에 수소를 주거나 받는 반응은 없어요. 암모니아와 물은 일부 반응할 수 있지만, 그 비율은 계산하지 않아요."
    ]
  },
  {
    "id": "N26",
    "pair": [
      "sodium-ion",
      "sodium-ion"
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion"
    ],
    "scope": "Na⁺ 두 개의 산·염기 전환·중성 분자·염 결정 형성; S02 Na⁺ 문단, S01, 전하 보존",
    "title": "나트륨 이온 둘로 남아요",
    "detail": "Na⁺ 둘을 중성 분자나 소금 결정으로 묶지 않아요. 주변 물과의 상호작용은 있을 수 있어요.",
    "documentCells": [
      "N26",
      "Na⁺ 두 개의 산·염기 전환·중성 분자·염 결정 형성; S02 Na⁺ 문단, S01, 전하 보존",
      "나트륨 이온 둘로 남아요",
      "Na⁺ 둘을 중성 분자나 소금 결정으로 묶지 않아요. 주변 물과의 상호작용은 있을 수 있어요."
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export const EVENTS = freezeData(([
  {
    "id": "A01",
    "equation": "H₃O⁺ + OH⁻ → H₂O + H₂O",
    "evidenceText": "V01, C03이다. 맥락은 §6.1 A01 행이다.",
    "requirements": [
      {
        "speciesId": "hydronium",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "hydroxide",
        "count": 1,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "water",
        "count": 2
      }
    ],
    "allowedContextSpecies": [
      "water",
      "hydronium",
      "hydroxide",
      "ammonia",
      "ammonium",
      "sodium-ion",
      "chloride"
    ],
    "competingSpecies": [],
    "contextDocumentCells": [
      "A01",
      "H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻",
      "목록 밖은 CONTEXT_UNREVIEWED; 선택한 한 양성자 이동만 실행"
    ],
    "template": "step \"수소가 옮겨질 자리가 가까워져요\"\n  approach b.O a.H1\nstep \"수소가 옮겨가요\"\n  transfer a.H1 to b.O",
    "title": "물 분자 둘이 되었어요.",
    "detail": "H₃O⁺의 수소 하나를 OH⁻가 받았어요. 수소가 옮겨지고 두 산소에 전자쌍이 남는 모습을 보여 줘요.",
    "electronTransfers": 0,
    "requiredCapabilities": [
      "compile-from"
    ]
  },
  {
    "id": "A02",
    "equation": "H₃O⁺ + NH₃ → H₂O + NH₄⁺",
    "evidenceText": "V01–V02, C02·C04다. 맥락은 §6.1 A02 행이다.",
    "requirements": [
      {
        "speciesId": "hydronium",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "ammonia",
        "count": 1,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "water",
        "count": 1
      },
      {
        "speciesId": "ammonium",
        "count": 1
      }
    ],
    "allowedContextSpecies": [
      "water",
      "hydronium",
      "hydroxide",
      "ammonia",
      "ammonium",
      "sodium-ion",
      "chloride"
    ],
    "competingSpecies": [],
    "contextDocumentCells": [
      "A02",
      "H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻",
      "A01과 같음; 전체 산·염기 생성물 분포를 정하지 않음"
    ],
    "template": "step \"수소가 옮겨질 자리가 가까워져요\"\n  approach b.N a.H1\nstep \"암모니아가 수소를 받아요\"\n  transfer a.H1 to b.N",
    "title": "암모늄 이온이 되었어요.",
    "detail": "암모니아의 질소가 H₃O⁺에서 수소 하나를 받았어요. H₃O⁺는 물이 되었어요.",
    "electronTransfers": 0,
    "requiredCapabilities": [
      "compile-from"
    ]
  },
  {
    "id": "A05",
    "equation": "NH₄⁺ + OH⁻ → NH₃ + H₂O",
    "evidenceText": "V02, C05다. 맥락은 §6.1 A05 행이다.",
    "requirements": [
      {
        "speciesId": "ammonium",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "hydroxide",
        "count": 1,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "ammonia",
        "count": 1
      },
      {
        "speciesId": "water",
        "count": 1
      }
    ],
    "allowedContextSpecies": [
      "water",
      "hydronium",
      "hydroxide",
      "ammonia",
      "ammonium",
      "sodium-ion",
      "chloride"
    ],
    "competingSpecies": [],
    "contextDocumentCells": [
      "A05",
      "H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻",
      "A01과 같음; NH₄⁺의 생성 이력 대신 현재 N–H 결합 검사"
    ],
    "template": "step \"수소가 옮겨질 자리가 가까워져요\"\n  approach o.O n.H1\nstep \"암모늄 이온이 수소를 내줘요\"\n  transfer n.H1 to o.O",
    "title": "암모니아와 물이 되었어요.",
    "detail": "OH⁻가 암모늄 이온에서 수소 하나를 받았어요. 이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요.",
    "electronTransfers": 0,
    "requiredCapabilities": [
      "compile-from"
    ]
  },
  {
    "id": "P01",
    "equation": "Ag⁺ + Cl⁻ → AgCl(s)",
    "evidenceText": "V03, C06–C07, S04다. 맥락은 §6.1 P01 행이다.",
    "requirements": [
      {
        "speciesId": "silver-ion",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "chloride",
        "count": 1,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "silver-chloride",
        "count": 1
      }
    ],
    "allowedContextSpecies": [
      "water",
      "silver-ion",
      "chloride",
      "silver-chloride",
      "sodium-ion"
    ],
    "competingSpecies": [],
    "contextDocumentCells": [
      "P01",
      "H₂O, Ag⁺, Cl⁻, AgCl(s), Na⁺",
      "NH₃·OH⁻·금속·NaCl(s) 등 목록 밖은 CONTEXT_UNREVIEWED; onto는 순수 AgCl 고체만"
    ],
    "template": "step \"염화 은 고체에 모여요\"\n  precipitate using a b",
    "ontoTemplate": "step \"있던 염화 은 고체가 커져요\"\n  precipitate using a b onto s",
    "ontoTitle": "염화 은 고체가 커졌어요.",
    "title": "염화 은 고체가 생겼어요.",
    "detail": "Ag⁺와 Cl⁻가 전하를 그대로 가진 채 고체에 모였어요. 작은 판은 고체의 한 부분을 나타내요. 실제 결정이 생기는 속도나 녹아 남는 양은 계산하지 않아요.",
    "electronTransfers": 0,
    "requiredCapabilities": [
      "compile-from",
      "selected-precipitation"
    ]
  },
  {
    "id": "D01",
    "equation": "NaCl(s) → Na⁺ + Cl⁻, 물은 용매",
    "evidenceText": "S01·S03이다. 맥락은 §6.1 D01 행이다. 충분한 물의 묽은 참고 상태에서 고체 한 단위가 분리되는 사건이며 포화 계산이 아니다.",
    "requirements": [
      {
        "speciesId": "sodium-chloride",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "water",
        "count": 1,
        "consumed": false
      }
    ],
    "products": [
      {
        "speciesId": "sodium-ion",
        "count": 1
      },
      {
        "speciesId": "chloride",
        "count": 1
      }
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion",
      "chloride",
      "sodium-chloride"
    ],
    "competingSpecies": [],
    "contextDocumentCells": [
      "D01",
      "H₂O, Na⁺, Cl⁻, NaCl(s)",
      "Ag⁺가 있으면 결합된 용해·침전 문제로 CONTEXT_UNREVIEWED; 양·포화·공통 이온 정량은 계산하지 않음"
    ],
    "template": "step \"소금 결정에서 이온이 나와요\"\n  dissolve s1 s2 from s",
    "title": "소금에서 이온 한 쌍이 나왔어요.",
    "detail": "Na⁺와 Cl⁻가 결정에서 나와 물에 둘러싸였어요. 물 분자가 소모되는 반응은 아니에요. 녹을 수 있는 총량은 계산하지 않아요.",
    "electronTransfers": 0,
    "requiredCapabilities": [
      "compile-from"
    ]
  },
  {
    "id": "R01",
    "equation": "Zn(s) + Cu²⁺ → Zn²⁺ + Cu(s)",
    "evidenceText": "V05–V06, C09, S07이다. 맥락은 §6.1 R01 행이다.",
    "requirements": [
      {
        "speciesId": "zinc-metal",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "copper-ion",
        "count": 1,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "zinc-ion",
        "count": 1
      },
      {
        "speciesId": "copper-metal",
        "count": 1
      }
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion",
      "zinc-metal",
      "zinc-ion",
      "copper-metal",
      "copper-ion",
      "silver-metal"
    ],
    "competingSpecies": [
      "silver-ion"
    ],
    "contextDocumentCells": [
      "R01",
      "H₂O, Na⁺, Zn(s), Zn²⁺, Cu(s), Cu²⁺, Ag(s)",
      "Ag⁺도 있으면 같은 Zn의 수용체 경쟁으로 COMPETING_PATHWAYS"
    ],
    "template": "step \"구리 이온이 금속 표면에 닿아요\"\n  land u on m3\nstep \"전자 두 개가 차례로 옮겨가요\"\n  hop m3.Zn -> u.Cu\n  hop m3.Zn -> u.Cu\n  join u to m\nstep \"아연 이온이 물속으로 나와요\"\n  leave m3 from m",
    "fixtureHeader": "crowd H2O in water 12\nmetal m = Zn at 420,330 3x2\nmol u = Cu2+ at 650,260",
    "title": "구리가 붙고 아연 이온이 나왔어요.",
    "detail": "아연이 내준 전자 두 개를 구리 이온이 받아 금속이 되었어요. 점은 전자가 옮겨가는 수를 보여 줘요. 실제 이동 경로나 반응 속도는 나타내지 않아요.",
    "electronTransfers": 2,
    "requiredCapabilities": [
      "compile-from",
      "metal-surface-v1"
    ]
  },
  {
    "id": "R02",
    "equation": "Zn(s) + 2Ag⁺ → Zn²⁺ + 2Ag(s)",
    "evidenceText": "V04·V06, C10, S07이다. 맥락은 §6.1 R02 행이다.",
    "requirements": [
      {
        "speciesId": "zinc-metal",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "silver-ion",
        "count": 2,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "zinc-ion",
        "count": 1
      },
      {
        "speciesId": "silver-metal",
        "count": 2
      }
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion",
      "zinc-metal",
      "zinc-ion",
      "silver-metal",
      "silver-ion"
    ],
    "competingSpecies": [
      "copper-ion",
      "copper-metal"
    ],
    "contextDocumentCells": [
      "R02",
      "H₂O, Na⁺, Zn(s), Zn²⁺, Ag(s), Ag⁺",
      "Cu²⁺는 수용체 경쟁, Cu(s)는 공여체 경쟁으로 COMPETING_PATHWAYS"
    ],
    "template": "step \"은 이온 둘이 금속 표면에 닿아요\"\n  land a1 a2 on m3\nstep \"전자가 하나씩 은 이온으로 옮겨가요\"\n  hop m3.Zn -> a1.Ag\n  hop m3.Zn -> a2.Ag\n  join a1 a2 to m\nstep \"아연 이온이 물속으로 나와요\"\n  leave m3 from m",
    "fixtureHeader": "crowd H2O in water 12\nmetal m = Zn at 420,330 3x2\nmol a1 = Ag+ at 640,200\nmol a2 = Ag+ at 700,330",
    "title": "은이 붙고 아연 이온이 나왔어요.",
    "detail": "아연이 내준 전자를 은 이온 둘이 하나씩 받았어요. 은은 금속 표면에 붙고 아연 이온은 물속으로 나왔어요. 점은 이동한 전자 수를 나타내요.",
    "electronTransfers": 2,
    "requiredCapabilities": [
      "compile-from",
      "metal-surface-v1"
    ]
  },
  {
    "id": "R03",
    "equation": "Cu(s) + 2Ag⁺ → Cu²⁺ + 2Ag(s)",
    "evidenceText": "V04–V05, C11, S07이다. 맥락은 §6.1 R03 행이다.",
    "requirements": [
      {
        "speciesId": "copper-metal",
        "count": 1,
        "consumed": true
      },
      {
        "speciesId": "silver-ion",
        "count": 2,
        "consumed": true
      }
    ],
    "products": [
      {
        "speciesId": "copper-ion",
        "count": 1
      },
      {
        "speciesId": "silver-metal",
        "count": 2
      }
    ],
    "allowedContextSpecies": [
      "water",
      "sodium-ion",
      "zinc-ion",
      "copper-metal",
      "copper-ion",
      "silver-metal",
      "silver-ion"
    ],
    "competingSpecies": [
      "zinc-metal"
    ],
    "contextDocumentCells": [
      "R03",
      "H₂O, Na⁺, Zn²⁺, Cu(s), Cu²⁺, Ag(s), Ag⁺",
      "Zn(s)가 활성 무대나 접촉 금속 조각에 남으면 공여체 경쟁으로 COMPETING_PATHWAYS"
    ],
    "template": "step \"은 이온 둘이 금속 표면에 닿아요\"\n  land a1 a2 on m3\nstep \"전자가 하나씩 은 이온으로 옮겨가요\"\n  hop m3.Cu -> a1.Ag\n  hop m3.Cu -> a2.Ag\n  join a1 a2 to m\nstep \"구리 이온이 물속으로 나와요\"\n  leave m3 from m",
    "fixtureHeader": "crowd H2O in water 12\nmetal m = Cu at 420,330 3x2\nmol a1 = Ag+ at 640,200\nmol a2 = Ag+ at 700,330",
    "title": "은이 붙고 구리 이온이 나왔어요.",
    "detail": "구리가 내준 전자를 은 이온 둘이 하나씩 받았어요. 은은 금속 표면에 붙고 구리 이온은 물속으로 나왔어요. 점은 이동한 전자 수를 나타내요.",
    "electronTransfers": 2,
    "requiredCapabilities": [
      "compile-from",
      "metal-surface-v1"
    ]
  }
] as const).map(row => ({ ...row, conditions: CONDITIONS, review: REVIEW })));

export type SpeciesId = typeof MATERIALS[number]['id'];
export type Phase = typeof MATERIALS[number]['phase'];
export type EventId = typeof EVENTS[number]['id'];
export type EventRow = typeof EVENTS[number];
export type ContactRow = typeof CONTACT_ROWS[number];
export type CertificateId = typeof NEGATIVE_CERTIFICATES[number]['id'];
export const MATERIAL_BY_ID: Readonly<Record<SpeciesId, typeof MATERIALS[number]>> = freezeData(
  Object.fromEntries(MATERIALS.map(row => [row.id, row])) as Record<SpeciesId, typeof MATERIALS[number]>,
);
export const EVENT_BY_ID = freezeData(
  Object.fromEntries(EVENTS.map(row => [row.id, row])) as { readonly [Id in EventId]: Extract<EventRow, { id: Id }> },
);

/** 문서 C01–C15의 계산을 재현한다. 입자 개수는 계산 입력으로 받지 않는다. */
export function deriveStage1Numbers() {
  const [kw, kb, ksp, ag, cu, zn, r, f] = NUMERIC_ROWS.map(row => row.value);
  const ka = kw / kb;
  const b = Math.log(10) * r * 298.15 / f;
  const roundedB = 0.05916;
  const redox = (e0: number, q: readonly [number, number]) => ({
    e0, q, e: [e0 - roundedB * Math.log10(q[1]) / 2, e0 - roundedB * Math.log10(q[0]) / 2],
    logK: 2 * e0 / b,
  });
  const c09 = redox(cu - zn, [0.1, 10]);
  const c10 = redox(ag - zn, [10, 1e4]);
  const c11 = redox(ag - cu, [10, 1e4]);
  return {
    C01: { pKw: -Math.log10(kw) }, C02: { ka, pKa: -Math.log10(ka) },
    C03: { logK: -Math.log10(kw) }, C04: { logK: -Math.log10(ka) },
    C05: { logK: -Math.log10(kb) }, C06: { ratio: [1e-6 / ksp, 1e-4 / ksp] },
    C07: { logK: -Math.log10(ksp) }, C08: { b, roundedB },
    C09: c09, C10: c10, C11: c11,
    C12: { e: [-c09.e[1], -c09.e[0]] }, C13: { e: [-c10.e[1], -c10.e[0]] },
    C14: { e: [-c11.e[1], -c11.e[0]] }, C15: { q: [10, 1e4], kOverQ: [1 / kb / 1e4, 1 / kb / 10] },
  };
}
