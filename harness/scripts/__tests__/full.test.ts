import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck, type Io } from '../harness-check.ts';
import { runFull, parsePlacement, latestProposal, type CheckResult } from '../lib/full.ts';
import { PROJECT_ROOT } from '../lib/common.ts';
import { typecheckHarness } from '../lib/typecheck.ts';
import { renderIndex } from '../lib/index-gen.ts';
import { INDEX_PATH, loadModel } from '../lib/model.ts';
import { collectSummary, formatSummary } from '../lib/summary.ts';
import { genIndex } from '../gen-index.ts';
import { TOOLSET, agentMd, captureConsole, git, makeGitRepo, makeRepo, skillMd, writeFiles, type SkillSpec, type AgentSpec } from './helpers.ts';

const skill = (spec: SkillSpec): Record<string, string> => ({ [`.claude/skills/${spec.name}/SKILL.md`]: skillMd(spec) });
const agent = (spec: AgentSpec): Record<string, string> => ({ [`.claude/agents/${spec.name}.md`]: agentMd(spec) });

/** 정상 기준 저장소: 스킬 2개(b requires a), 에이전트 1개, INDEX 최신. */
function baseFiles(): Record<string, string> {
  return {
    'harness/toolset.yaml': TOOLSET,
    ...skill({ name: 'alpha', steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }),
    ...skill({ name: 'beta', requires: ['alpha'], consumes: ['TODO-CONTRACT.md'], steps: { S1: ['build'] } }),
    ...agent({ name: 'core-dev', skills: ['alpha', 'beta'], allowed_tools: ['test.unit', 'build'] }),
  };
}

function repo(over: Record<string, string> = {}, withIndex = true): string {
  const root = makeRepo({ ...baseFiles(), ...over });
  if (withIndex) writeFiles(root, { [INDEX_PATH]: renderIndex(loadModel(root)) });
  return root;
}

/** MUST + 단계 본문에 text를 넣는다. */
function bodyWith(text: string, steps: readonly string[] = ['S1']): string {
  return ['## MUST', '', '- 규칙', '', '## 단계', '', ...steps.map((st) => `- ${st} ${text}`)].join('\n');
}

const get = (results: readonly CheckResult[], name: string): CheckResult => {
  const r = results.find((x) => x.name === name);
  if (r === undefined) throw new Error(`no check ${name}`);
  return r;
};

function status(root: string, name: string): [string, string] {
  const r = get(runFull(root), name);
  return [r.status, r.messages.join('\n')];
}

describe('full: 정상 기준', () => {
  it('모든 검사 통과', () => {
    const results = runFull(repo());
    expect(results.filter((r) => r.status === 'fail' || r.status === 'warn')).toEqual([]);
  });

  it('스킬 0개 + INDEX 없음은 통과', () => {
    const root = makeRepo({ 'harness/toolset.yaml': TOOLSET, ...agent({ name: 'harness-gardener', owns: ['harness/**'] }) });
    expect(runFull(root).filter((r) => r.status === 'fail')).toEqual([]);
  });
});

