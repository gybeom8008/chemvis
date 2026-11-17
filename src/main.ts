import './style.css';
import './render/stage.css';
import { compile } from './engine/compile';
import type { Diag } from './dsl/parser';
import type { Timeline } from './engine/timeline';
import { decodeHash, encodeScript } from './share';
import { CHAPTERS, PARTS, type Chapter } from './tutorial/chapters';
import { EXAMPLES } from './tutorial/examples';
import { icon } from './ui/icons';
import { Viewer, type Settings } from './ui/viewer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A choice kept for the next visit (nothing is kept in a private window). */
const kept = (key: string): string | null => {
  try {
    return localStorage.getItem(`chemvis.${key}`);
  } catch {
    return null;
  }
};
const keep = (key: string, value: string): void => {
  try {
    localStorage.setItem(`chemvis.${key}`, value);
  } catch {
    /* not kept */
  }
};

const settings: Settings = {
  lens: { charge: true, attract: false, numbers: false, oxidation: false, arrows: false },
  speed: 1,
  continuous: false,
  motion: !params.has('still') && !reducedMotion,
  // Electron pairs (docs/plan/depiction.md 2.9) unless the old drawing is asked for.
  style: params.get('style') === 'lines' ? 'lines' : 'pairs',
  palette: (params.get('palette') ?? kept('palette')) === 'red-negative' ? 'red-negative' : 'red-positive',
  heat: (params.get('heat') ?? kept('heat')) !== 'off',
};

// (The page's own pictures, such as the small legends in the lessons, follow the drawing.)
document.body.dataset.style = settings.style ?? 'pairs';
document.body.dataset.palette = settings.palette ?? 'red-positive';

const PLACEHOLDER = `scene "제목"
stage solution
mol w = H2O at center
step "설명 문장"
  note w.O:lp "비공유 전자쌍"`;

// ------------------------------------------------------------------ icons

const icons: [string, string][] = [
  ['btn-examples', 'examples'],
  ['btn-script', 'code'],
  ['btn-view', 'sliders'],
  ['btn-link', 'link'],
  ['btn-edit', 'edit'],
  ['btn-drawer-close', 'close'],
  ['tut-view', 'sliders'],
  ['tut-script', 'code'],
  ['tut-open', 'openIn'],
  ['tut-close', 'close'],
  ['tut-menu', 'menu'],
];
for (const [id, name] of icons) $(id).innerHTML = icon(name);

// ------------------------------------------------------------------ viewers

const main = new Viewer($('main-viewer'), settings);
const tut = new Viewer($('tut-viewer'), settings);
tut.endAction = () => (CHAPTERS[CHAPTERS.indexOf(chapter) + 1] ? 'nextChapter' : 'restart');

// ------------------------------------------------------------------ code panels

/** Script with line numbers; lines of each step are clickable and the current step is marked. */
function renderCode(box: HTMLElement, src: string, tl: Timeline | null, onStep: (k: number) => void): void {
  const stepOf = new Map<number, number>();
  tl?.steps.forEach((s, i) => {
    for (let l = s.line; l <= s.endLine; l++) stepOf.set(l, i);
  });
  box.innerHTML = src
    .split('\n')
    .map((txt, i) => {
      const st = stepOf.get(i + 1);
      const head = /^\s*step\b/.test(txt) ? ' head' : '';
      const data = st !== undefined ? ` data-step="${st}"` : '';
      return `<div class="ln${head}"${data}><span class="no">${i + 1}</span><code>${highlight(txt)}</code></div>`;
    })
    .join('');
  box.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => el.addEventListener('click', () => onStep(+el.dataset.step!)));
}

