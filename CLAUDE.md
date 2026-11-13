# chemvis

AI가 쓴 짧은 장면 대본을 화학 반응의 장면(원자, 전자, 결합의 움직임)으로 그려 주는 웹앱. Vite + TypeScript + SVG. Firefox가 기준이고 Chromium에서도 동작해야 한다.

**일을 시작하기 전에 [docs/plan/handover.md](docs/plan/handover.md)를 읽는다.** 지금 상태, 정해진 것, 남은 일, Astra와 일하는 방법이 거기에 있다.

## 가장 중요한 것

반응에서 실제로 일어나는 일을 설명 없이 보자마자 알 수 있게 그리는 것. 변화는 저마다 따로 일어나는 사건이 아니라 **일정한 법칙을 따르는 원인과 결과**로 보여야 한다(전자가 움직여서 전하가 바뀐다, 전하가 당겨서 분자가 다가간다, 에너지가 나와서 둘레가 움직인다). 결과는 원인에서 계산해서 그리고, 제 시간표대로 따로 움직이게 하지 않는다([docs/plan/depiction.md](docs/plan/depiction.md) 2.4). "디자인이 비직관적이다"라는 말을 들으면 주변 화면이 아니라 반응을 그린 장면부터 의심한다.

## 지킬 것

- 반응 표현은 비교 화면(`/concept/`, `src/next/compare.ts`)에서만 고친다. 윤범님이 새 방식을 확정하기 전에는 앱 전체를 바꾸지 않는다.
- 비교 화면의 왼쪽('견줄 방식')은 바로 직전 상태, 오른쪽('검토할 방식')은 이번에 바꾼 것으로 둔다.
- 고친 화면은 사진이 아니라 윤범님이 직접 조작할 수 있는 페이지로 보인다(비교 화면에 장면이나 옵션을 더하고 push한 뒤 주소를 드린다).
- 화면을 고친 뒤에는 `npm run shot`으로 직접 보고, `npm run flicker`로 실제 속도에서 표시가 튀지 않는지 재고, `npm test`와 `npm run e2e`를 실행한다. 정지 화면만 보고 확인했다고 말하지 않는다.
- 여럿 가운데 하나를 고르는 표시(전자쌍 방향, 전하 표시 방향)는 저장된 좌표로 한 번만 정하고 분자와 함께 회전시킨다(`src/render/pairs.ts`의 `stableDomains`, `stableFreeAngle`).
- 실험실은 검토한 자료 행에 있는 반응만 실행한다. 모르는 조합을 "반응하지 않는다"고 답하지 않는다([docs/plan/lab-decisions.md](docs/plan/lab-decisions.md)).
- 화면 문구와 문서는 존댓말, 번역 투 없이. 윤범님 계정 설정의 금지어 목록을 화면 문구에도 적용한다.
- 실험실 설계는 Astra와 함께 정한다. 부르는 방법과 지금까지 정한 것은 [docs/plan/lab-decisions.md](docs/plan/lab-decisions.md)에 있다.
- `main`에만 push한다. PR은 요청이 있을 때만. 강제 push 금지. push하면 CI가 검사 후 GitHub Pages에 배포한다.
- 확인을 구하지 말고 끝까지 한다. 허락 창이 뜨는 일은 피한다.

## 명령

| | |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 형식 검사와 빌드 |
| `npm test` | 단위 검사 |
| `npm run e2e` | 화면 검사(빌드 뒤) |
| `npx vite preview --port 4173 --strictPort` | 빌드한 것 보기. 아래 둘에 필요 |
| `npm run flicker` | 움직임 검사 |
| `npm run shot -- out.png <장면 이름 또는 대본 파일> <단계:시간,...>` | 장면 캡처 |
