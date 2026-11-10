import '../render/stage.css';
import './next.css';
import { lessonById } from './course';
import { mountLesson } from './learn-lesson';
import { mountMap } from './learn-map';

const app = document.getElementById('app')!;
let dispose: (() => void) | null = null;

const BRAND = `<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><circle cx="13" cy="17" r="8.500" fill="#e03131"/><circle cx="24.500" cy="9" r="4.800" fill="#fff" stroke="#b9c0ca" stroke-width="1.200"/><circle cx="24.500" cy="25" r="4.800" fill="#fff" stroke="#b9c0ca" stroke-width="1.200"/></svg>`;
const TABS: [string, string][] = [
  ['learn', '배우기'],
  ['lab', '실험실'],
  ['ai', 'AI 장면'],
];

export function navHtml(cur: string): string {
  return `<header class="nav">
    <a class="brand" href="#/learn">${BRAND}<span>chemvis</span></a>
    <nav class="tabs" aria-label="화면">${TABS.map(([id, t]) => `<a href="#/${id}"${id === cur ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <span></span>
  </header>`;
}

const go = {
  map: () => (location.hash = '#/learn'),
  lesson: (id: string) => (location.hash = `#/learn/${id}`),
  lab: (formulas: string[]) => (location.hash = `#/lab${formulas.length ? '/' + formulas.map(encodeURIComponent).join(',') : ''}`),
};

function route(): void {
  dispose?.();
  dispose = null;
  const [tab = 'learn', arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (tab === 'learn' && arg) {
    const l = lessonById(arg);
    if (l?.chapter) {
      dispose = mountLesson(app, l, go);
      return;
    }
  }
  if (tab === 'learn') {
    dispose = mountMap(app, navHtml('learn'));
    scrollTo(0, 0);
    return;
  }
  app.innerHTML = navHtml(tab) + `<main class="page"></main>`;
}

addEventListener('hashchange', route);
route();
