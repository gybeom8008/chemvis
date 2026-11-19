# 보관: Astra(ChatGPT)와 함께 일한 기록

2026-11-16부터 ChatGPT(Astra, Codex)를 쓰지 않는다(윤범님. 요금제가 끝났다). 아래는 그때까지 [인계서](../docs/plan/handover.md) 8절에 있던 내용을 2026-11-19에 그대로 옮긴 것이다. Astra가 만든 것(반응열 표, 수업 대본, 동선 검사)은 지금도 쓴다.

## 일하던 방법

> **ChatGPT(Astra)는 2026-11-16부터 쓰지 않는다.** 아래는 그때까지 어떻게 일했는지의 기록이다.
>
> **실험실은 2026-11-14에 무기한 중단했다.** 아래 8.1–8.3은 그때까지의 기록이다. 만든 것은 모두 [archive/lab](lab/README.md)에 있다. Astra에게는 실험실 말고 다른 일(반응 표현의 검토, 엔진 동선, 자료 표)을 맡긴다.

**Astra를 부르는 방법.** 이 컴퓨터의 Codex 데스크톱 앱에 든 실행 파일을 `%USERPROFILE%\.local\bin\codex.cmd`가 불러 준다(기본 모델이 Astra). Claude Code의 codex 플러그인은 이 경로를 찾지 못하므로 직접 부른다.

```bash
~/.local/bin/codex.cmd exec -s read-only -o answer.md - < prompt.md
```

파일을 쓰게 하려면 `-s workspace-write`. 한 번에 10–20분 걸리므로 뒤에서 돌린다. 보통은 아래의 대기열에 지시문을 넣는다.

### 지금까지

- 클라우드 세션은 윤범님의 ChatGPT 계정을 쓸 수 없어서 의뢰서([lab-brief.md](lab/docs/lab-brief.md))만 썼고, 윤범님이 Astra에게 전달했다.
- Astra의 결과가 [lab-astra.md](lab/docs/lab-astra.md)다. 기준 커밋은 `c814963`이다.
- 클라우드 세션이 그 문서에서 확인한 사실은 다음과 같다.
  - 대본 예시 일곱 개(A01, A03, A04, P01, D01, R01, R02)는 지금 엔진에서 오류 없이 컴파일되고, 끝 상태가 문서의 생성물과 같다.
  - logK, Q/Ksp, E°cell, E 범위를 다시 계산했고 전부 일치했다.
  - 엔진에 대한 주장 세 가지(컴파일은 늘 새 장면에서 시작한다, `precipitate`는 화학식이 같은 이온 가운데 앞의 것부터 고른다, 아세트산의 OH는 O2와 H4다)는 맞다.
- [lab-review.md](lab/docs/lab-review.md)의 4절 이후는 클라우드 세션의 **의견**이다. 윤범님이 정한 것이 아니고, 윤범님은 이 검토를 더 하지 말라고 했다. 로컬에서 Astra와 직접 이야기해서 정한다.

### Astra가 본 뒤로 바뀐 것

Astra는 `c814963`을 읽었다. 그 뒤에 바뀐 것을 Astra에게 알려야 한다.

| 바뀐 것 | 내용 |
|---|---|
| 알짜 반응의 표현 | 축합과 가수분해도 전자쌍이 주인을 바꾸는 모습으로 그린다(`StepAnim.shifts`) |
| 다가가는 까닭 | `approach`가 부분 전하 표시와 점선으로 서로 당기는 것을 보여 준다(`StepAnim.pulls`). 비어 있는 쪽이 없는 원자에는 가장 넓은 틈으로 다가간다 |
| 전극의 전자 | `oxidize`/`reduce`의 전자가 전극의 정해진 위치까지 도중에 사라지지 않고 이어진다(`ArrowAnim.free`, `plateSlot`) |
| 단순하게 그리는 장면 | 결정 안의 이온, 분자 여러 개의 장면, 배경의 물에는 전자를 그리지 않는다 |
| 흔들림 규칙 | 6절. 두 방식 모두에 적용했다 |
| 비교 화면 | 장면 12개. `window.cmp.script(대본)`으로 아무 대본이나 볼 수 있다 |
| 도구 | `npm run flicker`, `npm run shot` |

