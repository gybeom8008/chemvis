import './style.css';
import { compile } from './engine/compile';
import type { Timeline } from './engine/timeline';
import type { Lens } from './engine/world';
import { StageView } from './render/view';
import { decodeHash, encodeScript } from './share';
import { CHAPTERS, PARTS, type Chapter } from './tutorial/chapters';
import { Player } from './ui/player';
import type { Diag } from './dsl/parser';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const motion = !params.has('still') && !reducedMotion;

const svg = document.getElementById('stage') as unknown as SVGSVGElement;
const view = new StageView(svg);
const player = new Player();
const lens: Lens = { charge: true, attract: false, numbers: false };

const DEFAULT_SCRIPT = `scene "직접 써 보기: 염화수소가 물에 녹을 때"
stage solution
crowd H2O in water 30
mol a = HCl at left
mol w = H2O at center

step "물 분자의 O가 비공유 전자쌍을 앞세워 HCl의 H에 다가간다"
  approach w.O a.H
step "전자쌍 두 개가 한꺼번에 옮겨 간다"
  transfer a.H to w.O
step "H3O+와 Cl-를 물 분자들이 둘러싼다"
  solvate all
`;

interface State {
  mode: 'tutorial' | 'edit';
  chapter: Chapter | null;
  src: string;
  tl: Timeline | null;
  diags: Diag[];
  editing: boolean;
}

const state: State = { mode: 'tutorial', chapter: null, src: '', tl: null, diags: [], editing: false };

// ------------------------------------------------------------------ loading

function load(src: string): boolean {
  const res = compile(src);
  state.src = src;
  state.diags = [...res.errors.map((d) => ({ ...d, kind: 'error' })), ...res.warnings.map((d) => ({ ...d, kind: 'warn' }))] as Diag[];
  renderDiags(res.errors, res.warnings);
  if (!res.timeline) return false;
  state.tl = res.timeline;
  view.setTimeline(res.timeline);
  Object.assign(lens, res.timeline.initial.lens);
  syncLensInputs();
  player.load(res.timeline);
  renderScriptView();
  renderChips();
  document.title = `${res.timeline.title} · chemvis`;
  return true;
}

function renderDiags(errors: Diag[], warnings: Diag[]): void {
  const ul = $('diags');
  ul.innerHTML = '';
  const add = (d: Diag, kind: 'error' | 'warn') => {
    const li = document.createElement('li');
    li.className = kind;
    li.innerHTML = `<b>${d.line}번 줄</b> ${escapeHtml(d.message)}`;
    li.addEventListener('click', () => focusLine(d.line));
    ul.appendChild(li);
  };
  errors.forEach((d) => add(d, 'error'));
  warnings.forEach((d) => add(d, 'warn'));
  if (errors.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = '이 오류 문장을 그대로 복사해 AI에게 주면 AI가 대본을 고칠 수 있어요.';
    ul.appendChild(li);
  }
}

function focusLine(line: number): void {
  const ta = $<HTMLTextAreaElement>('script-edit');
  if (ta.hidden) setEditing(true);
  const lines = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  ta.focus();
  ta.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ------------------------------------------------------------------ script panel

function renderScriptView(): void {
  const box = $('script-view');
  const lines = state.src.split('\n');
  const stepOfLine = new Map<number, number>();
  state.tl?.steps.forEach((s, i) => {
    for (let l = s.line; l <= s.endLine; l++) stepOfLine.set(l, i);
  });
  box.innerHTML = lines
    .map((txt, i) => {
      const ln = i + 1;
      const st = stepOfLine.get(ln);
      const cls = ['ln', st !== undefined ? 'in-step' : '', /^\s*step\b/.test(txt) ? 'step-head' : '']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}" data-line="${ln}"${st !== undefined ? ` data-step="${st}"` : ''}><span class="no">${ln}</span><code>${highlight(txt)}</code></div>`;
    })
    .join('');
  box.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
    el.addEventListener('click', () => player.seek(parseInt(el.dataset.step!, 10), 0, true));
  });
}

function highlight(line: string): string {
  if (!line.trim()) return '&nbsp;';
  const m = line.match(/^(\s*)(\S+)(.*)$/);
  if (!m) return escapeHtml(line);
  let rest = escapeHtml(m[3]);
  rest = rest.replace(/("[^"]*")/g, '<span class="str">$1</span>').replace(/(#.*)$/, '<span class="cmt">$1</span>');
  return `${m[1]}<span class="kw">${escapeHtml(m[2])}</span>${rest}`;
}

function renderChips(): void {
  const box = $('chips');
  box.innerHTML = '';
  state.tl?.steps.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = String(i + 1);
    b.title = s.text;
    b.addEventListener('click', () => player.seek(i, 0, true));
    box.appendChild(b);
  });
}

