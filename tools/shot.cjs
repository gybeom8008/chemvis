// Captures chosen moments of a scene from the compare page and puts them side by side in one image,
// so that a change to the drawing can be looked at frame by frame. Thermal motion is off (?still):
// this shows what a moment looks like, not whether marks hop (for that: npm run flicker).
//
//   npm run build && npx vite preview --port 4173
//   node tools/shot.cjs out.png acid 1:0.1,1:0.4,1:0.7,1:1        a scene of the compare page (its button id)
//   node tools/shot.cjs out.png my-scene.txt 0:1,1:0.5,1:1 3      any script file; last number = columns
//
// Each moment is step:time (time 0..1 within the step). SIDE=old|new (default new), BASE=<compare page url>.
const { chromium } = require('playwright');
const fs = require('fs');
const [outPng, what, spec, colsArg] = process.argv.slice(2);
if (!outPng || !what || !spec) {
  console.log('usage: node tools/shot.cjs <out.png> <scene id | script file> <step:time,...> [columns]');
  process.exit(2);
}
const base = process.env.BASE || 'http://localhost:4173/concept/';
const side = process.env.SIDE || 'new';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  const isFile = fs.existsSync(what);
  await page.goto(`${base}?still#${isFile ? 'acid' : what}`);
  await page.waitForTimeout(600);
  if (isFile) await page.evaluate((src) => window.cmp.script(src), fs.readFileSync(what, 'utf8'));
  const moments = spec.split(',');
  const shots = [];
  for (const m of moments) {
    const [k, t] = m.split(':').map(Number);
    // Twice: the first call lays the scene out, the second draws it settled.
    for (let i = 0; i < 2; i++) {
      await page.evaluate(([k, t]) => window.cmp.seek(k, t), [k, t]);
      await page.waitForTimeout(80);
    }
    shots.push((await page.locator(`#${side}`).screenshot()).toString('base64'));
  }
  const cols = +(colsArg || Math.min(4, shots.length));
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await sheet.setContent(
    `<body style="margin:0;background:#333"><div id="g" style="display:grid;grid-template-columns:repeat(${cols},auto);gap:4px;width:max-content">` +
      shots.map((b, i) => `<div style="position:relative"><img src="data:image/png;base64,${b}" style="display:block;width:520px"><span style="position:absolute;left:6px;top:4px;font:12px sans-serif;background:#fffc;padding:0 4px">${moments[i]}</span></div>`).join('') +
      '</div></body>',
  );
  await sheet.waitForTimeout(200);
  await sheet.locator('#g').screenshot({ path: outPng });
  await browser.close();
  console.log('wrote', outPng);
})();
