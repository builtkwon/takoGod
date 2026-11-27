// 원본: docs/rules/development/testing.md#e2e, docs/GDD.md §튜토리얼, §제품
import { expect, test, type Page } from '@playwright/test';
import type { PickTarget, ScenePicker } from '../src/contracts';
import { createScenePicker } from '../src/render/pick';

const KEY = 'takoyaki:session';
const BEST_KEY = 'takoyaki:best';

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

test('버전 라벨: 타이틀 .ui-version이 "v버전 · 7자리 또는 dev"다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ui-version')).toHaveText(/^v\d+\.\d+\.\d+ · ([0-9a-f]{7}|dev)$/);
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
  await expect(page.locator('.ui-hud-fumed')).toBeHidden();

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
  await expect(page.locator('.ui-hud-best')).toHaveText('최고 -');
  await expect(page.locator('.ui-hud-new')).toBeHidden();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  await expect(page.locator('.ui-hud-score')).toHaveText('0');
  expect(errors).toEqual([]);
});

/** 최고 기록 값을 넣고(키가 비어 있으면 한 번 방문해 origin을 연다) 새로고침해 시작 화면까지 간다. */
async function startWithBest(page: Page, raw: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [BEST_KEY, raw]);
  await page.evaluate((k) => sessionStorage.setItem(k, '{"version":1,"tutorialCompleted":true,"finished":false,"reviews":[]}'), KEY);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
}

test('최고 기록: 저장된 값이 HUD 왼쪽에 "최고 1234"로 보인다', async ({ page }) => {
  await startWithBest(page, '{"version":1,"best":1234}');
  await expect(page.locator('.ui-hud-left')).toContainText('최고 1234');
  expect(await page.evaluate((k) => localStorage.getItem(k), BEST_KEY)).toBe('{"version":1,"best":1234}');
});

test('최고 기록: 손상 값이면 "최고 -"이고 키가 지워진다', async ({ page }) => {
  await startWithBest(page, '{"version":1,"best":-5}');
  await expect(page.locator('.ui-hud-left')).toContainText('최고 -');
  expect(await page.evaluate((k) => localStorage.getItem(k), BEST_KEY)).toBeNull();
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
  await expect(page.getByRole('heading', { name: '영업 종료' })).toBeVisible();
  await expect(page.getByText('받은 리뷰 2개')).toBeVisible();
});

const PROFILE_KEY = 'takoyaki:profile';

test('결과 화면 다시 하기: 새 판이 1단계·점수 0·리뷰 0으로 시작하고 최고 기록은 유지된다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const reviews = [{ source: 'customer', stars: 3, comment: '무난', personality: 'gourmet' }];
  await page.evaluate(
    ([k, r, b, pk]) => {
      sessionStorage.setItem(k as string, JSON.stringify({ version: 1, tutorialCompleted: true, finished: true, reviews: r }));
      localStorage.setItem(b as string, '{"version":1,"best":1234}');
      localStorage.setItem(pk as string, '{"version":1,"tutorialCompleted":true}');
    },
    [KEY, reviews, BEST_KEY, PROFILE_KEY],
  );
  await page.reload();
  await page.clock.resume();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.getByRole('heading', { name: '영업 종료' })).toBeVisible();
  await page.getByRole('button', { name: '다시 하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '영업 종료' })).toBeHidden();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  await expect(page.locator('.ui-hud-score')).toHaveText('0');
  await expect(page.locator('.ui-hud2')).not.toContainText('튜토리얼');
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved?.finished).not.toBe(true);
  expect(saved?.reviews ?? []).toHaveLength(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), BEST_KEY)).toBe('{"version":1,"best":1234}');
  expect(errors).toEqual([]);
});

test('튜토리얼 완료 기억: 완료하면 profile이 쓰이고, 세션 저장값이 없는 새 탭은 튜토리얼 없이 1단계에 리뷰 0이다', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  await playTutorial(page);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY)).toBe('{"version":1,"tutorialCompleted":true}');

  // 새 탭 흉내: 세션 저장값만 비우고 다시 연다(localStorage는 남는다).
  await page.evaluate((k) => sessionStorage.removeItem(k), KEY);
  await page.reload();
  await page.clock.resume();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  await expect(page.locator('.ui-hud2')).not.toContainText('튜토리얼');
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved?.reviews ?? []).toHaveLength(0); // 튜토리얼 5★ 리뷰를 주지 않는다
  expect(errors).toEqual([]);
});

test('타이틀 튜토리얼 버튼: 처음 방문에는 없다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: '튜토리얼', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '튜토리얼 건너뛰기' })).toBeVisible();
});

