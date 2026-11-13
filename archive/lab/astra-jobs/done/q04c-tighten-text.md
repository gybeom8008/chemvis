<일: 화학 검토로 고친 글을 짧게 다듬기>
작업 트리에 네가 고친 글이 커밋 전 상태로 있다(src/tutorial/chapters.ts, src/tutorial/examples.ts, public/ai-guide.md, docs/plan/curriculum.md, 새 docs/plan/chem-review.md). `git diff`로 볼 수 있다. Claude가 훑어보니 화학은 더 정확해졌지만 글이 길어졌다. 이 사용자는 화면에 말이 많은 것을 몹시 싫어한다(예전에 "말이 너무 많다"고 크게 화냈다). 그래서 이대로는 커밋하지 못했다.

다시 다듬어라:
- 자막(step "...")은 한 문장, 고치기 전(HEAD) 문장의 길이를 넘지 않는다. 화면에서 지금 보이는 일만 말한다.
- "앱은 ~를 계산하지 않아요", "이는 ~한 연출이에요", "화면 속 ~는 ~를 대신해요" 같은 단서는 자막과 tryIt에서 뺀다. 꼭 필요한 단서는 그 장의 intro에 한 번, 한 문장으로만 둔다. intro도 HEAD의 길이를 크게 넘지 않는다(1.2배 이하).
- tryIt은 한두 문장. "설명과 자막, note 글도 함께 바꿔 주세요" 같은 당부는 뺀다(틀린 설명이 남는 문제는 tryIt의 예를 설명이 어긋나지 않는 것으로 바꿔서 해결하거나 chem-review.md의 남은 일로 넘긴다).
- 틀린 사실을 바로잡은 것은 지킨다. 짧게 만들다가 다시 틀리게 되면 안 된다. 짧게 쓸 수 없는 것은 문장을 고치지 말고 HEAD대로 두고 chem-review.md의 남은 일에 적는다.
- 문장 기준: 화면에 보이는 것·앞에서 나온 것을 먼저(은/는), 새 정보는 서술어 쪽. "~를 가진", "~와의", "~에서의", 필요 없는 "들", "평균적으로" 같은 군말을 쓰지 않는다.
- 끝나면 장마다 HEAD 대비 글자 수가 얼마나 늘었는지 표로 보고하고, chem-review.md를 실제 상태에 맞게 고친다.

고쳐도 되는 파일: src/tutorial/chapters.ts, src/tutorial/examples.ts, public/ai-guide.md, docs/plan/curriculum.md, docs/plan/chem-review.md. 대본 명령은 바꾸지 마라.
</일>