describe('full: 검사 항목별 실패', () => {
  it('format: 파일 하나라도 실패하면 실패', () => {
    const [s, m] = status(repo(skill({ name: 'alpha', must: [] })), 'format');
    expect(s).toBe('fail');
    expect(m).toContain('MUST 항목 없음');
  });

  it('format: SKILL.md 없는 스킬 디렉터리 실패', () => {
    const [s, m] = status(repo({ '.claude/skills/empty/references/a.md': 'x\n' }), 'format');
    expect(s).toBe('fail');
    expect(m).toContain('SKILL.md 없음');
  });

  it('toolset: 파싱 실패', () => {
    expect(status(repo({ 'harness/toolset.yaml': 'tools: [' }), 'toolset')[0]).toBe('fail');
  });

  it('agent → skill: 없는 스킬', () => {
    const [s, m] = status(repo(agent({ name: 'core-dev', skills: ['alpha', 'beta', 'ghost'], allowed_tools: ['test.unit', 'build'] })), 'agent → skill');
    expect(s).toBe('fail');
    expect(m).toContain('없는 스킬 ghost');
  });

  it('agent → skill: 메타 스킬을 skills에 넣으면 실패', () => {
    const meta = { 'harness/meta-skills/harness-design/SKILL.md': skillMd({ name: 'harness-design' }) };
    const root = repo({ ...meta, ...agent({ name: 'g', skills: ['harness-design'], allowed_tools: ['test.unit'] }) });
    expect(status(root, 'agent → skill')).toEqual(['fail', expect.stringContaining('메타 스킬')]);
  });

  it('skill → tool: toolset에 없는 ID (스킬·allowed_tools·메타 스킬)', () => {
    const root = repo({
      ...skill({ name: 'alpha', steps: { S1: ['ghost.tool'] }, produces: ['TODO-CONTRACT.md'] }),
      'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm', steps: { S1: ['meta.ghost'] } }),
      ...agent({ name: 'core-dev', skills: ['alpha', 'beta'], allowed_tools: ['build', 'ghost.tool', 'x.ghost'] }),
    });
    const [s, m] = status(root, 'skill → tool');
    expect(s).toBe('fail');
    expect(m).toContain('alpha.S1: toolset에 없는 ID ghost.tool');
    expect(m).toContain('m.S1: toolset에 없는 ID meta.ghost');
    expect(m).toContain('allowed_tools: toolset에 없는 ID x.ghost');
  });

  it('도구 허용: 스킬 도구 합집합 ⊄ allowed_tools', () => {
    const [s, m] = status(repo(agent({ name: 'core-dev', skills: ['alpha', 'beta'], allowed_tools: ['test.unit'] })), '도구 허용');
    expect(s).toBe('fail');
    expect(m).toContain('build ⊄ allowed_tools');
  });

  it('requires: 없는 스킬', () => {
    const [s, m] = status(repo(skill({ name: 'beta', requires: ['ghost'], consumes: ['TODO-CONTRACT.md'], steps: { S1: ['build'] } })), 'requires');
    expect(s).toBe('fail');
    expect(m).toContain('없는 스킬 requires ghost');
  });

  it('requires: 순환', () => {
    const root = repo(skill({ name: 'alpha', requires: ['beta'], steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }));
    const [s, m] = status(root, 'requires');
    expect(s).toBe('fail');
    expect(m).toMatch(/순환: (alpha → beta → alpha|beta → alpha → beta)/);
  });

  it('requires: 자기 자신 순환', () => {
    const root = repo(skill({ name: 'alpha', requires: ['alpha'], steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }));
    expect(status(root, 'requires')[1]).toContain('순환: alpha → alpha');
  });

  it('requires: 다른 에이전트 스킬', () => {
    const root = repo({
      ...agent({ name: 'core-dev', skills: ['beta'], allowed_tools: ['build'] }),
      ...agent({ name: 'ui-dev', skills: ['alpha'], allowed_tools: ['test.unit'] }),
    });
    const [s, m] = status(root, 'requires');
    expect(s).toBe('fail');
    expect(m).toContain('core-dev: beta가 requires하는 alpha이 같은 에이전트에 없다');
  });

  it('requires: 3개 이상', () => {
    const root = repo({
      ...skill({ name: 'c1' }),
      ...skill({ name: 'c2' }),
      ...skill({ name: 'beta', requires: ['alpha', 'c1', 'c2'], consumes: ['TODO-CONTRACT.md'], steps: { S1: ['build'] } }),
    });
    // 3개 이상은 스키마(format)에서 걸리고 스킬이 로딩되지 않는다
    expect(status(root, 'format')).toEqual(['fail', expect.stringContaining('requires 3개 > 2개')]);
  });

  it('consumes: 생산자 없음', () => {
    const root = repo(skill({ name: 'alpha', steps: { S1: ['test.unit'] } }));
    const [s, m] = status(root, 'consumes');
    expect(s).toBe('fail');
    expect(m).toContain('beta: consumes TODO-CONTRACT.md의 생산자 없음');
  });

  it('INDEX 최신성: 오래된 INDEX 실패 + gen-index 안내', () => {
    const root = repo();
    writeFiles(root, skill({ name: 'alpha', version: 2, steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }));
    const [s, m] = status(root, 'INDEX 최신성');
    expect(s).toBe('fail');
    expect(m).toContain('pnpm tool harness.index');
  });

  it('INDEX 최신성: 스킬이 있는데 INDEX 없음 실패', () => {
    expect(status(repo({}, false), 'INDEX 최신성')[0]).toBe('fail');
  });

  it('고아: 배치 안 된 스킬은 경고(메타 제외)', () => {
    const root = repo({ ...skill({ name: 'lonely' }), 'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm' }) });
    expect(status(root, '고아')).toEqual(['warn', '배치 안 된 스킬: lonely']);
  });

  it('승인안 diff: 제안표 없으면 skip, 일치 ok, 불일치 warn', () => {
    expect(status(repo(), '승인안 diff')[0]).toBe('skip');
    const table = (skills: string): string =>
      `# 제안\n\n| 에이전트 | owns | skills |\n| --- | --- | --- |\n| core-dev | src/core | ${skills} |\n| harness-gardener | harness/ | (meta) harness-design |\n`;
    const okRoot = repo({ 'harness/proposals/0001-init.md': table('alpha, beta'), ...agent({ name: 'harness-gardener' }) });
    expect(status(okRoot, '승인안 diff')[0]).toBe('ok');
    const diffRoot = repo({
      'harness/proposals/0001-init.md': table('alpha, beta'),
      'harness/proposals/0002-next.md': table('alpha, gamma'),
    });
    const [s, m] = status(diffRoot, '승인안 diff');
    expect(s).toBe('warn');
    expect(m).toContain('0002-next.md');
    expect(m).toContain('누락 gamma');
    expect(m).toContain('제안표에 없는 스킬 beta');
    expect(m).toContain('harness-gardener: 제안표에 있으나 생성되지 않음');
  });

  it('승인안 diff: 배치표 없는 제안표는 경고', () => {
    expect(status(repo({ 'harness/proposals/0001-x.md': '# 표 없음\n' }), '승인안 diff')[0]).toBe('warn');
  });

  it('제안표 파일명: NNNN-<kebab>.md 아니면 실패, 번호 중복 실패, 숨김 파일 무시', () => {
    const ok = repo({ 'harness/proposals/0001-initial-placement.md': '# x\n', 'harness/proposals/.gitkeep': '' });
    expect(status(ok, '제안표 파일명')[0]).toBe('ok');
    for (const bad of ['0001-주제.md', '1-init.md', '0001_init.md', '0001-Init.md', '0001-init.txt', '0001-.md', 'notes.md', '0001-a--b.md']) {
      const [s, m] = status(repo({ [`harness/proposals/${bad}`]: '# x\n' }), '제안표 파일명');
      expect([bad, s]).toEqual([bad, 'fail']);
      expect(m).toContain('NNNN-<kebab>.md');
    }
    const dup = repo({ 'harness/proposals/0002-a.md': '# x\n', 'harness/proposals/0002-b.md': '# y\n' });
    expect(status(dup, '제안표 파일명')).toEqual(['fail', expect.stringContaining('번호 0002')]);
  });

  it('승인안 diff는 형식에 맞는 최신 제안표만 읽는다', () => {
    const root = repo({ 'harness/proposals/0001-init.md': '# x\n', 'harness/proposals/9999-주제.md': '# y\n' });
    expect(latestProposal(root)).toBe('harness/proposals/0001-init.md');
  });

  it('본문 도구 호출: toolset에 없는 ID 실패', () => {
    const root = repo(skill({ name: 'alpha', steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'], body: bodyWith('pnpm tool ghost.tool') }));
    const [s, m] = status(root, '본문 도구 호출');
    expect(s).toBe('fail');
    expect(m).toContain('.claude/skills/alpha/SKILL.md: pnpm tool ghost.tool — toolset에 없는 ID');
  });

  it('본문 도구 호출: 배치 에이전트 allowed_tools에 없으면 실패(스킬·references·에이전트 본문)', () => {
    const root = repo({
      ...skill({ name: 'alpha', steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'], body: bodyWith('`pnpm tool test.e2e -- --x`') }),
      '.claude/skills/beta/references/sub/r.md': '조건 → pnpm tool test.e2e\n',
      ...agent({ name: 'core-dev', skills: ['alpha', 'beta'], allowed_tools: ['test.unit', 'build'], body: '검증은 `pnpm tool test.e2e`, `pnpm tool <id>`' }),
    });
    const [s, m] = status(root, '본문 도구 호출');
    expect(s).toBe('fail');
    expect(m).toContain('.claude/skills/alpha/SKILL.md: pnpm tool test.e2e — core-dev의 allowed_tools에 없다');
    expect(m).toContain('.claude/skills/beta/references/sub/r.md: pnpm tool test.e2e — core-dev의 allowed_tools에 없다');
    expect(m).toContain('.claude/agents/core-dev.md: pnpm tool test.e2e — core-dev의 allowed_tools에 없다');
    expect(m).not.toContain('<id>');
  });

  it('본문 도구 호출: 메타 스킬은 본문에서 경로로 안내하는 에이전트와 대조', () => {
    const meta = { 'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm', steps: { S1: [], S2: [] }, body: bodyWith('pnpm tool build', ['S1', 'S2']) }) };
    const gardener = (tools: string[]): Record<string, string> =>
      agent({ name: 'g', allowed_tools: tools, body: '열 파일: `harness/meta-skills/m/SKILL.md`' });
    expect(status(repo({ ...meta, ...gardener(['build']) }), '본문 도구 호출')[0]).toBe('ok');
    expect(status(repo({ ...meta, ...gardener(['test.unit']) }), '본문 도구 호출')).toEqual([
      'fail',
      'harness/meta-skills/m/SKILL.md: pnpm tool build — g의 allowed_tools에 없다',
    ]);
  });

  it('parsePlacement: 백틱·(meta)·- 처리', () => {
    const md = '| 에이전트 | skills |\n|---|---|\n| `a` | `x`, y |\n| b | - |\n| c | (meta) z |\n';
    expect(Object.fromEntries(parsePlacement(md) ?? [])).toEqual({ a: ['x', 'y'], b: [], c: [] });
  });
});

describe('harness-check --full CLI', () => {
  const io = (): Io & { outs: string[] } => {
    const outs: string[] = [];
    return { readStdin: () => '', out: (s) => void outs.push(s), err: () => {}, outs };
  };

  it('통과 exit 0, 실패 exit 1', () => {
    const ok = io();
    expect(runCheck(repo(), ['--full', '--no-write'], ok)).toBe(0);
    expect(ok.outs.join()).toContain('harness full: 통과');
    const bad = io();
    expect(runCheck(repo(agent({ name: 'core-dev', skills: ['ghost'] })), ['--', '--full'], bad)).toBe(1);
    expect(bad.outs.join()).toContain('[FAIL] agent → skill');
  });

  it('파일을 쓰지 않는다(오래된 INDEX도 그대로)', () => {
    const root = repo({}, false);
    runCheck(root, ['--full', '--no-write'], io());
    expect(existsSync(join(root, INDEX_PATH))).toBe(false);
  });
});

describe('full: harness 타입 검사', () => {
  const TSCONFIG = JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, types: [], lib: ['ES2022'], module: 'ESNext', moduleResolution: 'bundler' },
    include: ['scripts/**/*.ts'],
  });

  it('타입 오류 픽스처 → 실패, 정상 → 통과, tsconfig 없음 → skip', () => {
    const bad = repo({ 'harness/tsconfig.json': TSCONFIG, 'harness/scripts/bad.ts': 'export const n: number = "문자열";\n' });
    const [s, m] = status(bad, 'harness 타입');
    expect(s).toBe('fail');
    expect(m).toMatch(/bad\.ts.*TS2322/);
    const io = { readStdin: () => '', out: () => {}, err: () => {} };
    expect(runCheck(bad, ['--full', '--no-write'], io)).toBe(1);

    const good = repo({ 'harness/tsconfig.json': TSCONFIG, 'harness/scripts/ok.ts': 'export const n: number = 1;\n' });
    expect(status(good, 'harness 타입')[0]).toBe('ok');
    expect(status(repo(), 'harness 타입')[0]).toBe('skip');
  });

  it('저장소의 harness 스크립트는 타입 검사를 통과한다', () => {
    expect(typecheckHarness(PROJECT_ROOT)).toEqual({ status: 'ok', messages: [] });
  });
});

