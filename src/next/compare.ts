/**
 * The same reaction drawn two ways, side by side and in step. Right: what has just been changed
 * and is under review. Left: the state just before that change (older ways are in the menu).
 */
import '../render/stage.css';
import './compare.css';
import { CHAPTERS } from '../tutorial/chapters';
import { icon } from '../ui/icons';
import { Stage } from './stage';

const ACID = `scene "염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol w = H2O at 330,310
mol a = HCl at 640,310

step "물 분자가 HCl에 다가가요. 이때 O의 비공유 전자쌍은 HCl의 H 쪽을 향해 있어요"
  approach w.O a.H
step "O의 전자쌍이 H와 결합하고, H와 Cl을 잇던 전자쌍은 Cl에 남아요"
  transfer a.H to w.O
step "이렇게 해서 하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생기고, 둘레의 물 분자가 두 이온을 둘러싸요"
  solvate all
`;
// Solids. An ionic solid from its first pair of ions on, and a piece of metal that gives electrons to ions.
const SOLID = `scene "염화 은 고체가 생길 때"
stage solution
crowd H2O in water 28
mol a1 = Ag+ at 300,220
mol b1 = Cl- at 470,250
mol a2 = Ag+ at 690,200
mol b2 = Cl- at 640,400
mol a3 = Ag+ at 280,420
mol b3 = Cl- at 420,430

step "물속에 은 이온(Ag+)과 염화 이온(Cl-)이 세 개씩 녹아 있어요"
  solvate all
step "은 이온 하나와 염화 이온 하나가 물 분자를 떨치고 만나 고체가 돼요"
  precipitate using a1 b1 as s
step "다음 한 쌍은 이미 있는 고체에 붙어요"
  precipitate using a2 b2 onto s
step "마지막 한 쌍도 같은 고체에 붙어서 고체가 커져요"
  precipitate using a3 b3 onto s
`;
const METAL = `scene "아연 조각과 은 이온"
stage solution
crowd H2O in water 26
metal m = Zn at 420,330 3x2
mol a1 = Ag+ at 640,200
mol a2 = Ag+ at 700,330

step "아연 조각이 은 이온(Ag+)이 녹아 있는 물에 들어 있어요. 금속의 바깥 전자는 조각 전체에 퍼져 있어요"
  note m "아연 조각"
  solvate a1
  solvate a2
step "은 이온 둘이 아연 조각의 표면에 닿아요"
  land a1 a2 on m3
step "조각의 전자가 하나씩 은 이온으로 건너가요. 전자를 받은 은은 금속이 되어 표면에 붙어요"
  hop m4.Zn -> a1.Ag
  hop m4.Zn -> a2.Ag
  join a1 a2 to m
step "조각은 전자 둘을 잃었어요. 그만큼 아연 원자 하나가 이온(Zn2+)이 되어 물속으로 나와요"
  leave m4 from m
`;
const chapter = (id: string) => CHAPTERS.find((c) => c.id === id)!.script;
const SCENES: { id: string; name: string; src: string }[] = [
  { id: 'acid', name: '산: HCl과 물', src: ACID },
  { id: 'base', name: '염기: NH₃와 물', src: chapter('base-nh3') },
  { id: 'neutral', name: '중화', src: chapter('neutralization') },
  { id: 'subst', name: '치환', src: chapter('substitution') },
  { id: 'add', name: '첨가', src: chapter('addition') },
  { id: 'cond', name: '축합·가수분해', src: chapter('condensation') },
  { id: 'redox', name: '산화·환원', src: chapter('redox') },
  { id: 'coord', name: '배위 결합', src: chapter('coordination') },
  { id: 'cell', name: '전지', src: chapter('cell') },
  { id: 'dissolve', name: '용해', src: chapter('dissolving') },
  { id: 'equil', name: '평형', src: chapter('equilibrium') },
  { id: 'radical', name: '라디칼', src: chapter('radical') },
  { id: 'solid', name: '침전', src: SOLID },
  { id: 'metal', name: '금속 조각', src: METAL },
];