### Astra와 정한 것

2026-11-11에 로컬 세션이 Astra와 두 차례 주고받아 여섯 가지를 모두 정했다. 내용은 [lab-decisions.md](lab/docs/lab-decisions.md)에 있다. Astra가 쓴 단계 1의 자료 행(재료 15종, 반응 8개, 두 재료 조합 120개의 판정)은 [lab-rows-stage1.md](lab/docs/lab-rows-stage1.md)에 있고, 수치와 유도값은 Claude가 출처 원문과 대조했다. 자료 행은 아직 `draft`다(2판에서 바뀐 행의 대조가 남았다). 엔진의 E1(`compileFrom`, `addSpecies`)과 E2(`precipitate using`)는 들어갔다. 윤범님이 Astra를 틈틈이 쓰라고 했으므로(ChatGPT 사용량은 남는다) 내 일을 시작할 때 Astra에게도 일을 하나씩 맡겨 뒤에서 돌린다.

Astra가 그 뒤에 한 일(2026-11-12–13, 모두 Claude가 검사를 돌려 보고 커밋): 실험실 판정기와 단계 1 자료(`src/lab/`, [lab-judge.md](lab/docs/lab-judge.md)), 분자 조립 자료와 대본([lab-assembly.md](lab/docs/lab-assembly.md)), 단계 2 자료 행 초안([lab-rows-stage2.md](lab/docs/lab-rows-stage2.md)), 실험실 화면 명세([lab-ui.md](lab/docs/lab-ui.md)), 51수업의 장면 대본([lessons/](../docs/plan/lessons/README.md)), 튜토리얼 화학 검토, 새 방식의 동선 엔진(`tests/unit/motion.test.ts`). 실험실 쪽은 어느 것도 화면에 연결하지 않았다.

Astra가 2026-11-16에 한 일: 표준 생성 엔탈피 표와 단계별 반응열 계산(`src/chem/enthalpy.ts`, [enthalpy.md](../docs/plan/enthalpy.md)).

**2026-11-16부터 ChatGPT(Astra, Codex)를 쓰지 않는다.** 윤범님의 요금제가 끝났고, 윤범님이 앞으로 쓰지 말자고 했다. 이 절의 나머지는 기록이다. Astra에게 맡기려던 일 넷(반응열 표의 남은 대조와 문서, 새 움직임의 수치 검증, 전하 보존 검사 넓히기와 이온 글자, 축합의 준비 동작)은 Claude가 필요한 순서대로 직접 한다. 지시문은 `%USERPROFILE%astra-jobsqueue`에 남아 있다.

Astra에게 일을 맡기는 대기열: `%USERPROFILE%\astra-jobs\`의 `runner.cjs`(`node runner.cjs`. 이 컴퓨터에 파이썬이 없어져서 11-16에 Node로 옮겼다. 세션의 뒤쪽 작업으로 띄우며, Claude Code를 닫거나 재부팅하면 꺼지므로 다시 띄운다)가 `queue\`의 지시문을 이름순으로 하나씩 돌리고(`preamble.md`가 공통 규칙), 답과 기록을 `out\`에 남긴다. ChatGPT 한도에 걸리면 풀릴 때까지 기다렸다 이어서 한다(`wake.txt`를 만들면 바로 다시 시도). 윤범님은 Astra를 쉬게 두지 말라고 했다. 대기열이 비면 새 일을 넣는다. 두 사람이 같은 파일을 동시에 고치지 않도록 지시문마다 고쳐도 되는 파일을 적는다.

### 일 나누기

| 누가 | 무엇 |
|---|---|
| Astra | 자료 표(반응열)와 출처, 엔진 동선 구현, Claude가 고친 것의 수치 검증과 화면 검사, 화학 검토 |
| Claude | 반응 표현의 설계와 그리기, 엔진, Astra가 한 일의 검토와 커밋, 검사와 배포 |

일을 줄 때는 지금 커밋, 바뀐 것, 답을 원하는 질문을 함께 준다. Astra는 저장소를 직접 읽고 대본을 컴파일해 볼 수 있다.
