# 실험실 단계 1 자료 행

- 작성 모델: Astra(이 설계 협의의 작성 역할)
- 작성일: 2026-11-11
- 기준 커밋: `56ea710`
- 상태: **2판 · draft, 변경 행 대조 전** — F1–F3 반영, 검토 기준 `0dc74b3`
- 조합 수: **120행 = 양성 8 · 부정 인증 초안 13 · 모름 99**
- 검토 방식: 작성 모델의 원문 열람 → Claude의 독립 원문 대조 → 계산·맥락·표현·인수 시험 확인이다. 현재 `reviewer`는 미지정이며, 완료 후 `reviewer: '모델 대조'`와 실제 대조 모델·실행 기록을 함께 저장한다.

이 문서는 단계 1의 자료 초안과 구현 인수 기준이다. 수치 원문을 이번에 읽었다는 사실과 다른 모델의 대조를 통과했다는 사실은 다르다. 여기서 ‘검토된 부정’은 구현할 판정 종류이며, 현재 승인 완료 상태라는 뜻이 아니다. 모든 행은 아직 `draft`다. 1판의 수치 대조 기록은 `lab-decisions.md` §5에 있으며, 이 판에서 바뀐 문구·조건 설명과 신규 인증은 다시 대조한다.

## 1. 먼저 막아야 할 잘못된 해석

1. **아연 위의 구리를 독립된 구리 조각처럼 취급하지 않는다.** R01 후 Zn이 남은 조각에 Cu가 붙어 있을 때 Ag⁺를 더하면 Zn도 전자를 줄 수 있다. Cu 자리만 집어 R03을 실행하지 않고 `COMPETING_PATHWAYS`로 둔다. 이는 아래 전위 자료와 두 양성 경로에서 도출한 설계 판단이며, 해당 미세 표면의 반응 순서를 측정했다는 주장이 아니다.
2. **한 쌍의 AgCl 그림을 실제로 안정한 두 이온짜리 결정핵이라고 부르지 않는다.** 고체의 조성 한 단위를 나타내는 모형이다. 세 쌍을 제공하는 것은 그림을 읽기 쉽게 만드는 제품 선택이며 핵생성 임계값이 아니다.
3. **금속의 `lp/rad`를 실제 국소 전자 배치로 설명하지 않는다.** 현재 엔진의 Zn·Cu·Ag 전자 장부이며, 금속의 전도 전자는 조각에 퍼져 있다. 특히 Cu의 `lp=1`을 실제 구리 원자의 비공유 전자쌍이라고 가르치지 않는다.
4. **‘모름’을 ‘반응하지 않음’으로 바꾸지 않는다.** 착물, 수산화물·산화물, 부식, 공통 이온, 포화, 평형 분포는 여덟 양성 사건의 빈칸을 임의로 메울 근거가 아니다.

### 확인한 사실과 정한 계약

이하 엔진 구현 현황과 금속 대본의 설명은 1판 작성 당시를 기준으로 읽는다. 2판의 검토 기준 `0dc74b3`에는 E2의 `using/onto/as`와 `metal/land/join/leave`가 이미 들어 있다. 이번 작업에서는 E1과 `addSpecies`도 구현하며, 그 검사는 `tests/unit/compile-from.test.ts`에 둔다. 이 판의 자료 행 수정 범위는 F1–F3이며, §7의 금속 대본을 새 명령으로 옮기거나 그 표현까지 검증 완료했다고 주장하지 않는다.

저장소에서 확인한 사실은 다음과 같다. `src/chem/library.ts`는 H₃O⁺의 수소를 `H1..H3`, OH⁻의 수소를 `H`, NH₄⁺의 수소를 `H1..H4`로 만든다. Zn·Cu의 중성 모형은 `lp=1, rad=0`, Ag는 `lp=0, rad=1`이다. 현재 `hop`은 전자 장부를 바꾸지만 금속의 상·조각 소속을 완성하지 않는다. 현재 `precipitate`는 화학식으로 입자를 골라 사용하므로, 아래의 `using`은 합의한 E2 구현 뒤에 실행할 문법이다. `compileFrom`도 이 문서가 이미 구현됐다고 주장하는 API가 아니다.

이번에 외부 원문에서 읽은 사실은 §3의 출처·위치에 표시했다. 허용 맥락, 활동도 참고 구간, 그림, 판정 문구, 120개 조합의 배정은 이 자료를 바탕으로 정한 제품 계약이다. 문서의 인수 시험은 아직 실행 완료한 시험이 아니다.

## 2. 공통 조건과 화면 계약

각 자료 행의 조건은 다음 네 필드를 모두 갖는다.

```ts
conditions = {
  medium: 'water',
  temperatureC: 25,
  activityPresets: ['ordinary'],
  excitation: 'none'
}
```

필드는 기존 `lab-astra.md`의 `Conditions`를 따른다. 실행 환경의 단일 `activityPreset`은 `ordinary`다. `excitation: 'none'`은 외부 가열·광조사를 가하지 않는다는 뜻이며 외부 전압도 이 실험실 범위 밖이다. 공기·피막의 영향을 계산했다는 뜻은 아니다. 단계 1에는 `veryDilute` 판정이나 조건 변경 화면이 없다.

`ordinary`의 내부 참고 구간은 자유 용질의 무차원 활동도 `a ∈ [10⁻³, 10⁻²]`다. 묽은 용액에서 `a ≈ c/(1 mol L⁻¹)`로 해석한다. 활동도 계수를 따로 계산하지 않는다. 물과 순수 고체의 활동도는 1로 둔다. **모든 무대 입자가 이 활동도를 동시에 가진 평형 용액이라는 뜻이 아니다.** 특히 H₃O⁺와 OH⁻를 이 구간에 동시에 놓은 평형은 불가능하다. 구간은 사건의 방향을 대조하는 참고값이며, 입자 개수·화면 넓이·추가 횟수로 농도, pH, 수율, 포화를 계산하지 않는다. 여러 금속이 닿아 있어도 각 원자를 합금의 이상 혼합 성분으로 계산하지 않는다.

### A. 무대 문구

- 결정: **“입자 몇 개로 반응 한 번을 봐요.”**를 무대에 둔다.
- 까닭: 이 문구 자체가 잘못된 반응식을 뜻하는 구체적인 경우는 없다. ‘몇 개’를 농도·전환율·최소 핵 크기로 사용하면 틀리지만, 그 문제는 해당 기능과 표현을 막아야 해결된다.
- 계약: 조건은 **“25 °C의 묽은 물속”** 한 줄이다. ‘자세히’의 첫 두 문장은 **“화면의 입자는 수많은 입자를 대표해요. 입자 수는 농도나 반응한 비율이 아니에요.”**다. 결과 제목은 한 사건만 말한다. ‘전부 반응했어요’, ‘완전히 녹았어요’, ‘반응률 100%’를 만들지 않는다.

### B. 금속 표면과 전자

