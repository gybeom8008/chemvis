/**
 * One lesson: a question, the scene step by step, and a summary.
 * Two kinds of steps ask the learner to act before they play:
 * - a step where one molecule goes to another is dragged there by hand;
 * - before a marked step, the learner predicts by pressing an atom.
 * "다음" always goes on, so nobody is stuck.
 */
import { element } from '../chem/elements';
import type { StepAnim } from '../engine/timeline';
import { icon } from '../ui/icons';
import type { Vec } from '../util/math';
import { type Lesson, type Pick, markDone, nextReady, scriptOf } from './course';
import { STILL, Stage } from './stage';
import { atomTitle, esc, josa, speciesOf } from './util';

interface Mover {
  ids: string[];
  from: Vec;
  to: Vec;
  name: string;
}

/** The single named molecule that travels in a step where nothing else happens. */
function soleMover(stage: Stage, step: StepAnim): Mover | null {
  if (step.arrows.length || step.events.length || step.photons.length || step.flows.length || step.wires.length || step.bubbles.length) return null;
  const by = new Map<string, { ids: string[]; from: Vec; to: Vec; d: number }>();
  for (const [id, tr] of step.tracks) {
    const a = step.after.atoms.get(id);
    if (!a || a.crowd || tr.length < 2) continue;
    const p0 = tr[0];
    const p1 = tr[tr.length - 1];
    const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (d < 30) continue;
    const m = by.get(a.owner) ?? { ids: [], from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, d: 0 };
    m.ids.push(id);
    m.from.x += p0.x;
    m.from.y += p0.y;
    m.to.x += p1.x;
    m.to.y += p1.y;
    m.d = Math.max(m.d, d);
    by.set(a.owner, m);
  }
  if (by.size !== 1) return null;
  const m = [...by.values()][0];
  const n = m.ids.length;
  const w = stage.tl!.steps[step.index].before;
  return { ids: m.ids, from: { x: m.from.x / n, y: m.from.y / n }, to: { x: m.to.x / n, y: m.to.y / n }, name: speciesOf(w, m.ids[0]).name };
}