function markStep(box: HTMLElement, k: number): void {
  let first: HTMLElement | null = null;
  box.querySelectorAll<HTMLElement>('.ln').forEach((el) => {
    const on = el.dataset.step === String(k);
    el.classList.toggle('cur', on);
    if (on && !first) first = el;
  });
  (first as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
}

function highlight(line: string): string {
  if (!line.trim()) return '&nbsp;';
  const m = line.match(/^(\s*)(\S+)(.*)$/);
  if (!m) return esc(line);
  const rest = esc(m[3])
    .replace(/"([^"]*)"/g, '<span class="s">"$1"</span>')
    .replace(/(#.*)$/, '<span class="c">$1</span>');
  return `${m[1]}<span class="k">${esc(m[2])}</span>${rest}`;
}

// ------------------------------------------------------------------ workspace (main)

const drawer = $('drawer');
const codeView = $('code-view');
const codeEdit = $<HTMLTextAreaElement>('code-edit');
let editing = false;

main.onLoad = (tl) => {
  $('scene-title').textContent = tl ? tl.title : '';
  document.title = tl ? `${tl.title} · chemvis` : 'chemvis';
  renderCode(codeView, main.src, tl, (k) => main.player.go(k));
  syncSettings();
};
main.onStep = (k) => markStep(codeView, k);

function setDrawer(open: boolean): void {
  drawer.hidden = !open;
  document.body.classList.toggle('drawer-open', open);
  $('btn-script').setAttribute('aria-pressed', String(open));
  if (open && !main.tl) setEditing(true);
}

function setEditing(on: boolean): void {
  editing = on;
  codeEdit.hidden = !on;
  codeView.hidden = on;
  $('btn-edit').innerHTML = icon(on ? 'check' : 'edit');
  const label = on ? '적용 (Ctrl+Enter)' : '고치기';
  $('btn-edit').setAttribute('aria-label', label);
  $('btn-edit').title = label;
  if (on) {
    codeEdit.value = main.src;
    codeEdit.placeholder = PLACEHOLDER;
    codeEdit.focus();
  }
}

function showDiags(errors: Diag[], warnings: Diag[]): void {
  const ul = $('diags');
  ul.innerHTML = '';
  const add = (d: Diag, kind: string) => {
    const li = document.createElement('li');
    li.className = kind;
    li.innerHTML = `<b>${d.line}</b>${esc(d.message)}`;
    li.addEventListener('click', () => focusLine(d.line));
    ul.appendChild(li);
  };
  errors.forEach((d) => add(d, 'err'));
  warnings.forEach((d) => add(d, 'warn'));
}

function focusLine(line: number): void {
  if (!editing) setEditing(true);
  const lines = codeEdit.value.split('\n');
  let pos = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  codeEdit.focus();
  codeEdit.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}

/** Load a script into the workspace. Returns false if it had errors. */
function loadMain(src: string, play = false): boolean {
  const res = main.load(src);
  if (!res.timeline) main.src = src;
  showDiags(res.errors, res.warnings);
  if (res.errors.length) {
    setDrawer(true);
    setEditing(true);
    codeEdit.value = src;
    return false;
  }
  if (play) main.player.go(0);
  return true;
}

function applyEdit(): void {
  if (!loadMain(codeEdit.value, true)) return;
  setEditing(false);
  // An edited example is no longer the example the address names.
  if (location.hash.startsWith('#/x/')) history.replaceState(null, '', location.pathname + location.search);
}

$('btn-script').addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open')));
$('btn-drawer-close').addEventListener('click', () => setDrawer(false));
$('btn-edit').addEventListener('click', () => (editing ? applyEdit() : setEditing(true)));
codeEdit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    applyEdit();
  }
});

