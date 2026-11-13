<JOB: causal choreography in the engine for dissolving, precipitation and the metal piece>
Current commit: see `git log -1`. Work only when `tight` is on (`compile(src, { tight: true })`); output without `tight` must stay byte-identical (the "legacy compile output" test).

User's criterion (verbatim): "분자와 분자 사이에서 원자나 화학반응이 오갈 때, 그 반응이 분자의 상태가 바뀌는 원인으로 보이지 않는다... 음전하가 양전하를 끌어당기고, 분자가 오가고, 그에 따라 화학포텐셜 에너지에 따른 변화가 일어나고... 이 모든 것이 일정한 법칙을 가진 인과관계로 보이도록 시각화를 설계해야 한다." Your own review (C:\Users\nulls\astra-jobs\out\q06z-causality.answer.md, section C) names what to tie together. Implement the engine side of three of them:

1. Dissolving (`dissolve`, src/engine/compile.ts): the water must be seen to do it. Order within the step: the shell waters turn and come up to the surface ion first (O toward a cation, H toward an anion), touching it; only then does the ion come away, and it comes away together with the waters that hold it (they move as one group from the moment it leaves), toward the side the waters are on. No ion leaves before its waters have arrived.
2. Precipitation (`precipitate`, both forms): the two ions are drawn to each other first (they approach along the line between them, opposite charges facing), their waters let go as they close in (the waters back off outward just before contact, not at the start), then the pair settles into the solid. With `onto`, the pair goes to the nearest free place beside ions of the opposite sign.
3. Metal piece (`land`, `hop`, `join`, `leave`): allow `leave` in the same step as the hops so that the Zn starts coming away as the electrons go (it must not start before the first electron has left; it is clear of the piece only after the last one has gone). Keep the separate-step form working. Report the script Claude should use in src/next/compare.ts (do not edit that file).

For each: add tests to tests/unit/motion.test.ts that fix the order as numbers (e.g. the ion's displacement is under 2 until every shell water is within contact distance; the waters' distance to their ion stays within contact distance after that; an ion's waters are still attached until the two ions are within N of each other; the Zn's displacement is 0 until the first hop has left). Chemistry (bonds, electrons, charges, IDs, crystal membership at the end of the step) must not change; existing tests must pass. Do not touch src/render/ or src/next/.

Editable files: src/engine/compile.ts, src/engine/timeline.ts, tests/unit/motion.test.ts.
</JOB>
