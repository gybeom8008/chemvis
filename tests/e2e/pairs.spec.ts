import { expect, test, type Page } from '@playwright/test';

type Cmp = { load: (id: string) => void; seek: (k: number, t: number) => void };
const seek = (page: Page, k: number, t: number) => page.evaluate(([k, t]) => (window as unknown as { cmp: Cmp }).cmp.seek(k, t), [k, t]);

test('pairs style: a proton transfer is one pair taking hold and another letting go', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('concept/?still#acid');
  const oldSvg = page.locator('#old svg.stage');
  const newSvg = page.locator('#new svg.stage');
  await expect(newSvg.locator('.pouch').first()).toBeVisible();

  // Before the change: the two pairs that will change are marked; nothing has moved.
  await seek(page, 1, 0.1);
  expect(await newSvg.locator('.pouch.hot').count()).toBe(2);
  // The earlier style draws bonds as lines and has no pouches; the new one draws no curved arrows.
  expect(await oldSvg.locator('.pouch').count()).toBe(0);
  expect(await newSvg.locator('g.arrow').count()).toBe(0);

  // In the middle, O's pair has reached H while the H–Cl pair still holds it: the H is held from both sides.
  await seek(page, 1, 0.38);
  expect(await newSvg.locator('.pouch.hot').count()).toBe(2);
  expect(await newSvg.locator('.pe.hot').count()).toBe(4);

  // At the end every electron is in a pair: H3O+ has 3 shared and 1 lone, Cl- has 4 lone.
  await seek(page, 1, 1);
  expect(await newSvg.locator('.pouch.hot').count()).toBe(0);
  expect(await newSvg.locator('.pouch').count()).toBe(8);
  expect(await newSvg.locator('.pe').count()).toBe(16);
  expect(errors).toEqual([]);
});

test('pairs style: every tutorial chapter and example draws without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('?still&style=pairs');
  type Api = { chapters: string[]; examples: string[]; tutorial: { open: (id: string) => void; seek: (k: number, t: number) => void; state: () => { n: number } } };
  const ids = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.chapters);
  for (const id of ids) {
    await page.evaluate((id) => (window as unknown as { chemvis: Api }).chemvis.tutorial.open(id), id);
    const n = await page.evaluate(() => (window as unknown as { chemvis: Api }).chemvis.tutorial.state().n);
    await page.evaluate((n) => {
      const t = (window as unknown as { chemvis: Api }).chemvis.tutorial;
      for (let k = 0; k < n; k++) for (const u of [0.05, 0.2, 0.34, 0.5, 0.7, 1]) t.seek(k, u);
    }, n);
    expect(errors, id).toEqual([]);
  }
});