const POUCH = (hot: boolean, shared: boolean, tint = '') => {
  const c = hot ? tint || 'rgba(240,140,0,.62)' : 'rgba(70,78,96,.2)';
  const e = hot && !tint ? '#e8890c' : '#17233a';
  const w = shared ? 74 : 48;
  return `<svg width="${w}" height="30" viewBox="0 0 ${w} 30" aria-hidden="true">
    <line x1="20" y1="15" x2="${shared ? 56 : 33}" y2="15" stroke="${c}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="13" cy="15" r="11.500" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>
    ${shared ? '<circle cx="63" cy="15" r="8.500" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>' : ''}
    <circle cx="${shared ? 40 : 33}" cy="11.200" r="2.700" fill="${e}"/><circle cx="${shared ? 40 : 33}" cy="18.800" r="2.700" fill="${e}"/>
  </svg>`;
};

type Palette = 'red-positive' | 'red-negative';
const LIGHT = (pos: boolean, strong: boolean, palette: Palette) => {
  const col = pos === (palette === 'red-positive') ? '#ff4b3e' : '#2f7df6';
  const id = `k${pos ? 'p' : 'n'}${strong ? 's' : 'w'}`;
  return `<svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
    <defs><radialGradient id="${id}"><stop offset="0.25" stop-color="${col}" stop-opacity="0.95"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="23" cy="20" r="${strong ? 20 : 15}" fill="url(#${id})" opacity="${strong ? 0.85 : 0.45}"/>
    <circle cx="23" cy="20" r="9" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>
  </svg>`;
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <main class="cmp">
    <nav class="rx" aria-label="반응">${SCENES.map((s) => `<button data-scene="${s.id}" aria-pressed="false">${s.name}</button>`).join('')}</nav>
    <div class="two">
      <figure>
        <figcaption>견줄 방식 <select id="left" aria-label="왼쪽에 놓을 방식">
          <option value="prev">직전 상태</option>
          <option value="pairs">전자쌍, 원소마다 색</option>
          <option value="lines">선과 굽은 화살표</option>
        </select></figcaption>
        <div id="old"></div>
      </figure>
      <figure>
        <figcaption>검토할 방식 <small>전하가 전자를 따라 바뀜</small>
          <span class="seg" role="group" aria-label="전하 색">전하 색
            <button data-palette="red-positive" aria-pressed="true">빨강이 +</button><button data-palette="red-negative" aria-pressed="false">빨강이 −</button>
          </span></figcaption>
        <div id="new"></div>
      </figure>
    </div>
    <div class="key" aria-label="오른쪽 화면의 표시"></div>
    <p class="say" aria-live="polite"></p>
    <div class="ctl">
      <div class="left"><label class="sw"><input type="checkbox" id="slow" /> 느리게</label></div>
      <div class="mid">
        <button class="btn" data-act="prev" title="이전 단계 (←)">${icon('prev')}<span>이전</span></button>
        <button class="btn" data-act="replay" title="이 단계 다시 보기 (R)">${icon('replay')}<span>다시 보기</span></button>
        <button class="btn ink" data-act="next" title="다음 단계 (→)"><span>다음</span>${icon('next')}</button>
      </div>
      <div class="right"><span>직접 움직여 보기</span><input type="range" id="scrub" min="0" max="1000" value="0" aria-label="이 단계 안에서 시간 옮기기" /></div>
    </div>
  </main>`;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => app.querySelector(s) as T;
const oldStage = new Stage($('#old'));
const newStage = new Stage($('#new'));
const leftSel = $<HTMLSelectElement>('#left');
// Left: the state just before the change under review (the glow look as it was), or an older way.
const setLeft = (v: string) => {
  const which = v === 'lines' || v === 'pairs' ? v : 'prev';
  oldStage.style = which === 'lines' ? 'lines' : 'pairs';
  oldStage.look = which === 'prev' ? 'glow' : 'color';
  leftSel.value = which;
};
setLeft(new URLSearchParams(location.search).get('left') ?? 'prev');
// Right: under review. Cause and effect: the charge follows the electrons.
newStage.style = 'pairs';
newStage.look = 'cause';

// Which colour means which charge. The choice is kept for the next visit.
const keyBox = $('.key');
const setPalette = (v: string | null, redraw = true) => {
  const palette: Palette = v === 'red-negative' ? 'red-negative' : 'red-positive';
  newStage.palette = palette;
  oldStage.palette = palette;
  const neg = palette === 'red-positive' ? '47,125,246' : '255,75,62';
  app.querySelectorAll<HTMLElement>('[data-palette]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.palette === palette)));
  keyBox.innerHTML = `
      <b>오른쪽 화면의 표시</b>
      <span>${LIGHT(true, true, palette)}전자가 모자란 곳(+)</span>
      <span>${LIGHT(false, true, palette)}전자가 많은 곳(−)</span>
      <span>${LIGHT(true, false, palette)}${LIGHT(false, false, palette)}조금 +, 조금 −</span>
      <span>${POUCH(false, false)}한 원자가 가진 전자쌍</span>
      <span>${POUCH(false, true)}두 원자가 함께 가진 전자쌍(결합)</span>
      <span>${POUCH(true, false, `rgba(${neg},.46)`)}지금 움직이는 전자쌍</span>`;
  try {
    localStorage.setItem('chemvis.palette', palette);
  } catch {
    /* private window: the choice just is not kept */
  }
  if (redraw && newStage.tl) for (const s of both) s.still(s.player.k, s.player.t);
};
let savedPalette: string | null = null;
try {
  savedPalette = localStorage.getItem('chemvis.palette');
} catch {
  /* no storage */
}
setPalette(new URLSearchParams(location.search).get('palette') ?? savedPalette, false);
const both = [oldStage, newStage];
const say = $('.say');
const scrub = $<HTMLInputElement>('#scrub');
const slow = $<HTMLInputElement>('#slow');
const prevBtn = $<HTMLButtonElement>('[data-act="prev"]');
const nextBtn = $<HTMLButtonElement>('[data-act="next"]');
let scrubbing = false;

function paint(): void {
  const p = newStage.player;
  const step = newStage.tl?.steps[p.k];
  say.textContent = step?.text ?? '';
  prevBtn.disabled = p.onFirst;
  nextBtn.querySelector('span')!.textContent = p.onLast ? '처음부터' : '다음';
}
newStage.player.onChange = paint;
newStage.onFrame = () => {
  if (!scrubbing) scrub.value = String(Math.round(newStage.player.t * 1000));
};

function load(id: string): void {
  const sc = SCENES.find((s) => s.id === id) ?? SCENES[0];
  for (const s of both) s.load(sc.src);
  // Start where something first happens between the molecules: one comes to the other, or electrons move.
  const k = Math.max(0, newStage.tl!.steps.findIndex((s) => s.arrows.length > 0 || !!s.shifts?.length || !!s.pulls?.length));
  for (const s of both) s.player.go(k);
  app.querySelectorAll<HTMLElement>('[data-scene]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === sc.id)));
  history.replaceState(null, '', `#${sc.id}`);
  paint();
}