describe('harness-check --full --staged (pre-commit)', () => {
  const io = (): Io & { outs: string[]; errs: string[] } => {
    const outs: string[] = [];
    const errs: string[] = [];
    return { readStdin: () => '', out: (s) => void outs.push(s), err: (s) => void errs.push(s), outs, errs };
  };

  it('작업 트리가 아니라 스테이지된 내용을 검사한다(INDEX 최신성)', () => {
    const root = makeGitRepo(baseFiles());
    writeFiles(root, { [INDEX_PATH]: renderIndex(loadModel(root)) });
    git(root, ['add', '-A']);
    // 스테이지: 최신 INDEX. 작업 트리: 스킬 version만 올려 INDEX를 낡게 만든다(스테이지 안 함).
    writeFiles(root, skill({ name: 'alpha', version: 2, steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }));
    expect(get(runFull(root), 'INDEX 최신성').status).toBe('fail');
    const ok = io();
    expect(runCheck(root, ['--full', '--no-write', '--staged'], ok)).toBe(0);
    expect(ok.outs.join('\n')).toContain('스테이지된 내용 기준');

    // 반대로: 스킬 변경은 스테이지, INDEX 재생성은 작업 트리에만 → 커밋될 내용은 낡았다.
    git(root, ['add', '-A']);
    writeFiles(root, { [INDEX_PATH]: renderIndex(loadModel(root)) });
    expect(get(runFull(root), 'INDEX 최신성').status).toBe('ok');
    const bad = io();
    expect(runCheck(root, ['--full', '--no-write', '--staged'], bad)).toBe(1);
    expect(bad.outs.join('\n')).toContain('[FAIL] INDEX 최신성');
  });

  it('임시 디렉터리를 지우고 작업 트리를 건드리지 않는다', () => {
    const root = makeGitRepo(baseFiles());
    git(root, ['add', '-A']);
    const before = snapshotTree(root);
    runCheck(root, ['--full', '--no-write', '--staged'], io());
    expect(snapshotTree(root)).toEqual(before);
  });

  it('git 저장소가 아니면 exit 1', () => {
    const e = io();
    expect(runCheck(makeRepo(baseFiles()), ['--full', '--staged'], e)).toBe(1);
    expect(e.errs.join()).toContain('git checkout-index 실패');
  });
});

