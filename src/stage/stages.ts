/**
 * Stage templates: where a scene happens. Each stage has named regions the
 * script can point at ("in water", "to subsoil"), a static background, and
 * for some stages extra structure (water surface, soil pores, clay sites).
 */
import { Rng } from '../util/rng';
import { add, dist, norm, perp, polyAt, polyLength, polyNearest, scale, sub, type Vec } from '../util/math';

export interface Region {
  name: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Plate {
  center: Vec;
  angle: number;
  length: number;
  region: string;
}

export interface SiteDef {
  x: number;
  y: number;
  nx: number;
  ny: number;
  region: string;
  plate: number;
}

export interface ElectrodeDef {
  /** Centre line of the metal plate. */
  x: number;
  top: number;
  bottom: number;
  /** The beaker (region) it stands in. */
  region: string;
  /** Which way the plate's working face looks (+1 right, −1 left). */
  face: number;
}

export interface StageDef {
  name: string;
  label: string;
  width: number;
  height: number;
  regions: Record<string, Region>;
  defaultRegion: string;
  /** Regions filled with liquid water. */
  liquid: string[];
  surfaceY?: number;
  /** Electrode stage: plates, the wire between them, and the salt-bridge mouths. */
  electrodes?: Record<string, ElectrodeDef>;
  wire?: Vec[];
  bridge?: { left: Vec; right: Vec };
  /** Lithium-ion battery: where lithium can sit in each electrode, and the faces toward the electrolyte. */
  battery?: { anodeFace: number; cathodeFace: number; separatorX: number; top: number; bottom: number };
  /** Membrane stage: the bilayer band (molecules may only cross it through proteins or on purpose). */
  membrane?: { y0: number; y1: number; outside: string; inside: string };
  /** Pore channels (soil), top to bottom. */
  channels?: Vec[][];
  plates?: Plate[];
  sites?: SiteDef[];
  grains?: { pts: Vec[]; region: string }[];
  attractDefault: boolean;
  background: () => string;
}

export const inRegion = (r: Region, p: Vec, margin = 0): boolean =>
  p.x >= r.x + margin && p.x <= r.x + r.w - margin && p.y >= r.y + margin && p.y <= r.y + r.h - margin;

export const regionCenter = (r: Region): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function randomInRegion(r: Region, rng: Rng, margin = 30): Vec {
  return { x: rng.range(r.x + margin, r.x + r.w - margin), y: rng.range(r.y + margin, r.y + r.h - margin) };
}

const rect = (name: string, label: string, x: number, y: number, w: number, h: number): Region => ({
  name,
  label,
  x,
  y,
  w,
  h,
});

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function smoothPath(pts: Vec[], closed: boolean): string {
  // Catmull-Rom to cubic Bézier.
  const n = pts.length;
  const P = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return closed ? d + ' Z' : d;
}

// ---------------------------------------------------------------- solution

function solution(): StageDef {
  const W = 1000;
  const H = 620;
  const regions: Record<string, Region> = {
    water: rect('water', '물 전체', 20, 20, 960, 580),
    left: rect('left', '왼쪽', 20, 20, 320, 580),
    center: rect('center', '가운데', 340, 20, 320, 580),
    right: rect('right', '오른쪽', 660, 20, 320, 580),
    top: rect('top', '위쪽', 20, 20, 960, 200),
    bottom: rect('bottom', '아래쪽', 20, 400, 960, 200),
  };
  return {
    name: 'solution',
    label: '용액',
    width: W,
    height: H,
    regions,
    defaultRegion: 'water',
    liquid: ['water', 'left', 'center', 'right', 'top', 'bottom'],
    attractDefault: false,
    background: () =>
      `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="18" class="bg-water"/>` +
      `<text x="30" y="46" class="bg-label">물(용액)</text>`,
  };
}

// ---------------------------------------------------------------- interface

function iface(): StageDef {
  const W = 1000;
  const H = 620;
  const S = 250;
  const regions: Record<string, Region> = {
    air: rect('air', '공기', 20, 20, 960, S - 40),
    water: rect('water', '물', 20, S + 14, 960, H - S - 34),
    surface: rect('surface', '수면', 20, S - 30, 960, 60),
  };
  let wave = `M8,${S}`;
  for (let x = 8; x <= W - 8; x += 20) wave += ` L${x},${(S + Math.sin(x / 37) * 3).toFixed(1)}`;
  return {
    name: 'interface',
    label: '수면(기체와 액체의 경계)',
    width: W,
    height: H,
    regions,
    defaultRegion: 'water',
    liquid: ['water'],
    surfaceY: S,
    attractDefault: true,
    background: () =>
      `<rect x="8" y="8" width="${W - 16}" height="${S - 8}" rx="18" class="bg-air"/>` +
      `<rect x="8" y="${S}" width="${W - 16}" height="${H - S - 8}" rx="18" class="bg-water"/>` +
      `<path d="${wave}" class="bg-surface"/>` +
      `<text x="30" y="46" class="bg-label">공기</text>` +
      `<text x="30" y="${S + 36}" class="bg-label">물(액체)</text>`,
  };
}

// ---------------------------------------------------------------- soil

const SOIL_W = 1200;
const SOIL_H = 900;
const CHANNELS: Vec[][] = [
  [
    { x: 250, y: 0 },
    { x: 250, y: 100 },
    { x: 225, y: 210 },
    { x: 285, y: 330 },
    { x: 240, y: 480 },
    { x: 300, y: 620 },
    { x: 255, y: 790 },
    { x: 265, y: 900 },
  ],
  [
    { x: 600, y: 0 },
    { x: 600, y: 100 },
    { x: 645, y: 225 },
    { x: 580, y: 360 },
    { x: 625, y: 480 },
    { x: 570, y: 640 },
    { x: 615, y: 790 },
    { x: 600, y: 900 },
  ],
  [
    { x: 950, y: 0 },
    { x: 950, y: 100 },
    { x: 920, y: 230 },
    { x: 980, y: 370 },
    { x: 940, y: 480 },
    { x: 990, y: 650 },
    { x: 950, y: 790 },
    { x: 960, y: 900 },
  ],
];

function soilRegionOf(y: number): string {
  if (y < 100) return 'air';
  if (y < 480) return 'topsoil';
  if (y < 800) return 'subsoil';
  return 'groundwater';
}

function soil(): StageDef {
  const regions: Record<string, Region> = {
    air: rect('air', '공기', 0, 0, SOIL_W, 100),
    topsoil: rect('topsoil', '겉흙', 0, 100, SOIL_W, 380),
    subsoil: rect('subsoil', '속흙', 0, 480, SOIL_W, 320),
    groundwater: rect('groundwater', '지하수', 0, 800, SOIL_W, 100),
  };

  // Clay plates sit on the pore walls; their negative sites face the pore.
  const plates: Plate[] = [];
  const sites: SiteDef[] = [];
  const placements: [number, number, number][] = [
    // channel, arc fraction, side (+1 right wall, -1 left wall)
    [0, 0.2, 1],
    [0, 0.36, -1],
    [0, 0.68, 1],
    [1, 0.18, -1],
    [1, 0.34, 1],
    [1, 0.7, -1],
    [2, 0.22, 1],
    [2, 0.38, -1],
    [2, 0.66, 1],
  ];
  for (const [ci, f, side] of placements) {
    const ch = CHANNELS[ci];
    const p = polyAt(ch, f);
    const p2 = polyAt(ch, Math.min(1, f + 0.01));
    const t = norm(sub(p2, p));
    const n = scale(perp(t), side);
    const center = add(p, scale(n, 58));
    const plateIndex = plates.length;
    const region = soilRegionOf(center.y);
    plates.push({ center, angle: Math.atan2(t.y, t.x), length: 150, region });
    const inward = scale(n, -1);
    for (const off of [-54, -18, 18, 54]) {
      const sp = add(add(center, scale(t, off)), scale(inward, 7));
      sites.push({ x: sp.x, y: sp.y, nx: inward.x, ny: inward.y, region, plate: plateIndex });
    }
  }

  // Sand and silt grains fill the space away from the pores.
  const rng = new Rng('soil-grains');
  const grains: { pts: Vec[]; region: string }[] = [];
  const centers: { c: Vec; r: number }[] = [];
  for (let gy = 140; gy < SOIL_H + 40; gy += 92) {
    for (let gx = 30; gx < SOIL_W + 40; gx += 104) {
      const c = { x: gx + rng.range(-26, 26), y: gy + rng.range(-22, 22) };
      let dCh = Infinity;
      for (const ch of CHANNELS) dCh = Math.min(dCh, dist(c, polyNearest(ch, c).point));
      for (const pl of plates) dCh = Math.min(dCh, dist(c, pl.center) - 20);
      let r = Math.min(58, dCh - 68);
      for (const o of centers) r = Math.min(r, dist(c, o.c) - o.r - 8);
      if (c.y - r < 112) r = Math.min(r, c.y - 112);
      if (r < 22) continue;
      centers.push({ c, r });
      const pts: Vec[] = [];
      const k = 11;
      for (let i = 0; i < k; i++) {
        const a = (2 * Math.PI * i) / k;
        const rr = r * rng.range(0.84, 1.08);
        pts.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * rng.range(0.85, 1) });
      }
      grains.push({ pts, region: soilRegionOf(c.y) });
    }
  }

  const background = () => {
    let s = '';
    s += `<rect x="0" y="0" width="${SOIL_W}" height="100" class="bg-air"/>`;
    s += `<rect x="0" y="100" width="${SOIL_W}" height="380" class="bg-topsoil"/>`;
    s += `<rect x="0" y="480" width="${SOIL_W}" height="320" class="bg-subsoil"/>`;
    s += `<rect x="0" y="800" width="${SOIL_W}" height="100" class="bg-groundwater"/>`;
    for (const g of grains) {
      s += `<path d="${smoothPath(g.pts, true)}" class="grain grain-${g.region}"/>`;
    }
    plates.forEach((pl) => {
      const deg = (pl.angle * 180) / Math.PI;
      s += `<g transform="translate(${pl.center.x.toFixed(1)},${pl.center.y.toFixed(1)}) rotate(${deg.toFixed(1)})">`;
      s += `<rect x="${-pl.length / 2}" y="-7" width="${pl.length}" height="14" rx="5" class="clay"/>`;
      s += `</g>`;
    });
    for (const st of sites) {
      s += `<g class="site" transform="translate(${st.x.toFixed(1)},${st.y.toFixed(1)})"><circle r="5.5"/><text y="3.6">−</text></g>`;
    }
    for (const y of [100, 480, 800]) s += `<line x1="0" x2="${SOIL_W}" y1="${y}" y2="${y}" class="layer-line"/>`;
    const labels: [number, string][] = [
      [60, '공기'],
      [140, '겉흙'],
      [520, '속흙'],
      [840, '지하수(물로 꽉 찬 층)'],
    ];
    for (const [y, t] of labels) {
      const w = [...t].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x1100 ? 19 : 11), 0) + 16;
      s += `<rect x="6" y="${y - 22}" width="${w}" height="30" rx="8" class="bg-pill"/>`;
      s += `<text x="14" y="${y}" class="bg-label">${esc(t)}</text>`;
    }
    return s;
  };

  return {
    name: 'soil',
    label: '토양 단면',
    width: SOIL_W,
    height: SOIL_H,
    regions,
    defaultRegion: 'topsoil',
    liquid: ['groundwater'],
    channels: CHANNELS,
    plates,
    sites,
    grains,
    attractDefault: false,
    background,
  };
}

