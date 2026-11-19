/**
 * Tutorial: the basic kinds of change, one chapter each, in the order a newcomer
 * needs them. Each chapter says what the term means in its first captions (steps that
 * only change the caption), plays a standard example, shows the script beside it, and
 * suggests one edit to try. Scenes about one
 * particular topic live in examples.ts instead.
 */
export interface Chapter {
  id: string;
  part: number;
  title: string;
  /** The lesson: its explanation is the opening captions (text-only steps), then the scene. */
  script: string;
  /** HTML */
  tryIt: string;
}

export const PARTS = [
  { id: 0, title: '0부 · 화면 읽는 법' },
  { id: 1, title: '1부 · 화학 결합: 원자가 전자로 이어지는 방식' },
  { id: 2, title: '2부 · 물리 변화: 물질은 그대로인 변화' },
  { id: 3, title: '3부 · 화학 반응: 새 물질이 생기는 변화' },
  { id: 4, title: '4부 · 에너지와 평형' },
];

const s = (x: string) => x.replace(/^\n/, '');

/**
 * A lesson's script without its opening captions (the steps that only tell, before the scene
 * begins): the scene itself, for checks that count its steps.
 */
export function sceneOf(script: string): string {
  const lines = script.split('\n');
  const out: string[] = [];
  let opening = true;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (opening && /^step "/.test(l)) {
      const next = lines[i + 1] ?? '';
      if (/^step "/.test(next) || !next.trim()) continue;
      opening = false;
    }
    out.push(l);
  }
  return out.join('\n');
}

