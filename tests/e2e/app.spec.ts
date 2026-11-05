import { expect, test, type Page } from '@playwright/test';
import { deflateRawSync } from 'node:zlib';

type Api = {
  chapters: string[];
  seek: (k: number, t: number) => void;
  state: () => { k: number; t: number; n: number; title: string; diags: { line: number; message: string }[] };
};

const api = (page: Page) => page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.chapters);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('every tutorial chapter plays through without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?still#/t/atoms');
  await expect(page.locator('#narration .count')).toBeVisible();
  const ids = await api(page);
  expect(ids.length).toBeGreaterThanOrEqual(10);
  for (const id of ids) {
    await page.evaluate((id) => (location.hash = `#/t/${id}`), id);
    await expect(page.locator(`#chapters a[data-ch="${id}"]`)).toHaveClass(/on/);
    const st = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.state());
    expect(st.n, id).toBeGreaterThan(0);
    expect(st.diags.filter((d) => (d as { kind?: string }).kind === 'error'), id).toEqual([]);
    for (let k = 0; k < st.n; k++) {
      for (const t of [0.3, 0.6, 1]) {
        await page.evaluate(([k, t]) => (window as unknown as { chemvis: Api }).chemvis.seek(k, t), [k, t] as const);
      }
      const atoms = await page.locator('#stage circle.atom').count();
      expect(atoms, `${id} step ${k + 1}`).toBeGreaterThan(0);
    }
  }
  expect(errors).toEqual([]);
});

test('HCl chapter ends with H3O+ and Cl- charges drawn', async ({ page }) => {
  await page.goto('./?still#/t/acid-hcl');
  await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.seek(1, 1));
  await expect(page.locator('#stage .charge.pos')).toHaveCount(1);
  await expect(page.locator('#stage .charge.neg')).toHaveCount(1);
});

test('playing advances through a step', async ({ page }) => {
  await page.goto('./?still#/t/arrows');
  await page.locator('#btn-play').click();
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.state())).t).toBeGreaterThan(0.2);
});

test('a #z= link made the way the AI guide describes opens the script', async ({ page }) => {
  const script = 'scene "링크 시험"\nstage solution\nmol n = NH3 at left\nmol h = H+ at right\nstep "다가간다"\n  approach n.N h.H\nstep "결합"\n  arrow n.N:lp -> n.N~h.H\n';
  const z = deflateRawSync(Buffer.from(script, 'utf8'), { level: 9 }).toString('base64url');
  await page.goto(`./?still#z=${z}`);
  await expect(page.locator('#narration .count')).toHaveText('단계 1 / 2');
  const st = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.state());
  expect(st.title).toBe('링크 시험');
});

test('script errors are listed with line numbers', async ({ page }) => {
  const bad = encodeURIComponent('stage soil\nmol c = Ca2+ on clay in topsoil\nstep "교환"\n  exchange c with H+ on clay\n');
  await page.goto(`./?still#s=${bad}`);
  const err = page.locator('#diags li.error').first();
  await expect(err).toContainText('4번 줄');
  await expect(err).toContainText('전하가 맞지 않아요');
});

test('editing and applying a script re-renders the scene', async ({ page }) => {
  await page.goto('./?still#/edit');
  const ta = page.locator('#script-edit');
  await expect(ta).toBeVisible();
  await ta.fill('scene "고친 장면"\nstage solution\nmol w = H2O at center\nstep "물"\n  note w.O "산소"\n');
  await page.locator('#btn-apply').click();
  await expect(page.locator('#narration .text')).toHaveText('물');
});

test('layout fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?still#/t/leaching');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('note boxes stay put while molecules jiggle', async ({ page }) => {
  await page.goto('./#/t/atoms');
  await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.seek(2, 1));
  const offsets: number[][] = [];
  for (let i = 0; i < 12; i++) {
    offsets.push(
      await page.evaluate(() => {
        const l = document.querySelector('#stage .note line')!;
        const r = document.querySelector('#stage .note rect')!;
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

test('the script panel can be hidden from the top-right button and stays hidden', async ({ page }) => {
  await page.goto('./?still#/t/atoms');
  await expect(page.locator('#script-panel')).toBeVisible();
  await page.locator('#btn-script-toggle').click();
  await expect(page.locator('#script-panel')).toBeHidden();
  await expect(page.locator('#btn-script-toggle')).toHaveText('대본 보기');
  await page.reload();
  await expect(page.locator('#script-panel')).toBeHidden();
  await page.locator('#btn-script-toggle').click();
  await expect(page.locator('#script-panel')).toBeVisible();
});