$('btn-link').addEventListener('click', async () => {
  const src = editing ? codeEdit.value : main.src;
  if (!src.trim()) return toast('대본이 비어 있어요');
  const url = `${location.origin}${location.pathname}#${await encodeScript(src)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했어요');
  } catch {
    window.prompt('링크', url);
  }
});

let toastTimer = 0;
function toast(msg: string): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 1600);
}

// ------------------------------------------------------------------ settings popovers

function buildSettings(pop: HTMLElement): void {
  pop.innerHTML = `
    <label class="sw"><input type="checkbox" data-lens="charge"><span>전하</span></label>
    <label class="sw"><input type="checkbox" data-lens="attract"><span>분자 사이 인력</span></label>
    <label class="sw"><input type="checkbox" data-lens="oxidation"><span>산화수</span></label>
    <label class="sw"><input type="checkbox" data-lens="numbers"><span>원자 일련번호</span></label>
    <label class="sw" title="반응하는 순간 열이 나오면 하얗게 번쩍이고 고리가 퍼져요. 열을 흡수하면 파랗게 되고 고리가 줄어들어요"><input type="checkbox" data-heat><span>반응열 효과</span></label>
    <hr>
    <p class="pop-label">전하 색</p>
    <div class="speed" role="radiogroup" aria-label="전하 색">
      <button data-palette="red-positive" role="radio">빨강이 +</button><button data-palette="red-negative" role="radio">빨강이 −</button>
    </div>
    <hr>
    <p class="pop-label">속도</p>
    <div class="speed" role="radiogroup" aria-label="속도">
      ${[0.5, 1, 1.5, 2].map((v) => `<button data-speed="${v}" role="radio">${v}×</button>`).join('')}
    </div>
    <label class="sw" title="단계가 끝나면 자막을 읽을 시간을 두고 다음 단계로 가요"><input type="checkbox" data-cont><span>이어서 재생</span></label>`;
  pop.querySelectorAll<HTMLInputElement>('[data-lens]').forEach((inp) =>
    inp.addEventListener('change', () => {
      settings.lens[inp.dataset.lens as 'charge'] = inp.checked;
      syncSettings();
    }),
  );
  pop.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
    b.addEventListener('click', () => {
      settings.speed = +b.dataset.speed!;
      syncSettings();
    }),
  );
  pop.querySelector<HTMLInputElement>('[data-heat]')!.addEventListener('change', (e) => {
    settings.heat = (e.target as HTMLInputElement).checked;
    keep('heat', settings.heat ? 'on' : 'off');
    syncSettings();
  });
  pop.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach((b) =>
    b.addEventListener('click', () => {
      settings.palette = b.dataset.palette === 'red-negative' ? 'red-negative' : 'red-positive';
      keep('palette', settings.palette);
      document.body.dataset.palette = settings.palette;
      syncSettings();
      main.redraw();
      tut.redraw();
    }),
  );
  pop.querySelector<HTMLInputElement>('[data-cont]')!.addEventListener('change', (e) => {
    settings.continuous = (e.target as HTMLInputElement).checked;
    syncSettings();
  });
}

function syncSettings(): void {
  document.querySelectorAll<HTMLInputElement>('.popover [data-lens]').forEach((i) => (i.checked = settings.lens[i.dataset.lens as 'charge']));
  document.querySelectorAll<HTMLButtonElement>('.popover [data-speed]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.speed! === settings.speed)));
  document.querySelectorAll<HTMLInputElement>('.popover [data-cont]').forEach((i) => (i.checked = settings.continuous));
  document.querySelectorAll<HTMLInputElement>('.popover [data-heat]').forEach((i) => (i.checked = settings.heat !== false));
  document.querySelectorAll<HTMLButtonElement>('.popover [data-palette]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.palette === settings.palette)));
}

function bindPopover(btnId: string, popId: string, build: (pop: HTMLElement) => void = buildSettings): void {
  const btn = $(btnId);
  const pop = $(popId);
  build(pop);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
    syncSettings();
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });
}
bindPopover('btn-view', 'view-pop');
bindPopover('tut-view', 'tut-view-pop');

// ------------------------------------------------------------------ examples (ready-made scenes)

function buildExamples(pop: HTMLElement): void {
  pop.innerHTML =
    `<p class="pop-title">예시</p>` +
    EXAMPLES.map((e) => `<button class="ex" data-ex="${e.id}"><b>${esc(e.title)}</b><span>${esc(e.summary)}</span></button>`).join('');
  pop.querySelectorAll<HTMLButtonElement>('[data-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      pop.hidden = true;
      $('btn-examples').setAttribute('aria-expanded', 'false');
      openExample(b.dataset.ex!);
    }),
  );
}
bindPopover('btn-examples', 'examples-pop', buildExamples);

function openExample(id: string): void {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  if (location.hash !== `#/x/${id}`) history.replaceState(null, '', `#/x/${id}`);
  if (editing) setEditing(false);
  loadMain(ex.script, true);
}

// ------------------------------------------------------------------ tutorial popup

const dlg = $<HTMLDialogElement>('tutorial');
let chapter: Chapter = CHAPTERS[0];
let hashBeforeTutorial = '';

function renderNav(): void {
  // On phones the list opens over the page; this row closes it again.
  let html = `<div class="nav-top"><b>목차</b><button class="icon sm" id="tut-nav-close" type="button" aria-label="목차 닫기" title="목차 닫기">${icon('close')}</button></div>`;
  for (const part of PARTS) {
    html += `<p class="part">${esc(part.title)}</p><ol>`;
    for (const c of CHAPTERS.filter((x) => x.part === part.id)) {
      html += `<li><a href="#/t/${c.id}" data-ch="${c.id}">${esc(c.title)}</a></li>`;
    }
    html += '</ol>';
  }
  html += `<a class="guide" href="./ai-guide.txt" target="_blank" rel="noopener">${icon('doc')}<span>AI 안내서</span></a>`;
  $('tut-nav').innerHTML = html;
}

function setNav(open: boolean): void {
  dlg.classList.toggle('nav-open', open);
  $('tut-menu').setAttribute('aria-expanded', String(open));
}

function setIntro(open: boolean): void {
  dlg.classList.toggle('intro-open', open);
  $('tut-more').setAttribute('aria-expanded', String(open));
  $('tut-more').textContent = open ? '설명 접기' : '설명 더 보기';
}

function showChapter(c: Chapter, play = false): void {
  chapter = c;
  const n = CHAPTERS.indexOf(c) + 1;
  $('tut-part').innerHTML = `<span class="pt">${esc(PARTS.find((p) => p.id === c.part)?.title ?? '')}</span><span class="cnt">${n} / ${CHAPTERS.length}</span>`;
  setNav(false);
  setIntro(false);
  $('tut-title').textContent = c.title;
  $('tut-intro').innerHTML = c.intro;
  $('tut-tryit').innerHTML = c.tryIt;
  document.querySelectorAll<HTMLElement>('#tut-nav a[data-ch]').forEach((a) => a.classList.toggle('on', a.dataset.ch === c.id));
  tut.load(c.script);
  renderCode($('tut-code-view'), c.script, tut.tl, (k) => tut.player.go(k));
  syncSettings();
  if (play) tut.player.go(0);
}
tut.onStep = (k) => markStep($('tut-code-view'), k);
tut.player.onEnd = () => {
  const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
  if (!next) return false;
  history.replaceState(null, '', `#/t/${next.id}`);
  showChapter(next, true);
  return true;
};

function openTutorial(id?: string): void {
  const c = CHAPTERS.find((x) => x.id === id) ?? chapter;
  main.showLegend(false);
  if (!dlg.open) {
    hashBeforeTutorial = location.hash.startsWith('#/t/') ? '' : location.hash;
    dlg.showModal();
  }
  if (location.hash !== `#/t/${c.id}`) history.replaceState(null, '', `#/t/${c.id}`);
  showChapter(c);
  markTabs();
}

function closeTutorial(): void {
  if (dlg.open) dlg.close();
}
dlg.addEventListener('close', () => {
  tut.player.stop();
  history.replaceState(null, '', hashBeforeTutorial || location.pathname + location.search);
});
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) closeTutorial();
});

