# chemvis

AI가 짧은 **장면 대본**만 쓰면 화학 반응과 물질 현상을 원자·전자 수준의 애니메이션으로 그려 주는 웹앱이에요.
AI는 HTML·SVG를 매번 새로 만들지 않고 대본 수십 줄만 쓰면 돼요. 원자 배치, 그리기, 움직임, 생성물 계산, 검산은 앱이 맡아요.

- 앱: https://gybeom8008.github.io/chemvis/
- AI용 대본 안내서: https://gybeom8008.github.io/chemvis/ai-guide.md (`public/ai-guide.md`)

## 대본 예

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

대본은 주소의 `#` 뒤에 실려 전달돼요(`#z=` 압축, `#s=` 그대로). 브라우저는 `#` 뒤를 서버로 보내지 않으니, 어떤 장면을 봤는지는 어디에도 남지 않아요.

## 구성

| 경로 | 하는 일 |
|---|---|
| `src/dsl/parser.ts` | 대본을 줄 단위 명령과 단계로 나눔 |
| `src/engine/compile.ts` | 명령마다 무엇이 어디로 움직이는지 계산, 생성물·전하·전자 수 검사 |
| `src/chem/` | 원소 정보, 등록 분자, 2D 분자 모양(VSEPR을 평면에 옮긴 각도), 비공유 전자쌍 위치 |
| `src/stage/stages.ts` | 무대: 용액, 수면, 토양 단면(공극·점토·음전하 부위) |
| `src/render/view.ts` | 한 순간을 SVG로 그림(원자, 결합, 전자쌍, 전하, 옮겨 가는 전자와 그 전자가 만들거나 깨는 결합, 설명 상자, 카메라) |
| `src/tutorial/chapters.ts` | 튜토리얼 장. 각 장 대본은 AI 예시이자 자동 시험 대상 |

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm test         # 단위 시험 (vitest)
npm run build    # 타입 검사 + 빌드 → dist/
npx playwright test   # 파이어폭스·크로미움에서 튜토리얼 전체 재생 시험
```

`main`에 올리면 GitHub Actions가 빌드하고, 파이어폭스·크로미움 최신 엔진으로 시험한 뒤 GitHub Pages에 배포해요.

## 다음 단계

- 남은 기본 동작: 배위 결합, 막 수송, 삽입, 빛 방출, 전극
- 남은 무대: 막, 전극, 효소 활성 부위, 다공성 고체
- SMILES로 임의의 분자 쓰기(RDKit.js), 고리 화합물
- 집단 모드(평형·반응 속도), 에너지 준위 렌즈
