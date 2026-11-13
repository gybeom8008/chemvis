<일: 실험실 화면 명세(단계 1)>
앞선 실행이 사용량 한도로 끊겼다. docs/plan/lab-ui.md가 이미 일부 쓰여 있으면 읽고 이어서 완성하라. 그사이 src/lab/judge.ts, stage1-data.ts, assembly-data.ts, assembly-script.ts와 docs/plan/lab-judge.md가 생겼으니 그 함수 이름에 맞춰 적는다.

docs/plan/lab-astra.md 3절(화면과 끌기 동작), docs/plan/lab-decisions.md, docs/plan/ui.md(화면 규칙 R1–R18), docs/plan/depiction.md(반응을 그리는 방식, 2.2절의 검토 중인 표현)를 읽고, 실험실 단계 1 화면을 Claude가 그대로 만들 수 있는 명세를 쓴다. 구현은 하지 않는다.

docs/plan/lab-ui.md에 다음을 적는다:
- PC 화면 배치(영역마다 크기, 들어가는 것). 수용액 반응 모드와 분자 조립 모드의 전환.
- 재료 서랍: 단계 1 재료 15종과 시작 재료 묶음 넷("물 만들기", "H 주고받기", "고체가 생기기", "금속 바꾸기")의 표시 이름과 순서, 검색, 구조만 보기 재료의 구분.
- 끌기의 상태 기계와 각 상태에서 화면에 보이는 것(미리보기 고리, 필요한 재료 안내, 판정 문구 위치), 키보드로 하는 방법.
- 결과 카드: 결과 종류마다 제목·'자세히' 내용·버튼. 문구는 lab-rows-stage1.md와 lab-decisions.md의 것을 그대로 쓴다.
- 실행 취소·다시 실행·다시 보기·비우기의 동작과 버튼 문구(사용자 금지어: "되돌리기" 대신 "실행 취소", "닫기" 대신 "접기" 같은 규칙을 docs/plan/ui.md와 handover.md에서 확인해 따른다).
- 인수 시험: 사람이 손으로 해 볼 조작 순서와 기대 화면 30개 이상.
- Claude가 만들 때의 파일 구성 제안(src/next/ 아래 어떤 파일, 엔진 E1·E2와 src/lab/의 어떤 함수를 부르는지).

고쳐도 되는 파일: 새 파일 docs/plan/lab-ui.md 하나.
</일>