function snapshotTree(root: string): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[p] = statSync(p).mtimeMs;
    }
  };
  walk(root);
  return out;
}

describe('summary', () => {
  it('스킬 수, 80% 근접 파일, planned 도구를 출력하고 파일을 쓰지 않는다', () => {
    const root = repo({
      ...skill({ name: 'big', padAfter: 90 }),
      ...skill({ name: 'longdesc', description: '가'.repeat(170) }),
      '.claude/skills/big/references/r.md': 'a\n'.repeat(165),
      'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm' }),
    });
    const before = snapshotTree(root);
    const s = collectSummary(root);
    expect(s.skillCount).toBe(4);
    expect(s.metaSkillCount).toBe(1);
    expect(s.plannedTools).toEqual(['test.e2e']);
    const near = s.nearLimit.map((n) => `${n.path}:${n.what}`);
    expect(near).toEqual(
      expect.arrayContaining([
        '.claude/skills/big/SKILL.md:줄',
        '.claude/skills/big/references/r.md:줄',
        '.claude/skills/longdesc/SKILL.md:description 자',
      ]),
    );
    expect(near).not.toContain('.claude/skills/alpha/SKILL.md:줄');
    expect(formatSummary(s)).toContain('planned 도구: test.e2e');
    const outs: string[] = [];
    expect(runCheck(root, ['--summary', '--read-only'], { readStdin: () => '', out: (x) => void outs.push(x), err: () => {} })).toBe(0);
    expect(outs.join()).toContain('스킬 4개');
    expect(snapshotTree(root)).toEqual(before);
  });

  it('근접 없음·toolset 깨짐도 exit 0', () => {
    const root = makeRepo({ 'harness/toolset.yaml': 'tools: [' });
    const outs: string[] = [];
    expect(runCheck(root, ['--summary'], { readStdin: () => '', out: (x) => void outs.push(x), err: () => {} })).toBe(0);
    expect(outs.join()).toContain('상한 80% 이상 근접: 없음');
    expect(outs.join()).toContain('로딩 문제');
  });
});

