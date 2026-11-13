<일: 반응 뒤에 원자가 겹쳐 보이지 않게 하기>
[RESUME] An earlier run of this job was cut off by the usage limit. src/engine/compile.ts and tests/unit/motion.test.ts may already hold part of the work (see git diff). Read the diff first and carry on from there; do not start over.
지금 커밋은 6762948이다(네 동선 구현이 들어갔고 `npm run cross`는 모든 장면이 깨끗하다). Claude가 화면에서 본 남은 흠:

- 비교 화면 '축합·가수분해' 장면(src/tutorial/chapters.ts의 condensation, `compile(src, { tight: true })`)에서 축합이 끝난 뒤(단계 인덱스 2의 끝)와 그 뒤 단계들에서, 왼쪽 글라이신의 CH₂에 붙은 H 하나가 카보닐 O와 반쯤 겹쳐 그려진다(결합하지 않은 두 원자가 겹침). 네 motion.test.ts의 기준(중심 거리 ≥ 반지름 합 − 4)이 너무 느슨해서 통과했다.

할 일:
1. tests/unit/motion.test.ts의 기준을 강화한다: 단계가 끝난 상태(t = 1)와 시작 상태(t = 0)에서는 결합하지 않은 두 원자(배경 물 제외)의 중심 거리가 반지름 합 + 3 이상이어야 한다. 움직이는 도중에는 반지름 합 − 1 이상. 같은 분자 안의 원자끼리도 해당한다(1–3 관계, 즉 같은 원자에 결합한 두 원자는 제외해도 된다. 그 밖은 포함).
2. src/engine/compile.ts를 고쳐 통과시킨다. 다가가는 자세·dock 뒤의 자세를 고를 때 분자 안팎의 겹침을 제약으로 넣고, 필요하면 가지(예: CH₂와 그 수소)를 결합 축 둘레로 돌려 틈으로 보낸다. 결합 길이는 그대로 둔다.
3. 대상 장면 아홉 개(네 motion.test.ts의 목록) 전부에서 통과해야 한다. `tight` 없는 출력은 그대로여야 한다.
4. 화학(결합·전자·전하·원자 ID)은 바꾸지 마라. 렌더러(src/render/, src/next/)는 건드리지 마라.

고쳐도 되는 파일: src/engine/compile.ts, src/engine/timeline.ts, tests/unit/motion.test.ts.
</일>