// ---------------------------------------------------------------- gas

function gas(): StageDef {
  const W = 1000;
  const H = 620;
  const regions: Record<string, Region> = {
    air: rect('air', '기체 전체', 20, 20, 960, 580),
    left: rect('left', '왼쪽', 20, 20, 320, 580),
    center: rect('center', '가운데', 340, 20, 320, 580),
    right: rect('right', '오른쪽', 660, 20, 320, 580),
    top: rect('top', '위쪽', 20, 20, 960, 200),
    bottom: rect('bottom', '아래쪽', 20, 400, 960, 200),
  };
  return {
    name: 'gas',
    label: '기체',
    width: W,
    height: H,
    regions,
    defaultRegion: 'air',
    liquid: [],
    attractDefault: false,
    background: () =>
      `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="18" class="bg-air"/>` +
      `<text x="30" y="46" class="bg-label">기체</text>`,
  };
}

// ---------------------------------------------------------------- electrochemical cell

function cell(): StageDef {
  const W = 1200;
  const H = 760;
  const LIQ = 300;
  const regions: Record<string, Region> = {
    left: rect('left', '왼쪽 용액', 74, LIQ + 14, 452, 392),
    right: rect('right', '오른쪽 용액', 674, LIQ + 14, 452, 392),
    top: rect('top', '위쪽', 0, 0, W, 240),
  };
  const electrodes: Record<string, ElectrodeDef> = {
    left: { x: 230, top: 168, bottom: 560, region: 'left', face: 1 },
    right: { x: 970, top: 168, bottom: 560, region: 'right', face: -1 },
  };
  const wire: Vec[] = [
    { x: 230, y: 168 },
    { x: 230, y: 70 },
    { x: 970, y: 70 },
    { x: 970, y: 168 },
  ];
  const bridge = { left: { x: 470, y: 470 }, right: { x: 730, y: 470 } };
  const background = () => {
    let s = '';
    for (const x0 of [60, 660]) {
      s += `<rect x="${x0 + 4}" y="${LIQ}" width="472" height="${720 - LIQ}" rx="10" class="bg-water"/>`;
      s += `<path d="M${x0},230 L${x0},712 Q${x0},724 ${x0 + 12},724 L${x0 + 468},724 Q${x0 + 480},724 ${x0 + 480},712 L${x0 + 480},230" class="beaker"/>`;
      s += `<line x1="${x0 + 4}" x2="${x0 + 476}" y1="${LIQ}" y2="${LIQ}" class="bg-surface"/>`;
    }
    // Salt bridge: an inverted U tube filled with salt solution.
    s += `<path d="M470,${bridge.left.y} L470,150 Q470,120 500,120 L700,120 Q730,120 730,150 L730,${bridge.right.y}" class="bridge"/>`;
    s += `<text x="600" y="166" class="bg-note" text-anchor="middle">염다리</text>`;
    // Wire with a bulb in the middle.
    s += `<polyline points="${wire.map((p) => `${p.x},${p.y}`).join(' ')}" class="wire"/>`;
    s += `<circle cx="600" cy="70" r="20" class="bulb"/><path d="M590,76 q5,-14 10,0 q5,-14 10,0" class="filament"/>`;
    // Plate backings (the metal atoms are drawn on top as atoms).
    for (const e of Object.values(electrodes)) {
      s += `<rect x="${e.x - 34}" y="${e.top}" width="68" height="${e.bottom - e.top + 24}" rx="6" class="plate"/>`;
    }
    s += `<text x="300" y="750" class="bg-label" text-anchor="middle">(−) 산화 전극</text>`;
    s += `<text x="900" y="750" class="bg-label" text-anchor="middle">(+) 환원 전극</text>`;
    return s;
  };
  return {
    name: 'cell',
    label: '전지(두 전극)',
    width: W,
    height: H,
    regions,
    defaultRegion: 'left',
    liquid: ['left', 'right'],
    electrodes,
    wire,
    bridge,
    attractDefault: false,
    background,
  };
}

