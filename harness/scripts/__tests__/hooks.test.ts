// .claude/settings.json 훅 명령, .githooks/pre-commit, package.json prepare.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT, isRecord, toRel } from '../lib/common.ts';
import { REAL_ENV } from './git-isolation.ts';
import { git, makeGitRepo, makeRepo, skillMd } from './helpers.ts';

function hookCommand(event: 'PostToolUse' | 'SessionStart'): string {
  const settings: unknown = JSON.parse(readFileSync(join(PROJECT_ROOT, '.claude/settings.json'), 'utf8'));
  if (!isRecord(settings) || !isRecord(settings['hooks'])) throw new Error('settings.hooks 없음');
  const groups = settings['hooks'][event];
  if (!Array.isArray(groups)) throw new Error(`${event} 없음`);
  const cmd: unknown = groups[0]?.hooks?.[0]?.command;
  if (typeof cmd !== 'string') throw new Error(`${event} command 없음`);
  return cmd;
}

function runHook(cmd: string, projectDir: string, stdin: string, env: Record<string, string> = {}): { code: number | null; stderr: string } {
  // cwd를 일부러 다른 곳으로 둔다: 훅은 $CLAUDE_PROJECT_DIR로 이동해야 한다.
  const r = spawnSync('sh', ['-c', cmd], {
    cwd: '/',
    input: stdin,
    encoding: 'utf8',
    // pnpm·corepack은 실제 HOME의 캐시를 쓴다 → 격리 전 환경(GIT_* 제외)으로 실행.
    env: { ...REAL_ENV, CLAUDE_PROJECT_DIR: projectDir, ...env },
  });
  return { code: r.status, stderr: r.stderr };
}

/** harness-check.ts가 EXIT_CODE로 끝나는 가짜 프로젝트. tsx는 이 저장소 node_modules를 빌린다. */
const { packageManager } = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as { packageManager: string };

