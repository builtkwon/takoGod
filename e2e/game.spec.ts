// 원본: docs/rules/development/testing.md#e2e, docs/GDD.md §튜토리얼, §제품
import { expect, test, type Page } from '@playwright/test';
import type { PickTarget, ScenePicker } from '../src/contracts';
import { createScenePicker } from '../src/render/pick';

const KEY = 'takoyaki:session';

/** 콘솔 에러와 페이지 예외를 모은다. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

const T0 = new Date('2026-01-01T09:00:00');

/**
 * 시간을 고정하고 시작 버튼까지 누른다. 시작 뒤 시계를 멈추므로(pauseAt) 이후 시간은 page.clock.runFor로만 흐른다.
 * 시작 시각을 고정해 core의 난수 시드(Date.now)도 매번 같다.
 */
async function start(page: Page): Promise<void> {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.getByRole('button', { name: '시작' }).click();
  await page.clock.pauseAt(new Date(T0.getTime() + 1000));
  // 멈춘 시계는 실제 시간이 지나도 같은 값이다(주석과 동작이 맞는지 확인).
  const t1 = await page.evaluate(() => Date.now());
  expect(await page.evaluate(() => Date.now())).toBe(t1);
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * 장면 좌표 판정기. 3D 장면에는 DOM 요소가 없어 구멍·트레이·후네의 화면 좌표를 render의 순수 함수(src/render/pick.ts)로 계산한다.
 * 게임 코드에 테스트용 장치를 두지 않고 canvas의 화면 위치(boundingBox)만 받는다. 트레이는 6칸으로 둔다.
 */
async function scenePicker(page: Page): Promise<ScenePicker> {
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('canvas 없음');
  const rect = { left: box.x, top: box.y, width: box.width, height: box.height } as DOMRect;
  return createScenePicker({ getBoundingClientRect: () => rect }, () => 6);
}

function at(picker: ScenePicker, target: PickTarget): Pt {
  const p = picker.anchor(target);
  if (p === null) throw new Error(`anchor 없음: ${JSON.stringify(target)}`);
  return p;
}

/** DOM 요소(마가린 통·반죽 주전자)의 가운데 좌표. */
async function center(page: Page, selector: string): Promise<Pt> {
  const b = await page.locator(selector).boundingBox();
  if (b === null) throw new Error(`요소 없음: ${selector}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** from에서 눌러 to까지 끌고 놓는다. */
async function drag(page: Page, from: Pt, to: Pt): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

/** 튜토리얼에서 열린 6구(GDD §튜토리얼, 4×4의 1,2,5,6,9,10번). 나머지 10구는 잠겨 조작을 받지 않는다. */
const OPEN = [1, 2, 5, 6, 9, 10];

/** 열린 6구 모두에 같은 재료를 끌어 놓는다(튜토리얼은 단계별로 6구에 같은 조작을 하게 유도한다). */
async function dragAll(page: Page, picker: ScenePicker, from: () => Promise<Pt>): Promise<void> {
  for (const i of OPEN) await drag(page, await from(), at(picker, { kind: 'hole', index: i }));
}

/** 6구를 한 번씩 탭한다(굴리기). */
async function tapAll(page: Page, picker: ScenePicker): Promise<void> {
  for (const i of OPEN) {
    const p = at(picker, { kind: 'hole', index: i });
    await page.mouse.click(p.x, p.y);
  }
}

/** 6구의 완성품을 하나씩 들어 후네에 놓는다. */
async function funeAll(page: Page, picker: ScenePicker): Promise<void> {
  const fune = at(picker, { kind: 'fune' });
  for (const i of OPEN) {
    const p = at(picker, { kind: 'hole', index: i });
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 24, p.y + 24, { steps: 2 }); // 탭이 아니라 들기로 인식되는 이동
    await page.mouse.move(fune.x, fune.y, { steps: 6 });
    await page.mouse.up();
  }
}

/** 튜토리얼 한 판: 마가린 → 반죽물 → 익힘 기다림 → 속재료(문어) → 굴리기 1 → 굴리기 2 → 후네 담기. */
async function playTutorial(page: Page): Promise<void> {
  const picker = await scenePicker(page);
  await dragAll(page, picker, () => center(page, '.ui-bucket-margarine'));
  await dragAll(page, picker, () => center(page, '.ui-bucket-batter'));
  await page.clock.runFor(3500); // 익힘 3초(GDD §굽기). 시계가 멈춰 있어 이 호출로만 시간이 흐른다.
  // 튜토리얼의 트레이는 섞이기 전이라 문어가 0번 칸이다(트레이는 서빙 시점에 섞인다).
  await dragAll(page, picker, async () => at(picker, { kind: 'tray', slot: 0 }));
  await tapAll(page, picker); // 굴리기 1(튜토리얼은 바 전 구간 성공)
  await tapAll(page, picker); // 굴리기 2
  await funeAll(page, picker);
  await page.clock.runFor(1200); // 후네가 차면 1초 기다린 뒤 서빙한다(GDD §굽기). 시계가 멈춰 있어 이 호출로만 흐른다.
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
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');

  await playTutorial(page);

  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved).toMatchObject({ version: 1, tutorialCompleted: true, finished: false });
  expect(saved.reviews).toHaveLength(1);
  expect(saved.reviews[0]).toMatchObject({ source: 'tutorial', stars: 5, personality: null });

  // 새로고침하면 튜토리얼을 건너뛴다.
  await page.reload();
  await page.clock.resume(); // 새로고침 뒤에도 시계가 멈춰 있어 rAF(HUD 갱신)가 돌도록 다시 흐르게 한다.
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-hud2')).toContainText('1단계');
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
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
});