// ---------------------------------------------------------------- cell membrane

function membrane(names = { top: '바깥(세포 밖)', bottom: '안쪽(세포 안)', name: 'membrane', label: '세포막' }): StageDef {
  const W = 1000;
  const H = 640;
  const Y0 = 272;
  const Y1 = 368;
  const regions: Record<string, Region> = {
    outside: rect('outside', names.top, 20, 20, 960, Y0 - 44),
    inside: rect('inside', names.bottom, 20, Y1 + 24, 960, H - Y1 - 44),
    membrane: rect('membrane', names.label, 20, Y0, 960, Y1 - Y0),
  };
  const background = () => {
    let s = `<rect x="8" y="8" width="${W - 16}" height="${Y0 - 4}" rx="18" class="bg-water"/>`;
    s += `<rect x="8" y="${Y1 + 4}" width="${W - 16}" height="${H - Y1 - 12}" rx="18" class="bg-water inner"/>`;
    // Phospholipid bilayer: heads on both faces, two tails each pointing to the middle.
    for (let x = 18; x <= W - 18; x += 21) {
      for (const [hy, dir] of [
        [Y0 + 10, 1],
        [Y1 - 10, -1],
      ] as const) {
        const t0 = hy + dir * 9;
        s += `<path d="M${x - 3},${t0} q-3,${dir * 8} 0,${dir * 16} t0,${dir * 15}" class="tail"/>`;
        s += `<path d="M${x + 3},${t0} q3,${dir * 8} 0,${dir * 16} t0,${dir * 15}" class="tail"/>`;
        s += `<circle cx="${x}" cy="${hy}" r="8.5" class="head"/>`;
      }
    }
    s += `<text x="30" y="46" class="bg-label">${names.top}</text>`;
    s += `<text x="30" y="${H - 26}" class="bg-label">${names.bottom}</text>`;
    return s;
  };
  return {
    name: names.name,
    label: names.label,
    width: W,
    height: H,
    regions,
    defaultRegion: 'outside',
    liquid: ['outside', 'inside'],
    membrane: { y0: Y0, y1: Y1, outside: 'outside', inside: 'inside' },
    attractDefault: false,
    background,
  };
}

