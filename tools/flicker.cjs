// Plays scenes of the compare page at real speed (thermal motion on) and reports marks that hop.
//
// Lone electron pouches, their electrons and charge badges carry the id of their atom (data-a).
// Each frame, the direction of every such mark as seen from its atom is compared with the frame
// before. While their number stays the same they may only turn slowly with the molecule; a mark
// whose direction changes by more than LIMIT degrees in one frame has hopped.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/flicker.cjs [base url] [scene:steps ...]      e.g.  node tools/flicker.cjs http://localhost:4173/concept/ acid:0,1,2
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args[0] && args[0].startsWith('http') ? args.shift() : 'http://localhost:4173/concept/';
const jobs = args.length ? args : ['acid:0,1,2', 'base:0,1', 'neutral:1,2', 'subst:1,2', 'add:1,2,4', 'cond:1,2,4', 'coord:1,2', 'redox:1,2,3', 'radical:0,1,2', 'cell:1,2,3', 'solid:1,2,3', 'metal:1,2,3'];
const LIMIT = 14;
// Which stage of the compare page to measure: the new drawing style (right) by default; SIDES=old,new measures both.
const SIDES = (process.env.SIDES || 'new').split(',');
(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const job of jobs) {
    const [scene, stepList] = job.split(':');
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto(`${base}#${scene}`);
    await page.waitForTimeout(900);
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    let cur = 0;
    const line = [];
    for (const k of stepList.split(',').map(Number)) {
      while (cur < k) { await page.keyboard.press('ArrowRight'); cur++; await page.waitForTimeout(40); }
      if (k === 0) await page.keyboard.press('r');
      for (const side of SIDES) {
      if (side !== SIDES[0]) { await page.keyboard.press('r'); await page.waitForTimeout(30); }
      const frames = await page.evaluate(async (side) => {
        const svg = document.querySelector(`#${side} svg.stage`);
        const out = [];
        const t0 = performance.now();
        await new Promise((done) => {
          const tick = () => {
            const atoms = {};
            for (const c of svg.querySelectorAll('circle.atom[data-id]')) atoms[c.dataset.id] = [+c.getAttribute('cx'), +c.getAttribute('cy')];
            const marks = [];
            const push = (kind, el, x, y) => { const a = atoms[el.dataset.a]; if (a) marks.push([kind, el.dataset.a, Math.atan2(y - a[1], x - a[0]) * 180 / Math.PI]); };
            for (const el of svg.querySelectorAll('.pe[data-a], .lp[data-a]')) push('electron', el, +el.getAttribute('cx'), +el.getAttribute('cy'));
            for (const el of svg.querySelectorAll('.pouch[data-a]')) push('pouch', el, +el.getAttribute('x2'), +el.getAttribute('y2'));
            for (const el of svg.querySelectorAll('.charge[data-a]')) { const c = el.querySelector('circle'); push('charge', el, +c.getAttribute('cx'), +c.getAttribute('cy')); }
            out.push({ t: Math.round(performance.now() - t0), marks });
            if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else done();
          };
          requestAnimationFrame(tick);
        });
        return out;
      }, side);
      const group = (f) => { const m = new Map(); for (const [kind, a, ang] of f.marks) { const key = kind + ' ' + a; (m.get(key) ?? m.set(key, []).get(key)).push(ang); } return m; };
      const diff = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
      const hops = new Map();
      for (let i = 1; i < frames.length; i++) {
        const A = group(frames[i - 1]);
        const B = group(frames[i]);
        for (const [key, angs] of B) {
          const was = A.get(key);
          if (!was || was.length !== angs.length) continue; // appeared, vanished or changed in number: a change of state, not a hop
          for (const x of angs) if (Math.min(...was.map((y) => diff(x, y))) > LIMIT) { const h = hops.get(key) ?? []; h.push(frames[i].t); hops.set(key, h); }
        }
      }
      let n = 0;
      const detail = [];
      for (const [key, ts] of hops) { n += ts.length; detail.push(`${key} ×${ts.length} (${ts[0]}–${ts[ts.length - 1]}ms)`); }
      total += n;
      line.push(`step ${k}${SIDES.length > 1 ? ' ' + side : ''}: ${n ? detail.join('; ') : 'steady'}`);
      }
    }
    console.log(`${scene}  ` + line.join('  |  '));
    await page.close();
  }
  await browser.close();
  console.log(total ? `\n${total} hops` : '\nno hops');
  process.exit(total ? 1 : 0);
})();
