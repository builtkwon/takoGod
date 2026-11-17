import { describe, expect, it } from 'vitest';
import { classify, checkFormatFile, findCommandStrings, findToolCallIds, listFormatTargets } from '../lib/format.ts';
import { runCheck, filePathFromHookInput, type Io } from '../harness-check.ts';
import { agentMd, makeRepo, skillMd } from './helpers.ts';

const SKILL = '.claude/skills/demo/SKILL.md';
const check = (files: Record<string, string>, rel: string): string[] => checkFormatFile(makeRepo(files), rel);

function io(stdin = ''): Io & { outs: string[]; errs: string[] } {
  const outs: string[] = [];
  const errs: string[] = [];
  return { readStdin: () => stdin, out: (s) => void outs.push(s), err: (s) => void errs.push(s), outs, errs };
}

describe('대상 경로', () => {
  it.each([
    ['src/core/index.ts', 'out-of-scope'],
    ['docs/GDD.md', 'out-of-scope'],
    ['harness/scripts/tool.ts', 'out-of-scope'],
    ['.claude/settings.json', 'other-in-scope'],
    ['.claude/skills/INDEX.md', 'other-in-scope'],
    [SKILL, 'skill'],
    ['harness/meta-skills/harness-design/SKILL.md', 'skill'],
    ['.claude/skills/demo/references/a.md', 'reference'],
    ['.claude/skills/demo/references/sub/deep/a.md', 'reference'],
    ['harness/meta-skills/harness-design/references/sub/a.md', 'reference'],
    ['.claude/skills/demo/references/sub/a.txt', 'other-in-scope'],
    ['.claude/agents/core-dev.md', 'agent'],
  ])('%s → %s', (rel, kind) => expect(classify(rel).kind).toBe(kind));

  it('대상 밖 파일은 내용과 무관하게 통과', () => {
    expect(check({ 'src/x.md': 'pnpm vitest' }, 'src/x.md')).toEqual([]);
  });
});