function setEditing(on: boolean): void {
  state.editing = on;
  const ta = $<HTMLTextAreaElement>('script-edit');
  ta.hidden = !on;
  $('script-view').hidden = on;
  $('btn-apply').hidden = !on;
  $('btn-edit').textContent = on ? '보기로 돌아가기' : '고쳐 보기';
  if (on) ta.value = state.src;
}

// ------------------------------------------------------------------ UI updates

function updateUI(): void {
  const tl = state.tl;
  const n = player.n;
  const step = tl?.steps[player.k];
  const narr = $('narration');
  if (!tl) narr.innerHTML = '';
  else if (!n) narr.innerHTML = `<span class="title">${escapeHtml(tl.title)}</span>`;
  else {
    narr.innerHTML =
      `<span class="count">단계 ${player.k + 1} / ${n}</span>` +
      `<span class="text">${escapeHtml(step!.text)}</span>`;
  }
  const play = $('btn-play');
  play.textContent = player.playing ? '⏸ 멈춤' : player.t >= 1 && player.k >= n - 1 ? '↺ 다시' : '▶ 재생';
  play.setAttribute('aria-label', player.playing ? '멈춤' : '재생');
  $<HTMLInputElement>('scrub').value = String(Math.round(player.t * 1000));
  document.querySelectorAll<HTMLElement>('#chips .chip').forEach((c, i) => {
    c.classList.toggle('on', i === player.k);
    c.classList.toggle('done', i < player.k || (i === player.k && player.t >= 1));
  });
  document.querySelectorAll<HTMLElement>('#script-view .ln').forEach((el) => {
    el.classList.toggle('current', el.dataset.step === String(player.k));
  });
}

player.onChange = updateUI;
player.onStepEnter = (k) => {
  const step = state.tl?.steps[k];
  if (step?.lens) {
    Object.assign(lens, step.lens);
    syncLensInputs();
  }
  const cur = document.querySelector<HTMLElement>(`#script-view [data-step="${k}"]`);
  cur?.scrollIntoView({ block: 'nearest' });
};

function syncLensInputs(): void {
  $<HTMLInputElement>('lens-charge').checked = lens.charge;
  $<HTMLInputElement>('lens-attract').checked = lens.attract;
  $<HTMLInputElement>('lens-numbers').checked = lens.numbers;
}

// ------------------------------------------------------------------ tutorial

function renderChapters(): void {
  const box = $('chapters');
  let html = '';
  for (const part of PARTS) {
    html += `<div class="part"><h3>${escapeHtml(part.title)}</h3><ol>`;
    for (const c of CHAPTERS.filter((x) => x.part === part.id)) {
      html += `<li><a href="#/t/${c.id}" data-ch="${c.id}">${escapeHtml(c.title)}</a></li>`;
    }
    html += '</ol></div>';
  }
  box.innerHTML = html;
}

function showChapter(c: Chapter): void {
  state.mode = 'tutorial';
  state.chapter = c;
  document.body.dataset.mode = 'tutorial';
  setEditing(false);
  $('intro').innerHTML = `<h1>${escapeHtml(c.title)}</h1>${c.intro}`;
  $('tryit').innerHTML = c.tryIt ? `<h3>바꿔 보기</h3>${c.tryIt}` : '';
  document.querySelectorAll<HTMLElement>('#chapters a').forEach((a) => a.classList.toggle('on', a.dataset.ch === c.id));
  const idx = CHAPTERS.indexOf(c);
  const prev = CHAPTERS[idx - 1];
  const next = CHAPTERS[idx + 1];
  $('intro').innerHTML +=
    `<nav class="chapter-nav">` +
    (prev ? `<a href="#/t/${prev.id}">← ${escapeHtml(prev.title)}</a>` : '<span></span>') +
    (next ? `<a href="#/t/${next.id}">${escapeHtml(next.title)} →</a>` : '<span></span>') +
    `</nav>`;
  load(c.script);
  window.scrollTo({ top: 0 });
}

