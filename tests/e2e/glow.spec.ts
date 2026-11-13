import { expect, test, type Locator, type Page } from '@playwright/test';

type Cmp = { seek: (k: number, t: number) => void; steps: () => number; load: (id: string) => void };
const seek = (page: Page, k: number, t: number) => page.evaluate(([k, t]) => (window as unknown as { cmp: Cmp }).cmp.seek(k, t), [k, t]);
const steps = (page: Page) => page.evaluate(() => (window as unknown as { cmp: Cmp }).cmp.steps());
const drawing = (page: Page) => page.locator('#new svg.stage');
const times = [0, 0.05, 0.12, 0.2, 0.3, 0.38, 0.5, 0.55, 0.7, 0.9, 1];

// 실패한 검사에서도 페이지 오류를 따로 보고한다. 탐색 전에 수집을 시작한다.
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page), '페이지 오류가 없어야 한다').toEqual([]);
});

async function open(page: Page, scene: string, query = '') {
  await page.goto(`concept/?still${query}#${scene}`);
  await expect(drawing(page)).toHaveAttribute('data-look', 'glow');
  await expect(drawing(page)).toHaveAttribute('data-cause', '1');
  // 같은 문서에서 해시만 바꾸면 초기화가 다시 실행되지 않으므로 장면도 직접 불러온다.
  await page.evaluate((id) => (window as unknown as { cmp: Cmp }).cmp.load(id), scene);
}

// 전하를 특정 원자에 고정하지 않고, 그 이온을 이루는 원자 중 하나에 연결했는지 확인한다.
async function expectIons(svg: Locator, ions: { atoms: RegExp; sign: string }[]) {
  const labels = await svg.locator('text.ionq').evaluateAll((nodes) => nodes.map((node) => ({
    atom: node.getAttribute('data-a') ?? '',
    sign: node.textContent,
  })));
  expect(labels).toHaveLength(ions.length);
  const members = await svg.locator('circle.atom[data-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')!));
  for (const ion of ions) {
    expect(members.filter((id) => ion.atoms.test(id)).length).toBeGreaterThan(0);
    expect(labels.filter((label) => ion.atoms.test(label.atom))).toEqual([
      { atom: expect.any(String), sign: ion.sign },
    ]);
  }
  for (const label of await svg.locator('text.ionq').all()) await expect(label).toBeVisible();
}

async function expectOutsideAtoms(svg: Locator, context: string) {
  // 글자 상자의 실제 중심을 각 원자 원의 좌표계로 옮긴다. dy, 화면 배율, SVG 변환도 반영한다.
  // 배경 물 분자까지 포함해 어느 원 안에도 중심이 들어가지 않아야 한다.
  const overlaps = await svg.evaluate((root) => {
    const atoms = [...root.querySelectorAll<SVGCircleElement>('circle.atom')];
    return [...root.querySelectorAll<SVGTextElement>('text.ionq')].flatMap((label) => {
      const box = label.getBBox();
      const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(label.getCTM()!);
      return atoms.flatMap((atom) => {
        const p = center.matrixTransform(atom.getCTM()!.inverse());
        const distance = Math.hypot(p.x - atom.cx.baseVal.value, p.y - atom.cy.baseVal.value);
        return distance < atom.r.baseVal.value ? [{
          label: label.textContent, anchor: label.getAttribute('data-a'),
          atom: atom.getAttribute('data-id') ?? '배경 원자', distance, radius: atom.r.baseVal.value,
        }] : [];
      });
    });
  });
  expect(overlaps, context).toEqual([]);
}

