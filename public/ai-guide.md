# chemvis 대본 안내서 (AI용)

chemvis는 짧은 장면 대본을 읽어 화학 반응과 물질 현상을 원자·전자 수준의 애니메이션으로 그린다.
AI는 HTML·SVG를 직접 만들지 않고 이 대본만 쓴다. 배치, 그리기, 움직임, 생성물 계산, 검산은 앱이 맡는다.

- 앱 주소: https://gybeom8008.github.io/chemvis/
- 이 안내서: https://gybeom8008.github.io/chemvis/ai-guide.md
- 예시 대본 전체: 앱 튜토리얼(책 아이콘) 각 장의 대본 (저장소 `src/tutorial/chapters.ts`)

## 대본을 넘기는 방법

1. **링크(권장, 코드 실행이 될 때)**: 대본을 UTF-8로 인코딩 → raw deflate로 압축 → base64url(`+`→`-`, `/`→`_`, `=` 제거) → `https://gybeom8008.github.io/chemvis/#z=<결과>`
   ```python
   import zlib, base64
   c = zlib.compressobj(9, zlib.DEFLATED, -15)
   z = c.compress(script.encode()) + c.flush()
   url = "https://gybeom8008.github.io/chemvis/#z=" + base64.urlsafe_b64encode(z).decode().rstrip("=")
   ```
2. **압축 없는 링크**: `#s=` 뒤에 퍼센트 인코딩한 대본(`encodeURIComponent`). 길어진다.
3. **코드 블록**: 코드 실행이 안 되면 대본을 코드 블록으로 준다. 사용자가 앱 오른쪽 위 대본 아이콘(`</>`)으로 대본 칸을 열어 넣고 ✓(적용, Ctrl+Enter)를 누른다.

앱이 오류를 내면 대본 칸 아래에 줄 번호와 오류 문장이 뜨고, 사용자가 그것을 그대로 전해 준다. 그 줄만 고쳐 다시 준다.

## 문법 개요

- 한 줄에 명령 하나. 낱말은 공백으로 나눈다. 띄어쓰기가 있는 글은 `"따옴표"`로 감싼다. `#` 뒤는 주석.
- 순서: `scene` → `stage` → (`lens`, `crowd`, `crystal`, `mol`, `place`) → `step` 블록들.
- `step "설명 문장"` 아래 줄들이 그 단계의 명령이다. 한 단계 안의 명령은 **동시에** 일어난다. 순서가 있는 일은 단계를 나눈다.
- 설명 문장은 사용자가 읽는 자막이다. 한 단계에 사실 하나, "무엇이 어디서 어디로 가서 무엇과 결합하는가"를 쓴다.
- 이름은 영문자로 시작하는 영문·숫자(`w`, `a`, `c1`). 원자는 `이름.원자` (`w.O`, `w.H1`, `a.Cl`). 같은 원소가 여럿이면 번호까지 쓴다(`w.H1`, `w.H2`).
- 비공유 전자쌍은 `원자:lp` (`w.O:lp`), 결합은 `원자~원자` (`a.H~a.Cl`).

## 무대 (`stage`)

| 무대 | 쓰는 곳 | 구역 이름 |
|---|---|---|
| `solution` | 용액 속 반응·확산·용해 | `water`(전체), `left`, `center`, `right`, `top`, `bottom` |
| `interface` | 증발·응결·기체 용해 | `air`, `surface`, `water` |
| `soil` | 흡착·이온 교환·씻겨 내려감 | `air`, `topsoil`, `subsoil`, `groundwater`, 그리고 점토 `clay` |

## 장면 준비 (첫 step 앞)

| 명령 | 뜻 |
|---|---|
| `scene "제목"` | 장면 제목 |
| `stage solution` | 무대 |
| `lens charge on/off` | 형식 전하 표시(기본 on) |
| `lens attract on/off` | 분자 사이 인력(수소 결합 등) 점선 (interface는 기본 on) |
| `lens numbers on/off` | 원자 추적 번호 |
| `crowd H2O in water 40` | 배경 용매 분자를 흐리게 깐다(최대 160) |
| `crystal s = NaCl at bottom 5x3` | 1가 이온 결정(NaCl, KCl, KBr, LiF …) |
| `mol w = H2O at center` | 이름 있는 분자. 위치: `at 구역`(가운데), `in 구역`(빈 곳 아무 데나), `at 300,200`, `near a right/left/above/below`, `on clay [in topsoil]`(soil 전용, 양이온만) |
| `mol c x3 = Ca2+ in left` | 여러 개 → `c1`, `c2`, `c3` |
| `place Na+ in left x5` | 이름 없이 여러 개. 나중에 화학식(`Na+`)으로 가리킨다 |

`mol`·`place`를 step 안에 쓰면 그 단계에서 나타난다.

## 등록된 분자

