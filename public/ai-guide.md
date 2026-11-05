# chemvis 대본 안내서 (AI용)

chemvis는 짧은 장면 대본을 읽어 화학 반응과 물질 현상을 원자·전자 수준의 애니메이션으로 그린다.
AI는 HTML·SVG를 직접 만들지 않고 이 대본만 쓴다. 배치, 그리기, 움직임, 생성물 계산, 검산은 앱이 맡는다.

- 앱 주소: https://gybeom8008.github.io/chemvis/
- 이 안내서: https://gybeom8008.github.io/chemvis/ai-guide.md
- 기본 개념별 대본: 앱 튜토리얼(책 아이콘) 각 장의 대본 (저장소 `src/tutorial/chapters.ts`). 튜토리얼은 0부 화면 읽는 법, 1부 물리 변화, 2부 화학 반응(산·염기, 중화, 산화·환원, 전지, 라디칼, 치환, 첨가, 축합·가수분해, 배위 결합), 3부 반응과 에너지·화학 평형으로 되어 있다. 설명에 이 용어를 쓰면 사용자가 튜토리얼에서 찾아볼 수 있다
- 여러 현상을 잇는 완성 장면: 앱의 예시(문서 아이콘) 목록 (저장소 `src/tutorial/examples.ts`). 주소 `#/x/limestone`처럼 바로 열 수 있다

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
| `gas` | 기체 반응(라디칼, 평형 등) | `air`(전체), `left`, `center`, `right`, `top`, `bottom` |
| `cell` | 전지(두 전극, 도선, 염다리) | `left`(산화 전극 쪽 용액), `right`(환원 전극 쪽 용액), `top`. 전극 이름은 `left`·`right` |
| `membrane` | 세포막(인지질 이중층)과 막 단백질 | `outside`(위, 세포 밖), `inside`(아래, 세포 안), `membrane` |
| `root` | 뿌리털: 위는 흙 속 물과 점토 알갱이(음전하 부위 6개), 아래는 뿌리털 세포. 막 명령(protein, pump, cross)과 점토 명령(`on clay`, exchange)을 함께 쓴다 | `outside`(흙 속 물), `inside`(세포 안), `membrane` |
| `mito` | 미토콘드리아 내막(membrane과 같고 이름만 다름) | `outside`(위, 막 사이 공간), `inside`(아래, 기질), `membrane` |
| `battery` | 리튬 이온 전지(흑연 음극, 분리막, 금속 산화물 양극, 바깥 도선) | `anode`(흑연), `cathode`(산화물), `electrolyte`, `left`·`right`(분리막 양쪽 전해질), `top` |

## 장면 준비 (첫 step 앞)

| 명령 | 뜻 |
|---|---|
| `scene "제목"` | 장면 제목 |
| `stage solution` | 무대 |
| `lens charge on/off` | 형식 전하 표시(기본 on) |
| `lens attract on/off` | 분자 사이 인력(수소 결합 등) 점선 (interface는 기본 on) |
| `lens numbers on/off` | 원자 추적 번호 |
| `lens oxidation on/off` | 산화수(원자 옆 보라색 숫자). 산화·환원 장면에 켠다 |
| `crowd H2O in water 40` | 배경 용매 분자를 흐리게 깐다(최대 160) |
| `crystal s = NaCl at bottom 5x3` | 이온 결정. 전하 크기가 같은 양이온·음이온 짝이면 된다: NaCl, KBr, AgCl, CaCO3(석회암), CaSO4, MgCO3 … 두 이온을 직접 적어도 된다(`crystal s = Ca2+ CO32- at water 6x2`). 이온은 체스판처럼 번갈아 놓이고, 이름은 왼쪽 위부터 줄마다 `s1`, `s2`, …(`s1`이 양이온), 원자는 `s2.O1`처럼. 다원자 이온은 바깥 원자 하나가 위를 향한다(CO32-는 `O1`) |
| `mol w = H2O at center` | 이름 있는 분자. 위치: `at 구역`(가운데), `in 구역`(빈 곳 아무 데나), `at 300,200`, `near a right/left/above/below`, `on clay [in topsoil]`(soil 전용, 양이온만) |
| `mol c x3 = Ca2+ in left` | 여러 개 → `c1`, `c2`, `c3` |
| `place Na+ in left x5` | 이름 없이 여러 개. 나중에 화학식(`Na+`)으로 가리킨다 |

