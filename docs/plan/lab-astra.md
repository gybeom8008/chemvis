> 이 문서는 Astra 모델이 [의뢰서](lab-brief.md)를 읽고 쓴 것을 그대로 옮긴 것이다. 검토와 채택 여부는 [lab-review.md](lab-review.md)에 있다.

# chemvis 실험실 기획·설계서

작성일: 2026-11-11 · 대상: PC 우선 정적 웹앱 · 상태: 구현을 위한 제안 사양

## 0. 이 문서가 내리는 결정

**실험실은 모든 혼합물의 미래를 계산하는 장치가 아니라, 검토된 조건에서 가능한 반응 한 묶음을 사용자가 직접 일으켜 보는 입자 모형으로 만든다.** 반응식의 원자·전자·전하는 정확히 보존하되, 화면의 입자 수를 몰수·농도·수율·시간으로 해석하지 않는다. 이 제한은 도움말 깊숙이 숨기지 않고 무대에 짧게 표시한다.

1차에서 다루는 것은 25 °C의 물속에서 일어나는 **여섯 가지 양성자 이동, 두 가지 은염 침전, 네 가지 가용성 염의 용해, 세 가지 금속 치환**이다. 범용 결합 예측, 자동 평형 계산, 임의 SMILES의 반응 예측은 하지 않는다. 생성물을 다시 끌어 다음 반응에 쓰는 것은 지원한다.

| 결정 | 선택한 안 | 버린 안과 이유 |
|---|---|---|
| 화학 지식 | 출처·조건·생성물·표현 검토를 갖춘 자료 행만 실행 | 옥텟과 전기음성도로 반응 생성: 가능 구조와 실제 반응을 혼동한다 |
| 시간 | 조작 한 번당 화학량론적으로 완결된 한 사건 | 브라운 운동 중 자동 충돌·연쇄 반응: 속도상수와 경쟁 경로를 모른다 |
| 수량 | 대표 입자의 정수 개수, 식의 계수 확인에 사용 | 입자 한 개를 임의의 mmol로 환산: 부피·평형·활동도까지 필요해진다 |
| 농도 | 제한된 참고 활동도 구간으로 적용 조건만 검사 | 농도 없이 모든 Ag⁺·Cl⁻ 접촉을 침전 처리: 극히 묽으면 틀린다 |
| 결과 | 반응함 / 반응하지 않음 / 모름, 실행 준비 상태는 별도 | 규칙 검색 실패를 ‘반응 없음’으로 처리: 지식의 빈틈을 사실로 둔갑시킨다 |
| 복수 후보 | 동등한 위치는 정규화, 다른 접촉은 사용자 선택, 화학적 경쟁은 모름 | 산·염기 > 침전 > 산화·환원 같은 보편 순서: 근거 없는 반응 속도 순서다 |
| 양 부족 | 전체 사건을 보류하고 필요한 개수 표시 | Zn 하나가 Ag⁺ 하나에 전자를 준 뒤 Zn⁺를 남김: 지원하지 않는 종을 안정 생성물처럼 만든다 |
| 약산·평형 | 약산과 강염기의 검토된 사건은 허용. 약산의 물속 해리 비율은 계산하지 않음 | 입자 10개 중 무작위 1개 반응: 임의 확률을 평형 상수처럼 가르친다 |

이 문서에서 **반드시**는 출시 차단 조건이다. 수치가 붙은 UI 거리·시간은 화학 상수가 아니라 조작을 위한 초기 설계값이다. ‘반응함’은 아래 조건에서 해당 사건을 보여 줄 수 있다는 뜻이며, 혼합물 전체의 최종 상태를 보증하지 않는다.

### 0.1 확인한 기존 자료와 구현 기준

