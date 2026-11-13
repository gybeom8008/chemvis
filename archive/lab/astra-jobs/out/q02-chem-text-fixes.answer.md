기존 수정 문장을 유지하고 남은 설명을 보완했습니다. 커밋·push는 하지 않았습니다.

- 바꾼 파일: [chapters.ts](/E:/Project/chemvis/src/tutorial/chapters.ts), [curriculum.md](/E:/Project/chemvis/docs/plan/curriculum.md), 새 [chem-review.md](/E:/Project/chemvis/docs/plan/chem-review.md).
- 검토 문서에 46건 반영 내역과 후속 작업 17개를 기록했습니다.
- 대본 명령은 그대로이며, 다른 파일은 변경·삭제하지 않았습니다.

`npm.cmd test` 결과:
```text
 Test Files  10 passed (10)
      Tests  256 passed (256)
```

`npx.cmd tsc --noEmit`: 출력 없음, 종료 코드 0. 두 검사 모두 실패가 없습니다.

판단이 필요했던 항목은 도식이라는 설명을 유지하고 대본·엔진 수정으로 남겼습니다. Claude는 침전 장 분류, 전하 표시, 리튬 삽입, ATP·에너지 그래프를 우선 검토하면 됩니다. 대본과 구현은 대조했지만 화면을 직접 재생하지는 않았습니다.