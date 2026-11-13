<일: 새 그림의 화면 검사 쓰기>
tests/e2e/pairs.spec.ts를 읽고 같은 방식으로 tests/e2e/glow.spec.ts를 새로 써라. 비교 화면(concept/?still#장면)의 오른쪽(#new, 검토할 방식)을 `window.cmp.seek(단계, 시간)`으로 옮겨 가며 SVG를 검사한다. 장면 대본은 src/next/compare.ts와 src/tutorial/chapters.ts에 있다. 그리는 코드는 src/render/view.ts, src/render/pairs.ts, src/render/stage.css다.

검사할 것:
- 원자 하나인 이온과 여럿인 이온의 전하 글자(`text.ionq`)가 이온마다 하나씩, 원자 원 바깥에 있다(글자 중심이 어느 원자 원 안에도 있지 않다). 원자 기호 글자(`text.sym`) 안에 +, −가 없다.
- 치환 장면: 결합해 있는 Br에는 −가 없고, 반응이 끝난 뒤 Br⁻ 옆에 − 하나, 양이온 옆에 + 하나.
- 산 장면 끝: H₃O⁺에 + 하나, Cl⁻에 − 하나.
- 전하 색: `?palette=red-negative`로 열면 svg의 data-palette가 바뀌고, 토글 버튼을 누르면 다시 바뀌며 재생 위치(단계, 시간)는 그대로다. 양전하 글자의 색(computed fill)이 두 설정에서 다르다.
- 금속 조각 장면: 조각 안의 전자 점(주머니 없는 `.pe`, data-a 없음) 수가 단계 내내 12개로 보존된다(건너가는 점 포함해서 세는 방법을 코드에서 확인해 정하라). 조각 안의 금속 원자에는 전하 글자가 없다. 마지막 단계 끝에 Zn²⁺ 옆에 "2+" 하나.
- 침전 장면: 고체 안의 이온에는 전하 글자가 없다.
- 모든 장면에서 pageerror가 없다.
Playwright를 네 환경에서 실행할 수 있으면(먼저 `npm.cmd run build`, 검사는 `npx.cmd playwright test --project=chromium tests/e2e/glow.spec.ts`) 실행해서 통과시키고, 실행할 수 없으면 그렇다고 적어라. 그리기 코드가 틀려서 실패하는 검사는 고치지 말고 `test.fixme`로 두고 보고하라.

고쳐도 되는 파일: 새 파일 tests/e2e/glow.spec.ts 하나.
</일>
