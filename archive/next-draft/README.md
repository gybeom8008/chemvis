# 보관: 세 탭 화면의 첫 시안 (2026-11-10)

`src/next/`에 있던 시안이다. 어느 페이지에도 연결된 적이 없고, 2026-11-19에 여기로 옮겼다. 반응 표현이 먼저라서 미뤄 둔 것이고, 그 뒤 화면은 다른 방향으로 정해졌다(학습은 시연 화면에 수업 목록만 더한 것, 2026-11-17).

| 파일 | 내용 |
|---|---|
| `course.ts` | 8단원 51수업의 자료([curriculum.md](../../docs/plan/curriculum.md)와 [lessons/](../../docs/plan/lessons/README.md)를 앱에서 읽는 형식) |
| `learn-lesson.ts` | 수업 화면: 예측 질문(고르기, 끌어 놓기), 정리, 다음 수업 |
| `learn-map.ts` | 교육 과정 지도: 단원과 수업, 진도 |
| `main.ts`, `next.css`, `util.ts` | 위 화면을 띄우는 진입점, 모양, 도움 함수 |

옮기면서 경로를 고치지 않았으므로 `../render/…` 같은 가져오기는 여기서 풀리지 않는다. 다시 쓸 때는 `src/` 아래로 옮기고 경로를 맞춘다. 비교 화면에 쓰이던 `compare.ts`, `compare.css`, `stage.ts`는 `src/compare/`로 옮겼다.
