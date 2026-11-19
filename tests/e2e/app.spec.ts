import { expect, test, type Page } from '@playwright/test';
import { deflateRawSync } from 'node:zlib';

type St = { k: number; t: number; n: number; title: string | null; atEnd: boolean };
type V = { seek: (k: number, t: number) => void; state: () => St };
type Api = {
  chapters: string[];
  examples: string[];
  main: V & { load: (src: string) => boolean };
  tutorial: V & { open: (id: string) => void; chapter: () => string; opening: () => number };
};

const cv = (page: Page) => ({
  chapters: () => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.chapters),
  tut: {
    open: (id: string) => page.evaluate((id) => (window as unknown as { chemvis: Api }).chemvis.tutorial.open(id), id),
    seek: (k: number, t: number) =>
      page.evaluate(([k, t]) => (window as unknown as { chemvis: Api }).chemvis.tutorial.seek(k, t), [k, t] as const),
    /** The k-th step of the lesson's scene (after the captions it opens with). */
    seekScene: (k: number, t: number) =>
      page.evaluate(([k, t]) => {
        const tut = (window as unknown as { chemvis: Api }).chemvis.tutorial;
        tut.seek(tut.opening() + k, t);
      }, [k, t] as const),
    state: () => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.tutorial.state()),
    chapter: () => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.tutorial.chapter()),
  },
  main: {
    state: () => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.main.state()),
    load: (src: string) => page.evaluate((s) => (window as unknown as { chemvis: Api }).chemvis.main.load(s), src),
  },
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('시연 never opens on an empty stage: with nothing named it plays the first example', async ({ page }) => {
  await page.goto('./?still');
  const ids = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.examples);
  await expect(page).toHaveURL(new RegExp(`#/x/${ids[0]}$`));
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'demo');
  await expect(page.locator('#main-viewer .viewer')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#main-viewer circle.atom').first()).toBeVisible();
  await expect(page.locator('#main-viewer [data-act="next"]')).toBeEnabled();
  // Coming to 시연 from 학습 for the first time finds the example too.
  await page.goto('./?still#/t/atoms');
  await page.locator('.tabs [data-tab="demo"]').click();
  await expect(page).toHaveURL(new RegExp(`#/x/${ids[0]}$`));
  await expect(page.locator('#main-viewer circle.atom').first()).toBeVisible();
});

test('a new script is written on an empty canvas, its controls waiting', async ({ page }) => {
  await page.goto('./?still#/edit');
  await expect(page.locator('#main-viewer .viewer')).toHaveClass(/is-empty/);
  await expect(page.locator('#main-viewer circle.atom')).toHaveCount(0);
  const canvas = page.locator('#main-viewer svg.stage');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('radial-gradient');
  await expect(page.locator('#main-viewer .pill')).toBeVisible();
  await expect(page.locator('#main-viewer [data-act="next"]')).toBeDisabled();
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'demo');
  // Loading a scene turns the controls on.
  await page.evaluate(() =>
    (window as unknown as { chemvis: Api }).chemvis.main.load('stage solution\nmol w = H2O\nstep "물"\n  wait\n'),
  );
  await expect(page.locator('#main-viewer [data-act="next"]')).toBeEnabled();
});

test('every tutorial chapter plays through without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?still');
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'learn');
  const c = cv(page);
  const ids = await c.chapters();
  expect(ids.length).toBeGreaterThanOrEqual(10);
  for (const id of ids) {
    await c.tut.open(id);
    await expect(page.locator(`#tut-nav a[data-ch="${id}"]`)).toHaveClass(/on/);
    const st = await c.tut.state();
    expect(st.n, id).toBeGreaterThan(0);
    for (let k = 0; k < st.n; k++) {
      for (const t of [0.3, 0.6, 1]) await c.tut.seek(k, t);
      expect(await page.locator('#main-viewer circle.atom').count(), `${id} step ${k + 1}`).toBeGreaterThan(0);
    }
  }
  expect(errors).toEqual([]);
});

test('on the last step of a chapter the forward button offers the next chapter', async ({ page }) => {
  await page.goto('./?still#/t/atoms');
  const c = cv(page);
  const st = await c.tut.state();
  const next = page.locator('#main-viewer [data-act="next"]');
  await expect(next).toHaveAttribute('aria-label', '다음 단계');
  await c.tut.seek(st.n - 1, 1);
  await expect(next).toHaveAttribute('aria-label', '다음 장');
  await next.click();
  await expect.poll(() => c.tut.chapter()).toBe('arrows');
  await expect.poll(async () => (await c.tut.state()).t).toBeGreaterThan(0);
});