export const CHAPTERS: Chapter[] = [
  // ------------------------------------------------------------------ part 0
  {
    id: 'atoms',
    part: 0,
    title: '원자, 결합, 전자쌍',
    script: s(`
scene "물 분자 하나"
stage solution
mol w = H2O at center

step "모든 물질은 원자로 되어 있다. 원자와 원자는 둘레에 있는 전자를 함께 쓰면서 서로 결합한다. 화학 반응은 이 전자가 다른 곳으로 옮겨 가면서 결합이 새로 생기거나 없어지는 일이다."
step "이 앱에서 원자는 원소 기호가 적힌 공이고, 전자 두 개(전자쌍)는 작은 주머니에 든 점 두 개로 나타난다. 주머니가 두 원자 사이에 걸쳐 있으면 결합이고, 한 원자에만 붙어 있으면 결합에 쓰이지 않은 전자쌍이다."
step "먼저 물 분자 하나를 보면서 화면 읽는 법을 익혀 보자."
step "물 분자는 산소(O) 원자 하나와 수소(H) 원자 둘로 되어 있다."
  note w.O "산소 원자"
  note w.H1 "수소 원자"
step "O와 H 사이에 걸친 전자쌍은 공유 결합이다. 두 원자가 전자 두 개를 함께 쓰고 있다는 뜻이다."
  note w.O~w.H1 "공유 결합(전자 2개)"
step "O에만 붙어 있는 전자쌍은 결합에 쓰이지 않은 전자다. 이런 전자 한 쌍을 비공유 전자쌍이라고 하는데, O에는 두 쌍이 있다."
  note w.O:lp "비공유 전자쌍"
step "O 둘레의 전자를 모두 세면 8개다. 결합 두 개에 4개, 비공유 전자쌍 두 개에 4개가 있다."
  note w.O "전자 8개(옥텟)"
`),
    tryIt: `<code>H2O</code>를 <code>NH3</code>로, <code>w.O</code>를 <code>w.N</code>으로 바꿔 보자.`,
  },
  {
    id: 'arrows',
    part: 0,
    title: '전자의 이동과 전하',
    script: s(`
scene "암모니아와 수소 이온이 결합할 때"
stage solution
mol n = NH3 at left
mol h = H+ at right

step "반응에서 실제로 움직이는 것은 원자가 아니라 전자다. 이 앱에서는 전자쌍(전자 2개) 하나하나가 작은 주머니로 보인다. 한 원자에 붙어 있으면 비공유 전자쌍이고, 두 원자 사이에 걸쳐 있으면 결합이다. 전자 1개(홑전자)는 반쪽 주머니다."
step "반응은 전자쌍이 한 원자를 놓거나 다른 원자를 새로 붙잡는 일이다. 전기적인 힘이 당기는 동안 전자쌍은 버티다가, 한순간에 넘어간다. 그 순간 원자들은 새 거리로 착 붙고, 전하도 함께 바뀐다."
step "원자 둘레의 전자가 중성일 때보다 적으면 빨갛게(+), 많으면 파랗게(−) 빛난다. 보기 설정에서 두 색을 바꿀 수 있다. 교과서에서는 이 움직임을 굽은 화살표로 적는다."
step "오른쪽에 있는 수소 이온(H+)은 전자가 하나도 없어서 전하가 +1이다."
  note h.H "전자 0개, 전하 +1"
step "암모니아와 H+가 서로 끌려 다가간다. 이때 N의 비공유 전자쌍은 H+ 쪽을 향한다."
  approach n.N h.H
step "N의 비공유 전자쌍이 H를 붙잡아 N–H 결합이 된다. 그 순간 +1 전하는 H에서 N으로 옮겨 간다."
  arrow n.N:lp -> n.N~h.H
step "전하가 N에 표시되는 까닭은 N이 제 전자쌍을 결합에 내줬기 때문이다."
  note n.N "형식 전하 +1"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>n.N</code>을 <code>n.O</code>로 바꾸면 H₃O⁺가 생긴다.`,
  },
  {
    id: 'forces',
    part: 0,
    title: '분자 사이 인력과 온도',
    script: s(`
scene "물 분자 사이의 수소 결합"
stage solution
lens attract on
crowd H2O in water 44
mol w = H2O at center

step "분자와 분자 사이에도 서로 당기는 힘이 약하게 작용한다. 물에서는 이 힘이 특히 강한데, 한 분자의 H와 옆 분자의 O가 서로 당기기 때문이다. 이 힘을 수소 결합이라고 한다. 물이 100℃나 되어야 끓고 얼음이 물에 뜨는 것도 수소 결합 때문이다."
step "한편 온도는 입자가 얼마나 빨리 움직이는지를 나타낸다."
step "분자와 분자 사이의 점선은 수소 결합이다. 한 분자의 H와 옆 분자의 O 사이에 생긴다."
  note w.O "조금 − (δ−)"
  note w.H1 "조금 + (δ+)"
step "물을 데우면 분자가 더 빨리 움직인다."
  heat water
step "다시 식히면 움직임도 느려진다."
  cool water
`),
    tryIt: `보기 설정에서 <b>분자 사이 인력</b>을 껐다 켜 보자.`,
  },
  // ------------------------------------------------------------------ part 1
  {
    id: 'covalent',
    part: 1,
    title: '공유 결합',
    script: s(`
scene "수소 원자 둘이 공유 결합을 할 때"
stage gas
mol a = H· at 340,310
mol b = H· at 620,310

step "두 원자가 전자쌍 하나를 함께 쓰면서 이어지는 것을 공유 결합이라고 한다. 수소 원자는 전자가 하나뿐이어서, 혼자 있을 때는 짝이 없는 전자(홑전자) 하나를 가진다."
step "수소 원자마다 홑전자가 하나씩 있다."
  note a.H "홑전자 하나"
  note b.H "홑전자 하나"
step "두 수소 원자가 서로 끌려 다가간다."
  approach a.H b.H
step "두 원자가 전자를 하나씩 내어 전자쌍 하나를 함께 쓴다. 이것이 공유 결합이다."
  hop a.H -> a.H~b.H
  hop b.H -> a.H~b.H
step "이렇게 생긴 수소 분자(H2)의 두 원자는 전자쌍 하나로 이어져 있다."
  note a.H~b.H "공유 결합: 전자쌍 하나"
`),
    tryIt: `<code>mol b = H· at 620,310</code>을 <code>mol b = Cl· at 620,310</code>으로, 아래의 <code>b.H</code>를 모두 <code>b.Cl</code>로 바꿔 보자. 수소 원자와 염소 원자도 같은 방식으로 HCl이 된다. 이때는 전자쌍이 Cl 쪽으로 치우쳐서 Cl은 조금 −, H는 조금 +가 된다.`,
  },
  {
    id: 'multiple-bonds',
    part: 1,
    title: '이중 결합과 삼중 결합',
    script: s(`
scene "전자쌍을 둘, 셋 함께 쓰는 결합"
stage gas
mol o = O2 at 250,280
mol n = N2 at 500,280
mol c = CO2 at 750,280

step "두 원자가 전자쌍 하나를 함께 쓰면 단일 결합, 둘을 함께 쓰면 이중 결합, 셋을 함께 쓰면 삼중 결합이다. 함께 쓰는 전자쌍이 많을수록 두 원자는 더 가깝고 단단하게 이어진다."
step "산소 분자(O2)를 루이스 구조로 그리면 두 O가 전자쌍 두 개를 함께 쓴다."
  note o.O1~o.O2 "이중 결합: 전자쌍 2개"
step "질소 분자(N2)의 두 N은 전자쌍 세 개를 함께 쓴다."
  note n.N1~n.N2 "삼중 결합: 전자쌍 3개"
step "이산화탄소(CO2)에서는 C가 양쪽 O와 전자쌍을 두 개씩 함께 쓴다."
  note c.C~c.O1 "이중 결합"
  note c.C~c.O2 "이중 결합"
`),
    tryIt: `<code>mol c = CO2 at 750,280</code>을 <code>mol c = smiles:C#N at 750,280</code>으로 바꾸고, <code>note c.</code>로 시작하는 두 줄을 지워 보자. 사이안화 수소(HCN)의 C와 N 사이에 전자쌍 세 개가 보인다.`,
  },
  {
    id: 'ionic',
    part: 1,
    title: '이온 결합',
    script: s(`
scene "나트륨과 염소가 이온 결합을 할 때"
stage gas
mol n = Na at 300,250
mol c = Cl· at 520,250
crystal s = NaCl at bottom 4x2

step "전자를 잃은 원자는 양이온, 전자를 얻은 원자는 음이온이 된다. 양이온과 음이온은 전하가 반대여서 서로 당기는데, 이 당기는 힘으로 이어진 것을 이온 결합이라고 한다."
step "나트륨(Na) 원자는 바깥 전자가 하나이고, 염소(Cl) 원자는 바깥 전자가 일곱 개다."
  note n "나트륨 원자"
  note c "염소 원자"
step "두 원자가 서로 다가간다."
  approach n.Na c.Cl
step "Na의 전자 하나가 Cl로 건너간다. Na는 Na+, Cl은 Cl-가 된다."
  hop n.Na -> c.Cl
step "소금 결정에서는 Na+와 Cl-가 번갈아 늘어서 서로 당긴다. 이 당기는 힘이 이온 결합이다."
  note s "소금(NaCl) 결정"
`),
    tryIt: `전자가 건너가기 전과 뒤에 Na와 Cl 둘레의 전자 점을 세어 보자. Na⁺는 바깥 전자를 하나도 갖지 않고, Cl⁻는 전자쌍 네 개, 곧 전자 여덟 개를 가진다.`,
  },
  // ------------------------------------------------------------------ part 2
  {
    id: 'diffusion',
    part: 2,
    title: '확산',
    script: s(`
scene "소금물 한 방울이 퍼질 때"
stage solution
crowd H2O in water 28
place Na+ in left x5
place Cl- in left x5

step "입자는 한시도 쉬지 않고 제멋대로 움직인다. 그래서 한곳에 몰려 있던 입자도 시간이 지나면 고르게 퍼지는데, 이를 확산이라고 한다. 향기가 방 안에 퍼지는 것, 잉크가 물에 번지는 것이 모두 확산이다."
step "처음에는 Na+와 Cl-가 왼쪽에 몰려 있다."
  note left "이온이 몰린 쪽"
step "시간이 지나면서 이온은 제멋대로 움직이며 물 전체로 퍼진다."
  spread Na+ Cl- in water
`),
    tryIt: `<code>in water</code>를 <code>in right</code>로 바꿔 보자. 이온이 오른쪽 구역으로만 퍼진다.`,
  },
  {
    id: 'evaporation',
    part: 2,
    title: '증발과 응결',
    script: s(`
scene "물이 증발하고 응결할 때"
stage interface
crowd H2O in water 52
crowd H2O in air 3

step "액체 표면에 있는 분자는 이웃 분자가 당기는 힘을 이길 만큼 빨리 움직이면 기체가 되어 공기 중으로 나간다. 이를 증발이라고 한다. 반대로 공기 중의 기체 분자가 다시 액체가 되는 것은 응결이다."
step "빨래가 마르는 것은 증발 때문이고, 찬 컵 겉에 물방울이 맺히는 것은 응결 때문이다."
step "액체 속 물 분자는 수소 결합으로 서로 당기고 있다."
  note water "수소 결합으로 이어진 물 분자"
step "물을 데우면 분자가 더 빨리 움직인다."
  heat water
step "그러다 수면 가까이 있던 물 분자 하나가 이웃 분자의 힘을 이기고 공기 중으로 나간다(증발)."
  evaporate H2O
step "이어서 하나가 더 증발한다."
  evaporate H2O
step "반대로 공기 중에 있던 물 분자 하나는 수면 아래로 내려와 다시 액체가 된다(응결)."
  condense H2O
`),
    tryIt: `<code>heat water</code>를 <code>cool water</code>로 바꿔 보자.`,
  },
  {
    id: 'boiling',
    part: 2,
    title: '끓음',
    script: s(`
scene "물이 끓을 때"
stage interface
crowd H2O in water 50
crowd H2O in air 2

step "증발은 액체 표면에서만 일어난다. 그런데 끓을 때는 액체 속에서도 분자가 기체로 바뀌면서 기포가 생긴다. 기포는 떠올라 수면에서 터지고, 기포 속 기체는 공기 중으로 나간다. 액체가 끓기 시작하는 온도를 끓는점이라고 한다."
step "물을 세게 가열하면 분자가 아주 빨리 움직인다."
  heat water
step "그러면 액체 속에서도 물 분자 몇 개가 기체로 바뀌어 기포가 생기고, 이 기포가 떠오른다."
  boil 3
step "다른 곳에서도 기포가 생겨 떠오른다."
  boil 4
`),
    tryIt: `<code>boil 3</code>의 숫자(2~6)를 바꾸면, 기포 하나를 이루는 물 분자 수가 달라진다.`,
  },
  {
    id: 'ice',
    part: 2,
    title: '응고와 융해: 얼음이 얼고 녹을 때',
    script: s(`
scene "물이 얼고 녹을 때"
stage solution
lens attract on
crowd H2O in water 40

step "액체가 고체로 바뀌는 것을 응고(어는 것)라고 하고, 고체가 액체로 바뀌는 것을 융해(녹는 것)라고 한다. 액체 물에서는 수소 결합이 쉴 새 없이 생겼다 없어지기 때문에 분자가 제멋대로 이어져 있다."
step "온도가 내려가면 물 분자는 육각형 그물 모양으로 가지런히 이어지며 얼음이 된다. 이 그물에는 빈틈이 많아서 얼음은 물보다 가볍다."
step "액체 물에서는 수소 결합이 제멋대로 이어져 있다."
  wait
step "온도가 내려가면 물 분자는 육각형 그물 모양으로 가지런히 이어지며 얼음이 된다."
  freeze water
step "다시 데우면 그물이 흐트러지면서 녹는다."
  melt water
`),
    tryIt: `얼음 단계에서 보기 설정의 <b>분자 사이 인력</b>을 껐다 켜면서 그물 모양을 비교해 보자.`,
  },
  {
    id: 'dissolving',
    part: 2,
    title: '용해',
    script: s(`
scene "소금이 물에 녹을 때"
stage solution
lens attract on
crowd H2O in water 46
crystal s = NaCl at bottom 5x3

step "소금을 물에 넣으면 눈에 보이지 않게 녹는다. 이처럼 한 물질이 다른 물질 속에 고르게 흩어져 섞이는 것을 용해라고 한다. 소금이 녹을 때 물 분자는 Na⁺ 쪽으로는 O를, Cl⁻ 쪽으로는 H를 향한 채 이온을 둘러싼다."
step "그렇게 둘러싸인 이온이 결정에서 하나씩 떨어져 나온다. 녹아도 소금 자체는 그대로 있어서, 물을 증발시키면 소금이 다시 남는다."
step "아래쪽은 Na+와 Cl-가 번갈아 줄지어 있는 소금 결정이다."
  note s "NaCl 결정"
step "결정 모서리의 이온 둘은 물 분자에 둘러싸이면서 결정에서 떨어져 나온다."
  dissolve 2 from s
step "이어서 다른 이온 둘도 떨어져 나온다."
  dissolve 2 from s
`),
    tryIt: `<code>NaCl</code>을 <code>KBr</code>로 바꿔 보자.`,
  },
  {
    id: 'gas-dissolve',
    part: 2,
    title: '기체가 물에 녹을 때',
    script: s(`
scene "이산화탄소가 물에 녹을 때"
stage interface
lens attract off
crowd H2O in water 22
mol c = CO2 at 480,110

step "기체도 물에 녹는다. 기체 분자가 수면을 지나 물 분자 사이로 들어가는 것이다. 탄산음료에는 이산화탄소가 많이 녹아 있다가, 뚜껑을 열면 다시 공기 중으로 빠져나온다."
step "이산화탄소(CO2) 분자가 수면 위의 공기 중에 있다."
  note c "이산화탄소 분자"
step "CO2 분자가 수면을 지나 물속으로 들어간다."
  gas-in c
step "물속에서도 이 분자는 그대로 CO2다. 분자 안의 결합은 바뀌지 않았다."
  note c "물에 녹은 CO2"
step "녹아 있던 CO2 분자가 다시 수면을 지나 공기 중으로 나온다."
  gas-out c
`),
    tryIt: `보기 설정에서 원자 일련번호를 켜고, 수면을 지나기 전과 뒤에 같은 C와 O인지 확인해 보자. 물에 녹는 동안에도 분자 안의 결합은 그대로다.`,
  },
  {
    id: 'precipitation',
    part: 2,
    title: '석출(침전)',
    script: s(`
scene "질산은 용액과 소금물을 섞을 때"
stage solution
crowd H2O in water 30
place Ag+ in left x3
place NO3- in left x3
place Na+ in right x3
place Cl- in right x3

step "어떤 이온 짝은 물 분자가 당기는 힘보다 서로 당기는 힘이 더 강하다. 그래서 물 분자를 떨치고 고체 결정을 이루는데, 이를 석출 또는 침전이라고 한다. 맑은 용액 두 가지를 섞었을 때 뿌옇게 흐려지며 가루가 가라앉는다면 침전이 생긴 것이다."
step "짝을 이루지 못한 이온은 녹은 채로 남는다."
step "질산은 용액(Ag+, NO3-)과 소금물(Na+, Cl-)을 섞었다."
  spread Ag+ NO3- Na+ Cl- in water
step "이 가운데 Ag+와 Cl-는 물 분자를 떨치고 서로 결합해 고체 염화은(AgCl) 결정이 된다."
  precipitate Ag+ Cl- x3
step "나머지 Na+와 NO3-는 녹은 채로 남는다."
  note Na+ "녹은 채 남은 Na+"
`),
    tryIt: `<code>x3</code>을 <code>x2</code>로 바꾸면 Ag+와 Cl-가 하나씩 녹은 채로 남는다.`,
  },
  {
    id: 'exchange',
    part: 2,
    title: '흡착과 이온 교환',
    script: s(`
scene "점토 표면에서 일어나는 이온 교환"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "어떤 물질이 다른 물질 표면에 달라붙는 것을 흡착이라고 한다. 흙 속 점토 알갱이의 표면에는 음전하(−)를 띤 부위가 있어서, Ca²⁺나 K⁺ 같은 양이온이 여기에 흡착해 있다."
step "빗물에 섞인 H⁺가 이 부위를 차지하면 원래 있던 양이온은 물속으로 떨어져 나오는데, 이를 이온 교환이라고 한다. 이때 들어오는 이온과 나가는 이온은 전하의 합이 같아야 한다."
step "점토 표면의 음전하 부위(−)에 Ca2+와 K+가 흡착해 있다."
  note c "Ca2+: 전하 +2, 부위 2개"
  note k "K+: 전하 +1, 부위 1개"
step "빗물에 섞여 온 H+ 두 개가 Ca2+가 있던 부위를 차지한다. 떨어져 나온 Ca2+는 흙 틈의 물속으로 나간다."
  exchange c with 2 H+ on clay
`),
    tryIt: `<code>2 H+</code>를 <code>1 H+</code>로 바꾸면 전하가 맞지 않는다는 오류가 난다.`,
  },
  {
    id: 'leaching',
    part: 2,
    title: '씻겨 내려감(용탈)',
    script: s(`
scene "산성비가 내린 흙에서 칼슘이 씻겨 내려갈 때"
stage soil
mol c = Ca2+ on clay in topsoil
mol k = K+ on clay in topsoil

step "물에 녹아 나온 이온은 빗물과 함께 흙 틈을 따라 아래로 내려간다. 이를 용탈이라고 한다. 비가 많이 오는 곳에서 흙의 양분이 빠져나가 땅이 척박해지는 것도 용탈 때문이다."
step "빗물에 섞여 온 H+ 두 개가 점토 표면에서 Ca2+가 있던 부위를 차지한다."
  exchange c with 2 H+ on clay
step "떨어져 나온 Ca2+는 물 분자에 둘러싸인 채 빗물을 따라 속흙으로 내려간다."
  leach c from topsoil to subsoil
step "반면 점토에 흡착해 있는 K+는 그대로 남는다. 빗물에 씻겨 내려가는 것은 물에 녹아 나온 이온뿐이다."
  note k "아직 흡착해 있는 K+"
`),
    tryIt: `<code>to subsoil</code>을 <code>to groundwater</code>로 바꿔 보자.`,
  },
  {
    id: 'membrane',
    part: 2,
    title: '막 수송: 통로와 펌프',
    script: s(`
scene "이온이 세포막을 지나갈 때"
stage membrane
protein k = channel K+ at 330
protein p = pump at 680
crowd H2O in outside 12
crowd H2O in inside 12
place K+ in inside x5
place K+ in outside x1
place Na+ in outside x5
place Na+ in inside x3

step "세포막은 기름 성분(인지질) 두 층으로 되어 있어서, 이온은 그냥 지나가지 못한다. 대신 막에 박힌 단백질을 거쳐서 지나간다."
step "이때 농도(일정한 부피 안에 있는 입자 수)가 높은 쪽에서 낮은 쪽으로 통로를 지나가는 것은 확산이고, 에너지를 써서 반대쪽으로 옮기는 것은 능동 수송이다."
step "세포 안에는 K+가, 바깥에는 Na+가 많다."
  note k "K+ 통로"
  note p "나트륨-칼륨 펌프"
step "먼저 K+ 하나가 통로를 지나, K+가 적은 바깥으로 나간다(확산)."
  cross K+ via k
step "펌프는 ATP 에너지를 써서 Na+ 세 개를 밖으로, K+ 두 개를 안으로 옮긴다(능동 수송)."
  pump p 3 Na+ out 2 K+ in
`),
    tryIt: `<code>cross K+ via k</code>를 <code>cross Na+ via k</code>로 바꾸면 K+ 전용 통로라는 경고가 뜬다. 통로마다 지나갈 수 있는 이온이 정해져 있다.`,
  },
  {
    id: 'osmosis',
    part: 2,
    title: '삼투',
    script: s(`
scene "물이 소금 쪽으로 건너갈 때"
stage membrane
protein a = channel H2O at 500
crowd H2O in outside 22
crowd H2O in inside 22
place Na+ in inside x4
place Cl- in inside x4

step "물 분자만 지나가고 녹아 있는 이온은 지나가지 못하는 막을 사이에 두면, 물은 이온이 많은 쪽으로 더 많이 건너간다. 이를 삼투라고 한다. 배추를 소금에 절이면 숨이 죽는 것도 삼투 때문이다. 세포 속의 물이 소금기가 많은 바깥으로 빠져나가기 때문이다."
step "막 아래쪽(안쪽)에 소금 이온이 많다. 이온은 막을 지나가지 못하지만, 물 분자는 물 통로로 지나간다."
  note a "물 통로(아쿠아포린)"
step "물 분자는 이온이 적은 위쪽에서 이온이 많은 아래쪽으로 더 많이 건너간다."
  osmosis 4
step "물이 계속 건너가 아래쪽이 묽어지면, 건너가는 속도도 느려진다."
  osmosis 4
`),
    tryIt: `소금 이온을 <code>in outside</code>로 옮겨 적으면 물이 위쪽으로 건너간다.`,
  },
  // ------------------------------------------------------------------ part 3
  {
    id: 'acid-hcl',
    part: 3,
    title: '산과 염기 ①: 산이 H⁺를 내줄 때',
    script: s(`
scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol a = HCl at left
mol w = H2O at center

step "H⁺(수소 이온)를 내주는 물질을 산이라고 하고, 비공유 전자쌍으로 H⁺와 결합하는 물질을 염기라고 한다. 염화수소(HCl)를 물에 녹이면 H⁺가 물 분자로 옮겨 가서 하이드로늄 이온(H₃O⁺)이 생긴다."
step "물속에 H₃O⁺가 많을수록 산성이 강한데, 식초나 위산이 신 것도 이 때문이다."
step "물 분자와 HCl이 서로 끌려 다가간다. 이때 O의 비공유 전자쌍은 HCl의 H 쪽을 향한다."
  approach w.O a.H
step "O의 전자쌍은 새 O–H 결합이 되고, H–Cl 결합의 전자쌍은 Cl로 옮겨 간다."
  transfer a.H to w.O
step "이렇게 해서 하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고, 둘레의 물 분자가 두 이온을 둘러싼다."
  solvate all
`),
    tryIt: `<code>transfer a.H to w.O</code> 한 줄은 다음 두 줄과 같다: <code>arrow w.O:lp -> w.O~a.H</code> <code>arrow a.H~a.Cl -> a.Cl</code>`,
  },
  {
    id: 'base-nh3',
    part: 3,
    title: '산과 염기 ②: 물이 산이 될 때',
    script: s(`
scene "암모니아가 물속에서 염기가 될 때"
stage solution
crowd H2O in water 30
mol n = NH3 at left
mol w = H2O at center

step "물은 상대에 따라 산이 되기도 하고 염기가 되기도 한다. 암모니아처럼 H⁺와 잘 결합하는 물질 옆에서는 물이 H⁺를 내주는 산이 되고, 그 뒤에 수산화 이온(OH⁻)이 남는다. 물속에 OH⁻가 많은 상태를 염기성이라고 한다."
step "비누나 표백제를 만지면 미끈거리는 것도 염기성 때문이다."
step "암모니아와 물 분자가 서로 끌려 다가간다. 이때 N의 비공유 전자쌍은 물의 H 쪽을 향한다."
  approach n.N w.H1
step "N의 전자쌍은 새 N–H 결합이 되고, O–H 결합의 전자쌍은 O로 옮겨 간다."
  transfer w.H1 to n.N
step "이렇게 해서 암모늄 이온(NH4+)과 수산화 이온(OH-)이 생긴다."
  note n.N "NH4+ (N에 전하 +1)"
  note w.O "OH- (O에 전하 −1)"
`),
    tryIt: `마지막 단계에 <code>solvate all</code>을 더해 보자.`,
  },
  {
    id: 'weak-acid',
    part: 3,
    title: '강한 산과 약한 산',
    script: s(`
scene "아세트산이 물에 녹을 때"
stage solution
crowd H2O in water 20
mol a = CH3COOH at 420,300
mol b = CH3COOH at 750,420
mol w = H2O at 230,300

step "산이 H+를 내주는 정도를 산의 세기라고 한다. 염화수소(HCl) 같은 강한 산은 물속에서 거의 모든 분자가 H+를 내주지만, 식초의 아세트산 같은 약한 산은 일부만 내주고, 내준 H+를 되찾기도 한다."
step "물속에 아세트산(CH3COOH) 분자들이 있다."
  note a "아세트산"
  note b "아세트산"
step "물 분자와 아세트산이 서로 끌려 다가간다. O의 비공유 전자쌍은 아세트산의 O–H에 있는 H 쪽을 향한다."
  approach w.O a.H4
step "아세트산 한 분자가 물에 H+를 내준다. 하이드로늄 이온(H3O+)과 아세트산 이온(CH3COO-)이 생긴다."
  transfer a.H4 to w.O
step "다른 아세트산 분자는 H+를 내주지 않고 그대로 있다. 실제로도 아세트산 분자 대부분은 이렇게 그대로 남는다."
  note b "그대로 남은 아세트산"
step "H3O+가 아세트산 이온에 H+를 돌려주기도 한다. 약한 산의 용액에서는 두 방향의 반응이 함께 일어난다."
  transfer a.H4 to a.O2
`),
    tryIt: `보기 설정에서 원자 일련번호를 켜고 넷째 단계와 마지막 단계를 오가며, H₃O⁺로 갔던 H가 아세트산 이온의 어느 O로 돌아오는지 찾아보자.`,
  },
  {
    id: 'neutralization',
    part: 3,
    title: '중화 반응',
    script: s(`
scene "산과 염기가 섞여 물이 될 때"
stage solution
crowd H2O in water 24
mol a = H3O+ at left
mol b = OH- at right

step "산성 용액과 염기성 용액을 섞으면, H₃O⁺의 H⁺가 OH⁻로 옮겨 가 물 분자 두 개가 된다. 산성과 염기성이 함께 없어지기 때문에 이 반응을 중화라고 한다. 중화할 때는 열이 나서 용액이 조금 따뜻해진다. 속이 쓰릴 때 먹는 제산제도 위산을 중화하는 약이다."
step "산성 용액에는 하이드로늄 이온(H3O+)이, 염기성 용액에는 수산화 이온(OH-)이 있다."
  note a.O "산성을 내는 H3O+"
  note b.O "염기성을 내는 OH-"
step "두 용액을 섞으면 OH-와 H3O+가 서로 끌려 다가간다. 이때 OH-의 비공유 전자쌍은 H3O+의 H 쪽을 향한다."
  approach b.O a.H1
step "H3O+의 H+ 하나가 OH-로 옮겨 가면서 열이 나온다."
  transfer a.H1 to b.O
  energy -56 kJ/mol
step "결국 두 이온은 물 분자 두 개가 되고, 산성과 염기성이 함께 사라진다(중화)."
  note a.O "물"
  note b.O "물"
`),
    tryIt: `<code>energy -56 kJ/mol</code>은 물 1몰(약 18 g)이 생길 때 나오는 열이다. 이 줄을 지우면 오른쪽 위 에너지 그래프가 사라진다.`,
  },
  {
    id: 'redox',
    part: 3,
    title: '산화와 환원: 전자 이동',
    script: s(`
scene "아연이 구리 이온에 전자를 내줄 때"
stage solution
lens oxidation on
crowd H2O in water 26
mol z = Zn at left
mol c = Cu2+ at right

step "원자가 전자를 잃는 것을 산화라고 하고, 전자를 얻는 것을 환원이라고 한다. 한쪽이 잃은 전자는 다른 쪽이 얻으므로, 산화와 환원은 언제나 함께 일어난다. 철이 녹스는 것, 물질이 산소와 반응하며 불꽃을 내는 연소, 전지가 전기를 만드는 것이 모두 산화·환원이다."
step "산화수는 원자가 전자를 얼마나 잃었는지(+), 얼마나 얻었는지(−)를 나타내는 숫자다."
step "왼쪽의 아연 원자(Zn)에는 바깥 전자가 2개 있다. 오른쪽의 구리 이온(Cu2+)은 반대로 전자가 2개 모자란다."
  note z.Zn "바깥 전자 2개"
  note c.Cu "전자 2개 모자람"
step "구리 이온과 아연 원자가 서로 끌려 다가간다."
  approach c.Cu z.Zn
step "아연의 바깥 전자 두 개는 하나씩 구리 이온으로 옮겨 가고, 그때마다 에너지가 나온다."
  hop 2 z.Zn -> c.Cu
  energy -212 kJ/mol
step "전자를 잃은 아연은 Zn2+가 되고(산화), 전자를 얻은 구리는 Cu 원자가 된다(환원)."
  solvate z
`),
    tryIt: `<code>energy -212 kJ/mol</code> 뒤에 <code>barrier 60</code>을 더 적으면, 반응이 넘어야 하는 에너지 언덕(활성화 에너지)이 그려진다.`,
  },
  {
    id: 'metal-reactivity',
    part: 3,
    title: '금속의 반응성',
    script: s(`
scene "아연 조각을 구리 이온 용액에 넣을 때"
stage solution
crowd H2O in water 24
metal m = Zn at 430,320 3x2
mol c = Cu2+ at 650,320
place SO42- in water x1

step "금속마다 전자를 내주는 정도가 다르다. 아연(Zn)은 구리(Cu)보다 전자를 잘 내준다. 그래서 아연 조각을 구리 이온이 녹아 있는 용액에 넣으면 아연의 전자가 구리 이온으로 옮겨 간다."
step "아연 조각이 구리 이온(Cu2+)이 녹아 있는 용액에 잠겨 있다."
  note m "아연 조각"
  solvate all
step "구리 이온이 아연 조각 표면에 닿는다."
  land c on m3
step "아연 원자의 전자 두 개가 구리 이온으로 건너간다. 구리 이온은 금속 구리가 되어 표면에 붙는다."
  hop 2 m3.Zn -> c.Cu
  join c to m
step "전자를 내준 아연은 아연 이온(Zn2+)이 되어 물속으로 나온다."
  leave m3 from m
step "반대로 구리 조각을 아연 이온 용액에 넣으면 아무 일도 일어나지 않는다. 구리는 아연보다 전자를 내주기 어렵기 때문이다."
  note m3 "아연 이온"
  note c "금속 구리"
`),
    tryIt: `<code>hop 2</code>를 <code>hop 1</code>로 바꿔 보자. 전자가 하나만 건너가면 구리 이온은 아직 이온이어서 금속에 붙을 수 없다는 오류가 나온다. Cu²⁺가 금속 구리가 되려면 전자 두 개가 필요하다.`,
  },
  {
    id: 'cell',
    part: 3,
    title: '전지: 산화·환원으로 전기를 만들 때',
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

step "전지 안에서는 산화와 환원이 서로 다른 전극에서 따로 일어난다. 산화 전극에서 나온 전자는 도선을 따라 환원 전극으로 가는데, 가는 동안 전구를 켜는 일을 할 수 있다. 염다리 속 이온은 두 용액의 전하가 한쪽으로 치우치지 않도록 맞춰 준다."
step "왼쪽에는 아연판이 황산아연 용액에, 오른쪽에는 구리판이 황산구리 용액에 잠겨 있다. 두 판은 도선으로, 두 용액은 염다리로 이어져 있다."
  note left "아연판"
  note right "구리판"
step "먼저 아연판 표면의 아연 원자 하나가 전자 2개를 판에 남기고, Zn2+가 되어 용액으로 나간다(산화)."
  oxidize left
step "판에 남은 전자 2개는 도선을 따라 구리판으로 간다. 이렇게 흐르는 전자가 바로 전류다."
  wire 2
step "구리판에 도착한 전자 2개는 구리 이온이 얻는다. 전자를 얻은 구리 이온은 구리 원자가 되어 판의 일부가 된다(환원)."
  reduce c at right
step "이제 왼쪽 용액에는 양이온이 늘고, 오른쪽 용액에는 줄었다. 그래서 염다리의 Cl-는 왼쪽으로, K+는 오른쪽으로 들어가 전하를 맞춘다."
  bridge Cl- K+ x2
`),
    tryIt: `<code>wire 2</code>를 <code>wire 1</code>로 바꾸면 환원 전극에 전자가 모자란다는 오류가 난다. 구리 이온 하나가 구리 원자가 되려면 전자가 2개 필요하기 때문이다.`,
  },
  {
    id: 'radical',
    part: 3,
    title: '라디칼 반응',
    script: s(`
scene "염소와 메테인의 라디칼 반응"
stage gas
mol c = Cl2 at 400,330
mol m = CH4 at 640,330

step "전자는 보통 두 개씩 짝을 지어 있지만, 짝 없이 혼자 있는 전자(홑전자)가 있는 입자도 있다. 이런 입자를 라디칼이라고 한다. 라디칼은 짝을 찾으려는 성질이 강해서 다른 분자의 결합을 깨뜨리고, 결합이 깨진 분자는 다시 라디칼이 된다."
step "그래서 반응이 꼬리를 물고 이어지는데, 이를 연쇄 반응이라고 한다. 라디칼은 빛, 특히 자외선이 결합을 깰 때 많이 생긴다. 햇볕을 오래 쬔 플라스틱이 삭는 것도 라디칼 반응 때문이다."
step "Cl2는 빛을 흡수하면 결합이 깨진다. 이때 결합 전자 두 개는 두 Cl로 하나씩 나뉘어 간다."
  light c
  hop c.Cl1~c.Cl2 -> c.Cl1
  hop c.Cl1~c.Cl2 -> c.Cl2
step "홑전자가 생긴 Cl을 염소 라디칼이라고 한다. 그중 하나와 메테인이 서로 끌려 다가간다."
  approach c.Cl2 m.H1
step "Cl의 홑전자는 C–H 결합 전자 하나와 짝을 지어 새 Cl–H 결합이 되고, C–H 결합의 나머지 전자 하나는 C에 남는다."
  hop c.Cl2 -> c.Cl2~m.H1
  hop m.C~m.H1 -> c.Cl2~m.H1
  hop m.C~m.H1 -> m.C
step "이렇게 해서 염화수소(HCl)와 메틸 라디칼(CH3·)이 생긴다. 이 메틸 라디칼이 다시 Cl2와 반응하면서 연쇄 반응이 이어진다."
  note m.C "홑전자 1개"
`),
    tryIt: `<code>light c</code> 줄을 지워도 화면은 그려진다. 하지만 실제로는 빛이나 열이 있어야 Cl–Cl 결합이 깨진다.`,
  },
  {
    id: 'substitution',
    part: 3,
    title: '치환 반응',
    script: s(`
scene "암모니아가 브로모메테인의 Br 대신 결합할 때"
stage solution
crowd H2O in water 20
mol n = NH3 at left
mol m = CH3Br at right

step "분자 속 원자 하나가 다른 원자(또는 원자 몇 개가 모인 덩어리)로 바뀌는 반응을 치환 반응이라고 한다. Br이나 Cl처럼 전자를 세게 당기는 원자와 결합한 C는 조금 +를 띤다."
step "그래서 비공유 전자쌍이 있는 분자가 이 C에 다가가 새 결합을 만들고, 그와 동시에 원래 있던 원자가 떨어져 나간다. 약이나 플라스틱 원료를 만들 때 자주 쓰는 반응이다."
step "브로모메테인(CH3Br)의 Br은 전자를 세게 당긴다. 그래서 Br과 결합한 C는 조금 +를 띤다."
  note m.C "조금 + (δ+)"
  note m.Br "전자를 세게 당기는 Br"
step "암모니아와 브로모메테인이 서로 끌려 다가간다. 암모니아는 Br의 반대쪽에서 C를 만나고, N의 비공유 전자쌍은 C를 향한다."
  approach n.N m.C
step "N의 전자쌍은 N–C 새 결합이 되고, C–Br 결합의 전자쌍은 Br로 간다. Br은 브로민화 이온(Br-)이 되어 떨어져 나간다."
  arrow n.N:lp -> n.N~m.C
  arrow m.C~m.Br -> m.Br
step "결국 C에는 Br 대신 N이 결합해 있다. 이처럼 원자 하나가 다른 것으로 바뀌는 반응을 치환 반응이라고 한다."
  note n.N "새로 결합한 N"
`),
    tryIt: `<code>NH3</code>를 <code>OH-</code>로, <code>n.N</code>을 모두 <code>n.O</code>로 바꿔 보자. 메탄올(CH₃OH)이 생긴다.`,
  },
  {
    id: 'addition',
    part: 3,
    title: '첨가 반응',
    script: s(`
scene "에텐에 브로민화수소가 더해질 때"
stage solution
mol e = C2H4 at 380,300
mol h = HBr at 660,300

step "이중 결합에는 전자쌍이 두 개 있다. 그중 하나가 새 결합에 쓰이면서 두 분자가 하나로 합쳐지는 반응을 첨가 반응이라고 한다. 식물성 기름에 수소를 더해 마가린을 만들거나, 작은 분자 수천 개를 이어 비닐(폴리에틸렌)을 만드는 것이 모두 첨가 반응이다."
step "에텐(C2H4)의 두 C는 이중 결합으로 이어져 있다. 두 C 사이에 전자쌍이 두 개 있다는 뜻이다."
  note e.C1~e.C2 "이중 결합"
step "브로민화수소(HBr)와 에텐이 서로 끌려 다가간다. HBr의 H는 이중 결합 쪽을 향한다."
  approach h.H e.C1
step "이중 결합의 전자쌍 하나는 새 C–H 결합이 되고, H–Br 결합의 전자쌍은 Br로 간다."
  arrow e.C1~e.C2 -> e.C1~h.H
  arrow h.H~h.Br -> h.Br
step "그러자 H와 결합하지 않은 쪽 C는 전자가 모자라 +를 띠게 된다. Br-는 이 C에 끌려 다가간다."
  approach h.Br e.C2
step "Br-의 비공유 전자쌍은 새 C–Br 결합이 된다."
  arrow h.Br:lp -> h.Br~e.C2
step "이중 결합이 있던 두 C에 H와 Br이 하나씩 더해졌다. 이렇게 두 분자가 하나로 합쳐지는 반응을 첨가 반응이라고 한다."
  note e.C2 "Br이 더해진 C"
  note e.C1 "H가 더해진 C"
`),
    tryIt: `<code>HBr</code>를 <code>HCl</code>로, <code>h.Br</code>을 모두 <code>h.Cl</code>로 바꿔 보자.`,
  },
  {
    id: 'condensation',
    part: 3,
    title: '축합과 가수분해',
    script: s(`
scene "두 아미노산이 이어졌다가 다시 나뉠 때"
stage solution
crowd H2O in water 16
mol g1 = Gly at 330,300
mol g2 = Gly at 670,300

step "두 분자가 물 분자 하나를 내보내면서 하나로 이어지는 반응을 축합이라고 한다. 거꾸로 물이 들어가면서 결합이 깨지는 반응은 가수분해라고 한다. 몸속의 단백질·녹말·지방은 축합으로 만들어지고, 음식을 소화하는 과정은 가수분해다."
step "화면에는 글라이신 분자 두 개가 있다. 글라이신은 한쪽 끝에 카복실기(-COOH)가, 다른 쪽 끝에 아미노기(-NH2)가 있다."
  note g1.C2 "카복실기"
  note g2.N "아미노기"
step "두 분자가 서로 끌려 다가간다. 오른쪽 분자의 아미노기가 왼쪽 분자의 카복실기를 향한다."
  approach g2.N g1.C2
step "왼쪽 분자의 -OH와 오른쪽 분자의 H 하나가 떨어져 나와 물 분자가 되고, 남은 C와 N이 결합한다(축합)."
  condensation g1.C2 g2.N
step "이렇게 생긴 C–N 결합을 펩타이드 결합이라고 한다."
  note g1.C2~g2.N "펩타이드 결합"
step "물 분자가 들어가면 펩타이드 결합이 깨지면서 두 아미노산으로 다시 나뉜다(가수분해)."
  hydrolysis g1.C2~g2.N
`),
    tryIt: `<code>Gly</code>를 <code>Ala</code>(알라닌)로 바꿔 보자. 원자 이름은 SMILES 순서(<code>CC(N)C(=O)O</code>)를 따르기 때문에 카복실 탄소가 <code>C3</code>가 된다.`,
  },
  {
    id: 'polymer',
    part: 3,
    title: '고분자: 작은 분자가 길게 이어질 때',
    script: s(`
scene "작은 분자들이 이어져 고분자가 될 때"
stage gas
mol a = Gly at 200,290
mol b = Gly at 450,290
mol c = Gly at 740,420

step "작은 분자가 수백, 수천 개 이어져 생긴 큰 분자를 고분자라고 한다. 단백질, 녹말, 나일론이 고분자다. 단백질은 아미노산이 축합으로 하나씩 이어져 생긴다."
step "아미노산(글라이신)의 한쪽 끝에는 아미노기, 다른 쪽 끝에는 카복실기가 있다. 두 끝 모두 다른 분자와 이어질 수 있다."
  note a.N "아미노기"
  note a.C2 "카복실기"
step "두 분자가 서로 끌려 다가간다."
  approach b.N a.C2
step "한 분자의 카복실기와 다른 분자의 아미노기가 이어지고, 물 한 분자가 빠져나온다."
  condensation a.C2 b.N
step "남은 끝에 다음 분자가 다가간다."
  approach c.N b.C2
step "다시 결합이 생기고 물 한 분자가 더 빠져나온다. 이렇게 계속 이어지면 긴 사슬이 된다."
  condensation b.C2 c.N
step "사슬의 양 끝에는 아직 이어질 수 있는 아미노기와 카복실기가 남아 있다."
  note a.N "한쪽 끝"
  note c.C2 "다른 쪽 끝"
`),
    tryIt: `<code>mol c = Gly at 740,420</code>을 <code>mol c = Ala at 740,420</code>으로 바꿔 보자. 다른 아미노산(알라닌)도 같은 방식으로 이어진다. 단백질은 스무 가지쯤의 아미노산이 이렇게 이어진 사슬이다.`,
  },
  {
    id: 'coordination',
    part: 3,
    title: '배위 결합: 착이온',
    script: s(`
scene "구리 이온과 암모니아가 착이온을 만들 때"
stage solution
crowd H2O in water 18
mol c = Cu2+ at center
mol n1 = NH3 at 320,310
mol n2 = NH3 at 680,310
mol n3 = NH3 at 500,130
mol n4 = NH3 at 500,490

step "보통의 공유 결합에서는 두 원자가 전자를 하나씩 낸다. 그런데 배위 결합에서는 한쪽 원자가 비공유 전자쌍을 통째로 내준다. 금속 이온 둘레에 물이나 암모니아 같은 분자가 이렇게 결합한 이온을 착이온이라고 한다."
step "혈액 속 헤모글로빈의 철이 산소와 결합하는 것도 배위 결합이다."
step "가운데 있는 구리 이온(Cu2+)은 다른 분자의 비공유 전자쌍과 결합할 수 있다."
  note c.Cu "Cu2+"
step "둘레의 암모니아 네 분자가 구리 이온에 끌려 다가간다. 이때 N의 비공유 전자쌍은 구리 이온을 향한다."
  approach n1.N c.Cu
  approach n2.N c.Cu
  approach n3.N c.Cu
  approach n4.N c.Cu
step "N의 비공유 전자쌍은 N과 Cu 사이로 옮겨 가 배위 결합이 된다. 이런 결합이 모두 네 개 생긴다."
  ligand n1.N -> c.Cu
  ligand n2.N -> c.Cu
  ligand n3.N -> c.Cu
  ligand n4.N -> c.Cu
step "이렇게 해서 착이온 [Cu(NH3)4]2+가 만들어진다. 전자쌍은 모두 N에서 왔기 때문에, +2 전하는 여전히 구리에 있다."
  note c.Cu "전하 +2"
`),
    tryIt: `<code>NH3</code>를 <code>H2O</code>로, <code>.N</code>을 모두 <code>.O</code>로 바꿔 보자. 물 분자도 같은 방식으로 구리 이온과 결합한다.`,
  },
  // ------------------------------------------------------------------ part 4
  {
    id: 'energy',
    part: 4,
    title: '반응과 에너지',
    script: s(`
scene "반응이 넘어야 하는 에너지 언덕"
stage solution
crowd H2O in water 22
mol o = OH- at left
mol m = CH3Br at right

step "결합이 깨질 때는 에너지가 필요하고, 결합이 생길 때는 에너지가 나온다. 반응 전체로 보아 에너지가 나오면 발열 반응이라고 하고, 이때 주변이 따뜻해진다. 반대로 에너지를 흡수하면 흡열 반응이라고 하고, 주변이 차가워진다."
step "대부분의 반응은 처음에 에너지 언덕을 하나 넘어야 일어나는데, 이 언덕의 높이를 활성화 에너지라고 한다. 촉매는 이 언덕을 낮춰서 반응을 빠르게 하는 물질이다. 몸속의 효소도 촉매다."
step "아직 반응하기 전이다. 오른쪽 위 그래프는 분자들의 에너지를 나타낸다."
  note o.O "OH-"
  note m.C "CH3Br"
step "OH-와 CH3Br이 서로 끌려 다가간다. OH-는 CH3Br의 C를 향한다."
  approach o.O m.C
step "결합이 바뀌는 동안 에너지는 잠깐 올라갔다가(언덕) 내려간다. 이 언덕의 높이를 활성화 에너지라고 한다(숫자는 물속 기준 대략적인 값)."
  arrow o.O:lp -> o.O~m.C
  arrow m.C~m.Br -> m.Br
  energy -75 kJ/mol barrier 95
step "반응이 끝나면 에너지가 처음보다 낮아지고, 낮아진 만큼 열이 주변으로 나간다(발열 반응). 반대로 에너지가 처음보다 높아지는 반응은 주변에서 열을 흡수한다(흡열 반응)."
  note m.Br "떨어져 나간 Br-"
`),
    tryIt: `<code>barrier 95</code>를 <code>barrier 40</code>으로 바꿔 보자. 촉매가 하는 일이 바로 이렇게 언덕을 낮추는 것이다.`,
  },
  {
    id: 'equilibrium',
    part: 4,
    title: '화학 평형',
    script: s(`
scene "수소와 아이오딘이 평형에 이를 때"
stage gas
place H2 in air x10
place I2 in air x10

step "반응 가운데에는 앞으로도 뒤로도 일어나는 것이 많다. 이런 반응을 가역 반응이라고 한다. 처음에는 반응물 분자끼리 부딪쳐 생성물이 생기지만, 생성물이 늘수록 생성물끼리 부딪쳐 반응물이 다시 생기는 반응(역반응)도 잦아진다."
step "두 방향의 빠르기가 같아지면 분자 수가 더는 변하지 않는데, 이 상태를 화학 평형이라고 한다. 겉으로는 멈춘 것처럼 보여도 두 반응은 계속 일어나고 있다."
step "용기 안에 수소(H2)와 아이오딘(I2) 분자가 섞여 있다. 기체 분자는 쉬지 않고 날아다니며 서로 부딪친다."
  wait
step "H2와 I2가 부딪치면 결합이 바뀌어 HI 분자 두 개가 생긴다. 거꾸로 HI끼리 부딪쳐 H2와 I2가 다시 생기기도 한다."
  ensemble H2 + I2 <=> 2 HI for 10s
step "시간이 지나 두 반응의 빠르기가 같아지면, 분자 수는 더 이상 크게 변하지 않는다. 이 상태가 평형이다."
  ensemble H2 + I2 <=> 2 HI for 8s
`),
    tryIt: `<code>&lt;=&gt;</code>를 <code>-&gt;</code>로 바꾸면 역반응이 빠져서 HI만 계속 늘어난다.`,
  },
];