export function mountLesson(root: HTMLElement, lesson: Lesson, go: { map(): void; lesson(id: string): void; lab(formulas: string[]): void }): () => void {
  const src = scriptOf(lesson)!;
  root.innerHTML = `
    <div class="lesson">
      <header class="lbar">
        <button class="btn ghost" data-act="map">${icon('arrowLeft')}<span>과정</span></button>
        <h1><span class="no">${lesson.id}</span><span>${esc(lesson.title)}</span></h1>
        <span class="sp"></span>
      </header>
      <div class="lwrap">
        <section class="pcard">
          <div class="pv"></div>
          <div class="psub" aria-live="polite"></div>
          <div class="pbar">
            <div class="l">
              <button class="btn dim sq" data-act="prev" title="이전 단계 (←)" aria-label="이전 단계">${icon('prev')}</button>
              <button class="btn dim" data-act="replay" title="이 단계 다시 보기 (R)">${icon('replay')}<span>다시 보기</span></button>
            </div>
            <div class="segs"></div>
            <div class="r"><button class="btn light big" data-act="next"></button></div>
          </div>
        </section>
      </div>
    </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;
  const card = $('.pcard');
  const sub = $('.psub');
  const segs = $('.segs');
  const nextBtn = $<HTMLButtonElement>('[data-act="next"]');
  const prevBtn = $<HTMLButtonElement>('[data-act="prev"]');
  const stage = new Stage($('.pv'));
  stage.load(src);
  const tl = stage.tl!;
  const p = stage.player;
  const n = tl.steps.length;
  segs.innerHTML = tl.steps.map((s, i) => `<button data-seg="${i}" title="${i + 1}. ${esc(s.text)}" aria-label="${i + 1}단계"><i></i></button>`).join('');

  type Gate = { kind: 'drag'; k: number; mover: Mover } | { kind: 'pick'; k: number; pick: Pick; chosen: string | null };
  let gate: Gate | null = null;
  const passed = new Set<number>();
  let phase: 'intro' | 'play' | 'end' = 'intro';
  let veil: HTMLElement | null = null;

  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  stage.host.appendChild(tip);

  // ---------------------------------------------------------------- what the card says

  function paint(): void {
    const step = tl.steps[p.k];
    let html = `<div><p class="say">${esc(step.text)}</p></div>`;
    let label = p.onLast ? '정리' : '다음';
    if (gate?.kind === 'drag') {
      html = `<div><p class="say">${esc(step.text)}</p><p class="hint">${icon('hand')}${esc(josa(gate.mover.name, '을를'))} 끌어서 가까이 가져가 보세요</p></div>`;
    } else if (gate?.kind === 'pick') {
      if (gate.chosen === null) {
        html = `<div><p class="say ask">${esc(gate.pick.ask)}</p><p class="hint">무대에서 원자를 눌러 답해요</p></div>`;
        label = '모르겠어요';
      } else {
        const ok = gate.chosen === gate.pick.answer;
        const ans = tl.initial.atoms.get(gate.pick.answer)?.el ?? '';
        html = `<div><p class="ok">${ok ? icon('check') + '맞아요' : `답은 ${esc(ans)}예요`}</p><p class="say">${esc(gate.pick.why)}</p></div>`;
        label = '확인하기';
      }
    }
    sub.innerHTML = html;
    nextBtn.innerHTML = `<span>${label}</span>${icon('arrowRight')}`;
    prevBtn.disabled = p.onFirst;
  }

  // Rings and handles are built once per question and then only moved, so that a press that
  // starts on one is still on it when the pointer comes up.
  let ovKey = '';
  function overlays(): void {
    const ov = stage.over;
    const key = !gate || phase !== 'play' ? '' : gate.kind === 'pick' ? `pick:${gate.k}:${gate.chosen}` : `drag:${gate.k}`;
    if (key !== ovKey) {
      ovKey = key;
      if (!gate || !key) ov.innerHTML = '';
      else if (gate.kind === 'pick') {
        const g = gate;
        ov.innerHTML = g.pick.from
          .map((id) => {
            const cls = g.chosen === null ? '' : id === g.pick.answer ? ' yes' : ' no';
            return `<button class="ring${cls}" data-pick="${id}" aria-label="${esc(tl.initial.atoms.get(id)?.el ?? '')}"></button>`;
          })
          .join('');
      } else ov.innerHTML = '<button class="grab" aria-label="끌기"></button><span class="way"></span>';
    }
    if (!gate || !key) return;
    const k = stage.scale;
    const put = (el: HTMLElement, c: Vec, r: number) => {
      el.style.left = `${c.x.toFixed(1)}px`;
      el.style.top = `${c.y.toFixed(1)}px`;
      el.style.width = el.style.height = `${(2 * r).toFixed(1)}px`;
    };
    if (gate.kind === 'pick') {
      for (const el of ov.querySelectorAll<HTMLElement>('.ring')) {
        const id = el.dataset.pick!;
        const a = tl.initial.atoms.get(id);
        const q = stage.pos(id);
        if (a && q) put(el, stage.toScreen(q), Math.max(22, (element(a.el).r + 7) * k));
      }
    } else {
      const m = gate.mover;
      const c = { x: 0, y: 0 };
      for (const id of m.ids) {
        const q = stage.pos(id)!;
        c.x += q.x / m.ids.length;
        c.y += q.y / m.ids.length;
      }
      const s = stage.toScreen(c);
      const e = stage.toScreen(m.to);
      const r = Math.max(36, 48 * k);
      put(ov.querySelector<HTMLElement>('.grab')!, s, r);
      const way = ov.querySelector<HTMLElement>('.way')!;
      const ang = Math.atan2(e.y - s.y, e.x - s.x);
      const far = Math.hypot(e.x - s.x, e.y - s.y);
      way.style.display = far > r + 60 ? '' : 'none';
      way.style.left = `${(s.x + Math.cos(ang) * (r + 10)).toFixed(1)}px`;
      way.style.top = `${(s.y + Math.sin(ang) * (r + 10)).toFixed(1)}px`;
      way.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    }
  }

  stage.onFrame = () => {
    segs.querySelectorAll<HTMLElement>('i').forEach((el, i) => el.style.setProperty('--f', String(i < p.k ? 1 : i > p.k ? 0 : p.t)));
    overlays();
  };

  // ---------------------------------------------------------------- gates

  /** Arriving at a step: stop for a question or for the learner's hand, once. */
  function arrive(k: number): void {
    gate = null;
    if (phase === 'play' && !STILL && !passed.has(k)) {
      const pick = lesson.picks?.find((q) => q.before === k);
      const step = tl.steps[k];
      if (pick) {
        gate = { kind: 'pick', k, pick, chosen: null };
        // Far enough into the step for the camera to have closed in on the molecules asked about.
        const hold = Math.min((step.phase?.b0 ?? 0.2) * 0.95, 0.2);
        p.seek(k, hold);
      } else {
        const mover = soleMover(stage, step);
        if (mover) {
          gate = { kind: 'drag', k, mover };
          p.seek(k, 0);
        }
      }
    }
    paint();
  }
  p.onStepEnter = (k) => {
    const st = tl.steps[k];
    if (st?.lens) Object.assign(stage.lens, st.lens);
    arrive(k);
  };

  /** Let the held step play on from where it is. */
  function release(): void {
    if (!gate) return;
    passed.add(gate.k);
    gate = null;
    p.running = true;
    paint();
  }

  stage.over.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
    if (!b || gate?.kind !== 'pick' || gate.chosen !== null) return;
    gate.chosen = b.dataset.pick!;
    paint();
  });

  // Dragging the molecule moves the step forward by hand.
  let drag: { x: number; y: number; dir: Vec; len2: number; u: number } | null = null;
  stage.over.addEventListener('pointerdown', (e) => {
    const g = (e.target as HTMLElement).closest<HTMLElement>('.grab');
    if (!g || gate?.kind !== 'drag') return;
    const a = stage.toScreen(gate.mover.from);
    const b = stage.toScreen(gate.mover.to);
    const dir = { x: b.x - a.x, y: b.y - a.y };
    drag = { x: e.clientX, y: e.clientY, dir, len2: dir.x * dir.x + dir.y * dir.y || 1, u: 0 };
    g.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.over.addEventListener('pointermove', (e) => {
    if (!drag || gate?.kind !== 'drag') return;
    const u = ((e.clientX - drag.x) * drag.dir.x + (e.clientY - drag.y) * drag.dir.y) / drag.len2;
    drag.u = Math.max(0, Math.min(1, u));
    p.seek(gate.k, drag.u * 0.98);
  });
  const drop = () => {
    if (!drag) return;
    const u = drag.u;
    drag = null;
    if (gate?.kind !== 'drag') return;
    if (u > 0.55) release();
    else p.seek(gate.k, 0);
  };
  stage.over.addEventListener('pointerup', drop);
  stage.over.addEventListener('pointercancel', drop);

  // ---------------------------------------------------------------- names under the pointer

  stage.host.addEventListener('pointermove', (e) => {
    if (drag || veil) return void (tip.hidden = true);
    const w = stage.world;
    const a = w && stage.pick(e.clientX, e.clientY, (x) => !x.crowd, 4);
    if (!a || !w) return void (tip.hidden = true);
    const q = stage.toScreen(stage.pos(a.id)!);
    tip.textContent = atomTitle(w, a);
    tip.style.left = `${q.x}px`;
    tip.style.top = `${q.y - element(a.el).r * stage.scale - 12}px`;
    tip.hidden = false;
  });
  stage.host.addEventListener('pointerleave', () => (tip.hidden = true));

  // ---------------------------------------------------------------- start and end

  function showVeil(html: string): void {
    veil?.remove();
    veil = document.createElement('div');
    veil.className = 'veil';
    veil.innerHTML = `<div class="in">${html}</div>`;
    card.appendChild(veil);
    veil.querySelector<HTMLElement>('.btn.light')?.focus();
  }
  function hideVeil(): void {
    veil?.remove();
    veil = null;
  }

  function intro(): void {
    phase = 'intro';
    p.seek(0, 0);
    showVeil(`
      <p class="eyebrow">${lesson.id} ${esc(lesson.title)}</p>
      <h2>${esc(lesson.hook ?? lesson.title)}</h2>
      <div class="row"><button class="btn light big" data-act="start"><span>시작</span>${icon('arrowRight')}</button></div>`);
  }
  function start(): void {
    hideVeil();
    phase = 'play';
    passed.clear();
    p.go(0);
    arrive(0);
  }
  function end(): void {
    phase = 'end';
    markDone(lesson.id);
    const nx = nextReady(lesson);
    showVeil(`
      <p class="eyebrow">정리</p>
      <h2>${esc(lesson.summary ?? lesson.title)}</h2>
      ${lesson.terms?.length ? `<div class="terms">${lesson.terms.map(([w, m]) => `<div class="term"><b>${esc(w)}</b><span>${esc(m)}</span></div>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn dim" data-act="again">${icon('replay')}<span>처음부터</span></button>
        ${lesson.lab ? `<button class="btn dim" data-act="lab">${icon('flask')}<span>실험실에서 직접 해 보기</span></button>` : ''}
        ${nx ? `<button class="btn light big" data-act="nextLesson"><span>다음 수업</span>${icon('arrowRight')}</button>` : `<button class="btn light big" data-act="map"><span>과정으로</span>${icon('arrowRight')}</button>`}
      </div>`);
  }

  function next(): void {
    if (phase === 'intro') return start();
    if (phase === 'end') return;
    if (gate) return release();
    if (p.onLast) return end();
    p.next();
  }

  const acts: Record<string, () => void> = {
    map: () => go.map(),
    start,
    again: start,
    lab: () => go.lab(lesson.lab ?? []),
    nextLesson: () => {
      const nx = nextReady(lesson);
      if (nx) go.lesson(nx.id);
    },
    next,
    prev: () => {
      gate = null;
      p.prev();
    },
    replay: () => {
      gate = null;
      p.replay();
      paint();
    },
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-seg]');
    if (!b) return;
    if (b.dataset.seg !== undefined) {
      gate = null;
      passed.add(+b.dataset.seg);
      p.go(+b.dataset.seg);
      return;
    }
    acts[b.dataset.act!]?.();
    if ((e as MouseEvent).detail > 0) b.blur();
  });
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' && phase === 'play') acts.prev();
    else if ((e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') && phase === 'play') acts.replay();
    else if (e.key === 'Escape') go.map();
  };
  document.addEventListener('keydown', onKey);

  if (n) intro();
  paint();
  return () => document.removeEventListener('keydown', onKey);
}
