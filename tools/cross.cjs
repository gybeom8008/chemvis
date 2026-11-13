// Goes through scenes of the compare page moment by moment and reports where an electron pair is
// drawn across something it has nothing to do with, or is stretched far beyond a bond's length.
//
// A pouch (an electron pair) is a thick line. In every moment of every step this checks:
//   - atom:  the pouch runs through an atom that is at neither of its ends
//   - pouch: the pouch crosses another pouch that shares no atom with it
//   - long:  the pouch is longer than LONG (a bond's pouch is about 20 to 30 long)
// Thermal motion is off, so the same script always gives the same report.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/cross.cjs [base url] [scene ...]        e.g.  node tools/cross.cjs cond subst
//   VERBOSE=1 lists every moment, not just the count and the first one.
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args[0] && args[0].startsWith('http') ? args.shift() : 'http://localhost:4173/concept/';
const scenes = args.length ? args : ['acid', 'base', 'neutral', 'subst', 'add', 'cond', 'redox', 'coord', 'radical', 'solid', 'metal'];
const LONG = +(process.env.LONG || 48);
const side = process.env.SIDE || 'new';
(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const scene of scenes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto(`${base}?still#${scene}`);
    await page.waitForTimeout(700);
    const found = await page.evaluate(
      ([side, LONG]) => {
        const svg = document.querySelector(`#${side} svg.stage`);
        const out = [];
        const segDist = (p, a, b) => {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l2 = dx * dx + dy * dy;
          const u = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
          return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
        };
        const cross = (a, b, c, d) => {
          const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
          return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
        };
        const steps = window.cmp.steps ? window.cmp.steps() : 6;
        for (let k = 0; k < steps; k++) {
          for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            try {
              window.cmp.seek(k, t);
            } catch (e) {
              break;
            }
            const atoms = [...svg.querySelectorAll('circle.atom[data-id]')].map((c) => ({ id: c.dataset.id, x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r'), op: +(c.getAttribute('opacity') ?? 1) }));
            const pouches = [...svg.querySelectorAll('line.pouch')]
              .map((l) => ({ a: { x: +l.getAttribute('x1'), y: +l.getAttribute('y1') }, b: { x: +l.getAttribute('x2'), y: +l.getAttribute('y2') }, hot: l.classList.contains('hot'), op: +(l.getAttribute('opacity') ?? 1) }))
              .filter((p) => p.op > 0.25);
            for (const p of pouches) {
              p.len = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
              p.own = atoms.filter((at) => Math.hypot(at.x - p.a.x, at.y - p.a.y) <= at.r + 3 || Math.hypot(at.x - p.b.x, at.y - p.b.y) <= at.r + 3).map((at) => at.id);
            }
            pouches.forEach((p, pi) => {
              if (p.len > LONG) out.push({ k, t, kind: 'long', what: `${p.own.join('~') || '?'} ${p.len.toFixed(0)}` });
              for (const at of atoms) {
                if (p.own.includes(at.id) || at.op < 0.25) continue;
                if (segDist(at, p.a, p.b) < at.r - 2) out.push({ k, t, kind: 'atom', what: `${p.own.join('~') || '?'} over ${at.id}` });
              }
              for (let qi = pi + 1; qi < pouches.length; qi++) {
                const q = pouches[qi];
                if (p.own.some((x) => q.own.includes(x))) continue;
                if (cross(p.a, p.b, q.a, q.b)) out.push({ k, t, kind: 'pouch', what: `${p.own.join('~') || '?'} x ${q.own.join('~') || '?'}` });
              }
            });
          }
        }
        return out;
      },
      [side, LONG],
    );
    await page.close();
    const byStep = new Map();
    for (const f of found) {
      const key = `${f.k} ${f.kind}`;
      if (!byStep.has(key)) byStep.set(key, []);
      byStep.get(key).push(f);
    }
    if (!byStep.size) console.log(`${scene}: clear`);
    for (const [key, list] of byStep) {
      const [k, kind] = key.split(' ');
      const ts = [...new Set(list.map((f) => f.t))];
      console.log(`${scene}  step ${k}  ${kind}: ${ts.length} moments (t ${Math.min(...ts).toFixed(2)}–${Math.max(...ts).toFixed(2)})  e.g. ${[...new Set(list.map((f) => f.what))].slice(0, 3).join(' | ')}`);
      if (process.env.VERBOSE) for (const f of list) console.log(`    t=${f.t.toFixed(2)} ${f.what}`);
      total += ts.length;
    }
  }
  await browser.close();
  console.log(total ? `\n${total} moments to look at` : '\nnothing crosses');
  process.exit(total ? 1 : 0);
})();