test('이온 전하: 원자 하나인 이온과 여럿인 이온에 글자가 하나씩 붙는다', async ({ page }) => {
  await open(page, 'neutral');
  await seek(page, 0, 0);
  await expectIons(drawing(page), [{ atoms: /^a\./, sign: '+' }, { atoms: /^b\./, sign: '−' }]);
  await expectOutsideAtoms(drawing(page), '반응 전 H₃O⁺와 OH⁻');

  await open(page, 'base');
  await seek(page, (await steps(page)) - 1, 1);
  await expectIons(drawing(page), [{ atoms: /^(n\.|w\.H1$)/, sign: '+' }, { atoms: /^w\.(O|H2)$/, sign: '−' }]);
  await expectOutsideAtoms(drawing(page), '반응 후 NH₄⁺와 OH⁻');

  await open(page, 'redox');
  await seek(page, 0, 0);
  await expectIons(drawing(page), [{ atoms: /^c\.Cu$/, sign: '2+' }]);
  await expectOutsideAtoms(drawing(page), '반응 전 Cu²⁺');
  await seek(page, (await steps(page)) - 1, 1);
  await expectIons(drawing(page), [{ atoms: /^z\.Zn$/, sign: '2+' }]);
  await expectOutsideAtoms(drawing(page), '반응 후 Zn²⁺');
});

test('치환: 결합한 Br에는 −가 없고 반응 뒤 두 이온에 부호가 하나씩 붙는다', async ({ page }) => {
  await open(page, 'subst');
  const svg = drawing(page);
  // 0단계와 1단계에서는 C–Br 결합을 유지한다. 2단계에서 전자쌍이 옮겨 간다.
  for (const k of [0, 1]) for (const t of times) {
    await seek(page, k, t);
    await expect(svg.locator('circle.atom[data-id="m.Br"]')).toHaveCount(1);
    await expect(svg.locator('text.ionq')).toHaveCount(0);
  }
  for (const k of [2, 3]) {
    await seek(page, k, 1);
    await expectIons(svg, [{ atoms: /^m\.Br$/, sign: '−' }, { atoms: /^(n\.|m\.(C|H\d*)$)/, sign: '+' }]);
    await expectOutsideAtoms(svg, `치환 ${k}단계 끝`);
  }
});

test('산: 마지막에 H₃O⁺에는 + 하나, Cl⁻에는 − 하나가 붙는다', async ({ page }) => {
  await open(page, 'acid');
  await seek(page, (await steps(page)) - 1, 1);
  await expectIons(drawing(page), [{ atoms: /^(w\.|a\.H$)/, sign: '+' }, { atoms: /^a\.Cl$/, sign: '−' }]);
  await expectOutsideAtoms(drawing(page), '물 분자가 둘러싼 H₃O⁺와 Cl⁻');
});

