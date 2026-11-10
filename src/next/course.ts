/**
 * The curriculum: 8 units, 51 lessons (docs/plan/curriculum.md).
 * A lesson with `chapter` plays that tutorial scene; the others are not written yet.
 */
import { CHAPTERS } from '../tutorial/chapters';

/** A question asked before a step plays; answered by pressing an atom on the stage. */
export interface Pick {
  /** Index of the step the question comes before. */
  before: number;
  ask: string;
  /** Atoms to choose from, as the script names them (`a.Cl`). */
  from: string[];
  answer: string;
  why: string;
}

export interface Lesson {
  id: string;
  unit: number;
  title: string;
  /** What you can follow in your head after the lesson. */
  goal: string;
  chapter?: string;
  /** A scene written for the lesson itself (instead of the tutorial chapter's). */
  script?: string;
  /** An everyday question the lesson answers. */
  hook?: string;
  summary?: string;
  terms?: [string, string][];
  picks?: Pick[];
  /** Formulas to put in the lab for "직접 해 보기". */
  lab?: string[];
}

export interface Unit {
  n: number;
  title: string;
  /** One line: what this unit is about. */
  about: string;
}

export const UNITS: Unit[] = [
  { n: 1, title: '물질과 입자', about: '모든 물질은 쉬지 않고 움직이는 작은 입자로 되어 있어요.' },
  { n: 2, title: '원자와 전자', about: '원자가 어떤 성질을 보일지는 가장 바깥 전자가 정해요.' },
  { n: 3, title: '화학 결합', about: '원자는 전자를 주고받거나 함께 써서 서로 이어져요.' },
  { n: 4, title: '용액', about: '물속에서 입자가 녹고, 가라앉고, 막을 지나요.' },
  { n: 5, title: '화학 반응', about: '반응이 일어나도 원자는 그대로이고 결합만 바뀌어요.' },
  { n: 6, title: '산과 염기', about: 'H⁺가 한 분자에서 다른 분자로 옮겨 가는 반응이에요.' },
  { n: 7, title: '산화와 환원', about: '전자가 한 원자에서 다른 원자로 옮겨 가는 반응이에요.' },
  { n: 8, title: '탄소 화합물', about: '탄소로 된 분자가 깨지고 이어지는 방법이에요.' },
];

const L = (id: string, title: string, goal: string, more: Partial<Lesson> = {}): Lesson => ({ id, unit: +id.split('-')[0], title, goal, ...more });