// ------------------------------------------------------------------ tabs

/**
 * Three screens: 배우기 (the lessons, for now the tutorial), 실험실 (to come), AI 장면 (the
 * workspace). The tutorial still opens over the workspace; its tab is marked while it is open.
 */
type Tab = 'learn' | 'lab' | 'ai';
let place: 'lab' | 'ai' = 'ai';
function markTabs(): void {
  const on: Tab = dlg.open ? 'learn' : place;
  document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === on)));
  document.body.dataset.tab = on;
}
function showPlace(p: 'lab' | 'ai'): void {
  place = p;
  $('lab').hidden = p !== 'lab';
  $('work').hidden = p !== 'ai';
  if (p === 'lab') {
    main.showLegend(false);
    if (location.hash !== '#/lab') history.replaceState(null, '', '#/lab');
  } else if (location.hash === '#/lab') history.replaceState(null, '', location.pathname + location.search);
  markTabs();
}
document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    const t = b.dataset.tab as Tab;
    if (t === 'learn') return openTutorial();
    closeTutorial();
    showPlace(t);
  }),
);
dlg.addEventListener('close', markTabs);
$('tut-menu').addEventListener('click', () => setNav(!dlg.classList.contains('nav-open')));
$('tut-more').addEventListener('click', () => setIntro(!dlg.classList.contains('intro-open')));
$('tut-nav').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#tut-nav-close')) setNav(false);
});
$('tut-close').addEventListener('click', closeTutorial);
$('tut-script').addEventListener('click', () => {
  const box = $('tut-code');
  box.hidden = !box.hidden;
  $('tut-script').setAttribute('aria-pressed', String(!box.hidden));
  dlg.classList.toggle('with-code', !box.hidden);
});
$('tut-open').addEventListener('click', () => {
  const src = chapter.script;
  closeTutorial();
  loadMain(src);
  setDrawer(true);
  setEditing(true);
});
$('tut-nav').addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-ch]');
  if (!a) return;
  e.preventDefault();
  openTutorial(a.dataset.ch);
});

