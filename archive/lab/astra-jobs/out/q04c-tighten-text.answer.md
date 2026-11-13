자막 122개를 모두 한 문장, HEAD 길이 이하로 다듬었습니다. intro는 모두 HEAD의 1.2배 이내입니다. 대본 명령과 다른 작업 파일은 그대로이며, 커밋·push는 하지 않았습니다.

바꾼 파일은 다음 다섯 개입니다.

- [chapters.ts](/E:/Project/chemvis/src/tutorial/chapters.ts): 자막·intro·tryIt 축약
- [examples.ts](/E:/Project/chemvis/src/tutorial/examples.ts): 자막 축약
- [ai-guide.md](/E:/Project/chemvis/public/ai-guide.md): 설명 축약, 한 문장 규칙 반영
- [curriculum.md](/E:/Project/chemvis/docs/plan/curriculum.md): 학습 목표 축약
- [chem-review.md](/E:/Project/chemvis/docs/plan/chem-review.md): 46건 반영 상태·남은 작업·글자 수·검사 결과 갱신

글자 수는 제목·intro·범례·tryIt·자막·note를 합산했습니다. 예시는 summary도 포함하며, HTML 태그와 명령은 제외했습니다. 자세한 기준은 [검토 기록](/E:/Project/chemvis/docs/plan/chem-review.md:86)에 있습니다.

| 장·예시 | HEAD | 현재 | 증감 |
|---|---:|---:|---:|
| 원자, 결합, 전자쌍 | 507 | 438 | −69 |
| 전자의 이동과 전하 | 697 | 438 | −259 |
| 분자 사이 인력과 온도 | 337 | 327 | −10 |
| 확산 | 247 | 239 | −8 |
| 증발과 응결 | 385 | 357 | −28 |
| 끓음 | 272 | 218 | −54 |
| 응고와 융해 | 362 | 330 | −32 |
| 용해 | 326 | 285 | −41 |
| 석출(침전) | 344 | 315 | −29 |
| 흡착과 이온 교환 | 392 | 372 | −20 |
| 씻겨 내려감 | 319 | 290 | −29 |
| 막 수송 | 395 | 386 | −9 |
| 삼투 | 337 | 288 | −49 |
| 산과 염기 ① | 430 | 396 | −34 |
| 산과 염기 ② | 378 | 360 | −18 |
| 중화 반응 | 474 | 395 | −79 |
| 산화와 환원 | 524 | 431 | −93 |
| 전지 | 599 | 451 | −148 |
| 라디칼 반응 | 580 | 444 | −136 |
| 치환 반응 | 556 | 488 | −68 |
| 첨가 반응 | 513 | 454 | −59 |
| 축합과 가수분해 | 486 | 342 | −144 |
| 배위 결합 | 503 | 404 | −99 |
| 반응과 에너지 | 573 | 413 | −160 |
| 화학 평형 | 486 | 376 | −110 |
| **튜토리얼 합계** | **11,022** | **9,237** | **−1,785** |
| 예시: 석회 동굴 | 536 | 328 | −208 |
| 예시: 종유석과 석순 | 564 | 327 | −237 |
| 예시: 리튬 이온 전지 | 509 | 320 | −189 |
| 예시: 미토콘드리아 | 420 | 248 | −172 |
| 예시: 뿌리털 | 292 | 232 | −60 |
| **예시 합계** | **2,321** | **1,455** | **−866** |

`npm.cmd test` 결과는 다음과 같습니다. 종료 코드는 0입니다.

```text
> chemvis@0.1.0 test
> vitest run


 RUN  v5.1.0 E:/Project/chemvis


 Test Files  13 passed (13)
      Tests  608 passed | 1 todo (609)
   Start at  13:57:04
   Duration  12.84s (tests 78%, transform 12%, import 9%, worker 2%)

    Isolate  13 workers spawned · ~1.60s startup each (spawn + environment, per file)
             at least ~2.56s faster with isolate: false — reuses workers across files instead of one per file
```

`npx.cmd tsc --noEmit`은 **출력 없이 종료 코드 0**입니다. 실패는 없었으며, todo 1개는 수정 전에도 있었습니다.

판단이 필요했던 곳은 재료 교체 체험이었습니다. 기존 자막과 어긋나는 체험은 표시·배치·입자 수·관찰 시간 변경으로 바꿨습니다. 예시는 intro가 없어 필요한 단서를 안내서에 남기고 **R18**로 기록했습니다.

Claude는 **전하·리튬·에너지 표시, 침전 분류, 예시 설명란(R18), 별도 수업 자료의 남은 문구(R19)**를 검토해야 합니다. 실제 화면 재생·줄바꿈과 외부 화학 문헌은 이번에 확인하지 않았습니다.