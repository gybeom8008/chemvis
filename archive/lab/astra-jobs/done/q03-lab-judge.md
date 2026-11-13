<일: 실험실 판정기(단계 1) 만들기>
docs/plan/lab-astra.md 4절(판정 절차)과 docs/plan/lab-decisions.md, docs/plan/lab-rows-stage1.md(3판)를 구현할 수 있는 순수 TypeScript 모듈로 만든다. 화면과 엔진 대본 실행은 하지 않는다(그건 Claude가 연결한다).

1. src/lab/stage1-data.ts: 단계 1 자료를 코드로 옮긴다. 재료 15종(id, 상, 전하, 그래프를 만들 엔진 화학식), 수치 행(값·단위·출처 URL·위치), 유도 수치, 사건 8개(반응물, 필요량, 허용 맥락, 대본 템플릿, 결과 제목·자세히 문구), 부정 인증, 두 재료 조합 120행의 판정. 문서와 한 글자도 어긋나지 않게 옮기고, 각 행에 문서의 ID(T001 등)를 붙인다.
2. src/lab/judge.ts: `classifyContact(a, b, env)`와 `planEvent(candidate, sceneSummary)`. 결과는 반응함 / 반응하지 않음 / 모름(내부 사유 코드)과 준비 상태(needs-material 등). 맥락 허용 목록, 경쟁 경로(R 계열의 아연 위 구리 등), 재료 부족, 조건 고정(water/25/ordinary/none 외는 미지원)을 구현한다. 화면 문구는 lab-decisions.md 3절의 네 묶음 문장을 쓴다.
3. tests/unit/lab-judge.test.ts: 120개 조합 전부가 문서 표와 같은 결과를 내는지, 사유 코드가 같은지, 맥락·경쟁·부족 사례(설계서 10절의 검사 가운데 단계 1에 해당하는 것 전부), 조건 밖 입력이 모름이 되는지 검사한다. 사건 8개의 대본 템플릿이 compileFrom으로 컴파일되는지도 검사한다(이미 tests/unit/lab-rows.test.ts가 하는 것과 겹치면 그 파일을 import해 재사용하지 말고 짧게 따로 써도 된다).
4. docs/plan/lab-judge.md: 모듈 구조, 함수 계약, Claude가 화면에 연결할 때 할 일.

고쳐도 되는 파일: 새 파일 src/lab/stage1-data.ts, src/lab/judge.ts, tests/unit/lab-judge.test.ts, docs/plan/lab-judge.md.
</일>