describe('gen-index', () => {
  it('배치 에이전트를 agents의 skills에서 역산하고 메타 스킬은 제외', () => {
    const root = repo({
      ...agent({ name: 'ui-dev', skills: ['alpha'], allowed_tools: ['test.unit'] }),
      'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm' }),
    });
    const text = renderIndex(loadModel(root));
    expect(text).toContain('| alpha | v1 | alpha가 필요할 때 쓴다. | core-dev, ui-dev | - | test.unit | .claude/skills/alpha/SKILL.md |');
    expect(text).toContain('| beta | v1 | beta가 필요할 때 쓴다. | core-dev | alpha | build |');
    expect(text).not.toContain('| m |');
  });

  it('결정적 출력, 파이프 이스케이프, 스킬 0개', () => {
    const root = repo(skill({ name: 'alpha', description: 'a | b', steps: { S1: ['test.unit'] }, produces: ['TODO-CONTRACT.md'] }));
    expect(renderIndex(loadModel(root))).toBe(renderIndex(loadModel(root)));
    expect(renderIndex(loadModel(root))).toContain('a \\| b');
    const empty = makeRepo(agent({ name: 'harness-gardener' }));
    expect(renderIndex(loadModel(empty))).toContain('스킬 없음.');
    expect(renderIndex(loadModel(empty))).toContain('| harness-gardener | - | - |');
  });

  it('genIndex는 INDEX.md를 쓰고 full 최신성이 통과한다; frontmatter 오류면 쓰지 않는다', () => {
    captureConsole();
    const root = repo({}, false);
    expect(genIndex(root)).toBe(0);
    expect(readFileSync(join(root, INDEX_PATH), 'utf8')).toBe(renderIndex(loadModel(root)));
    expect(status(root, 'INDEX 최신성')[0]).toBe('ok');
    const bad = repo(skill({ name: 'alpha', version: 0 }), false);
    expect(genIndex(bad)).toBe(1);
    expect(existsSync(join(bad, INDEX_PATH))).toBe(false);
  });
});
