# 실험실 단계 2 자료 행

- 작성 역할: Astra(설계·자료 초안), 작성 도구: Codex
- 작성일: 2026-11-12
- 상태: **draft, 단계 1 공개 전 미리 쓴 초안, 대조 전**
- 기준: HEAD `d8922d8c7efd05f77793eeb0eb3f0231688ae79b` 위의 기존 작업 트리. 단계 1은 같은 날의 3판을 읽었다.
- 범위: [설계서 §8.1](lab-astra.md)의 24종 중 [단계 1](lab-rows-stage1.md)에 없는 재료 9종, 사건 A03·A04·A06·P02·D02–D04.
- 추가 조합: **180행 = 양성 7 · 부정 인증 초안 22 · 모름 151**. 단계 1의 120행과 합치면 **300행 = 양성 15 · 부정 35 · 모름 250**다.
- 검토자: 미지정. Claude의 독립 원문·계산·맥락·표현 대조 전이며 모든 재료·수치·사건·인증은 `draft`다.

[합의 §9](lab-decisions.md)의 “단계 1 공개 뒤 작성” 일정을 이번 예약 작업 지시로 앞당긴 초안이다. 공개 순서나 승인 기준을 바꾼 것이 아니다. 기존 문서와 구현은 수정하지 않았다. “검토된 부정”은 판정 종류의 이름이며 이 초안이 승인되었다는 뜻이 아니다. 이번 직접 열람과 컴파일 결과도 독립 대조·공개 승인을 대신하지 않는다.

## 1. 먼저 막아야 할 잘못된 해석

1. **아세트산 이온의 두 O는 동등하다.** 고정 루이스 장부의 O1/O2나 음전하 위치를 실제 반응성의 차이로 사용하지 않는다. 종 판별은 공명 동등성을 포함하고, 실행 계획은 선택한 실제 O·H ID를 보존한다. 공명식을 오가는 독립 화학 반응·중간 저장 상태는 만들지 않는다.
2. **아세트산을 물에 넣었다고 전부 아세트산 이온으로 바꾸지 않는다.** H₂O와의 접촉은 평형 분포 미지원이다. A03·A06은 정방향 한 사건이고 “이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요.”를 반드시 붙인다. A04도 전환율을 뜻하지 않는다.
3. **AgBr(s)는 자유 Ag⁺와 Br⁻ 두 재료가 아니다.** AgCl(s)+Br⁻의 고체 전환, AgBr(s)+금속의 환원, 암모니아 착물에 의한 용해는 P02로 대체하지 않는다.
4. **NO₃⁻의 관찰자 역할은 사건의 맥락에 한정된다.** 모든 산도·금속·전압에서 반응하지 않는다는 뜻이 아니다. 질산 이온이 있다는 이유로 금속 반응을 허용하거나 질산 분자를 자동 생성하지 않는다.
5. **가용성 염의 한 쌍 분리는 총 용해량 계산이 아니다.** 물 손잡이를 선택한 D02–D04와 다른 용질·고체를 접촉시킨 행을 구별한다. 이온 한 쌍의 판은 조성 단위의 그림이며 실제 최소 결정핵·단위격자 측정값이 아니다.

## 2. 공통 조건과 화면 계약

단계 1 §2를 그대로 적용한다. 모든 사건·부정 인증은 아래 네 필드를 갖는다.

```ts
conditions = {
  medium: 'water',
  temperatureC: 25,
  activityPresets: ['ordinary'],
  excitation: 'none'
}
```

실행 환경은 `water / 25 °C / ordinary / none`으로 고정한다. 외부 가열·광조사·전압과 다른 조건은 지원하지 않으며 조용히 바꾸지 않는다. `ordinary`는 자유 용질의 무차원 활동도 참고 구간 `a ∈ [10⁻³,10⁻²]`다. 묽은 용액에서 `a ≈ c/(1 mol L⁻¹)`, 용매 물과 순수 고체의 활동도는 1로 둔다. 활동도 계수·입자 수로부터의 농도·pH·수율·포화는 계산하지 않는다. 모든 화면 종이 동시에 이 활동도를 가진 평형 용액이라는 뜻도 아니다.

- 무대: **“입자 몇 개로 반응 한 번을 봐요.”**
- 조건: **“25 °C의 묽은 물속”**
- 모든 ‘자세히’의 공통 첫 두 문장: **“화면의 입자는 수많은 입자를 대표해요. 입자 수는 농도나 반응한 비율이 아니에요.”**
- 결과 제목은 한 사건 또는 부정하는 좁은 순변화만 말한다. “전부 반응했어요”, “완전히 녹았어요”, “아무 일도 일어나지 않아요”를 쓰지 않는다.
- 이온 결정의 판·공유 주머니 금지·전하 유지, 금속 표현과 경쟁 경로 차단은 단계 1 §2·§6과 같다. AgBr의 도식 색을 실제 색 측정값으로 제시하지 않는다.
- 일반 명령의 컴파일 성공은 화학 판정이 아니다. 승인되지 않은 행은 실행 자료로 올리지 않으며 표현 미완료는 `REPRESENTATION_UNAVAILABLE`다.

## 3. 수치·근거 행

### 3.1 원문 수치

열람일은 **2026-11-12**다. ‘예’는 이번 작업의 웹 도구로 해당 본문·표 항목을 직접 읽었다는 뜻이다. 아래 다섯 수치 중 신규는 V201·V202, 단계 1에서 재사용하며 다시 읽은 값은 V203–V205다. 표기된 평형상수는 원문의 묽은 수용액 농도식 관례를 단계 1의 무차원 활동도 근사로 사용하는 값이다.

