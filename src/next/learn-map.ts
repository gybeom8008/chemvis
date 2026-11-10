/** 배우기의 첫 화면: 이어서 볼 수업 하나와, 단원별 수업 카드. 카드의 그림은 그 수업의 실제 장면이다. */
import type { Timeline } from '../engine/timeline';
import { icon } from '../ui/icons';
import { LESSONS, UNITS, doneSet, ready, scriptOf, upNext, type Lesson } from './course';
import { Stage } from './stage';
import { esc } from './util';

/** The moment of a scene that shows best what it is about: electrons on their way, or else the result. */
export function keyFrame(tl: Timeline): [number, number] {
  const k = tl.steps.findIndex((s) => s.arrows.length > 0 && s.phase);
  if (k >= 0) {
    const ph = tl.steps[k].phase!;
    return [k, ph.b0 + (ph.b1 - ph.b0) * 0.55];
  }
  const m = tl.steps.findIndex((s) => s.events.length || s.bubbles.length || s.flows.length || s.wires.length);
  if (m >= 0) return [m, 0.6];
  return [Math.max(0, tl.steps.length - 1), 1];
}

/** Draw a scene's key frame into a small box, once the box is on screen. */
export function thumbs(root: HTMLElement): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const host = e.target as HTMLElement;
        const src = host.dataset.src;
        if (!src) continue;
        const st = new Stage(host, { live: false });
        if (st.load(src).timeline) st.still(...keyFrame(st.tl!));
      }
    },
    { rootMargin: '300px' },
  );
  root.querySelectorAll<HTMLElement>('.thumb[data-src]').forEach((el) => io.observe(el));
}

export function mountMap(root: HTMLElement, nav: string): () => void {
  const done = doneSet();
  const next = upNext();
  const started = done.size > 0;
  const card = (l: Lesson): string => {
    if (!ready(l)) return `<div class="lcard soon"><div class="thumb"><span>준비 중</span></div><p class="meta"><span class="no">${l.id}</span><b>${esc(l.title)}</b></p></div>`;
    const cls = done.has(l.id) ? ' done' : l === next ? ' next' : '';
    return `<a class="lcard${cls}" href="#/learn/${l.id}" title="${esc(l.hook ?? l.title)}">
      <div class="thumb" data-src="${esc(scriptOf(l)!)}"></div>
      ${done.has(l.id) ? `<span class="badge" aria-label="본 수업">${icon('check')}</span>` : ''}
      <p class="meta"><span class="no">${l.id}</span><b>${esc(l.title)}</b></p>
    </a>`;
  };
  root.innerHTML = `${nav}
    <main class="map">
      <aside class="units" aria-label="단원">
        ${UNITS.map((u) => {
          const ls = LESSONS.filter((l) => l.unit === u.n);
          const d = ls.filter((l) => done.has(l.id)).length;
          return `<a href="#u${u.n}" data-unit="${u.n}"><span class="un">${u.n}</span><span class="ut">${esc(u.title)}</span><span class="up">${d ? `${d}/${ls.length}` : ''}</span></a>`;
        }).join('')}
      </aside>
      <div class="mapmain">
        <a class="hero" href="#/learn/${next.id}">
          <div class="hv"></div>
          <div class="ht">
            <p class="eyebrow">${started ? '이어서 배우기' : '여기서 시작해요'} · ${next.id} ${esc(next.title)}</p>
            <h1>${esc(next.hook ?? next.title)}</h1>
            <span class="btn light big"><span>${started ? '이어서' : '시작'}</span>${icon('arrowRight')}</span>
          </div>
        </a>
        ${UNITS.map(
          (u) => `<section class="unit" id="u${u.n}">
            <header><span class="un">${u.n}</span><div><h2>${esc(u.title)}</h2><p>${esc(u.about)}</p></div></header>
            <div class="cards">${LESSONS.filter((l) => l.unit === u.n).map(card).join('')}</div>
          </section>`,
        ).join('')}
      </div>
    </main>`;

  const hero = new Stage(root.querySelector<HTMLElement>('.hv')!);
  if (hero.load(scriptOf(next)!).timeline) {
    const [k, t] = keyFrame(hero.tl!);
    hero.player.seek(k, t);
  }
  thumbs(root);

  // The unit list jumps within the page and shows where the page is.
  const side = root.querySelector<HTMLElement>('.units')!;
  side.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-unit]');
    if (!a) return;
    e.preventDefault();
    root.querySelector(`#u${a.dataset.unit}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const spy = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        side.querySelectorAll('a').forEach((a) => a.classList.toggle('on', `u${a.dataset.unit}` === e.target.id));
      }
    },
    { rootMargin: '-20% 0px -65% 0px' },
  );
  root.querySelectorAll('.unit').forEach((el) => spy.observe(el));
  return () => spy.disconnect();
}