test('튜토리얼 건너뛰기(타이틀): 1단계·리뷰 0으로 시작하고, 새로고침하면 타이틀에 튜토리얼 버튼이 있다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: '튜토리얼 건너뛰기' }).click();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved?.reviews ?? []).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '튜토리얼', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('튜토리얼 건너뛰기(튜토리얼 중): 건너뛰기 → 예 → 1단계', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
  await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await page.getByRole('button', { name: '예' }).click();
  await page.clock.runFor(100); // 시계가 멈춰 있어 HUD 갱신 프레임을 돌린다
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  expect(errors).toEqual([]);
});

test('타이틀 튜토리얼 버튼: 튜토리얼 완료 뒤 새로고침하면 버튼이 있고, 누르면 튜토리얼부터 다시 시작한다', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  await playTutorial(page);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();

  await page.reload();
  await page.clock.resume();
  await page.getByRole('button', { name: '튜토리얼' }).click();
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
  expect(await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY)).toBe('{"version":1,"tutorialCompleted":true}');
  expect(errors).toEqual([]);
});

test('타이틀 튜토리얼 버튼: 다시 한 튜토리얼을 끝내면 5★ 리뷰가 정확히 1개다(입력이 두 번 처리되지 않는다)', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  await playTutorial(page);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();

  await page.reload();
  await page.clock.resume();
  await page.getByRole('button', { name: '튜토리얼' }).click();
  await playTutorial(page);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), KEY);
  expect(saved?.reviews).toHaveLength(1);
  expect(saved?.reviews[0].stars).toBe(5);
  expect(errors).toEqual([]);
});

test('튜토리얼 완료 기억: profile이 손상 값이면 튜토리얼부터 시작하고 키가 지워진다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => localStorage.setItem(k, '{"version":1,"tutorialCompleted":"yes"}'), PROFILE_KEY);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
  expect(await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY)).toBeNull();
});

test('손상된 저장값은 버리고 튜토리얼부터 시작한다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => sessionStorage.setItem(k, '{"version":1,"tutorialCompleted":true,"finished":false,"reviews":[null]}'), KEY);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
});

test('속재료 탭 선택: 트레이 칸을 탭하면 선택되고 구멍을 탭하면 넣어지고 선택이 풀린다(튜토리얼을 탭만으로 끝낸다)', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  const picker = await scenePicker(page);
  await dragAll(page, picker, () => center(page, '.ui-bucket-margarine'));
  await dragAll(page, picker, () => center(page, '.ui-bucket-batter'));
  await page.clock.runFor(3500);
  const tray = at(picker, { kind: 'tray', slot: 0 });
  for (const i of OPEN) {
    await page.mouse.click(tray.x, tray.y);
    await page.clock.runFor(50); // 시계가 멈춰 있어 라벨 갱신 프레임은 이 호출로 돈다
    await expect(page.locator('.ui-tray-label-selected')).toHaveCount(1);
    const p = at(picker, { kind: 'hole', index: i });
    await page.mouse.click(p.x, p.y);
    await page.clock.runFor(50);
    await expect(page.locator('.ui-tray-label-selected')).toHaveCount(0); // 한 칸 넣으면 해제
  }
  await tapAll(page, picker);
  await tapAll(page, picker);
  await funeAll(page, picker);
  await page.clock.runFor(1200);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible(); // 넣기가 실제로 먹혔다는 증거
  expect(errors).toEqual([]);
});

test('결과 화면 다시 하기: 새 판에 이전 판 말풍선·답 버튼이 없다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ([k, p]) => {
      sessionStorage.setItem(k as string, '{"version":1,"tutorialCompleted":true,"finished":true,"reviews":[]}');
      localStorage.setItem(p as string, '{"version":1,"tutorialCompleted":true}');
    },
    [KEY, PROFILE_KEY],
  );
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByRole('button', { name: '다시 하기', exact: true }).click();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  await expect(page.locator('.ui-bubble')).toHaveCount(0);
  await expect(page.locator('.ui-answer')).toHaveCount(0);
});

async function startMainGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((pk) => localStorage.setItem(pk, '{"version":1,"tutorialCompleted":true}'), PROFILE_KEY);
  await page.reload();
  await page.getByRole('button', { name: '시작' }).click();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  // 다시 하기가 세션 저장값을 지웠는지 보려는 표식(판이 이어지면 그대로 남는다).
  await page.evaluate((k) => sessionStorage.setItem(k, 'marker'), KEY);
}

const marker = (page: Page): Promise<string | null> => page.evaluate((k) => sessionStorage.getItem(k), KEY);