test('전하 색: 주소와 버튼으로 색을 바꿔도 재생 단계와 시간은 유지된다', async ({ page }) => {
  await open(page, 'neutral', '&palette=red-negative');
  const svg = drawing(page);
  await seek(page, 1, 0.37);
  await expect(svg).toHaveAttribute('data-palette', 'red-negative');
  await expect(svg.locator('text.ionq.pos')).toHaveCount(1);
  // 매 프레임 글자 노드가 교체되므로 조회와 색 읽기를 한 번에 실행한다.
  const fill = () => svg.evaluate((root) => getComputedStyle(root.querySelector('text.ionq.pos')!).fill);
  const position = async () => ({ caption: await page.locator('.say').textContent(), time: await page.locator('#scrub').inputValue() });
  const before = await position();
  expect(before.caption).toContain('두 용액을 섞으면');
  expect(before.time).toBe('370');
  // 공개 API에 state가 없으므로 단계마다 다른 설명과 시간 슬라이더를 함께 비교한다.
  const negativeFill = await fill();
  expect(negativeFill).not.toBe('');
  for (const palette of ['red-positive', 'red-negative']) {
    await page.locator(`button[data-palette="${palette}"]`).click();
    await expect(svg).toHaveAttribute('data-palette', palette);
    await expect(page.locator(`button[data-palette="${palette}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await position()).toEqual(before);
    if (palette === 'red-positive') expect(await fill()).not.toBe(negativeFill);
    else expect(await fill()).toBe(negativeFill);
  }
});

for (const k of [0, 1, 2, 3]) test(`금속 조각 ${k}단계: 건너가는 점까지 합쳐 전자 12개를 보존한다`, async ({ page }) => {
  await open(page, 'metal');
  const svg = drawing(page);
  expect(await steps(page)).toBe(4);
  let sawFlight = false;
  // pairs.ts의 sea()와 jumps는 모두 data-a 없는 .pe를 그린다. .fly만 세면
  // 출발을 기다리거나 도착한 점을 빠뜨린다. 이 장면에는 결합 전자쌍이 없으므로
  // data-a가 붙은 은 이온의 전자쌍을 제외하면 조각에서 나온 점만 남는다.
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    await seek(page, k, t);
    expect(await svg.locator('circle.pe:not([data-a])').count(), `금속 ${k}단계, 시간 ${t}`).toBe(12);
    sawFlight ||= await svg.locator('circle.pe.fly:not([data-a])').count() > 0;
  }
  if (k === 2) expect(sawFlight, '실제로 건너가는 점이 있는 순간도 검사한다').toBe(true);
});

test('금속 조각: 내부 원자에는 전하 글자가 없고 나온 Zn²⁺에만 2+가 붙는다', async ({ page }) => {
  await open(page, 'metal');
  const svg = drawing(page);
  const n = await steps(page);
  for (let k = 0; k < n; k++) for (const t of times) {
    await seek(page, k, t);
    const insideLabels = await svg.evaluate((root) => {
      const inside = new Set([...root.querySelectorAll('circle.atom.metal.lat')].map((atom) => atom.getAttribute('data-id')));
      return [...root.querySelectorAll('text.ionq')].filter((label) => inside.has(label.getAttribute('data-a'))).map((label) => label.outerHTML);
    });
    expect(insideLabels, `금속 ${k}단계, 시간 ${t}`).toEqual([]);
  }
  await seek(page, n - 1, 1);
  await expect(svg.locator('circle.atom[data-id="m4.Zn"]')).not.toHaveClass(/\blat\b/);
  await expectIons(svg, [{ atoms: /^m4\.Zn$/, sign: '2+' }]);
  await expectOutsideAtoms(svg, '조각에서 나온 Zn²⁺');
});

test('침전: 고체에 들어간 이온에는 전하 글자가 없다', async ({ page }) => {
  await open(page, 'solid');
  const svg = drawing(page);
  // 대본에서 1, 2, 3단계 끝마다 Ag⁺와 Cl⁻ 한 쌍이 고체에 들어간다.
  for (let k = 0; k <= 3; k++) {
    await seek(page, k, 1);
    const remaining = [];
    for (let i = k + 1; i <= 3; i++) {
      remaining.push({ atoms: new RegExp(`^a${i}\\.Ag$`), sign: '+' }, { atoms: new RegExp(`^b${i}\\.Cl$`), sign: '−' });
    }
    await expectIons(svg, remaining);
    if (k > 0) {
      expect(await svg.locator('.solid.salt').count()).toBeGreaterThan(0);
      for (let i = 1; i <= k; i++) {
        await expect(svg.locator(`circle.atom[data-id="a${i}.Ag"]`)).toBeVisible();
        await expect(svg.locator(`circle.atom[data-id="b${i}.Cl"]`)).toBeVisible();
      }
    }
  }
});

test('모든 비교 장면: 페이지 오류가 없고 원자 기호 안에 전하 부호가 없다', async ({ page }) => {
  await open(page, 'acid');
  const scenes = await page.locator('button[data-scene]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-scene')!));
  expect(scenes.length).toBeGreaterThan(0);
  for (const scene of scenes) {
    await page.evaluate((id) => (window as unknown as { cmp: Cmp }).cmp.load(id), scene);
    const n = await steps(page);
    expect(n, scene).toBeGreaterThan(0);
    for (let k = 0; k < n; k++) for (const t of times) {
      await seek(page, k, t);
      const symbols = await drawing(page).locator('text.sym').allTextContents();
      expect(symbols.length, `${scene} ${k} ${t}`).toBeGreaterThan(0);
      expect(symbols.filter((symbol) => /[+−-]/.test(symbol)), `${scene} ${k} ${t}`).toEqual([]);
      expect(pageErrors.get(page), `${scene} ${k} ${t}`).toEqual([]);
    }
  }
});
