/**
 * A stage with its caption and playback controls. The main workspace and the
 * tutorial popup each own one.
 */
import { compile, type CompileResult } from '../engine/compile';
import type { Timeline } from '../engine/timeline';
import type { Lens } from '../engine/world';
import { StageView } from '../render/view';
import { icon } from './icons';
import { legendHtml, playSwatch } from './legend';
import { Player } from './player';

export interface Settings {
  lens: Lens;
  speed: number;
  /** "이어서 재생": after a step, go on to the next one by itself. */
  continuous: boolean;
  motion: boolean;
}

/** What the forward button does on the last step. */
type EndAction = 'restart' | 'nextChapter';
const END: Record<EndAction, { icon: string; text: string; title: string }> = {
  restart: { icon: 'first', text: '처음부터', title: '첫 단계로 (→)' },
  nextChapter: { icon: 'nextChapter', text: '다음 장', title: '다음 장으로 (→)' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Viewer {
  readonly root: HTMLElement;
  readonly player = new Player();
  readonly view: StageView;
  tl: Timeline | null = null;
  src = '';
  /** What the forward button offers on the last step (the tutorial offers the next chapter while there is one). */
  endAction: () => EndAction = () => 'restart';
  onStep: ((k: number) => void) | null = null;
  onLoad: ((tl: Timeline | null) => void) | null = null;
  private settings: Settings;
  private caption: HTMLElement;
  private segs: HTMLElement;
  private count: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private legendBtn: HTMLButtonElement;
  private legendPop: HTMLElement;

  constructor(host: HTMLElement, settings: Settings) {
    this.settings = settings;
    host.innerHTML = `
      <div class="viewer is-empty">
        <div class="stage-box"><svg class="stage" role="img" aria-label="장면"></svg></div>
        <div class="dock">
          <div class="dock-side legend-wrap">
            <button class="icon legend-btn" aria-label="범례" title="범례" aria-expanded="false">${icon('legend')}</button>
            <div class="legend-pop" role="dialog" aria-label="범례" hidden></div>
          </div>
          <div class="dock-main">
            <p class="caption" aria-live="polite"><span class="text"></span></p>
            <div class="pill">
              <div class="pg">
                <div class="segs" role="slider" aria-label="단계" title="눌러서 원하는 순간 보기" tabindex="0"></div>
                <span class="count"></span>
              </div>
              <div class="nav">
                <button class="icon" data-act="prev" aria-label="이전 단계" title="이전 단계 (←)">${icon('prev')}</button>
                <button class="lbl" data-act="replay" aria-label="다시 보기" title="이 단계 다시 보기 (R)">${icon('replay')}<span>다시 보기</span></button>
                <button class="lbl primary" data-act="next" aria-label="다음 단계" title="다음 단계 (→, 스페이스)"><span>다음</span>${icon('next')}</button>
              </div>
            </div>
          </div>
          <div class="dock-side"></div>
        </div>
      </div>`;
    this.root = host.querySelector('.viewer')!;
    this.view = new StageView(host.querySelector('svg.stage') as unknown as SVGSVGElement);
    this.caption = host.querySelector('.caption')!;
    this.count = host.querySelector('.count')!;
    this.segs = host.querySelector('.segs')!;
    this.prevBtn = host.querySelector('[data-act="prev"]')!;
    this.nextBtn = host.querySelector('[data-act="next"]')!;
    this.legendBtn = host.querySelector('.legend-btn')!;
    this.legendPop = host.querySelector('.legend-pop')!;
    this.legendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showLegend(this.legendPop.hidden !== false);
    });
    this.legendPop.addEventListener('click', (e) => {
      e.stopPropagation();
      const more = (e.target as HTMLElement).closest('.lg-more');
      if (!more) return;
      const all = this.legendPop.classList.toggle('show-all');
      more.setAttribute('aria-pressed', String(all));
      more.textContent = all ? '이 장면 범례만 보기' : '전체 범례 보기';
    });
    // Marks that move on the stage move in their swatch while the pointer is on the row.
    this.legendPop.addEventListener('pointerover', (e) => {
      const row = (e.target as Element).closest('.lg-list li');
      if (row && !row.contains(e.relatedTarget as Node)) playSwatch(row, true);
    });
    this.legendPop.addEventListener('pointerout', (e) => {
      const row = (e.target as Element).closest('.lg-list li');
      if (row && !row.contains(e.relatedTarget as Node)) playSwatch(row, false);
    });
    // Any press outside the panel closes it (some buttons stop their clicks from spreading).
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as Node;
      if (!this.legendPop.hidden && !this.legendPop.contains(t) && !this.legendBtn.contains(t)) this.showLegend(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.legendPop.hidden) this.showLegend(false);
    });

    host.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        const p = this.player;
        ({ prev: () => p.prev(), replay: () => p.replay(), next: () => p.next() })[b.dataset.act as 'prev']();
        // After a mouse press, keys go back to the page shortcuts instead of pressing this button again.
        if (e.detail > 0) b.blur();
      }),
    );
    this.bindScrub();
    this.setEnabled(false);
    this.segs.innerHTML = '<span class="seg"><i></i></span>';
    this.player.onChange = () => this.update();
    this.player.onStepEnter = (k) => {
      const step = this.tl?.steps[k];
      if (step?.lens) Object.assign(this.settings.lens, step.lens);
      this.onStep?.(k);
    };
  }

  /** Compile and show a script. Keeps the previous scene if the new one has errors. */
  load(src: string): CompileResult {
    const res = compile(src);
    this.src = src;
    if (res.timeline) {
      this.tl = res.timeline;
      this.view.setTimeline(res.timeline);
      Object.assign(this.settings.lens, res.timeline.initial.lens);
      this.player.load(res.timeline);
      this.root.classList.remove('is-empty');
      this.setEnabled(true);
      this.buildSegs();
      this.update();
      if (!this.legendPop.hidden) this.showLegend(true);
      this.onLoad?.(res.timeline);
    }
    return res;
  }

  /** Open or close the legend; it is rebuilt from the current scene each time it opens. */
  showLegend(open: boolean): void {
    if (open) {
      this.legendPop.innerHTML = legendHtml(this.tl, this.settings.lens);
      this.legendPop.classList.remove('show-all');
    }
    this.legendPop.hidden = !open;
    this.legendBtn.setAttribute('aria-expanded', String(open));
  }

  clear(): void {
    this.tl = null;
    this.src = '';
    this.view.clear();
    this.player.unload();
    this.root.classList.add('is-empty');
    this.setEnabled(false);
    this.segs.innerHTML = '<span class="seg"><i></i></span>';
    this.onLoad?.(null);
  }

  tick(dt: number, clock: number): void {
    this.player.speed = this.settings.speed;
    this.player.auto = this.settings.continuous;
    this.player.tick(dt);
    if (!this.tl) return;
    const m = this.settings.motion;
    this.view.draw(this.player.k, this.player.t, { lens: this.settings.lens, clock: m ? clock : 0, motion: m, dt: m ? dt : 0 });
    this.paintSegs();
  }

  /** Draw immediately at a position (tests, scrubbing while paused). */
  seek(k: number, t: number): void {
    this.player.seek(k, t);
    if (this.tl) this.view.draw(this.player.k, this.player.t, { lens: this.settings.lens, clock: 0, motion: false });
    this.paintSegs();
  }

  private setEnabled(on: boolean): void {
    this.root.querySelectorAll<HTMLButtonElement>('.pill button').forEach((b) => (b.disabled = !on));
    this.segs.tabIndex = on ? 0 : -1;
  }

  private buildSegs(): void {
    const n = this.tl?.steps.length ?? 0;
    this.segs.innerHTML = Array.from({ length: n }, (_, i) => `<span class="seg" title="${i + 1}. ${esc(this.tl!.steps[i].text)}"><i></i></span>`).join('');
  }

  private paintSegs(): void {
    const p = this.player;
    this.segs.querySelectorAll<HTMLElement>('.seg').forEach((el, i) => {
      const f = i < p.k ? 1 : i > p.k ? 0 : p.t;
      (el.firstElementChild as HTMLElement).style.transform = `scaleX(${f})`;
      el.classList.toggle('on', i === p.k);
    });
  }

  private bindScrub(): void {
    let dragging = false;
    const at = (e: PointerEvent) => {
      const segs = [...this.segs.querySelectorAll<HTMLElement>('.seg')];
      for (let i = 0; i < segs.length; i++) {
        const r = segs[i].getBoundingClientRect();
        if (e.clientX <= r.right + 3 || i === segs.length - 1) {
          return { k: i, t: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) };
        }
      }
      return null;
    };
    this.segs.addEventListener('pointerdown', (e) => {
      const hit = at(e);
      if (!hit) return;
      dragging = true;
      this.segs.setPointerCapture(e.pointerId);
      this.seek(hit.k, hit.t);
    });
    this.segs.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const hit = at(e);
      if (hit) this.seek(hit.k, hit.t);
    });
    const stop = () => (dragging = false);
    this.segs.addEventListener('pointerup', stop);
    this.segs.addEventListener('pointercancel', stop);
  }

  private update(): void {
    const p = this.player;
    const step = this.tl?.steps[p.k];
    const text = this.caption.querySelector('.text')!;
    this.count.textContent = step ? `${p.k + 1} / ${p.n}` : '';
    text.textContent = step ? step.text : (this.tl?.title ?? '');
    this.segs.setAttribute('aria-valuetext', step ? `${p.n}단계 중 ${p.k + 1}단계` : '');

    // There is no step before the first one: the button rests instead of repeating the step.
    this.prevBtn.disabled = !this.tl || p.onFirst;

    // Forward: the next step, and on the last step whatever comes after the scene.
    const end = p.onLast ? this.endAction() : null;
    const key = end ?? 'next';
    if (this.nextBtn.dataset.state !== key) {
      this.nextBtn.dataset.state = key;
      const v = end ? END[end] : { icon: 'next', text: '다음', title: '다음 단계 (→, 스페이스)' };
      // An arrow that points back goes before the words, one that points ahead after them.
      this.nextBtn.innerHTML = end === 'restart' ? `${icon(v.icon)}<span>${v.text}</span>` : `<span>${v.text}</span>${icon(v.icon)}`;
      this.nextBtn.setAttribute('aria-label', end ? v.text : '다음 단계');
      this.nextBtn.title = v.title;
      this.nextBtn.classList.toggle('end', !!end);
    }
    this.paintSegs();
  }
}