`mol`·`place`를 step 안에 쓰면 그 단계에서 나타난다.

## 등록된 분자

H2O, H3O+, OH-, NH3, NH4+, CH4, HCl, HF, HBr, HI, H2S, H+, Li+, Na+, K+, Mg2+, Ca2+, Al3+, F-, Cl-, Br-, I-, H2, O2, N2, F2, Cl2, Br2, I2, CO2.
라디칼(홑전자 `·`): H·, Cl·, Br·, OH·, CH3·. 금속 원자와 이온: Li, Na, Zn, Zn2+, Cu, Cu2+, Ag, Ag+.
더 큰 분자(이름으로 쓴다): Gly(글라이신), Ala(알라닌), CH3OH, C2H5OH, CH3COOH, CH3COO-, CH3Br, CH3Cl, C2H4, C6H6(벤젠), C6H12O6(포도당 고리형), H2CO3, HCO3-, CO32-(또는 CO3--), NO3-, H3PO4, H2PO4-, SO42-, H2O2, EC(에틸렌 카보네이트, 전지 전해질 용매), ADP, ATP(아데노신 부분은 `Ad` 공 하나로 줄여 그린다. 인산 사슬은 그대로: ADP = `[Ad]OP(=O)([O-])OP(=O)([O-])O` → Ad, O1, P1, O2, O3, O4, P2, O5, O6, O7(끝 OH), H1).
세포 에너지 장면 예: `condensation p.P d.O7`(인산 H2PO4- + ADP → ATP + 물), 되돌릴 때 `hydrolysis p.P~d.O7`.
`Ca++`, `Ca+2`도 `Ca2+`로 읽고, `Cl.`, `Cl*`도 `Cl·`로 읽는다.