// ---------------------------------------------------------------- lithium-ion battery

function battery(): StageDef {
  const W = 1200;
  const H = 720;
  const TOP = 180;
  const BOT = 600;
  const AX0 = 74;
  const AX1 = 400;
  const CX0 = 800;
  const CX1 = 1126;
  const SEP = 600;
  // Six sheets in each electrode; lithium sits in the five gaps between them.
  const sheetYs = [0, 1, 2, 3, 4, 5].map((i) => TOP + 26 + i * 74);
  const gapYs = sheetYs.slice(0, 5).map((y) => y + 37);
  const sites: SiteDef[] = [];
  for (const [region, x0, x1] of [
    ['anode', AX0, AX1],
    ['cathode', CX0, CX1],
  ] as const) {
    gapYs.forEach((y, row) => {
      for (let i = 0; i < 5; i++) sites.push({ x: x0 + 42 + i * ((x1 - x0 - 84) / 4), y, nx: 0, ny: 0, region, plate: row });
    });
  }
  const regions: Record<string, Region> = {
    anode: rect('anode', '음극(흑연)', AX0, TOP, AX1 - AX0, BOT - TOP),
    cathode: rect('cathode', '양극(금속 산화물)', CX0, TOP, CX1 - CX0, BOT - TOP),
    electrolyte: rect('electrolyte', '전해질', AX1 + 12, TOP, CX0 - AX1 - 24, BOT - TOP),
    left: rect('left', '전해질 왼쪽', AX1 + 12, TOP, SEP - AX1 - 22, BOT - TOP),
    right: rect('right', '전해질 오른쪽', SEP + 10, TOP, CX0 - SEP - 22, BOT - TOP),
    top: rect('top', '위쪽', 0, 0, W, TOP - 20),
  };
  const wire: Vec[] = [
    { x: 64, y: TOP },
    { x: 64, y: 80 },
    { x: 1136, y: 80 },
    { x: 1136, y: TOP },
  ];
  const background = () => {
    let s = `<rect x="${AX0 - 14}" y="${TOP - 10}" width="${CX1 - AX0 + 28}" height="${BOT - TOP + 20}" rx="14" class="bg-electrolyte"/>`;
    // Separator: a porous sheet that lets ions through but keeps the electrodes apart.
    s += `<line x1="${SEP}" y1="${TOP - 4}" x2="${SEP}" y2="${BOT + 4}" class="separator"/>`;
    // Current collectors (copper under the graphite, aluminium under the oxide).
    s += `<rect x="${AX0 - 14}" y="${TOP - 10}" width="12" height="${BOT - TOP + 20}" rx="4" class="foil cu"/>`;
    s += `<rect x="${CX1 + 2}" y="${TOP - 10}" width="12" height="${BOT - TOP + 20}" rx="4" class="foil al"/>`;
    // Graphite: stacked carbon sheets, drawn edge-on as zigzags.
    for (const y of sheetYs) {
      let d = `M${AX0},${y}`;
      for (let x = AX0, k = 0; x <= AX1; x += 13, k++) d += ` L${x},${y + (k % 2 ? 4 : -4)}`;
      s += `<path d="${d}" class="graphene"/>`;
    }
    // Layered oxide: sheets of metal–oxygen octahedra, drawn edge-on as diamonds.
    for (const y of sheetYs) {
      for (let x = CX0 + 10; x <= CX1 - 10; x += 26) s += `<path d="M${x - 12},${y} L${x},${y - 10} L${x + 12},${y} L${x},${y + 10} Z" class="oxide"/>`;
    }
    s += `<polyline points="${wire.map((p) => `${p.x},${p.y}`).join(' ')}" class="wire"/>`;
    s += `<rect x="${SEP - 70}" y="58" width="140" height="44" rx="10" class="device"/>`;
    s += `<text x="${SEP}" y="86" class="bg-note" text-anchor="middle">충전기 / 기기</text>`;
    s += `<text x="${(AX0 + AX1) / 2}" y="${BOT + 48}" class="bg-label" text-anchor="middle">(−) 흑연</text>`;
    s += `<text x="${(CX0 + CX1) / 2}" y="${BOT + 48}" class="bg-label" text-anchor="middle">(+) 금속 산화물</text>`;
    s += `<text x="${SEP}" y="${BOT + 48}" class="bg-label" text-anchor="middle">분리막</text>`;
    s += `<text x="${(AX1 + SEP) / 2}" y="${TOP + 24}" class="bg-note" text-anchor="middle">전해질</text>`;
    s += `<text x="${(SEP + CX0) / 2}" y="${TOP + 24}" class="bg-note" text-anchor="middle">전해질</text>`;
    return s;
  };
  return {
    name: 'battery',
    label: '리튬 이온 전지',
    width: W,
    height: H,
    regions,
    defaultRegion: 'electrolyte',
    liquid: [],
    wire,
    sites,
    battery: { anodeFace: AX1, cathodeFace: CX0, separatorX: SEP, top: TOP, bottom: BOT },
    attractDefault: false,
    background,
  };
}

