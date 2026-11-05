/**
 * The legend panel: what each mark on the stage means. Marks the current scene
 * uses are listed; the rest can be shown dimmed. Real things and textbook
 * notation are kept apart from marks this app made up. Swatches are small SVGs
 * using the renderer's own classes, so they match the stage in both themes;
 * marks that move on the stage move in their swatch while the pointer is on it.
 */
import { ELEMENTS } from '../chem/elements';
import type { Timeline } from '../engine/timeline';
import { formalCharge, type Lens, type World } from '../engine/world';

interface Item {
  key: string;
  label: string;
  svg: string;
}

/** Swatch frame. Animations inside start only when the row is hovered (see playSwatch). */
const sw = (inner: string, w = 36) => `<svg class="lg-sw" viewBox="0 0 ${w} 22" width="${w}" height="22" aria-hidden="true">${inner}</svg>`;
/** An animation that waits for the hover to start it, then repeats. */
const loop = (dur: number) => `dur="${dur}s" begin="indefinite" repeatCount="indefinite"`;

const ARC = 'M5,17 Q16,0 27,12';
/** Electrons riding the arc; they sit at the tail until the row is hovered. */
const riders = (n: 1 | 2) =>
  (n === 2 ? [-2.8, 2.8] : [0])
    .map(
      (dy) =>
        `<circle class="e fly" cx="0" cy="${dy}" r="3.2" transform="translate(5,17)"><animateMotion ${loop(1.5)} path="M0,0 Q11,-17 22,-5" keyTimes="0;0.75;1" keyPoints="0;1;1" calcMode="linear"/></circle>`,
    )
    .join('');

const wavePts = () => {
  const pts: string[] = [];
  for (let x = 3; x <= 27; x += 1.5) pts.push(`${x.toFixed(1)},${(11 + Math.sin((x - 3) / 2.2) * 3.5).toFixed(1)}`);
  return pts.join(' ');
};

const REAL: Item[] = [
  { key: 'bond1', label: '공유 결합(전자쌍 1개를 두 원자가 함께 씀)', svg: sw('<line class="bond" x1="4" y1="11" x2="32" y2="11"/>') },
  { key: 'bond2', label: '이중 결합(전자쌍 2개)', svg: sw('<line class="bond" x1="4" y1="8" x2="32" y2="8"/><line class="bond" x1="4" y1="14" x2="32" y2="14"/>') },
  {
    key: 'bond3',
    label: '삼중 결합(전자쌍 3개)',
    svg: sw('<line class="bond" x1="4" y1="5.5" x2="32" y2="5.5"/><line class="bond" x1="4" y1="11" x2="32" y2="11"/><line class="bond" x1="4" y1="16.5" x2="32" y2="16.5"/>'),
  },
  {
    key: 'dative',
    label: '배위 결합(화살촉 쪽 원자가 전자쌍을 얻음)',
    svg: sw('<line class="bond" x1="4" y1="11" x2="32" y2="11"/><polygon class="dative" points="22,11 14,6.5 14,15.5"/>'),
  },
  { key: 'lp', label: '비공유 전자쌍(결합에 쓰이지 않은 전자 2개)', svg: sw('<circle class="lp" cx="15" cy="11" r="2.3"/><circle class="lp" cx="21" cy="11" r="2.3"/>') },
  { key: 'single', label: '홑전자(짝 없는 전자 1개, 라디칼)', svg: sw('<circle class="lp single" cx="18" cy="11" r="2.7"/>') },
  { key: 'charge', label: '전하', svg: sw('<g class="charge pos"><circle cx="18" cy="11" r="7.5"/><text x="18" y="11" dy="0.36em">+</text></g>') },
  { key: 'ox', label: '산화수', svg: sw('<text class="ox" x="18" y="11" dy="0.35em">+2</text>') },
  {
    key: 'arrow',
    label: '전자쌍(전자 2개)의 이동',
    svg: sw(`<g class="arrow" opacity="0.55"><path d="${ARC}"/><polygon points="31,16 23.5,14 28.5,8.5"/></g>${riders(2)}`),
  },
  {
    key: 'hook',
    label: '전자 1개의 이동',
    svg: sw(`<g class="arrow hook" opacity="0.55"><path d="M5,17 Q16,0 29.5,14.5"/><path d="M31,16 L22.5,12"/></g>${riders(1)}`),
  },
  {
    key: 'e',
    label: '전자',
    svg: sw(`<circle class="e fly" cx="6" cy="11" r="3.4"><animate attributeName="cx" values="6;30;6" ${loop(1.6)}/></circle>`),
  },
  { key: 'attract', label: '분자 사이 인력(수소 결합 등)', svg: sw('<line class="attract" x1="4" y1="11" x2="32" y2="11"/>') },
  {
    key: 'photon',
    label: '빛(hν)',
    svg: sw(
      `<g class="photon"><polyline points="${wavePts()}" stroke-dasharray="40" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="40;0;0" keyTimes="0;0.7;1" ${loop(1.4)}/></polyline><polygon points="32,11 27,8 27,14"/></g>`,
    ),
  },
  {
    key: 'bubble',
    label: '기포(액체 속에서 생긴 기체)',
    svg: sw(
      `<circle class="bubble" cx="18" cy="11" r="7"><animate attributeName="cy" values="19;4" ${loop(1.6)}/><animate attributeName="r" values="3;7.5" ${loop(1.6)}/></circle>`,
    ),
  },
  { key: 'sei', label: 'SEI 막(전지 흑연 표면에 생기는 막)', svg: sw('<circle class="sei" cx="18" cy="11" r="9"/>') },
  { key: 'protein', label: '막 단백질(통로·펌프·ATP 합성 효소)', svg: sw('<rect class="protein" x="10" y="2" width="16" height="18" rx="5"/>') },
];