| ID | 값 | 단위 | 조건·정의 | 출처 URL | 페이지 안 위치 | 이번 원문 직접 읽음 |
|---|---:|---|---|---|---|---|
| V201 `ka-acetic` | 1.8×10⁻⁵ | 평형상수, 무차원 관례 | 25 °C, CH₃COOH+H₂O⇌H₃O⁺+CH₃COO⁻ | [OpenStax H](https://openstax.org/books/chemistry-2e/pages/h-ionization-constants-of-weak-acids) | Table H1, 표 머리글 Ka at 25 °C, acetic / CH₃CO₂H 행 | 예 |
| V202 `ksp-agbr` | 5.0×10⁻¹³ | 용해도곱, 무차원 관례 | 25 °C, AgBr(s)⇌Ag⁺+Br⁻ | [OpenStax J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products) | Table J1, Ksp at 25 °C, silver → AgBr | 예 |
| V203 `kw-water` | 1.0×10⁻¹⁴ | 평형상수, 무차원 관례 | 25 °C 물, 용매 물 제외 | [OpenStax 14.2](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) | Kw=[H₃O⁺][OH⁻]와 pKw 식 뒤 “At 25 °C” 문단 | 예; 단계 1 V01 재열람 |
| V204 `kb-ammonia` | 1.8×10⁻⁵ | 평형상수, 무차원 관례 | 25 °C, NH₃+H₂O⇌NH₄⁺+OH⁻ | [OpenStax I](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases) | Table I1, ammonia, Kb at 25 °C | 예; 단계 1 V02 재열람 |
| V205 `ksp-agcl` | 1.6×10⁻¹⁰ | 용해도곱, 무차원 관례 | 25 °C, AgCl(s)⇌Ag⁺+Cl⁻; C209 경계 설명에만 사용 | [OpenStax J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products) | Table J1, silver → AgCl | 예; 단계 1 V03 재열람 |

**직접 읽은 채택 수치 5개, 채택했으나 이번에 읽지 못한 수치 0개**다. 단계 1의 금속 전위 V04–V06 및 상수 R·F(V07–V08)는 이번에 다시 읽거나 재계산하지 않았다. 이들은 단계 2의 신규 수치 근거가 아니며 합친 300행 전체를 재대조했다고 주장하지 않는다. KCl·NaBr·KBr의 정량 용해도·Ksp, 금속–아세트산/Br⁻ 착물 상수, HBr·HNO₃의 수치 Ka는 채택하지 않았다. 읽지 않은 정량값을 추정해 채우지 않는다.

### 3.2 비수치 근거

| ID | 사용하는 근거 | 출처 URL | 페이지 안 위치 | 이번 직접 읽음 |
|---|---|---|---|---|
| S201 | 해당 알칼리 금속·암모늄·질산염·아세트산염의 가용성 분류, Br⁻ 염의 Ag⁺ 예외 | [OpenStax 4.2](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions) | Table 4.1의 Group I/NH₄⁺, Cl⁻·Br⁻, acetate·NO₃⁻, OH⁻ 행; 뒤 AgNO₃+NaCl 순이온식 | 예 |
| S202 | K⁺·Br⁻의 무시할 만한 가수분해, 아세트산 이온의 염기 가수분해, KaKb=Kw | [OpenStax 14.4](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts) | Salts with Basic Ions 및 Example 14.16; Example 14.17 Solution (a), KBr | 예 |
| S203 | 이온 고체의 분리·수화, 물은 용매 | [OpenStax 11.2](https://openstax.org/books/chemistry-2e/pages/11-2-electrolytes) | Ionic Electrolytes, Figure 11.7 및 KCl 수화 본문 | 예; KCl은 직접 예시, NaBr·KBr의 정량 용해 자료는 아님 |
| S204 | HBr·HNO₃와 KOH의 강산·강염기 분류, 산 이온화식에서 용매 물 제외 | [OpenStax 14.3](https://openstax.org/books/chemistry-2e/pages/14-3-relative-strengths-of-acids-and-bases) | Figure 14.6(대체 텍스트 포함), Acid and Base Ionization Constants의 HA 식 | 예; NO₃⁻의 좁은 산·염기 인증은 강산 짝염기 관계의 적용 판단 |
| S205 | Qsp와 Ksp 비교, 유한한 용해도·공통 이온의 한계 | [OpenStax 15.1](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution) | The Solubility Product; Predicting Precipitation의 Qsp<Ksp / Qsp>Ksp | 예 |
| S206 | 형식 전하는 장부이며 공명식의 시간적 왕복은 실재 설명이 아님 | [OpenStax Chemistry 7.4](https://openstax.org/books/chemistry-2e/pages/7-4-formal-charges-and-resonance) | Calculating Formal Charge; Resonance의 NO₂⁻·CO₃²⁻ 설명 | 예; NO₃⁻의 원자별 장부는 라이브러리에서 별도 확인 |
| S207 | 아세트산 이온의 두 O·전자 밀도 동등성 | [OpenStax Organic Chemistry 2.4](https://openstax.org/books/organic-chemistry/pages/2-4-resonance) | acetate 도입부와 resonance hybrid 설명 | 예; 결합 길이 수치는 이 자료에 채택하지 않음 |
| S208 | Ag⁺–NH₃ 착물과 은염 용해를 결합해야 하는 이유 | [OpenStax 15.2](https://openstax.org/books/chemistry-2e/pages/15-2-lewis-acids-and-bases) | Ag⁺+NH₃ 도식; AgCl 용해와 complex ion formation 문단 | 예; 원문 용해 예시는 AgCl, AgBr로의 차단 적용은 설계 판단 |

S201은 정성 분류이지 모든 농도에서의 무한 가용성 보증이 아니다. 부정 인증은 그 분류를 고정된 묽은 참고 조건에 좁게 적용한 초안이다. 원문이 §5의 180개 접촉을 각각 측정했다고 주장하지 않는다. 모름 행의 부식·배위·표면 이유는 **이 앱에 대조된 실행 행이 없다는 경계**이며, 해당 경로가 반드시 실제 발생한다는 새 측정 주장이 아니다.

### 3.3 유도 수치

아래는 원문에서 읽은 결과값이 아니라 이번에 메모리에서 계산한 값이다. 로그는 밑 10이며 평형상수·Q·비는 무차원이다. 25 °C, 용매 물·순수 고체 활동도 1, 동일 표준상태의 반응식을 더하거나 뒤집는다. HAc는 CH₃COOH, Ac는 CH₃COO⁻의 약자다. 입력 URL·위치는 §3.1, 관계의 근거는 S202·S204·S205를 참조한다.

| ID | 식·입력 | 결과 | 용도·조건 | 입력·식 직접 읽음 / 결과 |
|---|---|---|---|---|
| C201 | pKa(CH₃COOH)=−log(V201) | 4.7447275 | 아세트산 짝산·짝염기 | V201·S204 예 / 계산 |
| C202 | Kb(CH₃COO⁻)=V203/V201; Ka(NH₄⁺)=V203/V204; 각각 −log | 두 상수 모두 5.5555556×10⁻¹⁰; pKb(acetate)=pKa(NH₄⁺)=9.2552725 | 두 수치가 같은 것은 채택한 입력 때문이며 같은 물질이라는 뜻 아님 | V201·V203·V204·S202 예 / 계산 |
| C203 A03 | K=1/V201; logK=−log(V201) | K=55555.5556; logK=4.7447275 | H₃O⁺+CH₃COO⁻→H₂O+CH₃COOH | V201·S204 예 / 역반응 계산 |
| C204 A04 | K=V201/V203; logK=14−C201 | K=1.8×10⁹; logK=9.2552725 | CH₃COOH+OH⁻→CH₃COO⁻+H₂O | V201·V203 예 / 반응식 결합 계산 |
| C205 A06 | K=V201/(V203/V204); logK=C202의 pKa(NH₄⁺)−C201 | K=32400; logK=4.5105450 | CH₃COOH+NH₃→CH₃COO⁻+NH₄⁺ | V201·V203·V204·S202 예 / 계산 |
| C206 P02 | Q=aAg·aBr=[10⁻⁶,10⁻⁴]; Q/V202 | Q/Ksp=[2×10⁶,2×10⁸] | 자유 Ag⁺·Br⁻ 각각 ordinary. 하한도 제품 기준 100 이상 | V202·S205 예; 활동도 구간은 정책 / 계산 |
| C207 P02 | Kprecip=1/V202; logK=−log(V202) | K=2×10¹²; logK=12.3010300 | Ag⁺+Br⁻→AgBr(s) | V202 예 / 계산 |
| C208 A03·A04·A06 | A03 Q=aHAc/(aH₃O·aAc)=[10,10⁴]; A04 Q=aAc/(aHAc·aOH)=[10,10⁴]; A06 Q=(aAc·aNH₄)/(aHAc·aNH₃)=[10⁻²,10²]; K/Q | A03 [5.55556,5555.56]; A04 [1.8×10⁵,1.8×10⁸]; A06 [324,3.24×10⁶] | 참고 구간의 방향 점검만 한다. 동일 용액의 평형 조성·전환율을 뜻하지 않음 | V201·V203·V204·S204 예; 구간 정책 / 계산 |
| C209 경계 | AgCl(s)+Br⁻⇌AgBr(s)+Cl⁻; K=V205/V202 | K=320; logK=2.5051500 | 가능한 고체 전환을 P02로 오인하지 않기 위한 경계 설명. 신규 실행 사건 아님 | V202·V205·S205 예 / 반응식 결합 계산 |

C209만으로 전환 속도·혼합 결정 조성·완결성을 정하지 않는다. D02–D04는 S201·S203의 정성 행이며 존재하지 않는 정량 K를 만들지 않는다. 단계 1의 `logK≥4`, 침전 양성 `Qmin/Ksp≥100`, 부정 참고 `Qmax/Ksp≤0.1`은 제품 정책으로 유지한다. `veryDilute` 행은 이번 초안에 넣지 않는다. A03·A06의 큰 K도 “남는 비율은 계산하지 않아요”를 없애는 근거가 아니다.

## 4. 새 재료 9행

단계 1 재료 15행은 그대로 참조한다. `phase`는 실험실의 종·상 계약이며 현재 World에 별도 phase 필드가 있다고 가정하지 않는다. 이온 고체 소속은 `World.crystals`, 공유 구조는 `bonds`로 검사한다. 아래 `x`는 선언 이름, H·C의 lp와 rad는 0이다. 전체 전자 수 대신 모형의 `2Σlp+Σrad+2Σ결합차수`를 쓴다.

| 종 ID | 재료·상 | 추적 원자·결합 / 기준 원자 | 전자 장부·전하 | 제공·사용 계약 | 근거 |
|---|---|---|---|---|---|
| acetic-acid | CH₃COOH(aq) | x.C1–x.C2, C1–H1/H2/H3, C2=O1, C2–O2–H4 / 현재 OH 자리 | 두 O lp2, 모든 원자 q0; 8원자·24전자 | `mol x = CH3COOH`; A04·A06은 O–H의 H만 준다. 메틸 H 선택 금지 | V201, S204, library.ts |
| acetate | CH₃COO⁻(aq) | x.C1–x.C2, C1–H1/H2/H3, C2=O1, C2–O2 / 현재 카복실산 이온의 두 O | 기본 O1 lp2 q0, O2 lp3 q−1; 7원자·24전자; rad0 | `mol x = CH3COO-`; O 두 개의 공명 동등성 포함. O1/O2 역할 교환도 같은 종; 실제 ID는 유지 | V201, S202·S207 |
| potassium-ion | K⁺(aq) | x.K / x.K | lp0 rad0 q+1; 1원자·0전자 | `mol x = K+`; 금속 K·중성 K로 오인하지 않음 | S201·S202 |
| bromide | Br⁻(aq) | x.Br / x.Br | lp4 rad0 q−1; 1원자·8전자 | `mol x = Br-`; 자유 이온만 P02 입력 | V202, S201·S202 |
| silver-bromide | AgBr(s), 이온 고체 | Ag:Br=1:1의 실제 ID 집합 / aggregateId | Ag lp0 q+1, Br lp4 q−1, rad0; 한 쌍 2원자·8전자·q0 | P02 생성 또는 `crystal s = AgBr at bottom 2x1`; 공유 Ag–Br 결합 없음. onto는 같은 순수 고체만 | V202, S205 |
| potassium-chloride | KCl(s), 이온 고체 | K:Cl=1:1 실제 ID 집합 / aggregateId+표면 한 쌍 | K lp0 q+1, Cl lp4 q−1, rad0; 한 쌍 2원자·8전자·q0 | `crystal s = KCl at bottom 4x3`; D02 한 쌍만 분리 | S201·S203 |
| sodium-bromide | NaBr(s), 이온 고체 | Na:Br=1:1 실제 ID 집합 / aggregateId+표면 한 쌍 | Na lp0 q+1, Br lp4 q−1, rad0; 한 쌍 2원자·8전자·q0 | `crystal s = NaBr at bottom 4x3`; D03 한 쌍만 분리 | S201·S203 |
| potassium-bromide | KBr(s), 이온 고체 | K:Br=1:1 실제 ID 집합 / aggregateId+표면 한 쌍 | K lp0 q+1, Br lp4 q−1, rad0; 한 쌍 2원자·8전자·q0 | `crystal s = KBr at bottom 4x3`; D04 한 쌍만 분리 | S201·S203 |
| nitrate | NO₃⁻(aq), 다원자 이온 | x.N–x.O1, x.N=x.O2, x.N–x.O3 / x.N; O 세 개 동등 | N lp0 q+1; O1/O3 lp3 q−1, O2 lp2 q0; rad0; 4원자·24전자·합q−1 | `mol x = NO3-`; 내부 N–O 공유 결합은 유지. O의 이중결합 위치만 바뀐 공명식을 별도 종으로 세지 않음. P02의 단원자 음이온 입력이 아님 | S204·S206, library.ts |

수화 물은 반응 재고에서 제외한다. 이온 추가 시 전하를 맞출 가상의 반대 이온을 몰래 만들지 않는다. 공명 그림의 자세히에는 **“전자와 결합을 한 가지 루이스 구조로 줄여 그렸어요. 아세트산 이온의 두 산소는 동등해요.”**를 둔다. NO₃⁻에는 **“질산 이온의 세 산소는 동등해요. 그림의 형식 전하가 실제 전하 분포를 그대로 뜻하지는 않아요.”**를 쓴다.

## 5. 단계 1에 없는 모든 두 재료 조합의 인수 표

24종의 동종 포함 순서 없는 쌍은 `24×25/2=300`개다. 단계 1 `15×16/2=120`개를 빼면 **180개 = 기존 15종×새 9종(135개)+새 9종의 삼각표(45개)**다. T001–T120은 단계 1을 유지하고 여기에는 T121–T300을 빠짐없이 싣는다. 같은 종 쌍은 서로 다른 인스턴스 두 개다. 하나의 인스턴스를 자기에게 놓는 것은 접촉 요청이 아니다.

공통 입력은 해당 두 종류와 배경 물뿐이며 H₂O는 선택 가능한 물 손잡이다. 역순 접촉은 같은 판정이다. 제3 활성 재료가 있으면 §6의 전체 맥락 검사가 먼저다. 한 쌍 표가 전체 혼합물의 모든 동시 반응을 예측하지는 않는다. 양성은 승인·기능·재고·자리·맥락을 충족했을 때의 기대 종류다. 현재 draft를 실행 승인으로 사용하지 않는다.

| 조합 ID | 재료 1 | 재료 2 | 결과 | 부정 범위·근거 또는 모름의 구체적 이유 |
|---|---|---|---|---|
| T121 | H₂O | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산의 물속 부분 이온화 비율은 계산하지 않는다(V201). |
| T122 | H₂O | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산 이온의 염기 가수분해 비율은 계산하지 않는다(C202, S202). |
| T123 | H₂O | K⁺ | 검토된 부정 · N201 | K⁺의 눈에 띄는 산·염기 가수분해 생성만 부정한다(S202). |
| T124 | H₂O | Br⁻ | 검토된 부정 · N202 | Br⁻의 눈에 띄는 염기 가수분해 생성만 부정한다(S202). |
| T125 | H₂O | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | AgBr도 유한하게 녹는다. 녹는 양·포화는 계산하지 않는다(V202, S205). |
| T126 | H₂O | KCl(s) | 양성 · D02 | KCl 표면 한 쌍을 분리한다. 선택한 물은 소모하지 않는다(S201, S203). |
| T127 | H₂O | NaBr(s) | 양성 · D03 | NaBr 표면 한 쌍을 분리한다. 선택한 물은 소모하지 않는다(S201, S203). |
| T128 | H₂O | KBr(s) | 양성 · D04 | KBr 표면 한 쌍을 분리한다. 선택한 물은 소모하지 않는다(S201, S203). |
| T129 | H₂O | NO₃⁻ | 검토된 부정 · N203 | NO₃⁻의 눈에 띄는 염기 가수분해 생성만 부정한다(S204). |
| T130 | H₃O⁺ | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | 산성 용액에서 아세트산의 이온화 억제·종 분포는 계산하지 않는다. |
| T131 | H₃O⁺ | CH₃COO⁻ | 양성 · A03 | 선택한 H를 카복실산 이온의 동등한 O 중 하나에 옮긴다(C203). |
| T132 | H₃O⁺ | K⁺ | 검토된 부정 · N204 | K⁺가 H₃O⁺를 중화하는 산·염기 순변화만 부정한다(S202). |
| T133 | H₃O⁺ | Br⁻ | 검토된 부정 · N205 | HBr 분자가 주된 생성물로 남는 순변화만 부정한다(S204). |
| T134 | H₃O⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 산성 용액에서 AgBr의 용해·종 분포는 계산하지 않는다. |
| T135 | H₃O⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | 산성 용액의 KCl 용해를 선택한 물과의 D02로 대신하지 않는다. |
| T136 | H₃O⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | 산성 용액의 NaBr 용해를 선택한 물과의 D03으로 대신하지 않는다. |
| T137 | H₃O⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | 산성 용액의 KBr 용해를 선택한 물과의 D04로 대신하지 않는다. |
| T138 | H₃O⁺ | NO₃⁻ | 검토된 부정 · N206 | HNO₃ 분자가 주된 생성물로 남는 순변화만 부정한다(S204). |
| T139 | OH⁻ | CH₃COOH | 양성 · A04 | 아세트산의 현재 O–H에서 H 하나를 OH⁻의 O로 옮긴다(C204). |
| T140 | OH⁻ | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산 이온의 염기 평형·OH⁻ 공통 이온 효과는 계산하지 않는다. |
| T141 | OH⁻ | K⁺ | 검토된 부정 · N207 | KOH 공유 분자·순침전 생성만 부정한다(S201). |
| T142 | OH⁻ | Br⁻ | 검토된 부정 · N208 | Br⁻가 산처럼 H를 주어 OH⁻와 중화하는 순변화만 부정한다(S202, S204). |
| T143 | OH⁻ | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | AgBr와 OH⁻의 용해·은 산화물 전환을 결합한 행이 없다. |
| T144 | OH⁻ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | 염기성 용액의 KCl 용해는 독립 D02 접촉이 아니다. |
| T145 | OH⁻ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | 염기성 용액의 NaBr 용해는 독립 D03 접촉이 아니다. |
| T146 | OH⁻ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | 염기성 용액의 KBr 용해는 독립 D04 접촉이 아니다. |
| T147 | OH⁻ | NO₃⁻ | 검토된 부정 · N209 | NO₃⁻가 산처럼 H를 주어 OH⁻와 중화하는 순변화만 부정한다(S204). |
| T148 | NH₃ | CH₃COOH | 양성 · A06 | 아세트산 O–H의 H를 NH₃의 N으로 옮긴다. 남는 비율은 미계산이다(C205). |
| T149 | NH₃ | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 두 염기와 물의 평형·종 분포를 하나의 양성자 사건으로 정하지 않는다. |
| T150 | NH₃ | K⁺ | 검토된 부정 · N210 | K⁺가 참여하여 NH₃를 산·염기로 전환하는 순변화만 부정한다(S202). |
| T151 | NH₃ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | NH₃·Br⁻ 접촉의 독립 부정 인증은 등록하지 않는다. NH₃의 물 평형도 있다. |
| T152 | NH₃ | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아 착물과 AgBr 용해가 결합된 경로는 미등록이다. |
| T153 | NH₃ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아가 있는 KCl 용해를 D02에 자동 결합하지 않는다. |
| T154 | NH₃ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아가 있는 NaBr 용해를 D03에 자동 결합하지 않는다. |
| T155 | NH₃ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | 암모니아가 있는 KBr 용해를 D04에 자동 결합하지 않는다. |
| T156 | NH₃ | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | NH₃·NO₃⁻ 접촉의 독립 부정 인증은 등록하지 않는다. |
| T157 | NH₄⁺ | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | 두 약산과 물의 양성자 분포는 계산하지 않는다. |
| T158 | NH₄⁺ | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | A06 역방향·암모늄 아세트산염의 평형 조성은 계산하지 않는다(C205). |
| T159 | NH₄⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | NH₄⁺·K⁺의 독립 접촉 인증은 등록하지 않는다. |
| T160 | NH₄⁺ | Br⁻ | 검토된 부정 · N211 | NH₄Br 공유 분자·순침전만 부정한다. NH₄⁺ 가수분해는 제외한다(S201). |
| T161 | NH₄⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | NH₄⁺가 있는 AgBr 용해·종 분포는 계산하지 않는다. |
| T162 | NH₄⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | 암모늄 용액의 KCl 용해를 D02에 자동 결합하지 않는다. |
| T163 | NH₄⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | 암모늄 용액의 NaBr 용해를 D03에 자동 결합하지 않는다. |
| T164 | NH₄⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | 암모늄 용액의 KBr 용해를 D04에 자동 결합하지 않는다. |
| T165 | NH₄⁺ | NO₃⁻ | 검토된 부정 · N212 | NH₄NO₃ 공유 분자·순침전만 부정한다. NH₄⁺ 가수분해는 제외한다(S201). |
| T166 | Ag⁺ | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | 은 이온·아세트산의 결합된 산도·배위 경로는 미등록이다. |
| T167 | Ag⁺ | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | 은–아세트산 이온 배위·은염의 정량 검토가 없다. 가용성 일반표만으로 모든 순변화를 부정하지 않는다. |
| T168 | Ag⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | Ag⁺·K⁺의 독립 접촉 인증은 등록하지 않는다. |
| T169 | Ag⁺ | Br⁻ | 양성 · P02 | 선택한 자유 Ag⁺·Br⁻ 한 쌍만 순수 AgBr 고체에 넣는다(C206–C207). |
| T170 | Ag⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Ag⁺ 공통 이온의 용해 평형이다. Br⁻ 없이 Ag⁺ 하나만 고체에 넣지 않는다. |
| T171 | Ag⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 AgCl 침전이 결합되어 P01 또는 D02 한 행으로 대체할 수 없다. |
| T172 | Ag⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 AgBr 침전이 결합되어 P02 또는 D03 한 행으로 대체할 수 없다. |
| T173 | Ag⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 AgBr 침전이 결합되어 P02 또는 D04 한 행으로 대체할 수 없다. |
| T174 | Ag⁺ | NO₃⁻ | 검토된 부정 · N213 | ordinary에서 AgNO₃ 순침전만 부정한다. 은 이온 전체 종 분포의 부정은 아니다(S201). |
| T175 | Cl⁻ | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | 아세트산·Cl⁻ 접촉의 독립 부정 인증은 등록하지 않는다. |
| T176 | Cl⁻ | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | Cl⁻·아세트산 이온의 독립 접촉 인증은 등록하지 않는다. |
| T177 | Cl⁻ | K⁺ | 검토된 부정 · N214 | ordinary에서 KCl 순침전만 부정한다(S201). |
| T178 | Cl⁻ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Cl⁻·Br⁻를 할로젠으로 산화할 등록 사건·독립 부정 인증이 없다. |
| T179 | Cl⁻ | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | AgBr의 염화물 착물·할로젠화 은 고체 전환을 결합한 행이 없다. |
| T180 | Cl⁻ | KCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Cl⁻ 공통 이온을 포함한 KCl 용해·포화량은 계산하지 않는다. |
| T181 | Cl⁻ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 다른 할로젠 이온의 맥락을 묶은 행이 없다. |
| T182 | Cl⁻ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 다른 할로젠 이온의 맥락을 묶은 행이 없다. |
| T183 | Cl⁻ | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | Cl⁻·NO₃⁻의 독립 접촉 인증은 등록하지 않는다. |
| T184 | AgCl(s) | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산이 있는 AgCl의 용해·종 분포는 계산하지 않는다. |
| T185 | AgCl(s) | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | AgCl 용해와 아세트산 이온 배위가 결합된 경로는 미등록이다. |
| T186 | AgCl(s) | K⁺ | 모름 · `EQUILIBRIUM_REQUIRED` | K⁺가 있는 AgCl의 용해 평형은 계산하지 않는다. |
| T187 | AgCl(s) | Br⁻ | 모름 · `NO_REVIEWED_RULE` | AgCl→AgBr 전환은 고체와 자유 Br⁻의 결합 경로다. 자유 Ag⁺의 P02로 대체하지 않는다(C209). |
| T188 | AgCl(s) | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 은염 고체의 공동 용해·상 조성·분배는 계산하지 않는다. |
| T189 | AgCl(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 AgCl 공통 이온 효과를 묶은 행이 없다. |
| T190 | AgCl(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 AgCl의 AgBr 전환을 묶은 행이 없다. |
| T191 | AgCl(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 AgCl의 AgBr 전환을 묶은 행이 없다. |
| T192 | AgCl(s) | NO₃⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | NO₃⁻가 있는 AgCl의 용해 평형은 계산하지 않는다. |
| T193 | Na⁺ | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | Na⁺·아세트산의 독립 접촉 인증은 등록하지 않는다. |
| T194 | Na⁺ | CH₃COO⁻ | 검토된 부정 · N215 | ordinary에서 아세트산 나트륨 순침전만 부정한다. 아세트산 이온 가수분해는 제외한다(S201). |
| T195 | Na⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | Na⁺·K⁺의 독립 접촉 인증은 등록하지 않는다. |
| T196 | Na⁺ | Br⁻ | 검토된 부정 · N216 | ordinary에서 NaBr 순침전만 부정한다(S201). |
| T197 | Na⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Na⁺가 있는 AgBr의 용해 평형은 계산하지 않는다. |
| T198 | Na⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | Na⁺가 있는 KCl 용해는 선택 물과의 독립 D02 접촉이 아니다. |
| T199 | Na⁺ | NaBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Na⁺ 공통 이온을 포함한 NaBr 용해·포화량은 계산하지 않는다. |
| T200 | Na⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | Na⁺가 있는 KBr 용해는 선택 물과의 독립 D04 접촉이 아니다. |
| T201 | Na⁺ | NO₃⁻ | 검토된 부정 · N217 | ordinary에서 NaNO₃ 순침전만 부정한다(S201). |
| T202 | NaCl(s) | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | NaCl 용해와 약산 용액을 묶은 행이 없다. |
| T203 | NaCl(s) | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | NaCl 용해와 아세트산 이온 평형을 묶은 행이 없다. |
| T204 | NaCl(s) | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺와 NaCl 고체 접촉을 물 손잡이의 D01로 대신하지 않는다. |
| T205 | NaCl(s) | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻와 NaCl 고체 접촉의 용해·혼합 염 맥락은 미등록이다. |
| T206 | NaCl(s) | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | NaCl 용해와 AgBr의 할로젠화물 교환 맥락은 미등록이다. |
| T207 | NaCl(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | NaCl·KCl 두 고체의 공동 용해·공통 Cl⁻ 맥락은 미등록이다. |
| T208 | NaCl(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaCl·NaBr 두 고체의 공동 용해·공통 Na⁺ 맥락은 미등록이다. |
| T209 | NaCl(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | NaCl·KBr 두 고체의 공동 용해·혼합 염 맥락은 미등록이다. |
| T210 | NaCl(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 질산 이온이 있는 NaCl 고체 접촉의 독립 행은 없다. |
| T211 | Zn(s) | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | 아세트산과 Zn의 수소 발생·부식 계열은 미등록이다. |
| T212 | Zn(s) | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산 이온과 Zn 표면의 배위·부식 맥락은 미등록이다. |
| T213 | Zn(s) | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺가 관찰자여도 물·공기와 Zn 표면 반응까지 일반 부정하지 않는다. |
| T214 | Zn(s) | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻와 Zn 표면의 부식·피막 반응은 미등록이다. |
| T215 | Zn(s) | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | AgBr 고체의 직접 환원은 자유 Ag⁺의 R02가 아니다. |
| T216 | Zn(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 Zn 표면의 Cl⁻ 효과를 묶은 행이 없다. |
| T217 | Zn(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 Zn 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T218 | Zn(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 Zn 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T219 | Zn(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 질산 이온·Zn·물의 산화환원·부식 맥락은 미등록이다. 관찰자라는 말로 부정하지 않는다. |
| T220 | Zn²⁺ | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | Zn²⁺ 가수분해와 아세트산 산도 분포를 함께 계산하지 않는다. |
| T221 | Zn²⁺ | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | Zn²⁺–아세트산 이온 배위·종 분포 규칙이 없다. |
| T222 | Zn²⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | Zn²⁺·K⁺의 독립 접촉 인증은 등록하지 않는다. |
| T223 | Zn²⁺ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Zn²⁺–Br⁻ 배위·종 분포의 독립 인증이 없다. |
| T224 | Zn²⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Zn²⁺가 있는 AgBr의 용해·종 분포는 계산하지 않는다. |
| T225 | Zn²⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 Zn²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T226 | Zn²⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 Zn²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T227 | Zn²⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 Zn²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T228 | Zn²⁺ | NO₃⁻ | 검토된 부정 · N218 | ordinary에서 Zn(NO₃)₂ 순침전만 부정한다. Zn²⁺ 가수분해는 제외한다(S201). |
| T229 | Cu(s) | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | 아세트산·Cu·공기의 표면 반응을 산 이름만으로 부정하지 않는다. |
| T230 | Cu(s) | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산 이온·Cu·공기의 표면 경로는 미등록이다. |
| T231 | Cu(s) | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺가 관찰자여도 Cu 표면의 물·공기 반응은 일반 부정하지 않는다. |
| T232 | Cu(s) | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻와 Cu 표면의 부식·피막·산화 경로는 미등록이다. |
| T233 | Cu(s) | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | AgBr 고체의 직접 환원은 자유 Ag⁺의 R03이 아니다. |
| T234 | Cu(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 Cu 표면의 Cl⁻ 효과를 묶은 행이 없다. |
| T235 | Cu(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 Cu 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T236 | Cu(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 Cu 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T237 | Cu(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 질산 이온·Cu·산소·산도의 산화환원 맥락은 미등록이다. |
| T238 | Cu²⁺ | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | Cu²⁺ 가수분해와 아세트산 산도 분포를 함께 계산하지 않는다. |
| T239 | Cu²⁺ | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | Cu²⁺–아세트산 이온 배위·종 분포 규칙이 없다. |
| T240 | Cu²⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | Cu²⁺·K⁺의 독립 접촉 인증은 등록하지 않는다. |
| T241 | Cu²⁺ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Cu²⁺–Br⁻의 착물·산화환원 결합 경로는 미등록이다. |
| T242 | Cu²⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Cu²⁺가 있는 AgBr의 용해·종 분포는 계산하지 않는다. |
| T243 | Cu²⁺ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 Cu²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T244 | Cu²⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 Cu²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T245 | Cu²⁺ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 Cu²⁺ 용액의 종 분포를 묶은 행이 없다. |
| T246 | Cu²⁺ | NO₃⁻ | 검토된 부정 · N219 | ordinary에서 Cu(NO₃)₂ 순침전만 부정한다. Cu²⁺ 가수분해는 제외한다(S201). |
| T247 | Ag(s) | CH₃COOH | 모름 · `NO_REVIEWED_RULE` | 아세트산·Ag·공기의 표면 반응은 미등록이다. |
| T248 | Ag(s) | CH₃COO⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산 이온·Ag·공기의 표면 경로는 미등록이다. |
| T249 | Ag(s) | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺가 관찰자여도 Ag 표면의 물·공기 반응은 일반 부정하지 않는다. |
| T250 | Ag(s) | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻와 Ag 표면의 산화·피막 반응은 미등록이다. |
| T251 | Ag(s) | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Ag/AgBr/Br⁻의 전극·용해 평형은 계산하지 않는다. |
| T252 | Ag(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 Ag 표면의 Cl⁻ 효과를 묶은 행이 없다. |
| T253 | Ag(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 Ag 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T254 | Ag(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 Ag 표면의 Br⁻ 효과를 묶은 행이 없다. |
| T255 | Ag(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 질산 이온·Ag·산소·산도의 산화환원 맥락은 미등록이다. |
| T256 | CH₃COOH | CH₃COOH | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산 두 분자의 물과의 이온화·양성자 분포는 계산하지 않는다. |
| T257 | CH₃COOH | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 아세트산/아세트산 이온 짝의 완충·교환·조성은 계산하지 않는다. |
| T258 | CH₃COOH | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺·아세트산 접촉의 독립 부정 인증은 등록하지 않는다. |
| T259 | CH₃COOH | Br⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산·Br⁻ 접촉의 독립 부정 인증은 등록하지 않는다. |
| T260 | CH₃COOH | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 약산 용액의 AgBr 용해·종 분포는 계산하지 않는다. |
| T261 | CH₃COOH | KCl(s) | 모름 · `NO_REVIEWED_RULE` | 약산 용액과 KCl 용해를 묶은 행이 없다. |
| T262 | CH₃COOH | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | 약산 용액과 NaBr 용해를 묶은 행이 없다. |
| T263 | CH₃COOH | KBr(s) | 모름 · `NO_REVIEWED_RULE` | 약산 용액과 KBr 용해를 묶은 행이 없다. |
| T264 | CH₃COOH | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산·NO₃⁻ 접촉의 독립 부정 인증은 등록하지 않는다. |
| T265 | CH₃COO⁻ | CH₃COO⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | 동종 아세트산 이온과 물의 가수분해 평형은 계산하지 않는다. |
| T266 | CH₃COO⁻ | K⁺ | 검토된 부정 · N220 | ordinary에서 아세트산 칼륨 순침전만 부정한다. 가수분해는 제외한다(S201). |
| T267 | CH₃COO⁻ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산 이온·Br⁻의 독립 접촉 인증은 등록하지 않는다. |
| T268 | CH₃COO⁻ | AgBr(s) | 모름 · `NO_REVIEWED_RULE` | AgBr 용해와 아세트산 이온 배위의 결합 경로는 미등록이다. |
| T269 | CH₃COO⁻ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 아세트산 이온 평형을 묶은 행이 없다. |
| T270 | CH₃COO⁻ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 아세트산 이온 평형을 묶은 행이 없다. |
| T271 | CH₃COO⁻ | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 아세트산 이온 평형을 묶은 행이 없다. |
| T272 | CH₃COO⁻ | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | 아세트산 이온·NO₃⁻의 독립 접촉 인증은 등록하지 않는다. |
| T273 | K⁺ | K⁺ | 모름 · `NO_REVIEWED_RULE` | K⁺ 동종 쌍의 독립 인증은 아직 등록하지 않는다. Na⁺의 N26을 자동 복사하지 않는다. |
| T274 | K⁺ | Br⁻ | 검토된 부정 · N221 | ordinary에서 KBr 순침전만 부정한다(S201). |
| T275 | K⁺ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | K⁺가 있는 AgBr의 용해 평형은 계산하지 않는다. |
| T276 | K⁺ | KCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | K⁺ 공통 이온을 포함한 KCl 용해·포화량은 계산하지 않는다. |
| T277 | K⁺ | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | K⁺와 NaBr 고체 접촉은 선택 물과의 D03이 아니다. |
| T278 | K⁺ | KBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | K⁺ 공통 이온을 포함한 KBr 용해·포화량은 계산하지 않는다. |
| T279 | K⁺ | NO₃⁻ | 검토된 부정 · N222 | ordinary에서 KNO₃ 순침전만 부정한다(S201). |
| T280 | Br⁻ | Br⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻ 동종 쌍을 Br₂로 바꿀 산화 사건·독립 부정 인증이 없다. |
| T281 | Br⁻ | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Br⁻ 공통 이온·은의 브로민화물 착물·AgBr 용해 분포는 계산하지 않는다. |
| T282 | Br⁻ | KCl(s) | 모름 · `NO_REVIEWED_RULE` | Br⁻와 KCl 고체의 용해·혼합 염 맥락은 미등록이다. |
| T283 | Br⁻ | NaBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Br⁻ 공통 이온을 포함한 NaBr 용해·포화량은 계산하지 않는다. |
| T284 | Br⁻ | KBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | Br⁻ 공통 이온을 포함한 KBr 용해·포화량은 계산하지 않는다. |
| T285 | Br⁻ | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | Br⁻·NO₃⁻의 독립 접촉 인증은 등록하지 않는다. |
| T286 | AgBr(s) | AgBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 AgBr 조각의 응집·용해 평형을 새 침전 사건으로 대신하지 않는다. |
| T287 | AgBr(s) | KCl(s) | 모름 · `NO_REVIEWED_RULE` | KCl 용해와 AgBr의 할로젠화물 교환 맥락은 미등록이다. |
| T288 | AgBr(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr 용해와 AgBr의 공통 Br⁻ 효과를 묶은 행이 없다. |
| T289 | AgBr(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KBr 용해와 AgBr의 공통 Br⁻ 효과를 묶은 행이 없다. |
| T290 | AgBr(s) | NO₃⁻ | 모름 · `EQUILIBRIUM_REQUIRED` | NO₃⁻가 있는 AgBr의 용해 평형은 계산하지 않는다. |
| T291 | KCl(s) | KCl(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 KCl 고체의 접촉에서 포화·용해량·응집을 자동 결정하지 않는다. |
| T292 | KCl(s) | NaBr(s) | 모름 · `NO_REVIEWED_RULE` | KCl·NaBr 두 고체의 공동 용해·혼합 염 맥락은 미등록이다. |
| T293 | KCl(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | KCl·KBr 두 고체의 공동 용해·공통 K⁺ 맥락은 미등록이다. |
| T294 | KCl(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | NO₃⁻와 KCl 고체 접촉의 독립 행은 없다. |
| T295 | NaBr(s) | NaBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 NaBr 고체의 접촉에서 포화·용해량·응집을 자동 결정하지 않는다. |
| T296 | NaBr(s) | KBr(s) | 모름 · `NO_REVIEWED_RULE` | NaBr·KBr 두 고체의 공동 용해·공통 Br⁻ 맥락은 미등록이다. |
| T297 | NaBr(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | NO₃⁻와 NaBr 고체 접촉의 독립 행은 없다. |
| T298 | KBr(s) | KBr(s) | 모름 · `EQUILIBRIUM_REQUIRED` | 두 KBr 고체의 접촉에서 포화·용해량·응집을 자동 결정하지 않는다. |
| T299 | KBr(s) | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | NO₃⁻와 KBr 고체 접촉의 독립 행은 없다. |
| T300 | NO₃⁻ | NO₃⁻ | 모름 · `NO_REVIEWED_RULE` | NO₃⁻ 동종 쌍의 독립 인증은 등록하지 않는다. 공명 표현을 별도 종으로 세지 않는다. |

### 5.1 부정 인증의 범위와 화면 문구

신규 인증은 N201–N222로 구별한다. 기본 맥락은 **해당 두 종+H₂O만**이며 §2의 조건 네 필드를 모두 적용한다. 제3 물질·활동도 조건 변경에 자동 복사하지 않는다. 각 인증은 다음 표의 **지정한 순변화만** 부정한다. 수화·배향·인력·미량 교환·다른 경로까지 부정하지 않는다. 특히 질산염의 가용성 인증은 질산 이온이 모든 조건에서 산화환원을 하지 않는다는 인증이 아니다.

각 ‘자세히’ 앞에는 §2의 공통 두 문장을 붙인다. 원문의 일반 종 성질을 이 좁은 접촉에 적용한 판단이며 독립 모델의 대조 전이다. 부정과 모름은 반응 대본을 실행하지 않고 World를 그대로 반환한다.

| 인증 / 조합 | 부정하는 순변화·근거 | 결과 제목 | 자세히에 덧붙일 문장 |
|---|---|---|---|
| N201 / T123 | K⁺의 눈에 띄는 산·염기 가수분해 생성만 부정한다(S202). | 칼륨 이온으로 남아요 | 물이 주변을 둘러싸도 이 조건에서는 눈에 띄는 산·염기 가수분해 생성물로 바꾸어 그리지 않아요. |
| N202 / T124 | Br⁻의 눈에 띄는 염기 가수분해 생성만 부정한다(S202). | 브로민화 이온으로 남아요 | 물에 둘러싸일 수 있지만, 이 조건에서 Br⁻의 염기 가수분해는 무시할 수 있어요. |
| N203 / T129 | NO₃⁻의 눈에 띄는 염기 가수분해 생성만 부정한다(S204). | 질산 이온으로 남아요 | 이 묽은 물속에서는 NO₃⁻의 염기 가수분해로 새 물질이 생기는 것으로 다루지 않아요. 다른 산화환원 반응까지 부정하는 말은 아니에요. |
| N204 / T132 | K⁺가 H₃O⁺를 중화하는 산·염기 순변화만 부정한다(S202). | 칼륨 이온은 중화에 참여하지 않아요 | K⁺가 H₃O⁺의 수소를 받아 중화하는 반응으로 그리지 않아요. 물의 움직임과 수소 교환까지 없다는 뜻은 아니에요. |
| N205 / T133 | HBr 분자가 주된 생성물로 남는 순변화만 부정한다(S204). | 이온으로 남아요 | 이 묽은 물속에서는 H₃O⁺와 Br⁻로 나타내요. HBr 분자가 주로 남는 장면으로 바꾸지 않아요. |
| N206 / T138 | HNO₃ 분자가 주된 생성물로 남는 순변화만 부정한다(S204). | 이온으로 남아요 | 이 묽은 물속에서는 H₃O⁺와 NO₃⁻로 나타내요. HNO₃ 분자가 주로 남는 장면으로 바꾸지 않아요. |
| N207 / T141 | KOH 공유 분자·순침전 생성만 부정한다(S201). | 두 이온은 따로 남아요 | K⁺와 OH⁻를 KOH 분자나 침전으로 묶지 않아요. 물을 말리는 경우는 다루지 않아요. |
| N208 / T142 | Br⁻가 산처럼 H를 주어 OH⁻와 중화하는 순변화만 부정한다(S202, S204). | 두 이온은 서로 중화하지 않아요 | Br⁻는 OH⁻에 수소를 내주는 산으로 작용하지 않아요. 수화와 순간적인 만남까지 부정하지 않아요. |
| N209 / T147 | NO₃⁻가 산처럼 H를 주어 OH⁻와 중화하는 순변화만 부정한다(S204). | 두 이온은 서로 중화하지 않아요 | NO₃⁻는 OH⁻에 수소를 내주는 산으로 작용하지 않아요. 다른 산화환원 반응을 판단한 것은 아니에요. |
| N210 / T150 | K⁺가 참여하여 NH₃를 산·염기로 전환하는 순변화만 부정한다(S202). | 칼륨 이온은 이 반응에 참여하지 않아요 | K⁺가 암모니아에 수소를 주거나 받는 반응으로 그리지 않아요. 암모니아와 물은 일부 반응할 수 있지만 그 비율은 계산하지 않아요. |
| N211 / T160 | NH₄Br 공유 분자·순침전만 부정한다. NH₄⁺ 가수분해는 제외한다(S201). | 새 브로민화 암모늄 고체가 생기지 않아요 | 이 묽은 물속에서는 NH₄⁺와 Br⁻를 한 분자나 침전으로 묶지 않아요. 암모늄의 가수분해 비율은 계산하지 않아요. |
| N212 / T165 | NH₄NO₃ 공유 분자·순침전만 부정한다. NH₄⁺ 가수분해는 제외한다(S201). | 새 질산 암모늄 고체가 생기지 않아요 | 이 묽은 물속에서는 NH₄⁺와 NO₃⁻를 한 분자나 침전으로 묶지 않아요. 암모늄의 가수분해 비율은 계산하지 않아요. |
| N213 / T174 | ordinary에서 AgNO₃ 순침전만 부정한다. 은 이온 전체 종 분포의 부정은 아니다(S201). | 새 질산 은 고체가 생기지 않아요 | 이 묽은 조건에서 AgNO₃의 새 침전을 만들지 않아요. 은 이온의 수화와 전체 종 분포를 계산한 것은 아니에요. |
| N214 / T177 | ordinary에서 KCl 순침전만 부정한다(S201). | 새 염화 칼륨 고체가 생기지 않아요 | 이 묽은 물속에서 K⁺와 Cl⁻로 새 결정을 만들지 않아요. 농축이나 증발은 다루지 않아요. |
| N215 / T194 | ordinary에서 아세트산 나트륨 순침전만 부정한다. 아세트산 이온 가수분해는 제외한다(S201). | 새 아세트산 나트륨 고체가 생기지 않아요 | 이 묽은 물속에서 아세트산 나트륨의 새 침전을 만들지 않아요. 아세트산 이온과 물의 평형은 따로 계산하지 않아요. |
| N216 / T196 | ordinary에서 NaBr 순침전만 부정한다(S201). | 새 브로민화 나트륨 고체가 생기지 않아요 | 이 묽은 물속에서 Na⁺와 Br⁻로 새 결정을 만들지 않아요. 농축이나 증발은 다루지 않아요. |
| N217 / T201 | ordinary에서 NaNO₃ 순침전만 부정한다(S201). | 새 질산 나트륨 고체가 생기지 않아요 | 이 묽은 물속에서 NaNO₃의 새 침전을 만들지 않아요. 농축이나 증발은 다루지 않아요. |
| N218 / T228 | ordinary에서 Zn(NO₃)₂ 순침전만 부정한다. Zn²⁺ 가수분해는 제외한다(S201). | 새 질산 아연 고체가 생기지 않아요 | 이 묽은 물속에서 Zn(NO₃)₂의 새 침전을 만들지 않아요. Zn²⁺의 가수분해나 다른 생성물까지 없다는 뜻은 아니에요. |
| N219 / T246 | ordinary에서 Cu(NO₃)₂ 순침전만 부정한다. Cu²⁺ 가수분해는 제외한다(S201). | 새 질산 구리 고체가 생기지 않아요 | 이 묽은 물속에서 Cu(NO₃)₂의 새 침전을 만들지 않아요. Cu²⁺의 가수분해나 다른 생성물까지 없다는 뜻은 아니에요. |
| N220 / T266 | ordinary에서 아세트산 칼륨 순침전만 부정한다. 가수분해는 제외한다(S201). | 새 아세트산 칼륨 고체가 생기지 않아요 | 이 묽은 물속에서 아세트산 칼륨의 새 침전을 만들지 않아요. 아세트산 이온과 물의 평형은 따로 계산하지 않아요. |
| N221 / T274 | ordinary에서 KBr 순침전만 부정한다(S201). | 새 브로민화 칼륨 고체가 생기지 않아요 | 이 묽은 물속에서 K⁺와 Br⁻로 새 결정을 만들지 않아요. 농축이나 증발은 다루지 않아요. |
| N222 / T279 | ordinary에서 KNO₃ 순침전만 부정한다(S201). | 새 질산 칼륨 고체가 생기지 않아요 | 이 묽은 물속에서 KNO₃의 새 침전을 만들지 않아요. 농축이나 증발은 다루지 않아요. |

Zn²⁺·NO₃⁻와 Cu²⁺·NO₃⁻는 양이온 하나·음이온 하나의 1:1 중성 염을 만드는 행이 아니다. N218·N219는 실제 염의 1:2 화학량론을 전제로 **그 질산염의 순침전만** 부정한다. 부족한 두 번째 음이온을 몰래 만들거나 “음이온이 부족하니 반응하지 않음”으로 판정하지 않는다. K⁺·K⁺ 등 이번에 인증하지 않은 행은 단계 1 N26의 Na⁺ 인증을 자동 복사하지 않았다.

### 5.2 모름과 실패 문구

단계 1의 코드·첫 화면 문장을 그대로 사용한다. 표의 구체적 사유는 ‘자세히’에 해요체로 풀어 적고, 코드만 다른 제목으로 바꾸지 않는다.

| 코드 | 결과 제목 |
|---|---|
| SPECIES_UNREVIEWED, SPECIATION_UNSUPPORTED, SITE_UNREVIEWED, NO_REVIEWED_RULE | 아직 이 조합은 판단할 수 없어요. |
| ENV_UNSUPPORTED, CONDITION_MISSING, CONDITION_BORDERLINE | 이 조건에서는 판단할 수 없어요. |
| CONTEXT_UNREVIEWED, COMPETING_PATHWAYS | 함께 있는 재료 때문에 판단할 수 없어요. |
| EQUILIBRIUM_REQUIRED | 얼마나 반응하는지는 계산하지 않아요. |
| RULE_CONFLICT, REPRESENTATION_UNAVAILABLE | 장면을 정확히 만들지 못했어요. |

마지막 행은 실행 실패이며 화학적 모름과 별도다. 예를 들어 T125의 자세히는 **“AgBr도 물에 조금 녹을 수 있어요. 녹아 남는 양과 포화 상태는 계산하지 않아요.”**, T187은 **“있던 AgCl 고체가 다른 은염으로 바뀌는 과정은 아직 다루지 않아요. 자유 이온끼리 모이는 장면으로 대신하지 않아요.”**다.

## 6. 사건별 맥락과 실행 공통 계약

### 6.1 허용 맥락

선택한 두 입자만이 아니라 **활성 무대의 현재 종·상·고체 구성원 전체**를 검사한다. 선반은 제외한다. 아래 목록은 이 사건을 그릴 제품 범위이며 용액의 모든 상호작용이 없다는 선언이 아니다.

| 사건 | 허용하는 활성 종의 전체 목록 | 추가 차단·선택 |
|---|---|---|
| A03 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, CH₃COOH, CH₃COO⁻, Na⁺, K⁺, Cl⁻, Br⁻, NO₃⁻ | 선택한 H와 O만 반응; 금속·금속 이온·이온 고체 및 목록 밖은 CONTEXT_UNREVIEWED |
| A04 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, CH₃COOH, CH₃COO⁻, Na⁺, K⁺, Cl⁻, Br⁻, NO₃⁻ | 현재 OH의 H만 선택. 메틸 H 또는 잘못된 자리면 SITE_UNREVIEWED |
| A06 | H₂O, H₃O⁺, OH⁻, NH₃, NH₄⁺, CH₃COOH, CH₃COO⁻, Na⁺, K⁺, Cl⁻, Br⁻, NO₃⁻ | 선택한 O–H와 N만 반응; 전체 완충·경쟁 산염기 평형을 자동 순환하지 않음 |
| P02 | H₂O, Ag⁺, Br⁻, AgBr(s), Na⁺, K⁺, NO₃⁻ | Cl⁻도 있으면 P01/P02가 같은 Ag⁺를 두고 경쟁하므로 COMPETING_PATHWAYS. NH₃·OH⁻·아세트산 이온·금속·AgCl(s)·가용성 고체 등 목록 밖은 CONTEXT_UNREVIEWED |
| D02 | H₂O, K⁺, Cl⁻, KCl(s), Na⁺ | 선택 물+KCl 표면 한 쌍; Ag⁺ 등 목록 밖 차단. Na⁺는 검사 관찰자에 한해 좁게 허용한 추가 정책 |
| D03 | H₂O, Na⁺, Br⁻, NaBr(s) | 선택 물+NaBr 표면 한 쌍; Ag⁺ 등 목록 밖은 CONTEXT_UNREVIEWED |
| D04 | H₂O, K⁺, Br⁻, KBr(s), Na⁺ | 선택 물+KBr 표면 한 쌍; Ag⁺ 등 목록 밖 차단. Na⁺ 허용은 D02와 같은 추가 정책 |

D02·D04의 Na⁺ 허용은 S202의 종 성질을 반영한 **대조 전 맥락 선택**이다. “검사 관찰자”라는 별도 화학종은 없으므로 실제 구현에서도 같은 Na⁺를 구별 없이 허용하되 변경하지 않는다. D 계열은 생성 이온과 남은 같은 고체가 있어도 한 쌍 분리 도식을 계속 볼 수 있다. 실제 공통 이온·포화량을 계산해 반복 횟수를 정한 것이 아니다. 자유 이온을 고체에 직접 놓는 조합은 §5의 평형 모름이며 물 손잡이 접촉과 구별한다.

**단계 1 A01·A02·A05·P01·D01·R01–R03의 허용 목록은 이 문서로 자동 확대하지 않는다.** 따라서 새 재료가 무대에 남은 상태에서 기존 사건을 이어 실행할 때 기존 맥락 검사에 걸릴 수 있다. 마지막 §9에 통합 의견을 적는다. 신규 A03→A04는 두 행 모두 새 목록 안이므로 이어 실행할 수 있다. 실험실 맥락 판정 구현을 이번에 실행 검사한 것은 아니다.

### 6.2 원자 매핑과 원자성

- `compile`은 fixture 머리말로 base를 만들고, `compileFrom(base, getStage('solution'), steps)`에는 `step` 블록만 넘긴다. 실험실은 일반 엔진보다 좁은 명령·자리·종 허용 목록을 따로 검사한다.
- `owner`는 처음 선언한 이름이다. A03의 `a.H1`이 아세트산에 붙어도 `b.H4`로 이름을 바꾸지 않는다. 종 인스턴스는 현재 연결 그래프와 `{instanceId,revision}`으로 새로 식별하고 AtomId는 유지한다.
- 고체·분자 이름은 기존 names·원자 ID·crystals와 겹치지 않게 발급한다. P02의 생성 고체 ID는 effects에서 받는다. `ppt#1`을 영구 가정하지 않는다.
- 원자별 원소·ID·owner·추적 번호, 추적 원자 집합, 모델 전자 수, 총전하, 정확한 결합과 고체 구성원을 검증한다. 배경 수화 물은 별도 연출 재고이며 이 보존 검사에 섞지 않는다.
- 끝 상태에서 관찰자 원자·결합·전자·고체 소속·좌표가 유지되어야 한다. 실험실 상·재고·수화·이력까지 포함해 한 사용자 조작으로 적용하거나 전부 폐기한다. 취소 시 revision은 새로 발급한다.
- 음성·모름·실패의 World는 불변이다. 컴파일 성공만으로 승인하지 않는다. 같은 입력의 결정성, 잘못된 목표의 전체 폐기, 연속 실행은 §8의 실제 실행 기록과 구별한다.

## 7. 일곱 양성 사건의 실행 행

모든 실행 행은 §2의 조건 네 필드, §6.1의 해당 허용 목록, `review.status='draft'`를 갖는다. 아래 머리말은 **검사용 base 생성용**이고 단계 대본은 실제 엔진 명령이다. 공통 검사 관찰자는 `mol observer = Na+ at 850,170` 한 개를 머리말에 추가한다. 본문의 수량은 관찰자를 제외하며, 검사는 원자 수에 1·총전하에 +1을 더한다. Na⁺ 관찰자는 전자 수를 늘리지 않는다.

| 사건 | 본문 추적 원자 / 모형 전자 / 총전하 | 관찰자 포함 검사 값 |
|---|---|---|
| A03, O2 또는 O1 | 11 / 32 / 0 | 12 / 32 / +1 |
| A04 | 10 / 32 / −1 | 11 / 32 / 0 |
| A06 | 12 / 32 / 0 | 13 / 32 / +1 |
| P02 최소 | 2 / 8 / 0 | 3 / 8 / +1 |
| D02·D03·D04 최소, 선택 물 포함 | 5 / 16 / 0 | 6 / 16 / +1 |
| D02·D03·D04 12이온, 선택 물 포함 | 15 / 56 / 0 | 16 / 56 / +1 |

모든 H는 끝에서도 lp0·rad0·q0이며 단일 공유 결합 하나만 가진다. 이 절의 모든 반응 원자는 rad0이고 금속용 lattice는 설정하지 않는다. 탄소는 lp0·q0을 유지한다. 원자 수로 평형 비율을 계산하지 않는다.

### A03 — H₃O⁺ + CH₃COO⁻ → H₂O + CH₃COOH

- 근거: V201, C203·C208, S207.
- 입력: `a=H3O+`, `b=CH3COO-`. 기본 표현은 `b.C2=b.O1`, `b.C2–b.O2`다. `a.O–a.H1`의 H를 선택한 카복실산 이온 O에 옮긴다. 동등한 H도 실제 ID로 치환한다.
- base 머리말:

```text
stage solution
mol a = H3O+ at 280,260
mol b = CH3COO- at 500,300
```

기본 O2 선택 대본:

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.O2 a.H1
step "아세트산 이온이 수소를 받아요"
  transfer a.H1 to b.O2
```

끝은 물 `{a.O,a.H2,a.H3}`와 아세트산 `{b.C1,b.C2,b.O1,b.O2,b.H1,b.H2,b.H3,a.H1}`이다. `a.O–a.H1` 제거, `b.O2–a.H1` 단일 결합 추가, 나머지 결합은 그대로다. `a.O` lp1→2, `b.O2` lp3→2이며 두 종의 모든 원자 q0이다. `b.O1`은 lp2이고 C2=O1은 이중 결합이다. `b.H4`는 생성하지 않는다.

**같은 base에서 O1을 선택한 경우**도 A03이다. 아래 세 줄은 같은 반응 step에 넣고 별도의 ‘공명 전환’ 사건으로 노출하지 않는다.

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.O1 a.H1
step "선택한 산소가 수소를 받아요"
  arrow b.C2~b.O1 -> b.O1
  arrow b.O2:lp -> b.C2~b.O2
  transfer a.H1 to b.O1
```

이때 끝의 원자 집합·전자·전하는 기본 경우와 같지만 `b.O1–a.H1`이 생기고, C2–O1은 단일·C2=O2는 이중 결합이다. O 세 개는 모두 lp2·q0이다. 처음부터 반대 공명식인 `smiles:CC([O-])=O`로 base를 만들었다면 O1이 단일결합 음전하 자리이므로 기본 transfer의 받는 ID를 O1으로 바꾸면 된다. 이미 바뀐 공명식에 위 두 arrow를 중복 적용하지 않는다. 템플릿 선택은 문자열 O 번호가 아니라 현재 결합 차수·lp·q와 계획의 선택 O로 정한다.

현재 엔진에서 두 대본의 컴파일·끝 장부는 확인했다. 두 arrow의 시간 순서나 화면이 실제 공명 왕복으로 오해되지 않는지는 미검사다. `shifts`가 있다는 이유로 반응 경로가 검증되었다고 하지 않는다. O1 가지는 **화면 검토 전 실행 공개 금지**이며, 이 제한을 O1의 화학적 반응성이 낮다는 문구로 바꾸지 않는다.

- 결과 제목: **“아세트산과 물이 되었어요.”**
- 자세히: **“아세트산 이온의 산소가 H₃O⁺에서 수소 하나를 받았어요. 두 산소는 동등하고, 그림은 전자를 한 가지 루이스 구조로 나타내요. 이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요.”**

### A04 — CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O

- 근거: V201·V203, C204·C208.
- 독립 입력은 `a.O2–a.H4`와 `b.O`다. 메틸 C1의 H1/H2/H3는 이 행의 산성 자리로 등록하지 않는다.
- base 머리말:

```text
stage solution
mol a = CH3COOH at 280,260
mol b = OH- at 500,300
```

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.O a.H4
step "아세트산이 수소를 내줘요"
  transfer a.H4 to b.O
```

끝은 아세트산 이온 `{a.C1,a.C2,a.O1,a.O2,a.H1,a.H2,a.H3}`와 물 `{b.O,b.H,a.H4}`이다. `a.O2–a.H4` 제거, `b.O–a.H4` 단일 결합 추가다. `a.O2` lp2→3·q−1, `b.O` lp3→2·q0, `a.O1` lp2·q0이며 C2=O1 이중 결합은 그대로다. 원자10·전자32·총전하−1이다.

A03→A04 연속 fixture는 A03 끝에 `addSpecies(end,'OH-','c',{x:700,y:400})`로 재료를 놓고, 아래 단계로 **같은 a.H1**을 옮긴다.

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach c.O a.H1
step "아세트산에서 같은 수소가 옮겨가요"
  transfer a.H1 to c.O
```

끝은 처음 물 `{a.O,a.H2,a.H3}`, 아세트산 이온 `{b.C1,b.C2,b.O1,b.O2,b.H1,b.H2,b.H3}`, 새 물 `{c.O,c.H,a.H1}`이다. A03에서 OH가 된 실제 O–a.H1 결합을 끊는다. 기본 가지는 b.O2 lp3·q−1, O1 선택 가지는 b.O1 lp3·q−1이며 반대 O가 이중 결합·lp2다. 전체 원자13·전자40·총전하−1, 관찰자 포함 14·40·0이다. `a.H1.owner='a'`를 유지하고 `b.H4`를 만들지 않는다.

- 결과 제목: **“아세트산 이온과 물이 되었어요.”**
- 자세히: **“OH⁻가 아세트산의 OH에 붙어 있던 수소 하나를 받았어요. 아세트산 이온의 두 산소는 동등하지만 그림은 한 가지 루이스 구조로 나타내요. 반응한 비율은 계산하지 않아요.”**

### A06 — CH₃COOH + NH₃ → CH₃COO⁻ + NH₄⁺

- 근거: V201·V203·V204, C205·C208.
- 입력은 아세트산의 현재 O–H와 암모니아 N의 lp 하나다.
- base 머리말:

```text
stage solution
mol a = CH3COOH at 280,260
mol b = NH3 at 500,300
```

```text
step "수소가 옮겨질 자리가 가까워져요"
  approach b.N a.H4
step "암모니아가 수소를 받아요"
  transfer a.H4 to b.N
```

끝은 아세트산 이온 `{a.C1,a.C2,a.O1,a.O2,a.H1,a.H2,a.H3}`, 암모늄 `{b.N,b.H1,b.H2,b.H3,a.H4}`이다. `a.O2–a.H4` 제거, `b.N–a.H4` 단일 결합 추가다. `a.O2` lp3·q−1, `a.O1` lp2·q0, `b.N` lp0·q+1이며 그 밖의 원자 q0이다. 원자12·전자32·총전하0이다. 암모늄의 H를 `b.H4`로 바꾸지 않는다.

역접촉 NH₄⁺+CH₃COO⁻는 T158의 `EQUILIBRIUM_REQUIRED`다. K가 크다는 이유로 제품 생성물을 무조건 역반응 금지로 인증하지 않는다. 생성 NH₄⁺의 원자 ID는 다음 반응에서도 쓸 수 있지만 단계 1 A05의 맥락 확대는 별도다(§9).

- 결과 제목: **“아세트산 이온과 암모늄 이온이 되었어요.”**
- 자세히: **“암모니아의 질소가 아세트산에서 수소 하나를 받았어요. 이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요.”**

### P02 — Ag⁺ + Br⁻ → AgBr(s)

- 근거: V202, C206·C207, S201·S205.
- 자유 단원자 이온의 선언 이름 a·b를 예약한다. 결정·금속·배경 물에 든 원자는 입력이 아니다. 기본 세트를 세 쌍으로 주어도 한 조작은 선택한 한 쌍만 쓴다.
- base 머리말:

```text
stage solution
mol a = Ag+ at 280,260
mol b = Br- at 500,300
```

```text
step "브로민화 은 고체에 모여요"
  precipitate using a b
```

이미 있는 **순수 AgBr** 고체 s에 넣는 경우:

```text
step "있던 브로민화 은 고체가 커져요"
  precipitate using a b onto s
```

s는 effects에서 받은 실제 고체 ID로 치환한다. 기존 판 선택은 드롭 대상→가장 가까운 고체→안정 ID 순의 제품 선택이며 핵생성 확률이 아니다. AgCl·KBr·혼합 AgCl/AgBr·금속·빈 고체에는 넣지 않는다.

끝에서 구성원은 정확히 `{a.Ag,b.Br}` 또는 기존 s 집합에 이 두 ID를 더한 집합이다. Ag lp0·rad0·q+1, Br lp4·rad0·q−1이며 공유 결합0, 연결 성분 둘, 원자2·전자8·총전하0이다. 자유 이온의 attached 수화 연결은 해제한다. `crystals` 소속만 바뀌며 금속용 lattice를 요구하지 않는다. 첫 쌍부터 판 하나, onto 뒤 같은 판 확장은 별도 화면 검토 대상이다.

세 쌍 연속 fixture는 `a1,a2,a3=Ag+`, `b1,b2,b3=Br-`를 놓고 **(a3,b2)→(a1,b1)→(a2,b3)** 순서로 서로 다른 compileFrom 호출을 한다. 고체 구성원은 `{a3.Ag,b2.Br}`→여기에 `a1.Ag,b1.Br` 추가→여기에 `a2.Ag,b3.Br` 추가다. 선택하지 않은 이온은 자유 이온이다. 전체 원자6·전자24·총전하0, 관찰자 포함 7·24·+1을 유지한다.

- 결과 제목: **“브로민화 은 고체가 생겼어요.”** / onto: **“브로민화 은 고체가 커졌어요.”**
- 자세히: **“Ag⁺와 Br⁻가 전하를 그대로 가진 채 고체에 모였어요. 작은 판은 고체의 한 부분을 나타내요. 실제 결정이 생기는 속도나 녹아 남는 양은 계산하지 않아요.”**

### D02 — KCl(s) → K⁺ + Cl⁻, 물은 용매

- 근거: S201·S203. 선택 물 w와 고체 s의 인접한 표면 한 쌍 s1.K·s2.Cl이다.
- 최소 base 머리말:

```text
stage solution
crystal s = KCl at bottom 2x1
mol w = H2O at 220,260
```

```text
step "염화 칼륨 결정에서 이온이 나와요"
  dissolve s1 s2 from s
```

끝의 자유 이온은 `s1.K`(lp0·q+1), `s2.Cl`(lp4·q−1)이다. 물 `{w.O,w.H1,w.H2}`는 원래 두 O–H 결합, O lp2·q0, H lp0·q0을 유지한다. 이온 사이 공유 결합은 없고 세 연결 성분이다. 원자5·전자16·총전하0이다. 두 이온의 s 소속을 해제하고 각자의 중복 없는 배경 물 수화 연결을 만든다.

12이온 fixture는 머리말을 `4x3`으로 바꾼다. 초기 구성원은 `{s1.K,s2.Cl,s3.K,s4.Cl,s5.Cl,s6.K,s7.Cl,s8.K,s9.K,s10.Cl,s11.K,s12.Cl}`이다. 같은 명령 뒤 **s1.K·s2.Cl만** 자유 이온이고 나머지10개가 s에 남는다. 남은 이온의 ID·전자·전하·상대 위치는 유지한다. 원자15·전자56·총전하0이다.

- 결과 제목: **“염화 칼륨에서 이온 한 쌍이 나왔어요.”**
- 자세히: **“K⁺와 Cl⁻가 결정에서 나와 물에 둘러싸였어요. 물 분자가 소모되는 반응은 아니에요. 녹을 수 있는 총량은 계산하지 않아요.”**

### D03 — NaBr(s) → Na⁺ + Br⁻, 물은 용매

- 근거: S201·S203. 선택 물 w와 s의 표면 s1.Na·s2.Br을 선택한다.
- 최소 base 머리말:

```text
stage solution
crystal s = NaBr at bottom 2x1
mol w = H2O at 220,260
```

```text
step "브로민화 나트륨 결정에서 이온이 나와요"
  dissolve s1 s2 from s
```

끝의 자유 이온은 `s1.Na`(lp0·q+1), `s2.Br`(lp4·q−1), 물은 `{w.O,w.H1,w.H2}`다. 두 이온은 공유 결합이 없고 물만 원래 O–H 단일 결합 두 개를 가진다. 물 O lp2·q0·H lp0·q0, 모든 rad0이다. s 소속 해제·수화 연결 생성 후 원자5·전자16·총전하0을 유지한다.

12이온 fixture는 `{s1.Na,s2.Br,s3.Na,s4.Br,s5.Br,s6.Na,s7.Br,s8.Na,s9.Na,s10.Br,s11.Na,s12.Br}`이다. 같은 명령 뒤 **s1.Na·s2.Br만** 자유 이온이며 나머지10개는 s의 ID·전자·전하·상대 위치를 유지한다. 원자15·전자56·총전하0이다.

- 결과 제목: **“브로민화 나트륨에서 이온 한 쌍이 나왔어요.”**
- 자세히: **“Na⁺와 Br⁻가 결정에서 나와 물에 둘러싸였어요. 물 분자가 소모되는 반응은 아니에요. 녹을 수 있는 총량은 계산하지 않아요.”**

### D04 — KBr(s) → K⁺ + Br⁻, 물은 용매

- 근거: S201·S203. 선택 물 w와 s의 표면 s1.K·s2.Br을 선택한다.
- 최소 base 머리말:

```text
stage solution
crystal s = KBr at bottom 2x1
mol w = H2O at 220,260
```

```text
step "브로민화 칼륨 결정에서 이온이 나와요"
  dissolve s1 s2 from s
```

끝의 자유 이온은 `s1.K`(lp0·q+1), `s2.Br`(lp4·q−1), 물은 `{w.O,w.H1,w.H2}`다. 원래 물의 두 O–H 단일 결합만 남고 이온 사이에는 공유 결합이 없다. 물 O lp2·q0·H lp0·q0, 모든 rad0이다. s 소속 해제·수화 연결 생성 후 원자5·전자16·총전하0을 유지한다.

12이온 fixture는 `{s1.K,s2.Br,s3.K,s4.Br,s5.Br,s6.K,s7.Br,s8.K,s9.K,s10.Br,s11.K,s12.Br}`이다. 같은 명령 뒤 **s1.K·s2.Br만** 자유 이온이고 나머지10개는 s의 ID·전자·전하·상대 위치를 유지한다. 원자15·전자56·총전하0이다.

- 결과 제목: **“브로민화 칼륨에서 이온 한 쌍이 나왔어요.”**
- 자세히: **“K⁺와 Br⁻가 결정에서 나와 물에 둘러싸였어요. 물 분자가 소모되는 반응은 아니에요. 녹을 수 있는 총량은 계산하지 않아요.”**

D02–D04 공통: 최소 fixture의 끝에는 엔진이 `crystals['s']=[]`를 남긴다. 빈 항목은 활성 고체가 아니므로 판을 그리지 않는다. 남은 결정이 있으면 그 실제 구성원을 감싸는 판만 남긴다. 같은 두 ID를 다시 용해하면 실패하고 base가 보존되어야 한다. 수화 물의 생성·정리는 별도이며 물 손잡이 w를 소비하거나 반응 재고의 원자를 새로 만들지 않는다.

D03 또는 D04의 최소 fixture 뒤에는 남아 있는 활성 고체가 없다. 그 끝에 `addSpecies(end,'Ag+','a',{x:700,y:400})`로 은 이온을 놓고 P02의 `using a b`를 `using a s2`로 치환하면, 바로 그 `s2.Br`가 새 고체에 들어간다. 새 고체 구성원은 정확히 `{a.Ag,s2.Br}`이며 `s1.Na` 또는 `s1.K`와 선택 물 w는 그대로다. Br의 자유 수화 연결은 해제하고 고체 내 전하 −1·lp4는 유지한다. 관찰자 포함 원자7·전자16·총전하+2다. 12이온 fixture처럼 NaBr/KBr 고체가 남아 있으면 P02의 맥락 밖이므로 같은 연속 실행을 자동 허용하지 않는다.

## 8. 인수 시험과 대조 기록

### 8.1 실행 방법과 범위

검사는 Node 24.20.0에서 표준 입력으로 실행했다. 임시 파일·테스트 파일·빌드 결과를 만들지 않는다. `node:module`의 `registerHooks`로 기존 확장자 없는 상대 import에 `.ts`를 해석하고 `stripTypeScriptTypes(...,{mode:'transform'})`로 메모리에서만 불러왔다. 실제 `compile`·`compileFrom`·`addSpecies`를 사용한다. 실험실 앱·테스트 러너·렌더러는 실행하지 않았다.

검사의 base 머리말과 단계 대본은 **이 문서 §7 코드 블록을 직접 추출**한다. 기대 결합·원자 상태·구성원은 본문의 목록을 별도로 작성해 대조하며 엔진 출력 자체를 기대값으로 복사하지 않는다. 동등 O 선택은 각각 따로 검사한다. 12이온 용해는 머리말의 `2x1`을 `4x3`으로 바꾼다.

검증에 사용한 기존 파일 SHA-256:

| 파일 | SHA-256 |
|---|---|
| src/engine/compile.ts | 3fff9a14f9b4d86e421e195a1fd19ddb91d127a810a4ea18b738c07a168c6c30 |
| src/engine/world.ts | 7a99fe1cbc90d60216b7a17b3293334a678afdc46e93a4e4e5123dd9e23bc35d |
| src/engine/timeline.ts | 234f0185960b046622e07ada288a4dceed1ef9d54feb81043fabff1d3aca7d9d |
| src/chem/library.ts | d086758ddb2ec5fcae9e921018ca6a8fdf004b25b196fc4e5700cb6e8fc4539f |
| docs/plan/lab-rows-stage1.md | 2cfc1ff83f3b61ced6ee3ce3be161bb8df8763e675a09b543f5c65a52e1e6ecc |

### 8.2 이번 실행 기록

2026-11-12, 문서에서 읽은 대본을 사용한 메모리 검사 **24묶음 통과, 실패 0**이다. 별도의 표 완전성 검사도 통과했다. 이는 아래 구체적 범위의 검사이며 §8.3의 미실행 항목까지 완료했다는 뜻이 아니다.

| 검사 묶음 | 수 | 실제 확인한 내용 |
|---|---:|---|
| A03 O2·O1 각각 및 각각의 A03→A04 | 2 | 선택 O에 붙는 정확한 a.H1, 결합 차수·lp·q·원자 집합·모형 전자·총전하, a.H1 owner 유지, 가짜 b.H4 없음. 동일 base·steps의 전체 결과 결정성 |
| 반대 공명식 base의 A03 O1 | 1 | `smiles:CC([O-])=O`에서 직접 O1 transfer, C2=O2와 O1–a.H1 유지 |
| A04·A06 독립 | 2 | 본문에 적은 정확한 결합·원자별 장부·수량 |
| P02 최소 | 1 | 자유 두 이온만 고체 편입, effects의 실제 이름·추가 ID·onto=false, 공유 결합0 |
| P02 세 쌍 연속 | 1 | a3/b2→a1/b1→a2/b3 선택, 같은 고체 2→4→6 구성원, effects와 onto=true |
| P02+NO₃⁻+K⁺ 관찰자 | 1 | 질산 이온의 정확한 N/O 장부·내부 결합과 모든 관찰자 좌표·상태 보존 |
| D02·D03·D04의 2x1·4x3 | 6 | 한 쌍만 이탈, 최소의 빈 결정·큰 결정의 남은10개 ID와 좌표 보존, 물 그래프·장부 유지, 중복·공유 없는 배경 수화 연결, 같은 두 ID 재용해 거부 |
| P02 거부 입력 | 6 | AgCl onto, KBr onto, 이미 고체인 입력, 없는/빈 고체·같은 부호·같은 이온·NO₃⁻ 입력, 금속 onto, 메모리에서 구성한 혼합 AgBr/AgCl onto. 마지막 혼합 fixture는 화학적 생성 시뮬레이션이 아니라 잘못된 상태 입력 검사 |
| 성공 단계 뒤 실패·없는 용해 대상 | 2 | 먼저 침전한 다음 같은 이온 재침전 실패 시 전체 폐기, D02의 없는 선언 이름 거부 |
| D03→P02·D04→P02 최소 fixture | 2 | 용해된 동일 s2.Br 재사용, 해당 수화 연결 해제, s1.Na/K와 물 w의 좌표·상태 보존 |
| **합계** | **24** | 성공 시 base 불변·initial 복사·Na⁺ 관찰자 보존·원자 ID/원소/owner/번호·총량 보존을 공통 확인. 거부 시 errors가 있고 timeline/end=null·effects=[]·base 불변 |

표 검사는 실제 두 문서의 T행을 읽어 정규화한 쌍의 집합을 만들었다. 24종의 동종 포함 300쌍 모두 존재, 중복0·누락0, 새 ID T121–T300 연속, 추가 **7/22/151**, 합계 **15/35/250**을 확인했다. 신규 부정22행이 N201–N222의 상세 인증에 모두 연결되는지도 확인했다. 계산은 C201–C209의 식·입력으로 재현했으며, C208의 K/Q 양 끝과 C209의 320·logK=2.50514998도 확인했다. 이것은 작성자의 계산 재현이며 독립 모델 대조가 아니다.

재현 시 PowerShell에서 표준 입력을 보낼 때 `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`로 둔다. 초기 추출 시도는 파이프의 기본 인코딩 때문에 제목의 긴 대시를 찾지 못했으며, UTF-8 설정 뒤 문서의 한국어 대본 그대로 위 검사를 수행했다. 그 추출 오류를 화학·엔진 실패로 세지 않는다. 초기 탐색에서 crystal의 위치를 숫자 좌표로 적은 입력도 거부되었으며, 최종 머리말은 현재 문법의 `at bottom`을 사용해 통과했다.

### 8.3 아직 실행·대조하지 않은 것

- Claude의 독립 원문·유도 계산·부정 범위·허용 맥락 대조. 현재 reviewer·checkerRun·checkedAt은 비어 있다.
- 실험실의 실제 300쌍 판정 함수, 역순 접촉·모름 코드·제3 재료 차단, 잘못된 메틸 H 자리 차단. 이 문서는 자료 행이며 구현을 추가하지 않았다.
- 종 인식기의 공명 동등성·원자 매핑·revision, 동등 O 클릭의 UI, 실험실의 상·재고·선반·전체 실행 취소. 엔진 그래프 끝 상태 검사와 구별한다.
- A03 O1 가지의 전자 이동·중간 키프레임, 모든 장면의 좌표·겹침·수화 배향·판·전자 점·전하 표시·접근 순서·모든 순간의 장부. 엔진 끝 상태가 맞아도 이 검사는 남는다.
- 스크린샷·실제 속도 flicker·Firefox/Chromium E2E·전체 테스트·빌드. 기존 파일과 산출물을 바꾸지 않는 이번 문서 작업에서 실행하지 않았다.
- 용해·침전 속도, 농도·활동도 계수·포화·수율·평형 분포·실제 미시 반응 경로. 앱 범위 밖이며 테스트 미실행을 숫자로 메우지 않는다.

### 8.4 대조 기록 형식과 우선순위

단계 1 §8.2의 RowCrossCheck 형식을 사용하되 실제 `basisCommit`, 작성일, 행 해시, 의존 자료 버전과 실제 checkerModel·checkerRun·checkedAt을 기록한다. 이번 기준은 `d8922d8...`와 위 작업 트리 해시이며 단계 1의 예시 `56ea710`을 그대로 복사하지 않는다. 원문 읽음·계산 재현·화학 범위·맥락·원자 매핑·표현·인수 사례를 각각 남긴다. `source-matched`와 `approved`를 구별하며 행·템플릿·의존 값 변경 시 관련 대조는 무효다.

Claude가 특히 볼 행:

1. **A03 두 O 가지·A03→A04:** 화학적 동등성과 선택한 AtomId 보존을 함께 지키는지, 두 arrow를 공명 왕복 반응으로 보이게 하지 않는지. 현재 OH에 붙은 H를 찾아야 하며 b.H4를 지어내면 안 된다.
2. **V201·C203–C205·C208 / A03·A06:** 물의 활동도 관례, K의 방향, 로그, 구간 양 끝, “남는 비율은 계산하지 않아요” 문구.
3. **V202·C206–C209 / P02·T125·T170·T187·T281:** 자유 이온의 침전, 공통 이온 평형, AgCl→AgBr 고체 전환을 혼동하지 않는지. 혼합 고체 onto는 금지다.
4. **N203·N205·N206·N209 및 N213·N218·N219:** 강산 짝염기의 산·염기 인증과 질산염 순침전 부정이 산화환원·가수분해 전반 부정으로 확대되지 않았는지.
5. **D02–D04·§6.1:** 단위 사건과 포화 계산의 구별, 남은10개 이온·빈 결정·선택 물의 보존, Na⁺ 관찰자 허용의 좁은 범위.
6. **T167·T185·T221·T230·T239·T248:** 은/아연/구리와 아세트산 이온의 배위·표면 문제를 가용성 일반표로 일괄 부정하지 않았는지.
7. **§9의 통합 경계:** 단계 2 재료를 더한 뒤 기존 사건이 차단되는 것을 자료 누락·반응하지 않음으로 오인하지 않는지.

출처 화면의 문구는 단계 1과 같이 **“출처와 대조한 자료이고 전문가가 검토한 것은 아니에요.”**다. 아직 대조 전인 이 문서를 대조 완료 자료처럼 노출하지 않는다.

## 9. 단계 1에 대한 의견

단계 1 파일은 고치지 않았다. 이번 확인에서 기존 여덟 사건의 화학식·채택 수치와 새 일곱 사건 사이의 직접 충돌은 발견하지 못했다. 다만 통합 때 아래를 별도 변경 행으로 대조해야 한다.

| 항목 | 단계 1의 현재 내용 | 단계 2와 맞물릴 때의 의견 |
|---|---|---|
| 기존 A01·A02·A05의 맥락 | CH₃COOH·CH₃COO⁻·K⁺·Br⁻·NO₃⁻가 허용 목록에 없음 | 이 문서의 새 A03·A04·A06 목록을 기존 A 행에 자동 복사하지 않는다. A06 뒤 CH₃COO⁻가 남은 채 NH₄⁺를 A05에 쓰려면 기존 A05의 맥락 변경 대조가 필요하다. 엔진이 같은 H를 옮길 수 있다는 것과 별개다. 공개 전에는 현재 계약대로 CONTEXT_UNREVIEWED다. |
| 기존 P01의 맥락 | Na⁺는 있으나 K⁺·NO₃⁻가 없고 Br⁻ 경쟁에 관한 전용 문구는 없음 | 새 P02의 Na⁺·K⁺·NO₃⁻ 허용은 대칭 확대 초안일 뿐 P01 승인 변경이 아니다. Ag⁺+Cl⁻+Br⁻에서 P02는 COMPETING_PATHWAYS, 기존 P01은 현재 목록상 CONTEXT_UNREVIEWED가 된다. 둘 다 차단되지만 통합 UI에서는 경쟁 사유로 맞출지 변경 대조가 필요하다. |
| 기존 R01–R03의 맥락 | Cl⁻·NH₃ 등을 엄격히 제외하며 K⁺·Br⁻·NO₃⁻도 허용 목록에 없음 | 새 관찰자 이온 이름만으로 R 행을 넓히지 않는다. 금속 질산염 재료 세트를 만들 경우 R 맥락 대조가 선행되어야 한다. |
| D01 및 새 D 계열 | 생성 이온·남은 같은 고체는 허용하지만 해당 이온+고체의 직접 접촉 표는 평형 모름 | 이는 물 손잡이로 단위 용해를 고른 경우와 고체에 이온을 직접 놓은 요청의 구별이다. 단계 1과 같은 계약을 유지한다. 반복 용해를 포화 계산으로 소개하지 않는지 통합 시 재확인한다. |
| “단일 공유 결합만” 문구 | 단계 1 §7 공통 fixture의 분자에는 단일 결합만 있음 | 단계 1 범위에서는 맞다. 이를 모든 단계의 검사 상수로 일반화하면 아세트산·아세트산 이온·NO₃⁻의 이중 결합을 잘못 거부한다. 새 검사는 기대 결합 차수까지 행별로 적어야 한다. |
| 공명 동등성 | 단계 1 팔레트에는 카복실산 이온·질산 이온이 없어 실행 사례가 없음 | 단계 2에서 본격적인 종 동등성·O 선택 검사가 필요하다. 기본 O2 transfer의 성공만으로 O1 선택과 공명 동등성 구현을 완료로 세지 않는다. |
| 300행의 상태 | 단계 1은 3판 변경 행 대조 전, 단계 2는 미리 쓴 초안 | 120+180의 완전성은 새 180행뿐 아니라 기존 행의 미완료 대조까지 승인했다는 뜻이 아니다. 각각의 검토 기록과 버전을 유지한다. |

