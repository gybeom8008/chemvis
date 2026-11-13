허용된 세 파일만 작업했습니다. 커밋·push는 하지 않았습니다.

- [assembly-script.ts](E:/Project/chemvis/src/lab/assembly-script.ts): 머리말·World 생성, 조작별 `step` 생성, 차단 이유 반환.
- [assembly-script.test.ts](E:/Project/chemvis/tests/unit/assembly-script.test.ts): 실제 컴파일 검사 64개 추가.
- [lab-assembly.md](E:/Project/chemvis/docs/plan/lab-assembly.md:247): 「엔진 연결」과 검사 기록 추가.

판단한 부분: 현재 머리말은 C·N·O의 조립용 전자 수를 지정하지 못해 `World`와 `compileFrom`으로 연결했습니다. `approach`를 제외해 `pulls`가 생성되지 않도록 했습니다.

`npm.cmd test` — 종료 코드 0:

```text
> chemvis@0.1.0 test
> vitest run


 RUN  v5.1.0 E:/Project/chemvis


 Test Files  12 passed (12)
      Tests  523 passed (523)
   Start at  00:02:43
   Duration  3.71s (tests 83%, import 11%, transform 5%, worker 1%)

    Isolate  12 workers spawned · ~345ms startup each (spawn + environment, per file)
             at least ~483ms faster with isolate: false — reuses workers across files instead of one per file
```

`npx.cmd tsc --noEmit` — 종료 코드 0, 출력 없음. 최종 실패는 없습니다.

Claude는 World 대체 경로, 원자 배열 순서에 따른 ID 유지, `approach` 제외와 임시 `gas` 무대를 검토하면 됩니다. 그래프와 컴파일 출력은 확인했으며, 화면 재생과 드래그 표현은 확인하지 않았습니다.