const act = (name: string) => {
  for (const s of both) {
    if (name === 'prev') s.player.prev();
    else if (name === 'replay') s.player.replay();
    else s.player.next();
  }
};
app.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene], [data-act], [data-palette]');
  if (!b) return;
  if (b.dataset.palette) setPalette(b.dataset.palette);
  else if (b.dataset.scene) load(b.dataset.scene);
  else act(b.dataset.act!);
  if ((e as MouseEvent).detail > 0) b.blur();
});
scrub.addEventListener('input', () => {
  scrubbing = true;
  for (const s of both) s.player.seek(s.player.k, +scrub.value / 1000);
});
scrub.addEventListener('change', () => (scrubbing = false));
leftSel.addEventListener('change', () => {
  // The way of drawing decides how the motion is laid out, so the scene is compiled again.
  const k = newStage.player.k;
  setLeft(leftSel.value);
  load(location.hash.slice(1));
  for (const s of both) s.player.go(k);
});
slow.addEventListener('change', () => {
  for (const s of both) s.speed = slow.checked ? 0.35 : 1;
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    act('next');
  } else if (e.key === 'ArrowLeft') act('prev');
  else if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') act('replay');
});

// For checks from outside: draw one moment of one scene in both.
(window as unknown as { cmp: unknown }).cmp = {
  load,
  seek: (k: number, t: number) => both.forEach((s) => s.still(k, t)),
  steps: () => newStage.tl?.steps.length ?? 0,
  // Any script, not only the scenes on the buttons.
  script: (src: string) => both.forEach((s) => s.load(src)),
};

load(location.hash.slice(1));
