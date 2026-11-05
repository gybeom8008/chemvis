/**
 * Tutorial: the basic kinds of change, one chapter each, in the order a newcomer
 * needs them. Each chapter says what the term means, plays a standard example,
 * shows the script beside it, and suggests one edit to try. Scenes about one
 * particular topic live in examples.ts instead.
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
  { id: 0, title: '0부 · 화면 읽는 법' },
  { id: 1, title: '1부 · 물리 변화: 물질은 그대로인 변화' },
  { id: 2, title: '2부 · 화학 반응: 새 물질이 생기는 변화' },
  { id: 3, title: '3부 · 에너지와 평형' },
];

const s = (x: string) => x.replace(/^\n/, '');

export const CHAPTERS: Chapter[] = [
  // ------------------------------------------------------------------ part 0
  {
    id: 'atoms',
    part: 0,
    title: '원자, 결합, 전자쌍',
    intro: `<p>물질은 모두 원자로 되어 있어요. 원자끼리는 둘레의 전자를 함께 쓰면서 결합하고, 화학 반응은 이 전자가 옮겨 가면서 결합이 생기거나 없어지는 일이에요. 이 앱에서는 원자를 색깔 공으로, 결합을 선으로, 결합하지 않은 전자를 점으로 그려요. 먼저 물 분자 하나로 화면 읽는 법을 익혀 봐요.</p>
<ul class="legend"><li><i class="g-atom"></i>원자</li><li><i class="g-bond"></i>공유 결합(전자 2개)</li><li><i class="g-lp"></i>비공유 전자쌍</li></ul>`,
    script: s(`
scene "물 분자 하나"
stage solution
mol w = H2O at center

step "산소(O) 원자 하나와 수소(H) 원자 둘이 모여 물 분자 하나가 돼요"
  note w.O "산소 원자"
  note w.H1 "수소 원자"
step "선 하나가 공유 결합 하나예요. O와 H가 전자 두 개를 함께 써요"
  note w.O~w.H1 "공유 결합: 전자 2개"
step "O 둘레의 점 두 개는 결합에 쓰이지 않은 전자 한 쌍이에요. 이걸 비공유 전자쌍이라고 하고, O에는 이런 쌍이 둘 있어요"
  note w.O:lp "비공유 전자쌍"
step "O 둘레의 전자를 세어 보면 결합 둘에 4개, 비공유 전자쌍 둘에 4개, 모두 8개예요"
  note w.O "전자 8개(옥텟)"
`),
    tryIt: `<code>H2O</code>를 <code>NH3</code>로, <code>w.O</code>를 <code>w.N</code>으로 바꿔 보세요.`,
  },
  {
    id: 'arrows',
    part: 0,
    title: '굽은 화살표와 전하',
    intro: `<p>반응할 때 실제로 움직이는 건 원자보다 전자예요. 굽은 화살표는 전자가 어디서 어디로 가는지 보여 줘요. 꼬리가 전자가 있던 곳, 머리가 전자가 가는 곳이에요. 전자 2개(전자쌍)가 움직이면 두 줄 화살표, 전자 1개가 움직이면 한 줄 화살표로 그려요. 원자 둘레의 전자가 중성일 때보다 적으면 +, 많으면 − 전하를 원자 옆에 표시해요.</p>
<ul class="legend"><li><i class="g-arrow"></i>전자쌍 이동</li><li><i class="g-hook"></i>전자 1개 이동</li><li><i class="g-charge">+</i>전하</li><li><i class="g-focus"></i>이번 단계에서 움직이는 것</li></ul>`,
    script: s(`
scene "암모니아와 수소 이온이 결합할 때"
stage solution
mol n = NH3 at left
mol h = H+ at right

step "수소 이온(H+)에는 전자가 하나도 없어요. 그래서 전하가 +1이에요"
  note h.H "전자 0개, 전하 +1"
step "암모니아가 H+ 쪽으로 다가가요. N의 비공유 전자쌍이 H+를 향해요"
  approach n.N h.H
step "N의 비공유 전자쌍이 N과 H 사이로 옮겨 가면서 새 결합이 생겨요"
  arrow n.N:lp -> n.N~h.H
step "이제 +1 전하는 N에 표시돼요. N이 자기 전자쌍을 결합에 내줬기 때문이에요"
  note n.N "형식 전하 +1"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>n.N</code>을 <code>n.O</code>로 바꾸면 H₃O⁺가 생겨요.`,
  },
  {
    id: 'forces',
    part: 0,
    title: '분자 사이 인력과 온도',
    intro: `<p>분자끼리도 서로 약하게 당겨요. 물에서는 한 분자의 H와 옆 분자의 O가 당기는 힘(수소 결합)이 특히 강해요. 물이 100℃나 되어야 끓고 얼음이 물에 뜨는 것도 이 힘 때문이에요. 온도는 입자가 얼마나 빨리 움직이는지를 나타내요.</p>
<ul class="legend"><li><i class="g-attract"></i>분자 사이 인력</li></ul>`,
    script: s(`
scene "물 분자 사이의 수소 결합"
stage solution
lens attract on
crowd H2O in water 44
mol w = H2O at center

step "분자 사이에 그어진 점선이 수소 결합이에요. 한 분자의 H와 옆 분자의 O 사이에 생겨요"
  note w.O "조금 − (δ−)"
  note w.H1 "조금 + (δ+)"
step "물을 데우면 분자가 더 빨리 움직여요"
  heat water
step "식히면 다시 느려져요"
  cool water
`),
    tryIt: `보기 설정에서 <b>분자 사이 인력</b>을 껐다 켜 보세요.`,
  },
  // ------------------------------------------------------------------ part 1
  {
    id: 'diffusion',
    part: 1,
    title: '확산',
    intro: `<p>입자는 늘 제멋대로 움직여요. 그래서 한곳에 몰려 있던 입자도 시간이 지나면 고르게 퍼지는데, 이걸 확산이라고 해요. 방 안에 향기가 퍼지고 물에 잉크가 번지는 게 확산이에요.</p>
<ul class="legend"><li><i class="g-trail"></i>지나간 경로</li></ul>`,
    script: s(`
scene "소금물 한 방울이 퍼질 때"
stage solution
crowd H2O in water 28
place Na+ in left x5
place Cl- in left x5

step "Na+와 Cl-가 왼쪽에 몰려 있어요"
  note left "이온이 몰린 쪽"
step "이온이 제멋대로 움직이면서 물 전체로 퍼져요"
  spread Na+ Cl- in water
`),
    tryIt: `<code>in water</code>를 <code>in right</code>로 바꿔 보세요. 대본에 적힌 대로 그려요.`,
  },
  {
    id: 'evaporation',
    part: 1,
    title: '증발과 응결',
    intro: `<p>액체 표면의 분자가 이웃 분자가 당기는 힘을 이길 만큼 빨리 움직이면, 기체가 되어 공기 중으로 나가요. 이걸 증발이라고 해요. 거꾸로 공기 중의 기체 분자가 다시 액체가 되는 건 응결이에요. 빨래가 마르는 건 증발, 찬 컵 겉에 물방울이 맺히는 건 응결이에요.</p>`,
    script: s(`
scene "물이 증발하고 응결할 때"
stage interface
crowd H2O in water 52
crowd H2O in air 3

step "액체 속 물 분자는 수소 결합으로 서로 당기고 있어요"
  note water "수소 결합으로 이어진 물 분자"
step "물을 데우면 분자가 더 빨리 움직여요"
  heat water
step "수면에 있던 물 분자 하나가 이웃 분자가 당기는 힘을 이기고 공기 중으로 나가요(증발)"
  evaporate H2O
step "하나 더 증발해요"
  evaporate H2O
step "공기 중의 물 분자 하나가 수면 아래로 내려와 다시 액체가 돼요(응결)"
  condense H2O
`),
    tryIt: `<code>heat water</code>를 <code>cool water</code>로 바꿔 보세요.`,
  },
  {
    id: 'boiling',
    part: 1,
    title: '끓음',
    intro: `<p>증발은 액체 표면에서만 일어나요. 끓을 때는 액체 속에서도 분자가 기체로 바뀌면서 기포가 생겨요. 기포는 떠올라 수면에서 터지고, 그 안의 기체는 공기 중으로 나가요. 액체가 끓기 시작하는 온도를 끓는점이라고 해요.</p>`,
    script: s(`
scene "물이 끓을 때"
stage interface
crowd H2O in water 50
crowd H2O in air 2

step "물을 세게 가열해요. 분자가 아주 빨리 움직여요"
  heat water
step "액체 속에서 물 분자 몇 개가 기체로 바뀌면서 기포가 생기고, 기포가 떠올라요"
  boil 3
step "기포가 또 생겨서 떠올라요"
  boil 4
`),
    tryIt: `<code>boil 3</code>의 숫자를 바꾸면 기포 하나에 있는 물 분자 수가 달라져요(2~6).`,
  },
  {
    id: 'ice',
    part: 1,
    title: '응고와 융해: 얼음이 얼고 녹을 때',
    intro: `<p>액체가 고체로 바뀌는 걸 응고(어는 것), 고체가 액체로 바뀌는 걸 융해(녹는 것)라고 해요. 액체 물에서는 수소 결합이 쉴 새 없이 생겼다 없어지면서 제멋대로 이어져 있어요. 온도가 내려가면 물 분자가 육각형 그물 모양으로 가지런히 이어지면서 얼음이 돼요. 이 그물에는 빈틈이 많아서 얼음이 물보다 가벼워요.</p>
<ul class="legend"><li><i class="g-attract"></i>분자 사이 인력</li></ul>`,
    script: s(`
scene "물이 얼고 녹을 때"
stage solution
lens attract on
crowd H2O in water 40

step "액체 물에서는 수소 결합이 제멋대로 이어져 있어요"
  wait
step "온도가 내려가면 물 분자가 육각형 그물 모양으로 가지런히 이어지면서 얼음이 돼요"
  freeze water
step "다시 데우면 그물이 흐트러지면서 녹아요"
  melt water
`),
    tryIt: `얼음 단계에서 보기 설정의 <b>분자 사이 인력</b>을 껐다 켜면서 그물 모양을 비교해 보세요.`,
  },
  {
    id: 'dissolving',
    part: 1,
    title: '용해',
    intro: `<p>소금을 물에 넣으면 보이지 않게 녹아요. 이렇게 한 물질이 다른 물질 속에 고르게 흩어져 섞이는 걸 용해라고 해요. 물 분자는 Na⁺ 쪽으로는 O를, Cl⁻ 쪽으로는 H를 향한 채 이온을 둘러싸고, 둘러싸인 이온은 결정에서 떨어져 나와요. 녹아도 물질 자체는 그대로라서 물을 증발시키면 소금이 다시 남아요.</p>`,
    script: s(`
scene "소금이 물에 녹을 때"
stage solution
lens attract on
crowd H2O in water 46
crystal s = NaCl at bottom 5x3

step "Na+와 Cl-가 번갈아 줄지어 있는 소금 결정이에요"
  note s "NaCl 결정"
step "모서리에 있는 이온 둘이 물 분자에 둘러싸여 결정에서 떨어져 나와요"
  dissolve 2 from s
step "다른 이온 둘도 떨어져 나와요"
  dissolve 2 from s
`),
    tryIt: `<code>NaCl</code>을 <code>KBr</code>로 바꿔 보세요.`,
  },
  {
    id: 'precipitation',
    part: 1,
    title: '석출(침전)',
    intro: `<p>어떤 이온 짝은 서로 당기는 힘이 물 분자가 당기는 힘보다 세서, 물 분자를 떨치고 고체 결정을 이뤄요. 이걸 석출 또는 침전이라고 해요. 맑은 용액 두 가지를 섞었는데 뿌옇게 흐려지면서 가루가 가라앉는다면 침전이 생긴 거예요. 짝을 이루지 못한 이온은 녹은 채로 남아요.</p>`,
    script: s(`
scene "질산은 용액과 소금물을 섞을 때"
stage solution
crowd H2O in water 30
place Ag+ in left x3
place NO3- in left x3
place Na+ in right x3
place Cl- in right x3

step "질산은 용액(Ag+, NO3-)과 소금물(Na+, Cl-)을 섞었어요"
  spread Ag+ NO3- Na+ Cl- in water
step "Ag+와 Cl-가 물 분자를 떨치고 서로 결합해서 고체 염화은(AgCl) 결정이 돼요"
  precipitate Ag+ Cl- x3
step "Na+와 NO3-는 녹은 채로 남아요"
  note Na+ "녹은 채 남은 Na+"
`),
    tryIt: `<code>x3</code>을 <code>x2</code>로 바꾸면 Ag+와 Cl-가 하나씩 녹은 채로 남아요.`,
  },
  {
    id: 'exchange',
    part: 1,
    title: '흡착과 이온 교환',
    intro: `<p>흡착은 어떤 물질이 다른 물질의 표면에 달라붙는 거예요. 흙 속 점토 알갱이 표면에는 음전하(−)를 띤 부위가 있어서, Ca²⁺나 K⁺ 같은 양이온이 여기에 흡착해 있어요. 빗물의 H⁺가 이 부위를 차지하면 원래 있던 양이온이 물속으로 떨어져 나오는데, 이걸 이온 교환이라고 해요. 이때 들어오는 이온과 나가는 이온의 전하 합은 같아야 해요.</p>`,
    script: s(`
scene "점토 표면에서 일어나는 이온 교환"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "점토 표면의 음전하 부위(−)에 Ca2+와 K+가 흡착해 있어요"
  note c "Ca2+: 전하 +2, 부위 2개"
  note k "K+: 전하 +1, 부위 1개"
step "빗물의 H+ 두 개가 Ca2+ 하나와 바뀌어요. 떨어져 나온 Ca2+는 흙 틈의 물속으로 나와요"
  exchange c with 2 H+ on clay
`),
    tryIt: `<code>2 H+</code>를 <code>1 H+</code>로 바꾸면 전하가 맞지 않는다는 오류가 나요.`,
  },
  {
    id: 'leaching',
    part: 1,
    title: '씻겨 내려감(용탈)',
    intro: `<p>물에 녹아 나온 이온은 빗물과 함께 흙 틈을 따라 아래로 내려가요. 이걸 용탈이라고 해요. 비가 많이 오는 곳에서 흙의 양분이 빠져나가 땅이 척박해지는 까닭 가운데 하나예요.</p>`,
    script: s(`
scene "산성비가 내린 흙에서 칼슘이 씻겨 내려갈 때"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "빗물의 H+ 두 개가 점토 표면의 Ca2+ 하나와 바뀌어요"
  exchange c with 2 H+ on clay
step "떨어져 나온 Ca2+가 물 분자에 둘러싸인 채 빗물을 따라 속흙으로 내려가요"
  leach c from topsoil to subsoil
step "흡착해 있는 K+는 그대로 남아요. 씻겨 내려가는 건 물에 녹아 나온 이온뿐이에요"
  note k "아직 흡착해 있는 K+"
`),
    tryIt: `<code>to subsoil</code>을 <code>to groundwater</code>로 바꿔 보세요.`,
  },
  {
    id: 'membrane',
    part: 1,
    title: '막 수송: 통로와 펌프',
    intro: `<p>세포막은 기름 성분(인지질) 두 층으로 되어 있어서 이온이 그냥은 지나가지 못해요. 이온은 막에 박힌 단백질을 거쳐서 지나가요. 농도(일정한 부피 안에 있는 입자 수)가 높은 쪽에서 낮은 쪽으로 통로를 지나가는 건 확산이고, 에너지를 써서 반대쪽으로 옮기는 건 능동 수송이에요.</p>`,
    script: s(`
scene "세포막을 지나가는 이온"
stage membrane
protein k = channel K+ at 330
protein p = pump at 680
crowd H2O in outside 12
crowd H2O in inside 12
place K+ in inside x5
place K+ in outside x1
place Na+ in outside x5
place Na+ in inside x3

step "세포 안에는 K+가, 바깥에는 Na+가 많아요"
  note k "K+ 통로"
  note p "나트륨-칼륨 펌프"
step "K+ 하나가 통로를 지나 K+가 적은 바깥으로 나가요(확산)"
  cross K+ via k
step "펌프는 ATP 에너지를 써서 Na+ 세 개를 밖으로, K+ 두 개를 안으로 옮겨요(능동 수송)"
  pump p 3 Na+ out 2 K+ in
`),
    tryIt: `<code>cross K+ via k</code>를 <code>cross Na+ via k</code>로 바꾸면 K+ 전용 통로라는 경고가 떠요. 통로마다 지나갈 수 있는 이온이 정해져 있어요.`,
  },
  {
    id: 'osmosis',
    part: 1,
    title: '삼투',
    intro: `<p>물 분자는 지나가지만 녹아 있는 이온은 지나가지 못하는 막이 있으면, 물은 이온이 많은 쪽으로 더 많이 건너가요. 이걸 삼투라고 해요. 배추를 소금에 절이면 숨이 죽는 것도, 세포 속 물이 소금기 많은 바깥으로 빠져나가는 삼투 때문이에요.</p>`,
    script: s(`
scene "물이 소금 쪽으로 건너갈 때"
stage membrane
protein a = channel H2O at 500
crowd H2O in outside 22
crowd H2O in inside 22
place Na+ in inside x4
place Cl- in inside x4

step "막 아래쪽(안쪽)에 소금 이온이 많아요. 이온은 막을 지나가지 못하지만, 물 분자는 물 통로로 지나가요"
  note a "물 통로(아쿠아포린)"
step "물 분자가 이온이 적은 위쪽에서 이온이 많은 아래쪽으로 더 많이 건너가요"
  osmosis 4
step "계속 건너가요. 아래쪽이 묽어질수록 건너가는 속도가 느려져요"
  osmosis 4
`),
    tryIt: `소금 이온을 <code>in outside</code>로 옮겨 적으면 물이 위쪽으로 건너가요.`,
  },
  // ------------------------------------------------------------------ part 2
  {
    id: 'acid-hcl',
    part: 2,
    title: '산과 염기 ①: 산이 H⁺를 내줄 때',
    intro: `<p>H⁺(수소 이온)를 내주는 물질을 산, 비공유 전자쌍으로 H⁺와 결합하는 물질을 염기라고 해요. 염화수소(HCl)가 물에 녹으면 H⁺가 물 분자로 옮겨 가서 하이드로늄 이온(H₃O⁺)이 돼요. 물속에 H₃O⁺가 많을수록 산성이 강하고, 식초와 위산이 신 것도 이 때문이에요.</p>`,
    script: s(`
scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol a = HCl at left
mol w = H2O at center

step "물 분자가 HCl 쪽으로 다가가요. O의 비공유 전자쌍이 HCl의 H를 향해요"
  approach w.O a.H
step "O의 전자쌍은 새 O–H 결합이 되고, H–Cl 결합의 전자쌍은 Cl로 옮겨 가요"
  transfer a.H to w.O
step "하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고, 물 분자가 그 둘레를 둘러싸요"
  solvate all
`),
    tryIt: `<code>transfer a.H to w.O</code> 한 줄은 다음 두 줄과 같아요: <code>arrow w.O:lp -> w.O~a.H</code> <code>arrow a.H~a.Cl -> a.Cl</code>`,
  },
  {
    id: 'base-nh3',
    part: 2,
    title: '산과 염기 ②: 물이 산이 될 때',
    intro: `<p>물은 상대에 따라 산도 되고 염기도 돼요. 암모니아처럼 H⁺와 잘 결합하는 물질 옆에서는 물이 H⁺를 내주고 수산화 이온(OH⁻)이 남아요. 물속에 OH⁻가 많은 상태가 염기성이에요. 비누나 표백제를 만지면 미끈거리는 것도 염기성 때문이에요.</p>`,
    script: s(`
scene "암모니아가 물속에서 염기가 될 때"
stage solution
crowd H2O in water 30
mol n = NH3 at left
mol w = H2O at center

step "암모니아가 물 분자 쪽으로 다가가요. N의 비공유 전자쌍이 물의 H를 향해요"
  approach n.N w.H1
step "N의 전자쌍은 새 N–H 결합이 되고, O–H 결합의 전자쌍은 O로 옮겨 가요"
  transfer w.H1 to n.N
step "암모늄 이온(NH4+)과 수산화 이온(OH-)이 생겨요"
  note n.N "NH4+ (N에 전하 +1)"
  note w.O "OH- (O에 전하 −1)"
`),
    tryIt: `마지막 단계에 <code>solvate all</code>을 더해 보세요.`,
  },
  {
    id: 'neutralization',
    part: 2,
    title: '중화 반응',
    intro: `<p>산성 용액과 염기성 용액을 섞으면 H₃O⁺의 H⁺가 OH⁻로 옮겨 가서 물 분자 두 개가 돼요. 산성과 염기성이 함께 사라지기 때문에 중화라고 해요. 이때 열이 나서 용액이 조금 따뜻해져요. 속이 쓰릴 때 먹는 제산제도 위산을 중화해요.</p>
<ul class="legend"><li><i class="g-arrow"></i>전자쌍 이동</li><li><i class="g-energy"></i>에너지 변화(오른쪽 위)</li></ul>`,
    script: s(`
scene "산과 염기가 섞여 물이 될 때"
stage solution
crowd H2O in water 24
mol a = H3O+ at left
mol b = OH- at right

step "산성 용액에는 하이드로늄 이온(H3O+)이, 염기성 용액에는 수산화 이온(OH-)이 있어요"
  note a.O "산성을 내는 H3O+"
  note b.O "염기성을 내는 OH-"
step "OH-가 H3O+ 쪽으로 다가가요. O의 비공유 전자쌍이 H3O+의 H를 향해요"
  approach b.O a.H1
step "H+ 하나가 H3O+에서 OH-로 옮겨 가요. 이때 열이 나와요"
  transfer a.H1 to b.O
  energy -56 kJ/mol
step "물 분자 두 개가 됐어요. 산성도 염기성도 사라졌어요(중화)"
  note a.O "물"
  note b.O "물"
`),
    tryIt: `<code>energy -56 kJ/mol</code>은 물 1몰(약 18 g)이 생길 때 나오는 열이에요. 이 줄을 지우면 오른쪽 위 에너지 그래프가 사라져요.`,
  },
  {
    id: 'redox',
    part: 2,
    title: '산화와 환원: 전자 이동',
    intro: `<p>원자가 전자를 잃는 걸 산화, 얻는 걸 환원이라고 해요. 한쪽이 잃은 전자를 다른 쪽이 얻으니까 산화와 환원은 늘 함께 일어나요. 철이 녹스는 것, 물질이 산소와 반응하며 불꽃을 내는 연소, 전지가 전기를 만드는 것이 모두 산화·환원이에요. 산화수는 원자가 전자를 얼마나 잃었는지(+), 얼마나 얻었는지(−) 나타내는 숫자예요.</p>
<ul class="legend"><li><i class="g-hook"></i>전자 1개 이동</li><li><i class="g-ox">+2</i>산화수</li><li><i class="g-energy"></i>에너지 변화(오른쪽 위)</li></ul>`,
    script: s(`
scene "아연이 구리 이온에 전자를 내줄 때"
stage solution
lens oxidation on
crowd H2O in water 26
mol z = Zn at left
mol c = Cu2+ at right

step "아연 원자(Zn)에는 바깥 전자가 2개 있고, 구리 이온(Cu2+)은 전자가 2개 모자라요"
  note z.Zn "바깥 전자 2개"
  note c.Cu "전자 2개 모자람"
step "구리 이온이 아연 원자에 다가가요"
  approach c.Cu z.Zn
step "아연의 전자 두 개가 하나씩 구리 이온으로 옮겨 가요. 이때 에너지가 나와요"
  hop 2 z.Zn -> c.Cu
  energy -212 kJ/mol
step "전자를 잃은 아연은 Zn2+가 되고(산화), 전자를 얻은 구리는 Cu 원자가 돼요(환원)"
  solvate z
`),
    tryIt: `<code>energy -212 kJ/mol</code> 뒤에 <code>barrier 60</code>을 더 적으면, 반응이 넘어야 하는 에너지 언덕(활성화 에너지)이 그려져요.`,
  },
  {
    id: 'cell',
    part: 2,
    title: '전지: 산화·환원으로 전기를 만들 때',
    intro: `<p>전지 속에서는 산화와 환원이 서로 다른 전극에서 일어나요. 산화 전극에서 나온 전자는 도선을 따라 환원 전극으로 가는데, 그 사이에 전구를 켜는 일을 할 수 있어요. 염다리 속 이온은 두 용액의 전하가 한쪽으로 치우치지 않게 맞춰요.</p>
<ul class="legend"><li><i class="g-e"></i>전자</li><li><i class="g-ox">+2</i>산화수</li></ul>`,
    script: s(`
scene "다니엘 전지: 아연에서 구리로 전자가 흐를 때"
stage cell
lens oxidation on
electrode left = Zn
electrode right = Cu
crowd H2O in left 14
crowd H2O in right 14
place Zn2+ in left
place SO42- in left
mol c = Cu2+ in right
place Cu2+ in right
place SO42- in right x2

step "왼쪽에는 아연판이 황산아연 용액에, 오른쪽에는 구리판이 황산구리 용액에 잠겨 있어요. 두 판은 도선으로, 두 용액은 염다리로 이어져 있어요"
  note left "아연판"
  note right "구리판"
step "아연판 표면의 아연 원자가 전자 2개를 판에 남기고 Zn2+가 되어 용액으로 나가요(산화)"
  oxidize left
step "판에 남은 전자 2개가 도선을 따라 구리판으로 가요. 이 전자의 흐름이 전류예요"
  wire 2
step "구리판 표면에서 구리 이온이 전자 2개를 얻어 구리 원자가 되고, 판의 일부가 돼요(환원)"
  reduce c at right
step "왼쪽 용액에는 양이온이 늘고 오른쪽에는 줄었어요. 염다리의 Cl-가 왼쪽으로, K+가 오른쪽으로 들어가 전하를 맞춰요"
  bridge Cl- K+ x2
`),
    tryIt: `<code>wire 2</code>를 <code>wire 1</code>로 바꾸면 환원 전극에 전자가 모자란다는 오류가 나요. 구리 이온 하나가 구리 원자가 되려면 전자가 2개 필요하거든요.`,
  },
  {
    id: 'radical',
    part: 2,
    title: '라디칼 반응',
    intro: `<p>전자는 보통 둘씩 짝을 지어 있지만, 짝이 없는 전자(홑전자)가 있는 입자도 있어요. 이런 입자를 라디칼이라고 해요. 라디칼은 짝을 찾으려는 성질이 강해서 다른 분자의 결합을 깨뜨리고, 그 분자가 다시 라디칼이 되면서 반응이 꼬리를 물고 이어져요(연쇄 반응). 빛, 특히 자외선이 결합을 깨서 라디칼이 생기는 일이 많아요. 햇볕을 오래 쬔 플라스틱이 삭는 것도 라디칼 반응이에요.</p>
<ul class="legend"><li><i class="g-hook"></i>전자 1개 이동</li><li><i class="g-single"></i>홑전자</li><li><i class="g-photon">∿</i>빛(hν)</li></ul>`,
    script: s(`
scene "염소와 메테인의 라디칼 반응"
stage gas
mol c = Cl2 at 400,330
mol m = CH4 at 640,330

step "Cl2가 빛을 흡수하면 결합이 깨지면서, 결합 전자 두 개가 두 Cl로 하나씩 가요"
  light c
  hop c.Cl1~c.Cl2 -> c.Cl1
  hop c.Cl1~c.Cl2 -> c.Cl2
step "홑전자가 있는 Cl(염소 라디칼) 하나가 메테인의 H에 다가가요"
  approach c.Cl2 m.H1
step "Cl의 홑전자와 C–H 결합 전자 하나가 새 Cl–H 결합을 만들고, 나머지 전자 하나는 C에 남아요"
  hop c.Cl2 -> c.Cl2~m.H1
  hop m.C~m.H1 -> c.Cl2~m.H1
  hop m.C~m.H1 -> m.C
step "염화수소(HCl)와 메틸 라디칼(CH3·)이 생겨요. 메틸 라디칼이 다시 Cl2와 반응하면서 연쇄 반응이 이어져요"
  note m.C "홑전자 1개"
`),
    tryIt: `<code>light c</code> 줄을 지워도 화면은 그려져요. 하지만 실제로는 빛이나 열이 있어야 Cl–Cl 결합이 깨져요.`,
  },
  {
    id: 'substitution',
    part: 2,
    title: '치환 반응',
    intro: `<p>분자 속 원자 하나(또는 원자 몇 개가 모인 덩어리)가 다른 것으로 바뀌는 반응을 치환 반응이라고 해요. Br이나 Cl처럼 전자를 세게 당기는 원자와 결합한 C는 조금 +를 띠어요. 그래서 비공유 전자쌍이 있는 분자가 그 C로 다가가 새 결합을 만들고, 동시에 원래 있던 원자가 떨어져 나가요. 약이나 플라스틱 원료를 만들 때 자주 쓰는 반응이에요.</p>
<ul class="legend"><li><i class="g-arrow"></i>전자쌍 이동</li><li><i class="g-charge">+</i>전하</li></ul>`,
    script: s(`
scene "암모니아가 브로모메테인의 Br 대신 결합할 때"
stage solution
crowd H2O in water 20
mol n = NH3 at left
mol m = CH3Br at right

step "브로모메테인(CH3Br)의 Br은 전자를 세게 당겨요. 그래서 Br과 결합한 C는 조금 +를 띠어요"
  note m.C "조금 + (δ+)"
  note m.Br "전자를 세게 당기는 Br"
step "암모니아가 Br 반대쪽에서 C로 다가가요. N의 비공유 전자쌍이 C를 향해요"
  approach n.N m.C
step "N의 전자쌍은 N–C 새 결합이 되고, C–Br 결합의 전자쌍은 Br로 가요. Br은 브로민화 이온(Br-)이 되어 떨어져 나가요"
  arrow n.N:lp -> n.N~m.C
  arrow m.C~m.Br -> m.Br
step "Br이 있던 곳에 N이 결합했어요. 이처럼 원자 하나가 다른 것으로 바뀌는 반응을 치환 반응이라고 해요"
  note n.N "새로 결합한 N"
`),
    tryIt: `<code>NH3</code>를 <code>OH-</code>로, <code>n.N</code>을 모두 <code>n.O</code>로 바꿔 보세요. 메탄올(CH₃OH)이 생겨요.`,
  },
  {
    id: 'addition',
    part: 2,
    title: '첨가 반응',
    intro: `<p>이중 결합에는 전자쌍이 두 개 있어요. 그중 하나가 새 결합에 쓰이면서 분자 두 개가 하나로 합쳐지는 반응을 첨가 반응이라고 해요. 식물성 기름에 수소를 더해 마가린을 만드는 것, 작은 분자 수천 개가 이어져 비닐(폴리에틸렌)이 되는 것이 모두 첨가 반응이에요.</p>
<ul class="legend"><li><i class="g-arrow"></i>전자쌍 이동</li><li><i class="g-charge">+</i>전하</li></ul>`,
    script: s(`
scene "에텐에 브로민화수소가 더해질 때"
stage solution
mol e = C2H4 at 380,300
mol h = HBr at 660,300

step "에텐(C2H4)의 두 C 사이에는 이중 결합이 있어요. 선 두 개가 전자쌍 두 개예요"
  note e.C1~e.C2 "이중 결합"
step "브로민화수소(HBr)의 H가 이중 결합 쪽으로 다가가요"
  approach h.H e.C1
step "이중 결합의 전자쌍 하나는 새 C–H 결합이 되고, H–Br 결합의 전자쌍은 Br로 가요"
  arrow e.C1~e.C2 -> e.C1~h.H
  arrow h.H~h.Br -> h.Br
step "H와 결합하지 않은 쪽 C는 전자가 모자라서 +를 띠어요. Br-가 그 C로 다가가요"
  approach h.Br e.C2
step "Br-의 비공유 전자쌍이 새 C–Br 결합이 돼요"
  arrow h.Br:lp -> h.Br~e.C2
step "이중 결합이 있던 두 C에 H와 Br이 하나씩 더해졌어요. 이렇게 두 분자가 하나로 합쳐지는 반응을 첨가 반응이라고 해요"
  note e.C2 "Br이 더해진 C"
  note e.C1 "H가 더해진 C"
`),
    tryIt: `<code>HBr</code>를 <code>HCl</code>로, <code>h.Br</code>을 모두 <code>h.Cl</code>로 바꿔 보세요.`,
  },
  {
    id: 'condensation',
    part: 2,
    title: '축합과 가수분해',
    intro: `<p>두 분자가 물 분자 하나를 내보내면서 하나로 이어지는 반응을 축합, 반대로 물이 들어가면서 결합이 깨지는 반응을 가수분해라고 해요. 몸속의 단백질·녹말·지방은 축합으로 만들어지고, 음식을 소화하는 건 가수분해예요.</p>`,
    script: s(`
scene "두 아미노산이 이어졌다가 다시 나뉠 때"
stage solution
crowd H2O in water 16
mol g1 = Gly at 330,300
mol g2 = Gly at 670,300

step "글라이신 분자 두 개예요. 한쪽 끝에는 카복실기(-COOH), 다른 쪽 끝에는 아미노기(-NH2)가 있어요"
  note g1.C2 "카복실기"
  note g2.N "아미노기"
step "g2의 아미노기가 g1의 카복실기 쪽으로 다가가요"
  approach g2.N g1.C2
step "g1의 -OH와 g2의 H 하나가 떨어져 나와 물 분자가 되고, C와 N이 결합해요(축합)"
  condensation g1.C2 g2.N
step "이렇게 생긴 C–N 결합을 펩타이드 결합이라고 해요"
  note g1.C2~g2.N "펩타이드 결합"
step "물 분자가 들어가면 펩타이드 결합이 깨지면서 두 아미노산으로 다시 나뉘어요(가수분해)"
  hydrolysis g1.C2~g2.N
`),
    tryIt: `<code>Gly</code>를 <code>Ala</code>(알라닌)로 바꿔 보세요. 원자 이름은 SMILES 순서(<code>CC(N)C(=O)O</code>)를 따르기 때문에 카복실 탄소가 <code>C3</code>가 돼요.`,
  },
  {
    id: 'coordination',
    part: 2,
    title: '배위 결합: 착이온',
    intro: `<p>보통 공유 결합은 두 원자가 전자를 하나씩 내서 만들어요. 배위 결합은 한 원자가 비공유 전자쌍을 통째로 내줘서 생겨요. 금속 이온 둘레에 물이나 암모니아 같은 분자가 이렇게 결합한 이온을 착이온이라고 해요. 혈액 속 헤모글로빈의 철이 산소와 결합하는 것도 배위 결합이에요.</p>
<ul class="legend"><li><i class="g-dative"></i>배위 결합(화살촉 쪽 원자가 전자쌍을 얻어요)</li></ul>`,
    script: s(`
scene "구리 이온과 암모니아가 착이온을 만들 때"
stage solution
crowd H2O in water 18
mol c = Cu2+ at center
mol n1 = NH3 at 320,310
mol n2 = NH3 at 680,310
mol n3 = NH3 at 500,130
mol n4 = NH3 at 500,490

step "구리 이온(Cu2+)은 다른 분자의 비공유 전자쌍과 결합할 수 있어요"
  note c.Cu "Cu2+"
step "암모니아 네 분자가 구리 이온 쪽으로 다가가요. N의 비공유 전자쌍이 구리 이온을 향해요"
  approach n1.N c.Cu
  approach n2.N c.Cu
  approach n3.N c.Cu
  approach n4.N c.Cu
step "N의 비공유 전자쌍이 N과 Cu 사이로 옮겨 가면서 배위 결합 네 개가 생겨요"
  ligand n1.N -> c.Cu
  ligand n2.N -> c.Cu
  ligand n3.N -> c.Cu
  ligand n4.N -> c.Cu
step "착이온 [Cu(NH3)4]2+가 됐어요. 전자쌍이 모두 N에서 왔기 때문에 +2 전하는 그대로 구리에 있어요"
  note c.Cu "전하 +2"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>.N</code>을 모두 <code>.O</code>로 바꿔 보세요. 물 분자도 같은 방식으로 구리 이온과 결합해요.`,
  },
  // ------------------------------------------------------------------ part 3
  {
    id: 'energy',
    part: 3,
    title: '반응과 에너지',
    intro: `<p>결합이 깨지려면 에너지가 필요하고, 결합이 생기면 에너지가 나와요. 반응 전체로 보아 에너지가 나오면 발열 반응(주변이 따뜻해져요), 에너지를 흡수하면 흡열 반응(주변이 차가워져요)이에요. 대부분의 반응은 처음에 에너지 언덕을 넘어야 일어나는데, 이 언덕의 높이를 활성화 에너지라고 해요. 촉매는 이 언덕을 낮춰서 반응을 빠르게 하는 물질이에요. 몸속의 효소도 촉매예요.</p>
<ul class="legend"><li><i class="g-energy"></i>에너지 변화(오른쪽 위)</li></ul>`,
    script: s(`
scene "반응이 넘어야 하는 에너지 언덕"
stage solution
crowd H2O in water 22
mol o = OH- at left
mol m = CH3Br at right

step "반응하기 전이에요. 오른쪽 위 그래프는 이 분자들의 에너지예요"
  note o.O "OH-"
  note m.C "CH3Br"
step "OH-가 CH3Br의 C로 다가가요"
  approach o.O m.C
step "결합이 바뀌는 동안 에너지가 잠깐 올라갔다가(언덕) 내려가요. 이 언덕의 높이가 활성화 에너지예요(숫자는 물속 기준 대략적인 값)"
  arrow o.O:lp -> o.O~m.C
  arrow m.C~m.Br -> m.Br
  energy -75 kJ/mol barrier 95
step "반응 뒤의 에너지가 처음보다 낮아진 만큼 열이 주변으로 나와요(발열 반응). 반대로 처음보다 높아지는 반응은 열을 흡수해요(흡열 반응)"
  note m.Br "떨어져 나간 Br-"
`),
    tryIt: `<code>barrier 95</code>를 <code>barrier 40</code>으로 바꿔 보세요. 촉매가 하는 일이 바로 이렇게 언덕을 낮추는 거예요.`,
  },
  {
    id: 'equilibrium',
    part: 3,
    title: '화학 평형',
    intro: `<p>많은 반응은 앞으로도 뒤로도 일어나요(가역 반응). 반응물 분자끼리 부딪쳐 생성물이 되다가, 생성물이 늘면 생성물끼리 부딪쳐 반응물이 다시 생기는 반응(역반응)도 잦아져요. 두 방향의 빠르기가 같아지면 분자 수가 더는 변하지 않는데, 이 상태를 화학 평형이라고 해요. 겉으로는 멈춘 것 같아도 두 반응은 계속 일어나요.</p>
<ul class="legend"><li><i class="g-chart"><svg viewBox="0 0 18 12"><polyline class="up" points="1,11 6,6 11,4 17,4"/><polyline class="down" points="1,2 6,6 11,8 17,8"/></svg></i>분자 종류별 개수(오른쪽 위)</li><li><i class="g-spark"></i>방금 반응이 일어난 곳</li></ul>`,
    script: s(`
scene "수소와 아이오딘이 평형에 이를 때"
stage gas
place H2 in air x10
place I2 in air x10

step "수소(H2)와 아이오딘(I2) 분자가 섞여 있어요. 분자는 쉬지 않고 날아다니며 서로 부딪쳐요"
  wait
step "H2와 I2가 부딪치면 결합이 바뀌면서 HI 두 분자가 돼요. HI끼리 부딪쳐서 H2와 I2가 다시 생기기도 해요"
  ensemble H2 + I2 <=> 2 HI for 10s
step "두 반응의 빠르기가 같아지면 분자 수가 거의 변하지 않아요. 이 상태가 평형이에요"
  ensemble H2 + I2 <=> 2 HI for 8s
`),
    tryIt: `<code>&lt;=&gt;</code>를 <code>-&gt;</code>로 바꾸면 역반응이 빠져서 HI만 계속 늘어나요.`,
  },
];
