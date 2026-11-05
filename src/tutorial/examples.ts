/**
 * Ready-made scenes on particular topics, like the sample notes a notes app
 * ships with. They open in the workspace, where they can be played and edited.
 * Each one strings together several basic changes from the tutorial.
 */
export interface Example {
  id: string;
  title: string;
  /** One line under the title in the list. */
  summary: string;
  script: string;
}

const s = (x: string) => x.replace(/^\n/, '');

export const EXAMPLES: Example[] = [
  {
    id: 'limestone',
    title: '석회 동굴과 종유석',
    summary: '석회암은 이산화탄소가 녹은 빗물에 녹아 동굴이 되고, 반응이 거꾸로 일어나면 종유석이 자라요',
    script: s(`
scene "석회 동굴이 생기고 종유석이 자랄 때"
stage interface
lens attract off
crowd H2O in water 18
mol c = CO2 at 330,120
mol w = H2O at 300,330
crystal s = CaCO3 at water 6x2

step "비가 내릴 때 공기 중의 이산화탄소(CO2)가 빗물에 녹아들어요"
  gas-in c
step "물 분자가 CO2의 C에 다가가요. 이때 O의 비공유 전자쌍은 C를 향해 있어요"
  approach w.O c.C
step "O의 전자쌍은 새 O–C 결합이 되고, C=O 결합 하나의 전자쌍은 O로 옮겨 가요"
  arrow w.O:lp -> w.O~c.C
  arrow c.C~c.O1 -> c.O1
step "이어서 H+ 하나가 옆 O로 옮겨 가면 탄산(H2CO3)이 돼요"
  transfer w.H1 to c.O1
step "빗물에 녹은 탄산은 땅속 석회암(탄산칼슘, CaCO3) 표면에 다가가요"
  approach w.H2 s4.O1
step "탄산의 H+가 석회암 표면에 있는 탄산 이온(CO32-)의 O로 옮겨 가요"
  transfer w.H2 to s4.O1
step "H+를 얻은 탄산 이온은 탄산수소 이온(HCO3-)이 되어, 옆의 칼슘 이온(Ca2+)과 함께 물에 녹아 나가요. 석회암이 이렇게 조금씩 녹아서 동굴이 생겨요"
  dissolve s3 s4 from s
step "한편 동굴 천장에 맺힌 물방울에서는 반응이 거꾸로 일어나요. 먼저 탄산수소 이온 하나가 다른 탄산수소 이온에 다가가요"
  approach w.H2 w.O
step "한쪽의 H+가 다른 쪽으로 옮겨 가면서 탄산(H2CO3)과 탄산 이온(CO32-)이 생겨요"
  transfer w.H2 to w.O
step "탄산 안에서 H+ 하나가 옆 O로 옮겨 가요"
  transfer w.H1 to w.O
step "C–O 결합의 전자쌍은 O로 가서 물 분자가 떨어져 나가고, 남은 O의 전자쌍은 C=O 결합이 돼요"
  arrow c.O1:lp -> c.O1~c.C
  arrow c.C~w.O -> w.O
step "이렇게 생긴 CO2는 공기 중으로 빠져나가요"
  gas-out c
step "남은 칼슘 이온과 탄산 이온은 물 분자를 떨치고 다시 결정이 돼요. 이 결정이 조금씩 늘어나면서 종유석이 자라요"
  precipitate Ca2+ CO32- onto s
`),
  },
  {
    id: 'li-battery',
    title: '리튬 이온 전지: 충전·방전과 수명',
    summary: '충전과 방전 때 리튬 이온이 두 전극 사이를 오가고, SEI 막에 리튬이 갇힐수록 용량이 줄어요',
    script: s(`
scene "리튬 이온 전지가 충전과 방전을 되풀이하며 닳을 때"
stage battery
load cathode 10
crowd EC in electrolyte 5

step "다 방전된 전지예요. 리튬은 모두 양극(금속 산화물)의 층 사이에 이온(Li+) 상태로 있어요"
  note cathode "층 사이에 리튬 이온이 있는 산화물"
step "충전하면 충전기가 양극에서 전자를 빼내 음극으로 보내요. 그만큼 Li+가 전해질과 분리막을 지나 흑연 층 사이로 들어가요"
  charge 4
step "처음 충전할 때는 흑연 표면에서 전해질 일부가 전자를 얻어 분해돼요. 분해된 전해질은 리튬과 함께 얇은 막(SEI)이 되는데, 여기 갇힌 리튬은 다시 나오지 못해요"
  sei 1
step "방전하면 흑연 속 리튬이 전자를 내보내요. 전자는 기기를 거쳐 양극으로 가고, Li+도 전해질을 지나 양극으로 가요"
  discharge 4
step "SEI는 충전할 때마다 조금씩 두꺼워지고, 그때마다 리튬이 더 갇혀요"
  charge 3
  sei 1
step "쓸 수 있는 리튬이 줄어든 만큼, 전지에 저장할 수 있는 전기의 양(용량)도 줄어요. 오래 쓴 전지의 수명이 짧아지는 주된 까닭이 이것이에요"
  discharge 3
`),
  },
  {
    id: 'mitochondria',
    title: '미토콘드리아의 ATP 합성',
    summary: 'ATP 합성 효소는 H⁺가 흘러드는 힘으로 ADP와 인산을 이어 ATP를 만들어요',
    script: s(`
scene "미토콘드리아가 ATP를 만들 때"
stage mito
protein e = pump at 240
protein a = synthase at 640
crowd H2O in outside 10
crowd H2O in inside 12
place H+ in outside x3
place H+ in inside x5
mol d = ADP at 380,515
mol p = H2PO4- at 700,520

step "가운데 막은 미토콘드리아 내막이에요. 막 위쪽은 막 사이 공간, 아래쪽은 기질이에요"
  note e "전자 전달계"
  note a "ATP 합성 효소"
step "음식에서 온 전자가 전자 전달계를 지나면서 에너지를 내요. 이 에너지로 H+를 기질에서 막 사이 공간으로 퍼 올려요"
  pump e 4 H+ out
step "그러면 막 사이 공간에 H+가 많아져요. 이 H+는 ATP 합성 효소의 통로를 지나 기질로 다시 들어와요"
  cross 3 H+ via a
step "ATP 합성 효소는 이 흐름의 에너지로 ADP와 인산을 가까이 모아요"
  approach d.O7 p.P
step "ADP 끝의 O가 인산의 P와 결합하고, 인산의 -OH와 ADP의 H는 물 분자가 되어 떨어져 나와요(축합). ATP가 만들어졌어요"
  condensation p.P d.O7
  energy +30 kJ/mol
step "세포가 일할 때는 ATP가 가수분해되면서 인산 하나가 떨어져 나가고, 이때 에너지가 나와요"
  hydrolysis p.P~d.O7
  energy -30
`),
  },
  {
    id: 'root',
    title: '뿌리털이 양분을 얻을 때',
    summary: '뿌리가 내보낸 H⁺가 점토에 흡착된 K⁺와 바뀌면, 떨어져 나온 K⁺가 뿌리털 세포로 들어가요',
    script: s(`
scene "뿌리털이 흙에서 칼륨 이온을 얻을 때"
stage root
protein p = pump at 260
protein k = channel K+ at 700
crowd H2O in outside 10
crowd H2O in inside 12
mol c = K+ on clay
mol d = Ca2+ on clay
place H+ in inside x3

step "점토 알갱이 표면의 음전하 부위에 K+와 Ca2+가 흡착해 있어요. 이 상태로는 뿌리가 흡수할 수 없어요"
  note c "흡착된 K+"
  note p "H+ 펌프"
  note k "K+ 통로"
step "뿌리털 세포는 ATP 에너지를 써서 H+를 흙 속 물로 내보내요"
  pump p 2 H+ out
step "이 H+가 점토 표면에서 K+가 있던 부위를 차지하고, 떨어져 나온 K+는 흙 속 물로 나와요(이온 교환)"
  exchange c with H+ on clay
step "흙 속 물로 나온 K+는 K+ 통로를 지나 뿌리털 세포 안으로 들어가요"
  cross c via k
`),
  },
];
