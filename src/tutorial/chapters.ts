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
  {
    id: 'redox',
    part: 2,
    title: '산화·환원: 전자 이동',
    intro: `<p>산화·환원에서는 전자가 한 원자에서 다른 원자로 옮겨 가요. 전자를 잃으면 산화, 얻으면 환원이에요.</p>
<ul class="legend"><li><i class="g-hook"></i>전자 하나 이동</li><li><i class="g-ox">+2</i>산화수</li></ul>`,
    script: s(`
scene "아연이 구리 이온에 전자를 내줄 때"
stage solution
lens oxidation on
crowd H2O in water 26
mol z = Zn at left
mol c = Cu2+ at right

step "아연 원자(Zn)에는 바깥 전자가 2개 있고, 구리 이온(Cu2+)은 전자 2개가 모자라요"
  note z.Zn "바깥 전자 2개"
  note c.Cu "전자 2개 모자람"
step "구리 이온이 아연 원자 가까이 다가가요"
  approach c.Cu z.Zn
step "아연의 전자 두 개가 하나씩 구리 이온으로 옮겨 가요"
  hop 2 z.Zn -> c.Cu
step "전자를 잃은 아연은 Zn2+가 되고(산화), 전자를 얻은 구리는 Cu 원자가 돼요(환원)"
  solvate z
`),
    tryIt: `<code>lens oxidation on</code> 줄을 지우면 산화수 숫자가 사라져요. 보기 설정에서 다시 켤 수 있어요.`,
  },
  {
    id: 'radical',
    part: 2,
    title: '라디칼: 홑전자 반응',
    intro: `<p>라디칼은 짝 없는 전자(홑전자)를 가진 입자예요. 라디칼 반응에서는 전자가 하나씩 움직여요. 빛이 결합을 깨면서 반응이 시작돼요.</p>
<ul class="legend"><li><i class="g-hook"></i>전자 하나 이동</li><li><i class="g-single"></i>홑전자</li><li><i class="g-photon">∿</i>빛(hν)</li></ul>`,
    script: s(`
scene "염소와 메테인의 라디칼 반응"
stage gas
mol c = Cl2 at 400,330
mol m = CH4 at 640,330

step "빛을 흡수한 Cl2의 결합이 깨지며, 결합 전자 두 개가 하나씩 두 Cl로 가요"
  light c
  hop c.Cl1~c.Cl2 -> c.Cl1
  hop c.Cl1~c.Cl2 -> c.Cl2
step "홑전자를 가진 Cl(염소 라디칼) 하나가 메테인의 H에 다가가요"
  approach c.Cl2 m.H1
step "Cl의 홑전자와 C–H 결합 전자 하나가 새 Cl–H 결합을 이루고, 남은 전자 하나는 C에 남아요"
  hop c.Cl2 -> c.Cl2~m.H1
  hop m.C~m.H1 -> c.Cl2~m.H1
  hop m.C~m.H1 -> m.C
step "염화수소(HCl)와 메틸 라디칼(CH3·)이 생겨요. 메틸 라디칼은 다시 Cl2와 반응해 연쇄가 이어져요"
  note m.C "홑전자 1개"
`),
    tryIt: `<code>light c</code> 줄을 지워도 화면은 그려져요. 실제로는 빛이나 열이 있어야 Cl–Cl 결합이 깨져요.`,
  },
  {
    id: 'coordination',
    part: 2,
    title: '배위 결합: 착이온',
    intro: `<p>배위 결합은 한 원자가 비공유 전자쌍을 통째로 내주어 만드는 결합이에요. 금속 이온과 물·암모니아 같은 분자 사이에 흔히 생기고, 그렇게 생긴 이온을 착이온이라고 해요.</p>
<ul class="legend"><li><i class="g-dative"></i>배위 결합(화살촉 쪽이 전자쌍을 얻은 원자)</li></ul>`,
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
step "암모니아 네 분자가 N의 비공유 전자쌍을 앞세워 다가가요"
  approach n1.N c.Cu
  approach n2.N c.Cu
  approach n3.N c.Cu
  approach n4.N c.Cu
step "N의 비공유 전자쌍이 N과 Cu 사이로 옮겨 가 배위 결합 네 개가 생겨요"
  ligand n1.N -> c.Cu
  ligand n2.N -> c.Cu
  ligand n3.N -> c.Cu
  ligand n4.N -> c.Cu
step "착이온 [Cu(NH3)4]2+가 됐어요. 전자쌍은 모두 N에서 왔으니 전하 +2는 구리에 그대로 있어요"
  note c.Cu "전하 +2"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>.N</code>을 모두 <code>.O</code>로 바꿔 보세요. 물 분자도 같은 방식으로 구리 이온과 결합해요.`,
  },
  {
    id: 'condensation',
    part: 2,
    title: '축합과 가수분해',
    intro: `<p>축합은 두 분자가 물 한 분자를 내놓으면서 결합하는 반응이고, 가수분해는 그 반대로 물이 들어가 결합이 깨지는 반응이에요. 단백질, 녹말, 지방이 모두 이런 방식으로 만들어지고 분해돼요.</p>`,
    script: s(`
scene "두 아미노산이 이어졌다가 다시 나뉠 때"
stage solution
crowd H2O in water 16
mol g1 = Gly at 330,300
mol g2 = Gly at 670,300

step "글라이신 두 분자예요. 한쪽 끝에는 카복실기(-COOH), 다른 끝에는 아미노기(-NH2)가 있어요"
  note g1.C2 "카복실기"
  note g2.N "아미노기"
step "g2의 아미노기가 g1의 카복실기 쪽으로 다가가요"
  approach g2.N g1.C2
step "g1의 -OH와 g2의 H 하나가 떨어져 나와 물 분자가 되고, C와 N이 결합해요(축합)"
  condensation g1.C2 g2.N
step "이렇게 생긴 C–N 결합이 펩타이드 결합이에요"
  note g1.C2~g2.N "펩타이드 결합"
step "물 분자가 들어가면 펩타이드 결합이 깨지고 두 아미노산으로 다시 나뉘어요(가수분해)"
  hydrolysis g1.C2~g2.N
`),
    tryIt: `<code>Gly</code>를 <code>Ala</code>(알라닌)로 바꿔 보세요. 원자 이름은 SMILES 순서(<code>CC(N)C(=O)O</code>)를 따라서, 카복실 탄소가 <code>C3</code>가 돼요.`,
  },
  {
    id: 'cell',
    part: 2,
    title: '전지: 전자가 도선을 따라 흐를 때',
    intro: `<p>전지는 산화와 환원을 두 전극에서 따로 일어나게 해서, 그 사이를 오가는 전자를 도선으로 흐르게 만든 장치예요. 산화 전극에서 생긴 전자가 도선을 따라 환원 전극으로 가고, 염다리의 이온이 두 용액의 전하를 맞춰요.</p>
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

step "왼쪽은 아연판이 황산아연 용액에, 오른쪽은 구리판이 황산구리 용액에 잠겨 있어요. 두 판은 도선으로, 두 용액은 염다리로 이어져 있어요"
  note left "아연판"
  note right "구리판"
step "아연판 표면의 아연 원자가 전자 2개를 판에 남기고 Zn2+ 이온이 되어 용액으로 나가요(산화)"
  oxidize left
step "판에 남은 전자 2개가 도선을 따라 구리판으로 가요. 이 전자의 흐름이 전류예요"
  wire 2
step "구리 이온이 구리판 표면에서 전자 2개를 얻어 구리 원자가 되고, 판의 일부가 돼요(환원)"
  reduce c at right
step "왼쪽 용액은 양이온이 늘고 오른쪽은 줄었어요. 염다리의 Cl-가 왼쪽으로, K+가 오른쪽으로 들어가 전하를 맞춰요"
  bridge Cl- K+ x2
`),
    tryIt: `<code>wire 2</code>를 <code>wire 1</code>로 바꾸면 환원 전극에 전자가 모자란다는 오류가 나요. 구리 이온 하나에는 전자 2개가 필요해요.`,
  },
];

// More phase changes sit next to the related part-1 chapters.
CHAPTERS.splice(CHAPTERS.findIndex((c) => c.id === 'evaporation') + 1, 0,
  {
    id: 'boiling',
    part: 1,
    title: '끓음',
    intro: `<p>증발은 수면에서만 일어나지만, 끓을 때는 액체 속에서도 물 분자들이 기체가 되어 기포를 만들어요. 기포는 떠올라 수면에서 터지고, 그 안의 물 분자는 공기로 나가요.</p>`,
    script: s(`
scene "물이 끓을 때"
stage interface
crowd H2O in water 50
crowd H2O in air 2

step "물을 세게 가열해요. 분자들이 아주 빠르게 움직여요"
  heat water
step "액체 속에서 물 분자 몇 개가 기체가 되어 기포를 만들고, 기포가 떠올라요"
  boil 3
step "또 다른 기포가 생겨 떠올라요"
  boil 4
`),
    tryIt: `<code>boil 3</code>의 숫자를 바꾸면 기포 하나에 든 물 분자 수가 달라져요(2~6).`,
  },
  {
    id: 'ice',
    part: 1,
    title: '얼음이 얼고 녹을 때',
    intro: `<p>액체 물에서는 수소 결합이 끊임없이 생겼다 사라지며 무질서하게 이어져 있어요. 온도가 내려가면 물 분자들이 수소 결합으로 규칙적인 육각형 그물을 이뤄 얼음이 되고, 다시 데우면 그물이 흐트러져 녹아요.</p>`,
    script: s(`
scene "물이 얼고 녹을 때"
stage solution
lens attract on
crowd H2O in water 40

step "액체 물에서는 수소 결합(파란 점선)이 무질서하게 이어져 있어요"
  wait
step "온도가 내려가면 물 분자들이 육각형 그물로 자리 잡아 얼음이 돼요"
  freeze water
step "다시 데우면 그물이 흐트러지며 녹아요"
  melt water
`),
    tryIt: `얼음 단계에서 보기 설정의 <b>분자 사이 인력</b>을 끄고 켜며 그물 모양을 비교해 보세요.`,
  },
);
CHAPTERS.splice(CHAPTERS.findIndex((c) => c.id === 'dissolving') + 1, 0, {
  id: 'precipitation',
  part: 1,
  title: '석출(침전)',
  intro: `<p>어떤 이온 짝은 서로 당기는 힘이 물 분자와의 인력보다 세서, 물 분자를 떨치고 고체 결정을 이뤄요. 이것이 석출(침전)이에요. 같이 있던 다른 이온은 녹은 채로 남아요.</p>`,
  script: s(`
scene "은 이온과 염화 이온이 침전을 만들 때"
stage solution
crowd H2O in water 30
place Ag+ in left x3
place NO3- in left x3
place Na+ in right x3
place Cl- in right x3

step "질산은 용액(Ag+, NO3-)과 소금물(Na+, Cl-)을 섞었어요"
  spread Ag+ NO3- Na+ Cl- in water
step "Ag+와 Cl-가 물 분자를 떨치고 서로 결합해 고체 염화은(AgCl) 결정을 이뤄요"
  precipitate Ag+ Cl- x3
step "Na+와 NO3-는 물에 녹은 채로 남아요"
  note Na+ "녹은 채 남은 Na+"
`),
  tryIt: `<code>x3</code>을 <code>x2</code>로 바꾸면 Ag+와 Cl- 하나씩이 녹은 채 남아요.`,
});

// Phenomena that need their own stage come after the first five in part 1.
CHAPTERS.splice(CHAPTERS.findIndex((c) => c.id === 'leaching') + 1, 0,
  {
    id: 'membrane',
    part: 1,
    title: '막 수송: 통로와 펌프',
    intro: `<p>세포막은 인지질 두 층으로 되어 있어 이온이 그냥은 지나가지 못해요. 이온은 막에 박힌 단백질을 거쳐 지나가요. 농도가 높은 쪽에서 낮은 쪽으로 통로를 지나는 것은 확산이고, 에너지를 써서 반대 방향으로 옮기는 것은 능동 수송이에요.</p>`,
    script: s(`
scene "세포막을 지나는 이온"
stage membrane
protein k = channel K+ at 330
protein p = pump at 680
crowd H2O in outside 12
crowd H2O in inside 12
place K+ in inside x5
place K+ in outside x1
place Na+ in outside x5
place Na+ in inside x3

step "세포 안쪽에는 K+가, 바깥에는 Na+가 많아요"
  note k "K+ 통로"
  note p "나트륨-칼륨 펌프"
step "K+ 하나가 통로를 지나 K+가 적은 바깥으로 나가요(확산)"
  cross K+ via k
step "펌프는 ATP의 에너지를 써서 Na+ 세 개를 밖으로, K+ 두 개를 안으로 옮겨요(능동 수송)"
  pump p 3 Na+ out 2 K+ in
`),
    tryIt: `<code>cross K+ via k</code>를 <code>cross Na+ via k</code>로 바꾸면 'K+용 통로'라는 경고가 떠요. 통로는 지나갈 이온을 골라요.`,
  },
  {
    id: 'osmosis',
    part: 1,
    title: '삼투',
    intro: `<p>물 분자는 지나가고 녹아 있는 이온은 못 지나가는 막을 사이에 두면, 물은 이온이 많은 쪽으로 더 많이 건너가요. 이것이 삼투예요. 양쪽으로 물 분자가 다 지나가지만, 이온이 많은 쪽으로 가는 수가 더 많아요.</p>`,
    script: s(`
scene "물이 소금 쪽으로 건너갈 때"
stage membrane
protein a = channel H2O at 500
crowd H2O in outside 22
crowd H2O in inside 22
place Na+ in inside x4
place Cl- in inside x4

step "막 아래쪽(안쪽)에 소금 이온이 많아요. 이온은 막을 못 지나가지만 물 분자는 물 통로로 지나가요"
  note a "물 통로(아쿠아포린)"
step "물 분자가 이온이 적은 위쪽에서 이온이 많은 아래쪽으로 더 많이 건너가요"
  osmosis 4
step "계속 건너가요. 아래쪽이 묽어질수록 건너가는 속도는 줄어들어요"
  osmosis 4
`),
    tryIt: `소금 이온을 <code>in outside</code>로 옮겨 적으면 물이 위쪽으로 건너가요.`,
  },
);