test('three step buttons, three different jobs; no play button to confuse them', async ({ page }) => {
  await page.goto('./?still');
  const c = cv(page);
  await c.main.load('stage solution\nmol w = H2O\nstep "하나"\n  wait\nstep "둘"\n  wait\nstep "셋"\n  wait\n');
  const v = page.locator('#main-viewer');
  await expect(v.locator('.pill button')).toHaveCount(3);
  await expect(v.locator('[data-act="play"]')).toHaveCount(0);
  // First step: nothing before it, so the back button rests.
  await expect(v.locator('[data-act="prev"]')).toBeDisabled();
  await v.locator('[data-act="next"]').click();
  await expect(v.locator('.count')).toHaveText('2 / 3');
  await expect(v.locator('[data-act="prev"]')).toBeEnabled();
  // Replay stays on this step, even after waiting.
  await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.main.seek(1, 1));
  await v.locator('[data-act="replay"]').click();
  expect((await c.main.state()).t).toBeLessThan(1);
  await page.waitForTimeout(3000);
  expect((await c.main.state()).k).toBe(1);
  await v.locator('[data-act="prev"]').click();
  await expect(v.locator('.count')).toHaveText('1 / 3');
  // Last step: the forward button says what it does now.
  await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.main.seek(2, 1));
  await expect(v.locator('[data-act="next"]')).toHaveAttribute('aria-label', '처음부터');
  await v.locator('[data-act="next"]').click();
  await expect(v.locator('.count')).toHaveText('1 / 3');
  // Keys: Space and → go on, ← goes back, R replays.
  await page.keyboard.press(' ');
  await expect(v.locator('.count')).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(v.locator('.count')).toHaveText('3 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(v.locator('.count')).toHaveText('2 / 3');
  await page.keyboard.press('r');
  await expect(v.locator('.count')).toHaveText('2 / 3');
});

test('HCl chapter ends with H3O+ and Cl- charges drawn', async ({ page }) => {
  await page.goto('./?still#/t/acid-hcl');
  await cv(page).tut.seekScene(1, 1);
  await expect(page.locator('#main-viewer .charge.pos')).toHaveCount(1);
  await expect(page.locator('#main-viewer .charge.neg')).toHaveCount(1);
});

test('학습 is 시연 with the list of lessons: one stage, the same tools in the same places', async ({ page }) => {
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  await page.goto('./?still#/x/root');
  await expect.poll(async () => (await cv(page).main.state()).n).toBeGreaterThan(0);
  await expect(page.locator('#tut-nav')).toBeHidden();
  const tools = await Promise.all(['#btn-examples', '#btn-script', '#btn-view', '#btn-link'].map(box));
  await page.locator('.tabs [data-tab="learn"]').click();
  await expect(page.locator('#tut-nav')).toBeVisible();
  // The same tools, where they were.
  const again = await Promise.all(['#btn-examples', '#btn-script', '#btn-view', '#btn-link'].map(box));
  again.forEach((b, i) => {
    expect(Math.abs(b.x - tools[i].x)).toBeLessThan(1);
    expect(Math.abs(b.y - tools[i].y)).toBeLessThan(1);
  });
  await expect(page.locator('#tut-open')).toHaveCount(0);
  // The script of the lesson opens beside it and can be changed in place, with the lesson's suggestion under it.
  await page.locator('#btn-script').click();
  await expect(page.locator('#code-view')).toContainText('scene "물 분자 하나"');
  await expect(page.locator('#tryit')).toBeVisible();
  await page.locator('#btn-edit').click();
  await page.locator('#code-edit').fill('scene "고친 수업"\nstage solution\nmol w = H2O\nstep "물."\n  wait\n');
  await page.locator('#btn-edit').click();
  await expect(page.locator('#tut-title')).toHaveText('원자, 결합, 전자쌍');
  await expect(page.locator('#main-viewer .caption .text')).toHaveText('물.');
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'learn');
  // Escape does not take the lesson away.
  await page.keyboard.press('Escape');
  await expect(page.locator('#tut-nav')).toBeVisible();
  // Back in 시연 the example is as it was, and the lesson keeps its change for when one comes back.
  await page.locator('.tabs [data-tab="demo"]').click();
  await expect(page.locator('#tut-title')).toHaveText('뿌리털이 흙에서 칼륨 이온을 얻을 때');
  await page.locator('.tabs [data-tab="learn"]').click();
  await expect(page.locator('#main-viewer .caption .text')).toHaveText('물.');
});

