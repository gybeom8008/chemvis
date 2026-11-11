// Captures an example of the app in the new drawing style (?style=pairs), one picture per step, side by side.
// For looking over scenes that are not on the compare page.
//
//   npm run build && npx vite preview --port 4173
//   node tools/shot-app.cjs out.png limestone 6        example id (src/tutorial/examples.ts), number of steps
const { chromium } = require('playwright');
const [out, id, n] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await p.goto(`http://localhost:4173/?style=pairs#/x/${id}`);
  await p.waitForTimeout(1200);
  const shots = [];
  for (let i = 0; i < +n; i++) {
    await p.waitForTimeout(2600);
    shots.push((await p.screenshot()).toString('base64'));
    await p.keyboard.press('ArrowRight');
  }
  const s = await b.newPage({ viewport: { width: 1900, height: 1000 } });
  await s.setContent(`<body style="margin:0;background:#333"><div id="g" style="display:grid;grid-template-columns:repeat(3,auto);gap:4px;width:max-content">${shots.map((x) => `<img src="data:image/png;base64,${x}" style="width:630px;display:block">`).join('')}</div></body>`);
  await s.waitForTimeout(200);
  await s.locator('#g').screenshot({ path: out });
  await b.close();
  console.log('wrote', out);
})();
