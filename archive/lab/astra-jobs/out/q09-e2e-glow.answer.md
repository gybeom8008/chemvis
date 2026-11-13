[tests/e2e/glow.spec.ts](/E:/Project/chemvis/tests/e2e/glow.spec.ts)만 새로 작성했습니다. 다른 소스 파일은 수정하지 않았고, 커밋·push도 하지 않았습니다.

검사 결과는 다음과 같습니다.

- `npm.cmd run build`: 종료 코드 0
- `npm.cmd test`: `Test Files 13 passed (13)`, `Tests 617 passed | 1 todo (618)`
- `npx.cmd tsc --noEmit`: 출력 없음, 종료 코드 0
- `npx.cmd playwright test --project=chromium tests/e2e/glow.spec.ts`: `1 skipped`, `10 passed (1.3m)`

판단이 필요했던 부분은 금속 전자 집계와 재생 위치 확인입니다. 전자는 건너가는 점을 포함해 `.pe:not([data-a])`로 세고, 재생 위치는 단계 설명과 시간 슬라이더 값으로 비교했습니다.

Claude가 검토할 곳은 금속 **2단계 전자 보존 검사**입니다. `seek(2, 0.3)`에서 보이는 전자 점이 **12개 대신 14개**임을 확인했습니다. 코드상 `seaPlan()`이 도착할 점을 `stay`에 남겨 이동 중인 점과 함께 그리는 것이 원인으로 판단됩니다. 해당 검사만 `test.fixme`로 남겼으며, 그리기 코드는 수정하지 않았습니다.