test('a lesson tells what it is about in its captions: the first ones only tell, in a framed box that keeps its size', async ({ page }) => {
  await page.goto('./?still#/t/acid-hcl');
  const c = cv(page);
  const n = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.tutorial.opening());
  expect(n).toBeGreaterThan(0);
  const cap = page.locator('#main-viewer .caption');
  await expect(cap).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('#main-viewer svg.stage')).toHaveCSS('border-top-style', 'solid');
  const sizes = new Set<number>();
  const stage = new Set<number>();
  for (let k = 0; k < (await c.tut.state()).n; k++) {
    await c.tut.seek(k, 0.5);
    sizes.add(Math.round((await cap.boundingBox())!.height));
    stage.add(Math.round((await page.locator('#main-viewer svg.stage').boundingBox())!.height));
  }
  // The box (and so the stage) is the same size at every step, long caption or short.
  expect(sizes.size).toBe(1);
  expect(stage.size).toBe(1);
  // Nothing above the stage but the title.
  await expect(page.locator('#tut-intro')).toHaveCount(0);
});

test('every lesson caption ends with a full stop', async ({ page }) => {
  await page.goto('./?still#/t/atoms');
  const c = cv(page);
  for (const id of await c.chapters()) {
    await c.tut.open(id);
    const n = (await c.tut.state()).n;
    for (let k = 0; k < n; k++) {
      await c.tut.seek(k, 0.5);
      await expect(page.locator('#main-viewer .caption .text'), `${id} step ${k + 1}`).toHaveText(/[.?!]$/);
    }
  }
});

test('a #z= link made the way the AI guide describes opens in the workspace', async ({ page }) => {
  const script = 'scene "링크 시험"\nstage solution\nmol n = NH3 at left\nmol h = H+ at right\nstep "다가간다"\n  approach n.N h.H\nstep "결합"\n  arrow n.N:lp -> n.N~h.H\n';
  const z = deflateRawSync(Buffer.from(script, 'utf8'), { level: 9 }).toString('base64url');
  await page.goto(`./?still#z=${z}`);
  await expect(page.locator('#tut-title')).toHaveText('링크 시험');
  await expect(page.locator('#main-viewer .caption .text')).toHaveText('다가간다');
  expect((await cv(page).main.state()).n).toBe(2);
});

test('script errors open the script drawer with line numbers', async ({ page }) => {
  const bad = encodeURIComponent('stage soil\nmol c = Ca2+ on clay in topsoil\nstep "교환"\n  exchange c with H+ on clay\n');
  await page.goto(`./?still#s=${bad}`);
  await expect(page.locator('#drawer')).toBeVisible();
  const err = page.locator('#diags .err').first();
  await expect(err.locator('b')).toHaveText('4');
  await expect(err).toContainText('전하가 맞지 않아요');
});

test('writing and applying a script from the empty workspace', async ({ page }) => {
  await page.goto('./?still#/edit');
  await expect(page.locator('#btn-script')).toHaveAttribute('aria-pressed', 'true');
  const ta = page.locator('#code-edit');
  await expect(ta).toBeVisible();
  await ta.fill('scene "고친 장면"\nstage solution\nmol w = H2O at center\nstep "물"\n  note w.O "산소"\n');
  await page.locator('#btn-edit').click();
  await expect(page.locator('#main-viewer .caption .text')).toHaveText('물');
  await expect(page.locator('#code-view')).toBeVisible();
});

