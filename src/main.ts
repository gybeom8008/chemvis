import './style.css';
import { compile } from './engine/compile';
import type { Diag } from './dsl/parser';
import type { Timeline } from './engine/timeline';
import { decodeHash, encodeScript } from './share';
import { CHAPTERS, PARTS, type Chapter } from './tutorial/chapters';
import { icon } from './ui/icons';
import { Viewer, type Settings } from './ui/viewer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const settings: Settings = {
  lens: { charge: true, attract: false, numbers: false, oxidation: false },
  speed: 1,
  continuous: false,
  motion: !params.has('still') && !reducedMotion,
};

const PLACEHOLDER = `scene "제목"
stage solution
mol w = H2O at center
step "설명 문장"
  note w.O:lp "비공유 전자쌍"`;

// ------------------------------------------------------------------ icons

const icons: [string, string][] = [
  ['btn-tutorial', 'book'],
  ['btn-script', 'code'],
  ['btn-view', 'layers'],
  ['btn-link', 'link'],
  ['btn-edit', 'edit'],
  ['btn-drawer-close', 'close'],
  ['tut-view', 'layers'],
  ['tut-script', 'code'],
  ['tut-open', 'openIn'],
  ['tut-close', 'close'],
];
for (const [id, name] of icons) $(id).innerHTML = icon(name);

// ------------------------------------------------------------------ viewers

const main = new Viewer($('main-viewer'), settings);
const tut = new Viewer($('tut-viewer'), settings);
tut.endIcon = 'nextChapter';

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
  renderCode(codeView, main.src, tl, (k) => main.player.seek(k, 0, true));
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
  if (play) main.player.play();
  return true;
}

function applyEdit(): void {
  if (loadMain(codeEdit.value, true)) setEditing(false);
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
    <label class="sw"><input type="checkbox" data-lens="numbers"><span>원자 번호</span></label>
    <hr>
    <div class="speed" role="radiogroup" aria-label="속도">
      ${[0.5, 1, 1.5, 2].map((v) => `<button data-speed="${v}" role="radio">${v}×</button>`).join('')}
    </div>
    <label class="sw"><input type="checkbox" data-cont><span>이어서 재생</span></label>`;
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
  pop.querySelector<HTMLInputElement>('[data-cont]')!.addEventListener('change', (e) => {
    settings.continuous = (e.target as HTMLInputElement).checked;
    syncSettings();
  });
}

function syncSettings(): void {
  document.querySelectorAll<HTMLInputElement>('.popover [data-lens]').forEach((i) => (i.checked = settings.lens[i.dataset.lens as 'charge']));
  document.querySelectorAll<HTMLButtonElement>('.popover [data-speed]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.speed! === settings.speed)));
  document.querySelectorAll<HTMLInputElement>('.popover [data-cont]').forEach((i) => (i.checked = settings.continuous));
}

function bindPopover(btnId: string, popId: string): void {
  const btn = $(btnId);
  const pop = $(popId);
  buildSettings(pop);
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

// ------------------------------------------------------------------ tutorial popup

const dlg = $<HTMLDialogElement>('tutorial');
let chapter: Chapter = CHAPTERS[0];
let hashBeforeTutorial = '';

function renderNav(): void {
  let html = '';
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

function showChapter(c: Chapter, play = false): void {
  chapter = c;
  $('tut-part').textContent = PARTS.find((p) => p.id === c.part)?.title ?? '';
  $('tut-title').textContent = c.title;
  $('tut-intro').innerHTML = c.intro;
  $('tut-tryit').innerHTML = c.tryIt;
  document.querySelectorAll<HTMLElement>('#tut-nav a[data-ch]').forEach((a) => a.classList.toggle('on', a.dataset.ch === c.id));
  tut.load(c.script);
  renderCode($('tut-code-view'), c.script, tut.tl, (k) => tut.player.seek(k, 0, true));
  syncSettings();
  if (play) tut.player.play();
}
tut.onStep = (k) => markStep($('tut-code-view'), k);
tut.player.onEndPlay = () => {
  const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
  if (!next) return false;
  history.replaceState(null, '', `#/t/${next.id}`);
  showChapter(next, true);
  return true;
};

function openTutorial(id?: string): void {
  const c = CHAPTERS.find((x) => x.id === id) ?? chapter;
  if (!dlg.open) {
    hashBeforeTutorial = location.hash.startsWith('#/t/') ? '' : location.hash;
    dlg.showModal();
  }
  if (location.hash !== `#/t/${c.id}`) history.replaceState(null, '', `#/t/${c.id}`);
  showChapter(c);
}

function closeTutorial(): void {
  if (dlg.open) dlg.close();
}
dlg.addEventListener('close', () => {
  tut.player.pause();
  history.replaceState(null, '', hashBeforeTutorial || location.pathname + location.search);
});
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) closeTutorial();
});

$('btn-tutorial').addEventListener('click', () => openTutorial());
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
  if (h.startsWith('#z=') || h.startsWith('#s=')) {
    try {
      const src = await decodeHash(h);
      if (src) loadMain(src);
    } catch {
      toast('링크에 든 대본을 읽지 못했어요');
    }
    return;
  }
  if (h.startsWith('#/edit')) setDrawer(true);
}
window.addEventListener('hashchange', () => void route());

document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;
  const v = dlg.open ? tut : main;
  if (!v.tl) return;
  if (e.key === ' ') {
    e.preventDefault();
    v.player.toggle();
  } else if (e.key === 'ArrowRight') v.player.next();
  else if (e.key === 'ArrowLeft') v.player.prev();
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
  else main.tick(dt, clock);
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
  main: { ...api(main), load: (src: string) => loadMain(src) },
  tutorial: { ...api(tut), open: (id: string) => openTutorial(id), chapter: () => chapter.id },
};
