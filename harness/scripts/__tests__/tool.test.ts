import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../lib/common.ts';
import { loadToolset, parseToolset } from '../lib/toolset.ts';
import { buildCommand, normalizeArgs, resolveTool, runTool } from '../tool.ts';
import { TOOLSET, captureConsole, makeRepo } from './helpers.ts';

const tool = (over: Record<string, string> = {}): string => {
  const t = { id: 'x.y', run: 'echo hi', purpose: 'p', side_effect: 'none', status: 'active', ...over };
  return `version: 1\ntools:\n  - ${Object.entries(t)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n    ')}\n`;
};

describe('toolset 스키마', () => {
  it('정상 toolset을 읽는다', () => {
    const r = parseToolset(TOOLSET);
    expect(r.ok && r.toolset.tools.map((t) => t.id)).toEqual(['test.unit', 'build', 'test.e2e']);
  });

  it.each([
    ['status 오류', tool({ status: 'disabled' }), 'status'],
    ['id 형식 오류', tool({ id: 'Bad ID' }), 'id 형식'],
    ['빈 run', tool({ run: '' }), 'run'],
    ['알 수 없는 키', `${tool()}    extra: 1\n`, '알 수 없는 키'],
    ['version 없음', tool().replace('version: 1\n', ''), 'version'],
    ['YAML 오류', 'tools: [', 'YAML'],
  ])('%s → 실패', (_n, text, msg) => {
    const r = parseToolset(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain(msg);
  });

  it('중복 id → 실패', () => {
    const text = `${tool()}  - { id: x.y, run: a, purpose: p, side_effect: none, status: active }\n`;
    const r = parseToolset(text);
    expect(!r.ok && r.errors.join()).toContain('중복');
  });

  it('저장소의 harness/toolset.yaml은 §5 초기 등록 + 합의 추가(harness.index, harness.receipts)를 포함한다', () => {
    const r = loadToolset(PROJECT_ROOT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.toolset.tools.map((t) => [t.id, t.status]));
    expect(byId).toMatchObject({
      'test.unit': 'active',
      'test.e2e': 'active',
      build: 'active',
      'lint.boundary': 'active',
      'render.snapshot': 'active',
      'sim.balance': 'active',
      'dialogue.lint': 'active',
      'harness.check': 'active',
      'harness.index': 'active',
      'harness.receipts': 'active',
    });
  });
});

describe('resolveTool / 인자', () => {
  const ts = parseToolset(TOOLSET);
  if (!ts.ok) throw new Error('fixture');

  it('active → run, planned → planned, 미등록 → unknown', () => {
    expect(resolveTool(ts.toolset, 'build').kind).toBe('run');
    expect(resolveTool(ts.toolset, 'test.e2e').kind).toBe('planned');
    expect(resolveTool(ts.toolset, 'nope').kind).toBe('unknown');
  });

  it('선두 -- 만 제거하고 인자를 따옴표 처리한다', () => {
    expect(normalizeArgs(['--', '--full'])).toEqual(['--full']);
    expect(normalizeArgs(['--full', '--'])).toEqual(['--full', '--']);
    const t = ts.toolset.tools[0];
    if (t === undefined) throw new Error('fixture');
    expect(buildCommand(t, ['--file', "a b'c"])).toBe(`echo unit --file 'a b'\\''c'`);
  });
});

describe('runTool', () => {
  it('미등록 ID는 거부(exit 1)', () => {
    const c = captureConsole();
    const root = makeRepo({ 'harness/toolset.yaml': TOOLSET });
    expect(runTool(root, ['nope'])).toBe(1);
    expect(c.err()).toContain('미등록 도구 ID: nope');
  });

  it('planned ID는 실행 거부(exit 1)', () => {
    const c = captureConsole();
    const root = makeRepo({ 'harness/toolset.yaml': TOOLSET });
    expect(runTool(root, ['test.e2e'])).toBe(1);
    expect(c.err()).toContain('실행 거부: test.e2e');
  });

  it('ID 없음 → 사용법(exit 1)', () => {
    const c = captureConsole();
    const root = makeRepo({ 'harness/toolset.yaml': TOOLSET });
    expect(runTool(root, [])).toBe(1);
    expect(c.err()).toContain('사용법');
  });

  it('toolset.yaml 없음 → exit 1', () => {
    captureConsole();
    expect(runTool(makeRepo(), ['build'])).toBe(1);
  });

  it('active ID는 run을 실행하고 인자·종료코드를 전달한다', () => {
    const root = makeRepo({ 'harness/toolset.yaml': tool({ run: "sh -c 'exit $#' x" }) });
    expect(runTool(root, ['x.y'])).toBe(0);
    expect(runTool(root, ['x.y', '--', 'a', 'b c'])).toBe(2);
  });

  it('마지막 줄에 `[tool] <id> exit=<코드>`를 출력한다', () => {
    const c = captureConsole();
    const root = makeRepo({ 'harness/toolset.yaml': tool({ run: "sh -c 'exit $#' x" }) });
    runTool(root, ['x.y']);
    runTool(root, ['x.y', '--', 'a']);
    expect(c.out().split('\n')).toEqual(['[tool] x.y exit=0', '[tool] x.y exit=1']);
  });
});
