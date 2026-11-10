/**
 * The same reaction drawn two ways, side by side and in step:
 * left, lines and curved arrows; right, electron pairs as pouches that let go and take hold.
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
];

const POUCH = (hot: boolean, shared: boolean) => {
  const c = hot ? 'rgba(214,51,108,.4)' : 'rgba(47,98,184,.26)';
  const e = hot ? '#d6336c' : '#17233a';
  const w = shared ? 74 : 48;
  return `<svg width="${w}" height="30" viewBox="0 0 ${w} 30" aria-hidden="true">
    <line x1="20" y1="15" x2="${shared ? 56 : 33}" y2="15" stroke="${c}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="13" cy="15" r="11.500" fill="#e03131" stroke="rgba(0,0,0,.3)"/>
    ${shared ? '<circle cx="63" cy="15" r="8.500" fill="#f4f4f4" stroke="rgba(0,0,0,.3)"/>' : ''}
    <circle cx="${shared ? 40 : 33}" cy="11.200" r="2.700" fill="${e}"/><circle cx="${shared ? 40 : 33}" cy="18.800" r="2.700" fill="${e}"/>
  </svg>`;
};

const PULL = `<svg width="62" height="30" viewBox="0 0 62 30" aria-hidden="true">
  <text x="8" y="20" font-size="15" font-weight="800" fill="#d9480f" text-anchor="middle">+</text>
  <line x1="18" y1="15" x2="44" y2="15" stroke="#3b82c4" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>
  <text x="54" y="20" font-size="15" font-weight="800" fill="#1c7ed6" text-anchor="middle">−</text>
</svg>`;

const app = document.getElementById('app')!;
app.innerHTML = `
  <main class="cmp">
    <nav class="rx" aria-label="반응">${SCENES.map((s) => `<button data-scene="${s.id}" aria-pressed="false">${s.name}</button>`).join('')}</nav>
    <div class="two">
      <figure>
        <figcaption>지금 방식 <small>결합은 선, 전자의 이동은 굽은 화살표</small></figcaption>
        <div id="old"></div>
      </figure>
      <figure>
        <figcaption>새 방식 <small>전자쌍이 보이고, 그 전자쌍이 직접 움직임</small></figcaption>
        <div id="new"></div>
      </figure>
    </div>
    <div class="key" aria-label="새 방식의 표시">
      <b>새 방식의 표시</b>
      <span>${POUCH(false, false)}한 원자가 가진 전자쌍</span>
      <span>${POUCH(false, true)}두 원자가 함께 가진 전자쌍(결합)</span>
      <span>${POUCH(true, false)}지금 바뀌는 전자쌍</span>
      <span>${PULL}서로 당기는 곳(조금 +, 조금 −)</span>
    </div>
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
oldStage.style = 'lines';
newStage.style = 'pairs';
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
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene], [data-act]');
  if (!b) return;
  if (b.dataset.scene) load(b.dataset.scene);
  else act(b.dataset.act!);
  if ((e as MouseEvent).detail > 0) b.blur();
});
scrub.addEventListener('input', () => {
  scrubbing = true;
  for (const s of both) s.player.seek(s.player.k, +scrub.value / 1000);
});
scrub.addEventListener('change', () => (scrubbing = false));
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
};

load(location.hash.slice(1));
