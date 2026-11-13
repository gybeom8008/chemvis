<일: 분자 조립을 엔진 대본으로 잇기>
네가 만든 src/lab/assembly-data.ts와 docs/plan/lab-assembly.md를 바탕으로, 조립 조작을 엔진이 그릴 수 있는 대본으로 바꾸는 모듈을 만든다.

1. src/lab/assembly-script.ts:
   - 조립판의 상태(원자 목록과 위치, 결합)를 엔진 대본 머리말로 바꾸는 함수(조립용 원자를 원하는 lp·rad로 만드는 방법을 엔진에서 확인해 쓴다. 엔진에 그 방법이 없으면 무엇이 필요한지 보고하고, 가능한 범위만 만든다).
   - 조작 하나(두 원자 잇기, 결합 차수 올리기)를 step 블록으로 바꾸는 함수. 두 홑전자가 같은 단계에서 결합으로 가는 대본, 다가가기(approach)를 넣을지, `pulls`를 끄는 방법을 정한다.
   - 조작이 막힐 때는 대본을 만들지 않고 이유 코드를 돌려준다.
2. tests/unit/assembly-script.test.ts: 열다섯 분자 각각을 원자에서부터 조립하는 조작 순서를 실제로 compile(또는 compileFrom)으로 이어 실행해서, 끝 상태가 그 분자의 그래프와 같고 판정이 "대조한 구조와 같음"이 되는지 검사한다. 다이메틸 에터, 홑전자가 남는 경우, O₂ 차단, 고리 차단도 검사한다.
3. docs/plan/lab-assembly.md 맨 끝에 "엔진 연결" 절을 더해 위 내용을 적는다.

고쳐도 되는 파일: 새 파일 src/lab/assembly-script.ts, tests/unit/assembly-script.test.ts, 그리고 docs/plan/lab-assembly.md(네가 만든 파일).
</일>