export const LESSONS: Lesson[] = [
  L('1-1', '물을 확대하면', '물은 분자로, 분자는 원자로 되어 있음을 화면에서 찾을 수 있다'),
  L('1-2', '입자는 늘 움직인다', '온도가 오르내리면 입자의 움직임이 어떻게 달라지는지 따라갈 수 있다'),
  L('1-3', '확산', '물에 넣은 입자가 퍼져 나가는 과정을 따라갈 수 있다', {
    chapter: 'diffusion',
    hook: '물에 넣은 소금은 젓지 않아도 왜 고루 퍼질까요?',
    summary: '입자는 제멋대로 움직이다가 결국 고루 퍼져요. 이것을 확산이라고 해요.',
    terms: [['확산', '입자가 스스로 움직여 고루 퍼지는 현상']],
  }),
  L('1-4', '분자 사이 인력과 온도', '분자끼리 당기는 힘과 온도에 따른 움직임을 따라갈 수 있다', {
    chapter: 'forces',
    hook: '물 분자들은 무엇 때문에 서로 떨어지지 않을까요?',
    summary: '분자는 서로 당기고 있고, 온도가 오르면 더 빨리 움직여요.',
    terms: [['수소 결합', '한 분자의 H와 옆 분자의 O·N 사이에 생기는 센 인력']],
  }),
  L('1-5', '증발과 응결', '수면의 물 분자가 공기 중으로 나갔다가 다시 액체로 내려오는 과정을 따라갈 수 있다', {
    chapter: 'evaporation',
    hook: '젖은 빨래는 끓이지 않아도 왜 마를까요?',
    summary: '빠른 분자는 수면에서 공기 중으로 나가고(증발), 공기 중의 분자는 다시 액체가 돼요(응결).',
    terms: [['증발', '액체 표면의 분자가 기체가 되어 나가는 것'], ['응결', '기체 분자가 다시 액체가 되는 것']],
  }),
  L('1-6', '끓음', '액체 속에서 기포가 생겨 올라오는 과정을 따라갈 수 있다', {
    chapter: 'boiling',
    hook: '물이 끓을 때 올라오는 방울 속에는 무엇이 있을까요?',
    summary: '끓을 때는 액체 속에서도 물이 기체로 바뀌어요. 기포 속에 있는 것은 수증기예요.',
  }),
  L('1-7', '얼 때와 녹을 때', '물 분자가 육각형 그물로 이어지고 다시 흐트러지는 과정을 따라갈 수 있다', {
    chapter: 'ice',
    hook: '물이 얼면 물 분자는 어떻게 늘어설까요?',
    summary: '물이 얼면 물 분자는 육각형 그물 모양으로 가지런히 이어져요.',
  }),

  L('2-1', '원자 속', '원자핵과 전자가 어디에 있고 전하가 어떻게 0이 되는지 따라갈 수 있다'),
  L('2-2', '전자 껍질과 원자가 전자', '전자가 안쪽 껍질부터 들어가는 차례를 따라갈 수 있다'),
  L('2-3', '주기율표 읽기', '세로줄이 같은 원소는 원자가 전자 수가 같음을 확인할 수 있다'),
  L('2-4', '옥텟 규칙', '원자가 왜 바깥 전자 8개를 가지려 하는지 따라갈 수 있다'),
  L('2-5', '이온', '원자가 전자를 잃거나 얻어 이온이 되는 과정을 따라갈 수 있다'),

  L('3-1', '이온 결합', 'Na의 전자가 Cl로 가고 두 이온이 서로 당기는 과정을 따라갈 수 있다'),
  L('3-2', '공유 결합', 'H 원자 둘이 전자쌍 하나를 함께 쓰게 되는 과정을 따라갈 수 있다'),
  L('3-3', '구조식 읽기', '결합선과 비공유 전자쌍으로 분자를 읽을 수 있다', {
    chapter: 'atoms',
    hook: '분자를 그릴 때 쓰는 선과 점은 무엇을 뜻할까요?',
    summary: '선 하나는 두 원자가 함께 쓰는 전자 두 개이고, 점 두 개는 비공유 전자쌍이에요.',
    terms: [['공유 결합', '두 원자가 전자쌍을 함께 써서 이어진 것'], ['비공유 전자쌍', '결합에 쓰이지 않고 한 원자에만 있는 전자 두 개']],
  }),
  L('3-4', '이중 결합과 삼중 결합', 'O₂, N₂, CO₂에서 전자쌍을 몇 개 함께 쓰는지 셀 수 있다'),
  L('3-5', '전기 음성도와 극성', '결합 전자쌍이 어느 원자 쪽으로 치우치는지 따라갈 수 있다'),
  L('3-6', '분자의 모양', '전자쌍끼리 반발해서 분자 모양이 정해지는 과정을 따라갈 수 있다'),
  L('3-7', '수소 결합', '물 분자끼리 유난히 세게 당기는 까닭을 따라갈 수 있다'),
  L('3-8', '배위 결합', '한 원자가 전자쌍을 통째로 내어 결합을 만드는 과정을 따라갈 수 있다', {
    chapter: 'coordination',
    hook: '전자쌍을 한쪽 원자가 모두 내도 결합이 될까요?',
    summary: '한 원자가 전자쌍을 통째로 내어 만드는 결합을 배위 결합이라고 해요.',
    terms: [['배위 결합', '결합 전자쌍을 한쪽 원자가 모두 낸 공유 결합'], ['착이온', '금속 이온에 분자나 이온이 배위 결합해서 된 이온']],
  }),
  L('3-9', '금속 결합', '금속 원자 사이를 자유 전자가 옮겨 다니는 모습을 따라갈 수 있다'),

  L('4-1', '용해', '물 분자가 이온을 둘러싸서 결정에서 떼어 내는 과정을 따라갈 수 있다', {
    chapter: 'dissolving',
    hook: '소금은 물에 넣으면 왜 안 보일까요?',
    summary: '물 분자는 이온을 둘러싸서 결정에서 하나씩 떼어 내요.',
    terms: [['용해', '물질이 액체에 고루 섞여 들어가는 것'], ['수화', '물 분자가 이온을 둘러싸는 것']],
  }),
  L('4-2', '석출', '녹아 있던 이온이 다시 결정이 되는 과정을 따라갈 수 있다', {
    chapter: 'precipitation',
    hook: '투명한 두 용액을 섞었는데 왜 뿌연 앙금이 생길까요?',
    summary: '물에 잘 녹지 않는 이온 짝은 서로 결합해서 고체가 돼요.',
    terms: [['석출', '녹아 있던 물질이 고체로 나오는 것']],
  }),
  L('4-3', '기체가 물에 녹을 때', 'CO₂가 수면을 지나 물에 녹고 다시 나오는 과정을 따라갈 수 있다'),
  L('4-4', '삼투', '물이 막을 지나 녹은 입자가 많은 쪽으로 가는 과정을 따라갈 수 있다', {
    chapter: 'osmosis',
    hook: '배추를 소금에 절이면 왜 물이 빠져나올까요?',
    summary: '물은 막을 지나, 녹은 입자가 많은 쪽으로 더 많이 건너가요.',
    terms: [['삼투', '물이 막을 지나 농도가 높은 쪽으로 옮겨 가는 현상']],
  }),
  L('4-5', '막 수송', '이온이 통로와 펌프로 막을 지나는 과정을 따라갈 수 있다', {
    chapter: 'membrane',
    hook: '이온은 기름 성분으로 된 세포막을 어떻게 지나갈까요?',
    summary: '이온은 통로로 저절로 지나가거나, 에너지를 쓰는 펌프가 옮겨 줘요.',
    terms: [['능동 수송', '에너지를 써서 입자를 적은 쪽에서 많은 쪽으로 옮기는 것']],
  }),
  L('4-6', '흡착과 이온 교환', '점토 표면의 이온이 다른 이온과 바뀌는 과정을 따라갈 수 있다', {
    chapter: 'exchange',
    hook: '흙은 양분을 어떻게 지니고 있을까요?',
    summary: '점토 표면의 − 부위는 양이온을 지니고 있다가 다른 양이온과 맞바꿔요.',
    terms: [['흡착', '입자가 표면에 달라붙어 있는 것'], ['이온 교환', '표면의 이온이 용액 속 이온과 바뀌는 것']],
  }),
  L('4-7', '씻겨 내려감', '이온이 빗물을 따라 아래로 내려가는 과정을 따라갈 수 있다', {
    chapter: 'leaching',
    hook: '산성비가 내리면 흙 속 칼슘은 어떻게 될까요?',
    summary: '점토에서 떨어져 나온 이온은 빗물을 따라 아래로 내려가요.',
    terms: [['용탈', '흙 속 성분이 물에 녹아 아래로 씻겨 내려가는 것']],
  }),

  L('5-1', '화학 반응이란', '반응 전과 후에 원자는 그대로이고 결합만 바뀜을 원자 하나하나로 확인할 수 있다'),
  L('5-2', '화학 반응식', '반응식의 계수가 분자 수이고 양쪽 원자 수가 같음을 셀 수 있다'),
  L('5-3', '전자쌍의 이동과 전하', '전자쌍이 옮겨 가며 결합과 전하가 바뀌는 과정을 따라갈 수 있다', {
    chapter: 'arrows',
    hook: '결합이 새로 생길 때 전자는 어디에서 올까요?',
    summary: '전자쌍이 옮겨 가면 새 결합이 생기고, 전하도 그에 따라 바뀌어요.',
    terms: [['형식 전하', '원자가 원래 가진 전자 수와 지금 가진 전자 수의 차이']],
    picks: [{ before: 2, ask: '새 N–H 결합에 쓰일 전자쌍은 어느 원자에서 올까요?', from: ['n.N', 'h.H'], answer: 'n.N', why: 'H⁺에는 전자가 하나도 없어요. 그래서 전자쌍은 N이 내요.' }],
    lab: ['NH3', 'H+'],
  }),
  L('5-4', '반응과 에너지', '반응이 에너지 언덕을 넘는 과정을 그래프에서 따라갈 수 있다', {
    chapter: 'energy',
    hook: '반응이 일어나려면 왜 처음에 에너지가 필요할까요?',
    summary: '반응은 에너지 언덕을 넘어야 일어나요. 이 언덕의 높이가 활성화 에너지예요.',
    terms: [['활성화 에너지', '반응이 일어나려면 넘어야 하는 에너지 언덕의 높이'], ['발열 반응', '에너지가 낮아지며 열이 나오는 반응']],
  }),
  L('5-5', '반응이 빨라지는 조건', '온도·농도·촉매가 충돌과 에너지 언덕을 어떻게 바꾸는지 따라갈 수 있다'),
  L('5-6', '화학 평형', '정반응과 역반응이 같은 빠르기로 일어나는 상태를 따라갈 수 있다', {
    chapter: 'equilibrium',
    hook: '반응은 재료가 다 없어져야만 멈출까요?',
    summary: '정반응과 역반응의 빠르기가 같아지면 분자 수가 더는 변하지 않아요.',
    terms: [['화학 평형', '정반응과 역반응의 빠르기가 같아서 양이 변하지 않는 상태']],
  }),

  L('6-1', '산', 'HCl이 물에 녹을 때 H⁺가 어디로 가는지 따라갈 수 있다', {
    chapter: 'acid-hcl',
    script: `scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol w = H2O at 330,310
mol a = HCl at 640,310

step "물 분자가 HCl에 다가가요. 이때 O의 비공유 전자쌍은 HCl의 H 쪽을 향해 있어요"
  approach w.O a.H
step "O의 전자쌍은 새 O–H 결합이 되고, H–Cl 결합의 전자쌍은 Cl로 옮겨 가요"
  transfer a.H to w.O
step "이렇게 해서 하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고, 둘레의 물 분자가 두 이온을 둘러싸요"
  solvate all
`,
    hook: '산을 물에 넣으면 무슨 일이 일어날까요?',
    summary: '산은 물에 녹아 H⁺를 내주는 물질이에요.',
    terms: [['산', '물에 녹아 H⁺를 내주는 물질'], ['하이드로늄 이온', '물 분자가 H⁺ 하나를 얻어서 된 이온(H₃O⁺)']],
    picks: [{ before: 1, ask: 'H와 Cl을 잇던 전자쌍은 어느 원자로 갈까요?', from: ['a.H', 'a.Cl'], answer: 'a.Cl', why: 'Cl은 H보다 전자를 세게 당겨요. 그래서 둘을 잇던 전자쌍은 Cl로 가요.' }],
    lab: ['HCl', 'H2O'],
  }),
  L('6-2', '염기', 'NH₃가 물에서 H⁺를 얻을 때 물 분자가 무엇이 되는지 따라갈 수 있다', {
    chapter: 'base-nh3',
    hook: '암모니아를 물에 넣으면 왜 염기성이 될까요?',
    summary: '염기는 H⁺를 얻는 물질이에요. H⁺를 내준 물 분자는 OH⁻가 돼요.',
    terms: [['염기', 'H⁺를 얻는 물질'], ['수산화 이온', '물 분자가 H⁺ 하나를 내주고 된 이온(OH⁻)']],
    picks: [{ before: 1, ask: 'O와 H를 잇던 전자쌍은 어느 원자로 갈까요?', from: ['w.H1', 'w.O'], answer: 'w.O', why: 'H는 N과 새로 결합해요. 그래서 O–H 결합의 전자쌍은 O에 남아요.' }],
    lab: ['NH3', 'H2O'],
  }),
  L('6-3', '강한 산과 약한 산', '아세트산 분자 가운데 일부만 H⁺를 내주는 모습을 따라갈 수 있다'),
  L('6-4', '중화 반응', 'H₃O⁺와 OH⁻가 물이 되는 과정을 따라갈 수 있다', {
    chapter: 'neutralization',
    hook: '산과 염기를 섞으면 왜 둘 다 성질을 잃을까요?',
    summary: 'H₃O⁺와 OH⁻는 서로 반응해서 물이 돼요.',
    terms: [['중화', '산의 H₃O⁺와 염기의 OH⁻가 반응해 물이 되는 것']],
    lab: ['H3O+', 'OH-'],
  }),
  L('6-5', 'pH', 'H₃O⁺가 많고 적음이 곧 산성과 염기성임을 셀 수 있다'),

  L('7-1', '산화와 환원', 'Zn의 전자가 Cu²⁺로 가는 과정을 따라갈 수 있다', {
    chapter: 'redox',
    hook: '아연 조각을 푸른 구리 용액에 넣으면 왜 구리가 생길까요?',
    summary: '전자를 잃는 것이 산화이고, 전자를 얻는 것이 환원이에요.',
    terms: [['산화', '원자가 전자를 잃는 것'], ['환원', '원자가 전자를 얻는 것']],
    picks: [{ before: 2, ask: '둘 가운데 전자를 내주는 쪽은 어느 것일까요?', from: ['z.Zn', 'c.Cu'], answer: 'z.Zn', why: '아연 원자에는 내줄 바깥 전자가 2개 있고, 구리 이온은 전자가 2개 모자라요.' }],
    lab: ['Zn', 'Cu2+'],
  }),
  L('7-2', '산화수', '원자마다 전자를 몇 개 잃고 얻었는지 셀 수 있다'),
  L('7-3', '금속의 반응성', '어떤 금속이 전자를 더 쉽게 내주는지 견줄 수 있다'),
  L('7-4', '전지', '전자가 도선을 지나며 전류가 되는 과정을 따라갈 수 있다', {
    chapter: 'cell',
    hook: '전지는 어떻게 전기를 만들까요?',
    summary: '전자가 도선을 지나가게 하면 산화·환원에서 전류를 얻을 수 있어요.',
    terms: [['전류', '도선을 따라 흐르는 전자'], ['염다리', '두 용액의 전하를 맞춰 주는 이온의 통로']],
  }),
  L('7-5', '전기 분해', '전류로 반응을 거꾸로 일으키는 과정을 따라갈 수 있다'),

  L('8-1', '탄소 화합물', '탄소가 결합 네 개로 사슬과 고리를 만드는 모습을 따라갈 수 있다'),
  L('8-2', '작용기', '−OH, −COOH, −NH₂가 분자의 성질을 정함을 견줄 수 있다'),
  L('8-3', '라디칼 반응', '빛이 결합을 깨서 홑전자가 생기는 과정을 따라갈 수 있다', {
    chapter: 'radical',
    hook: '빛은 어떻게 분자를 깰까요?',
    summary: '빛이 결합을 깨면 홑전자가 있는 라디칼이 생기고, 라디칼은 다른 결합을 깨며 반응을 이어 가요.',
    terms: [['라디칼', '짝을 이루지 못한 홑전자가 있는 원자나 분자']],
  }),
  L('8-4', '치환 반응', '원자 하나가 떠나고 다른 원자가 그 위치에 결합하는 과정을 따라갈 수 있다', {
    chapter: 'substitution',
    hook: '분자에서 원자 하나만 다른 것으로 바꿀 수 있을까요?',
    summary: '치환 반응에서는 원자 하나가 떨어져 나가고 다른 원자가 그 위치에 결합해요.',
    terms: [['치환 반응', '분자의 원자 하나가 다른 원자나 원자단으로 바뀌는 반응']],
  }),
  L('8-5', '첨가 반응', '이중 결합 하나가 깨지며 원자 둘이 결합하는 과정을 따라갈 수 있다', {
    chapter: 'addition',
    hook: '이중 결합이 있는 분자는 왜 반응을 잘할까요?',
    summary: '첨가 반응에서는 이중 결합 가운데 하나가 깨지고 두 원자가 새로 결합해요.',
    terms: [['첨가 반응', '이중 결합이 있던 두 원자에 원자가 하나씩 더해지는 반응']],
  }),
  L('8-6', '축합과 가수분해', '물이 빠지며 두 분자가 이어지고 물이 들어가며 다시 나뉘는 과정을 따라갈 수 있다', {
    chapter: 'condensation',
    hook: '아미노산은 어떻게 이어져서 단백질이 될까요?',
    summary: '물 분자 하나가 빠지며 두 분자가 이어지고(축합), 물이 들어가면 다시 나뉘어요(가수분해).',
    terms: [['축합', '물 분자가 빠지며 두 분자가 이어지는 반응'], ['가수분해', '물 분자가 들어가며 결합이 깨지는 반응']],
  }),
  L('8-7', '고분자', '같은 축합이 되풀이되어 긴 사슬이 되는 과정을 따라갈 수 있다'),
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const scriptOf = (l: Lesson): string | null => l.script ?? CHAPTERS.find((c) => c.id === l.chapter)?.script ?? null;
export const ready = (l: Lesson): boolean => !!l.chapter;

/** The lesson after this one that can be played. */
export function nextReady(l: Lesson): Lesson | null {
  const i = LESSONS.indexOf(l);
  return LESSONS.slice(i + 1).find(ready) ?? null;
}

// ---------------------------------------------------------------- progress (kept in this browser)

const KEY = 'chemvis.done';
export function doneSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
export function markDone(id: string): void {
  const s = doneSet();
  s.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* private mode: progress is simply not kept */
  }
}
/** The first playable lesson not yet done. */
export function upNext(): Lesson {
  const d = doneSet();
  return LESSONS.find((l) => ready(l) && !d.has(l.id)) ?? LESSONS.find(ready)!;
}