test('the script drawer opens and closes from its icon', async ({ page }) => {
  await page.goto('./?still');
  await cv(page).main.load('stage solution\nmol w = H2O\nstep "물"\n  wait\n');
  const btn = page.locator('#btn-script');
  await expect(page.locator('#drawer')).toBeHidden();
  await btn.click();
  await expect(page.locator('#drawer')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect(page.locator('#drawer')).toBeHidden();
});

test('note boxes stay put while molecules jiggle', async ({ page }) => {
  await page.goto('./#/t/atoms');
  await cv(page).tut.seekScene(2, 1);
  const offsets: number[][] = [];
  for (let i = 0; i < 12; i++) {
    offsets.push(
      await page.evaluate(() => {
        const l = document.querySelector('#main-viewer .note line')!;
        const r = document.querySelector('#main-viewer .note rect')!;
        return [+r.getAttribute('x')! - +l.getAttribute('x1')!, +r.getAttribute('y')! - +l.getAttribute('y1')!];
      }),
    );
    await page.waitForTimeout(60);
  }
  for (const [dx, dy] of offsets) {
    expect(Math.abs(dx - offsets[0][0])).toBeLessThan(1.5);
    expect(Math.abs(dy - offsets[0][1])).toBeLessThan(1.5);
  }
});

test('phone width: no sideways scrolling in workspace or tutorial', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?still');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.goto('./?still#/t/leaching');
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'learn');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('a small phone (360×640): the bar fits, everything pressed is 44 px, the stage keeps about half the height', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const at of ['./?still#/t/acid-hcl', './?still#/x/limestone']) {
    await page.goto(at);
    await expect(page.locator('#main-viewer circle.atom').first()).toBeVisible();
    const m = await page.evaluate(() => {
      const shown = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
      };
      const pressed = [...document.querySelectorAll('button, a[href]')].filter(shown);
      return {
        small: pressed.filter((e) => e.getBoundingClientRect().width < 44 || e.getBoundingClientRect().height < 44).map((e) => e.id || e.className),
        barRight: Math.max(...[...document.querySelectorAll('.bar *')].filter(shown).map((e) => e.getBoundingClientRect().right)),
        stage: document.querySelector('#main-viewer svg.stage')!.getBoundingClientRect().height / innerHeight,
      };
    });
    // ui.md R9 and R2 (the plan asks 55% of the height; the heading, the caption and the controls leave about half).
    expect(m.small, at).toEqual([]);
    expect(m.barRight, at).toBeLessThanOrEqual(360);
    expect(m.stage, at).toBeGreaterThan(0.45);
  }
});

test('attraction lines do not blink while nothing moves', async ({ page }) => {
  await page.goto('./#/t/forces');
  await cv(page).tut.seek(0, 1);
  const counts = new Set<number>();
  for (let i = 0; i < 15; i++) {
    counts.add(await page.locator('#main-viewer line.attract').count());
    await page.waitForTimeout(50);
  }
  expect(counts.size).toBe(1);
  expect([...counts][0]).toBeGreaterThan(10);
});

test('examples open in the workspace like ready-made documents and play through', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?still');
  await page.locator('#btn-examples').click();
  const items = page.locator('#examples-pop [data-ex]');
  const ids = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.examples);
  await expect(items).toHaveCount(ids.length);
  await items.nth(1).click();
  await expect(page.locator('#examples-pop')).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`#/x/${ids[1]}$`));
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'demo');
  const c = cv(page);
  for (const id of ids) {
    await page.evaluate((id) => (location.hash = `#/x/${id}`), id);
    await expect.poll(async () => (await c.main.state()).title).not.toBeNull();
    const st = await c.main.state();
    for (let k = 0; k < st.n; k++) {
      await page.evaluate(([k]) => (window as unknown as { chemvis: Api }).chemvis.main.seek(k, 1), [k] as const);
      expect(await page.locator('#main-viewer circle.atom').count(), `${id} step ${k + 1}`).toBeGreaterThan(0);
    }
  }
  expect(errors).toEqual([]);
});

test('the old drawing (?style=lines): the legend button lists the marks of the current scene', async ({ page }) => {
  // (Narrow enough that the legend is behind its button.)
  await page.setViewportSize({ width: 700, height: 720 });
  await page.goto('./?still&style=lines');
  const btn = page.locator('#main-viewer .legend-btn');
  const pop = page.locator('#main-viewer .legend-pop');
  // No scene yet: every mark is listed.
  await btn.click();
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('전자쌍(전자 2개) 이동');
  await page.mouse.click(5, 300);
  await expect(pop).toBeHidden();
  // A water molecule: its elements and its marks, others hidden until asked for.
  await cv(page).main.load('stage solution\nmol w = H2O at center\nstep "물"\n  wait\n');
  await btn.click();
  await expect(pop.locator('.lg-els li span')).toHaveText(['수소', '산소']);
  await expect(pop.getByText('비공유 전자쌍')).toBeVisible();
  await expect(pop.getByText('전자쌍(전자 2개) 이동')).toBeHidden();
  await pop.locator('.lg-more').click();
  await expect(pop.getByText('전자쌍(전자 2개) 이동')).toBeVisible();
  // The panel sits right above its button.
  const b = (await btn.boundingBox())!;
  const p = (await pop.boundingBox())!;
  expect(b.y - (p.y + p.height)).toBeLessThan(16);
  expect(Math.abs(b.x - p.x)).toBeLessThan(4);
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
});

