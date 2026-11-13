허용된 세 파일만 수정했습니다. 커밋·push는 하지 않았습니다.

- [compile.ts](/E:/Project/chemvis/src/engine/compile.ts): 결합을 유지하는 조각 이동, 짧고 빠른 원자 전달, 치환 접근 자세, 축합 접촉 배치, 완성된 물의 공동 60 이동, 가수분해 우회를 구현했습니다.
- [timeline.ts](/E:/Project/chemvis/src/engine/timeline.ts): 렌더러와 같은 순수 보간 함수를 내보냈습니다.
- [motion.test.ts](/E:/Project/chemvis/tests/unit/motion.test.ts): 9개 장면의 동선·화학 상태·기존 출력 보존 검사를 추가했습니다.

최종 `npm.cmd test` 결과입니다.

```text
Test Files  13 passed (13)
     Tests  608 passed | 1 todo (609)
```

`npx.cmd tsc --noEmit`: 출력 없이 종료 코드 `0`입니다. 기존 523개도 모두 통과했습니다.

판단이 필요했던 부분은 두 곳입니다. 원자 ID를 유지하려고 축합·가수분해에서는 기존 배치로 선택 결과를 먼저 계산합니다. 또한 가지가 교차하지 않도록 축합 준비 각도 일부를 설계안에서 조정했습니다.

Claude는 추가 컴파일 비용과 렌더러의 네 `shifts` 동기화를 검토하면 됩니다. 전자쌍 도형의 두께·소유 관계를 이용한 충돌 검사는 `it.todo`로 남겼습니다. 원자 동선 검사는 통과했지만, 전자쌍 교차와 실제 브라우저 화면까지 검증한 것은 아닙니다.