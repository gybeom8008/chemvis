/**
 * A stage with its caption and playback controls. The main workspace and the
 * tutorial popup each own one.
 */
import { compile, type CompileResult } from '../engine/compile';
import type { Timeline } from '../engine/timeline';
import type { Lens } from '../engine/world';
import { StageView } from '../render/view';
import { icon } from './icons';
import { Player } from './player';

export interface Settings {
  lens: Lens;
  speed: number;
  continuous: boolean;
  motion: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Viewer {
  readonly root: HTMLElement;
  readonly player = new Player();
  readonly view: StageView;
  tl: Timeline | null = null;
  src = '';
  /** Icon shown on the play button once everything has played (main: replay, tutorial: next chapter). */
  endIcon: 'replay' | 'nextChapter' = 'replay';
  onStep: ((k: number) => void) | null = null;
  onLoad: ((tl: Timeline | null) => void) | null = null;
  private settings: Settings;
  private caption: HTMLElement;
  private segs: HTMLElement;
  private playBtn: HTMLButtonElement;

  constructor(host: HTMLElement, settings: Settings) {
    this.settings = settings;
    host.innerHTML = `
      <div class="viewer is-empty">
        <div class="stage-box"><svg class="stage" role="img" aria-label="장면"></svg></div>
        <div class="dock">
          <p class="caption" aria-live="polite"><span class="count"></span><span class="text"></span></p>
          <div class="pill">
            <button class="icon" data-act="restart" aria-label="처음으로" title="처음으로">${icon('restart')}</button>
            <button class="icon" data-act="prev" aria-label="이전 단계" title="이전 단계 (←)">${icon('prev')}</button>
            <button class="icon play" data-act="play" aria-label="재생" title="재생 (스페이스)">${icon('play')}</button>
            <button class="icon" data-act="next" aria-label="다음 단계" title="다음 단계 (→)">${icon('next')}</button>
            <div class="segs" role="slider" aria-label="진행" tabindex="0"></div>
          </div>
        </div>
      </div>`;
    this.root = host.querySelector('.viewer')!;
    this.view = new StageView(host.querySelector('svg.stage') as unknown as SVGSVGElement);
    this.caption = host.querySelector('.caption')!;
    this.segs = host.querySelector('.segs')!;
    this.playBtn = host.querySelector('[data-act="play"]')!;

    host.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = this.player;
        ({ restart: () => p.restart(), prev: () => p.prev(), next: () => p.next(), play: () => p.toggle() })[
          b.dataset.act as 'restart'
        ]();
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
      this.onLoad?.(res.timeline);
    }
    return res;
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
    this.player.continuous = this.settings.continuous;
    this.player.tick(dt);
    if (!this.tl) return;
    const m = this.settings.motion;
    this.view.draw(this.player.k, this.player.t, { lens: this.settings.lens, clock: m ? clock : 0, motion: m, dt: m ? dt : 0 });
    this.paintSegs();
  }

  /** Draw immediately at a position (tests, scrubbing while paused). */
  seek(k: number, t: number): void {
    this.player.seek(k, t, false);
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
    this.segs.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.player.next();
      if (e.key === 'ArrowLeft') this.player.prev();
    });
  }

  private update(): void {
    const p = this.player;
    const step = this.tl?.steps[p.k];
    const count = this.caption.querySelector('.count')!;
    const text = this.caption.querySelector('.text')!;
    count.textContent = step ? `${p.k + 1} / ${p.n}` : '';
    text.textContent = step ? step.text : (this.tl?.title ?? '');
    const name = p.playing ? 'pause' : p.atEnd ? this.endIcon : 'play';
    if (this.playBtn.dataset.icon !== name) {
      this.playBtn.dataset.icon = name;
      this.playBtn.innerHTML = icon(name);
      const label = { pause: '멈춤', play: '재생', replay: '다시 재생', nextChapter: '다음 장' }[name];
      this.playBtn.setAttribute('aria-label', label);
      this.playBtn.title = label;
    }
    this.paintSegs();
  }
}