const APP: Item[] = [
  { key: 'half', label: '반응 도중 전자가 1개만 남은 결합', svg: sw('<line class="bond half" x1="4" y1="11" x2="32" y2="11"/>') },
  { key: 'focus', label: '이번 단계에서 움직이는 것', svg: sw('<circle class="focus" cx="18" cy="11" r="7.5"/>') },
  {
    key: 'trail',
    label: '입자가 지나간 경로',
    svg: sw(
      `<polyline class="trail" points="3,15 9,7 15,13 22,6 31,10"/><circle class="lg-dot" r="3" cx="0" cy="0" transform="translate(3,15)"><animateMotion ${loop(1.8)} path="M0,0 L6,-8 L12,-2 L19,-9 L28,-5"/></circle>`,
    ),
  },
  {
    key: 'crowd',
    label: '배경의 용매 분자(물 등)',
    svg: sw(
      `<circle class="atom crowd" cx="18" cy="11" r="7.5" fill="#e03131" opacity="0.5"><animateTransform attributeName="transform" type="translate" values="0 0;1.6 -1;-1.2 1.2;0.8 0.6;0 0" ${loop(1.2)}/></circle>`,
    ),
  },
  {
    key: 'spark',
    label: '방금 반응이 일어난 곳',
    svg: sw(
      `<circle class="spark" cx="18" cy="11" r="7.5"><animate attributeName="r" values="3;10" ${loop(1)}/><animate attributeName="opacity" values="1;0" ${loop(1)}/></circle>`,
    ),
  },
  {
    key: 'energy',
    label: '에너지 변화 그래프',
    svg: sw(
      `<polyline class="lg-line" points="3,7 10,7 15,3 21,16 33,16" stroke-dasharray="50" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="50;0;0" keyTimes="0;0.75;1" ${loop(1.8)}/></polyline>`,
    ),
  },
  {
    key: 'tally',
    label: '분자 종류별 개수 그래프',
    svg: sw(
      `<polyline class="lg-line s2" points="3,17 12,10 20,7 33,7" stroke-dasharray="40" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="40;0;0" keyTimes="0;0.75;1" ${loop(1.8)}/></polyline><polyline class="lg-line s0" points="3,5 12,11 20,14 33,14" stroke-dasharray="40" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="40;0;0" keyTimes="0;0.75;1" ${loop(1.8)}/></polyline>`,
    ),
  },
];

