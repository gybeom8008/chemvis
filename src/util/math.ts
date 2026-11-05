export interface Vec {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (ang: number, r = 1): Vec => ({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
export const rotate = (a: Vec, ang: number): Vec => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
export const smooth = (t: number): number => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
export const deg = (d: number): number => (d * Math.PI) / 180;
export const centroid = (pts: Vec[]): Vec => {
  if (pts.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
};

/** Normalises an angle to [0, 2π). */
export const wrap = (a: number): number => {
  const t = a % (Math.PI * 2);
  return t < 0 ? t + Math.PI * 2 : t;
};

/** Point on a quadratic Bézier curve. */
export const qbez = (p0: Vec, c: Vec, p1: Vec, t: number): Vec => {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
};

export const qbezTangent = (p0: Vec, c: Vec, p1: Vec, t: number): Vec =>
  norm({
    x: 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x),
    y: 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y),
  });

/** Total length of a polyline. */
export const polyLength = (pts: Vec[]): number => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
};

/** Point at arc-length fraction f (0..1) along a polyline. */
export const polyAt = (pts: Vec[], f: number): Vec => {
  if (pts.length === 1) return pts[0];
  const total = polyLength(pts);
  let target = clamp(f, 0, 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (target <= d || i === pts.length - 1) {
      return lerpV(pts[i - 1], pts[i], d < 1e-9 ? 0 : clamp(target / d, 0, 1));
    }
    target -= d;
  }
  return pts[pts.length - 1];
};

/** Closest point on a polyline; returns the point and its arc-length position. */
export const polyNearest = (pts: Vec[], p: Vec): { point: Vec; s: number } => {
  let best = { point: pts[0], s: 0, d: Infinity };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 < 1e-9 ? 0 : clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1);
    const q = lerpV(a, b, t);
    const d = dist(p, q);
    if (d < best.d) best = { point: q, s: acc + Math.sqrt(l2) * t, d };
    acc += Math.sqrt(l2);
  }
  return { point: best.point, s: best.s };
};

/** Polyline section between arc-length positions s0 and s1 (s0 < s1). */
export const polySlice = (pts: Vec[], s0: number, s1: number): Vec[] => {
  const total = polyLength(pts);
  const out: Vec[] = [polyAt(pts, s0 / total)];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += dist(pts[i - 1], pts[i]);
    if (acc > s0 && acc < s1) out.push(pts[i]);
  }
  out.push(polyAt(pts, s1 / total));
  return out;
};
