복원했다. 이번 작업에서는 [src/engine/compile.ts:1001](E:/Project/chemvis/src/engine/compile.ts:1001)만 수정했다. 커밋·push는 하지 않았다.

- `tight: false`이면 HEAD의 표본·시간 배치·회전 계산을 사용하도록 복원했다.
- 튜토리얼 25장과 예시 5개의 전체 출력(타임라인 포함)을 메모리에서 비교했다. `compile(src)`와 `tight: false` 모두 HEAD `d8922d8`과 30/30 일치했다.
- `tight: true`도 같은 30개 장면에서 수정 전 출력과 전부 일치했다.
- 기준 해시는 변경하지 않았고, `legacy compile output` 검사가 통과했다.

검사 결과:
```text
npm.cmd test
Test Files  10 passed (10)
     Tests  256 passed (256)
종료 코드: 0

npx.cmd tsc --noEmit
출력 없음
종료 코드: 0
```

판단이 필요했던 곳은 `finishStep`이었다. 끝난 경로 처리가 이미 `this.tight`로 구분되어 있어 수정하지 않았다. 전체 출력 비교에서도 추가 차이는 없었다.

Claude는 `moveGroup`에 추가한 조건 분기와 HEAD에서 가져온 `else` 경로를 검토하면 된다. 다른 파일의 기존 변경은 그대로 보존했다.