H2O, H3O+, OH-, NH3, NH4+, CH4, HCl, HF, HBr, H2S, H+, Li+, Na+, K+, Mg2+, Ca2+, Al3+, F-, Cl-, Br-, I-, H2, O2, N2, Cl2, CO2.
`Ca++`, `Ca+2`도 `Ca2+`로 읽는다. 목록에 없는 분자는 아직 쓸 수 없다(오류가 난다).

## 기본 동작 (step 안)

### 결합 변화 (화학 반응)

| 명령 | 화면 |
|---|---|
| `arrow w.O:lp -> w.O~a.H` | 전자쌍 하나가 굽은 화살표를 따라 이동. 출발은 `원자:lp` 또는 `원자~원자`, 도착은 원자 또는 새 결합 |
| `transfer a.H to w.O` | 양성자 이동. `arrow (받는 원자):lp -> 새 결합`과 `arrow H~옛 짝 -> 옛 짝` 두 줄로 펼쳐진다 |

규칙: 비공유 전자쌍은 그 원자가 포함된 결합으로만 간다. 결합의 전자쌍은 그 결합의 두 원자 중 하나로, 또는 그 원자가 포함된 새 결합으로만 간다.
생성물 구조, 형식 전하, 분자 모양은 앱이 계산한다. 한 단계가 끝날 때 H가 전자 2개, 2주기 원소가 8개를 넘으면 오류.

### 분자 움직임

| 명령 | 화면 |
|---|---|
| `approach w.O a.H` | w가 다가와 w.O의 비공유 전자쌍이 a.H를 향한다 (반응 직전 단계에 쓴다) |
| `move w to right` / `move w to 300,200` / `move w near a` | 그대로 이동 |
| `diffuse a b to right` | 무작위로 움직이며 목표 구역으로 (경로가 점선으로 남는다) |
| `spread Na+ Cl- in water` | 해당 입자가 모두 무작위로 움직여 구역 전체로 퍼진다(확산) |

### 용매·상태 변화

| 명령 | 화면 |
|---|---|
| `solvate a` / `solvate all` | 배경 물 분자가 이온을 둘러싼다(수화 껍질). 양이온에는 O가, 음이온에는 H가 향한다. 껍질은 이온과 함께 움직인다 |
| `dissolve 2 from s` | 결정 모서리 이온이 물 분자에 둘러싸여 떨어져 나간다 |
| `evaporate H2O` | (interface) 수면에 가장 가까운 물 분자가 공기로 나간다 |
| `condense H2O` | (interface) 공기 중 물 분자가 액체로 내려온다 |
| `heat water` / `cool water` | 그 구역 입자 움직임이 빨라진다/느려진다 |

### 토양 (soil)

| 명령 | 화면 |
|---|---|
| `exchange c with 2 H+ on clay` | 흡착된 c가 떠나고 H+ 2개가 그 음전하 부위를 차지. **전하 합이 같아야 한다** (Ca2+ ↔ 2 H+) |
| `leach c from topsoil to subsoil` | 씻겨 내려감(용탈). 빗물이 공극으로 흐르고, 물 분자가 c를 둘러싸고, c가 물과 함께 아래 구역으로 이동. 흡착돼 있었다면 떨어져 나온다 |
| `rain` | 빗물이 모든 공극을 따라 흐른다 |

### 설명

| 명령 | 화면 |
|---|---|
| `note w.O:lp "비공유 전자쌍"` | 대상(원자, `:lp`, 결합, 분자 이름, 구역, `clay`, `surface`)에 설명 상자 |
| `wait` | 아무 일 없이 잠깐 |
| `lens attract on` (step 안) | 그 단계부터 표시를 바꾼다 |

## 예시

```
scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol a = HCl at left
mol w = H2O at center

step "물 분자의 O가 비공유 전자쌍을 앞세워 HCl의 H에 다가가요"
  approach w.O a.H
step "O의 전자쌍은 O–H 새 결합으로, H–Cl 결합의 전자쌍은 Cl로 옮겨 가요"
  transfer a.H to w.O
step "하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고 물 분자들이 둘러싸요"
  solvate all
```

```
scene "산성비가 내린 흙에서 칼슘이 씻겨 내려갈 때"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "빗물의 H+ 두 개가 점토 표면의 Ca2+ 하나를 대신해요"
  exchange c with 2 H+ on clay
step "떨어져 나온 Ca2+가 물 분자에 둘러싸여 빗물과 함께 속흙으로 내려가요"
  leach c from topsoil to subsoil
```

## 쓰는 요령

- 반응은 `approach`로 먼저 가까이 두고, 다음 단계에서 화살표를 쓴다.
- 화살표는 실제 메커니즘대로 쓴다. 앱은 전자 수와 전하만 검사하고, 반응이 실제로 일어나는지는 판단하지 않는다.
- 앱이 아직 못 그리는 것(등록 안 된 분자, 고리 화합물, 산화·환원의 전자 하나 이동, 막 수송 등)은 억지로 흉내 내지 말고 사용자에게 그 사실을 말한다.
