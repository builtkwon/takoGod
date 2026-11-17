// render.snapshot: sandbox.states.json의 상태마다 dev 서버의 sandbox.html?state=<name>을 모바일 뷰포트로 캡처한다.
// 원본: docs/harness-design.md §3 도구 연결 규약, §5. 계약: src/contracts/tooling.ts (SandboxStates)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_ENTRY_PATHS } from '../../src/contracts/tooling.ts';
import { PROJECT_ROOT, exists, isMain, isStringArray, missingTarget, readText } from './lib/common.ts';

export const STATES_PATH = TOOL_ENTRY_PATHS.sandboxStates;
export const SANDBOX_PAGE = TOOL_ENTRY_PATHS.sandboxPage;
export const OUT_DIR = '.artifacts/snapshots';
/** 모바일 세로 뷰포트(iPhone 13 기준). */
export const MOBILE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3 } as const;

const STATE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type StatesResult = { readonly ok: true; readonly states: string[] } | { readonly ok: false; readonly error: string };

export function parseStates(text: string): StatesResult {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON 파싱 실패: ${(e as Error).message}` };
  }
  if (!isStringArray(v)) return { ok: false, error: '상태 이름(문자열) 배열이어야 한다' };
  if (v.length === 0) return { ok: false, error: '상태가 비어 있다' };
  const bad = v.filter((s) => !STATE_NAME_RE.test(s));
  if (bad.length > 0) return { ok: false, error: `상태 이름 형식 오류(영숫자·_·-): ${bad.join(', ')}` };
  const dup = v.filter((s, i) => v.indexOf(s) !== i);
  if (dup.length > 0) return { ok: false, error: `중복 상태: ${[...new Set(dup)].join(', ')}` };
  return { ok: true, states: v };
}

export interface Server {
  readonly baseUrl: string;
  close(): Promise<void>;
}

export interface Browser {
  shot(url: string, outPath: string): Promise<void>;
  close(): Promise<void>;
}

export interface SnapshotDeps {
  readonly serve: (root: string) => Promise<Server>;
  readonly openBrowser: () => Promise<Browser>;
}

async function viteServe(root: string): Promise<Server> {
  const { createServer } = await import('vite');
  const server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen();
  const baseUrl = server.resolvedUrls?.local[0];
  if (baseUrl === undefined) {
    await server.close();
    throw new Error('dev 서버 URL을 얻지 못함');
  }
  return { baseUrl, close: () => server.close() };
}

async function playwrightBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height },
    deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  return {
    async shot(url, outPath) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.screenshot({ path: outPath });
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}

export const defaultDeps: SnapshotDeps = { serve: viteServe, openBrowser: playwrightBrowser };

export function stateUrl(baseUrl: string, state: string): string {
  return new URL(`${SANDBOX_PAGE}?state=${encodeURIComponent(state)}`, baseUrl).href;
}

export async function runSnapshot(root: string, deps: SnapshotDeps = defaultDeps): Promise<number> {
  const text = readText(root, STATES_PATH);
  if (text === undefined) return missingTarget(STATES_PATH);
  if (!exists(root, SANDBOX_PAGE)) return missingTarget(SANDBOX_PAGE);
  const parsed = parseStates(text);
  if (!parsed.ok) {
    console.error(`${STATES_PATH}: ${parsed.error}`);
    return 1;
  }
  mkdirSync(join(root, OUT_DIR), { recursive: true });
  let server: Server | undefined;
  let browser: Browser | undefined;
  try {
    server = await deps.serve(root);
    try {
      browser = await deps.openBrowser();
    } catch (e) {
      console.error(`브라우저 실행 실패: ${(e as Error).message}\n(Chromium 미설치라면: pnpm exec playwright install chromium)`);
      return 1;
    }
    for (const state of parsed.states) {
      const out = `${OUT_DIR}/${state}.png`;
      await browser.shot(stateUrl(server.baseUrl, state), join(root, out));
      console.log(`캡처: ${out}`);
    }
    console.log(`완료: ${parsed.states.length}개 상태 → ${OUT_DIR}/`);
    return 0;
  } catch (e) {
    console.error(`캡처 실패: ${(e as Error).message}`);
    return 1;
  } finally {
    await browser?.close();
    await server?.close();
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runSnapshot(PROJECT_ROOT);
}
