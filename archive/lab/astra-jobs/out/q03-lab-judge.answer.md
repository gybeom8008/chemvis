허용된 네 파일만 추가했습니다. 기존 변경은 건드리지 않았고 커밋·push도 하지 않았습니다.

- [stage1-data.ts](E:/Project/chemvis/src/lab/stage1-data.ts): 재료·수치·사건·부정 인증·120행 자료
- [judge.ts](E:/Project/chemvis/src/lab/judge.ts): 조건·맥락·경쟁·부족 판정, 원자 ID 예약과 생성물 계획
- [lab-judge.test.ts](E:/Project/chemvis/tests/unit/lab-judge.test.ts): 검사 203개 추가
- [lab-judge.md](E:/Project/chemvis/docs/plan/lab-judge.md): 함수 계약과 화면·엔진 연결 지침

검사 결과:
```text
npm.cmd test
 Test Files  11 passed (11)
      Tests  459 passed (459)
   Start at  23:53:27
   Duration  4.43s (tests 80%, transform 11%, import 8%, worker 1%)

npx.cmd tsc --noEmit
출력 없음, 종료 코드 0
```
기존 검사와 추가 검사 모두 통과했습니다.

판단이 필요했던 곳은 문서에 기록했습니다. 3판의 좁은 부정 맥락을 우선했고, Br⁻가 있는 P01은 단계 1에서 `CONTEXT_UNREVIEWED`로 처리했습니다. 자료는 `draft`를 유지하며 계획은 `preflight`, `canExecute: false`로 반환합니다.

Claude는 현재 그래프를 요약하는 경계, 금속 몸체 전체 재고, 실제 H ID 치환, 컴파일 후 보존 검사와 적용 직전 revision 확인을 검토하면 됩니다. 외부 출처 재대조와 화면 검증은 수행하지 않았습니다.