/**
 * Terms in captions that a lesson teaches. A term in a caption is underlined with dots; pressing it
 * shows what it means and the lesson that teaches it (docs/plan/ui.md R15), so that a scene an AI
 * wrote ("중화 반응이 일어나요") does not leave one asking what the word means.
 */
import { CHAPTERS } from './chapters';

export interface Term {
  /** As it is written in captions; `also` are other spellings of the same term. */
  term: string;
  also?: string[];
  /** What it means, in a sentence or two (해라체). */
  meaning: string;
  /** The lesson that teaches it (a chapter id). */
  lesson: string;
}

export const GLOSSARY: Term[] = [
  { term: '비공유 전자쌍', meaning: '한 원자에만 붙어 있고 결합에 쓰이지 않은 전자쌍이다.', lesson: 'atoms' },
  { term: '홑전자', meaning: '짝 없이 혼자 있는 전자다. 홑전자가 있는 입자를 라디칼이라고 한다.', lesson: 'radical' },
  { term: '수소 결합', meaning: '한 분자의 H와 옆 분자의 O(또는 N, F)가 서로 당기는 힘이다. 분자 사이의 힘 가운데 센 편이다.', lesson: 'forces' },
  { term: '공유 결합', meaning: '두 원자가 전자쌍을 함께 쓰면서 이어지는 결합이다.', lesson: 'covalent' },
  { term: '이중 결합', meaning: '두 원자가 전자쌍 두 개를 함께 쓰는 결합이다.', lesson: 'multiple-bonds' },
  { term: '삼중 결합', meaning: '두 원자가 전자쌍 세 개를 함께 쓰는 결합이다.', lesson: 'multiple-bonds' },
  { term: '이온 결합', meaning: '양이온과 음이온이 반대 전하로 서로 당겨서 이어진 결합이다.', lesson: 'ionic' },
  { term: '양이온', meaning: '전자를 잃어서 +를 띠는 입자다.', lesson: 'ionic' },
  { term: '음이온', meaning: '전자를 얻어서 −를 띠는 입자다.', lesson: 'ionic' },
  { term: '확산', meaning: '한곳에 몰려 있던 입자가 제멋대로 움직이며 고르게 퍼지는 것이다.', lesson: 'diffusion' },
  { term: '증발', meaning: '액체 표면의 분자가 기체가 되어 공기 중으로 나가는 것이다.', lesson: 'evaporation' },
  { term: '응결', meaning: '기체 분자가 다시 액체가 되는 것이다.', lesson: 'evaporation' },
  { term: '끓는점', meaning: '액체 속에서도 분자가 기체로 바뀌어 기포가 생기기 시작하는 온도다.', lesson: 'boiling' },
  { term: '응고', meaning: '액체가 고체로 바뀌는 것(어는 것)이다.', lesson: 'ice' },
  { term: '융해', meaning: '고체가 액체로 바뀌는 것(녹는 것)이다.', lesson: 'ice' },
  { term: '용해', meaning: '한 물질이 다른 물질 속에 고르게 흩어져 섞이는 것이다.', lesson: 'dissolving' },
  { term: '석출', also: ['침전'], meaning: '녹아 있던 이온 짝이 물 분자를 떨치고 고체 결정이 되는 것이다.', lesson: 'precipitation' },
  { term: '흡착', meaning: '어떤 물질이 다른 물질 표면에 달라붙는 것이다.', lesson: 'exchange' },
  { term: '이온 교환', meaning: '표면에 붙어 있던 이온이 떨어져 나오고, 그곳에 다른 이온이 붙는 것이다.', lesson: 'exchange' },
  { term: '용탈', meaning: '물에 녹은 이온이 빗물과 함께 흙 아래로 씻겨 내려가는 것이다.', lesson: 'leaching' },
  { term: '능동 수송', meaning: '에너지를 써서 이온을 농도가 낮은 쪽에서 높은 쪽으로 옮기는 것이다.', lesson: 'membrane' },
  { term: '삼투', meaning: '물만 지나가는 막을 사이에 두고, 물이 이온이 많은 쪽으로 더 많이 건너가는 것이다.', lesson: 'osmosis' },
  { term: '하이드로늄 이온', meaning: '물 분자가 H⁺와 결합한 이온(H₃O⁺)이다. 물속에 이것이 많을수록 산성이 강하다.', lesson: 'acid-hcl' },
  { term: '산성', meaning: '물속에 H₃O⁺가 많은 상태다.', lesson: 'acid-hcl' },
  { term: '염기성', meaning: '물속에 OH⁻가 많은 상태다.', lesson: 'base-nh3' },
  { term: '염기', meaning: '비공유 전자쌍으로 H⁺와 결합하는 물질이다.', lesson: 'acid-hcl' },
  { term: '수산화 이온', meaning: '물 분자가 H⁺를 내주고 남은 이온(OH⁻)이다. 물속에 이것이 많으면 염기성이다.', lesson: 'base-nh3' },
  { term: '강한 산', meaning: '물속에서 거의 모든 분자가 H⁺를 내주는 산이다.', lesson: 'weak-acid' },
  { term: '약한 산', meaning: '물속에서 일부 분자만 H⁺를 내주고, 내준 H⁺를 되찾기도 하는 산이다.', lesson: 'weak-acid' },
  { term: '중화', meaning: '산의 H⁺가 염기로 옮겨 가서 산성과 염기성이 함께 없어지는 반응이다.', lesson: 'neutralization' },
  { term: '산화수', meaning: '원자가 전자를 얼마나 잃었는지(+), 얼마나 얻었는지(−)를 나타내는 숫자다.', lesson: 'redox' },
  { term: '산화', meaning: '원자가 전자를 잃는 것이다. 다른 쪽이 그 전자를 얻으므로 환원과 함께 일어난다.', lesson: 'redox' },
  { term: '환원', meaning: '원자가 전자를 얻는 것이다. 다른 쪽이 그 전자를 잃으므로 산화와 함께 일어난다.', lesson: 'redox' },
  { term: '반응성', meaning: '물질이 다른 물질과 얼마나 쉽게 반응하는지를 말한다. 금속은 전자를 잘 내줄수록 반응성이 크다.', lesson: 'metal-reactivity' },
  { term: '전지', meaning: '산화와 환원이 서로 다른 전극에서 일어나, 그 사이를 흐르는 전자로 일을 하는 장치다.', lesson: 'cell' },
  { term: '라디칼', meaning: '짝 없이 혼자 있는 전자(홑전자)를 가진 입자다. 다른 분자의 결합을 깨뜨리기 쉽다.', lesson: 'radical' },
  { term: '연쇄 반응', meaning: '한 반응에서 생긴 입자가 다음 반응을 일으키며 꼬리를 물고 이어지는 반응이다.', lesson: 'radical' },
  { term: '치환', meaning: '분자 속 원자 하나가 다른 원자(또는 원자 덩어리)로 바뀌는 반응이다.', lesson: 'substitution' },
  { term: '첨가', meaning: '이중 결합의 전자쌍 하나가 새 결합에 쓰이면서 두 분자가 하나로 합쳐지는 반응이다.', lesson: 'addition' },
  { term: '축합', meaning: '두 분자가 물 분자 하나를 내보내면서 하나로 이어지는 반응이다.', lesson: 'condensation' },
  { term: '가수분해', meaning: '물이 들어가면서 결합이 깨지는 반응이다. 축합의 반대다.', lesson: 'condensation' },
  { term: '고분자', meaning: '작은 분자 수백, 수천 개가 이어진 큰 분자다. 단백질, 녹말, 나일론이 고분자다.', lesson: 'polymer' },
  { term: '배위 결합', meaning: '한쪽 원자가 비공유 전자쌍을 통째로 내주어 생기는 결합이다.', lesson: 'coordination' },
  { term: '착이온', meaning: '금속 이온 둘레에 분자나 이온이 배위 결합으로 붙은 이온이다.', lesson: 'coordination' },
  { term: '발열 반응', meaning: '에너지가 나와서 주변이 따뜻해지는 반응이다.', lesson: 'energy' },
  { term: '흡열 반응', meaning: '에너지를 흡수해서 주변이 차가워지는 반응이다.', lesson: 'energy' },
  { term: '활성화 에너지', meaning: '반응이 일어나려면 넘어야 하는 에너지 언덕의 높이다.', lesson: 'energy' },
  { term: '촉매', meaning: '반응의 에너지 언덕을 낮춰서 반응을 빠르게 하는 물질이다. 몸속의 효소도 촉매다.', lesson: 'energy' },
  { term: '가역 반응', meaning: '앞으로도 뒤로도 일어나는 반응이다.', lesson: 'equilibrium' },
  { term: '화학 평형', also: ['평형'], meaning: '앞으로 가는 반응과 뒤로 가는 반응의 빠르기가 같아져서 분자 수가 더는 변하지 않는 상태다.', lesson: 'equilibrium' },
];

