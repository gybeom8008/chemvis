/**
 * Tutorial chapters. Each chapter introduces one kind of change, plays a
 * standard example, shows the script that produced it side by side, and
 * suggests one edit to try. The scripts double as examples for AI and as
 * the automated test set.
 */
export interface Chapter {
  id: string;
  part: number;
  title: string;
  /** HTML */
  intro: string;
  script: string;
  /** HTML */
  tryIt: string;
}

export const PARTS = [
  { id: 0, title: '0부 · 화면 문법' },
  { id: 1, title: '1부 · 현상' },
  { id: 2, title: '2부 · 반응' },
];

const s = (x: string) => x.replace(/^\n/, '');

export const CHAPTERS: Chapter[] = [
  // ------------------------------------------------------------------ part 0
  {
    id: 'atoms',
    part: 0,
    title: '원자, 결합, 전자쌍',
    intro: `<p>물질의 변화를 원자와 전자로 보여 줘요. 물 분자 하나로 화면 표시부터 익혀요.</p>
<ul class="legend"><li><i class="g-atom"></i>원자</li><li><i class="g-bond"></i>공유 결합(전자 2개)</li><li><i class="g-lp"></i>비공유 전자쌍</li></ul>`,
    script: s(`
scene "물 분자 하나"
stage solution
mol w = H2O at center

step "산소(O) 원자 하나와 수소(H) 원자 둘이 물 분자 하나를 이뤄요"
  note w.O "산소 원자"
  note w.H1 "수소 원자"
step "선 하나가 공유 결합 하나예요. O와 H가 전자 두 개를 함께 써요"
  note w.O~w.H1 "공유 결합 = 전자 2개"
step "O 둘레의 점 두 개가 비공유 전자쌍이에요. O에는 이런 쌍이 둘 있어요"
  note w.O:lp "비공유 전자쌍"
step "O 둘레의 전자를 세면 결합 2개(전자 4개)와 비공유 전자쌍 2개(전자 4개), 모두 8개예요"
  note w.O "전자 8개(옥텟)"
`),
    tryIt: `<code>H2O</code>를 <code>NH3</code>로, <code>w.O</code>를 <code>w.N</code>으로 바꿔 보세요.`,
  },
  {
    id: 'arrows',
    part: 0,
    title: '굽은 화살표와 전하',
    intro: `<p>반응에서 움직이는 것은 전자예요. 굽은 화살표의 꼬리는 전자쌍이 있던 곳, 머리는 전자쌍이 가는 곳이에요.</p>
<ul class="legend"><li><i class="g-arrow"></i>전자쌍 이동</li><li><i class="g-charge">+</i>형식 전하</li><li><i class="g-focus"></i>이번 단계에서 움직이는 것</li></ul>`,
    script: s(`
scene "암모니아가 수소 이온과 결합할 때"
stage solution
mol n = NH3 at left
mol h = H+ at right

step "수소 이온(H+)에는 전자가 하나도 없어요. 그래서 전하가 +1이에요"
  note h.H "전자 0개, 전하 +1"
step "암모니아의 N이 비공유 전자쌍을 앞세워 H+에 다가가요"
  approach n.N h.H
step "N의 비공유 전자쌍이 N과 H 사이로 옮겨 가 새 결합이 생겨요"
  arrow n.N:lp -> n.N~h.H
step "이제 전하 +1은 N에 표시돼요. N이 자기 전자쌍을 결합에 내주었기 때문이에요"
  note n.N "형식 전하 +1"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>n.N</code>을 <code>n.O</code>로 바꾸면 H₃O⁺가 생겨요.`,
  },
  {
    id: 'forces',
    part: 0,
    title: '분자 사이 인력과 온도',
    intro: `<p>물 분자의 O는 조금 −, H는 조금 +를 띠어 이웃 분자끼리 서로 당겨요(수소 결합). 온도는 입자가 움직이는 빠르기예요.</p>
<ul class="legend"><li><i class="g-attract"></i>분자 사이 인력</li></ul>`,
    script: s(`
scene "물 분자들 사이의 수소 결합"
stage solution
lens attract on
crowd H2O in water 44
mol w = H2O at center

step "파란 점선이 수소 결합이에요. 한 분자의 H와 이웃 분자의 O 사이에 생겨요"
  note w.O "조금 − (δ−)"
  note w.H1 "조금 + (δ+)"
step "물을 가열하면 분자들이 더 빨리 움직여요"
  heat water
step "식히면 움직임이 다시 느려져요"
  cool water
`),
    tryIt: `보기 설정에서 <b>분자 사이 인력</b>을 끄고 켜 보세요.`,
  },

  // ------------------------------------------------------------------ part 1
  {
    id: 'diffusion',
    part: 1,
    title: '확산',
    intro: `<p>입자는 늘 무작위로 움직여요. 그 결과 몰려 있던 입자가 고르게 퍼지는 것이 확산이에요.</p>
<ul class="legend"><li><i class="g-trail"></i>지나간 경로</li></ul>`,
    script: s(`
scene "소금물 한 방울이 퍼질 때"
stage solution
crowd H2O in water 28
place Na+ in left x5
place Cl- in left x5

step "Na+ 이온과 Cl- 이온이 왼쪽에 몰려 있어요"
  note left "이온이 몰린 쪽"
step "이온들이 무작위로 움직이며 물 전체로 퍼져요"
  spread Na+ Cl- in water
`),
    tryIt: `<code>in water</code>를 <code>in right</code>로 바꿔 보세요. 대본은 쓰인 대로 그려요.`,
  },
  {
    id: 'evaporation',
    part: 1,
    title: '증발과 응결',
    intro: `<p>수면의 물 분자가 충분히 빨리 움직이면 이웃과의 인력을 벗어나 공기로 나가요(증발). 공기 중의 분자가 액체로 내려오면 응결이에요.</p>`,
    script: s(`
scene "물이 증발하고 응결할 때"
stage interface
crowd H2O in water 52
crowd H2O in air 3

step "액체 속 물 분자들은 수소 결합(파란 점선)으로 서로 당기고 있어요"
  note water "수소 결합으로 이어진 물 분자들"
step "물을 가열하면 분자들의 움직임이 빨라져요"
  heat water
step "수면의 물 분자 하나가 이웃과의 인력을 벗어나 공기로 나가요(증발)"
  evaporate H2O
step "또 하나가 증발해요"
  evaporate H2O
step "공기 중의 물 분자 하나가 수면 아래로 내려와 액체에 섞여요(응결)"
  condense H2O
`),
    tryIt: `<code>heat water</code>를 <code>cool water</code>로 바꿔 보세요.`,
  },
  {
    id: 'dissolving',
    part: 1,
    title: '용해',
    intro: `<p>물 분자는 Na⁺ 쪽으로 O를, Cl⁻ 쪽으로 H를 향해 모여요. 물 분자에 둘러싸인 이온이 결정에서 떨어져 나오는 것이 용해예요.</p>`,
    script: s(`
scene "소금이 물에 녹을 때"
stage solution
lens attract on
crowd H2O in water 46
crystal s = NaCl at bottom 5x3

step "Na+와 Cl-가 번갈아 줄지은 소금 결정이에요"
  note s "NaCl 결정"
step "모서리의 이온 둘이 물 분자에 둘러싸여 결정에서 떨어져 나와요"
  dissolve 2 from s
step "다른 이온 둘도 떨어져 나와요"
  dissolve 2 from s
`),
    tryIt: `<code>NaCl</code>을 <code>KBr</code>로 바꿔 보세요.`,
  },
  {
    id: 'exchange',
    part: 1,
    title: '흡착과 이온 교환',
    intro: `<p>점토 표면의 음전하 부위(−)에는 양이온이 흡착해 있어요. 빗물의 H⁺가 그 부위를 차지하면 원래 있던 양이온이 물속으로 나와요. 전하 합은 늘 같아야 해요.</p>`,
    script: s(`
scene "점토 표면의 이온 교환"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "점토 표면의 음전하 부위(−)에 Ca2+와 K+가 흡착해 있어요"
  note c "Ca2+ (전하 +2, 부위 2개)"
  note k "K+ (전하 +1, 부위 1개)"
step "빗물의 H+ 두 개가 Ca2+ 하나를 대신해요. 떨어져 나온 Ca2+는 공극의 물속으로 나와요"
  exchange c with 2 H+ on clay
`),
    tryIt: `<code>2 H+</code>를 <code>1 H+</code>로 바꾸면 전하 오류가 나요.`,
  },
  {
    id: 'leaching',
    part: 1,
    title: '씻겨 내려감(용탈)',
    intro: `<p>물에 녹아 나온 이온은 빗물과 함께 공극을 따라 아래로 내려가요. 대본의 <code>leach</code> 한 줄이 빗물 흐름, 수화, 이동을 모두 그려요.</p>`,
    script: s(`
scene "산성비가 내린 흙에서 칼슘이 씻겨 내려갈 때"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "빗물의 H+ 두 개가 점토 표면의 Ca2+ 하나를 대신해요"
  exchange c with 2 H+ on clay
step "떨어져 나온 Ca2+가 물 분자에 둘러싸여 빗물과 함께 속흙으로 내려가요"
  leach c from topsoil to subsoil
step "흡착해 있는 K+는 그대로 남아요. 씻겨 내려가는 것은 물에 녹아 나온 이온이에요"
  note k "아직 흡착해 있는 K+"
`),
    tryIt: `<code>to subsoil</code>을 <code>to groundwater</code>로 바꿔 보세요.`,
  },

  // ------------------------------------------------------------------ part 2
  {
    id: 'acid-hcl',
    part: 2,
    title: '산·염기: 양성자 이동',
    intro: `<p>산은 H⁺를 내주고, 염기는 비공유 전자쌍으로 그 H⁺와 결합해요. HCl과 물 사이에서 화살표 두 개가 한꺼번에 움직여요.</p>`,
    script: s(`
scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol a = HCl at left
mol w = H2O at center

step "물 분자의 O가 비공유 전자쌍을 앞세워 HCl의 H에 다가가요"
  approach w.O a.H
step "O의 전자쌍은 O–H 새 결합으로, H–Cl 결합의 전자쌍은 Cl로 옮겨 가요"
  transfer a.H to w.O
step "하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고 물 분자들이 둘러싸요"
  solvate all
`),
    tryIt: `<code>transfer a.H to w.O</code>는 두 줄과 같아요: <code>arrow w.O:lp -> w.O~a.H</code> <code>arrow a.H~a.Cl -> a.Cl</code>`,
  },
  {
    id: 'base-nh3',
    part: 2,
    title: '산·염기: 물이 산이 될 때',
    intro: `<p>물은 상대에 따라 산도 되고 염기도 돼요. 암모니아 옆에서는 물이 H⁺를 내주는 산이 돼요.</p>`,
    script: s(`
scene "암모니아가 물에서 염기로 작용할 때"
stage solution
crowd H2O in water 30
mol n = NH3 at left
mol w = H2O at center

step "암모니아의 N이 비공유 전자쌍을 앞세워 물 분자의 H에 다가가요"
  approach n.N w.H1
step "N의 전자쌍은 N–H 새 결합으로, O–H 결합의 전자쌍은 O로 옮겨 가요"
  transfer w.H1 to n.N
step "암모늄 이온(NH4+)과 수산화 이온(OH-)이 생겨요"
  note n.N "NH4+의 N: 전하 +1"
  note w.O "OH-의 O: 전하 −1"
`),
    tryIt: `마지막 단계에 <code>solvate all</code>을 더해 보세요.`,
  },
];