저장소 기준 커밋은 [`c814963cc4c69c29ea4f9007f1f4eb7e34aed143`](https://github.com/gybeom8008/chemvis/tree/c814963cc4c69c29ea4f9007f1f4eb7e34aed143)이다. 공개 앱과 비교 화면의 HTML, 비교 화면 소스, 아래 기획·안내서와 엔진 소스를 읽었다. 이 문서는 앱을 구현하거나 브라우저 동작 시험을 수행한 결과 보고서가 아니다.

| 자료 | 설계에 반영한 사실 |
|---|---|
| [앱](https://gybeom8008.github.io/chemvis/), [비교 화면](https://gybeom8008.github.io/chemvis/concept/) | 기존 장면 재생 구조에 실험실의 조작과 판정 계층을 추가한다 |
| [표현 기획](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/docs/plan/depiction.md) | 전자쌍 주머니와 전자 하나의 이동을 사용한다. 실험실은 `pairs` 고정으로 시작한다 |
| [전체 기획](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/docs/plan/README.md), [기존 실험실 초안](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/docs/plan/lab.md) | 배우기·실험실·AI 장면의 방향은 유지하되, 원자 결합 일반화와 일정은 채택하지 않는다 |
| [대본 안내서](https://gybeom8008.github.io/chemvis/ai-guide.md) | `transfer`, `arrow`, `hop`, `precipitate`, `dissolve`, `solvate`, `approach` 재사용 |
| [컴파일러](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/src/engine/compile.ts), [World](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/src/engine/world.ts), [분자 목록](https://github.com/gybeom8008/chemvis/blob/c814963cc4c69c29ea4f9007f1f4eb7e34aed143/src/chem/library.ts) | 현재 컴파일은 새 장면에서 시작한다. 침전은 화학식으로 앞쪽 입자를 고른다. 이름·분자식만으로 생성물 정체성을 판정하면 안 된다 |

## 1. 사용자에게 약속하는 범위

### 1.1 무대가 뜻하는 것

무대에는 선택한 반응에 관계되는 **대표 입자**를 펼쳐 놓는다. 실제 비커 안의 모든 분자나 이온을 표시하는 것은 아니다. 주변의 옅은 물은 용매 저장고의 그림이고, 진하게 넣은 물은 양성자 이동 등에 참여할 수 있는 추적 가능한 분자다.

- 분자 한 개는 구조와 원자 수를 그대로 가진다. 금속의 원자 한 개는 **금속 표면의 대표 원자**이며, 물속의 독립된 중성 Zn 기체 원자가 아니다.
- 이온 결정의 한 쌍은 고체의 **화학식 단위**다. AgCl 분자 한 개가 생긴다는 뜻으로 그리지 않는다.
- 입자 1개와 2개는 반응식의 1:2를 보여 준다. ‘이온 1개 = 1 mM’, ‘물 1개 = 물 1 mL’라는 환산은 없다.
- 순이온 반응을 다루므로 관찰자 이온을 생략할 수 있다. 무대의 초기 순전하가 0일 필요는 없지만, **추가·제거를 제외한 사건 전후의 총전하는 같아야 한다.** 생략된 반대 이온이 실제로 없다는 뜻이 아니다.
- 드래그는 실험자가 반응 장소를 선택하는 조작이다. 드래그 속도는 충돌 에너지, 원자 간 화면 거리는 실제 nm, 재생 3초는 실제 반응 시간으로 쓰지 않는다.
- 배경 물과 보이지 않는 공기가 임의의 반응물을 공급하지 않는다. 양성자 이동에 필요한 추적 대상 물은 명시적으로 확보한다. 용해의 수화 물은 화학량론적 반응물이 아닌 용매 표현이다.

무대의 고정 안내: **“대표 입자로 반응 한 번을 살펴봐요. 입자 수는 농도나 반응 비율이 아니에요.”** 자세히 보기에는 “전체 용액의 평형·시간 변화는 계산하지 않아요”를 적는다.

### 1.2 1차 포함·제외

| 영역 | 1차 결정 | 경계의 이유 / 경계 밖 표시 |
|---|---|---|
| 양성자 이동 | H₃O⁺→OH⁻·NH₃·CH₃COO⁻, CH₃COOH→OH⁻·NH₃, NH₄⁺→OH⁻ | 이동할 H와 받을 원자를 명시할 수 있다. 이외 조합은 별도 검토 행이 없으면 모름 |
| 침전 | AgCl(s), AgBr(s) | 1:1 전하 쌍이며 현재 결정 표현에 맞는다. 농도 조건을 검사한다 |
| 용해 | NaCl, KCl, NaBr, KBr의 물속 용해 | 용매가 충분한 묽은 예시 조건만. 난용성 고체의 일부 용해·포화는 모름 |
| 금속 치환 | Zn/Cu²⁺, Zn/Ag⁺, Cu/Ag⁺와 그 역방향의 명시적 부정 | 금속 표면과 금속 이온 사이의 검토된 순반응. 부식·수소 발생·표면 속도는 제외 |
| 약산 | 중화 사건의 반응물로 아세트산 사용 | 물에 넣었을 때 몇 % 해리하는지는 모름. ‘약산은 반응하지 않는다’고 하지 않는다 |
| 단독 원자 | 자유 원자는 넣지 않음. 원소 탭은 실제 지원 형태를 선택 | H·, O 원자, Na 원자를 안정한 일상 재료처럼 다루지 않는다 |
| 기체·수면 | 1차 판정 미지원 | 기체 압력·에너지·계면 이동까지 함께 필요하다. 가져온 장면은 모름 |
| 유기 반응·연소 | 미지원 | 작용기만 같아도 선택성·촉매·용매·속도가 다르다 |
| 착물·금속 수산화물 | 미지원 | Ag⁺+NH₃, Cu²⁺+OH⁻ 등을 ‘아무 일 없음’으로 숨기지 않고 모름 |
| 임의 SMILES | 구조 보기만 허용. 반응 미지원 배지 | 엔진이 그릴 수 있다는 사실은 화학 판정의 근거가 아니다 |
| 방사성·핵반응·전기분해·플라스마 | 미지원 | 별도의 물리 모형이 필요하다 |

범위 밖 재료는 검색 결과에서 지우지 않고 “구조만 볼 수 있어요”로 구분한다. 읽을 수 없는 구조는 “이 구조는 표시할 수 없어요”라고 입력 단계에서 막는다. 이것은 화학 판정의 ‘반응하지 않음’과 다르다.

### 1.3 확정된 1차 반응 목록

물속 종은 `(aq)`, 용매 물은 `(l)`, 고체는 `(s)`이다. 아래에서 수용액 표시는 가독성을 위해 일부 생략한다.

| ID | 허용하는 정방향 사건 | 단위 사건의 필요량 |
|---|---|---|
| A01 | H₃O⁺ + OH⁻ → 2 H₂O | 각 1 |
| A02 | H₃O⁺ + NH₃ → H₂O + NH₄⁺ | 각 1 |
| A03 | H₃O⁺ + CH₃COO⁻ → H₂O + CH₃COOH | 각 1 |
| A04 | CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O | 각 1 |
| A05 | NH₄⁺ + OH⁻ → NH₃ + H₂O | 각 1 |
| A06 | CH₃COOH + NH₃ → CH₃COO⁻ + NH₄⁺ | 각 1 |
| P01 | Ag⁺ + Cl⁻ → AgCl(s) | 각 1 |
| P02 | Ag⁺ + Br⁻ → AgBr(s) | 각 1 |
| D01–D04 | NaCl / KCl / NaBr / KBr(s) → 해당 양이온 + 음이온 | 화학식 단위 1, 물은 용매 |
| R01 | Zn(s) + Cu²⁺ → Zn²⁺ + Cu(s) | 각 1 |
| R02 | Zn(s) + 2 Ag⁺ → Zn²⁺ + 2 Ag(s) | Zn 1, Ag⁺ 2 |
| R03 | Cu(s) + 2 Ag⁺ → Cu²⁺ + 2 Ag(s) | Cu 1, Ag⁺ 2 |

양성자 이동 여섯 행은 되돌리는 일반 규칙을 만들지 않는다. 생성물끼리 다시 만났을 때의 결론은 별도 판정 행에서 얻는다. 예컨대 NH₄⁺+CH₃COO⁻를 만나게 하면 평형 조성 계산이 필요한 ‘모름’이다. A03으로 생긴 아세트산은 A04에, A02로 생긴 NH₄⁺는 A05에 다시 사용할 수 있다. 특히 A03·A05·A06의 재생은 반응 사건 하나이며 완전 전환을 뜻하지 않는다.

## 2. 환경: 적게 두되, 숨은 가정은 없애기

### 2.1 선택한 환경 모형

환경은 연속적인 실제 비커 상태가 아니라 **각 사건을 해석하는 참고 조건**이다. 수치 입력창을 만들어 정확한 계산처럼 보이게 하지 않는다. 새 실험의 기본값은 `water / 25 °C / ordinary / no excitation`이다.

| 변수 | 값 | 1차 UI | 판정에 미치는 영향 |
|---|---|---|---|
| `medium` | `water`, `gas`, `unspecified` | 물 고정, 다른 값은 장면 가져오기에서만 수신 | `water`가 아니면 모든 1차 규칙이 `ENV_UNSUPPORTED` |
| `temperatureC` | `25` 또는 외부 입력 수치·미지정 | 25 °C 고정 표시 | 25 외에는 표를 외삽하지 않고 모름 |
| `activityPreset` | `ordinary`, `veryDilute`, `unspecified` | “묽은 참고 조건”, “매우 묽은 참고 조건”, “조건 미지정” | ordinary에서 A/P/D/R 검토 행 사용. veryDilute는 등록된 비침전 판정만. 미지정은 농도 의존 판정을 모름으로 처리 |
| `excitation` | `none`, `heated`, `irradiated`, `unknown` | 외부 가열·광조사 없음으로 고정 | `none` 외에는 1차에서 모름. `heat` 애니메이션을 온도계로 간주하지 않음 |

활동도는 농도에 용액의 비이상성을 반영한 무차원 값이다. 사용자에게는 “묽기”로 표시하되, 내부 계산은 `c° = 1 mol/L`를 기준으로 한 활동도 구간을 사용한다.

| 참고 조건 | 각 판정에 쓰는 자유 용질 종의 활동도 구간 | 의미와 제한 |
|---|---|---|
| `ordinary` | `[10⁻³, 10⁻²]` | 이상적인 묽은 용액이면 대략 1–10 mM에 해당. 반응 직전의 자유 이온/분자에 적용하는 참고값 |
| `veryDilute` | `[10⁻⁸, 10⁻⁷]` | 등록된 염의 비침전 확인용. 물의 자동 이온화와 완충이 중요해지는 산·염기 계산은 금지 |
| `unspecified` | 없음 | 수치·조건 근거를 만들지 않음 |

**각 종이 동시에 이 구간에 놓인 실제 용액을 화면의 입자 개수로 구성했다는 뜻은 아니다.** 특히 H₃O⁺와 OH⁻는 이 정도로 공존하는 평형 용액을 만들 수 없다. A01은 혼합 직후 접촉해 중화하는 사건을 나타낸다. 반응 결과를 다음 조작에 쓰더라도 이전 반응에서 농도를 계산해 넘기지 않는다. 조건 칩의 도움말은 “이번 접촉을 이 참고 조건에서 살펴봐요”라고 명시한다.

이 결정의 대가는 실제 연속 희석 실험·적정·수율 예측이 불가능하다는 것이다. 대신 물질 정체성과 화학량론은 이어지고, 농도 정보를 꾸며내는 일을 피한다. 농도와 수량을 하나의 실제 용액 모형으로 결합하는 것은 3차의 별도 설계다.

### 2.2 참고 조건 변경

조건 선택은 물을 붓거나 에너지를 가하는 화학 사건으로 애니메이션하지 않는다. “같은 입자 모형을 다른 참고 조건에서 살펴봐요”를 표시하고 현재 상태를 새 판정 시작점으로 삼는다. 기존 결과 카드는 당시 조건을 보존하며, 새 후보는 전부 무효화한다. 고체가 갑자기 사라지거나 이전 반응이 자동으로 역전되어서는 안 된다. 조건 변경도 실행 취소 한 항목이다.

### 2.3 뺀 변수

| 제외 | 이유 / 대신 하는 일 |
|---|---|
| pH 조절 슬라이더 | 산·염기 양을 바꾸지 않고 pH를 지정하면 외부 저장고가 생긴다. H₃O⁺·OH⁻를 명시적으로 조작하며 pH 수치는 출력하지 않음 |
| 실제 부피·몰수·몰농도 | 대표 입자 모형과 맞지 않는다. 1차는 참고 구간만 사용 |
| 압력·습도 | 기체·수면 반응을 지원하지 않음 |
| 용존 O₂·CO₂ | 공기와의 교환을 모형화하지 않음. 금속 반응 조건에 “공기와의 반응 제외”를 명시 |
| 파장·광량·점화·촉매 | 해당 경로 미지원. 광조사된 AgCl은 모름 |
| 이온 세기·활동도 계수 계산 | 큰 혼합물 모델을 만들지 않음. 활동도 자체의 참고 구간으로 제한하고 외부 농도 입력을 그대로 활동도로 바꾸지 않음 |
| 표면적·피막·교반·속도상수 | 금속 치환 사건의 방향만 다룬다. 반응 시간·진행 속도는 출력하지 않음. 피막 재료는 미지원 |
| 전기음성도 기반 결합 판정 | 전자 편향의 그림에는 쓸 수 있지만 반응·결합 종류 결정에는 충분하지 않음 |

이 변수들로 모든 화학을 설명할 수 있어서 충분한 것이 아니다. **이 변수들로 조건을 한정할 수 있는 사례만 등록하기 때문에** 1차 판정에 충분하다.

## 3. 화면과 끌기 동작

### 3.1 PC 배치

| 영역 | 내용 |
|---|---|
| 위쪽 | 배우기 / 실험실 / AI 장면 탭, 현재 참고 조건 칩, 모형 설명 |
| 가운데 | 2D 무대. 공유 결합은 전자쌍 주머니, 이온 결정은 공유 결합 없이 격자로 표현 |
| 오른쪽 280–320 px | 재료 검색, 분자 / 이온 / 원소·고체 구분, 넣기, 선택 재료 상세 |
| 아래 설명 줄 | 현재 접촉 후보, 필요한 개수, 판정 이유, 재생 자막 |
| 아래 조작 줄 | 실행 취소 / 다시 실행 / 다시 보기 / 비우기. 후보 선택 중에는 해당 선택 카드 |
| 대기 선반 | 현재 검토에서 제외할 재료의 보관 영역. 옮길 때 ‘무대의 반응 검토에서 제외’ 표시 |

종류별 6개, 활성 무대 총 24개 대표 단위까지 허용한다. 결정은 화학식 단위 수를 세며, 분자 원자 수와는 다르다. 용매 배경은 이 한도에서 제외한다. 한도 초과는 UI 제한이며 화학 결과가 아니다.

### 3.2 상태 기계

`idle → dragging → preview → drop → (choose | needs-material | preflight | explained) → playing → idle`

`Esc`는 드래그·선택·양 부족 대기를 취소한다. `playing` 중에는 화학 조작을 잠근다. 포인터 캡처 손실·창 포커스 상실은 드롭으로 처리하지 않고 취소한다.

1. **집기:** 분자의 어떤 원자를 집든 분자 전체가 이동한다. 결정은 결정 집합 전체, 금속은 대표 표면 단위 전체가 이동한다. 원자 ID를 바꾸지 않는다.
2. **후보 영역:** 드래그 입자와 상대 입자의 외곽 간 거리가 48 CSS px 이하이면 접촉 후보를 계산한다. 확대율을 보정한 화면 거리이며 물리 거리로 쓰지 않는다.
3. **반응 위치 계산:** §3.3의 검토된 반응 자리만 후보가 된다. 가까운 임의 원자끼리 반응시키지 않는다.
4. **미리보기:** 같은 대상이 120 ms 유지되면 표시한다. 이미 잡힌 대상은 64 px를 벗어나거나 다른 대상이 12 px 이상 더 가까워진 상태가 120 ms 지속될 때 바꾼다.
5. **놓기:** 후보·환경·재고·무대 버전을 다시 검증한다. 단 하나의 준비된 사건이면 자동으로 사전 검사를 하고 재생한다. 후보가 여러 개면 선택 카드, 양 부족이면 필요한 입자 안내, 부정/모름이면 설명을 낸다.
6. **반응 없는 이동:** 유효 접촉 영역 밖에 놓으면 배치만 바뀐다. 이동 자체는 실행 취소 한 항목이다.

키보드 대안: 재료 선택 → ‘다가갈 대상’ 선택 → 후보 선택 → Enter. 방향키로 배치 이동, Tab으로 반응 자리 순회. 색만으로 결과를 구분하지 않고 아이콘·문구를 함께 쓴다.

### 3.3 어느 원자끼리 만나는가

반응 가능 여부와 화면에서의 자리를 분리한다. 규칙이 **어느 자리들이 화학적으로 허용되는가**를 정하고, 거리는 그 자리 중 사용자가 가리킨 것을 고르는 데만 쓴다.

| 규칙 | 자리 정의 | 예 |
|---|---|---|
| 양성자 이동 | 산의 검토된 H–X 결합, 염기의 검토된 비공유 전자쌍 자리 | H₃O⁺의 H1/H2/H3 → NH₃의 N. 아세트산은 OH의 H만, 메틸 H는 제외 |
| 침전 | 두 단원자 이온의 중심. ‘공유 결합 자리’가 아님 | Ag⁺ 중심 ↔ Cl⁻ 중심 |
| 용해 | 결정의 노출된 양이온·음이온 한 쌍, 물의 O/H 방향 | 선택한 모서리 화학식 단위. 물 분자는 용매를 가리키는 손잡이 |
| 금속 치환 | 대표 금속 표면 원자 ↔ 환원될 금속 이온 | Zn ↔ Cu²⁺. Zn+2Ag⁺는 Ag⁺ 두 개를 한 사건으로 묶음 |

자리 후보마다 현재 좌표로 `d = 반응 자리의 외곽 간 거리`를 계산한다. 순서는 `사용자가 고정한 자리 → d 오름차순 → 안정 atom ID`다. 회전·접근 각도는 가독성을 위한 배치이며 반응성 점수로 사용하지 않는다.

H₃O⁺의 세 H처럼 검토된 대칭 동등 자리는 같은 사건으로 합치고 가장 가까운 H를 선택한다. 아세트산/아세트산 이온의 O는 결합·전하·공명 정보를 포함한 자리 매핑을 사용한다. 지원하지 않는 이성질체를 분자식으로 합치지 않는다. 등가성 검토가 없는 다중 자리 분자는 모름이다.

### 3.4 끄는 동안 보이는 것

| 상태 | 미리보기 | 놓은 뒤 |
|---|---|---|
| 실행 준비됨 | 반응 자리 고리, 바뀔 전자쌍 강조, ‘놓으면 H가 이동해요’ 등의 짧은 문장 | 사전 검사 성공 후 재생 |
| 수량 부족 | 필요한 전체 묶음의 윤곽, 빈 자리에 `Ag⁺ 1개 더 필요` | 실제 전자·전하는 그대로, 부족 안내 유지 |
| 검토된 부정 | 작은 정지 표시와 구체적인 이유 | 입자 둘을 결합시키지 않고 가까운 위치에 남김 |
| 모름 | 물음표와 이유. 생성물 윤곽은 표시하지 않음 | 설명 카드, 관련 수업/질문 복사 |
| 다른 접촉 후보 여러 개 | 번호가 붙은 자리/대상 고리 | 선택 카드. 선택 전에는 아무 화학 변화도 없음 |

미리보기에서는 전자를 실제로 옮기거나 전하를 바꾸지 않는다. 생성물은 필요하면 카드 속 작은 도식으로만 보여 주며 무대에 실제 생성물처럼 겹쳐 놓지 않는다. 입자를 빠르게 흔들거나 여러 번 겹쳐도 재생은 한 번만 예약된다.

### 3.5 후보가 여러 개일 때

- **같은 생성물, 동등한 원자 자리:** 한 후보로 묶는다.
- **주변에 서로 다른 대상:** 사용자에게 ‘어느 입자와 접촉할지’를 고르게 한다. 카드에는 반응물·결과·사용할 입자 번호를 표시한다.
- **동일한 반응물로 서로 다른 생성물 경로가 경쟁:** 선택 버튼으로 화학적 불확실성을 없애지 않는다. `COMPETING_PATHWAYS`로 모름이다.
- **제3의 활성 재료가 결과를 바꿀 수 있음:** §4의 맥락 검사를 먼저 적용한다. Ag⁺에 Cl⁻와 Br⁻가 함께 있거나 NH₃가 있으면 1차는 모름이다. 접촉 대상을 고른다고 경쟁·착물 형성이 사라지지 않는다.
- **독립적인 재료 묶음:** 선택된 묶음만 실행한다. 다른 묶음은 명시적 관찰자 허용 목록에 있어야 한다. 허용 여부도 모르면 모름이다.

사용자는 경쟁하는 재료를 대기 선반으로 옮겨 조건을 단순화할 수 있다. 앱이 판정을 성공시키려고 몰래 제거하지 않는다.

### 3.6 Zn 하나와 Ag⁺ 하나

R02는 화학적으로 지원하는 반응이므로 판정은 `reacts`, 준비 상태는 `needs-material`이다. ‘반응하지 않음’도 ‘모름’도 아니다.

1. Zn 1개, Ag⁺ 2개가 필요한 묶음을 미리 보여 준다.
2. 이미 같은 접촉 중심에서 120 CSS px 안에 사용 가능한 두 번째 Ag⁺가 있으면 그 입자도 고리로 표시하고 함께 선택한다. 거리 동률은 ID 순이다.
3. 멀리 있는 Ag⁺는 자동으로 끌어오지 않는다. “Ag⁺ 하나를 이 근처로 가져오세요”와 실제 무대의 해당 입자 표시를 제공한다.
4. Ag⁺가 없으면 재료 서랍의 해당 항목을 강조한다. 자동 생성하거나 숨은 전자를 빌리지 않는다.
5. 충족된 뒤 전체 사건을 다시 검증한다. 전자 두 개 이동은 한 트랜잭션이며 중간 Zn⁺를 확정 상태로 저장하지 않는다.

실제 금속과 은 이온의 반응이 이런 작은 정수 묶음 때문에 멈춘다는 뜻은 아니다. **이 화면에서 보존되는 완결 반응식을 그리기 위한 수량 제한**이다. 이 설명을 부족 안내의 자세히 보기에 포함한다.

### 3.7 반응 이후와 실행 취소

- 성공하면 원자 ID를 보존한 최종 그래프, 전자쌍·홑전자 수, 분자 구성, 상, 결정 소속을 새 무대 상태로 확정한다. 자막이나 분자식 문자열을 다시 해석해 생성물을 만들지 않는다.
- H₃O⁺의 H가 NH₃로 가면 그 H의 ID도 새 NH₄⁺에 속한다. 이전 분자의 소유자 이름은 추적용 별칭일 뿐 현재 분자 정체성이 아니다.
- 생성물은 바로 다시 집을 수 있다. 새 입자 판정은 `speciesId + 구조 + 전하 + 상`으로 한다.
- 자동 다음 반응은 없다. 물 분자끼리 접촉했다고 H₃O⁺·OH⁻를 자동 생성하지 않는다.
- ‘다시 보기’는 과거 타임라인만 재생하며 현재 화학 재고를 소비하지 않는다. 재생 중 조작은 잠근다.
- 실행 취소는 **드래그 시작 직전** 상태로 되돌린다. 반응과 자동 접근·배치가 한 항목이다. 추가, 삭제, 선반 이동, 조건 변경도 각각 한 항목이다.
- 재생 도중 취소도 같은 시작 스냅샷으로 복원한다. 중간 전하 상태를 저장하지 않는다. ‘애니메이션 건너뛰기’는 검증된 끝 상태를 확정한다.
- 100항목까지 메모리에 보관한다. 다시 실행은 저장된 끝 상태를 복원하며 새 난수를 쓰지 않는다. 새 조작을 하면 다시 실행 가지를 버린다.
- 전체 비우기도 한 번에 되돌릴 수 있다. 저장 형식에는 데이터·엔진 버전을 함께 기록한다. 버전이 맞지 않으면 읽기 전용으로 열고 무리하게 다시 계산하지 않는다.

## 4. 반응 판정: 두 입자만 보는 함수로는 부족하다

표면상 입력은 두 입자와 환경이지만, **수량과 제3의 물질을 확인하려면 무대의 읽기 전용 요약도 필요하다.** 다음 두 층으로 나눈다.

- `classifyContact(a, b, environment)`: 조건부 반응 후보, 명시적 부정, 지식 부족을 찾는다. 무대를 수정하지 않는다.
- `planEvent(candidate, sceneContext)`: 추가 반응물 확보, 경쟁·방해 물질 검사, 원자 매핑, 보존 검사, 표현 가능성을 확인한다.

사용자에게 보이는 최종 결과는 두 번째 층까지 통과한 뒤 정한다. ‘두 입자만 보면 아는데 현재 혼합 상황은 모른다’는 결과도 모름이다.

### 4.1 순서가 고정된 판정 절차

| 순서 | 검사 | 실패 또는 분기 |
|---|---|---|
| 1 | ID 존재, 서로 다른 대상, 현재 버전, 유효 구조·상·전하 확인 | 읽을 수 없는 구조·불일치 ID는 조작 오류. 이 단계에서는 정체성을 표준화하고 미지원 여부를 아직 확정하지 않음 |
| 2 | 환경이 검토된 구간인지 확인 | `ENV_UNSUPPORTED` 또는 `CONDITION_MISSING` |
| 3 | 알려진 종분포 경계부터 확인한 뒤 일반 미지원 재료 검사 | 물속 중성 HCl은 `SPECIATION_UNSUPPORTED`. 그 밖의 미검토 구조는 `SPECIES_UNREVIEWED`; 자동으로 가짜 분자를 반응시키지 않음 |
| 4 | `speciesId + phase`의 정규화한 쌍으로 자료 행 검색 | 행이 없으면 `NO_REVIEWED_RULE` |
| 5 | 양성자 자리, 고체 종류, 금속 산화 상태 등 세부 조건 검사 | 불명확하면 `SITE_UNREVIEWED` |
| 6 | 수치 표와 행의 조건으로 방향/침전 여부 계산 | 구간이 경계에 걸리면 `CONDITION_BORDERLINE` |
| 7 | 활성 무대의 제3 재료·지원하지 않는 배경 효과 검사 | `CONTEXT_UNREVIEWED` 또는 `COMPETING_PATHWAYS` |
| 8 | 서로 일치하지 않는 규칙의 중복 확인 | `RULE_CONFLICT`; 임의 우선순위로 덮지 않음 |
| 9 | 화학적 결론 구성 | 검토된 양성 / 검토된 부정 / 모름 |
| 10 | 양성인 경우 정수 계수만큼 대상 예약 | 부족하면 양성 유지 + `needs-material`; 아직 상태 변경 없음 |
| 11 | 예상 생성물과 원자 ID 대응, 전자 수·총전하·원소별 수 보존 | 실패하면 `REPRESENTATION_UNAVAILABLE`, 내부 오류 기록 |
| 12 | 엔진으로 임시 컴파일, 끝 상태와 예상 생성물 비교 | 실패하면 재생하지 않고 같은 모름 사유 |
| 13 | 예약한 ID와 무대 버전을 마지막으로 확인하고 실행 | 오래된 결과면 폐기하고 재계산 |

같은 입자를 자기 자신 위에 놓는 행위는 접촉 요청을 만들지 않는다. 이를 ‘반응하지 않음’ 시험에 섞지 않는다.

### 4.2 규칙의 종류

| 종류 | 하는 일 | 하지 않는 일 |
|---|---|---|
| `proton-transfer` | 등록된 산/짝염기 쌍과 원자 자리로 H 한 개 이동 | H가 있는 모든 분자를 산으로 간주, pKₐ 미등록값 추정 |
| `precipitation` | 등록된 고체의 활동도곱과 Ksp 비교 | 모든 반대 전하 이온을 결합시키기, Ksp=0인 불용성 가정 |
| `dissolution` | 충분한 물에서 검토된 가용성 고체의 한 단위 분리 | 포화·공통 이온·결정 수화물·난용성 고체의 정량 용해 |
| `metal-displacement` | 검토된 두 반쪽 반응의 전자 수와 방향 조합 | 반응성 순서만 보고 산·물·피막 반응까지 추론 |
| `negative-certificate` | 지정된 조건에서 특정 순변화가 없다는 검토 기록 | 규칙 미등록 조합을 자동 부정 |
| `unsupported-case` | 알려진 경계와 설명을 구체적으로 제공 | 설명에 들어 있는 미지원 생성물을 실제로 만들기 |

### 4.3 충돌·우선순위

우선순위는 **화학 반응을 일으키는 순서가 아니라 판정을 신뢰할 수 있는지 검사하는 순서**다.

1. 입력 무결성·지원 조건·방해 물질 차단이 모든 양성/부정보다 우선한다.
2. 명시된 `supersedes` 관계가 있는 더 좁은 조건 행만 넓은 행을 대체한다. 단순한 숫자 priority는 두지 않는다.
3. 같은 사건·같은 원자 매핑의 중복은 합친다.
4. 같은 범위의 양성과 부정, 서로 다른 생성물은 충돌이다. 개발 중에는 데이터 검증 실패, 실행 중에는 모름이다.
5. 선택된 한 접촉에 침전과 산·염기 같은 서로 다른 경로가 실제로 경쟁하면 모름이다. 표의 등록 순서로 선택하지 않는다.
6. 자료가 없다는 ‘약한 후보’ 하나 때문에 충분히 검토된 사건을 무조건 막지는 않는다. 단, 그 미지의 효과가 **참여 종·현재 조건·제3 재료와 관련됨**을 확인하면 막는다. 이 관련성도 승인된 맥락 허용 목록으로 제한한다.

### 4.4 무대 맥락 허용 목록

다른 활성 입자를 단순히 무시하지 않는다. 각 사건 행은 `allowedContextSpecies`, `blockedContextPatterns`를 가진다. 목록에 없는 제3의 물질이 활성 무대에 있으면 모름으로 둔다. 선반의 물질은 검사 대상이 아니다.

| 계열 | 기본 허용 맥락 | 추가 차단 |
|---|---|---|
| A | H₂O, 산·염기 6종, Na⁺, K⁺, Cl⁻, Br⁻, NO₃⁻ | 금속·은 이온·고체 등 목록 밖 물질. 여러 산·염기는 선택한 **사건**만 허용하며 전체 생성물 분포는 주장하지 않음 |
| P | H₂O, Na⁺, K⁺, NO₃⁻, 해당 은 이온·할로젠화 이온, 해당 은염 고체 | NH₃·아세트산 이온 등 리간드, OH⁻, 다른 할로젠화 이온, 금속. AgCl/AgBr 혼합 석출 미지원 |
| D | H₂O, Na⁺, K⁺, Cl⁻, Br⁻, NO₃⁻, NaCl/KCl/NaBr/KBr | Ag⁺가 있으면 결합된 용해·침전 문제이므로 모름 |
| R | H₂O, Na⁺, K⁺, NO₃⁻, Zn/Zn²⁺/Cu/Cu²⁺/Ag/Ag⁺ | 산·염기·할로젠화 이온·리간드·피막. 같은 전자 공여체에 대해 Cu²⁺와 Ag⁺처럼 서로 다른 활성 수용체가 함께 있으면 모름 |

여기서 ‘산·염기 6종’은 H₃O⁺, OH⁻, NH₃, NH₄⁺, CH₃COOH, CH₃COO⁻다. P의 같은 고체는 `onto` 후보가 될 수 있지만 1차는 새 한 단위 결정을 생성하고 합치기는 후속으로 미뤄도 된다. 작은 고체를 성장시키는 핵생성 속도는 예측하지 않는다.

R01 뒤에 생긴 Zn²⁺와 Cu(s)를 그대로 두고 Ag⁺ 두 개를 더하면 R03을 실행할 수 있다. Zn²⁺는 이 맥락에서 허용된 관찰자다. R01의 Cu²⁺가 남아 있고 Zn도 남아 있는 상태에서 Ag⁺까지 넣으면 경쟁 검사에 걸린다.

## 5. 수치 표, 출처와 계산 계약

### 5.1 산·염기 표

25 °C 수용액 기준으로 다음 값만 동봉한다. 측정값의 마지막 자리 차이로 화면 결과가 바뀌게 만들지 않는다. 본문 값은 아래 공식 자료에서 읽은 값 또는 그 값으로부터의 계산이다.

| 표 ID | 값 | 용도 | 출처/계산 |
|---|---:|---|---|
| `ka-acetic` | Ka = 1.8×10⁻⁵, pKₐ ≈ 4.7447 | CH₃COOH / CH₃COO⁻ | [OpenStax, 약산 이온화 상수 H](https://openstax.org/books/chemistry-2e/pages/h-ionization-constants-of-weak-acids) |
| `kb-ammonia` | Kb = 1.8×10⁻⁵ | NH₃ | [OpenStax, 약염기 이온화 상수 I](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases) |
| `kw-water` | Kw = 1.0×10⁻¹⁴, pKw = 14.00 | 수용액 산·염기 관계 | [OpenStax §14.2](https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh) |
| `ka-ammonium` | Ka = Kw/Kb ≈ 5.556×10⁻¹⁰, pKₐ ≈ 9.2553 | NH₄⁺ / NH₃ | 앞의 두 자료에서 유도. 독립 측정값인 것처럼 저장하지 않음 |

물의 관례를 섞지 않는다. 용매 물의 활동도를 1로 취급하는 수용액 반응식을 쓴다. 일반 분자 산도표의 물 pKₐ ≈15.7이나 다른 용매의 pKₐ를 이 계산에 끼워 넣지 않는다. H₃O⁺를 임의의 −1.7 행으로 넣어 일괄 뺄셈하는 방식도 쓰지 않는다.

| 사건 | `log10(K)` 계산 | 대략 값 |
|---|---|---:|
| A01 | pKw | 14.0000 |
| A02 | pKₐ(NH₄⁺) | 9.2553 |
| A03 | pKₐ(CH₃COOH) | 4.7447 |
| A04 | pKw − pKₐ(CH₃COOH) | 9.2553 |
| A05 | pKw − pKₐ(NH₄⁺) | 4.7447 |
| A06 | pKₐ(NH₄⁺) − pKₐ(CH₃COOH) | 4.5105 |

`logK ≥ 4`는 등록 가능한 후보를 가리는 보수적 **제품 정책**이다. 자연법칙의 경계나 “99% 반응” 공식이 아니다. 여섯 행은 이 조건뿐 아니라 생성물·상·반응 자리·표현 검토를 통과해야 한다. K가 크더라도 실제 전환율은 초기 조성과 반응식에 따라 다르다. 따라서 A03·A05·A06 카드에는 “이 방향의 반응을 보여 줘요. 실제로 남는 비율은 계산하지 않아요”를 반드시 표시한다.

역방향의 `logK`가 음수라는 이유만으로 ‘절대로 반응하지 않는다’고 답하지 않는다. 초기 생성물이 없거나 농도가 달라지면 작은 반응도 생긴다. 미지원 역방향은 `EQUILIBRIUM_REQUIRED`다.

### 5.2 용해도·침전 표

| 고체 | 25 °C 자료 | 1차 용도 |
|---|---:|---|
| AgCl | Ksp = 1.6×10⁻¹⁰ | P01 방향·비침전 판정 |
| AgBr | Ksp = 5.0×10⁻¹³ | P02 방향·비침전 판정 |
| NaCl, KCl, NaBr, KBr | 가용성: 알칼리 금속 염, 해당 묽은 조건 | D01–D04 및 해당 이온 쌍의 비침전 인증 |

수치는 [OpenStax 용해도곱 표 J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products), 가용성 분류는 [OpenStax §4.2의 용해도 규칙](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions)을 사용한다. 다른 자료의 AgCl 1.8×10⁻¹⁰을 섞어 쓰지 않는다. 자료 변경 시 버전을 올리고 경계 시험을 다시 한다.

1:1 염에서는 `Q = a(cation) × a(anion)`이다. 활동도 구간의 최솟값끼리 곱해 `Qmin`, 최댓값끼리 곱해 `Qmax`를 얻는다. [Q와 Ksp의 비교 원리](https://openstax.org/books/chemistry-2e/pages/15-1-precipitation-and-dissolution)를 다음 정책으로 보수적으로 적용한다.

- `Qmin / Ksp ≥ 100`: 검토된 양성 사건을 허용한다.
- `Qmax / Ksp ≤ 0.1`: **고체가 새로 생기는 순침전이 없음**이라는 명시적 부정을 허용한다.
- 나머지: `CONDITION_BORDERLINE`. 포화점 근처의 성장·용해·속도를 그리지 않는다.
- 100과 0.1은 측정 상수가 아니라 오차와 생략한 효과를 위한 여유다. 배위·공통 이온·경쟁 문제가 있으면 비율에 관계없이 맥락 검사에서 막는다.

| 조건 | Q 구간 | AgCl | AgBr |
|---|---|---|---|
| ordinary | 10⁻⁶–10⁻⁴ | 최소 Q/Ksp = 6250 → 침전 사건 | 최소 Q/Ksp = 2×10⁶ → 침전 사건 |
| veryDilute | 10⁻¹⁶–10⁻¹⁴ | 최대 Q/Ksp = 6.25×10⁻⁵ → 순침전 없음 | 최대 Q/Ksp = 0.02 → 순침전 없음 |

침전됐다고 남은 용액의 자유 이온 농도가 0이 되었다고 말하지 않는다. AgCl(s)+물은 ‘녹지 않음’이 아니라 **일부 용해와 포화 상태를 다루지 못하는 모름**이다. 가용성 염의 용해는 충분한 물·ordinary 조건에서만 허용하며 매번 한 화학식 단위를 분리한다.

### 5.3 금속 표

| 반쪽 환원 반응 | n | E° / V, 표준 수소 전극 기준 |
|---|---:|---:|
| Zn²⁺ + 2e⁻ → Zn(s) | 2 | −0.7618 |
| Cu²⁺ + 2e⁻ → Cu(s) | 2 | +0.3370 |
| Ag⁺ + e⁻ → Ag(s) | 1 | +0.7996 |

출처는 [OpenStax 표준 반쪽 전극 전위 L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials)이다. Cu 값을 다른 자료의 반올림 +0.34와 혼합하지 않는다. 계수로 반쪽 반응을 두 배 하더라도 E°를 두 배 하지 않는다.

`E°cell = E°(전자 수용체의 환원) − E°(전자 공여체의 환원)`이며 전자 수는 최소공배수로 맞춘다. 25 °C에서 참고 구간 확인에는 `E = E°cell − (0.05916/n) log10 Q`를 사용한다. 순수 금속 고체의 활동도는 1이다. 이는 방향의 열역학적 확인이며 속도의 증거는 아니다. [전위·평형 관계](https://openstax.org/books/chemistry-2e/pages/17-4-potential-free-energy-and-equilibrium)

| 사건 | E°cell / V | ordinary에서 Q | E 범위 / V |
|---|---:|---|---|
| R01 | 1.0988 | a(Zn²⁺)/a(Cu²⁺): 0.1–10 | 1.0692–1.1284 |
| R02 | 1.5614 | a(Zn²⁺)/a(Ag⁺)²: 10–10⁴ | 1.4431–1.5318 |
| R03 | 0.4626 | a(Cu²⁺)/a(Ag⁺)²: 10–10⁴ | 0.3443–0.4330 |

지원된 세 쌍만 `Emin ≥ +0.20 V`일 때 양성을 허용한다. 역방향 세 쌍은 해당 Q 범위에서 `Emax ≤ −0.20 V`인 명시적 부정이다. 경계·자료 누락·피막·산·리간드가 있으면 모름이다. 이 여유 기준으로 새 금속을 자동 승인하지 않는다. 실제 표면 반응이 알려져 있는지도 자료 행으로 검토한다.

생성 이온이 아직 화면에 없더라도 0을 대입해 `log(0)`을 계산하지 않는다. 이 계산은 **참고 구간에서 방향이 유지되는지** 검사하는 것이며 현재 재고에서 실제 전위를 계산하는 것이 아니다. 생성물 활동도 0의 초기 극한을 실제 전압으로 출력하지 않는다.

### 5.4 출처와 승인 계약

모든 표 행은 자료명, URL, 표/항목 위치, 온도·용매·단위·표준 상태, 조회일, 원자료 값, 유도식, 검토 상태를 가진다. 이 문서의 수치 조회일은 2026-11-11이다. `draft` 행은 배포 번들에 포함해도 판정에는 사용하지 않는다.

‘출처가 있다’와 ‘이 앱에서 이 반응을 이렇게 그려도 된다’는 다르다. 후자는 반응 자리·화학량론·예외·시각화 검토와 시험 통과까지 필요하다. 본 설계의 출시 검토자는 아직 지정되지 않았으며, 구현자가 자신을 이미 승인한 검토자처럼 기록해서는 안 된다.

전기음성도·원자가 전자 수 표는 구조 표시와 보존 검사의 보조 자료다. 해당 표에 한 줄을 추가했다고 새로운 반응이 허용되어서는 안 된다. 수용액 산도 값을 기체에, 표준 전위를 피막 금속에, 단순 용해도 규칙을 착물 용액에 옮겨 쓰지 않는다.

## 6. 판정을 엔진 대본으로 바꾸기

### 6.1 중간 계획이 먼저다

판정기는 문자열 대본을 바로 만들지 않고 `ReactionPlan`을 만든다. 계획에는 선택한 입자 ID, 역할별 원자 ID, 화학량론, 정확한 생성물, 바뀌는 결합·전자, 상 변화, 필요한 엔진 기능, 출처가 들어간다. 그 뒤 계열별 템플릿이 계획을 대본으로 내린다.

원자 보존 검사는 단순한 분자식 비교보다 강해야 한다. 계획 전후의 **원자 ID 집합 자체가 같아야** 하며, 각 ID의 원소도 같아야 한다. 물질의 위치·분자 소속·전자·전하는 바뀔 수 있다. 배경 물과 수화 애니메이션은 반응 대상 원자 집합과 별도로 관리한다.

검사하는 전자 총수는 `Σ(2×lp + rad) + Σ(2×bondOrder)`다. 원자 둘레 전자 수를 모든 원자에 대해 더하면 결합 전자를 두 번 세게 되므로 총전자 보존에 쓰지 않는다. 금속 예시는 엔진의 외곽 전자 모형 범위에서 이 수를 보존한다. 실제 모든 내부 껍질을 그린다는 뜻이 아니다.

### 6.2 양성자 이동 템플릿

현재 명령으로 가능한 독립 예제다. 이름은 템플릿용이며 실제 앱에서는 예약한 원자 ID의 안전한 별칭으로 치환한다.

```text
scene "산과 수산화 이온"
stage solution
crowd H2O in water 24
mol a = H3O+ at 320,280
mol b = OH- at 580,280
step "수산화 이온의 O가 H 쪽으로 다가가요"
  approach b.O a.H1
step "O의 전자쌍이 H와 결합하고, 원래 O와 H의 전자쌍은 원래 O에 남아요"
  transfer a.H1 to b.O
```

`transfer`는 같은 단계의 다음 두 `arrow`와 대응한다.

```text
arrow b.O:lp -> b.O~a.H1
arrow a.H1~a.O -> a.O
```

두 줄을 별도 화학 단계로 나누지 않는다. 완결된 단계의 H는 결합 하나만 가져야 한다. `pairs`의 시각적 시간 안에서 받는 주머니가 먼저 연결되고, 주는 쪽 주머니가 뒤에 떨어진다. 잠깐 두 주머니가 H에 닿는 그림은 **연속 동작의 도식**이며 안정한 두 결합 H⁺ 중간체가 아니다. 그 프레임에서 사용자가 화학 조작을 재개할 수 없어야 한다.

| 사건 | donor H 역할 | acceptor 역할 | 결과 확인 |
|---|---|---|---|
| A01 | H₃O⁺의 선택 H | OH⁻의 O | 서로 다른 원자 ID를 가진 H₂O 두 개 |
| A02 | H₃O⁺의 선택 H | NH₃의 N | H₂O + NH₄⁺ |
| A03 | H₃O⁺의 선택 H | 아세트산 이온의 검토된 O⁻ 표현 자리 | H₂O + CH₃COOH |
| A04 | CH₃COOH의 OH에 붙은 H | OH⁻의 O | CH₃COO⁻ + H₂O |
| A05 | NH₄⁺의 선택 H | OH⁻의 O | NH₃ + H₂O |
| A06 | CH₃COOH의 OH에 붙은 H | NH₃의 N | CH₃COO⁻ + NH₄⁺ |

현재 `CC(=O)O` 등록 정의에서는 아세트산의 OH는 O2, 해당 H는 H4다. 생성물에서 같은 ID가 유지되더라도 다음 번 접근은 `a.H4` 문자열을 다시 추측하지 않고 그래프의 검토된 OH 자리로 찾는다. 아세트산 이온은 공명으로 두 O에 전하가 퍼지는 실재를 한 루이스 구조로 줄여 그린다. 상세 카드에 이를 표시하고, 동등한 공명 표현을 다른 물질로 판정하지 않는다.

### 6.3 침전 템플릿

선택할 이온이 정확히 하나씩 있는 **독립 장면**은 현재 명령으로 그릴 수 있다.

```text
scene "염화 은의 침전"
stage solution
crowd H2O in water 24
mol a = Ag+ at 350,280
mol b = Cl- at 570,280
step "두 이온 주위에 물 분자가 있어요"
  solvate a
  solvate b
step "이 조건에서는 이온이 고체의 일부가 돼요"
  precipitate Ag+ Cl- x1
```

입자 둘을 잇는 공유 전자쌍 주머니를 만들거나 `arrow`로 전자를 옮기지 않는다. Ag⁺와 Cl⁻의 전하는 유지되고, 수화 표현이 해제되며 고체 소속으로 바뀐다. 고체 외곽과 “AgCl 고체 · 화학식 단위 1”을 표시한다. 두 이온만으로 벌크 격자가 완성되었다는 표현을 피한다.

**현재 명령을 그대로 다입자 실험실에 쓰면 안 된다.** 컴파일러는 해당 화학식의 앞쪽 입자를 고르므로 사용자가 잡은 것과 다를 수 있다. 실험실에서는 아래 확장 계약을 사용한다.

```text
# 제안 문법. 현재 엔진에는 없으며 E2 확장을 먼저 구현해야 한다.
precipitate using a b
```

`a`, `b`는 예약한 양이온·음이온의 이름이다. 전하 크기 일치, 용액상, 미예약 상태, 검토된 고체 조합을 검사한다. 생성 결정 ID를 결과 매핑으로 돌려준다. 현재 지원은 한 쌍뿐이다. 이 확장 전에는 실험실 침전 기능을 숨기고, 기존 예제 재생만 허용한다.

### 6.4 용해 템플릿

```text
scene "소금의 한 단위가 물에 녹을 때"
stage solution
crowd H2O in water 24
crystal s = NaCl at center 2x1
step "물 분자가 이온을 둘러싸고, 이온은 결정에서 떨어져 나와요"
  dissolve s1 s2 from s
```

`2x1`은 이온 두 개, 즉 화학식 단위 하나다. 일반 결정에서는 선택한 노출 쌍의 ID로 `dissolve` 대상을 지정한다. `dissolve 2 from s`의 자동 선택에 의존하지 않는다. 원자·이온 전하는 그대로이며 공유 결합 절단 `arrow`를 만들지 않는다. `dissolve` 자체의 수화 표현을 활용하고 수화 껍질을 중복 생성하지 않는다.

드래그한 진한 H₂O는 용매를 가리키는 손잡이이며 소비하지 않는다. 카드: “이 물 분자는 충분한 주변 물을 대표해요.” 물 한 분자만 있어 소금 한 쌍을 녹인다는 화학량론을 제시하지 않는다. `veryDilute`로 바꿔 고체를 넣은 경우 그 고체 양이 최종 농도를 바꿀 수 있으므로 1차 D 판정은 모름이다.

### 6.5 금속 치환 템플릿

```text
scene "아연과 구리 이온"
stage solution
crowd H2O in water 24
mol z = Zn at 330,280
mol c = Cu2+ at 570,280
step "구리 이온이 아연 표면에 가까이 와요"
  approach c.Cu z.Zn
step "아연 쪽 전자 두 개가 구리 이온 쪽으로 이동해요"
  hop 2 z.Zn -> c.Cu
step "아연 이온이 물 분자에 둘러싸여요"
  solvate z
```

`approach`의 분자 회전은 금속 배위를 계산하지 않는다. 금속 형태는 Lab의 상 메타데이터와 표면 표시로 보완한다. 반응 후 Zn은 `aq`, Cu는 `metal-solid`다. 중성 Cu를 물속의 자유 원자처럼 계속 떠다니게 두지 않는다.

R02의 전자 이동은 **같은 화학 단계**에 넣는다.

```text
step "아연의 전자 두 개를 은 이온이 하나씩 받아요"
  hop z.Zn -> a1.Ag
  hop z.Zn -> a2.Ag
```

현재 엔진은 동일 공여체에서 나가는 전자에 시간차를 둘 수 있다. 화면에서는 전자가 하나 떠날 때마다 Zn 0→+→2+, 받는 Ag⁺→Ag로 바뀐다. 이 중간 표시는 전자 장부를 읽기 위한 도식이다. “Zn⁺ 중간체가 실제로 이 순서로 생겨요”라고 설명하지 않는다. 두 이동 사이에 영속 상태를 확정하지 않는다. R03은 공여체를 Cu로 바꾼다.

이 표현은 금속 내부 전도 전자와 실제 표면 반응 기구를 단순화한 순산화·환원 도식이다. 전자 이동 방향과 수는 보여 주지만 경로 길이·시간·독립 중간체의 존재를 예측하지 않는다.

### 6.6 부정과 모름의 대본

부정·모름에는 화학 변화 대본을 만들지 않는다. 설명 카드와 선택 강조만 사용한다. 필요하면 `note`처럼 화학을 바꾸지 않는 표시를 재생할 수 있으나, 실패한 결합이나 충돌 튕김을 ‘반응이 시도됐다 실패함’처럼 만들지 않는다.

- Na⁺+Cl⁻: “이 묽은 물속에서는 이온으로 남아요. 새 고체가 생기는 변화는 표시하지 않아요.”
- Cu+Zn²⁺: “이 참고 조건에서는 구리가 아연 이온을 금속 아연으로 바꾸는 반응은 진행 방향이 아니에요.”
- AgCl+NH₃: “착물과 용해가 함께 얽혀 있어요. 이 앱은 아직 이 조합을 판정하지 못해요.”

### 6.7 반드시 필요한 엔진·연결 계층 보완

아래는 기존 기능으로 가장하지 않는 **신규 작업**이다. 양자화학 엔진이나 새로운 물리 시뮬레이터는 필요 없다.

| ID | 변경 | 이유 | 완료 기준 |
|---|---|---|---|
| E1 | 기존 `World` 스냅샷과 단계 조각을 받아 컴파일하는 API. 입력 불변, 끝 상태·타임라인·ID 매핑 반환 | 매번 새 대본으로 시작하면 생성물의 원자 ID·위치·결정·수화가 끊김 | 연속 3사건과 취소/재실행에서 ID·전자·상 동일 |
| E2 | `precipitate using a b`처럼 정확한 입자 선택 | 현재 화학식 선택은 잘못된 입자를 소비할 수 있음 | 같은 화학식 이온 3개 중 지정한 ID만 고체가 됨 |
| E3 | Lab의 상·집합 메타데이터와 hit-test 연결 | 결정 이온들은 공유 결합 그래프상 분리돼 있고, 금속 대표 원자는 상 정보가 필요 | 결정 전체를 집기, 고체 내 이온의 자유 입자 반응 방지, 금속 표면 배지 |
| E4 | 드래그 미리보기 오버레이·안정 원자 자리 표시 | 기존 재생기만으로는 상태 비변경 미리보기/후보 선택이 안 됨 | 미리보기 전후 화학 상태 해시 동일 |
| E5 | 실험실 수준의 원자 ID·총전하·총전자·예상 생성물 검사 | 현재 국소 전자 검사만으로 올바른 반응·상·정체성을 확인할 수 없음 | 잘못된 전하·누락 원자·다른 이성질체 생성물 모두 차단 |
| E6 | 반응 끝 상태를 원자 소유자 문자열과 분리해 읽는 어댑터 | 양성자 이동 후 기존 `owner`가 현재 분자와 다를 수 있음 | 생성 NH₄⁺/물/금속을 다음 규칙에서 정확히 인식 |

E1은 기존 `cloneWorld`를 활용할 수 있지만 `compile(src)`가 이미 이 기능을 제공한다고 가정하지 않는다. E3·E4·E5·E6은 상당 부분 Lab 계층에서 구현할 수 있다. `heat`, `cool`, `light`, `condensation`, `hydrolysis`를 새 화학 판정 기능으로 착각해 호출하지 않는다.

## 7. 정직성·평형·부분 반응

### 7.1 결과 문구 계약

| 내부 결과 | 제목 | 본문 예시 | 상태 변경 |
|---|---|---|---|
| `reacts`, 준비됨 | “이 반응을 볼 수 있어요” → 재생 후 “반응 한 번을 보여 줬어요” | “O의 전자쌍이 H를 받아 물이 됐어요.” | 검증된 한 사건 |
| `reacts`, 양 부족 | “반응에 쓸 입자가 더 필요해요” | “Zn 1개에는 Ag⁺ 2개를 묶어 보여 줘요. Ag⁺ 1개가 더 필요해요.” | 없음 |
| `no-reaction` | “이 조건에서는 이 변화가 일어나지 않아요” | “매우 묽어서 AgCl 고체가 새로 생기지 않아요.” | 없음 |
| `unknown`, 범위 밖 | “이 앱이 아직 판단할 수 없어요” | “이 반응의 기체 조건은 지원하지 않아요.” | 없음 |
| `unknown`, 평형 | “일부가 반응할 수 있어요” | “얼마나 반응하는지는 농도와 평형 계산이 필요해요. 이 실험실에서는 계산하지 않아요.” | 없음 |
| `unknown`, 표현 실패 | “이 반응을 정확히 그릴 준비가 안 됐어요” | “잘못된 장면을 보여 주지 않도록 재생을 멈췄어요.” | 시작 상태 유지 |

사용자에게 익숙한 세 범주를 유지하되, ‘반응하지 않음’ 카드에는 **무슨 순변화를, 어떤 조건에서 부정하는지** 적는다. 인력, 이온쌍, 수화, 작은 역반응까지 완전히 없다는 문구는 금지한다.

‘AI에게 묻기’는 재료·상·참고 조건·모름 이유를 포함한 질문을 복사한다. 1차에는 외부 전송 기능을 만들지 않는다. AI의 답이나 대본을 받아도 실험실의 승인된 규칙으로 자동 승격하지 않는다. AI 장면은 별도의 출처 미검증 재생 경로로 남긴다.

### 7.2 평형을 다루는 선

1차는 **정확한 단위 사건 + 정성적인 방향 + 반응 정도 미계산**이다. 애니메이션의 입자 개수로 평형 분율을 말하지 않는다.

| 상황 | 1차 처리 | 금지하는 표현 |
|---|---|---|
| CH₃COOH+물 | 알려진 약산 해리이나 이온화 정도 미지원 → 모름 카드 | ‘산이 약해서 반응하지 않음’, 모든 산을 완전 해리 |
| NH₃+물 | 약염기 평형 → 모름 카드 | ‘NH₄OH 분자’ 자동 생성, NH₃ 전부 NH₄⁺로 변경 |
| NH₄⁺+CH₃COO⁻ | 역방향과 종 분포가 관련 → 모름 | 작은 K만 보고 반응 확률 0 |
| H₂O+H₂O | 자동 이온화·양성자 교환을 그리지 않음 → 모름 | 순수 물에 이온이 전혀 없다는 설명 |
| AgCl(s)+물 | 일부 용해·포화 계산 미지원 → 모름 | ‘AgCl은 절대 녹지 않음’ |
| A03/A05/A06 같은 지원 사건 | 해당 양성자 이동 1회를 보여 주되 정도 미계산 표시 | 화면에 모두 바뀌었으므로 100% 수율이라는 결과 |
| 되돌리기 | 편집 이력 복원 | 되돌리기 버튼이 실제 역반응이라는 설명 |

사용자가 같은 사건을 반복해 화면의 반응물을 모두 바꾸더라도 결과 줄은 “대표 입자에서 n회 재생”만 표시한다. “완전 반응”, “평형 도달”, “반응 끝”, 수율·pH·시간은 표시하지 않는다. 미시적으로 가능한 사건들의 표본을 사용자가 고른 것이지 그 표본의 빈도를 예측한 것이 아니다.

### 7.3 틀린 화학을 막는 주요 장치

| 위험 | 차단 |
|---|---|
| Na+Cl 원자 자동 결합을 일상의 소금 생성으로 설명 | 자유 원자 재료 제외. Na(s)+Cl₂(g)도 별도 조건 검토 전에는 모름 |
| HCl을 물속에 오래 떠 있는 중성 산 분자로 표시 | 염산 재료는 이미 해리된 H₃O⁺/Cl⁻ 표시로 제공. HCl(g) 유입 사건은 다른 모드로 미룸 |
| Zn⁺·Cu⁺를 반쪽 반응의 영속 생성물로 남김 | 전체 전자 전달 묶음 예약·원자적 확정·중간 조작 금지 |
| Ag⁺+OH⁻를 단순 ‘AgOH 침전’으로 추측 | 등록하지 않음. 산화물/용해 평형이 필요한 모름 |
| Cu²⁺+I⁻를 일반 침전 표로만 처리 | 미지원. 산화·환원과 침전의 결합을 검토하기 전에는 모름 |
| 침전 고체에 공유 결합 주머니 생성 | 상·격자 메타데이터만 변경, 전자 이동 없음 |
| H₂O 배경에서 필요한 원자·전자 몰래 생성 | 반응물 ID 원장과 수화 배경 분리 |
| 엔진 통과 = 화학적으로 맞음 | 지식 검토 → 계획 검증 → 엔진 검증의 세 관문 |
| 공명 구조 하나를 실제 국소 전하로 오해 | 검토된 공명 동등성 매핑, 분자 카드 설명. 공명 전자 이동을 별도 화학 반응으로 재생하지 않음 |

## 8. 1차 재료 목록

### 8.1 반응용 팔레트: 물질 24종

‘원소’는 낱원자와 동의어가 아니다. 원소 검색 결과는 지원된 실제 형태로 연결한다. 예컨대 Zn 검색은 ‘금속 아연의 표면 대표 단위’로, Cl 검색은 지원 이온과 미지원 Cl₂ 구조 보기로 연결한다.

| 분류 | 물질 | ID | 추가 형태 / 선택 이유 |
|---|---|---|---|
| 분자 | 물 H₂O | `water` | 추적 분자. 중화 생성물이며 용매 손잡이 |
| 분자 | 암모니아 NH₃ | `ammonia` | N 비공유 전자쌍과 H 받기 |
| 분자 | 아세트산 CH₃COOH | `acetic-acid` | 약산도 다른 상대와 반응한다는 대비 |
| 이온 | H₃O⁺ | `hydronium` | 물속의 산을 고립 H⁺ 대신 표현 |
| 이온 | OH⁻ | `hydroxide` | 양성자 받기 |
| 이온 | NH₄⁺ | `ammonium` | 생성물을 다시 반응물로 쓰기 |
| 이온 | CH₃COO⁻ | `acetate` | 짝산·짝염기, 공명 한계를 명시 |
| 이온 | Na⁺, K⁺ | `sodium-ion`, `potassium-ion` | 가용성 염과 비침전 비교 |
| 이온 | Cl⁻, Br⁻ | `chloride`, `bromide` | 은염 침전과 가용성 염 비교 |
| 이온 | NO₃⁻ | `nitrate` | 관찰자 이온 보기. 일반 반응성 예측은 하지 않음 |
| 이온 | Zn²⁺, Cu²⁺, Ag⁺ | `zinc-ion`, `copper-ion`, `silver-ion` | 금속 치환의 양방향 비교 |
| 원소·고체 | Zn(s), Cu(s), Ag(s) | `zinc-metal`, `copper-metal`, `silver-metal` | 표면 대표 원자. 1전자·2전자 수지 비교 |
| 결정 | NaCl(s), KCl(s), NaBr(s), KBr(s) | `sodium-chloride`, `potassium-chloride`, `sodium-bromide`, `potassium-bromide` | 한 단위의 해체, 같은 규칙을 자료로 확장 |
| 결정 | AgCl(s), AgBr(s) | `silver-chloride`, `silver-bromide` | 침전 생성물, 난용성 ≠ 불용성의 경계 |

위 목록은 **24종**이다(분자 3, 이온 12, 원소 금속 3, 결정 6). 표의 여러 물질을 한 행에 묶었으므로 구현에서는 각각 독립 ID를 만든다.

‘염산’ 검색은 HCl(aq) 중성 분자 대신 H₃O⁺·Cl⁻를 함께 놓는 재료 묶음을 제안한다. ‘수산화 나트륨 수용액’은 Na⁺·OH⁻ 묶음이다. 이 묶음은 이미 수용액인 재료를 추가하는 입력 동작이지, 출처 없이 원자를 만드는 반응 명령이 아니다. 추가 이력에 구성 입자 전체를 기록한다. 개별 이온 추가에서는 “반대 이온은 생략한 순이온 모형” 배지를 보여 준다.

### 8.2 구조 보기 전용

기존 분자 목록 중 H₂, O₂, N₂, CH₄, CO₂, HCl, Cl₂, C₂H₅OH, H₂O₂, HCO₃⁻, CO₃²⁻, Ca²⁺와 지원 파서로 읽은 SMILES를 넣어 볼 수 있다. 모두 ‘반응 판정 미지원’으로 구분한다. O₂의 루이스 구조는 실제 삼중항/홑전자 성질을 모두 표현하지 못하므로 라디칼 반응 판단의 재료로 쓰지 않는다.

그리기 엔진에 없는 원소를 억지 SMILES로 만들지 않는다. 미지원 원소는 정보 카드만 보여 주고 무대 추가는 막는다. 주기율표 전체의 클릭 가능한 반응 팔레트는 1차 목표가 아니다.

선정 기준은 일상 친숙함 하나가 아니라 **반응 자리 명확성, 표 데이터의 좁은 적용 범위, 엔진 표현 가능성, 양성·부정·모름의 교육적 대비, 생성물의 재사용**이다. 재료를 많이 넣는 것보다 이 기준을 일관되게 지키는 것이 우선이다.

## 9. 자료 형식과 프로그램 경계

이 절의 TypeScript는 실행 로직 구현이 아니라 **자료 계약**이다. 함수의 구체적인 알고리즘은 앞 절의 판정 절차를 따른다. 자료는 번들에 포함하고 런타임 네트워크 호출·LLM 호출·대형 데이터베이스를 사용하지 않는다.

### 9.1 기본 타입과 재료

```ts
type SpeciesId = string;
type InstanceId = string;
type AtomId = string;
type RuleId = string;
type SourceId = string;
type TableId = string;
type Phase = 'aq' | 'liquid' | 'metal-solid' | 'ionic-solid' | 'gas';
type Family = 'proton-transfer' | 'precipitation' | 'dissolution'
  | 'metal-displacement';
type Range = readonly [min: number, max: number];

interface SourceRef {
  id: SourceId;
  title: string;
  url: string;
  locator: string;             // 표·항목·페이지 등
  accessedOn: string;          // YYYY-MM-DD
}

interface Review {
  status: 'draft' | 'approved' | 'withdrawn';
  reviewer: string | null;     // 미검토인데 이름을 꾸며 넣지 않음
  reviewedOn: string | null;
  evidence: readonly SourceId[];
  rationale: string;
}

type Blueprint =
  | { kind: 'library'; key: string }
  | { kind: 'smiles'; value: string }
  | { kind: 'ionic-unit'; cation: SpeciesId; anion: SpeciesId };

interface SiteDef {
  id: string;
  kind: 'donor-H' | 'acceptor' | 'ion-center' | 'metal-center';
  atomLabels: readonly string[];
  bondedTo?: string;           // donor-H의 기존 결합 원자
  equivalentSet?: string;      // 검토된 대칭 자리 그룹
}

interface SpeciesDef {
  id: SpeciesId;
  nameKo: string;
  formula: string;             // 표시용. 정체성 키로 쓰지 않음
  phase: Phase;
  blueprint: Blueprint;
  netCharge: number;
  atomCounts: Readonly<Record<string, number>>;
  sites: readonly SiteDef[];
  representation: 'lewis' | 'metal-surface-unit' | 'ionic-formula-unit';
  resonanceClass?: string;     // 임의 방향족 정규화 대신 검토된 동등성
  support: 'reactive' | 'view-only';
  aliases: readonly string[];
  caveatKo?: string;
  review: Review;
}

interface ParticleInstance {
  id: InstanceId;
  speciesId: SpeciesId;
  atomIds: readonly AtomId[];
  phase: Phase;
  // 같은 결정에 속해도 각 화학식 단위의 원자 집합은 따로 기록한다.
  aggregateId?: string;
  zone: 'active' | 'shelf';
  x: number;
  y: number;
  rotation: number;
  createdBy: string;           // add/event ID
}

interface Environment {
  medium: 'water' | 'gas' | 'unspecified';
  temperatureC: number | null;
  activityPreset: 'ordinary' | 'veryDilute' | 'unspecified';
  excitation: 'none' | 'heated' | 'irradiated' | 'unknown';
  model: 'symbolic-events-v1';
}
```

`phase`는 한 물질 ID에서 자유롭게 바꾸는 속성이 아니다. `silver-ion`과 `silver-metal`처럼 종 ID도 함께 바뀐다. `SpeciesDef.phase`와 인스턴스 phase가 어긋나면 입력 무결성 오류다. 신규 상이 필요하면 별도 종 정의를 등록한다.

재료 예시:

```ts
const ammonia: SpeciesDef = {
  id: 'ammonia', nameKo: '암모니아', formula: 'NH3', phase: 'aq',
  blueprint: { kind: 'library', key: 'NH3' },
  netCharge: 0, atomCounts: { N: 1, H: 3 },
  sites: [{ id: 'N-lp', kind: 'acceptor', atomLabels: ['N'] }],
  representation: 'lewis', support: 'reactive', aliases: ['암모니아수'],
  caveatKo: '물과의 평형 비율과 금속 착물은 계산하지 않아요.',
  review: {
    status: 'draft', reviewer: null, reviewedOn: null,
    evidence: ['OS-I'], rationale: 'N 전자쌍을 이용하는 등록 사건만 허용'
  }
};
```

실제 release 자료는 `approved`여야 한다. 이 문서의 예시는 제안이므로 `draft`로 적었다. 이를 복사한 뒤 상태 문자열만 바꾸는 것은 검토가 아니다.

### 9.2 수치 표

```ts
interface NumericEvidence {
  sources: readonly SourceId[];
  temperatureC: 25;
  solvent: 'water';
  originalValue: string;
  derivation?: string;
}

interface AcidCoupleRow {
  kind: 'acid-couple';
  id: TableId;
  acid: SpeciesId;
  base: SpeciesId;
  pKa: number;
  donorSite: string;
  acceptorSite: string;
  evidence: NumericEvidence;
  review: Review;
}

interface WaterRow {
  kind: 'water-ion-product';
  id: TableId;
  pKw: number;
  evidence: NumericEvidence;
  review: Review;
}

interface SaltRow {
  kind: 'salt';
  id: TableId;
  solid: SpeciesId;
  cation: SpeciesId;
  anion: SpeciesId;
  ratio: readonly [1, 1];      // 현재 엔진에 맞춰 1차는 1:1만
  property:
    | { kind: 'ksp'; value: number }
    | { kind: 'soluble-in-reference-range' };
  evidence: NumericEvidence;
  review: Review;
}

interface MetalCoupleRow {
  kind: 'metal-couple';
  id: TableId;
  metal: SpeciesId;
  ion: SpeciesId;
  electronCount: 1 | 2;
  reductionPotentialV: number;
  referenceElectrode: 'SHE';
  evidence: NumericEvidence;
  review: Review;
}

type TableRow = AcidCoupleRow | WaterRow | SaltRow | MetalCoupleRow;
```

```ts
const silverChlorideData: SaltRow = {
  kind: 'salt', id: 'salt-agcl', solid: 'silver-chloride',
  cation: 'silver-ion', anion: 'chloride', ratio: [1, 1],
  property: { kind: 'ksp', value: 1.6e-10 },
  evidence: {
    sources: ['OS-J'], temperatureC: 25, solvent: 'water',
    originalValue: 'AgCl: 1.6 × 10^-10'
  },
  review: {
    status: 'draft', reviewer: null, reviewedOn: null,
    evidence: ['OS-J'], rationale: '자유 이온 활동도곱의 참고 구간 비교용'
  }
};
```

### 9.3 규칙·부정·맥락

규칙의 `guards`는 지정된 값과 집합 비교만 허용한다. 자료에 임의 JavaScript 함수, `eval`, 임의 대본을 넣지 않는다. 화학 계열마다 고정된 컴파일러를 사용한다.

```ts
interface StoichTerm {
  role: string;
  species: SpeciesId;
  count: number;               // 양의 정수. 계수는 최소 정수비
}

interface Conditions {
  medium: 'water';
  temperatureC: 25;
  activityPresets: readonly ('ordinary' | 'veryDilute')[];
  excitation: 'none';
}

interface ContextPolicy {
  allowedSpecies: readonly SpeciesId[];
  forbiddenTogether: readonly (readonly SpeciesId[])[];
  // 후보에 쓰는 입자도 포함한 활성 무대 기준. 선반은 제외.
  unknownExtra: 'block';
}

type LogKRecipe =
  | { kind: 'pKw'; water: TableId }
  | { kind: 'pKa'; acid: TableId }
  | { kind: 'pKw-minus-pKa'; water: TableId; acid: TableId }
  | { kind: 'pKa-difference'; productAcid: TableId; reactantAcid: TableId };

interface ReactionBase {
  id: RuleId;
  reactants: readonly StoichTerm[];
  products: readonly StoichTerm[];
  // 용해를 유발하는 물 손잡이처럼 소비되지 않는 접촉 상대
  contactHelpers: readonly SpeciesId[];
  conditions: Conditions;
  context: ContextPolicy;
  supersedes: readonly RuleId[];
  review: Review;
  explanationKo: string;
}

type ReactionRow = ReactionBase & (
  | {
      kind: 'proton-transfer';
      donor: { role: string; site: string };
      acceptor: { role: string; site: string };
      logK: LogKRecipe;
      template: 'transfer-v1';
    }
  | {
      kind: 'precipitation';
      salt: TableId;
      template: 'precipitate-selected-v1';
    }
  | {
      kind: 'dissolution';
      salt: TableId;
      template: 'dissolve-selected-v1';
    }
  | {
      kind: 'metal-displacement';
      donorCouple: TableId;
      acceptorCouple: TableId;
      template: 'metal-hop-v1';
    }
);

interface NegativeRow {
  id: RuleId;
  kind: 'negative-certificate';
  pair: readonly [SpeciesId, SpeciesId];
  process: 'net-precipitation' | 'metal-deposition' | 'new-species';
  conditions: Conditions;
  context: ContextPolicy;
  basis:
    | { kind: 'soluble-salt'; salt: TableId }
    | { kind: 'undersaturated'; salt: TableId; maxRatio: 0.1 }
    | { kind: 'reverse-metal'; forwardRule: RuleId; maxPotentialV: -0.2 }
    | { kind: 'reviewed-spectator-pair' };
  explanationKo: string;
  review: Review;
  supersedes: readonly RuleId[];
}

type UnknownReason =
  | 'SPECIES_UNREVIEWED' | 'ENV_UNSUPPORTED' | 'CONDITION_MISSING'
  | 'SPECIATION_UNSUPPORTED' | 'NO_REVIEWED_RULE' | 'SITE_UNREVIEWED'
  | 'CONDITION_BORDERLINE' | 'CONTEXT_UNREVIEWED' | 'COMPETING_PATHWAYS'
  | 'RULE_CONFLICT' | 'EQUILIBRIUM_REQUIRED' | 'REPRESENTATION_UNAVAILABLE';

interface UnsupportedRow {
  id: string;
  kind: 'unsupported-case';
  pair: readonly [SpeciesId, SpeciesId];
  reason: UnknownReason;
  explanationKo: string;
  // 지식의 경계 설명이다. 생성물이나 실행 템플릿은 없다.
}

type RuleRow = ReactionRow | NegativeRow | UnsupportedRow;
```

예를 들어 R02는 다음과 같이 쓴다. 아래의 출처 ID와 종 ID는 같은 번들의 사전에 존재해야 한다.

```ts
const zincSilver: ReactionRow = {
  id: 'R02', kind: 'metal-displacement',
  reactants: [
    { role: 'donor', species: 'zinc-metal', count: 1 },
    { role: 'acceptor', species: 'silver-ion', count: 2 }
  ],
  products: [
    { role: 'oxidized', species: 'zinc-ion', count: 1 },
    { role: 'reduced', species: 'silver-metal', count: 2 }
  ],
  contactHelpers: [],
  donorCouple: 'redox-zn', acceptorCouple: 'redox-ag',
  template: 'metal-hop-v1',
  conditions: {
    medium: 'water', temperatureC: 25,
    activityPresets: ['ordinary'], excitation: 'none'
  },
  context: {
    allowedSpecies: ['water', 'sodium-ion', 'potassium-ion', 'nitrate',
      'zinc-metal', 'zinc-ion', 'copper-metal', 'copper-ion',
      'silver-metal', 'silver-ion'],
    forbiddenTogether: [['zinc-metal', 'copper-ion', 'silver-ion']],
    unknownExtra: 'block'
  },
  supersedes: [],
  explanationKo: '아연의 전자 두 개를 은 이온이 하나씩 받아요.',
  review: {
    status: 'draft', reviewer: null, reviewedOn: null,
    evidence: ['OS-L'],
    rationale: '순반응과 두 전자의 이동을 나타내며 실제 표면 속도는 나타내지 않음'
  }
};
```

부정 행은 다음처럼 반응 종류를 한정한다. 검사할 맥락 목록도 생략하지 않는다.

```ts
const noSodiumChloridePrecipitate: NegativeRow = {
  id: 'N01', kind: 'negative-certificate',
  pair: ['sodium-ion', 'chloride'], process: 'net-precipitation',
  conditions: {
    medium: 'water', temperatureC: 25,
    activityPresets: ['ordinary'], excitation: 'none'
  },
  context: {
    allowedSpecies: ['water', 'sodium-ion', 'potassium-ion',
      'chloride', 'bromide', 'nitrate'],
    forbiddenTogether: [], unknownExtra: 'block'
  },
  basis: { kind: 'soluble-salt', salt: 'salt-nacl' },
  explanationKo: '이 묽은 물속에서는 NaCl 고체가 새로 생기지 않아요.',
  supersedes: [],
  review: {
    status: 'draft', reviewer: null, reviewedOn: null,
    evidence: ['OS-4.2'], rationale: '가용성 염의 묽은 조건에서 순침전 부정'
  }
};
```

### 9.4 판정 결과와 트랜잭션

화학 판정과 UI 준비 상태를 섞지 않는다. 모름에는 `products`가 없도록 타입으로 제한한다.

```ts
type Verdict =
  | {
      kind: 'reacts'; ruleId: RuleId; evidence: readonly SourceId[];
      readiness:
        | { kind: 'ready'; plan: ReactionPlan }
        | { kind: 'needs-material'; missing: readonly StoichTerm[] }
        | { kind: 'choose-contact'; candidates: readonly string[] };
    }
  | {
      kind: 'no-reaction'; certificateId: RuleId;
      process: NegativeRow['process']; explanationKo: string;
      evidence: readonly SourceId[];
    }
  | {
      kind: 'unknown'; reason: UnknownReason; explanationKo: string;
    };

interface ProductSpec {
  speciesId: SpeciesId;
  atomIds: readonly AtomId[];
  phase: Phase;
  aggregateKey?: string;
}

interface ReactionPlan {
  id: string;
  ruleId: RuleId;
  inputRevision: number;
  inputHash: string;
  environmentHash: string;
  participants: Readonly<Record<string, readonly InstanceId[]>>;
  helpers: readonly InstanceId[];
  atomRoles: Readonly<Record<string, AtomId>>;
  expectedProducts: readonly ProductSpec[];
  unchangedAtomIds: readonly AtomId[];
  electronTransfers: number;
  extent: 'one-stoichiometric-event';
  requiredCapabilities: readonly string[];
  dataVersion: string;
  engineVersion: string;
}

interface LabSnapshot {
  schemaVersion: 1;
  revision: number;
  // 기존 World의 Map을 배열로 직렬화한 정확한 구조.
  world: SerializedWorld;
  particles: readonly ParticleInstance[];
  environment: Environment;
  rngSeed: number;
  nextInstanceNumber: number;
  nextAtomNumber: number;
}

interface SerializedWorld {
  // 실제 구현은 World의 필드를 빠짐없이 직렬화하는 타입으로 고정한다.
  atoms: readonly unknown[];
  bonds: readonly unknown[];
  sites: readonly unknown[];
  attached: readonly (readonly [string, readonly string[]])[];
  temp: Readonly<Record<string, number>>;
  names: readonly (readonly [string, string])[];
  crystals: readonly (readonly [string, readonly string[]])[];
  lens: { charge: boolean; attract: boolean; numbers: boolean;
          oxidation: boolean; arrows: boolean };
  counter: number;
  plate: Readonly<Record<string, number>>;
  proteins: readonly unknown[];
}

interface HistoryEntry {
  id: string;
  kind: 'add' | 'remove' | 'move' | 'shelf' | 'environment' | 'reaction' | 'clear';
  before: LabSnapshot;
  after: LabSnapshot;
  ruleId?: RuleId;
  script?: string;
  dataVersion: string;
  engineVersion: string;
}
```

`SerializedWorld`의 `unknown[]`는 기존 엔진 `Atom/Bond/Site/Protein` 정의를 이 문서에서 복제하지 않기 위한 자리다. 구현에서는 해당 타입을 재사용하고 런타임 스키마 검증을 붙인다. 실제 저장에서 unknown을 무검증으로 통과시키라는 뜻이 아니다. `atoms`에는 좌표, lp, rad, owner, label, num, crowd, face, skip, lattice, sei, gone 등 현재 필드를 빠짐없이 포함한다. 미래 World 필드가 추가되면 스냅샷 스키마도 버전업한다.

### 9.5 자료 행 추가만으로 늘어나는 범위

**기존 계열·기존 표현 능력 안에서는 코드를 고치지 않고 자료를 추가한다.** 하지만 pKₐ 숫자 한 개만 넣고 모든 상대와의 반응을 자동 승인하는 것은 허용하지 않는다. ‘표에 한 줄’의 단위는 필요한 증거와 허용 범위를 함께 가진 등록 행이다.

```ts
interface ExtensionBundle {
  id: string;
  sources: readonly SourceRef[];
  species: readonly SpeciesDef[];
  tables: readonly TableRow[];
  rules: readonly RuleRow[];
  tests: readonly AcceptanceCase[];
}

interface AcceptanceCase {
  id: string;
  environment: Environment;
  inventory: readonly { instance: InstanceId; species: SpeciesId; zone: 'active' | 'shelf' }[];
  contact: readonly [InstanceId, InstanceId];
  expected:
    | { kind: 'reacts'; ruleId: RuleId; readiness: 'ready';
        products: readonly StoichTerm[] }
    | { kind: 'reacts'; ruleId: RuleId; readiness: 'needs-material';
        missing: readonly StoichTerm[]; stateChange: 'none' }
    | { kind: 'no-reaction'; process: NegativeRow['process'] }
    | { kind: 'unknown'; reason: UnknownReason };
}
```

예: NaCl 행을 본보기로 **KBr 용해와 비침전**을 추가할 때, K⁺·Br⁻는 이미 재료 목록에 있으므로 `SaltRow` 한 행과 `D04/N04` 선언, 시험만 추가한다. 고체 정의는 `ionic-unit`로 생성한다. 새 화학 코드·좌표·애니메이션 코드는 쓰지 않는다. 같은 방식으로 후속 NaI를 추가하려면 I⁻의 재료 행까지 묶음에 포함한다.

자료 추가 검증기는 다음을 수행해야 한다.

1. ID 중복·끊긴 참조·미등록 출처·조건 누락을 차단한다.
2. 원소별 수·전하·전자 수와 최소 정수 계수를 검증한다.
3. 모든 원자 자리 레이블이 해당 blueprint에 존재하는지 확인한다.
4. 생성물 그래프를 템플릿으로 실제 만들어 예상 종과 비교한다.
5. 양성·부정 조건의 겹침, 맥락 목록의 충돌, `supersedes` 순환을 찾는다.
6. 행마다 양성 또는 명시적 부정 사례, 경계 밖 모름 사례, 수량·순서 불변 사례를 요구한다.
7. 단위 테스트와 대본 사전 컴파일을 통과해도 화학 검토 상태가 draft이면 실행 대상으로 내보내지 않는다.

새 계열(착물, 광반응 등), 새로운 표현(2:1 침전 등), 새로운 용매는 한 줄 추가가 아니라 별도 설계다. 확장 용이성을 약속하기 위해 이 구분을 숨기지 않는다.

### 9.6 추천 파일 경계와 성능

| 제안 경로 | 책임 |
|---|---|
| `src/lab/data/species.ts`, `tables.ts`, `rules.ts`, `sources.ts` | 선언적 자료 |
| `src/lab/classify.ts` | 부작용 없는 접촉 판정 |
| `src/lab/plan.ts` | 재고·맥락·원자 매핑·예약 |
| `src/lab/compile-plan.ts` | 계열별 대본 템플릿, 기존 엔진 연결 |
| `src/lab/state.ts`, `history.ts` | 영속 화학 상태, 실행 취소 |
| `src/lab/interaction.ts`, `view.ts` | 드래그·미리보기·접근성 |
| `src/lab/validate-data.ts` | 빌드 시 자료 검사 |

반응 검색은 정렬한 종 ID 쌍의 인덱스로 좁힌다. 24개 대표 단위에서는 전수 근접 검색도 충분하다. 드래그는 `requestAnimationFrame`, 판정은 대상·환경·revision이 바뀔 때만 한다. 원자 구조 검증과 대본 컴파일은 pointermove마다 하지 않는다. 정적 자료 번들은 압축 전 200 KB 이하를 초기 예산으로 삼고, 외부 런타임 의존 데이터는 없다.

기준 PC 브라우저에서 일반 미리보기 갱신 p95 50 ms 이하, 드롭 사전 검사 p95 150 ms 이하를 목표로 한다. 측정으로 초과하면 작업을 프레임 밖으로 옮기고 필요할 때 Worker를 도입한다. 수치를 지키려고 보존 검사나 모름 판정을 생략하지 않는다.

## 10. 기대 결과를 명시한 검사

아래는 **구현 후 통과해야 할 인수 시험 사양**이다. 이미 구현하거나 시험을 통과했다고 주장하는 목록이 아니다. 화학 판정 60개는 반응함 20, 반응하지 않음 20, 모름 20으로 구성한다. 별도로 상태·표현·오류 시험 20개를 둔다.

공통 조건: 별도 표기가 없으면 물, 25 °C, ordinary, 외부 가열·광조사 없음. 표에 적지 않은 활성 재료는 없고 배경 물만 있다. 입력은 드래그한 입자 → 대상이며 `×n`은 실제 준비된 대표 단위 수다. 테스트는 승인 완료된 릴리스 후보 자료로 수행한다. 생성물 원자 ID와 총전하·총전자 보존도 모든 양성 시험에서 자동 확인한다.

### 10.1 반응함 20개

| ID | 입력·재고 | 기대 결과 | 필수 확인 |
|---|---|---|---|
| T01 | H₃O⁺ → OH⁻ | A01, H₂O 2개 | +1−1=0, H 4/O 2 보존 |
| T02 | H₃O⁺ → NH₃ | A02, H₂O+NH₄⁺ | 이동 H의 ID가 NH₄⁺에 포함 |
| T03 | H₃O⁺ → CH₃COO⁻ | A03, H₂O+CH₃COOH | 공명 동등성 매핑, 정도 미계산 문구 |
| T04 | CH₃COOH → OH⁻ | A04, CH₃COO⁻+H₂O | 메틸 H가 아니라 OH의 H 이동 |
| T05 | NH₄⁺ → OH⁻ | A05, NH₃+H₂O | 정도 미계산 문구, N에 전자쌍 복귀 |
| T06 | CH₃COOH → NH₃ | A06, CH₃COO⁻+NH₄⁺ | 최종 전하 합 0, 정도 미계산 문구 |
| T07 | Ag⁺ → Cl⁻ | P01, AgCl 고체 한 단위 | 전자 이동·공유 주머니 없음 |
| T08 | Ag⁺ → Br⁻ | P02, AgBr 고체 한 단위 | 상 변경, 이온 전하 유지 |
| T09 | NaCl(s) 한 단위 → H₂O | D01, Na⁺+Cl⁻ | 물 손잡이 미소비, 수화 껍질 중복 없음 |
| T10 | KCl(s) 한 단위 → H₂O | D02, K⁺+Cl⁻ | 결정 소속 해제 |
| T11 | NaBr(s) 한 단위 → H₂O | D03, Na⁺+Br⁻ | 이온 ID 보존 |
| T12 | KBr(s) 한 단위 → H₂O | D04, K⁺+Br⁻ | 동일 템플릿으로 코드 변경 없이 동작 |
| T13 | Zn(s) → Cu²⁺ | R01, Zn²⁺+Cu(s) | 전자 2개, 생성 Cu의 고체 표시 |
| T14 | Zn(s) → Ag⁺, Ag⁺ 총 2개 | R02, Zn²⁺+Ag(s) 2개 | 두 Ag ID 모두 예약, 단일 트랜잭션 |
| T15 | Cu(s) → Ag⁺, Ag⁺ 총 2개 | R03, Cu²⁺+Ag(s) 2개 | 전자 2개, Cu²⁺ 수화 |
| T16 | OH⁻ → H₃O⁺ | A01, T01과 동일 | 드래그 방향이 산·염기 역할을 뒤집지 않음 |
| T17 | H₃O⁺의 H3 쪽을 NH₃에 가까이 둠 | A02, H3 ID 이동 | 동등한 H 선택이 반응식을 바꾸지 않음 |
| T18 | Zn(s) → Ag⁺, Ag⁺ 총 1개 | R02 `needs-material`, 부족 Ag⁺ 1 | 모든 전자·전하·상은 그대로. Zn⁺ 없음 |
| T19 | Zn(s) 3개, Ag⁺ 3개 중 한 접촉 | R02 한 사건만 | Zn²⁺1/Ag2 생성, Zn2/Ag⁺1 남음. 자동 두 번째 반응 없음 |
| T20 | Ag⁺ a1,a2,a3, Cl⁻ b 중 a3→b | P01, a3와 b만 고체 | 앞에 등록된 a1/a2는 그대로 |

### 10.2 반응하지 않음 20개

아래 20행은 부정 인증의 명시 목록이다. N01–N04는 가용성 염, N05–N14는 이 묽은 수용액에서 해당 두 종이 새로운 물질로 바뀌지 않는 관찰자 쌍, N15–N17은 역방향 금속 치환, N18–N20은 지정된 조건의 비침전이다. 관찰자 쌍의 부정은 수화·인력·다른 물질과의 반응까지 부정하지 않는다. 가용성·관찰자 분류는 [수용액 반응과 순이온식의 공식 교재 설명](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions)에 근거하며, 출시 전 각각의 범위를 검토한다.

| ID / 인증 | 입력·조건 | 기대 부정의 범위 | 화면에 밝혀야 할 이유 |
|---|---|---|---|
| T21 / N01 | Na⁺ → Cl⁻ | NaCl 순침전 없음 | 이 묽은 조건에서 이온으로 남음 |
| T22 / N02 | K⁺ → Cl⁻ | KCl 순침전 없음 | 가용성 염 |
| T23 / N03 | Na⁺ → Br⁻ | NaBr 순침전 없음 | 가용성 염 |
| T24 / N04 | K⁺ → Br⁻ | KBr 순침전 없음 | 가용성 염 |
| T25 / N05 | Na⁺ → NO₃⁻ | 새 물질 생성 없음 | 이온으로 남음. NaNO₃ 분자 주머니를 만들지 않음 |
| T26 / N06 | K⁺ → NO₃⁻ | 새 물질 생성 없음 | 이온으로 남음 |
| T27 / N07 | Na⁺ → OH⁻ | 새 물질 생성 없음 | 묽은 수용액에서 NaOH 분자로 묶지 않음 |
| T28 / N08 | K⁺ → OH⁻ | 새 물질 생성 없음 | 묽은 수용액에서 KOH 분자로 묶지 않음 |
| T29 / N09 | H₃O⁺ → Cl⁻ | HCl 분자 생성의 순변화 없음 | 물속의 해리된 산·이온 표현 유지 |
| T30 / N10 | H₃O⁺ → Br⁻ | HBr 분자 생성의 순변화 없음 | 해당 수용액 조건에서 이온 표현 유지 |
| T31 / N11 | H₃O⁺ → NO₃⁻ | HNO₃ 분자 생성의 순변화 없음 | 해당 수용액 조건에서 이온 표현 유지 |
| T32 / N12 | NH₄⁺ → Cl⁻ | 새 물질 생성 없음 | NH₄Cl 공유 분자·침전 생성 금지 |
| T33 / N13 | NH₄⁺ → Br⁻ | 새 물질 생성 없음 | 이온으로 남음 |
| T34 / N14 | NH₄⁺ → NO₃⁻ | 새 물질 생성 없음 | 이온으로 남음 |
| T35 / N15 | Cu(s) → Zn²⁺ | Zn 금속 석출 없음 | 검토된 참고 조건에서 역방향 전위 |
| T36 / N16 | Ag(s) 2개와 Zn²⁺ | Zn 금속 석출 없음 | R02 역방향은 진행 방향이 아님 |
| T37 / N17 | Ag(s) 2개와 Cu²⁺ | Cu 금속 석출 없음 | R03 역방향은 진행 방향이 아님 |
| T38 / N18 | Ag⁺ → Cl⁻, veryDilute | AgCl 순침전 없음 | Qmax/Ksp=6.25×10⁻⁵ |
| T39 / N19 | Ag⁺ → Br⁻, veryDilute | AgBr 순침전 없음 | Qmax/Ksp=0.02 |
| T40 / N20 | Na⁺ → Cl⁻, veryDilute | NaCl 순침전 없음 | 참고 조건 변경에도 가용성 부정 유지 |

부정 인증의 맥락은 해당 두 종+H₂O가 최소다. N01–N04/N20은 §9의 N01 예시처럼 가용성 관찰자 집합을 허용한다. N05–N14는 §4의 A 계열 관찰자 집합 안에서만 사용하며, 산·염기 쌍 사이의 다른 사건 가능성을 부정하지 않는다. N15–N17은 R 맥락을, N18–N19는 P 맥락을 사용한다. 숫자 자료만 있는 신규 조합에는 이 표의 부정 인증을 복사·상속하지 않는다.

### 10.3 모름 20개

모든 행에서 화학 상태·원자 ID·전하를 보존하고, 예상 생성물의 실물 애니메이션을 재생하지 않는다.

| ID | 입력·조건 | 기대 reason | 이유 |
|---|---|---|---|
| T41 | CH₃COOH → H₂O | `EQUILIBRIUM_REQUIRED` | 일부 해리와 그 비율 미지원 |
| T42 | NH₃ → H₂O | `EQUILIBRIUM_REQUIRED` | 약염기 평형 |
| T43 | H₂O → 다른 H₂O | `EQUILIBRIUM_REQUIRED` | 자동 이온화·양성자 교환 미지원 |
| T44 | NH₄⁺ → CH₃COO⁻ | `EQUILIBRIUM_REQUIRED` | A06 역방향과 종 분포 |
| T45 | AgCl(s) → H₂O | `EQUILIBRIUM_REQUIRED` | 일부 용해·포화 계산 |
| T46 | AgBr(s) → H₂O | `EQUILIBRIUM_REQUIRED` | 일부 용해·포화 계산 |
| T47 | Ag⁺ → NH₃ | `NO_REVIEWED_RULE` | 착물 형성 규칙 없음 |
| T48 | AgCl(s) → NH₃ | `NO_REVIEWED_RULE` | 착물 형성과 용해의 결합 |
| T49 | Cu²⁺ → OH⁻ | `NO_REVIEWED_RULE` | 1:2 수산화물 침전과 조건 미검토 |
| T50 | Ag⁺ → OH⁻ | `NO_REVIEWED_RULE` | 단순 AgOH로 추측 금지 |
| T51 | Zn(s) → H₃O⁺ | `NO_REVIEWED_RULE` | 수소 발생 계열 미지원 |
| T52 | Cu(s) → H₃O⁺ | `NO_REVIEWED_RULE` | 산·산화제 조건을 검토하지 않은 범위. 일반 부정 금지 |
| T53 | Zn(s) → H₂O | `NO_REVIEWED_RULE` | 부식·표면·공기 반응 미지원 |
| T54 | Na⁺ → Cl⁻, gas | `ENV_UNSUPPORTED` | 수용액 부정을 기체에 적용하지 않음 |
| T55 | H₃O⁺ → OH⁻, 80 °C | `ENV_UNSUPPORTED` | 25 °C 자료 외삽 금지 |
| T56 | H₃O⁺ → OH⁻, veryDilute | `ENV_UNSUPPORTED` | 이 조건의 산·염기 자동 이온화 영향 미지원 |
| T57 | Ag⁺ → Cl⁻, activity unspecified | `CONDITION_MISSING` | 침전 여부에 필요한 조건 없음 |
| T58 | Zn→Cu²⁺, 활성 NH₃도 있음 | `CONTEXT_UNREVIEWED` | 착물 영향 배제 불가 |
| T59 | Ag⁺→Cl⁻, 활성 Br⁻도 있음 | `COMPETING_PATHWAYS` | 두 은염이 경쟁, 순서·조성 미지원 |
| T60 | CH₄ → O₂, 구조 보기 모드 | `SPECIES_UNREVIEWED` | 그릴 수 있는 분자와 예측 가능한 반응은 다름 |

`UnsupportedRow`를 두어 T41–T53의 이유를 일반 ‘모르는 조합’보다 구체적으로 보여 준다. 이유 코드 우선순위는 입력 무결성 → 기본 환경 → 알려진 종분포 경계 → 일반 미지원 재료 → 구체적 조합 경계 설명 → 맥락/충돌 → 표현 오류다. 단, 검토된 쌍이 있을 때의 관련 경쟁 차단은 그 쌍의 양성·부정보다 우선한다.

### 10.4 상태·표현·오류 시험 20개

| ID | 조작/주입 | 기대 결과 |
|---|---|---|
| S01 | T02 다음 생성 NH₄⁺를 새 OH⁻에 접근 | A05 가능. 원래 H₃O⁺에서 온 H도 추적 가능 |
| S02 | R01 후 생성 Cu(s)에 Ag⁺ 2개 접근, Zn²⁺는 유지 | R03 가능. 이전 생성물과 관찰자 상태 유지 |
| S03 | D01 후 나온 Cl⁻를 Ag⁺에 접근 | P01 가능. Na⁺는 그대로 |
| S04 | R02 애니메이션 중 첫 전자 직후 실행 취소 | 드래그 시작 전 Zn/Ag⁺ 전체 복구. Zn⁺/중성 Ag 잔류 없음 |
| S05 | S04 다시 실행 | 저장된 결과와 ID·위치·전하·결정 소속 동일 |
| S06 | T07 완료 후 실행 취소 | 선택했던 Ag⁺/Cl⁻와 수화·위치 복구 |
| S07 | T18의 부족 상태에서 두 번째 Ag⁺를 접촉권에 넣고 재시도 | 전체 재검사 후 R02 한 번. 자동 생성 이력 없음 |
| S08 | T14에 필요한 두 번째 Ag⁺가 120 px 밖에 있음 | 화학 양성 유지, `needs-material`과 가져올 입자 표시. 멀리서 자동 소비 금지 |
| S09 | 100회 pointermove 후 놓지 않고 Esc | 화학 상태·재고 해시 동일, 위치 복구 |
| S10 | 드래그 중 대상 삭제/조건 변경으로 revision 변경 | 오래된 후보 폐기. 삭제된 원자 참조 없음 |
| S11 | 두 번의 pointerup 또는 더블클릭 | 같은 사건 ID는 한 번만 확정 |
| S12 | 양성 반응 후 ‘다시 보기’ 3회 | 생성물·재고·이력 수 불변 |
| S13 | 침전 후 veryDilute로 조건 변경 | 자동 용해 없음. 다시 판정 시 해당 고체+물은 모름 |
| S14 | 사용자 SMILES로 동일 분자식의 미검토 구조 추가 | 분자식만 보고 승인 종으로 승격하지 않음 |
| S15 | 계획에서 H ID 하나 누락 또는 전하 합 1 차이 주입 | 사전 검증 실패, `REPRESENTATION_UNAVAILABLE`, 상태 불변 |
| S16 | 선택 ID 침전 기능 E2를 사용할 수 없는 엔진 | 침전 실행 차단. legacy 화학식 선택으로 몰래 대체 금지 |
| S17 | 같은 조건에 양성/부정 행을 함께 주입 | 빌드 시 충돌 오류. 실행 시에는 `RULE_CONFLICT` |
| S18 | 시험 전용 활동도 구간이 Q≈Ksp를 포함 | `CONDITION_BORDERLINE`; 구간 중간값만 취해 결론 내리지 않음 |
| S19 | 건너뛰기·리로드·서로 다른 프레임률로 같은 사건 재생 | 검증된 끝 상태 동일. 시간은 그림에만 영향 |
| S20 | HCl(aq) 중성 분자가 들어 있는 외부 장면을 Lab으로 가져옴 | `SPECIATION_UNSUPPORTED`; 해리된 입력으로 새 실험을 만드는 안내만 제공 |

### 10.5 공통 성질 검사

- 입력 순서 교환·분자 회전·줌은 화학적 결론을 바꾸지 않는다. 가까운 동등 H가 달라져 원자 매핑만 달라질 수 있다.
- 관련 없는 허용 관찰자를 하나 추가해도 반응식은 같다. 금지된 제3 물질을 추가하면 반드시 모름이 된다.
- 모든 승인 양성은 필요한 양 이상일 때만 재생한다. 부족할 때 일부 전자 이동을 먼저 적용하지 않는다.
- 부정과 모름은 화학 그래프에 동일하게 무변화를 보이되, 결과 타입·문구·근거가 반드시 다르다.
- 새로운 표 행이 기존 승인 사례의 결과를 바꾸면 회귀로 처리한다. 바꾸려면 명시적 버전과 검토 기록이 필요하다.
- `transfer`의 프레임 처음·중간·끝에서 전자쌍이 갑자기 사라지거나 복제되지 않는다. 끝 상태에서 H 둘레 2개, 2주기 원소 둘레 8개 초과가 없어야 한다.
- `hop`에서는 전자 하나마다 전하가 바뀌며, 트랜잭션 끝에서 짝수 전자 결합 조건과 예상 금속 산화 상태를 만족한다.
- 시험은 분자 수/문구만 비교하지 않고 원자 매핑·전자·상·실제로 선택한 참여 ID를 비교한다.

## 11. 구현 단계와 끝났다는 기준

달력 날짜나 ‘며칠이면 된다’를 약속하지 않는다. 가장 위험한 부분을 먼저 증명하고, 각 단계의 검사를 통과해야 다음 범위를 연다.

| 단계 | 넣는 것 | 끝났다는 기준 / 공개 여부 |
|---|---|---|
| 0. 기술·화학 계약 증명 | A01, P01, R02의 계획/보존 검사. E1/E2 연결의 작은 시제품 | 선택 ID 침전, 부족한 Ag⁺, 중간 취소, 생성물 재사용을 실제 엔진에서 재현. 화학 검토자와 자료 검토 절차 지정. 아직 공개판 아님 |
| 1. 가장 작은 유용한 공개판 | 반응 재료 최소 묶음: H₂O/H₃O⁺/OH⁻/NH₃/NH₄⁺, Ag⁺/Cl⁻/AgCl, Na⁺/NaCl, Zn/Zn²⁺/Cu/Cu²⁺/Ag. A01/A02/A05, P01, D01, R01/R02/R03. 세 결과·수량 부족·취소·참고 조건 | 해당 부분집합의 모든 화학 시험과 S01–S20 중 적용 항목 통과. 한 접촉으로 시작해 생성물로 다음 반응이 가능. 미지원 재료 검색은 정확히 모름/구조 보기로 분리 |
| 2. 1차 범위 완성판 | 이 문서의 24종, 양성 15사건, 부정 인증 20개, 모름 설명, 60+20 시험 전체. K/Br/아세트산 확장은 자료 추가로 수행 | T01–T60, S01–S20 및 공통 성질 검사 통과. 추가 계열 코드 없이 KBr 행을 등록하는 작업 재현. 과학 검토 완료, 전체 목록 승인 |
| 3. 기존 계열의 자료 확장 | 출처와 예외가 명확한 산/염기·1:1 염·금속 사례만 추가 | 행마다 조건 밖 모름·부정 경계·원자 매핑·순서 불변 시험. 수치 추가만으로 미검토 상대가 자동 활성화되지 않음 |
| 4. 별도의 ‘용액 전체’ 모드 | 실제 부피·몰수·전기적 중성·산/염기 물질 수지·활동도 모델·평형 해법. 우선 단일 약산과 단일 약염기만 | 분석해가 있는 사례와 대조, 전하·질량 수지 잔차 기준 수립, 희석/농축 이력 일관성. 대표 입자 모드와 결과 단위를 혼동하지 않는 사용자 검증 |
| 5. 별도의 신규 화학 | 금속+산, 착물, 다가 이온 침전, 기체·광반응 중 한 계열씩 | 각 계열의 조건·예외·기구 표현·새 엔진 기능을 별도 사양으로 승인. 이 문서의 임계값을 무리하게 재사용하지 않음 |

‘1차 범위’는 단계 2까지의 고정된 계약이고, 단계 1은 그중 가장 작은 공개 가능한 부분집합이다. 단계 1 출시 때 미완성 기능의 성공 장면을 보여 주지 않는다. 이미 등록된 엔진 분자라도 실험실 규칙이 아직 없으면 모름이다.

### 11.1 모든 공개 단계의 공통 출시 기준

1. 화학 검토되지 않은 양성·부정 행을 실행하지 않는다. 사용자 요청이 아무리 그럴듯해도 런타임에 규칙을 생성하지 않는다.
2. 실험실의 기본 표현은 `pairs`이며 전자 수, 전하 변화, 상 변화가 템플릿의 의미와 일치한다.
3. 드래그·키보드 모두 같은 판정 경로를 사용하고 미리보기는 화학 상태를 바꾸지 않는다.
4. 부족·모름·표현 오류에서는 검증된 시작 상태가 그대로 남는다. 취소·재실행이 전 상태를 복원한다.
5. 네트워크가 끊겨도 앱을 불러온 뒤 재료 선택·판정·재생·취소가 된다. 서버나 외부 AI가 필요하지 않다.
6. 제품 UI에 실제 수율·pH·시간·실험 절차로 오해할 숫자가 없어야 한다. 참고 조건·대표 입자라는 의미를 사용자가 설명할 수 있는지 확인한다.
7. 미지원 항목을 ‘반응하지 않음’으로 합쳐 세는 로깅·분석 코드도 없어야 한다.

## 12. 남는 위험과 미정 사항

### 12.1 결정했지만 대가가 남는 것

| 위험 | 지금의 결정 | 남는 한계 / 확인 방법 |
|---|---|---|
| 대표 입자를 실제 비커로 오해 | 고정 안내, 참고 조건, 한 사건 표시 | 안내가 있어도 사용자는 수율로 읽을 수 있다. 출시 전 초보 사용자에게 화면 해석을 말해 보게 한다 |
| 모름이 많아 재미가 줄어듦 | 넓은 오답보다 좁은 정확성 선택 | 성공 가능한 시작 재료 묶음 4개를 제공하고 모름 이유에서 관련 수업으로 연결 |
| 화학 경로가 마치 결정적인 기구처럼 보임 | 금속 전자 이동과 양성자 동작을 도식으로 명시 | 순반응을 그리는 것과 실제 중간체를 관측하는 것의 차이를 지속적으로 검토 |
| 금속 표면의 현실성 부족 | 표면 대표 단위와 상 표시 | 피막·수소 발생·침전 핵생성을 예측하지 않는다. 표면이 보이지 않는 구현은 출시하지 않음 |
| 가역 반응을 끝까지 눌러 단방향처럼 보이게 함 | 사건 수만 기록, 정도·평형 도달 문구 금지 | 실제 평형을 배우려면 별도 모드가 필요 |
| 공명·전이금속 전자 배치 단순화 | 검토된 루이스/외곽 전자 모형만 | 전자쌍 그림 자체를 완전한 전자 밀도라고 가르치지 않음 |
| 데이터 표의 출처별 값 차이·오류 | 한 버전의 자료와 조건 고정, 여유 구간, 출처 추적 | 정확한 수치 예측 기능을 추가하려면 원자료·불확도 재검토 필요 |
| 기존 엔진의 선택·ID·owner 가정 | E1–E6을 선행 | 실제 통합 중 추가 제약이 발견될 수 있다. 그때는 표시 가능한 범위를 먼저 줄인다 |
| 무대의 제3 재료가 많을수록 차단 | 허용 맥락 밖은 모름, 선반 제공 | 장기적으로 복합 반응망이 없으면 자유 혼합의 범위가 좁음 |

시작 재료 묶음은 “물 만들기”(A01), “H 주고받기”(A02→A05), “고체가 생기기”(P01), “금속 바꾸기”(R01→R03)다. 새 실험에 필요한 대표 입자를 놓아 줄 뿐, 정답을 자동 실행하지 않는다.

### 12.2 아직 정할 수 없는 것과 기본값

| 미정 | 지금 사용할 기본값 | 해소 시점 |
|---|---|---|
| 실제 화학 검토 담당자 | 미지정, 데이터 상태 draft | 공개 단계 1 이전 |
| E1이 기존 Timeline/렌더러에 미치는 구체 API 변경 | 스냅샷 불변 입력·끝 상태 반환 계약 유지 | 단계 0 시제품에서 확정 |
| 금속 표면 배지와 결정 단위 외곽의 구체 모양 | 기존 원자/이온 그림에 별도 고체 외곽·문구. 공유 결합 추가 금지 | 단계 0의 시각 검토 |
| 모바일 드래그·다중 선택 | PC만 우선, 키보드 대안 완비 | 1차 완성 이후 별도 검증 |
| 공명 등가 매핑의 저장 방식 | 아세트산 계열의 승인된 두 O 매핑만 지원 | 더 큰 공명 분자를 추가할 때 재설계 |
| 광학적 결정 색·금속 표면 질감 | 이 문서는 화학식·상 구분만 필수, 색은 구조 구분용 | 사실적인 색을 넣을 때 별도 출처 검토 |

미정은 구현 AI가 임의의 화학 가정을 채우라는 뜻이 아니다. 미정이 실행 결과의 정확성을 막으면 해당 기능을 모름 또는 미공개 상태로 유지한다. UI 간격·문구 길이처럼 화학 결론을 바꾸지 않는 구현 선택은 이 문서의 기본값에서 조정할 수 있다.

## 13. 구현자가 지켜야 할 최종 계약

- 재료의 구조가 그려진다는 이유로 반응을 허용하지 않는다.
- 양성에는 조건·원자 매핑·생성물·표현 검증이, 부정에는 부정 인증이 있어야 한다.
- 규칙 부재·경계 조건·경쟁 경로·부족한 표현은 모름이다. 수량 부족은 지원된 반응의 실행 대기다.
- 대본은 화학 결론을 내리는 곳이 아니다. 판정·계획을 검증한 뒤 그리는 곳이다.
- 조작 중의 그림과 확정된 화학 상태를 분리한다. 실제 생성물 상태만 다음 조작의 입력이 된다.
- 입자의 정수 개수는 식의 계수를 보여 준다. 그 수로 농도·평형·수율을 주장하지 않는다.
- 범위를 늘릴 때는 자료 행과 근거·경계 시험을 함께 추가한다. 새 화학 계열은 별도로 설계한다.