test('phone: the legend button sits inside the canvas, menus stay on screen, electrons stay big enough to see', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?still#/x/li-battery');
  const v = page.locator('#main-viewer');
  const btn = (await v.locator('.legend-btn').boundingBox())!;
  const canvas = (await v.locator('svg.stage').boundingBox())!;
  const bar = (await v.locator('.pill').boundingBox())!;
  expect(btn.x).toBeGreaterThanOrEqual(canvas.x);
  expect(btn.y).toBeGreaterThanOrEqual(canvas.y);
  expect(btn.y + btn.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  expect(bar.width).toBeGreaterThan(340);
  // The examples menu fits the screen.
  await page.locator('#btn-examples').click();
  const pop = (await page.locator('#examples-pop').boundingBox())!;
  expect(pop.x).toBeGreaterThanOrEqual(0);
  expect(pop.x + pop.width).toBeLessThanOrEqual(390);
  await page.locator('#btn-examples').click();
  // Mid-charge: electrons run through the wire.
  await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.main.seek(1, 0.45));
  // The stage is redrawn every frame, so read the size in one go rather than through a handle.
  await expect
    .poll(() => page.evaluate(() => document.querySelector('#main-viewer circle.wire-e')?.getBoundingClientRect().width ?? 0))
    .toBeGreaterThanOrEqual(7);
});

test('the old drawing (?style=lines): electrons light up, travel drawing the arrow, then the atoms settle', async ({ page }) => {
  await page.goto('./?still&style=lines#/t/arrows');
  const c = cv(page);
  const v = page.locator('#main-viewer');
  // Before the change: the lone pair about to move is marked where it sits; no arrow yet.
  await c.tut.seekScene(2, 0.08);
  await expect(v.locator('svg.stage circle.e.cue')).toHaveCount(2);
  await expect(v.locator('svg.stage g.arrow')).toHaveCount(0);
  // On the way: the pair travels and the arrow is drawn behind it, the new bond growing.
  await c.tut.seekScene(2, 0.3);
  await expect(v.locator('svg.stage circle.e.fly')).toHaveCount(2);
  await expect(v.locator('svg.stage g.arrow')).toHaveCount(1);
  await expect(v.locator('svg.stage g.arrow polygon')).toHaveCount(0);
  // Arrived: the arrow has its head; the electrons have become the bond.
  await c.tut.seekScene(2, 0.6);
  await expect(v.locator('svg.stage g.arrow polygon')).toHaveCount(1);
  await expect(v.locator('svg.stage circle.e.fly')).toHaveCount(0);
  // Settled: only the new structure remains.
  await c.tut.seekScene(2, 1);
  await expect(v.locator('svg.stage g.arrow')).toHaveCount(0);
  await expect(v.locator('svg.stage line.bond.hot')).toHaveCount(0);
});

test('phone 학습: the list of lessons opens over the page from its button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?still#/t/acid-hcl');
  await expect(page.locator('#tut-nav')).toBeHidden();
  await expect(page.locator('#tut-part .cnt')).toHaveText(/\d+ \/ \d+/);
  await page.locator('#tut-menu').click();
  await expect(page.locator('#tut-nav')).toBeVisible();
  await page.locator('#tut-nav a[data-ch="redox"]').click();
  await expect(page.locator('#tut-nav')).toBeHidden();
  await expect(page.locator('#tut-title')).toContainText('산화와 환원');
});