// ------------------------------------------------------------------ routing & keys

async function route(): Promise<void> {
  const h = location.hash;
  const t = h.match(/^#\/t\/([\w-]+)/);
  if (t) return openTutorial(t[1]);
  if (h === '#/lab') return showPlace('lab');
  if (place === 'lab') showPlace('ai');
  const x = h.match(/^#\/x\/([\w-]+)/);
  if (x) return openExample(x[1]);
  if (h.startsWith('#z=') || h.startsWith('#s=')) {
    try {
      const src = await decodeHash(h);
      if (src) loadMain(src);
    } catch {
      toast('링크 속 대본을 읽지 못했어요');
    }
    return;
  }
  if (h.startsWith('#/edit')) setDrawer(true);
}
window.addEventListener('hashchange', () => void route());

document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;
  // A button reached with Tab presses itself on Space and Enter.
  if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const v = dlg.open ? tut : main;
  if (!v.tl || (!dlg.open && place !== 'ai')) return;
  const p = v.player;
  const act: Record<string, () => void> = {
    ' ': () => p.next(),
    ArrowRight: () => p.next(),
    ArrowLeft: () => p.prev(),
    r: () => p.replay(),
    R: () => p.replay(),
    ㄱ: () => p.replay(), // R on a Korean keyboard
    Home: () => p.restart(),
  };
  const f = act[e.key];
  if (!f) return;
  e.preventDefault();
  f();
});

// ------------------------------------------------------------------ loop

renderNav();
let last = performance.now();
const start = last;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const clock = (now - start) / 1000;
  if (dlg.open) tut.tick(dt, clock);
  else if (place === 'ai') main.tick(dt, clock);
  requestAnimationFrame(frame);
}
void route().then(() => requestAnimationFrame(frame));

// Handle for automated tests and for checking a script from the console.
declare global {
  interface Window {
    chemvis: unknown;
  }
}
const api = (v: Viewer) => ({
  seek: (k: number, t: number) => v.seek(k, t),
  state: () => ({ k: v.player.k, t: v.player.t, n: v.player.n, title: v.tl?.title ?? null, atEnd: v.player.atEnd }),
});
window.chemvis = {
  compile,
  chapters: CHAPTERS.map((c) => c.id),
  examples: EXAMPLES.map((e) => e.id),
  main: { ...api(main), load: (src: string) => loadMain(src) },
  tutorial: { ...api(tut), open: (id: string) => openTutorial(id), chapter: () => chapter.id },
};