function showEditor(src: string): void {
  state.mode = 'edit';
  state.chapter = null;
  document.body.dataset.mode = 'edit';
  $('intro').innerHTML =
    '<h1>직접 쓰기</h1><p>오른쪽 대본을 고치고 <b>적용</b>을 누르면 장면이 바뀌어요. 문법은 <a href="./ai-guide.txt" target="_blank" rel="noopener">AI 안내서</a>에 있어요. <b>링크 복사</b>를 누르면 이 대본이 든 주소가 복사돼요.</p>';
  $('tryit').innerHTML = '';
  document.querySelectorAll<HTMLElement>('#chapters a').forEach((a) => a.classList.remove('on'));
  if (!load(src)) {
    state.src = src;
  }
  setEditing(true);
}

async function route(): Promise<void> {
  const h = location.hash;
  document.querySelectorAll<HTMLElement>('.topnav a[data-nav]').forEach((a) => {
    const isEdit = h.startsWith('#/edit') || h.startsWith('#z=') || h.startsWith('#s=');
    a.classList.toggle('on', (a.dataset.nav === 'edit') === isEdit);
  });
  if (h.startsWith('#z=') || h.startsWith('#s=')) {
    try {
      const src = await decodeHash(h);
      showEditor(src ?? DEFAULT_SCRIPT);
    } catch {
      showEditor(DEFAULT_SCRIPT);
      renderDiags([{ line: 1, message: '링크에 든 대본을 풀지 못했어요. 링크가 중간에 잘렸는지 확인해 주세요.' }], []);
    }
    return;
  }
  if (h.startsWith('#/edit')) {
    showEditor(state.mode === 'edit' && state.src ? state.src : DEFAULT_SCRIPT);
    return;
  }
  const m = h.match(/^#\/t\/([\w-]+)/);
  const c = (m && CHAPTERS.find((x) => x.id === m[1])) || CHAPTERS[0];
  showChapter(c);
}

// ------------------------------------------------------------------ events

$('btn-play').addEventListener('click', () => player.toggle());
$('btn-next').addEventListener('click', () => player.next());
$('btn-prev').addEventListener('click', () => player.prev());
$('btn-restart').addEventListener('click', () => player.restart());
$<HTMLInputElement>('scrub').addEventListener('input', (e) => {
  player.seek(player.k, parseInt((e.target as HTMLInputElement).value, 10) / 1000, false);
});
$<HTMLSelectElement>('speed').addEventListener('change', (e) => {
  player.speed = parseFloat((e.target as HTMLSelectElement).value);
});
$<HTMLInputElement>('continuous').addEventListener('change', (e) => {
  player.continuous = (e.target as HTMLInputElement).checked;
});
for (const [id, key] of [
  ['lens-charge', 'charge'],
  ['lens-attract', 'attract'],
  ['lens-numbers', 'numbers'],
] as const) {
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    lens[key] = (e.target as HTMLInputElement).checked;
  });
}
$('btn-edit').addEventListener('click', () => setEditing(!state.editing));
$('btn-apply').addEventListener('click', () => {
  const src = $<HTMLTextAreaElement>('script-edit').value;
  if (load(src) && state.mode === 'tutorial') setEditing(true);
  state.src = src;
  player.play();
});
$('btn-link').addEventListener('click', async () => {
  const src = state.editing ? $<HTMLTextAreaElement>('script-edit').value : state.src;
  const enc = await encodeScript(src);
  const url = `${location.origin}${location.pathname}#${enc}`;
  const btn = $('btn-link');
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = '복사했어요';
  } catch {
    window.prompt('이 주소를 복사하세요', url);
  }
  setTimeout(() => (btn.textContent = '링크 복사'), 1600);
});
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
  if (e.key === ' ') {
    e.preventDefault();
    player.toggle();
  } else if (e.key === 'ArrowRight') player.next();
  else if (e.key === 'ArrowLeft') player.prev();
});
window.addEventListener('hashchange', () => void route());

// ------------------------------------------------------------------ loop

let last = performance.now();
const start = last;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  player.tick(dt);
  view.draw(player.k, player.t, { lens, clock: motion ? (now - start) / 1000 : 0, motion, dt: motion ? dt : 0 });
  requestAnimationFrame(frame);
}

renderChapters();
void route().then(() => requestAnimationFrame(frame));

// Small handle for automated tests and for checking a script from the console.
declare global {
  interface Window {
    chemvis: unknown;
  }
}
window.chemvis = {
  load,
  compile,
  seek: (k: number, t: number) => {
    player.seek(k, t, false);
    view.draw(player.k, player.t, { lens, clock: 0, motion: false });
  },
  state: () => ({ k: player.k, t: player.t, n: player.n, title: state.tl?.title, diags: state.diags }),
  chapters: CHAPTERS.map((c) => c.id),
};