test('electron pairs are the drawing; the heat of a reaction can be turned off and stays off', async ({ page }) => {
  await page.goto('./?still#/t/neutralization');
  const c = cv(page);
  const v = page.locator('#main-viewer');
  // Pairs, not lines and arrows.
  await c.tut.seekScene(2, 0.5);
  await expect(v.locator('svg.stage')).toHaveAttribute('data-look', 'glow');
  expect(await v.locator('line.pouch').count()).toBeGreaterThan(4);
  await expect(v.locator('svg.stage g.arrow')).toHaveCount(0);
  // The heat comes at the moment the H crosses: find a moment where the ring is drawn.
  const ringSeen = async () => {
    for (let i = 0; i <= 40; i++) {
      await c.tut.seekScene(2, i / 40);
      if (await v.locator('g.heat circle.ring').count()) return true;
    }
    return false;
  };
  expect(await ringSeen()).toBe(true);
  await page.locator('#btn-view').click();
  const sw = page.locator('#view-pop [data-heat]');
  await expect(sw).toBeChecked();
  await sw.uncheck();
  expect(await ringSeen()).toBe(false);
  // Kept for the next visit.
  await page.reload();
  expect(await ringSeen()).toBe(false);
  await page.locator('#btn-view').click();
  await expect(page.locator('#view-pop [data-heat]')).not.toBeChecked();
});

test('three tabs in a row, each a screen of its own: 학습, 시연, 실험실', async ({ page }) => {
  await page.goto('./?still');
  const tab = (name: string) => page.locator(`.tabs [role="tab"]:text-is("${name}")`);
  await expect(page.locator('.tabs [role="tab"]')).toHaveText(['학습', '시연', '실험실']);
  const shows = async (on: string) => {
    for (const name of ['학습', '시연', '실험실']) await expect(tab(name)).toHaveAttribute('aria-selected', String(name === on));
    // 학습 and 시연 are one screen; 학습 adds the list of lessons.
    if (on === '실험실') await expect(page.locator('#work')).toBeHidden();
    else await expect(page.locator('#work')).toBeVisible();
    if (on === '학습') await expect(page.locator('#tut-nav')).toBeVisible();
    else await expect(page.locator('#tut-nav')).toBeHidden();
    if (on === '실험실') await expect(page.locator('#lab')).toBeVisible();
    else await expect(page.locator('#lab')).toBeHidden();
  };
  await shows('시연');
  // A scene in 시연 is kept while the other screens are looked at.
  await cv(page).main.load('stage solution\nmol w = H2O\nstep "물"\n  wait\n');
  await tab('실험실').click();
  await shows('실험실');
  await expect(page).toHaveURL(/#\/lab$/);
  await tab('학습').click();
  await shows('학습');
  await expect(page).toHaveURL(/#\/t\/[\w-]+$/);
  await tab('시연').click();
  await shows('시연');
  await expect(page).not.toHaveURL(/#\//);
  expect((await cv(page).main.state()).n).toBe(1);
  // An example in 시연 keeps its address across a visit to 학습.
  await page.goto('./?still#/x/root');
  await tab('학습').click();
  await tab('시연').click();
  await expect(page).toHaveURL(/#\/x\/root$/);
  // Each screen can be opened by its address.
  await page.goto('./?still#/lab');
  await shows('실험실');
  await page.goto('./?still#/t/atoms');
  await shows('학습');
});

test('the legend: beside the stage while there is room, behind its button when the screen is narrow', async ({ page }) => {
  await page.goto('./?still&heat=on');
  const side = page.locator('#main-viewer .legend-side');
  const btn = page.locator('#main-viewer .legend-btn');
  const pop = page.locator('#main-viewer .legend-pop');
  await expect(side).toBeVisible();
  await expect(btn).toBeHidden();
  await expect(side).toContainText('전자가 모자란 곳(+)');
  await expect(side).toContainText('두 원자가 함께 가진 전자쌍(결합)');
  await expect(side).toContainText('열이 나올 때');
  // It narrows with the screen before it goes.
  const wide = (await side.boundingBox())!.width;
  await page.setViewportSize({ width: 1000, height: 720 });
  await expect.poll(async () => (await side.boundingBox())!.width).toBeLessThan(wide);
  // Turning the heat off takes its rows out at once.
  await page.locator('#btn-view').click();
  await page.locator('#view-pop [data-heat]').uncheck();
  await expect(side).not.toContainText('열이 나올 때');
  await page.locator('#view-pop [data-heat]').check();
  await page.mouse.click(5, 400);
  // Narrow: behind the button.
  await page.setViewportSize({ width: 700, height: 720 });
  await expect(side).toBeHidden();
  await btn.click();
  await expect(pop).toContainText('지금 움직이는 전자쌍');
  await expect(pop).toContainText('열이 나올 때');
});
