<일: 기존 화면의 움직임을 원래대로 되돌리기>
네가 앞서 한 코드 검토(P0)대로, `tight`가 꺼진 기존 `compile`의 움직임이 바뀐 것을 되돌린다.

- 원인: src/engine/compile.ts의 `moveGroup`이 `this.tight`와 무관하게 표본 수·시간 배치·회전 보간을 바꿨다.
- 할 일: `moveGroup`에서 `this.tight`가 거짓이면 HEAD(커밋 d8922d8)의 구현과 키프레임이 정확히 같게 나오도록 기존 경로를 복원하고, 새 보간(`along`, `turnBy`, N 표본)은 `this.tight`일 때만 쓴다. 그 밖에 `tight`가 꺼졌을 때 출력을 바꾸는 곳이 더 있으면 같은 방식으로 막는다(`finishStep`의 끝난 경로 처리 등 확인).
- 완료 기준: tests/unit/compile-from.test.ts의 "legacy compile output" 검사가 통과한다. 기준 해시를 새 출력으로 바꾸지 마라. 튜토리얼 25장과 예시 다섯의 `compile(src)` 출력(타임라인 전체)이 HEAD와 같은지 메모리에서 비교해 확인하고 결과를 적는다. `tight: true` 경로의 동작은 바꾸지 마라.

고쳐도 되는 파일: src/engine/compile.ts 하나.
</일>
