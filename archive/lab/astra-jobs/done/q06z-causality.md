<JOB: causal depiction - design review (read only)>
Do not modify files. Answer in Korean markdown ("~다" style, no translationese), concise, decisions and drawing instructions first.

User feedback on the compare page (https://gybeom8008.github.io/chemvis/concept/, right pane), verbatim:
"내가 마음에 안 드는 건 이거야. 분자와 분자 사이에서 원자나 화학반응이 오갈 때, 그 반응이 분자의 상태가 바뀌는 원인으로 보이지 않는다는 거야. 예컨대 수소 원자 하나를 주고 받을 때 어떤 분자는 양이온이 되고 어떤 분자는 음이온이 되지. 근데 그게 원인과 결과로 보인다기보단, 그냥 서로 다른 두 사건이 동시에 일어나는 걸로 보인다는 거지. 전반적으로 마찬가지야. 음전하가 양전하를 끌어당기고, 분자가 오가고, 그에 따라 화학포텐셜 에너지에 따른 변화가 일어나고... 이 모든 것이 자연스럽게 시각화되려면 그 모든 것들이 일정한 법칙을 가진 인과관계로 보이도록 시각화를 설계해야 한다는 거야."

How it is drawn now (read src/render/view.ts around the `glow` block, src/render/pairs.ts moving section, docs/plan/depiction.md 2.2 and 2.3): electron pairs are pouches that reach and let go; the charge light of each atom fades from its before-value to its after-value on its own timer (`turn`), not tied to the electrons; signs (+, −) appear after the atoms settle; approach shows a dashed line between the two places that attract; released energy is only a small chart.

What Claude is building now (right pane; the left pane keeps the current state):
1. One law for charge: the light of an atom is computed at every moment from where the drawn electrons are (formal count plus the lean of bond electrons). So O turns less blue exactly as its pair goes out to H, and Cl turns blue exactly as the H-Cl pair draws back onto it. The rule that moved the + of H3O+/NH4+ onto the H atoms is dropped in favour of this single bookkeeping law (formal charge on the atom that shared its pair, plus lean), because the user asks for one consistent law that reads causally.
2. The moving pair carries its charge: the pouch that is moving is tinted with the negative-charge colour (no separate orange for "changing"); a flying single electron has a halo of that colour.
3. Signs (+, −) are shown from the same electron state (appear when the ion's summed charge is near its final value), not on a timer.
4. Attraction: the dashed line becomes a pull between the blue place and the red place that strengthens as they near.
5. Energy: in a step that releases energy, the water around the reaction site moves faster right after the bond forms (a wave going outward); absorbing does the opposite.

Asked of you:
A. Is dropping the H3O+/NH4+ spread rule chemically acceptable for a beginner tool if the "자세히"/docs say it is electron bookkeeping? If not, give a single law that keeps causality (charge follows the electrons seen moving) and is not misleading.
B. For each of the five points: what would still read as "two events at the same time" and how to draw it so the cause is seen producing the effect. Be concrete (what moves, when, what changes with it).
C. Other causal links the scenes need and lack: list the top five across the scenes on the compare page (proton transfer, substitution, addition, condensation, redox, coordination, radical, dissolving, precipitation, metal piece), each with cause, effect, and how to draw the link.
D. Chemical limits to respect so the causal story does not teach something false (e.g. charges are not little fluids, attraction lines are not bonds, energy to motion).
</JOB>
