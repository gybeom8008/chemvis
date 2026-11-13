완료했다. 기준 커밋은 `fe62d92`이며, 커밋·push는 하지 않았다. 허용된 세 파일만 변경했다.

- [compile.ts](E:/Project/chemvis/src/engine/compile.ts): 물이 닿은 뒤 함께 용해되도록 수정했다. 침전은 접근 → 물 이탈 → 한 쌍으로 정착하는 순서로 바꿨다. `onto`는 가장 가까운 빈 이웃 자리를 선택한다. 같은 단계의 `hop`과 `leave`도 연동했다.
- [timeline.ts](E:/Project/chemvis/src/engine/timeline.ts:36): 기존 렌더러와 같은 홑전자 진행률 계산을 추가했다.
- [motion.test.ts](E:/Project/chemvis/tests/unit/motion.test.ts:39): 순서·거리·배향·화학 상태 보존을 검사하는 테스트 10개를 추가했다.

`npm.cmd test` 결과는 다음과 같다. 종료 코드는 0이다.

```text
 Test Files  13 passed (13)
      Tests  627 passed | 1 todo (628)
   Start at  03:53:46
   Duration  7.51s (tests 83%, import 14%, transform 3%, worker 1%)
```

`npx.cmd tsc --noEmit`은 종료 코드 0, 출력 없음이다. 기존 `legacy compile output` 검사도 통과했다. 실패는 없으며, `todo` 하나는 기존 항목이다.

판단이 필요했던 부분은 화면 거리 기준이다. 침전에서는 접촉 거리보다 40만큼 떨어진 곳부터 물을 65만큼 물린다. Zn은 첫 전자가 출발하기 전에는 정지하고, 전자가 이동하는 동안 최대 4만큼 나온 뒤 완전히 떨어진다. 이는 시각화 기준이며 실제 힘·에너지 계산은 아니다.

Claude는 `src/next/compare.ts`에서 기존 금속 장면의 마지막 두 단계를 아래 한 단계로 바꾸면 된다. 해당 파일은 수정하지 않았다.

```text
step "전자가 은 이온으로 건너가면서 아연이 빠져나와요. 전자를 받은 은은 표면에 붙어요"
  hop m4.Zn -> a1.Ag
  hop m4.Zn -> a2.Ag
  join a1 a2 to m
  leave m4 from m
```

Claude가 검토할 곳은 실제 재생에서 물의 접촉·이탈이 충분히 보이는지, Zn의 초기 이동량 4가 잘 드러나는지다. 좌표와 화학 상태는 수치로 확인했으며, 화면 재생은 직접 확인하지 않았다. 전자 진행률 함수는 기존 렌더러 식을 따로 옮긴 것이므로, 렌더러 타이밍을 바꿀 때 함께 맞춰야 한다.