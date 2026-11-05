import { expect, test, type Page } from '@playwright/test';
import { deflateRawSync } from 'node:zlib';

type St = { k: number; t: number; n: number; title: string | null; atEnd: boolean };
type V = { seek: (k: number, t: number) => void; state: () => St };
type Api = {
  chapters: string[];
  main: V & { load: (src: string) => boolean };
  tutorial: V & { open: (id: string) => void; chapter: () => string };
};

const cv = (page: Page) => ({
  chapters: () => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.chapters),
  tut: {
    open: (id: string) => page.evaluate((id) => (window as unknown as { chemvis: Api }).chemvis.tutorial.open(id), id),
    seek: (k: number, t: number) =>
      page.evaluate(([k, t]) => (window as unknown as { chemvis: Api }).chemvis.tutorial.seek(k, t), [k, t] as const),
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

test('the workspace opens empty', async ({ page }) => {
  await page.goto('./?still');
  await expect(page.locator('#main-viewer .viewer')).toHaveClass(/is-empty/);
  await expect(page.locator('#main-viewer .dock')).toBeHidden();
  await expect(page.locator('#main-viewer circle.atom')).toHaveCount(0);
  await expect(page.locator('#tutorial')).not.toHaveAttribute('open', '');
});

test('every tutorial chapter plays through without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?still');
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#tutorial')).toHaveAttribute('open', '');
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
      expect(await page.locator('#tut-viewer circle.atom').count(), `${id} step ${k + 1}`).toBeGreaterThan(0);
    }
  }
  expect(errors).toEqual([]);
});

test('pressing play at the end of a chapter goes to the next chapter', async ({ page }) => {
  await page.goto('./?still#/t/atoms');
  const c = cv(page);
  const st = await c.tut.state();
  await c.tut.seek(st.n - 1, 1);
  const play = page.locator('#tut-viewer [data-act="play"]');
  await expect(play).toHaveAttribute('aria-label', '다음 장');
  await play.click();
  await expect.poll(() => c.tut.chapter()).toBe('arrows');
  await expect.poll(async () => (await c.tut.state()).t).toBeGreaterThan(0);
});

test('HCl chapter ends with H3O+ and Cl- charges drawn', async ({ page }) => {
  await page.goto('./?still#/t/acid-hcl');
  await cv(page).tut.seek(1, 1);
  await expect(page.locator('#tut-viewer .charge.pos')).toHaveCount(1);
  await expect(page.locator('#tut-viewer .charge.neg')).toHaveCount(1);
});

test('Escape closes the tutorial', async ({ page }) => {
  await page.goto('./?still#/t/forces');
  await expect(page.locator('#tutorial')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tutorial')).not.toHaveAttribute('open', '');
  await expect(page).not.toHaveURL(/#\/t\//);
});

test('a #z= link made the way the AI guide describes opens in the workspace', async ({ page }) => {
  const script = 'scene "링크 시험"\nstage solution\nmol n = NH3 at left\nmol h = H+ at right\nstep "다가간다"\n  approach n.N h.H\nstep "결합"\n  arrow n.N:lp -> n.N~h.H\n';
  const z = deflateRawSync(Buffer.from(script, 'utf8'), { level: 9 }).toString('base64url');
  await page.goto(`./?still#z=${z}`);
  await expect(page.locator('#scene-title')).toHaveText('링크 시험');
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
  await page.goto('./?still');
  await page.locator('#btn-script').click();
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
  await cv(page).tut.seek(2, 1);
  const offsets: number[][] = [];
  for (let i = 0; i < 12; i++) {
    offsets.push(
      await page.evaluate(() => {
        const l = document.querySelector('#tut-viewer .note line')!;
        const r = document.querySelector('#tut-viewer .note rect')!;
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
  await expect(page.locator('#tutorial')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
