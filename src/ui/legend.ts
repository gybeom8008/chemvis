/**
 * The legend panel: what each mark on the stage means. Marks the current scene
 * uses come first; the rest can be shown dimmed. Swatches are small SVGs using
 * the renderer's own classes, so they match the stage in both themes.
 */
import { ELEMENTS } from '../chem/elements';
import type { Timeline } from '../engine/timeline';
import { formalCharge, type Lens, type World } from '../engine/world';

interface Item {
  key: string;
  label: string;
  svg: string;
}

const sw = (inner: string, w = 34) => `<svg class="lg-sw" viewBox="0 0 ${w} 22" width="${w}" height="22" aria-hidden="true">${inner}</svg>`;
const wave = () => {
  const pts: string[] = [];
  for (let x = 3; x <= 27; x += 1.5) pts.push(`${x.toFixed(1)},${(11 + Math.sin((x - 3) / 2.2) * 3.5).toFixed(1)}`);
  return pts.join(' ');
};

const ITEMS: { group: string; items: Item[] }[] = [
  {
    group: '결합과 전자',
    items: [
      { key: 'bond1', label: '공유 결합: 두 원자가 전자 2개를 함께 씀', svg: sw('<line class="bond" x1="4" y1="11" x2="30" y2="11"/>') },
      { key: 'bond2', label: '이중 결합: 전자쌍 2개', svg: sw('<line class="bond" x1="4" y1="8" x2="30" y2="8"/><line class="bond" x1="4" y1="14" x2="30" y2="14"/>') },
      {
        key: 'bond3',
        label: '삼중 결합: 전자쌍 3개',
        svg: sw('<line class="bond" x1="4" y1="5.5" x2="30" y2="5.5"/><line class="bond" x1="4" y1="11" x2="30" y2="11"/><line class="bond" x1="4" y1="16.5" x2="30" y2="16.5"/>'),
      },
      { key: 'half', label: '점선 결합: 반응 도중 전자가 1개만 남은 결합', svg: sw('<line class="bond half" x1="4" y1="11" x2="30" y2="11"/>') },
      {
        key: 'dative',
        label: '배위 결합: 화살촉 쪽 원자가 전자쌍을 얻음',
        svg: sw('<line class="bond" x1="4" y1="11" x2="30" y2="11"/><polygon class="dative" points="21,11 13,6.5 13,15.5"/>'),
      },
      { key: 'lp', label: '비공유 전자쌍: 결합에 쓰이지 않은 전자 2개', svg: sw('<circle class="lp" cx="14" cy="11" r="2.3"/><circle class="lp" cx="20" cy="11" r="2.3"/>') },
      { key: 'single', label: '홑전자: 짝이 없는 전자 1개(라디칼)', svg: sw('<circle class="lp single" cx="17" cy="11" r="2.7"/>') },
      { key: 'charge', label: '전하: 중성보다 전자가 적으면 +, 많으면 −', svg: sw('<g class="charge pos"><circle cx="17" cy="11" r="7.5"/><text x="17" y="11" dy="0.36em">+</text></g>') },
      { key: 'ox', label: '산화수: 전자를 잃은(+)·얻은(−) 정도', svg: sw('<text class="ox" x="17" y="11" dy="0.35em">+2</text>') },
    ],
  },
  {
    group: '움직임',
    items: [
      {
        key: 'arrow',
        label: '굽은 화살표: 전자쌍이 꼬리에서 머리 쪽으로 옮겨 감',
        svg: sw('<g class="arrow"><path d="M4,17 Q15,0 25,12"/><polygon points="29,16 21.5,14 26.5,8.5"/></g>'),
      },
      {
        key: 'hook',
        label: '반쪽 화살표: 전자 1개가 옮겨 감',
        svg: sw('<g class="arrow"><path d="M4,17 Q15,0 25,12"/><polygon points="29,16 21.5,14 25,11"/></g>'),
      },
      { key: 'e', label: '전자(움직이는 중)', svg: sw('<circle class="e" cx="13" cy="11" r="3"/><circle class="e" cx="21" cy="11" r="3"/>') },
      { key: 'focus', label: '주황 고리: 이번 단계에서 움직이는 것', svg: sw('<circle class="focus" cx="17" cy="11" r="7.5"/>') },
      { key: 'trail', label: '회색 점선: 입자가 지나간 경로', svg: sw('<polyline class="trail" points="3,15 9,7 15,13 22,6 31,10"/>') },
      { key: 'attract', label: '파란 점선: 분자 사이 인력(수소 결합 등)', svg: sw('<line class="attract" x1="4" y1="11" x2="30" y2="11"/>') },
      { key: 'photon', label: '물결선: 빛(hν)', svg: sw(`<g class="photon"><polyline points="${wave()}"/><polygon points="31,11 26,8 26,14"/></g>`) },
      { key: 'crowd', label: '흐린 분자: 배경의 용매(물 등)', svg: sw('<circle class="atom crowd" cx="17" cy="11" r="7.5" fill="#e03131" opacity="0.5"/>') },
    ],
  },
  {
    group: '그래프와 그 밖의 표시',
    items: [
      { key: 'energy', label: '에너지 그래프: 단계마다 에너지가 오르내림', svg: sw('<polyline class="lg-line" points="3,7 10,7 15,3 21,16 31,16"/>') },
      {
        key: 'tally',
        label: '분자 수 그래프: 종류별 분자 개수',
        svg: sw('<polyline class="lg-line s2" points="3,17 12,10 20,7 31,7"/><polyline class="lg-line s0" points="3,5 12,11 20,14 31,14"/>'),
      },
      { key: 'spark', label: '번지는 고리: 방금 반응이 일어난 곳', svg: sw('<circle class="spark" cx="17" cy="11" r="7.5"/>') },
      { key: 'sei', label: '갈색 막: 전지 흑연 표면의 SEI 막', svg: sw('<circle class="sei" cx="17" cy="11" r="9"/>') },
      { key: 'protein', label: '막 단백질: 통로·펌프·ATP 합성 효소', svg: sw('<rect class="protein" x="9" y="2" width="16" height="18" rx="5"/>') },
      { key: 'bubble', label: '기포: 액체 속에서 생긴 기체', svg: sw('<circle class="bubble" cx="17" cy="11" r="7.5"/>') },
    ],
  },
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

/** Legend panel HTML. With no scene loaded every mark is listed. */
export function legendHtml(tl: Timeline | null, lens: Lens): string {
  const on = used(tl, lens);
  const showAll = !tl;
  let html = '';
  // Elements in the scene, in table order.
  const els = new Set<string>();
  if (tl) for (const w of [tl.initial, ...tl.steps.map((s) => s.after)]) for (const a of w.atoms.values()) if (!a.gone) els.add(a.el);
  if (els.size) {
    html += `<p class="lg-group">원소(공의 색)</p><ul class="lg-els">`;
    for (const [sym, e] of Object.entries(ELEMENTS)) {
      if (!els.has(sym)) continue;
      html += `<li><svg class="lg-sw" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle class="atom" cx="11" cy="11" r="9.5" fill="${e.color}"/><text class="sym" x="11" y="11" dy="0.36em" font-size="${sym.length > 1 ? 8 : 9.5}" fill="${e.ink}">${sym}</text></svg><span>${esc(e.name)}</span></li>`;
    }
    html += '</ul>';
  }
  for (const g of ITEMS) {
    const items = g.items.filter((it) => showAll || on.has(it.key));
    const rest = g.items.filter((it) => !showAll && !on.has(it.key));
    if (!items.length && !rest.length) continue;
    html += `<p class="lg-group${items.length ? '' : ' lg-off'}">${esc(g.group)}</p><ul class="lg-list">`;
    for (const it of items) html += `<li>${it.svg}<span>${esc(it.label)}</span></li>`;
    for (const it of rest) html += `<li class="lg-off">${it.svg}<span>${esc(it.label)}</span></li>`;
    html += '</ul>';
  }
  if (!showAll) html += `<button class="lg-more" type="button" aria-pressed="false">이 장면에 없는 기호도 보기</button>`;
  return html;
}