/** A root hair: soil water with a clay particle above, the root cell below its membrane. */
function root(): StageDef {
  const st = membrane({ top: '흙 속 물', bottom: '뿌리털 세포 안', name: 'root', label: '뿌리털 세포막' });
  const center = { x: 500, y: 96 };
  const length = 340;
  st.plates = [{ center, angle: 0, length, region: 'outside' }];
  // Negative sites on the clay's underside, facing the water and the root.
  st.sites = [-125, -75, -25, 25, 75, 125].map((off) => ({ x: center.x + off, y: center.y + 7, nx: 0, ny: 1, region: 'outside', plate: 0 }));
  const base = st.background;
  st.background = () => {
    let s = base();
    s += `<rect x="${center.x - length / 2}" y="${center.y - 9}" width="${length}" height="18" rx="6" class="clay"/>`;
    s += `<text x="${center.x + length / 2 + 14}" y="${center.y + 6}" class="bg-note">점토 알갱이</text>`;
    for (const x of st.sites!) s += `<g class="site" transform="translate(${x.x},${x.y})"><circle r="5.5"/><text y="3.6">−</text></g>`;
    return s;
  };
  return st;
}

/** Mitochondrial inner membrane: the same band, between the intermembrane space and the matrix. */
const mito = () => membrane({ top: '막 사이 공간', bottom: '기질(미토콘드리아 안쪽)', name: 'mito', label: '미토콘드리아 내막' });

export const STAGES: Record<string, () => StageDef> = {
  solution,
  interface: iface,
  soil,
  gas,
  cell,
  membrane: () => membrane(),
  mito,
  root,
  battery,
};

export function getStage(name: string): StageDef | undefined {
  const f = STAGES[name];
  return f ? f() : undefined;
}

/** Arc-length position along a channel where it first enters a y-range. */
export function channelArcAtY(ch: Vec[], y: number): number {
  let acc = 0;
  for (let i = 1; i < ch.length; i++) {
    const a = ch[i - 1];
    const b = ch[i];
    const d = dist(a, b);
    if ((a.y <= y && b.y >= y) || (a.y >= y && b.y <= y)) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return acc + d * t;
    }
    acc += d;
  }
  return polyLength(ch);
}