export interface TermMatch {
  start: number;
  end: number;
  entry: Term;
}

const SPELLINGS = GLOSSARY.flatMap((entry) => [entry.term, ...(entry.also ?? [])].map((s) => ({ s, entry })))
  // Longer first, so that 염기성 is not read as 염기, nor 산화수 as 산화.
  .sort((a, b) => b.s.length - a.s.length);

/** A letter that would make the term part of a longer word before it (탄산 is not 산, 이산화탄소 not 산화). */
const WORD = /[가-힣A-Za-z0-9]/;

/**
 * The terms in a caption: each term once, at its first place, at most `max` of them, leaving out
 * the terms of `skipLesson` (the lesson being read: its own words need no link to it).
 */
export function findTerms(text: string, skipLesson: string | null = null, max = 3): TermMatch[] {
  const taken: TermMatch[] = [];
  const seen = new Set<Term>();
  for (const { s, entry } of SPELLINGS) {
    if (entry.lesson === skipLesson || seen.has(entry)) continue;
    let at = text.indexOf(s);
    while (at >= 0) {
      const end = at + s.length;
      const free = !taken.some((m) => at < m.end && end > m.start);
      // Where a longer term begins here (염기성 at the place of 염기), this one is only part of it.
      const part = SPELLINGS.some((o) => o.s.length > s.length && text.startsWith(o.s, at));
      if (free && !part && (at === 0 || !WORD.test(text[at - 1]))) {
        taken.push({ start: at, end, entry });
        seen.add(entry);
        break;
      }
      at = text.indexOf(s, at + 1);
    }
  }
  return taken.sort((a, b) => a.start - b.start).slice(0, max);
}

/** The lesson's title, for the link under a term's meaning. */
export function lessonTitle(id: string): string {
  return CHAPTERS.find((c) => c.id === id)?.title ?? '';
}
