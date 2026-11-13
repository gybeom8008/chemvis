지정한 세 파일만 작성했다. 기존 작업은 수정하지 않았고 커밋·push도 하지 않았다.

- [assembly-data.ts](E:/Project/chemvis/src/lab/assembly-data.ts): 원소·분자 자료, 그래프 동형 판정, 조작 검사, 결과 판정.
- [assembly-data.test.ts](E:/Project/chemvis/tests/unit/assembly-data.test.ts): 인수 사례 64개를 포함한 **119개 검사 모두 통과**.
- [lab-assembly.md](E:/Project/chemvis/docs/plan/lab-assembly.md): **draft**, 규칙·문구·인수 표·실행 출력·엔진 대본과 인계 사항.

검사 결과는 다음과 같다.

- `npm.cmd test`: **255개 통과, 1개 실패**. 알려 준 `legacy compile output` 실패만 남았으며 수정하지 않았다.
- `npx.cmd tsc --noEmit`: **통과**, 출력 없음.
- 열다섯 분자 모두 현재 엔진의 `hop ...:e`로 조립되는 것을 확인했다.

판단한 부분은 차단 이유가 겹칠 때 홑전자 없음을 우선하고 원자가 초과를 방어 검사로 둔 점, 결과를 연결 성분 하나씩 판정하도록 한 점이다.

Claude는 한국어 이름과 새 차단 문구, 차단 우선순위, O₂의 연결 성분 범위, **두 `:e` 명령을 같은 단계에 넣는 방식과 `pulls` 차단**을 검토하면 된다.