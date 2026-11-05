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
    intro: `<p>이 앱은 물질의 변화를 원자와 전자로 보여 줘요. 첫 장에서는 물 분자 하나로 화면에 나오는 표시를 하나씩 익혀요.</p>
<ul class="legend">
<li><b>동그라미</b> 원자. 색은 분자 모형에서 널리 쓰는 색이에요(H 흰색, O 빨강, N 파랑, C 회색, Cl 초록)</li>
<li><b>선</b> 공유 결합. 두 원자가 전자 두 개를 함께 써요</li>
<li><b>점 두 개</b> 비공유 전자쌍. 결합에 쓰이지 않는 전자 두 개예요</li>
</ul>
<p>아래 <b>▶ 재생</b>을 누르거나 오른쪽 대본의 줄을 누르면 그 단계가 재생돼요.</p>`,
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
    tryIt: `<p><b>고쳐 보기</b>를 누르고 <code>H2O</code>를 <code>NH3</code>로, 대본의 <code>w.O</code>를 모두 <code>w.N</code>으로 바꾼 뒤 <b>적용</b>을 눌러 보세요. 질소에는 결합이 셋, 비공유 전자쌍이 하나 있어요. 전자를 세면 역시 8개예요.</p>`,
  },
  {
    id: 'arrows',
    part: 0,
    title: '굽은 화살표와 전하',
    intro: `<p>화학 반응에서 움직이는 것은 전자예요. <b>굽은 화살표</b>는 전자쌍 하나가 어디서 어디로 가는지 나타내요. 화살표의 꼬리는 전자쌍이 있던 곳(비공유 전자쌍이나 결합)이고, 머리는 전자쌍이 가는 곳(원자나 새 결합)이에요.</p>
<p>이 장에서는 암모니아(NH₃)의 비공유 전자쌍이 수소 이온(H⁺)과 새 결합을 만들어 암모늄 이온(NH₄⁺)이 되는 모습을 봐요. 화살표가 나타난 뒤 분홍 점 두 개가 화살표를 따라 이동하는데, 그 두 점이 옮겨 가는 전자쌍이에요.</p>
<ul class="legend">
<li><b>⊕ ⊖ 표시</b> 그 원자의 형식 전하. 원자가 원래 가진 전자보다 적게 가지면 +, 많이 가지면 −예요</li>
<li><b>주황 테두리</b> 이번 단계에서 움직이는 원자</li>
</ul>`,
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
    tryIt: `<p><code>NH3</code>를 <code>H2O</code>로, 대본의 <code>n.N</code>을 모두 <code>n.O</code>로 바꿔 보세요. 물이 H⁺와 결합해 하이드로늄 이온(H₃O⁺)이 되는 같은 종류의 반응이에요.</p>`,
  },
  {
    id: 'forces',
    part: 0,
    title: '분자 사이 인력과 온도',
    intro: `<p>분자 안의 결합(실선) 말고도 분자와 분자 사이에는 약한 인력이 작용해요. 물 분자에서 O는 전자를 더 세게 당겨 조금 −(δ−)를, H는 조금 +(δ+)를 띠어요. 그래서 한 분자의 H와 이웃 분자의 O가 서로 당기는데, 이것이 <b>수소 결합</b>이에요. 이 앱은 분자 사이 인력을 <b>파란 점선</b>으로 그려요.</p>
<p><b>온도</b>는 입자가 얼마나 빠르게 움직이는지예요. 물을 가열하면 분자들이 더 크게, 더 빨리 흔들려요. 배경의 물 분자는 흐리게 그려요.</p>`,
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
    tryIt: `<p>아래 <b>보기</b>의 <b>분자 사이 인력</b>을 끄고 켜 보세요. 대본에서는 <code>lens attract on</code> 한 줄이 이 표시를 처음부터 켜 둬요.</p>`,
  },

  // ------------------------------------------------------------------ part 1
  {
    id: 'diffusion',
    part: 1,
    title: '확산',
    intro: `<p>입자는 늘 이리저리 무작위로 움직여요. 한쪽에 몰려 있던 입자들도 이렇게 움직이다 보면 결국 고르게 퍼지는데, 이것이 <b>확산</b>이에요. 어느 입자도 퍼지려고 움직이지 않아요. 무작위로 움직인 결과가 퍼짐으로 나타날 뿐이에요.</p>
<ul class="legend"><li><b>회색 점선</b> 입자 하나가 지나간 경로</li></ul>`,
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
    tryIt: `<p><code>spread Na+ Cl- in water</code>를 <code>spread Na+ Cl- in right</code>로 바꾸면 오른쪽으로만 퍼져요. 실제 확산이라면 이렇게 한쪽으로만 가지는 않아요. 대본은 그리라는 대로 그리니, 화학이 맞는지는 대본을 쓰는 쪽이 책임져요.</p>`,
  },
  {
    id: 'evaporation',
    part: 1,
    title: '증발과 응결',
    intro: `<p>액체 속 물 분자들은 수소 결합으로 서로 당기고 있어요. 수면 가까이 있던 분자가 충분히 빨리 움직이면 이웃과의 인력을 벗어나 공기로 나가요. 이것이 <b>증발</b>이에요. 반대로 공기 중의 물 분자가 수면 아래로 내려와 다시 액체에 섞이면 <b>응결</b>이에요.</p>
<p>증발하는 분자를 보면 파란 점선(인력)이 늘어나다가 사라져요. 그 분자가 이웃과의 인력을 벗어나는 순간이에요.</p>`,
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
    tryIt: `<p><code>heat water</code>를 <code>cool water</code>로 바꿔 보세요. 화면에서는 여전히 증발이 일어나지만, 실제로는 차가운 물일수록 증발하는 분자가 드물어요. 대본을 쓰는 쪽이 이런 조건을 맞춰야 해요.</p>`,
  },
  {
    id: 'dissolving',
    part: 1,
    title: '용해',
    intro: `<p>소금(NaCl) 결정은 Na⁺와 Cl⁻가 번갈아 줄지어 있는 고체예요. 물 분자는 O 쪽이 조금 −, H 쪽이 조금 +라서, Na⁺ 쪽으로는 O를, Cl⁻ 쪽으로는 H를 향해 모여요. 물 분자 여럿에 둘러싸인 이온은 결정에서 떨어져 나와 물속으로 퍼지는데, 이것이 <b>용해</b>예요.</p>
<p>이온을 둘러싼 물 분자 무리를 <b>수화 껍질</b>이라고 해요. 수화 껍질은 이온과 함께 움직여요.</p>`,
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
    tryIt: `<p><code>crystal s = NaCl</code>을 <code>crystal s = KBr</code>로 바꿔 보세요. 칼륨 이온(K⁺)과 브로민화 이온(Br⁻)은 더 크게 그려져요.</p>`,
  },
  {
    id: 'exchange',
    part: 1,
    title: '흡착과 이온 교환',
    intro: `<p>흙 속 점토 알갱이(갈색 판)는 표면에 음전하를 띤 부위(− 표시)가 많아요. 그래서 Ca²⁺, K⁺ 같은 양이온이 점토 표면에 <b>흡착</b>해 있어요. 빗물에 섞인 H⁺가 오면 H⁺가 그 음전하 부위를 차지하고, 원래 있던 양이온은 표면에서 떨어져 물속으로 나와요. 이것이 <b>이온 교환</b>이에요.</p>
<p>전하는 늘 맞아야 해요. Ca²⁺(+2) 하나가 떠난 부위에는 H⁺(+1) 두 개가 들어가요. 앱은 이 전하가 맞는지 검사해요.</p>`,
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
    tryIt: `<p><code>exchange c with 2 H+ on clay</code>의 <code>2</code>를 <code>1</code>로 바꾸고 적용해 보세요. 전하가 맞지 않는다는 오류가 떠요. 오류 문장을 AI에게 그대로 주면 AI가 대본을 고칠 수 있어요.</p>`,
  },
  {
    id: 'leaching',
    part: 1,
    title: '씻겨 내려감(용탈)',
    intro: `<p>점토에서 떨어져 나와 물에 녹은 이온은 더 이상 점토 표면에 머물지 않아요. 비가 오면 공극을 따라 아래로 흐르는 물과 함께 속흙이나 지하수까지 내려가요. 이것이 <b>용탈</b>, 흔히 말하는 '씻겨 내려감'이에요.</p>
<p>대본에서는 <code>leach</code> 한 줄이 이 과정 전체를 맡아요. 앱은 그 한 줄을 기본 동작 여러 개로 펼쳐 그려요. 빗물이 공극으로 스며들고, 물 분자들이 이온을 둘러싸고(수화), 이온이 그 물과 함께 아래로 이동해요.</p>`,
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
    tryIt: `<p><code>to subsoil</code>을 <code>to groundwater</code>로 바꾸면 지하수까지 내려가요. <code>leach c from topsoil to air</code>처럼 위쪽을 적으면 방향이 틀렸다는 오류가 떠요.</p>`,
  },

  // ------------------------------------------------------------------ part 2
  {
    id: 'acid-hcl',
    part: 2,
    title: '산·염기: 양성자 이동',
    intro: `<p>산·염기 반응에서 움직이는 것은 <b>양성자</b>(H⁺, 전자가 없는 수소 원자핵)예요. 산은 H⁺를 내주는 물질, 염기는 비공유 전자쌍으로 H⁺와 새 결합을 만드는 물질이에요.</p>
<p>염화수소(HCl)가 물에 녹으면 물 분자의 O가 비공유 전자쌍으로 HCl의 H와 새 결합을 만들고, 동시에 H–Cl 결합의 전자쌍은 Cl 쪽으로 옮겨 가요. 화살표 두 개가 한꺼번에 움직이는 장면이에요. 대본의 <code>transfer a.H to w.O</code> 한 줄이 이 두 화살표를 만들어요.</p>`,
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
    tryIt: `<p><code>transfer a.H to w.O</code> 줄을 아래 두 줄로 바꿔도 같은 장면이 나와요.</p>
<pre><code>arrow w.O:lp -> w.O~a.H
arrow a.H~a.Cl -> a.Cl</code></pre>
<p>여기서 둘째 줄을 지우고 적용하면 'H 주위 전자가 4개'라는 오류가 떠요. 수소는 전자를 2개까지만 가질 수 있어서, H–Cl 결합의 전자쌍이 반드시 떠나야 해요.</p>`,
  },
  {
    id: 'base-nh3',
    part: 2,
    title: '산·염기: 물이 산이 될 때',
    intro: `<p>물은 상대에 따라 산도 되고 염기도 돼요. 앞 장에서는 HCl이 내준 H⁺를 물이 가져갔지만, 암모니아(NH₃)처럼 H⁺와 결합하려는 힘이 더 센 염기 옆에서는 물이 H⁺를 내주는 산이 돼요. 그 결과 암모늄 이온(NH₄⁺)과 수산화 이온(OH⁻)이 생겨요.</p>`,
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
    tryIt: `<p>마지막 단계에 <code>solvate all</code>을 한 줄 더해 보세요. 두 이온이 각각 물 분자에 둘러싸여요. OH⁻ 쪽에는 물 분자의 H가, NH₄⁺ 쪽에는 물 분자의 O가 향해요.</p>`,
  },
];
