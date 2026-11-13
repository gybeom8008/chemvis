<JOB: verify the cause-and-effect drawing numerically (read only)>
Do not modify files. Answer in Korean markdown ("~다"), concise.

Claude implemented the first pass of your causality review (your answer is at C:\Users\nulls\astra-jobs\out\q06z-causality.answer.md). Read the current code on main: src/render/pairs.ts (`chargeNow`, `drawnCharges` with `spread=false`, `poolMetal`, `seaOf`, `seaPlan`, `bend`), src/render/view.ts (the `cause` branches: light, `parting`, ion signs with `fit`, `kick`), src/render/stage.css (`data-cause`), docs/plan/depiction.md 2.4.

Do, by running the code in memory (no files):
1. For every scene of the compare page (src/next/compare.ts SCENES; compile with `{ tight: true }`), sample each step at t = 0, 0.02, ..., 1 and report: (a) whether the sum of the drawn charge over all non-solvent atoms stays equal to the total formal charge at every sample (give the largest deviation and where); (b) any atom whose drawn charge jumps by more than 0.15 between two neighbouring samples, or at a boundary between pre / during / post or between two steps (name scene, step, t, atom, values); (c) any ion sign that is shown while the summed charge of its atoms is more than 0.3 away from it, and any moment with two signs for one ion.
   If `chargeNow` cannot be called directly because it is a closure, re-implement the same arithmetic from the code and say so, or drive `drawPairs` with constructed inputs. Say exactly what you ran.
2. From the code, list the places that would still read as "two events at the same time" rather than cause and effect, most important first, each with: scene, what moves, what changes without being computed from it, and the smallest change that would tie them (function names).
3. Check the claim in depiction.md 2.4 against the code and list any sentence that says more than the code does.
</JOB>
