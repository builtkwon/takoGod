// 원본: docs/rules/development/testing.md#e2e, docs/GDD.md §튜토리얼, §제품
import { expect, test, type Page } from '@playwright/test';

const KEY = 'takoyaki:session';

/** 콘솔 에러와 페이지 예외를 모은다. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** 시간을 고정하고 시작 버튼까지 누른다. 이후 시간은 page.clock으로만 흘린다. */
async function start(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '시작' }).click();
}

const tool = (page: Page, label: string) => page.locator('.ui-tool', { hasText: label });

/** 6구 모두에 같은 도구를 한 번씩 누른다(튜토리얼은 가장 뒤처진 구멍의 단계만 받는다). */
async function tapAll(page: Page, label: string, ingredient?: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await page.locator('.ui-chip').nth(i).click();
    await tool(page, label).click();
    if (ingredient) await page.locator('.ui-ingredient', { hasText: ingredient }).click();
  }
}

test('부팅: 콘솔 에러 없이 캔버스와 타이틀이 뜬다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '타코야끼트럭' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('PWA: manifest 링크가 있고 서비스 워커가 등록된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const manifest = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  expect(manifest).toMatchObject({ display: 'standalone', orientation: 'portrait' });
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
  expect(scope).toBe('http://localhost:4173/');
});

test('PWA: manifest 아이콘과 apple-touch-icon URL이 200을 돌려준다', async ({ page, request }) => {
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain('maskable');
  // manifest는 루트에 있어 상대 src는 '/' + src다.
  const paths = [...manifest.icons.map((i: { src: string }) => `/${i.src}`), await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')];
  for (const p of paths) expect((await request.get(p as string)).status(), p as string).toBe(200);
});

test('PWA: 첫 방문 뒤 오프라인에서 새로고침해도 셸이 뜬다', async ({ page, context }) => {
  await page.goto('/');
  // 서비스 워커가 install(셸·자산 캐시)을 마치고 이 페이지를 제어할 때까지 기다린다.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '타코야끼트럭' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('PWA: 새 셸을 받으면 셸이 참조하지 않는 옛 해시 자산을 캐시에서 지운다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // 캐시 이름의 버전(takoyaki-vN)이 올라가도 깨지지 않도록 접두사로 찾는다.
  const keys = () =>
    page.evaluate(async () => {
      const name = (await caches.keys()).find((k) => k.startsWith('takoyaki-'));
      return name ? (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname) : [];
    });
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((k) => k.startsWith('takoyaki-')) as string;
    await (await caches.open(name)).put('/assets/index-OLDHASH.js', new Response('old'));
  });
  expect(await keys()).toContain('/assets/index-OLDHASH.js');
  await page.reload(); // 내비게이션 → 네트워크 셸 → 정리
  await expect.poll(keys).not.toContain('/assets/index-OLDHASH.js');
  expect((await keys()).some((p) => /^\/assets\/index-.+\.js$/.test(p))).toBe(true); // 현재 자산은 남는다
});

test('PWA: install 중 셸 요청이 500이면 설치를 실패시키고 오류 페이지를 셸로 저장하지 않는다', async ({ page, context }) => {
  // 페이지 내비게이션은 통과시키고, 그 외(서비스 워커의 fetch)의 '/' 요청만 500으로 바꾼다.
  await context.route('**/', (route) =>
    route.request().isNavigationRequest() ? route.continue() : route.fulfill({ status: 500, contentType: 'text/html', body: 'SERVER-ERROR' }),
  );
  // 첫 설치가 실패하면 등록 자체가 사라지므로, register() 시점에 워커 상태를 붙잡아 둔다(테스트 쪽 후킹, 게임 코드 변경 없음).
  await page.addInitScript(() => {
    const w = window as unknown as { __swFinal?: Promise<string> };
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async (...args) => {
      const reg = await register(...args);
      const sw = reg.installing as ServiceWorker;
      w.__swFinal = new Promise((resolve) => sw.addEventListener('statechange', () => ['activated', 'redundant'].includes(sw.state) && resolve(sw.state)));
      return reg;
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __swFinal?: unknown }).__swFinal !== undefined);
  const state = await page.evaluate(() => (window as unknown as { __swFinal: Promise<string> }).__swFinal);
  const cachedShell = await page.evaluate(async () => {
    const name = (await caches.keys()).find((k) => k.startsWith('takoyaki-'));
    const hit = name ? await (await caches.open(name)).match('/') : undefined;
    return hit ? await hit.text() : null;
  });
  expect({ state, cachedShell }).toEqual({ state: 'redundant', cachedShell: null });
});

test('튜토리얼 한 판을 끝내면 5★ 리뷰가 저장된다', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  await expect(page.locator('.ui-phase')).toHaveText('튜토리얼');

  await tapAll(page, '마가린');
  await tapAll(page, '반죽물');
  await page.clock.runFor(2500); // 익음 게이지 적정 구간 진입(튜토리얼 40~100, 초당 20)
  await tapAll(page, '익히기');
  await tapAll(page, '속재료', '문어');
  await page.clock.runFor(2500);
  await tapAll(page, '익히기');
  for (let i = 0; i < 3; i++) await tapAll(page, '굴리기'); // 튜토리얼 굴리기는 전 구간 성공

  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved).toMatchObject({ version: 1, tutorialCompleted: true, finished: false });
  expect(saved.reviews).toHaveLength(1);
  expect(saved.reviews[0]).toMatchObject({ source: 'tutorial', stars: 5, personality: null });

  // 새로고침하면 튜토리얼을 건너뛴다.
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-phase')).toHaveText('1단계');
  expect(errors).toEqual([]);
});

test('새로고침 복원: finished 저장값이면 결과 화면을 다시 보여준다', async ({ page }) => {
  await page.goto('/');
  const reviews = [
    { source: 'tutorial', stars: 5, comment: '굿', personality: null },
    { source: 'customer', stars: 3, comment: '무난', personality: 'gourmet' },
  ];
  await page.evaluate(([k, r]) => sessionStorage.setItem(k as string, JSON.stringify({ version: 1, tutorialCompleted: true, finished: true, reviews: r })), [KEY, reviews]);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.getByRole('heading', { name: '오늘의 결과' })).toBeVisible();
  await expect(page.getByText('받은 리뷰 2개')).toBeVisible();
});

test('손상된 저장값은 버리고 튜토리얼부터 시작한다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => sessionStorage.setItem(k, '{"version":1,"tutorialCompleted":true,"finished":false,"reviews":[null]}'), KEY);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-phase')).toHaveText('튜토리얼');
});