test('게임 중 다시 하기: 확인에서 예를 누르면 1단계·점수 0·리뷰 0으로 처음부터 시작한다', async ({ page }) => {
  const errors = collectErrors(page);
  await startMainGame(page);
  await page.getByRole('button', { name: '↻ 다시 하기' }).click();
  await page.getByRole('button', { name: '예', exact: true }).click();
  await expect(page.getByRole('button', { name: '예', exact: true })).toBeHidden();
  expect(await marker(page)).not.toBe('marker');
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  await expect(page.locator('.ui-hud-score')).toHaveText('0');
  await expect(page.locator('.ui-hud-reviews')).toHaveText('리뷰 0');
  expect(errors).toEqual([]);
});

test('게임 중 다시 하기: 확인에서 아니오를 누르면 그대로 이어진다', async ({ page }) => {
  await startMainGame(page);
  await page.getByRole('button', { name: '↻ 다시 하기' }).click();
  await page.getByRole('button', { name: '아니오' }).click();
  await expect(page.getByRole('button', { name: '아니오' })).toBeHidden();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  expect(await marker(page)).toBe('marker');
});

test('게임 중 다시 하기: 확인 창이 떠 있는 동안 게임 시간이 흐르지 않고, 아니오 뒤 다시 흐른다', async ({ page }) => {
  await page.clock.install({ time: T0 });
  await startMainGame(page);
  await page.clock.pauseAt(new Date(T0.getTime() + 5000));
  // 게임 시간의 관찰값: 타이밍 바 마커 위치(누적 dt / 주기). tick이 돌 때만 움직인다.
  const marker = () => page.locator('.ui-bar-marker').evaluate((m) => (m as HTMLElement).style.left);
  await page.clock.runFor(1234);
  await page.getByRole('button', { name: '↻ 다시 하기' }).click();
  await page.clock.runFor(100); // 모달이 열린 프레임이 돌게 한다
  const before = await marker();
  await page.clock.runFor(7777); // 모달이 열린 채 수 초
  expect(await marker()).toBe(before);
  await page.getByRole('button', { name: '아니오' }).click();
  await page.clock.runFor(1234);
  expect(await marker()).not.toBe(before);
});

test('게임 중 다시 하기: 튜토리얼 중에는 버튼이 없다', async ({ page }) => {
  await start(page);
  await expect(page.locator('.ui-hud2')).toContainText('튜토리얼');
  await expect(page.getByRole('button', { name: '↻ 다시 하기' })).toBeHidden();
});

test('튜토리얼 속재료 탭 안내: 탭 링이 뜨고, 문어 칸 탭 → 구멍 탭으로 속재료 단계를 끝낸다', async ({ page }) => {
  const errors = collectErrors(page);
  await start(page);
  const picker = await scenePicker(page);
  await dragAll(page, picker, () => center(page, '.ui-bucket-margarine'));
  await dragAll(page, picker, () => center(page, '.ui-bucket-batter'));
  await page.clock.runFor(3550);
  await expect(page.locator('.ui-tap-ring')).toBeVisible();
  const tray = at(picker, { kind: 'tray', slot: 0 });
  for (const i of OPEN) {
    await page.mouse.click(tray.x, tray.y);
    await page.clock.runFor(50);
    const p = at(picker, { kind: 'hole', index: i });
    await page.mouse.click(p.x, p.y);
    await page.clock.runFor(50);
  }
  await tapAll(page, picker);
  await tapAll(page, picker);
  await funeAll(page, picker);
  await page.clock.runFor(1200);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('답 버튼: 2단계 손님이 말을 걸면 화면 아래 고정 영역(.ui-answers)에 뜨고, 누르면 줄이 사라진다', async ({ page }) => {
  await start(page);
  await playTutorial(page);
  await expect(page.getByRole('heading', { name: '튜토리얼 완료!' })).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.ui-hud-phase')).toHaveText('1단계');
  // 1단계: 접시 1개를 완성하면 2단계다(GDD §진행). 속재료·굴리기 품질은 단계 전환과 무관하다.
  const picker = await scenePicker(page);
  await dragAll(page, picker, () => center(page, '.ui-bucket-margarine'));
  await dragAll(page, picker, () => center(page, '.ui-bucket-batter'));
  await page.clock.runFor(3500);
  await dragAll(page, picker, async () => at(picker, { kind: 'tray', slot: 0 }));
  await tapAll(page, picker);
  await tapAll(page, picker);
  await funeAll(page, picker);
  await page.clock.runFor(1200);
  await expect(page.locator('.ui-hud-phase')).toHaveText('2단계');
  await page.clock.runFor(13000); // 손님 입장 뒤 첫 대화(간격 12s)
  const row = page.locator('.ui-answers .ui-answer-row');
  await expect(row).toHaveCount(1);
  const b = (await row.boundingBox())!;
  expect(b.y).toBeGreaterThan(page.viewportSize()!.height / 2); // 화면 아래쪽
  await row.locator('.ui-answer').first().click();
  await expect(row).toHaveCount(0);
});