function stubProject(): string {
  const root = makeRepo({
    // packageManager가 없으면 corepack이 다른 pnpm을 받으려다 실패한다(그 경우도 훅은 2로 막는다).
    'package.json': `${JSON.stringify({ name: 'stub', private: true, type: 'module', packageManager })}\n`,
    'harness/scripts/harness-check.ts': "process.exit(Number(process.env['EXIT_CODE'] ?? '0'));\n",
  });
  symlinkSync(join(PROJECT_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}

/** 실제 harness 스크립트·contracts를 복사한 임시 프로젝트. 훅이 이 복사본의 harness-check를 실행한다. */
function realCopyProject(files: Record<string, string>): string {
  const root = makeRepo({
    'package.json': `${JSON.stringify({ name: 'copy', private: true, type: 'module', packageManager })}\n`,
    ...files,
  });
  cpSync(join(PROJECT_ROOT, 'harness/scripts'), join(root, 'harness/scripts'), { recursive: true });
  cpSync(join(PROJECT_ROOT, 'src/contracts'), join(root, 'src/contracts'), { recursive: true });
  symlinkSync(join(PROJECT_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}

describe('PostToolUse format 훅 명령', () => {
  const cmd = hookCommand('PostToolUse');

  it('$CLAUDE_PROJECT_DIR로 이동하고 모노레포 경로를 가정하지 않는다', () => {
    expect(cmd.startsWith('cd "$CLAUDE_PROJECT_DIR" && ')).toBe(true);
    expect(cmd).not.toContain('takoyaki-truck/');
  });

  it('종료코드 0·2는 그대로, 그 밖은 2(차단)로 바꾸고 사유를 stderr에 쓴다', () => {
    const root = stubProject();
    for (const [code, want] of [
      [0, 0],
      [2, 2],
      [1, 2],
      [3, 2],
      [127, 2],
    ] as const) {
      const r = runHook(cmd, root, '{}', { EXIT_CODE: String(code) });
      expect([code, r.code]).toEqual([code, want]);
      if (code !== 0 && code !== 2) expect(r.stderr).toContain(`훅 실행 실패(exit ${code})`);
    }
  });

  it('스크립트를 실행할 수 없으면(없는 프로젝트 디렉터리·스크립트) 2', () => {
    expect(runHook(cmd, '/nonexistent-dir-for-hook-test', '{}').code).toBe(2);
    expect(runHook(cmd, makeRepo(), '{}').code).toBe(2);
  });

  it('실제 harness-check: 망가진 SKILL.md는 exit 2 + 사유, 고친 뒤 0', () => {
    const SKILL = '.claude/skills/demo/SKILL.md';
    const must6 = Array.from({ length: 6 }, (_, i) => `규칙 ${i}`);
    const root = realCopyProject({ [SKILL]: `${skillMd({ name: 'demo', must: must6 })}- 실행: pnpm vitest run\n` });
    const input = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(root, SKILL) } });
    const broken = runHook(cmd, root, input);
    expect(broken.code).toBe(2);
    expect(broken.stderr).toContain(`harness format 실패: ${SKILL}`);
    expect(broken.stderr).toContain('MUST 항목 6개 > 5개');
    expect(broken.stderr).toContain('명령어 문자열 "pnpm"');
    expect(broken.stderr).not.toContain('훅 실행 실패'); // 검사 결과의 2이지 실행 실패가 아니다
    writeFileSync(join(root, SKILL), skillMd({ name: 'demo' }));
    expect(runHook(cmd, root, input)).toEqual({ code: 0, stderr: '' });
    // 대상 밖·잘못된 JSON은 통과
    expect(runHook(cmd, root, JSON.stringify({ tool_input: { file_path: '/etc/hosts' } })).code).toBe(0);
    expect(runHook(cmd, root, 'not json').code).toBe(0);
  });

  it('심볼릭 링크 경로(/var → /private/var 등)로 들어온 file_path도 저장소 안으로 판정한다', () => {
    const root = makeRepo({ 'a/b.md': 'x' });
    const real = realpathSync(root);
    const link = join(makeRepo(), 'link');
    symlinkSync(real, link, 'dir');
    expect(toRel(real, join(link, 'a/b.md'))).toBe('a/b.md');
    expect(toRel(link, join(real, 'a/new.md'))).toBe('a/new.md'); // 아직 없는 파일
    expect(toRel(real, '/etc/hosts')).toBeUndefined();
  });
});

describe('SessionStart 훅 명령', () => {
  it('$CLAUDE_PROJECT_DIR로 이동해 summary를 읽기 전용으로 실행한다', () => {
    const cmd = hookCommand('SessionStart');
    expect(cmd).toBe('cd "$CLAUDE_PROJECT_DIR" && pnpm -s tsx harness/scripts/harness-check.ts --summary --read-only');
  });
});

describe('pre-commit / prepare', () => {
  const hook = readFileSync(join(PROJECT_ROOT, '.githooks/pre-commit'), 'utf8');

  it('pre-commit은 실행 가능하고 저장소 루트에서 스테이지 기준 full 검사를 돈다', () => {
    expect(statSync(join(PROJECT_ROOT, '.githooks/pre-commit')).mode & 0o111).not.toBe(0);
    expect(hook).toContain('git rev-parse --show-toplevel');
    expect(hook).toContain('pnpm -s tool harness.check -- --full --no-write --staged');
    expect(hook).not.toContain('takoyaki-truck/');
  });

  const prepare = (): string => {
    const pkg: unknown = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
    const cmd = isRecord(pkg) && isRecord(pkg['scripts']) ? pkg['scripts']['prepare'] : undefined;
    if (typeof cmd !== 'string') throw new Error('prepare 없음');
    return cmd;
  };
  const runPrepare = (cwd: string, env: Record<string, string> = {}) =>
    spawnSync('/bin/sh', ['-c', prepare()], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  const hooksPath = (root: string): string => {
    const r = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
    return r.stdout.trim();
  };

  it('prepare: git 저장소 루트면 core.hooksPath=.githooks', () => {
    const root = makeGitRepo({ 'package.json': '{}' });
    const r = runPrepare(root);
    expect(r.status).toBe(0);
    expect(hooksPath(root)).toBe('.githooks');
  });

  it('prepare: 경로를 대소문자를 바꿔 들어와도(대소문자 무시 파일시스템) 루트로 판정한다', () => {
    const root = makeGitRepo({ 'package.json': '{}' });
    const variant = root.replace(/harness-test-/, 'HARNESS-TEST-');
    if (!existsSync(variant)) return; // 대소문자 구분 파일시스템에서는 해당 없음
    const r = runPrepare(variant, { PWD: variant });
    expect(r.status).toBe(0);
    expect(hooksPath(root)).toBe('.githooks');
  });

  it('prepare: .git이 없으면 조용히 건너뛴다(exit 0, 출력 없음)', () => {
    const root = makeRepo({ 'package.json': '{}' });
    const r = runPrepare(root);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, '', '']);
    expect(existsSync(join(root, '.git'))).toBe(false);
  });

  it('prepare: 다른 저장소의 하위 디렉터리면 바깥 저장소 설정을 바꾸지 않는다', () => {
    const outer = makeGitRepo();
    mkdirSync(join(outer, 'vendor/pkg'), { recursive: true });
    writeFileSync(join(outer, 'vendor/pkg/package.json'), '{}');
    expect(runPrepare(join(outer, 'vendor/pkg')).status).toBe(0);
    expect(hooksPath(outer)).toBe('');
    git(outer, ['status']); // 바깥 저장소는 정상
  });

  it('prepare: git이 없어도 exit 0', () => {
    expect(runPrepare(makeRepo(), { PATH: '/nonexistent' }).status).toBe(0);
  });
});