describe('SKILL.md format', () => {
  it('정상 스킬 통과', () => {
    expect(check({ [SKILL]: skillMd({ name: 'demo' }) }, SKILL)).toEqual([]);
  });

  it('120줄 경계: 120줄 통과, 121줄 실패', () => {
    const base = skillMd({ name: 'demo' }).split('\n').length - 1;
    const ok = skillMd({ name: 'demo', padAfter: 120 - base });
    const bad = skillMd({ name: 'demo', padAfter: 121 - base });
    expect(check({ [SKILL]: ok }, SKILL)).toEqual([]);
    expect(check({ [SKILL]: bad }, SKILL).join()).toContain('121줄 > 120줄');
  });

  it('description 200자 통과, 201자 실패', () => {
    expect(check({ [SKILL]: skillMd({ name: 'demo', description: '가'.repeat(200) }) }, SKILL)).toEqual([]);
    expect(check({ [SKILL]: skillMd({ name: 'demo', description: '가'.repeat(201) }) }, SKILL).join()).toContain(
      'description 201자',
    );
  });

  it('MUST가 본문 첫 20줄 안이면 통과, 넘으면 실패', () => {
    // 본문: 빈 줄 pad + "## MUST" + 빈 줄 + 항목 1 → 항목은 pad+3 번째 줄
    expect(check({ [SKILL]: skillMd({ name: 'demo', padBeforeMust: 17 }) }, SKILL)).toEqual([]);
    expect(check({ [SKILL]: skillMd({ name: 'demo', padBeforeMust: 18 }) }, SKILL).join()).toContain('첫 20줄');
  });

  it('MUST 5개 통과, 6개 실패, 없음 실패', () => {
    const must = (n: number): string[] => Array.from({ length: n }, (_, i) => `규칙 ${i}`);
    expect(check({ [SKILL]: skillMd({ name: 'demo', must: must(5) }) }, SKILL)).toEqual([]);
    expect(check({ [SKILL]: skillMd({ name: 'demo', must: must(6) }) }, SKILL).join()).toContain('6개 > 5개');
    expect(check({ [SKILL]: skillMd({ name: 'demo', must: [] }) }, SKILL).join()).toContain('MUST 항목 없음');
  });

  it('MUST·단계 섹션 누락 실패', () => {
    const errors = check({ [SKILL]: skillMd({ name: 'demo', body: '본문만 있다.' }) }, SKILL).join();
    expect(errors).toContain('## MUST 섹션 없음');
    expect(errors).toContain('## 단계 섹션 없음');
  });

  it('명령어 문자열 실패, pnpm tool <id> 형식은 허용', () => {
    expect(findCommandStrings('도구는 `pnpm tool <id>`로만, `pnpm tool test.unit` 으로, `pnpm tool harness.check -- --full`')).toEqual([]);
    for (const cmd of ['pnpm vitest run', 'npx tsc', 'tsx a.ts', 'node x.js', 'pnpm tool']) {
      expect(findCommandStrings(`실행: ${cmd}`)).toHaveLength(1);
    }
    expect(findCommandStrings('node_modules 경로')).toEqual([]);
    expect(findCommandStrings('인자는 `pnpm tool <id> -- <인자>` 형식, 예: `pnpm tool sim.balance -- --sessions 10`')).toEqual([]);
    const body = skillMd({ name: 'demo' }).replace('## 단계', '- 금지: pnpm build\n\n## 단계');
    expect(check({ [SKILL]: body }, SKILL).join()).toContain('명령어 문자열 "pnpm"');
  });

  it('파일 이름·모듈 지정자는 명령어가 아니고, 경로 실행은 명령어다', () => {
    for (const ok of ['src/ui/App.tsx를 고친다', 'pnpm-lock.yaml 변경', 'node_modules/', 'foo.node 모듈', '.pnpm-store', 'tsx-config.json', 'my-node 패키지', "import 'node:fs'", '`node:child_process`']) {
      expect([ok, findCommandStrings(ok)]).toEqual([ok, []]);
    }
    for (const bad of ['`tsx a.ts`', '(node x.js)', '실행은 pnpm.', '"npx foo"', 'node', 'tsx, node', '/usr/bin/node a.js', 'node_modules/.bin/tsx x.ts', './node_modules/.bin/pnpm i']) {
      expect(findCommandStrings(bad)).toHaveLength(1);
    }
  });

  it('본문 도구 호출 ID 추출: 실제 ID만, 중복 제거', () => {
    expect(findToolCallIds('`pnpm tool <id>`, pnpm tool test.unit, pnpm tool harness.check -- --full, pnpm tool test.unit.')).toEqual([
      'test.unit',
      'harness.check',
    ]);
  });

  it('steps와 본문 S 번호 불일치 실패', () => {
    const text = skillMd({ name: 'demo', steps: { S1: [], S2: [], S3: [] } }).replace(/- S3 .*\n/, '');
    expect(check({ [SKILL]: text }, SKILL).join()).toContain('본문 단계(S1,S2)');
  });

  it('steps 키가 S1..Sn 연속이 아니면 실패', () => {
    const text = skillMd({ name: 'demo', steps: { S1: [], S3: [] } });
    expect(check({ [SKILL]: text }, SKILL).join()).toContain('S1..Sn 연속');
  });

  it.each([
    ['frontmatter 없음', '## MUST\n- a\n', 'frontmatter(---) 없음'],
    ['name 불일치', skillMd({ name: 'other' }), '경로 이름(demo)'],
    ['version 0', skillMd({ name: 'demo', version: 0 }), 'version'],
    ['requires 3개', skillMd({ name: 'demo', requires: ['a', 'b', 'c'] }), 'requires 3개'],
    ['키 누락', skillMd({ name: 'demo' }).replace(/consumes: .*\n/, ''), '키 누락: consumes'],
    ['알 수 없는 키', skillMd({ name: 'demo' }).replace('steps:', 'owner: x\nsteps:'), '알 수 없는 frontmatter 키: owner'],
    ['도구 ID 형식', skillMd({ name: 'demo', steps: { S1: ['Bad Tool'] } }), '도구 ID 형식'],
  ])('스키마 실패: %s', (_n, text, msg) => {
    expect(check({ [SKILL]: text }, SKILL).join()).toContain(msg);
  });
});

describe('references format', () => {
  const REF = '.claude/skills/demo/references/detail.md';
  it('200줄 통과, 201줄 실패', () => {
    expect(check({ [REF]: 'a\n'.repeat(200) }, REF)).toEqual([]);
    expect(check({ [REF]: 'a\n'.repeat(201) }, REF).join()).toContain('201줄 > 200줄');
  });
  it('명령어 문자열 실패', () => {
    expect(check({ [REF]: 'npx foo\n' }, REF)).toHaveLength(1);
  });
  it('하위 디렉터리 references도 검사하고 full 대상에 재귀로 포함한다', () => {
    const deep = '.claude/skills/demo/references/sub/deep/x.md';
    const meta = 'harness/meta-skills/m/references/a/b.md';
    expect(check({ [deep]: 'a\n'.repeat(201) }, deep).join()).toContain('201줄 > 200줄');
    const root = makeRepo({ [SKILL]: skillMd({ name: 'demo' }), [deep]: 'x\n', [meta]: 'x\n', 'harness/meta-skills/m/SKILL.md': skillMd({ name: 'm' }) });
    expect(listFormatTargets(root)).toEqual(expect.arrayContaining([deep, meta]));
  });
});