**목록에 없는 분자는 SMILES로 쓴다**: `mol x = smiles:CC(=O)OC at center`.
- 지원: 유기 부분집합(B C N O P S F Cl Br I), 대괄호 원자(`[NH4+]`, `[O-]`, `[Cu+2]`), 가지 `( )`, 고리 번호, 이중 `=`·삼중 `#` 결합, 방향족 소문자(자동으로 이중 결합 배치). 수소는 자동으로 붙는다. 입체 표시(`@`, `/`, `\`)는 무시한다. 점(`.`)으로 나뉜 SMILES는 분자마다 따로 쓴다.
- **원자 이름은 SMILES에 나온 순서**: 원소 기호 + 그 원소의 번호(C1, C2, O1…). 그 원소가 하나뿐이면 번호 없이(N). 수소는 붙은 원자 순서대로 H1, H2…
  예: `Gly` = `NCC(=O)O` → N, C1(α 탄소), C2(카복실 탄소), O1(=O), O2(OH의 O); H1·H2는 N, H3·H4는 C1, H5는 O2에 붙어 있다.
- 이름이 헷갈리면 `note`를 붙여 보거나, 앱에서 `lens numbers on`으로 번호를 확인한다. 이름을 잘못 쓰면 앱이 "있는 원자: …" 목록과 함께 오류를 낸다.

## 기본 동작 (step 안)

### 결합 변화 (화학 반응)

| 명령 | 화면 |
|---|---|
| `arrow w.O:lp -> w.O~a.H` | 전자쌍 하나가 굽은 화살표를 따라 이동. 출발은 `원자:lp` 또는 `원자~원자`, 도착은 원자 또는 새 결합 |
| `transfer a.H to w.O` | 양성자 이동. `arrow (받는 원자):lp -> 새 결합`과 `arrow H~옛 짝 -> 옛 짝` 두 줄로 펼쳐진다 |

규칙: 비공유 전자쌍은 그 원자가 포함된 결합으로만 간다. 결합의 전자쌍은 그 결합의 두 원자 중 하나로, 또는 그 원자가 포함된 새 결합으로만 간다.
생성물 구조, 형식 전하, 분자 모양은 앱이 계산한다. 한 단계가 끝날 때 H가 전자 2개, 2주기 원소가 8개를 넘으면 오류.

### 축합·가수분해 (물이 빠지며 결합 / 물이 들어가며 분해)

| 명령 | 화면 |
|---|---|
| `condensation g1.C2 g2.N` | 첫 원자에 붙은 -OH와 둘째 원자에 붙은 H가 물 분자가 되어 떨어져 나가고, 두 원자가 결합한다(펩타이드 결합, 에스터, 글리코사이드 결합 등). 먼저 `approach g2.N g1.C2`로 가까이 두면 보기 좋다 |
| `hydrolysis g1.C2~g2.N` | 가장 가까운 물 분자가 들어가 결합을 깬다: OH는 첫 원자로, H는 둘째 원자로. `with w`로 물 분자를 고를 수 있다 |

전자 화살표 없이 전체 반응(순 반응)으로 그린다. 단계별 메커니즘이 필요하면 `arrow`·`transfer`로 직접 쓴다.

### 막 수송 (membrane 무대)

| 명령 | 화면 |
|---|---|
| `protein k = channel K+ at 330` | (첫 step 앞) x=330에 K+ 통로 단백질. `channel H2O`는 물 통로(아쿠아포린) |
| `protein p = pump at 680` | (첫 step 앞) 펌프 단백질. 전자 전달계처럼 H+를 퍼 올리는 단백질도 이것으로 그린다 |
| `protein a = synthase at 700` | (첫 step 앞) ATP 합성 효소: H+ 통로와 안쪽(기질 쪽) 머리 |
| `cross 3 H+ via a` | 같은 통과를 3번 차례로 |
| `cross K+ via k` | K+ 하나가 통로를 지나 반대쪽으로(화학식이면 그 입자가 더 많은 쪽에서 출발 = 확산). 수화 껍질은 입구에 남는다. `via` 없이 쓰면 막을 바로 통과(O2, CO2 같은 작은 분자) |
| `pump p 3 Na+ out 2 K+ in` | 펌프로 능동 수송: 안쪽 Na+ 3개가 밖으로, 그다음 바깥 K+ 2개가 안으로 |
| `osmosis 4` | 물 분자 4개가 용질이 적은 쪽에서 많은 쪽으로 건너간다(물 통로가 있으면 그곳으로). 4개 이상이면 반대로 가는 분자도 조금 그린다 |

### 전지 (cell 무대)

| 명령 | 화면 |
|---|---|
| `electrode left = Zn` / `electrode right = Cu` | (첫 step 앞) 금속 원자로 된 전극판. left가 산화 전극(−), right가 환원 전극(+) |
| `oxidize left` | 판 표면의 금속 원자가 전자를 판에 남기고 이온이 되어 용액으로 나간다(물이 있으면 수화) |
| `wire 2` | 판에 남은 전자 2개가 도선을 따라 환원 전극으로 간다(전류) |
| `reduce c at right` | 용액의 금속 이온이 판 표면으로 와서 판의 전자를 얻고 금속 원자가 되어 판의 일부가 된다. 판에 전자가 모자라면 오류 |
| `bridge Cl- K+ x2` | 염다리에서 음이온은 왼쪽, 양이온은 오른쪽 용액으로 들어가 전하를 맞춘다 |

앱은 전극마다 남은 전자 수를 센다(판 위쪽 분홍 점). 순서: oxidize → wire → reduce → bridge.

### 리튬 이온 전지 (battery 무대)

| 명령 | 화면 |
|---|---|
| `load cathode 10` / `load anode 3` | (첫 step 앞) 전극의 층 사이에 리튬을 넣어 둔다. 양극에서는 Li+, 흑연에서는 전자를 품은 Li(점 하나) |
| `charge 4` | 충전: 양극의 Li+ 4개가 전해질과 분리막을 지나 흑연 층 사이로 들어가고, 전자 4개가 도선으로 양극에서 음극으로 간다 |
| `discharge 4` | 방전: 흑연 속 리튬이 전자를 도선으로 내보내고 Li+가 되어 양극으로 간다 |
| `sei 1` | 흑연 표면에서 전해질이 분해되며 막(SEI)이 생기고 리튬 1개가 그 안에 갇힌다(다시 못 쓴다). 전해질 용매(`crowd EC in electrolyte 5`)가 있으면 하나가 막에 닿으며 사라진다. charge와 같은 단계에 써도 된다 |

무대 아래 띠에 흑연·산화물·SEI 속 리튬 수와 '쓸 수 있는 리튬 n/전체'가 늘 표시된다(용량 감소를 보여 줄 때 쓴다).

### 배위 결합 (금속 착이온)

| 명령 | 화면 |
|---|---|
| `ligand n.N -> c.Cu` | n.N의 비공유 전자쌍이 Cu와 배위 결합을 만든다(결합선 가운데 화살촉이 금속 쪽). 금속의 전하는 그대로(+2) 남고 리간드 원자는 0 |
| `unligand c.Cu~n.N` | 배위 결합이 없어지고 전자쌍은 다시 리간드 원자의 비공유 전자쌍이 된다(리간드 교환에 쓴다) |

예: `mol n1 = NH3 at 320,310` 처럼 금속 둘레에 리간드를 놓고 `approach n1.N c.Cu` → `ligand n1.N -> c.Cu`.

### 전자 하나의 이동 (산화·환원, 라디칼)

| 명령 | 화면 |
|---|---|
| `hop z.Zn -> c.Cu` | 전자 하나가 반쪽 화살촉 화살표를 따라 이동. 출발이 원자면 홑전자부터, 없으면 비공유 전자쌍에서 하나 |
| `hop 2 z.Zn -> c.Cu` | 같은 이동을 두 번(전자 두 개) |
| `hop x.Cl:e -> ...` / `hop x.O:lp -> ...` | 홑전자(`:e`) 또는 비공유 전자쌍(`:lp`)에서 하나를 콕 집어 옮긴다 |
| `hop c.Cl1~c.Cl2 -> c.Cl1` | 결합 전자 둘 중 하나가 원자로. 결합을 깨려면 같은 단계에 나머지 하나도 옮긴다(균일 분해) |
| `hop x.Cl -> x.Cl~m.H1` | 전자 하나가 새 결합(또는 있던 결합)으로. 새 결합은 같은 단계에 전자가 하나 더 와야 완성된다 |
| `light c` | 빛(hν)이 물결선으로 날아와 흡수된다. 같은 단계의 hop과 함께 쓴다 |

한 단계가 끝날 때 전자가 홀수 개(1개)인 결합이 남으면 오류. 원자의 홑전자는 앱이 짝짓는다(홑전자에 전자가 오면 비공유 전자쌍이 된다).
예: 산화·환원 `hop 2 z.Zn -> c.Cu` (Zn → Zn2+, Cu2+ → Cu), 라디칼의 수소 떼어 가기
`hop x.Cl -> x.Cl~m.H1` · `hop m.C~m.H1 -> x.Cl~m.H1` · `hop m.C~m.H1 -> m.C`.

### 분자 움직임

| 명령 | 화면 |
|---|---|
| `approach w.O a.H` | w가 다가와 w.O의 비공유 전자쌍(라디칼이면 홑전자)이 a.H를 향한다 (반응 직전 단계에 쓴다) |
| `move w to right` / `move w to 300,200` / `move w near a` | 그대로 이동 |
| `diffuse a b to right` | 무작위로 움직이며 목표 구역으로 (경로가 점선으로 남는다) |
| `spread Na+ Cl- in water` | 해당 입자가 모두 무작위로 움직여 구역 전체로 퍼진다(확산) |

### 용매·상태 변화

| 명령 | 화면 |
|---|---|
| `solvate a` / `solvate all` | 배경 물 분자가 이온을 둘러싼다(수화 껍질). 양이온에는 O가, 음이온에는 H가 향한다. 껍질은 이온과 함께 움직인다 |
| `dissolve 2 from s` | 결정 모서리 이온이 물 분자에 둘러싸여 떨어져 나간다. `dissolve s3 s4 from s`처럼 녹일 이온을 고를 수 있다(산이 H+를 준 표면 이온 등) |
| `evaporate H2O` | (interface) 수면에 가장 가까운 물 분자가 공기로 나간다 |
| `condense H2O` | (interface) 공기 중 물 분자가 액체로 내려온다 |
| `heat water` / `cool water` | 그 구역 입자 움직임이 빨라진다/느려진다 |
| `precipitate Ag+ Cl- x3` | 녹아 있던 양이온·음이온 짝이 물을 떨치고 고체 결정(침전)을 이룬다. `onto s`로 있던 결정의 빈 곳부터 채운다. 전하 크기가 같은 짝만(Ca2+ CO32- 등 다원자 이온도 된다) |
| `freeze water` / `melt water` | 그 구역의 배경 물 분자가 육각형 수소 결합 그물(얼음)로 규칙적으로 이어진다 / 그물이 흐트러지며 녹는다. `lens attract on`과 함께 쓴다 |
| `gas-in CO2` / `gas-out CO2` | (interface) 공기 중 기체 분자가 수면 아래로 녹아든다 / 녹아 있던 기체 분자가 공기로 빠져나간다 |
| `boil 3` | (interface) 액체 속에 기포가 생겨 물 분자 3개(2~6)를 품고 떠올라 수면에서 터진다 |

### 토양 (soil)

| 명령 | 화면 |
|---|---|
| `exchange c with 2 H+ on clay` | 흡착된 c가 떠나고 H+ 2개가 그 음전하 부위를 차지. **전하 합이 같아야 한다** (Ca2+ ↔ 2 H+). 물속에 이미 그 이온(예: 펌프가 내보낸 H+)이 있으면 가까운 것부터 쓰고, 없으면 새로 들어온다. soil과 root 무대에서 쓴다 |
| `leach c from topsoil to subsoil` | 씻겨 내려감(용탈). 빗물이 공극으로 흐르고, 물 분자가 c를 둘러싸고, c가 물과 함께 아래 구역으로 이동. 흡착돼 있었다면 떨어져 나온다 |
| `rain` | 빗물이 모든 공극을 따라 흐른다 |

### 집단 모드 (화학 평형)

분자 하나하나의 화살표 대신, 많은 분자가 한꺼번에 부딪치며 반응하는 모습을 그린다.

| 명령 | 화면 |
|---|---|
| `ensemble H2 + I2 <=> 2 HI for 10s` | 장면의 해당 분자가 모두 날아다니며 부딪치고, 맞는 짝이 부딪치면 결합이 바뀐다. `<=>`는 역반응(HI + HI)도 일어나고 `->`는 정반응만. 반응한 곳에 고리가 잠깐 번지고, 무대 오른쪽 위에 종류별 분자 수 그래프가 그려진다. 시간은 3~15초 |

- 준비: `stage gas`, `place H2 in air x10`, `place I2 in air x10`처럼 분자를 이름 없이 여럿 놓는다(합 16~28개가 보기 좋다).
- 지금은 X2 + Y2 <=> 2 XY 꼴만 된다: H2 + I2, H2 + Cl2, H2 + Br2, H2 + F2 (생성물 HI·HCl·HBr·HF).
- 평형 이동(르 샤틀리에)은 단계를 나눠 쓴다: `ensemble …`으로 평형에 이른 뒤, 다음 단계에 `place H2 in air x4`로 반응물을 더하고 그다음 단계에 다시 `ensemble …`.

### 설명

| 명령 | 화면 |
|---|---|
| `energy -57 kJ/mol` | 오른쪽 위 에너지 그래프에서 이 단계 동안 에너지가 57만큼 내려간다(발열, 음수) / 올라간다(흡열, 양수). 단계마다 이어서 그려지고, 한 번 적은 단위는 계속 쓴다 |
| `energy -57 kJ/mol barrier 40` | 출발점보다 40 높은 언덕(활성화 에너지)을 넘어 내려간다. 촉매를 비교할 때 같은 반응을 barrier만 바꿔 두 번 그린다 |
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
- 여러 현상이 이어지는 자연 현상(석회 동굴, 산성비 등)은 한 장면에서 단계를 이어 쓴다. 예시 '석회 동굴과 종유석'(`#/x/limestone`)이 기체 녹아듦 → 화살표 → 양성자 이동 → 용해 → 역반응 → 석출을 한 대본에 잇는 예다.
- 화살표는 실제 메커니즘대로 쓴다. 앱은 전자 수와 전하만 검사하고, 반응이 실제로 일어나는지는 판단하지 않는다.
- 앱이 아직 못 그리는 것(SMILES로도 적기 어려운 분자, 금속 결합의 띠 구조, 효소 반응의 3차원 구조 등)은 억지로 흉내 내지 말고 사용자에게 그 사실을 말한다.