const GROUPS: { title: string; items: Item[] }[] = [
  { title: '실제 물질과 화학 표기', items: REAL },
  { title: '이 앱만의 표시', items: APP },
];

/** Which marks a timeline uses (with the current lens). Null timeline: none. */
function used(tl: Timeline | null, lens: Lens): Set<string> {
  const on = new Set<string>();
  if (!tl) return on;
  const worlds: World[] = [tl.initial, ...tl.steps.map((s) => s.after)];
  const lensEver = (k: keyof Lens) => lens[k] || tl.initial.lens[k] || tl.steps.some((s) => s.lens?.[k]);
  for (const w of worlds) {
    for (const b of w.bonds.values()) {
      if (b.dative) on.add('dative');
      else if (b.order >= 3) on.add('bond3');
      else if (b.order >= 2) on.add('bond2');
      else on.add('bond1');
    }
    for (const a of w.atoms.values()) {
      if (a.gone) continue;
      if (a.crowd) on.add('crowd');
      if (a.lp > 0 && !a.lattice) on.add('lp');
      if (a.rad > 0 && !a.lattice) on.add('single');
      if (a.sei) on.add('sei');
      if (lensEver('charge') && !a.crowd && formalCharge(w, a) !== 0) on.add('charge');
    }
    if (w.proteins.length) on.add('protein');
  }
  if (lensEver('oxidation')) on.add('ox');
  if (lensEver('attract')) on.add('attract');
  for (const s of tl.steps) {
    for (const ar of s.arrows) on.add(ar.kind === 'pair' ? 'arrow' : 'hook');
    if (s.arrows.some((ar) => ar.kind === 'single')) on.add('half');
    if (s.arrows.length || s.wires.length) on.add('e');
    if (s.focus.size) on.add('focus');
    if (s.trails.length) on.add('trail');
    if (s.photons.length) on.add('photon');
    if (s.energy) on.add('energy');
    if (s.tally.length) on.add('tally');
    if (s.events.length) on.add('spark');
    if (s.bubbles.length) on.add('bubble');
  }
  return on;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Legend panel HTML. With no scene loaded the whole legend is listed. */
export function legendHtml(tl: Timeline | null, lens: Lens): string {
  const on = used(tl, lens);
  const showAll = !tl;
  let html = `<p class="lg-title">범례</p>`;
  const els = new Set<string>();
  if (tl) for (const w of [tl.initial, ...tl.steps.map((s) => s.after)]) for (const a of w.atoms.values()) if (!a.gone) els.add(a.el);
  if (els.size) {
    html += `<p class="lg-group">원소</p><ul class="lg-els">`;
    for (const [sym, e] of Object.entries(ELEMENTS)) {
      if (!els.has(sym)) continue;
      html += `<li><svg class="lg-sw" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle class="atom" cx="11" cy="11" r="9.5" fill="${e.color}"/><text class="sym" x="11" y="11" dy="0.36em" font-size="${sym.length > 1 ? 8 : 9.5}" fill="${e.ink}">${sym}</text></svg><span>${esc(e.name)}</span></li>`;
    }
    html += '</ul>';
  }
  for (const g of GROUPS) {
    const items = g.items.filter((it) => showAll || on.has(it.key));
    const rest = g.items.filter((it) => !showAll && !on.has(it.key));
    html += `<p class="lg-group${items.length ? '' : ' lg-off'}">${esc(g.title)}</p><ul class="lg-list">`;
    for (const it of items) html += `<li>${it.svg}<span>${esc(it.label)}</span></li>`;
    for (const it of rest) html += `<li class="lg-off">${it.svg}<span>${esc(it.label)}</span></li>`;
    html += '</ul>';
  }
  if (!showAll) html += `<button class="lg-more" type="button" aria-pressed="false">전체 범례 보기</button>`;
  return html;
}

/** Start (or stop) the animations in one legend row. */
export function playSwatch(row: Element, on: boolean): void {
  row.querySelectorAll('animate, animateMotion, animateTransform').forEach((a) => {
    const anim = a as SVGAnimationElement;
    try {
      if (on) anim.beginElement();
      else anim.endElement();
    } catch {
      // An animation that has not started cannot be ended; nothing to do.
    }
  });
}