describe('agent format', () => {
  const AGENT = '.claude/agents/core-dev.md';
  it('정상 에이전트 통과', () => {
    expect(check({ [AGENT]: agentMd({ name: 'core-dev' }) }, AGENT)).toEqual([]);
  });
  it.each([
    ['name 불일치', agentMd({ name: 'ui-dev' }), '경로 이름(core-dev)'],
    ['알 수 없는 키', agentMd({ name: 'core-dev', extra: 'model: opus' }), '알 수 없는 frontmatter 키: model'],
    ['skills 형식', agentMd({ name: 'core-dev' }).replace('skills: []', 'skills: verify'), 'skills는 문자열 배열'],
    ['tools 누락', agentMd({ name: 'core-dev' }).replace(/tools: Read.*\n/, ''), '키 누락: tools'],
    ['본문 명령어', agentMd({ name: 'core-dev', body: 'pnpm vitest 실행' }), '명령어 문자열'],
  ])('실패: %s', (_n, text, msg) => {
    expect(check({ [AGENT]: text }, AGENT).join()).toContain(msg);
  });
});

describe('harness-check --format CLI', () => {
  it('훅 stdin JSON에서 file_path를 읽는다', () => {
    expect(filePathFromHookInput('{"tool_input":{"file_path":"/a/b.md"}}')).toBe('/a/b.md');
    expect(filePathFromHookInput('{"tool_input":{}}')).toBeUndefined();
    expect(filePathFromHookInput('not json')).toBeUndefined();
  });

  it('--from-hook-stdin: 실패 시 exit 2 + stderr 사유', () => {
    const root = makeRepo({ [SKILL]: skillMd({ name: 'demo', must: [] }) });
    const i = io(JSON.stringify({ tool_input: { file_path: `${root}/${SKILL}` } }));
    expect(runCheck(root, ['--format', '--from-hook-stdin'], i)).toBe(2);
    expect(i.errs.join()).toContain('MUST 항목 없음');
  });

  it('--from-hook-stdin: 정상·대상 밖·저장소 밖·file_path 없음은 exit 0', () => {
    const root = makeRepo({ [SKILL]: skillMd({ name: 'demo' }), 'src/a.ts': 'pnpm' });
    for (const p of [`${root}/${SKILL}`, `${root}/src/a.ts`, '/etc/hosts']) {
      expect(runCheck(root, ['--format', '--from-hook-stdin'], io(JSON.stringify({ tool_input: { file_path: p } })))).toBe(0);
    }
    expect(runCheck(root, ['--format', '--from-hook-stdin'], io('{}'))).toBe(0);
  });

  it('--file: 상대 경로 검사, 실패 시 exit 2', () => {
    const root = makeRepo({ [SKILL]: skillMd({ name: 'demo' }), '.claude/skills/bad/SKILL.md': '없음' });
    expect(runCheck(root, ['--format', '--file', SKILL], io())).toBe(0);
    expect(runCheck(root, ['--format', '--file', '.claude/skills/bad/SKILL.md'], io())).toBe(2);
  });

  it('--file: 없는 파일·저장소 밖 경로는 실패(exit 2)', () => {
    const root = makeRepo({ [SKILL]: skillMd({ name: 'demo' }) });
    for (const p of ['.claude/skills/ghost/SKILL.md', '/etc/hosts', '../outside.md', '.claude/skills']) {
      const i = io();
      expect(runCheck(root, ['--format', '--file', p], i)).toBe(2);
      expect(i.errs.join()).toMatch(/파일 없음|저장소 밖/);
    }
    // 대상 밖이지만 저장소 안의 실제 파일은 통과
    const r2 = makeRepo({ 'src/a.ts': 'x' });
    expect(runCheck(r2, ['--format', '--file', 'src/a.ts'], io())).toBe(0);
  });

  it('잘못된 인자 조합 → 사용법 exit 1', () => {
    const root = makeRepo();
    for (const argv of [[], ['--format'], ['--format', '--file'], ['--full', '--summary'], ['--full', '--x'], ['--summary', '--staged']]) {
      const i = io();
      expect(runCheck(root, argv, i)).toBe(1);
      expect(i.errs.join()).toContain('사용법');
    }
  });
});
