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

대본은 주소의 `#` 뒤에 적혀서 전달돼요(`#z=` 압축, `#s=` 그대로). 브라우저는 `#` 뒤를 서버로 보내지 않으니, 어떤 장면을 봤는지는 어디에도 남지 않아요.

## 화면

- **학습**: 원자와 전자쌍을 읽는 법부터 산·염기, 산화·환원, 유기 반응, 평형까지 차례로 보는 수업이에요.
- **시연**: AI가 쓴 장면이나 예시 장면을 재생해요. 대본을 그 자리에서 고쳐 볼 수 있어요.
- **실험실**: 지금은 비어 있어요.

## 구성

| 경로 | 하는 일 |
|---|---|
| `src/dsl/parser.ts` | 대본을 줄 단위 명령과 단계로 나눔 |
| `src/engine/compile.ts` | 명령마다 무엇이 어디로 움직이는지 계산, 생성물·전하·전자 수 검사 |
| `src/chem/` | 원소 정보, 등록 분자, SMILES, 2D 분자 모양, 반응열, 화학식 조판 |
| `src/stage/stages.ts` | 무대: 용액, 수면, 흙, 막, 전극, 전지 |
| `src/render/` | 한 순간을 SVG로 그림. 전자쌍 방식(`pairs.ts`)이 기본 |
| `src/ui/`, `src/main.ts` | 무대와 자막, 조작 줄, 범례, 탭, 대본 서랍 |
| `src/tutorial/` | 수업과 예시. 각 대본은 AI 예시이자 자동 검사 대상 |
| `src/compare/` | 그리는 방식을 견주는 비교 화면(`/concept/`) |

## 개발

```bash
npm ci
npm run dev      # 개발 서버
npm test         # 단위 검사 (vitest)
npm run build    # 형식 검사 + 빌드 → dist/
npm run e2e      # 파이어폭스·크로미움에서 수업과 예시 전체 재생 검사(빌드 뒤)
```

`main`에 올리면 GitHub Actions가 빌드하고, 파이어폭스·크로미움으로 검사한 뒤 GitHub Pages에 배포해요.

지금 상태와 남은 일은 [docs/plan/handover.md](docs/plan/handover.md)에 있어요.