- 결정: 전자는 반응하는 표면 원자 `z1` 또는 `c1`의 **표면 자리에서 드러나 바로 옆 이온으로 이동**한다. 화면 전체를 전자 바탕으로 덮는 안은 단계 1의 필수 표현에 넣지 않는다.
- 까닭: 출발 위치를 표면 원자로 잡는 것만으로 고립 전자쌍을 주장하지 않는다. 주머니·원자 궤도·두 전자를 감싼 국소 테두리를 그리면 그 오해가 생긴다. 전도 전자의 비국소성은 [고체 설명의 Metallic Solids와 그림 10.40](https://openstax.org/books/chemistry-2e/pages/10-5-the-solid-state-of-matter)에 근거한다. 특정 전자가 실제로 그 자리에서 그 경로로 움직였다는 주장은 하지 않는다.
- 계약: 최초 금속 조각은 실제 추적 원자 6개를 2×3으로 둔다. 장식 원자를 재고로 세거나 반응 뒤 새로 채우지 않는다. 반응 자리의 표면에 이동할 두 점을 먼저 짧게 드러내고, **그 두 점**이 차례로 건너간다. 비공유 주머니나 반쪽 라디칼 주머니는 씌우지 않는다. 수용 이온들은 서로 겹치지 않는 인접 표면 자리에 접촉한다. 두 Ag⁺를 같은 좌표로 `approach`시키지 않는다.
- 전하 표시는 각 전자의 출발 때 공여 원자에서, 도착 때 수용 원자에서 한 단위씩 바뀐다. 경로에 유한한 이동 시간이 있으면 양쪽을 같은 시각에 바꾸지 않는다. 이동 중 전자는 전하 장부에 포함한다. 전하 기호의 자리는 고정한다. Zn⁺·Cu⁺ 중간 표시는 전자 장부의 애니메이션이며, 분리·저장·재사용할 수 있는 수용액 생성물이 아니다.
- Ag가 중성이 되면 같은 위치에서 금속 표면에 붙는다. 도착한 점은 표면 속으로 스며드는 전환 뒤 일반 금속 전자 표시와 함께 숨긴다. Zn과 Ag는 같은 물리적 조각에 붙을 수 있지만 원소·화학적 금속상은 구별한다. Ag를 Zn 원자로 바꾸거나 Zn 격자의 동일 원소 자리라고 표시하지 않는다.
- 산화된 표면 원자는 두 전자를 모두 준 뒤 조각에서 빠져나와 수화된다. 전체가 한 사용자 조작·한 실행 취소 단위다. 중간 프레임을 다시 볼 수는 있어도 그 상태에서 재료를 넣거나 다음 사건을 실행하지 못한다.
- 옅은 전자 바탕을 나중에 시험한다면 조각 전체에 끊기지 않는 무늬 없는 음영 하나로만 쓴다. 전자 수·개별 전자·별도 물질로 세지 않는다. 실제 이동 점을 추가 생성하는 근거로 사용하지 않는다. 단계 1은 이 음영 없이 위의 표면 표시로 확정한다.

### C. 이온 결정의 각진 판

- 결정: NaCl의 큰 결정과 첫 AgCl 한 쌍 모두에 **조각 하나당 옅은 각진 판 하나**를 이온 뒤에 둔다.
- 까닭: 판을 고체 소속의 공통 표시로 쓰는 것은 가능하다. 실제 결정면·단위격자·두 이온으로 된 분자를 뜻하도록 그리거나 명명하지 않으면 된다. 이온 고체가 개별 분자 대신 배열을 이룬다는 근거는 [Ionic Solids와 그림 10.39](https://openstax.org/books/chemistry-2e/pages/10-5-the-solid-state-of-matter)다. 판 자체의 모양은 시각 설계다.
- 계약: 이온 사이에 공유 주머니·분자 테두리·중앙의 잘록한 연결부를 만들지 않는다. 판은 구성 이온 전체의 외곽을 감싸며, 쌍마다 작은 판을 겹쳐 붙이지 않는다. 같은 종류의 고체가 자라면 기존 판이 넓어지고, 녹으면 줄어들며, 구성원이 없으면 사라진다. 구성 이온은 서로 고정되어 함께 움직인다. 표면의 물은 있을 수 있지만 고체 이온마다 독립적으로 떠도는 수화 껍질을 남기지 않는다. 색은 고체를 구분하는 도식 색이며 실제 결정 색의 측정값으로 취급하지 않는다.

## 3. 수치·근거 행

### 3.1 원문 수치

열람일은 모두 2026-11-11이다. ‘직접 읽음’은 이번 작성 중 웹 도구로 해당 페이지의 본문·표 항목을 확인했다는 뜻이다. 소수 마지막 자리의 불필요한 정밀도를 화면에 내보내지 않는다.

| ID | 값 | 단위 | 조건·정의 | 출처 URL | 페이지 안 위치 | 이번 원문 직접 읽음 |
|---|---:|---|---|---|---|---|
| V01 `kw-water` | 1.0×10⁻¹⁴ | 평형상수, 무차원 관례 | 25 °C 수용액, 용매 물 제외; 원문은 농도곱 표기 | [OpenStax 14.2](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) | `Kw=[H3O+][OH−]` 식 뒤 25 °C 문단 | 예 |
| V02 `kb-ammonia` | 1.8×10⁻⁵ | 평형상수, 무차원 관례 | 25 °C 수용액, NH₃+H₂O⇌NH₄⁺+OH⁻ | [OpenStax Appendix I](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases) | Table I1, ammonia | 예 |
| V03 `ksp-agcl` | 1.6×10⁻¹⁰ | 용해도곱, 무차원 관례 | 25 °C 수용액, AgCl(s)⇌Ag⁺+Cl⁻; 1:1 | [OpenStax Appendix J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products) | Table J1, silver → AgCl | 예 |
| V04 `E-Ag` | +0.7996 | V vs SHE | 표준 환원 전위, Ag⁺+e⁻→Ag(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음 | [OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials) | Table L1, Ag⁺+e⁻→Ag | 예; 2판에서 온도 근거도 재열람 |
| V05 `E-Cu` | +0.337 | V vs SHE | 표준 환원 전위, Cu²⁺+2e⁻→Cu(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials)과 Figure 17.6의 T=298 K. 수치는 온도 근거 표의 반올림값 +0.34가 아닌 부록 L에서 취함 | [OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials) | Table L1, Cu²⁺+2e⁻→Cu | 예; 2판에서 온도 근거도 재열람 |
| V06 `E-Zn` | −0.7618 | V vs SHE | 표준 환원 전위, Zn²⁺+2e⁻→Zn(s), 25 °C. 온도 근거: [17.3 Table 17.1의 제목](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials), Selected Standard Reduction Potentials at 25 °C. 부록 L에는 온도 표기 없음 | [OpenStax Appendix L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials) | Table L1, Zn²⁺+2e⁻→Zn | 예; 2판에서 온도 근거도 재열람 |
| V07 `R` | 8.314462618… | J mol⁻¹ K⁻¹ | 2022 CODATA, 정의상 정확한 상수의 표시 자릿수 | [NIST 상수 전체 표](https://physics.nist.gov/cuu/Constants/Table/allascii.txt) | `molar gas constant` | 예 |
| V08 `F` | 96485.33212… | C mol⁻¹ | 2022 CODATA, 정의상 정확한 상수의 표시 자릿수 | [NIST 상수 전체 표](https://physics.nist.gov/cuu/Constants/Table/allascii.txt) | `Faraday constant` | 예 |

표준상태·SHE의 뜻과 온도는 [OpenStax 17.3의 표준 전극 설명, Figure 17.6, Table 17.1](https://openstax.org/books/chemistry-2e/pages/17-3-electrode-and-cell-potentials)에서 대조했다. 그 페이지의 간략 표는 Cu를 +0.34 V로 반올림한다. 계산에는 Appendix L의 +0.337 V를 일관되게 쓰며 두 표를 섞지 않는다. 위 상수들을 농도 단위가 붙은 숫자와 혼용하지 않는다. 이는 묽은 용액용 근사 자료이며, 활동도 보정을 포함한 새 정밀 측정값으로 재분류하지 않는다.

### 3.2 비수치 근거

| ID | 사용하는 근거 | 출처 URL | 페이지 안 위치 | 이번 직접 읽음 |
|---|---|---|---|---|
| S01 | Na⁺ 염·NH₄⁺ 염의 가용성, AgCl 예외, 순이온식 | [OpenStax 4.2](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions) | Table 4.1의 Group 1/NH₄⁺/Cl⁻/OH⁻ 행, 뒤 AgCl 예 | 예 |
| S02 | 염화 이온·나트륨 이온의 무시할 수 있는 산·염기 가수분해, NH₄⁺의 가수분해 | [OpenStax 14.4](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts) | Salts with Basic Ions의 Na⁺, Salts with Acidic Ions의 NH₄Cl | 예 |
| S03 | 이온 고체의 해리·수화, HCl의 사실상 완전 이온화 | [OpenStax 11.2](https://openstax.org/books/chemistry-2e/pages/11-2-electrolytes) | Ionic Electrolytes, Covalent Electrolytes의 HCl | 예; 수화 그림의 예시는 KCl이며 NaCl 전용 측정 자료가 아님 |
| S04 | Q와 Ksp에 따른 방향, AgCl의 유한한 용해도 | [OpenStax 15.1](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution) | The Solubility Product 및 침전 예측 부분 | 예 |
| S05 | NH₃와 Ag⁺의 착물, NH₃에 의한 AgCl 용해 증가 | [OpenStax 15.2](https://openstax.org/books/chemistry-2e/pages/15-2-lewis-acids-and-bases) | 도입부 Ag⁺와 NH₃, Formation of Complex Ions | 예; 단계 1의 양성 행으로 등록하지 않음 |
| S06 | Nernst 식과 E°, K의 관계 | [OpenStax 17.4](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | E° and K, Potentials at Nonstandard Conditions: The Nernst Equation | 예 |
| S07 | Zn/Cu/Ag의 치환 장면에 대한 정성 대조 | [Envisioning Chemistry, Metal Displacement 2](https://www.envisioningchemistry.com/metal-displacement-2) | 본문의 금속 조각과 구리·은 용액 설명 | 예; 제작자가 기록한 장면 설명이며 이 문서의 온도·활동도 구간을 검증한 실험은 아님 |
| S08 | 이온 고체와 금속의 전자·배열 표현 | [OpenStax 10.5](https://openstax.org/books/chemistry-2e/pages/10-5-the-solid-state-of-matter) | Ionic Solids, Metallic Solids, Figures 10.39–10.40 | 예 |

### 3.3 유도 수치

이 절의 결과는 원문에서 그대로 읽은 값이 아니라 **이번에 계산한 값**이다. 로그는 밑 10이다. 원문의 숫자와 유도값의 출처 상태를 분리한다.

| ID | 식과 입력값 | 결과·단위 | 조건 | 입력·식의 URL과 위치 | 원문 직접 읽음 여부 |
|---|---|---|---|---|---|
| C01 | pKw=−log(1.0×10⁻¹⁴) | 14.0000, 무차원 | 25 °C 물 | [14.2, Kw 뒤 문단](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) | 입력·pKw 예, 결과 계산 |
| C02 | Ka(NH₄⁺)=Kw/Kb=(1.0×10⁻¹⁴)/(1.8×10⁻⁵); pKa=−log Ka | Ka=5.5556×10⁻¹⁰, pKa=9.2552725 | 같은 용매·온도, 물 활동도 1 | [I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), [14.4, NH₄Cl의 Ka 관계](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), [14.2, Kw](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) | 입력·관계 예, 결과 계산 |
| C03 A01 | K=1/Kw=10¹⁴; logK=pKw | logK=14.0000 | H₃O⁺+OH⁻→2H₂O | [14.2, Kw 식](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) | 입력 예, 역반응 계산 |
| C04 A02 | K=1/Ka(NH₄⁺)=1.8×10⁹; logK=pKa | logK=9.2552725 | H₃O⁺+NH₃→H₂O+NH₄⁺ | [14.4, NH₄⁺ 가수분해](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts), C02 | 입력 예, 역반응 계산 |
| C05 A05 | K=1/Kb(NH₃)=55555.5556; logK=−log(1.8×10⁻⁵) | logK=4.7447275 | NH₄⁺+OH⁻→NH₃+H₂O | [I, ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases) | 입력 예, 역반응 계산 |
| C06 P01 | Q=aAg·aCl=[10⁻⁶,10⁻⁴]; Q/Ksp=Q/(1.6×10⁻¹⁰) | [6250,625000], 무차원 | 자유 Ag⁺·Cl⁻ 각각 ordinary | [J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products), [15.1, 침전 예측](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution) | 입력·관계 예, 구간은 제품 정책, 결과 계산 |
| C07 P01 | Kprecip=1/Ksp=6.25×10⁹; logK=−log(1.6×10⁻¹⁰) | logK=9.7958800 | Ag⁺+Cl⁻→AgCl(s) | [J, AgCl](https://openstax.org/books/chemistry-2e/pages/j-solubility-products) | 입력 예, 결과 계산 |
| C08 | b=ln(10)RT/F; R=8.314462618, T=298.15, F=96485.33212 | b=0.0591593497 V, 계산용 반올림 0.05916 V | 25 °C | [NIST, R·F 항목](https://physics.nist.gov/cuu/Constants/Table/allascii.txt), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 상수·식 예, 결과 계산; 교재의 0.0592와 자릿수 다름 |
| C09 R01 | E°=0.337−(−0.7618)=1.0988; Q=aZn²⁺/aCu²⁺∈[0.1,10]; E=E°−b·logQ/2; logK=2E°/b | E°=1.0988 V; E∈[1.06922,1.12838] V; logK≈37.1471 | Zn+Cu²⁺→Zn²⁺+Cu, n=2, 25 °C ordinary | [L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C10 R02 | E°=0.7996−(−0.7618)=1.5614; Q=aZn²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b | E°=1.5614 V; E∈[1.44308,1.53182] V; logK≈52.7862 | Zn+2Ag⁺→Zn²⁺+2Ag, n=2, 25 °C ordinary | [L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C11 R03 | E°=0.7996−0.337=0.4626; Q=aCu²⁺/aAg⁺²∈[10,10⁴]; E=E°−b·logQ/2; logK=2E°/b | E°=0.4626 V; E∈[0.34428,0.43302] V; logK≈15.6391 | Cu+2Ag⁺→Cu²⁺+2Ag, n=2, 25 °C ordinary | [L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 및 E° and K](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C12 N15 | 같은 참고 상태에서 Ereverse=−E(R01); 입력 범위 C09 | [−1.12838,−1.06922] V | Cu+Zn²⁺→Cu²⁺+Zn, 25 °C ordinary | [L, Table L1 Zn·Cu](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C13 N16 | 같은 참고 상태에서 Ereverse=−E(R02); 입력 범위 C10 | [−1.53182,−1.44308] V | 2Ag+Zn²⁺→2Ag⁺+Zn, 25 °C ordinary | [L, Table L1 Zn·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C14 N17 | 같은 참고 상태에서 Ereverse=−E(R03); 입력 범위 C11 | [−0.43302,−0.34428] V | 2Ag+Cu²⁺→2Ag⁺+Cu, 25 °C ordinary | [L, Table L1 Cu·Ag](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials), [17.4, Nernst 식](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium) | 입력·식 예, 결과 계산 |
| C15 A05 | Q=aNH3/(aNH4·aOH); 각 a∈[10⁻³,10⁻²]; K=1/(1.8×10⁻⁵) | Q∈[10,10⁴], K/Q∈[5.5556,5555.56], 무차원 | NH₄⁺+OH⁻→NH₃+H₂O, 25 °C ordinary | [I, Table I1 ammonia](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases), C05 및 §2 | 입력 예, 구간은 제품 정책, 결과 계산 |

소수 넷째 자리까지의 E° 산술은 자료를 재현하기 위한 것이며 그만큼의 측정 정밀도를 새로 주장하지 않는다. 수용 이온 앞의 계수 2를 E°에 곱하지 않는다. 모든 R 사건의 n은 2다. 초기 생성 이온이 전혀 없는 경우 `log(0)`을 계산하거나 활동도를 임의의 최소값으로 끼워 맞추지 않는다. 위 E 범위는 명시된 유한한 참고 구간의 방향 점검이다. 역방향 인증도 모든 초기 조건에서 원자 하나의 교환조차 없다는 주장이 아니다.

A05는 특히 완전 반응으로 설명하지 않는다. 같은 참고 구간에서 `Q=aNH3/(aNH4·aOH)∈[10,10⁴]`, `K/Q∈[5.5556,5555.56]`다. 식은 C05의 반응식과 V02로부터 유도했다. 방향은 지지되지만 실제 조성·전환율은 이 화면이 계산하지 않는다. 물 pKa≈15.7이나 임의의 H₃O⁺ pKa를 위 계산에 끼우지 않는다.

NaCl의 가용성에는 S01·S03의 정성 근거를 쓴다. 단계 1에 NaCl의 가짜 Ksp, D01의 logK 또는 정량 포화 농도를 만들어 넣지 않는다.

### 3.4 자료값과 구분할 제품 정책 수치

| 항목 | 값·단위·조건 | 출처 URL·위치 | 이번 원문 직접 읽음 |
|---|---|---|---|
| 활동도 참고 구간 | 10⁻³–10⁻², 무차원, ordinary 자유 용질 | 외부 URL 없음; 이 문서 §2의 설계 선택 | 해당 없음; 측정 자료 아님 |
| 산·염기 등록 후보 경계 | logK≥4, 무차원 | 외부 URL 없음; `lab-astra.md` §5.1의 제품 정책 | 외부 원문 아님 |
| P01 방향 여유 기준 | Qmin/Ksp≥100, 무차원 | 외부 URL 없음; `lab-astra.md` §5.2의 후보 등록 정책. C06은 6250 | 외부 원문 아님 |
| R 양성·역방향 부정의 여유 기준 | Emin≥+0.2 V / Ereverse,max≤−0.2 V | 외부 URL 없음; 후보 등록 정책. C09–C14로 점검 | 외부 원문 아님 |
| 최초 금속 조각 | 6개 추적 원자, 2×3 배치 | 외부 URL 없음; §2 B의 그림 선택 | 해당 없음 |
| 침전 시작 세트 | 자유 Ag⁺ 3개+Cl⁻ 3개; 한 사건은 1쌍 | 외부 URL 없음; §2 C의 그림 선택 | 해당 없음 |
| NaCl 시작 조각 | 이온 12개=Na⁺ 6개+Cl⁻ 6개 | 외부 URL 없음; 그림·재고 선택 | 해당 없음 |

## 4. 재료 15행

`phase`와 원자·결합 그래프를 함께 판별한다. 화학식만 같다고 분자·고체·용액 이온을 합치지 않는다. `x`는 실제 선언 이름으로 치환한다. 전자 열은 현재 엔진의 국소 장부이며 전체 전자 수가 아니다. 이온의 전하는 물속에서의 종 표기다.

| 종 ID | 재료·상 | 추적 원자·결합 / 기준 원자 | 전자 장부·전하 | 제공·사용 계약 | 근거 |
|---|---|---|---|---|---|
| water | H₂O(l), 선택한 물 / 배경 물 구별 | x.O–x.H1, x.O–x.H2 / x.O | O lp2; q0 | 선택한 물은 D01 손잡이; 배경 수화 물은 반응 재고 아님 | V01, S03 |
| hydronium | H₃O⁺(aq) | x.O–x.H1/H2/H3 / x.O | O lp1; q+1 | A01·A02의 결합된 H 선택 | V01, C03–C04 |
| hydroxide | OH⁻(aq) | x.O–x.H / x.O | O lp3; q−1 | O가 H를 받음; 원래 H ID 유지 | V01, C03·C05 |
| ammonia | NH₃(aq) | x.N–x.H1/H2/H3 / x.N | N lp1; q0 | N이 H를 받음; 금속 착물은 미지원 | V02, S05 |
| ammonium | NH₄⁺(aq) | x.N–x.H1/H2/H3/H4 / x.N | N lp0; q+1 | 현재 N에 결합한 H를 줌; 생성 NH₄⁺의 H 이름을 재작성하지 않음 | C02, C05 |
| silver-ion | Ag⁺(aq) | x.Ag / x.Ag | lp0 rad0; q+1 | P01 또는 금속 사건의 예약 대상 | V03–V04 |
| chloride | Cl⁻(aq) | x.Cl / x.Cl | lp4 rad0; q−1 | P01; 공유 결합 생성 없음 | V03, S01 |
| silver-chloride | AgCl(s), 이온 고체 | 1:1 Ag·Cl ID 집합 / aggregateId | Ag+1, Cl−1; 합0 | 자유 Ag⁺·Cl⁻로 자동 취급하지 않음; P01의 onto 대상 | V03, S04·S08 |
| sodium-ion | Na⁺(aq) | x.Na / x.Na | lp0 rad0; q+1 | 관찰자; 전자 장부가 0이라고 무전하 원자가 아님 | S01–S03 |
| sodium-chloride | NaCl(s), 이온 고체 | 1:1 Na·Cl ID 집합 / aggregateId | Na+1, Cl−1; 합0 | D01은 표면 한 쌍만 분리; 공유 Na–Cl 결합 없음 | S01·S03·S08 |
| zinc-metal | Zn(s), 금속 | z1.Zn…z6.Zn / aggregateId+표면 AtomId | 각 lp1 rad0; q0 | 6개 모두 실제 재고, 표면 원자 하나가 전자 2개 제공 | V06, S07·S08 |
| zinc-ion | Zn²⁺(aq) | x.Zn / x.Zn | lp0 rad0; q+2 | 수화는 표시, 상세 배위수·가수분해는 미지원 | V06 |
| copper-metal | Cu(s), 금속 | c1.Cu…c6.Cu / aggregateId+표면 AtomId | 각 lp1 rad0; q0 | R03 공여체; 생성 Cu도 금속상으로 등록 | V05, S07·S08 |
| copper-ion | Cu²⁺(aq) | x.Cu / x.Cu | lp0 rad0; q+2 | R01 수용체; 착물·수산화물은 미지원 | V05 |
| silver-metal | Ag(s), 금속 | g1.Ag…g6.Ag 또는 생성 Ag ID / aggregateId | 각 lp0 rad1; q0 | 금속에서 홑전자 주머니를 그리지 않음 | V04, S07·S08 |

자유 이온 추가는 이미 물속에 있는 이온의 모형을 놓는 동작이다. 전하를 상쇄할 가상의 이온을 몰래 생성하지 않는다. 화면을 전기적으로 중성인 실제 용액 전체라고 설명하지 않는다. 수화 껍질의 물 수는 정확한 배위수·농도·화학량론이 아니다.

## 5. 모든 두 재료 조합의 인수 표

표는 재료 종류 15개의 순서 없는 쌍과 동종 쌍을 합친 **120행**이다. 같은 종류의 서로 다른 인스턴스가 동종 쌍이며, 같은 인스턴스를 자기 위에 놓는 입력은 접촉 요청 자체가 아니다. 순서를 뒤집어도 판정은 같다. Ag⁺가 두 개 필요한 R02·R03은 종류의 쌍 하나로 싣고 실제 재고는 별도로 검사한다.

공통 입력은 해당 두 종류와 배경 물뿐이다. H₂O 행의 물은 선택 가능한 물 손잡이다. NaCl(s)를 다른 용질에 놓는 행을 배경 물이 있다는 이유만으로 D01에 바꾸지 않는다. 이 표는 한 접촉의 등록 사건을 고르는 표이며 모든 용액의 모든 동시 반응을 예측하는 표가 아니다. 제3 재료·상·표면 상태가 있으면 §6의 맥락 검사가 먼저다. 전체 혼합물의 조합을 이 표의 두 칸만으로 승인하지 않는다.

`양성`은 승인 자료를 쓰고 해당 기능·재고·맥락을 만족했을 때의 기대 판정이다. 재고 부족은 `needs-material`, 아직 E1/E2·고체 표현을 구현하지 못한 상태는 `REPRESENTATION_UNAVAILABLE`이며 양성 애니메이션을 억지로 실행하지 않는다. `모름`은 이 앱의 한계이며 화학계에 답이 알려져 있지 않다는 뜻이 아니다.

| 조합 ID | 재료 1 | 재료 2 | 결과 | 부정 범위·근거 또는 모름의 구체적 이유 |
|---|---|---|---|---|
| T001 | H₂O | H₂O | 모름 · `EQUILIBRIUM_REQUIRED` | 물의 자동 이온화·역반응의 평형 분포를 계산하지 않는다. |
| T002 | H₂O | H₃O⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 물 사이 양성자 교환을 새 생성물 한 사건으로 등록하지 않는다. |
| T003 | H₂O | OH⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | OH⁻와 물의 양성자 교환·평형 분포를 계산하지 않는다. |
| T004 | H₂O | NH₃ | 모름 · `EQUILIBRIUM_REQUIRED` | NH₃+H₂O⇌NH₄⁺+OH⁻는 부분 이온화 평형이다(V02). |
| T005 | H₂O | NH₄⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | NH₄⁺의 산 가수분해 비율을 계산하지 않는다(C02, S02). |
| T006 | H₂O | Ag⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 수화와 가수분해의 종 분포를 단독 은 이온 사건으로 등록하지 않는다. |
| T007 | H₂O | Cl⁻ | 검토된 부정 · N21 | Cl⁻의 눈에 띄는 산·염기 가수분해 생성물을 부정한다(S02). 수화는 허용한다. |
| T008 | H₂O | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | AgCl은 유한하게 녹는다. 녹는 양·평형 없이 D01을 복사하지 않는다(V03, S04). |
| T009 | H₂O | Na⁺ | 검토된 부정 · N22 | Na⁺의 산·염기 가수분해에 의한 새 종 생성을 부정한다(S02). 수화는 허용한다. |
| T010 | H₂O | NaCl(s) | 양성 · D01 | 선택한 물 손잡이와 NaCl 표면 한 쌍; 물은 소모하지 않는다(S01, S03). |
| T011 | H₂O | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 아연의 물·공기·피막에 따른 부식 경로는 미등록이다. |
| T012 | H₂O | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 수화 아연 이온의 가수분해·pH 분포를 계산하지 않는다. |
| T013 | H₂O | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 구리의 물·공기·피막에 따른 부식 경로는 미등록이다. |
| T014 | H₂O | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 수화 구리 이온의 가수분해·pH 분포를 계산하지 않는다. |
| T015 | H₂O | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 은의 물·공기·표면 반응을 일반 부정할 인증이 없다. |
| T016 | H₃O⁺ | H₃O⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 동종 산의 양성자 교환·평형을 별도 사건으로 등록하지 않는다. |
| T017 | H₃O⁺ | OH⁻ | 양성 · A01 | H₃O⁺의 결합된 H 한 개를 OH⁻의 O로 옮긴다(C03). |
| T018 | H₃O⁺ | NH₃ | 양성 · A02 | H₃O⁺의 결합된 H 한 개를 NH₃의 N으로 옮긴다(C04). |
| T019 | H₃O⁺ | NH₄⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 두 산을 서로 중화한다고 추정하지 않고 양성자 분포는 미계산으로 둔다. |
| T020 | H₃O⁺ | Ag⁺ | 모름 · `NO_REVIEWED_RULE` | 산성 맥락의 은 이온에 대한 독립 두 재료 행이 없다. |
| T021 | H₃O⁺ | Cl⁻ | 검토된 부정 · N09 | HCl 분자가 주된 생성물로 남는 순변화를 부정한다(S03). |
| T022 | H₃O⁺ | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 산성 용액의 AgCl 용해·종 분포를 계산하지 않는다. |
| T023 | H₃O⁺ | Na⁺ | 검토된 부정 · N23 | Na⁺가 H₃O⁺를 중화하여 새 산·염기 생성물을 만드는 순변화를 부정한다(S02). 수화·물 사이 H 교환은 제외한다. |
| T024 | H₃O⁺ | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | 산성 맥락의 고체 용해를 D01에 자동 결합하지 않는다. |
| T025 | H₃O⁺ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 수소 발생을 포함한 산과 아연의 반응 계열이 미등록이다. |
| T026 | H₃O⁺ | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 아연 이온의 산성 용액 종 분포를 계산하지 않는다. |
| T027 | H₃O⁺ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 구리와 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다. |
| T028 | H₃O⁺ | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 구리 이온의 산성 용액 종 분포를 계산하지 않는다. |
| T029 | H₃O⁺ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 은과 산의 반응을 산화제·공기 조건 없이 일반 부정하지 않는다. |
| T030 | OH⁻ | OH⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 동종 염기의 물과의 양성자 교환·분포를 별도 사건으로 계산하지 않는다. |
| T031 | OH⁻ | NH₃ | 모름 · `EQUILIBRIUM_REQUIRED` | NH₃의 염기 평형에 대한 공통 OH⁻ 효과를 계산하지 않는다. |
| T032 | OH⁻ | NH₄⁺ | 양성 · A05 | NH₄⁺의 현재 N–H 결합에서 H 한 개를 OH⁻의 O로 옮긴다(C05). |
| T033 | OH⁻ | Ag⁺ | 모름 · `NO_REVIEWED_RULE` | 은 산화물 계열은 미등록이다. 단순 AgOH 고체를 만들지 않는다. |
| T034 | OH⁻ | Cl⁻ | 검토된 부정 · N24 | Cl⁻가 OH⁻를 중화하거나 HCl을 주된 생성물로 만드는 순변화를 부정한다(S02, S03). |
| T035 | OH⁻ | AgCl(s) | 모름 · `NO_REVIEWED_RULE` | AgCl와 OH⁻의 결합된 용해·고체 전환은 미등록이다. |
| T036 | OH⁻ | Na⁺ | 검토된 부정 · N07 | NaOH 공유 분자 또는 침전의 생성을 부정한다(S01). |
| T037 | OH⁻ | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | OH⁻가 있는 고체 용해를 D01에 자동 결합하지 않는다. |
| T038 | OH⁻ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 아연의 염기성 부식·아연산염·피막 계열은 미등록이다. |
| T039 | OH⁻ | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | 아연 수산화물·착물과 그 화학량론은 미등록이다. |
| T040 | OH⁻ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 구리 표면의 염기성·산소·피막 반응은 미등록이다. |
| T041 | OH⁻ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | Cu(OH)₂ 침전은 이 단계의 1:1 침전 행이 아니다. |
| T042 | OH⁻ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 은 표면의 염기성·산소·산화물 반응은 미등록이다. |
| T043 | NH₃ | NH₃ | 모름 · `EQUILIBRIUM_REQUIRED` | 암모니아와 물의 평형을 동종 분자 접촉으로 실행하지 않는다. |
| T044 | NH₃ | NH₄⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | NH₃/NH₄⁺ 짝의 완충·양성자 교환·조성은 계산하지 않는다. |
| T045 | NH₃ | Ag⁺ | 모름 · `NO_REVIEWED_RULE` | Ag–NH₃ 착물이 알려져 있지만 단계 1 규칙은 없다(S05). |
| T046 | NH₃ | Cl⁻ | 모름 · `NO_REVIEWED_RULE` | NH₃·Cl⁻ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다. |
| T047 | NH₃ | AgCl(s) | 모름 · `NO_REVIEWED_RULE` | 착물 형성과 AgCl 용해가 결합된 경우다(S05). |
| T048 | NH₃ | Na⁺ | 검토된 부정 · N25 | Na⁺가 NH₃와 산·염기 순반응을 하여 NH₄⁺를 만드는 것을 부정한다(S02, V02). NH₃와 물의 평형은 제외한다. |
| T049 | NH₃ | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아 용액의 고체 용해를 D01에 자동 결합하지 않는다. |
| T050 | NH₃ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아·금속·공기가 얽힌 표면 반응은 미등록이다. |
| T051 | NH₃ | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | 아연–암모니아 배위·종 분포 규칙이 없다. |
| T052 | NH₃ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아·구리·공기가 얽힌 표면 반응은 미등록이다. |
| T053 | NH₃ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | 구리–암모니아 착물·침전의 결합 규칙이 없다. |
| T054 | NH₃ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아·은·공기가 얽힌 표면 반응은 미등록이다. |
| T055 | NH₄⁺ | NH₄⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 암모늄의 가수분해 평형을 동종 이온 접촉으로 실행하지 않는다. |
| T056 | NH₄⁺ | Ag⁺ | 모름 · `NO_REVIEWED_RULE` | NH₄⁺·Ag⁺에 대한 독립 두 재료 행이 없다. |
| T057 | NH₄⁺ | Cl⁻ | 검토된 부정 · N12 | NH₄Cl 공유 분자·침전 생성을 부정한다(S01). NH₄⁺ 가수분해는 부정하지 않는다. |
| T058 | NH₄⁺ | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 암모늄이 있는 AgCl 용해·종 분포를 계산하지 않는다. |
| T059 | NH₄⁺ | Na⁺ | 모름 · `NO_REVIEWED_RULE` | NH₄⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다. |
| T060 | NH₄⁺ | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | 암모늄 용액의 고체 용해를 D01에 자동 결합하지 않는다. |
| T061 | NH₄⁺ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 약산성 이온과 아연의 수소 발생·부식은 미등록이다. |
| T062 | NH₄⁺ | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 암모늄·아연 이온의 가수분해·산도 분포를 계산하지 않는다. |
| T063 | NH₄⁺ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 약산성 이온과 구리의 표면 반응은 미등록이다. |
| T064 | NH₄⁺ | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 암모늄·구리 이온의 가수분해·산도 분포를 계산하지 않는다. |
| T065 | NH₄⁺ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 약산성 이온과 은의 표면 반응은 미등록이다. |
| T066 | Ag⁺ | Ag⁺ | 모름 · `NO_REVIEWED_RULE` | Ag⁺끼리 전자 공급 없이 금속으로 바꾸지 않는다. 이 쌍의 포괄 부정 인증도 없다. |
| T067 | Ag⁺ | Cl⁻ | 양성 · P01 | 선택한 자유 Ag⁺·Cl⁻ 각 하나를 같은 AgCl 고체로 넣는다(C06). |
| T068 | Ag⁺ | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 공통 이온이 있는 용해 평형이다. Cl⁻ 없이 Ag⁺만 onto에 넣지 않는다. |
| T069 | Ag⁺ | Na⁺ | 모름 · `NO_REVIEWED_RULE` | Ag⁺·Na⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다. |
| T070 | Ag⁺ | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | NaCl 용해와 AgCl 침전이 결합된 경우로 단일 P01·D01에 대신 넣지 않는다. |
| T071 | Ag⁺ | Zn(s) | 양성 · R02 | 표면 Zn 하나와 자유 Ag⁺ 두 개가 필요하다. 한 개뿐이면 needs-material이다(C10). |
| T072 | Ag⁺ | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | Ag⁺·Zn²⁺의 독립 두 재료 행이 없다. 금속 Zn으로 오인하지 않는다. |
| T073 | Ag⁺ | Cu(s) | 양성 · R03 | 독립 Cu 표면 하나와 자유 Ag⁺ 두 개가 필요하다(C11). |
| T074 | Ag⁺ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | Ag⁺·Cu²⁺의 독립 두 재료 행이 없다. 금속 Cu로 오인하지 않는다. |
| T075 | Ag⁺ | Ag(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Ag/Ag⁺의 전극 교환·평형을 새 순석출 사건으로 계산하지 않는다. |
| T076 | Cl⁻ | Cl⁻ | 모름 · `NO_REVIEWED_RULE` | Cl⁻끼리의 쌍을 산화제 없이 Cl₂로 바꾸지 않는다. 포괄 부정 인증은 없다. |
| T077 | Cl⁻ | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 공통 이온·용해·염화물 착물의 범위를 계산하지 않는다. |
| T078 | Cl⁻ | Na⁺ | 검토된 부정 · N01 | ordinary에서 NaCl의 순침전을 부정한다(S01). |
| T079 | Cl⁻ | NaCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Cl⁻ 공통 이온·포화가 있는 용해 양을 계산하지 않는다. |
| T080 | Cl⁻ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 염화물과 아연 표면의 부식·피막 효과는 미등록이다. |
| T081 | Cl⁻ | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | 아연–염화물 종 분포에 대한 행·부정 인증이 없다. |
| T082 | Cl⁻ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 염화물과 구리 표면의 부식·피막 효과는 미등록이다. |
| T083 | Cl⁻ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | 구리–염화물 종 분포에 대한 행·부정 인증이 없다. |
| T084 | Cl⁻ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 염화물과 은 표면의 산화·피막 효과는 미등록이다. |
| T085 | AgCl(s) | AgCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 고체의 접촉·응집·용해 평형을 침전 한 사건으로 대신하지 않는다. |
| T086 | AgCl(s) | Na⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | AgCl의 배경 전해질·용해 평형은 계산하지 않는다. |
| T087 | AgCl(s) | NaCl(s) | 모름 · `NO_REVIEWED_RULE` | 서로 다른 고체의 용해·공통 이온 결합 경로는 미등록이다. |
| T088 | AgCl(s) | Zn(s) | 모름 · `NO_REVIEWED_RULE` | AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R02와 다른 행이다. |
| T089 | AgCl(s) | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 아연 이온이 있는 AgCl 용해·종 분포는 미계산이다. |
| T090 | AgCl(s) | Cu(s) | 모름 · `NO_REVIEWED_RULE` | AgCl 고체가 직접 참여하는 금속 환원은 자유 Ag⁺의 R03과 다른 행이다. |
| T091 | AgCl(s) | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 구리 이온이 있는 AgCl 용해·종 분포는 미계산이다. |
| T092 | AgCl(s) | Ag(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Ag/AgCl/Cl⁻ 전극·용해 평형은 미지원이다. |
| T093 | Na⁺ | Na⁺ | 검토된 부정 · N26 | 두 Na⁺의 접촉을 산·염기 반응이나 새 중성 분자·염 결정 생성으로 처리하는 것을 부정한다(S01, S02). |
| T094 | Na⁺ | NaCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Na⁺ 공통 이온·포화가 있는 용해 양을 계산하지 않는다. |
| T095 | Na⁺ | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 물속 아연의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다. |
| T096 | Na⁺ | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | Na⁺·Zn²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다. |
| T097 | Na⁺ | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 물속 구리의 부식 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다. |
| T098 | Na⁺ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | Na⁺·Cu²⁺ 관찰자 쌍의 독립 인증은 아직 등록하지 않는다. |
| T099 | Na⁺ | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 물속 은의 표면 맥락을 Na⁺ 관찰자라는 이유로 일반 부정하지 않는다. |
| T100 | NaCl(s) | NaCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 소금 조각을 접촉시켜 용해량·포화·응집을 자동 결정하지 않는다. |
| T101 | NaCl(s) | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 소금 용해와 아연 표면의 염화물 효과가 결합된 경우다. |
| T102 | NaCl(s) | Zn²⁺ | 모름 · `NO_REVIEWED_RULE` | 고체 용해와 아연 이온의 용액 종 분포를 묶은 행이 없다. |
| T103 | NaCl(s) | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 소금 용해와 구리 표면의 염화물 효과가 결합된 경우다. |
| T104 | NaCl(s) | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | 고체 용해와 구리 이온의 용액 종 분포를 묶은 행이 없다. |
| T105 | NaCl(s) | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 소금 용해와 은 표면의 염화물 효과가 결합된 경우다. |
| T106 | Zn(s) | Zn(s) | 모름 · `NO_REVIEWED_RULE` | 금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다. |
| T107 | Zn(s) | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | Zn/Zn²⁺ 전극 교환·평형과 표면 상태를 계산하지 않는다. |
| T108 | Zn(s) | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 두 금속 접촉의 전기적 연결·부식을 R01로 대신하지 않는다. Cu²⁺가 없다. |
| T109 | Zn(s) | Cu²⁺ | 양성 · R01 | Zn 표면 원자 하나가 Cu²⁺ 하나에 전자 두 개를 준다(C09). |
| T110 | Zn(s) | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 두 금속 접촉의 전기적 연결·부식을 R02로 대신하지 않는다. Ag⁺가 없다. |
| T111 | Zn²⁺ | Zn²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 수화 아연 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다. |
| T112 | Zn²⁺ | Cu(s) | 검토된 부정 · N15 | Cu에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C12). |
| T113 | Zn²⁺ | Cu²⁺ | 모름 · `NO_REVIEWED_RULE` | 두 금속 이온의 가수분해·종 분포에 대한 독립 행이 없다. |
| T114 | Zn²⁺ | Ag(s) | 검토된 부정 · N16 | Ag에 의한 Zn²⁺의 지속적인 Zn 순석출을 참고 구간에서 부정한다(C13). |
| T115 | Cu(s) | Cu(s) | 모름 · `NO_REVIEWED_RULE` | 금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다. |
| T116 | Cu(s) | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | Cu/Cu²⁺의 전극 교환·다른 산화수 분포를 계산하지 않는다. |
| T117 | Cu(s) | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 두 금속 접촉의 전기적 연결·부식을 R03으로 대신하지 않는다. Ag⁺가 없다. |
| T118 | Cu²⁺ | Cu²⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | 수화 구리 이온의 가수분해·종 분포를 동종 접촉으로 실행하지 않는다. |
| T119 | Cu²⁺ | Ag(s) | 검토된 부정 · N17 | Ag에 의한 Cu²⁺의 지속적인 Cu 순석출을 참고 구간에서 부정한다(C14). |
| T120 | Ag(s) | Ag(s) | 모름 · `NO_REVIEWED_RULE` | 금속 접촉·접합·표면 변화를 한 치환 사건으로 등록하지 않는다. |

### 부정 인증의 범위와 화면 문구

N01·N07·N09·N12·N15–N17은 기존 설계의 ID를 유지한다. N21·N22는 1판에서 추가한 좁은 가수분해 인증이며, N23–N26은 2판의 F2에 따라 추가한 관찰자 쌍 인증이다. 부정 인증의 기본 맥락은 **해당 두 종+H₂O만**이다. 제3 물질까지 확대하는 것은 별도 대조를 필요로 하며 이 초안에서는 하지 않는다. 수화·인력·배향·다른 물질과의 반응을 부정하지 않는다.

F2는 네 쌍에만 좁은 부정을 추가하는 것으로 정한다. 근거는 S02의 Na⁺가 눈에 띄는 산·염기 이온화를 하지 않는다는 문단, Cl⁻ 가수분해가 무시할 만하다는 문단이며 2판 작성 때 직접 다시 읽었다. Na⁺·Na⁺의 중성 염 결정은 반대 전하 구성원도 없다(S01의 이온 염 설명과 전하 보존). **원문이 이 네 접촉을 각각 실험했다고 주장하지 않는다.** 원문의 종 성질을 해당 두 종+물이라는 좁은 맥락에 적용한 판단이다. NH₃가 물과 일부 반응하는 사실은 N25와 별개다. 나머지 99행은 이번에 부정 인증을 확대할 근거가 부족하거나 평형·착물·고체·금속 표면 문제가 남아 모름으로 유지한다. Na⁺가 한쪽에 있다는 이유만으로 모든 상대에 인증을 복사하지 않는다.

| 인증 | 부정하는 순변화와 근거 | 결과 제목 | 자세히에 덧붙일 문장 |
|---|---|---|---|
| N01 | ordinary에서 Na⁺+Cl⁻의 NaCl 순침전; S01 | 소금 결정으로 뭉치지 않아요 | 이 묽은 물속에서는 두 이온이 따로 남아요. 농축하거나 물을 말리는 경우는 다루지 않아요. |
| N07 | NaOH 공유 분자·침전의 생성; S01의 알칼리 금속 가용성 | 두 이온은 따로 남아요 | 이 조건에서는 Na⁺와 OH⁻를 한 분자로 묶지 않아요. |
| N09 | HCl 분자가 주된 생성물로 남는 순변화; S03 | 이온으로 남아요 | 이 묽은 물속에서는 H₃O⁺와 Cl⁻로 나타내요. 순간적인 만남까지 없다는 뜻은 아니에요. |
| N12 | NH₄Cl 공유 분자·침전의 생성; S01 | 두 이온은 따로 남아요 | NH₄⁺와 Cl⁻를 한 분자나 결정으로 묶지 않아요. NH₄⁺와 물 사이의 평형은 따로 계산하지 않아요. |
| N15 | Cu에 의한 Zn²⁺의 지속적인 Zn 순석출; C12의 참고 구간 | 아연 금속이 생기지 않아요 | 이 참고 조건에서 구리가 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요. |
| N16 | Ag에 의한 Zn²⁺의 지속적인 Zn 순석출; C13 | 아연 금속이 생기지 않아요 | 이 참고 조건에서 은이 아연 이온을 아연 금속으로 바꾸는 방향은 지지되지 않아요. |
| N17 | Ag에 의한 Cu²⁺의 지속적인 Cu 순석출; C14 | 구리 금속이 생기지 않아요 | 이 참고 조건에서 은이 구리 이온을 구리 금속으로 바꾸는 방향은 지지되지 않아요. |
| N21 | Cl⁻의 물 가수분해로 눈에 띄는 HCl·OH⁻ 생성; S02 | 염화 이온으로 남아요 | 물이 주변을 둘러쌀 수 있지만, 이 조건에서 가수분해로 바뀌는 양은 무시할 수 있어요. |
| N22 | Na⁺ 수화 이온의 산·염기 가수분해로 새 종 생성; S02 | 나트륨 이온으로 남아요 | 물이 주변을 둘러싸도, 이 조건에서는 산·염기 반응으로 새 물질이 생기는 것으로 다루지 않아요. |
| N23 | Na⁺에 의한 H₃O⁺ 중화·산염기 생성물 형성; S02의 Salts with Basic Ions, Na⁺ 문단 | 나트륨 이온은 중화에 참여하지 않아요 | Na⁺가 H₃O⁺의 수소를 받아 중화하는 반응은 없어요. 물의 움직임이나 수소 교환까지 없다는 뜻은 아니에요. |
| N24 | OH⁻·Cl⁻의 중화 및 HCl이 주된 생성물이 되는 순변화; S02의 Salts with Acidic Ions, Cl⁻ 문단과 S03의 HCl 설명 | 두 이온은 서로 중화하지 않아요 | Cl⁻는 OH⁻와 만나 물을 만드는 산으로 작용하지 않아요. 이 묽은 물속에서 HCl 분자로 바꾸어 그리지 않아요. |
| N25 | Na⁺가 참여하는 NH₃의 산·염기 전환; S02 Na⁺ 문단과 V02 | 나트륨 이온은 이 반응에 참여하지 않아요 | Na⁺가 암모니아에 수소를 주거나 받는 반응은 없어요. 암모니아와 물은 일부 반응할 수 있지만, 그 비율은 계산하지 않아요. |
| N26 | Na⁺ 두 개의 산·염기 전환·중성 분자·염 결정 형성; S02 Na⁺ 문단, S01, 전하 보존 | 나트륨 이온 둘로 남아요 | Na⁺ 둘을 중성 분자나 소금 결정으로 묶지 않아요. 주변 물과의 상호작용은 있을 수 있어요. |

각 ‘자세히’에는 §2 A의 공통 첫 두 문장을 앞에 붙인다. ‘아무 일도 일어나지 않아요’는 어느 부정 행에도 쓰지 않는다. 특히 N15–N17은 생성 이온의 활동도가 0인 모든 초기 상태·외부 전압·부식까지 부정하지 않는다.

모름의 내부 코드는 `lab-astra.md`의 코드를 유지한다. F1에 따라 화학적 모름의 첫 화면 문장은 아래 네 가지로 통일하고, 표의 구체적 이유는 ‘자세히’에 둔다. 평형 사유에 다른 제목을 덮어씌우지 않는다. 규칙 충돌·표현 실패는 `lab-decisions.md` §3대로 화학적 모름과 분리한다.

| 코드 | 화면 문장 |
|---|---|
| SPECIES_UNREVIEWED, SPECIATION_UNSUPPORTED, SITE_UNREVIEWED, NO_REVIEWED_RULE | 아직 이 조합은 판단할 수 없어요. |
| ENV_UNSUPPORTED, CONDITION_MISSING, CONDITION_BORDERLINE | 이 조건에서는 판단할 수 없어요. |
| CONTEXT_UNREVIEWED, COMPETING_PATHWAYS | 함께 있는 재료 때문에 판단할 수 없어요. |
| EQUILIBRIUM_REQUIRED | 얼마나 반응하는지는 계산하지 않아요. |

별도 실행 실패 문장: `RULE_CONFLICT`, `REPRESENTATION_UNAVAILABLE` → **“장면을 정확히 만들지 못했어요.”** 실패한 장면을 반응하지 않는다는 화학 판정으로 표시하지 않는다.

## 6. 사건별 맥락과 실행 공통 계약

### 6.1 허용 맥락

배경 물, 선택 물, 활성 재료의 **현재 종·상 전체**를 검사한다. 선반의 재료는 제외한다. 하나의 금속 조각 안에 다른 원소가 있으면 그 구성원도 검사한다. 허용 목록은 무시 가능한 모든 효과를 과학적으로 증명한 목록이 아니라, 이 한 사건을 보여 주는 범위의 승인 대상이다.

| 사건 | 허용하는 활성 종의 전체 목록 | 추가 차단 |
|---|---|---|
| A01 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻ | 목록 밖은 CONTEXT_UNREVIEWED; 선택한 한 양성자 이동만 실행 |
| A02 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻ | A01과 같음; 전체 산·염기 생성물 분포를 정하지 않음 |
| A05 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, Na⁺, Cl⁻ | A01과 같음; NH₄⁺의 생성 이력 대신 현재 N–H 결합 검사 |
| P01 | H₂O, Ag⁺, Cl⁻, AgCl(s), Na⁺ | NH₃·OH⁻·금속·NaCl(s) 등 목록 밖은 CONTEXT_UNREVIEWED; onto는 순수 AgCl 고체만 |
| D01 | H₂O, Na⁺, Cl⁻, NaCl(s) | Ag⁺가 있으면 결합된 용해·침전 문제로 CONTEXT_UNREVIEWED; 양·포화·공통 이온 정량은 계산하지 않음 |
| R01 | H₂O, Na⁺, Zn(s), Zn²⁺, Cu(s), Cu²⁺, Ag(s) | Ag⁺도 있으면 같은 Zn의 수용체 경쟁으로 COMPETING_PATHWAYS |
| R02 | H₂O, Na⁺, Zn(s), Zn²⁺, Ag(s), Ag⁺ | Cu²⁺는 수용체 경쟁, Cu(s)는 공여체 경쟁으로 COMPETING_PATHWAYS |
| R03 | H₂O, Na⁺, Zn²⁺, Cu(s), Cu²⁺, Ag(s), Ag⁺ | Zn(s)가 활성 무대나 접촉 금속 조각에 남으면 공여체 경쟁으로 COMPETING_PATHWAYS |

R 계열의 산·염기·Cl⁻·NH₃·이온 고체·등록되지 않은 피막은 `CONTEXT_UNREVIEWED`다. 미세한 표면 오염을 앱이 추정해서 그리지는 않는다. 외부에서 그런 상태를 명시한 입력은 순수 금속 표면으로 강제 정규화하지 않는다. R01 뒤 생성 Cu를 계속 쓰려면 아연이 완전히 소모되어 금속 Zn이 없거나, 독립된 구리 조각을 활성 무대에 두고 남은 Zn 조각은 선반으로 옮겨야 한다. Zn²⁺가 남은 것은 R03을 막지 않는다.

### 6.2 E1/E2와 안정된 손잡이

아래 대본에는 `step` 블록만 있다. 재료 추가·결정·금속 조각 생성은 `base` fixture의 책임이다. `compileFrom(base, stage, steps, opts)`는 base를 바꾸지 않으며 initial은 base의 깊은 복사다. 원래 원자의 자리와 ID를 머리말용 배치로 재생성하지 않는다. 동일 base·stage·steps·엔진 버전이면 난수와 타임라인은 결정적이다. ID 할당기·자동 이름 할당기도 스냅샷에 포함한다.

분자 손잡이는 현재 `instanceId + revision`과 기준 AtomId를 쓰되, 반응 계획은 참여하는 **정확한 AtomId 집합**을 예약한다. 고체 손잡이는 aggregateId와 표면 AtomId다. `owner`는 생성 이력이며 현재 분자 이름이 아니다. `names`의 기준 원자에서 현재 결합 성분을 찾는다. 다른 분자로 간 `a.H1`을 `b.H4`로 바꾸지 않는다. 이름은 예약한 ID를 대본에서 가리키는 별칭이며, 예약 이후 다른 원자로 다시 해석하지 않는다.

E2 `precipitate using a b [onto s]`는 선택한 양이온·음이온의 선언 이름을 받는다. 둘은 자유 수용액 단원자 이온이고 반대 전하의 절댓값이 같아야 한다. crowd, gone, 전극·SEI·기존 고체 구성원, 다원자 성분은 거부한다. 새 결정 ID는 결과 effects로 받아 사용하며 `ppt#1`이라고 가정하지 않는다. onto는 존재하는 비어 있지 않은 같은 AgCl 이온 고체여야 한다. 기존 구성원 ID·좌표를 유지하며 새 두 ID만 더한다.

### 6.3 금속의 상·소속 효과는 별도 필수 계약이다

현재 `hop` 대본만으로 B의 그림을 구현할 수 없다. `metal-surface-v1`을 이 문서의 **필요 기능 이름**으로 두며 기존 DSL 명령이라고 주장하지 않는다. `compilePlan`은 아래 전자 대본과 함께 표면 위치, 이동 점 ID, 전자별 시점, 수화 연결, 원자별 phase, 조각 구성원 변경을 원자적으로 계획한다. 실제 구현에서 엔진의 타입으로 표현하되 다음 결과를 지켜야 한다.

| 시점 | 필수 효과 |
|---|---|
| approach | 선택 이온만 움직임; 공여 금속 조각은 고정. 두 Ag의 접촉 슬롯이 서로 다름 |
| 각 hop 전후 | 같은 점의 표면 출현·이동·도착을 연결. 전자별 전하 표시, 이동 중 전하 장부 일치 |
| 수용체가 중성이 된 시점 | 물 껍질의 독립 연결 해제, 금속상 지정, 접촉한 조각의 표면에 편입, 외곽 전자 점 숨김 |
| 공여체의 전자 2개 이동 완료 | 공여 AtomId를 금속 구성원에서 제거, lattice 표시 해제, aqueous ion 지정 |
| 이온이 바깥으로 이동한 뒤 | 해당 공여 이온만 수화. 주위 물은 배경 연출이며 원소 보존 장부에 몰래 더하지 않음 |

이 효과는 엔진 또는 실험실 어댑터가 **임시 상태에서 타임라인과 함께** 만들어야 한다. 끝 World만 고치고 중간 프레임은 틀리게 두는 방식은 불합격이다. E1을 여러 내부 조각으로 컴파일한다면 이어지는 before/after가 동일해야 하고, 전체 완료까지 사용자 상태에 커밋하지 않는다. `compileFrom`의 성공과 금속 표현 기능의 성공은 별도 조건이다. 기능이 없으면 R01–R03은 `REPRESENTATION_UNAVAILABLE`다.

템플릿의 마지막 `move ... to 500,420`은 인수 fixture에서 확보한 빈 이탈 위치다. 일반 실행은 계획한 빈 위치로 치환한다. 기존 원자 ID와 위치를 다시 배치하는 전역 겹침 해소를 허용하지 않는다. 공간을 확보하지 못하면 실행 전 실패하며 기존 무대는 그대로 둔다.

### 6.4 끝 상태 검증

컴파일러 안에는 참조·전자 잔량·결합·고체 소속·구조 무결성 검사를 둔다. 실험실의 E5 검사는 컴파일 전후에 예약한 반응 원자 집합, 예상 결합, 전하, 모델 전자 수, 종·상·고체 소속을 대조한다. 화학 양성 여부를 범용 `compileFrom`에 넣지 않는다.

모델 전자 수는 `2Σlp + Σrad + 2ΣbondOrder`다. 내부 전체 전자 수라는 뜻이 아니다. `crowd` 수화 물의 생성·정리는 별도 연출 효과로 기록한다. 반응 재료의 AtomId·원소별 수·모델 전자 수·총전하는 보존하며, 생성한 물 그림 때문에 이 검사를 통째로 꺼서는 안 된다. 관찰자 원자·결합·전자·상·좌표는 유지한다. 이 조건은 자동 배치로 관찰자를 밀어도 된다는 허가가 아니다.

## 7. 여덟 양성 사건의 실행 행

공통으로 §2의 조건 네 필드, §6.1의 해당 허용 목록, `review.status='draft'`를 갖는다. 각 ‘자세히’ 앞에는 §2 A의 첫 두 문장을 붙인다. 아래 원자 ID는 독립 fixture 기준이며 실제 사용에서는 원자 매핑으로 치환한다. 초기 분자의 수소 명칭을 가정해 생성물에 새 이름을 붙이지 않는다.

### A01 — H₃O⁺ + OH⁻ → H₂O + H₂O

- 근거: V01, C03이다. 맥락은 §6.1 A01 행이다.
- 입력: `a=H3O+`, `b=OH-`, 둘 다 수용액이다. 반응 자리는 현재 `a.O–a.H1` 결합과 `b.O`의 비공유 전자쌍이다. 동등한 H2·H3를 선택하면 그 실제 ID로 치환한다.

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.O a.H1
step "수소가 옮겨가요"
  transfer a.H1 to b.O
```

끝 상태는 `{a.O,a.H2,a.H3}`와 `{b.O,b.H,a.H1}` 두 H₂O 성분이다. `a.O–a.H1`을 제거하고 `b.O–a.H1` 단일 결합을 만든다. 두 O는 lp2·전하0이다. 나머지 결합·원자 ID는 그대로다. 추적 원자 6개, 모델 전자 16개, 총전하0을 유지한다. H가 혼자 떨어져 있는 저장 상태를 만들지 않는다.

- 결과 제목: **“물 분자 둘이 되었어요.”**
- 자세히: “H₃O⁺의 수소 하나를 OH⁻가 받았어요. 수소가 옮겨지고 두 산소에 전자쌍이 남는 모습을 보여 줘요.”

### A02 — H₃O⁺ + NH₃ → H₂O + NH₄⁺

- 근거: V01–V02, C02·C04다. 맥락은 §6.1 A02 행이다.
- 입력: `a=H3O+`, `b=NH3`다. 반응 자리는 `a.O–a.H1`과 `b.N`의 비공유 전자쌍이다.

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.N a.H1
step "암모니아가 수소를 받아요"
  transfer a.H1 to b.N
```

끝 상태는 물 `{a.O,a.H2,a.H3}`와 암모늄 `{b.N,b.H1,b.H2,b.H3,a.H1}`이다. `a.O–a.H1` 제거, `b.N–a.H1` 추가다. O는 lp2·q0, N은 lp0·q+1이다. 원자 8개, 모델 전자 16개, 총전하+1을 유지한다. 새 암모늄 손잡이는 `b.N`이며 `owner=a`인 `a.H1`도 그 현재 성분에 포함한다.

- 결과 제목: **“암모늄 이온이 되었어요.”**
- 자세히: “암모니아의 질소가 H₃O⁺에서 수소 하나를 받았어요. H₃O⁺는 물이 되었어요.”

### A05 — NH₄⁺ + OH⁻ → NH₃ + H₂O

- 근거: V02, C05다. 맥락은 §6.1 A05 행이다.
- 독립 입력: `n=NH4+`, `o=OH-`다. 현재 `n.N`에 결합한 H 중 접촉한 `n.H1`을 선택한다. N–H의 전자쌍이 N에 남고 `o.O`의 전자쌍이 H를 받는다.

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach o.O n.H1
step "암모늄 이온이 수소를 내줘요"
  transfer n.H1 to o.O
```

끝 상태는 암모니아 `{n.N,n.H2,n.H3,n.H4}`와 물 `{o.O,o.H,n.H1}`이다. `n.N–n.H1` 제거, `o.O–n.H1` 추가다. N lp1·q0, O lp2·q0이다. 원자 7개, 모델 전자 16개, 총전하0을 유지한다.

연속 실행 인수 사례는 A02의 `b.N` 암모늄에 새 `c=OH-`를 놓고 **현재 N에 붙어 있는 `a.H1`**을 선택하는 것이다. 대본은 `approach c.O a.H1`, 다음 step의 `transfer a.H1 to c.O`다. 끝은 처음 물 `{a.O,a.H2,a.H3}`, 암모니아 `{b.N,b.H1,b.H2,b.H3}`, 새 물 `{c.O,c.H,a.H1}`이다. 전체 모델 전자 24개·총전하0이다. `b.H4`는 존재한다고 가정하지 않는다.

- 결과 제목: **“암모니아와 물이 되었어요.”**
- 자세히: “OH⁻가 암모늄 이온에서 수소 하나를 받았어요. 이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요.”

### P01 — Ag⁺ + Cl⁻ → AgCl(s)

- 근거: V03, C06–C07, S04다. 맥락은 §6.1 P01 행이다.
- 입력: 선언 이름 `a`의 자유 `a.Ag`와 `b`의 자유 `b.Cl`이다. 반응 자리는 두 단원자 이온 전체다. 한 사용자 사건은 선택한 정확히 한 쌍이다. 기본 세트는 세 쌍을 주지만 자동으로 세 사건을 실행하지 않는다.

```text
step "염화 은 고체에 모여요"
  precipitate using a b
```

같은 AgCl 고체 `s`가 있으면 두 번째 사건부터 아래 대본을 쓴다. `s`는 첫 결과 effects의 실제 ID에 붙인 이름이다. 결정이 여러 개면 드롭 대상 고체, 그렇지 않으면 가장 가까운 고체, 동률이면 안정 ID 순으로 고른다. 선택 규칙은 화학적 핵생성 확률이 아니다.

```text
step "있던 염화 은 고체가 커져요"
  precipitate using a b onto s
```

끝 상태에서 새 고체의 구성원은 정확히 `{a.Ag,b.Cl}`이거나 기존 `s`의 구성원에 이 두 ID를 더한 집합이다. Ag q+1·lp0, Cl q−1·lp4를 유지한다. 공유 결합·전자 이동·중성 Ag를 만들지 않는다. 원자 2개·모델 전자8개·총전하0이다. 자유 이온의 수화 연결을 해제하고 고체상·구성원·lattice 표시를 일치시킨다. 각진 판은 첫 쌍부터 나타나며 onto 뒤 같은 판이 넓어진다. 고체 표면 수화와 개별 자유 이온의 수화 연결은 구별한다.

- 결과 제목: **“염화 은 고체가 생겼어요.”** / onto 때 **“염화 은 고체가 커졌어요.”**
- 자세히: “Ag⁺와 Cl⁻가 전하를 그대로 가진 채 고체에 모였어요. 작은 판은 고체의 한 부분을 나타내요. 실제 결정이 생기는 속도나 녹아 남는 양은 계산하지 않아요.”

### D01 — NaCl(s) → Na⁺ + Cl⁻, 물은 용매

- 근거: S01·S03이다. 맥락은 §6.1 D01 행이다. 충분한 물의 묽은 참고 상태에서 고체 한 단위가 분리되는 사건이며 포화 계산이 아니다.
- 최소 fixture: 이온 고체 `s`의 구성원 `{s1.Na,s2.Cl}`, 선언 이름 `s1`, `s2`, 선택 물 `w={w.O,w.H1,w.H2}`다. 반응 자리는 `s` 표면의 인접한 Na⁺·Cl⁻ 한 쌍이다. `w`는 용매를 고르는 손잡이이며 소모하지 않는다.

```text
step "소금 결정에서 이온이 나와요"
  dissolve s1 s2 from s
```

끝은 자유 수용액 `s1.Na`(q+1, lp0), `s2.Cl`(q−1, lp4)이다. 두 원자의 고체 소속·lattice 표시를 해제하고 수화 연결을 각각 한 번만 만든다. 최소 fixture에서는 비어 있는 `s`를 활성 고체 레지스트리에서 제거하며 판도 사라진다. 선택 물 `w`의 원자·결합·ID는 그대로다. 추적 원자5개·모델 전자16개·총전하0을 유지한다. 수화 연출 물은 별도다.

12이온 fixture는 `s1.Na,s2.Cl,s3.Na,s4.Cl,s5.Cl,s6.Na,s7.Cl,s8.Na,s9.Na,s10.Cl,s11.Na,s12.Cl`의 4×3 배열이다. 동일한 명령 뒤 `s1.Na,s2.Cl`만 자유 이온이 되고 나머지 10개는 동일 `s`에 남는다. 남은 이온의 상대 위치·ID를 유지하며 판만 구성원 외곽에 맞춰 줄인다. 같은 두 ID를 다시 dissolve하면 실패해야 한다.

- 결과 제목: **“소금에서 이온 한 쌍이 나왔어요.”**
- 자세히: “Na⁺와 Cl⁻가 결정에서 나와 물에 둘러싸였어요. 물 분자가 소모되는 반응은 아니에요. 녹을 수 있는 총량은 계산하지 않아요.”

### R01 — Zn(s) + Cu²⁺ → Zn²⁺ + Cu(s)

- 근거: V05–V06, C09, S07이다. 맥락은 §6.1 R01 행이다.
- 입력: 금속 조각 `m`에 `z1.Zn…z6.Zn`이 있고, 자유 이온 `u.Cu`가 있다. `z1`은 표면 원자다. `u.Cu`가 z1 옆 표면에 닿는다. §6.3의 상·소속 효과를 반드시 동반한다.

```text
step "구리 이온이 금속 표면에 닿아요"
  approach u.Cu z1.Zn
step "전자 두 개가 차례로 옮겨가요"
  hop z1.Zn -> u.Cu
  hop z1.Zn -> u.Cu
step "아연 이온이 물속으로 나와요"
  move z1 to 500,420
  solvate z1
```

끝은 자유 수용액 `z1.Zn`(lp0 rad0 q+2), 금속 `u.Cu`(lp1 rad0 q0), 나머지 Zn 다섯 개다. `m={z2.Zn,…,z6.Zn,u.Cu}`이고 Cu는 접촉한 표면 자리에 남는다. `z1`은 `m`에서 빠지고 수화되며 `u`의 자유 수화 연결은 해제된다. 공유 Zn–Cu 결합을 만들지 않는다. 참여 두 원자의 모델 전자2개·총전하+2, 조각 전체를 포함하면 원자7개·모델 전자12개·총전하+2를 유지한다. 중간 Cu⁺를 수용액 생성물로 저장하지 않는다.

- 결과 제목: **“구리가 붙고 아연 이온이 나왔어요.”**
- 자세히: “아연이 내준 전자 두 개를 구리 이온이 받아 금속이 되었어요. 점은 전자가 옮겨가는 수를 보여 줘요. 실제 이동 경로나 반응 속도는 나타내지 않아요.”

### R02 — Zn(s) + 2Ag⁺ → Zn²⁺ + 2Ag(s)

- 근거: V04·V06, C10, S07이다. 맥락은 §6.1 R02 행이다.
- 입력: `m={z1.Zn,…,z6.Zn}`, 자유 `a1.Ag`, `a2.Ag`다. 접촉한 Ag⁺를 우선 예약하고, 두 번째는 가장 가까운 사용 가능한 Ag⁺, 동률이면 AtomId 순으로 고른다. 하나뿐이면 `needs-material`이며 아무 전자·전하·상도 바꾸지 않는다.
- 반응 자리는 표면 `z1.Zn`과 서로 다른 두 Ag 원자다. 두 approach의 슬롯은 §2 B처럼 서로 달라야 한다. 그 배치는 금속 표면 어댑터가 예약하며 일반 approach 두 번을 같은 목적 좌표로 보내는 구현은 불합격이다.

```text
step "은 이온 둘이 금속 표면에 닿아요"
  approach a1.Ag z1.Zn
  approach a2.Ag z1.Zn
step "전자가 하나씩 은 이온으로 옮겨가요"
  hop z1.Zn -> a1.Ag
  hop z1.Zn -> a2.Ag
step "아연 이온이 물속으로 나와요"
  move z1 to 500,420
  solvate z1
```

끝은 자유 수용액 `z1.Zn`(lp0 rad0 q+2), 금속 `a1.Ag`, `a2.Ag`(각 lp0 rad1 q0)다. `m={z2.Zn,…,z6.Zn,a1.Ag,a2.Ag}`다. Ag 두 개는 원래 닿은 표면에 남고 물속 낱원자로 떠다니지 않는다. 두 자유 수화 연결은 해제된다. z1만 조각에서 빠져 수화된다. 참여 원자3개·모델 전자2개·총전하+2, 전체 원자8개·모델 전자12개·총전하+2를 유지한다. 다른 Ag⁺가 있으면 그대로 남는다. 한 사건 이후 자동 반복하지 않는다.

- 결과 제목: **“은이 붙고 아연 이온이 나왔어요.”**
- 자세히: “아연이 내준 전자를 은 이온 둘이 하나씩 받았어요. 은은 금속 표면에 붙고 아연 이온은 물속으로 나왔어요. 점은 이동한 전자 수를 나타내요.”

### R03 — Cu(s) + 2Ag⁺ → Cu²⁺ + 2Ag(s)

- 근거: V04–V05, C11, S07이다. 맥락은 §6.1 R03 행이다.
- 입력: 독립된 Cu 조각 `m={c1.Cu,…,c6.Cu}`, 자유 `a1.Ag`, `a2.Ag`다. `c1`은 표면 원자이며 Ag 재고 예약·표면 슬롯·전자 전환·상 효과는 R02와 동일하다. 금속 Zn이 남은 조각 위의 Cu를 이 fixture와 같다고 보지 않는다.

```text
step "은 이온 둘이 금속 표면에 닿아요"
  approach a1.Ag c1.Cu
  approach a2.Ag c1.Cu
step "전자가 하나씩 은 이온으로 옮겨가요"
  hop c1.Cu -> a1.Ag
  hop c1.Cu -> a2.Ag
step "구리 이온이 물속으로 나와요"
  move c1 to 500,420
  solvate c1
```

끝은 자유 수용액 `c1.Cu`(lp0 rad0 q+2), 금속 `a1.Ag`,`a2.Ag`(각 lp0 rad1 q0)다. `m={c2.Cu,…,c6.Cu,a1.Ag,a2.Ag}`다. c1만 이탈·수화되고 Ag는 표면에 붙는다. 참여 원자3개·모델 전자2개·총전하+2, 전체 원자8개·모델 전자12개·총전하+2를 유지한다. Cu⁺는 재사용 가능한 중간 물질로 만들지 않는다.

- 결과 제목: **“은이 붙고 구리 이온이 나왔어요.”**
- 자세히: “구리가 내준 전자를 은 이온 둘이 하나씩 받았어요. 은은 금속 표면에 붙고 구리 이온은 물속으로 나왔어요. 점은 이동한 전자 수를 나타내요.”

## 8. 인수 시험과 대조 기록

### 8.1 자료와 구현의 필수 검사

1. §5의 120개 정규화 쌍을 모두 한 번씩 검사한다. 중복·누락0, 양성8·부정13·모름99이어야 한다. 입력 순서를 바꾸어도 같은 행이다. 행이 없다고 부정 인증을 자동 생성하지 않는다.
2. §7의 여덟 fixture를 각각 실행하고 지정한 AtomId·결합·전자·전하·상·소속을 비교한다. E1/E2·금속 기능 미구현으로 실패한 것을 화학 검증 완료로 세지 않는다.
3. A02→A05에서 `a.H1`의 ID를 추적한다. `owner`가 다르다는 이유로 실패하거나 가짜 `b.H4`를 만들면 불합격이다.
4. P01에 자유 Ag⁺ `a1,a2,a3`와 Cl⁻ `b`를 놓고 a3를 선택한다. 고체는 정확히 `{a3.Ag,b.Cl}`이다. 다음 쌍의 onto 뒤 같은 고체 ID·판이 유지되며 먼저 있던 ID는 바뀌지 않는다. 전자 이동·공유 결합은0이다.
5. P01의 onto를 NaCl 고체, 금속 조각, 빈 고체, 없는 이름으로 지정하면 실행 전 실패한다. 표의 양성 판정을 근거로 잘못된 target을 무시하지 않는다.
6. D01의 최소·12이온 fixture를 모두 검사한다. 물 손잡이는 소모하지 않고, 빠져나온 이온은 재고로 돌아오며 남은 판은 실제 구성원만 감싼다.
7. R02·R03에서 Ag⁺가 하나뿐이면 World와 phase·조각·수화 연결이 모두 불변이다. 둘을 준비하면 정확히 두 전자만 이동한다. 중간 Zn⁺·Cu⁺ 상태는 저장·새 입력·실행 취소 목록의 독립 상태가 아니다.
8. R01 뒤 아연 다섯 개가 남은 조각의 Cu에 Ag⁺ 두 개를 가져오면 `COMPETING_PATHWAYS`다. 독립 Cu 조각과 Zn²⁺만 남은 수용액에서는 R03이 가능하다. 금속 몸체 안의 Zn을 종 목록에서 누락하면 불합격이다.
9. A/P/R에 목록 밖 활성 재료를 하나 넣어 맥락 차단을 검사한다. 특히 Ag⁺+Cl⁻+NH₃, Ag⁺+Cl⁻+OH⁻, NaCl(s)+H₂O+Ag⁺를 원래 양성으로 통과시키지 않는다.
10. 같은 base에서 같은 계획을 두 번 컴파일한 타임라인이 같고 base는 불변이어야 한다. 실패 시 부분 결과를 적용하지 않는다. 되돌리기는 World와 phase·인스턴스·조각·재고·ID 할당 상태를 함께 복원하고 revision은 새로 발급한다.
11. 원자 위치·전자 점·전하 기호·각진 판은 시작, 각 전자의 출발과 도착, 고체 편입, 이탈, 끝 프레임에서 확인한다. 끝 상태의 보존 검사만으로 시각적 연속성을 통과시키지 않는다.

### 8.2 대조 기록 형식

다음은 저장할 레코드의 형식이다. 사실이 없는 값을 예시 완료 기록으로 채우지 않는다.

```ts
type RowCrossCheck = {
  rowId: string;                 // 재료·수치·사건·부정·모름 행 각각
  dataVersion: string;
  rowHash: string;               // 대조한 정확한 내용
  basisCommit: '56ea710';
  authoredBy: string;
  authoredAt: '2026-11-11';
  reviewerLabel: '모델 대조';
  checkerModel: string;
  checkerRun: string;
  checkedAt: string;
  sources: {
    url: string;
    locator: string;
    openedAt: string;
    directlyReadByChecker: boolean;
    valueAsPrinted?: string;
    unitAsPrinted?: string;
    conditionAsPrinted?: string;
    mismatch?: string;
  }[];
  calculation?: { formula: string; inputs: string; output: string; independentlyRecomputed: boolean };
  scopeCheck: string;            // 무엇을 주장하고 무엇까지 부정하지 않는지
  contextCheck: string;
  atomMappingCheck: string;
  depictionCheck: string;
  engineVersion: string;
  acceptanceCases: { id: string; result: 'pass' | 'fail' | 'not-run'; evidence: string }[];
  findings: string[];
  status: 'draft' | 'changes-required' | 'source-matched' | 'approved';
};
```

`source-matched`는 원문 대조 완료이며 구현 공개 승인이 아니다. `approved`는 해당 행의 출처·계산·범위·맥락·인수 시험이 모두 통과한 상태다. 모름 행은 외부 수치를 꾸며 채우지 않고, 해당 경계가 실제로 차단되는지와 코드·이유의 일치를 대조한다. 공통 수치 행의 검토 기록을 사건 행에서 참조할 수 있지만 사건의 원자 매핑·맥락·그림 검사를 생략하지 않는다. 행 내용이나 의존 수치가 바뀌면 관련 승인을 무효화한다.

출처 화면에는 **“출처와 대조한 자료이고 전문가가 검토한 것은 아니에요.”**를 둔다. 이 문서의 draft를 그대로 배포 자료로 쓰지 않는다. 모델 대조만으로 제한된 단계 1을 공개하는 것은 허용하되, 확인하지 않은 행을 확인 완료로 올리거나 일반 화학 예측기로 설명하는 것은 허용하지 않는다.

### 8.3 Claude가 특히 다시 볼 행

- **V05·C09·C11·C12·C14:** Cu의 +0.337과 간략 표의 +0.34 차이, 환원 방향, 역반응 구간의 양 끝 순서를 대조한다.
- **V03·C06·P01:** AgCl의 1.6×10⁻¹⁰을 다른 표의 1.8×10⁻¹⁰과 섞지 않는다. 활동도와 농도곱 관례, 자유 이온만 세는 조건을 대조한다.
- **A05·C05와 A02→A05:** 큰 K를 완전 전환으로 쓰지 않았는지, 이동 H의 실제 ID가 보존되는지 대조한다.
- **N15–N17:** 유한한 참고 구간의 역방향 순석출 부정을 모든 초기 조성·표면·미량 교환으로 확대하지 않았는지 대조한다.
- **N21·N22:** 좁은 가수분해 부정의 신규 인증이다. 수화까지 부정하는 문장으로 읽히지 않는지 확인한다. 전문가가 검토한 부정으로 표시하지 않는다.
- **N23–N26 / T023·T034·T048·T093:** 2판 신규 인증이다. 원문에서 확인한 종의 성질과 해당 쌍으로의 적용 판단을 나눠 대조한다. 특히 N25가 NH₃와 물의 평형까지 부정하지 않는지 확인한다.
- **D01 및 NaCl(s)가 다른 용질과 만나는 모름 행:** 배경 물이 있다는 이유로 선택하지 않은 용해 사건을 자동 실행하지 않는지, 포화·공통 이온을 계산한 것처럼 보이지 않는지 대조한다.
- **R01→R03 및 §6.1 R 맥락:** 실제 조각을 여러 원자로 바꾼 데 따른 경쟁 차단이다. R03의 Cu가 Zn 위에 붙어 있을 때 독립 Cu처럼 처리하지 않는지 대조한다.
- **금속 템플릿 전체:** 현재 엔진의 hop 성공을 고체상·표면·점의 연속성 완료로 오인하지 않는지 확인한다. 특히 두 Ag의 겹침, Zn⁺·Cu⁺의 중간 표시, 도착 전 전하 변경을 확인한다.

## Claude에게 되묻는 것

없다. 위 사항을 이 협의의 결정과 대조 전 자료 초안으로 확정한다. 남은 일은 질문에 대한 답이 아니라 명시한 출처 대조와 구현 인수 시험이다.
