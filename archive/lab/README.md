# 실험실: 중단하고 보관한 것

2026-11-14에 윤범님이 실험실을 **무기한 중단**하기로 했다. 제대로 만들려면 지금 들이는 것보다 훨씬 많은 자원이 든다는 판단이다. 버리지 않고 여기에 모아 둔다. 다시 시작하라는 말이 있기 전에는 이 폴더를 고치지 않는다.

여기 있는 것은 어느 것도 앱 화면에 연결된 적이 없다. 이 폴더는 빌드와 검사에 들어가지 않는다(`tsconfig.json`과 `vitest.config.ts`가 `src`, `tests/unit`만 본다).

## 어디까지 했나

| 무엇 | 어디 | 상태 |
|---|---|---|
| 설계서 원문(Astra) | [docs/lab-astra.md](docs/lab-astra.md) | 끝 |
| Astra와 정한 것 | [docs/lab-decisions.md](docs/lab-decisions.md) | 여섯 가지 모두 정함. 설계서와 다르면 이 문서를 따른다 |
| 단계 1 자료 행(재료 15종, 반응 8개, 조합 120개) | [docs/lab-rows-stage1.md](docs/lab-rows-stage1.md) | 3판, draft. 1판의 수치와 유도값만 Claude가 출처 원문과 대조했다. 2·3판에서 바뀐 행은 대조하지 않았다 |
| 단계 2 자료 행(아세트산, K⁺, Br⁻ 등) | [docs/lab-rows-stage2.md](docs/lab-rows-stage2.md) | 미리 쓴 초안. 대조하지 않았다 |
| 판정기와 단계 1 자료(코드) | [src/stage1-data.ts](src/stage1-data.ts), [src/judge.ts](src/judge.ts), [docs/lab-judge.md](docs/lab-judge.md) | 검사 203개가 통과하던 상태 |
| 분자 조립 자료와 대본(코드) | [src/assembly-data.ts](src/assembly-data.ts), [src/assembly-script.ts](src/assembly-script.ts), [docs/lab-assembly.md](docs/lab-assembly.md) | 검사 183개가 통과하던 상태 |
| 반응 여덟 개를 엔진으로 실행해 보는 검사 | [tests/lab-rows.test.ts](tests/lab-rows.test.ts) | 14개가 통과하던 상태 |
| 화면 명세 | [docs/lab-ui.md](docs/lab-ui.md) | 손으로 해 볼 시험 72개 포함. 구현 없음 |
| 처음 초안, 의뢰서, 클라우드 세션의 검토 | [docs/lab.md](docs/lab.md), [docs/lab-brief.md](docs/lab-brief.md), [docs/lab-review.md](docs/lab-review.md) | 참고 |
| Astra에게 준 지시문과 받은 답 | [astra-jobs/](astra-jobs/) | 기록 |

엔진에 들어간 것은 그대로 남아 있고 지금도 쓰인다: 있던 상태에서 이어서 컴파일하기(`compileFrom`, `addSpecies`), 고른 이온만 침전(`precipitate using`), 금속 조각(`metal`, `land`, `join`, `leave`). 검사는 `tests/unit/compile-from.test.ts`, `tests/unit/solids.test.ts`에 있다.

## 다시 시작하려면

1. `src/`의 네 파일을 `src/lab/`로, `tests/`의 네 파일을 `tests/unit/`으로 되돌린다(import 경로가 그 위치를 기준으로 쓰여 있다). `git mv`로 옮기면 된다.
2. `npm test`로 그사이 엔진이 바뀌어 깨진 곳을 찾는다. 보관할 때의 커밋은 이 파일이 생긴 커밋이다.
3. [docs/lab-decisions.md](docs/lab-decisions.md)의 8절(단계 0에서 통과해야 하는 것)과 [docs/lab-ui.md](docs/lab-ui.md)부터 읽는다.
4. 자료 행은 공개 전에 쓴 모델과 다른 모델이 출처 원문과 대조해야 한다(같은 문서 5절).
