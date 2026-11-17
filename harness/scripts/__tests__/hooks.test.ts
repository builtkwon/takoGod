// .claude/settings.json 훅 명령, .githooks/pre-commit, package.json prepare.
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT, isRecord } from '../lib/common.ts';
import { makeRepo } from './helpers.ts';

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
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...env },
  });
  return { code: r.status, stderr: r.stderr };
}

/** harness-check.ts가 EXIT_CODE로 끝나는 가짜 프로젝트. tsx는 이 저장소 node_modules를 빌린다. */
function stubProject(): string {
  const { packageManager } = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as { packageManager: string };
  const root = makeRepo({
    // packageManager가 없으면 corepack이 다른 pnpm을 받으려다 실패한다(그 경우도 훅은 2로 막는다).
    'package.json': `${JSON.stringify({ name: 'stub', private: true, type: 'module', packageManager })}\n`,
    'harness/scripts/harness-check.ts': "process.exit(Number(process.env['EXIT_CODE'] ?? '0'));\n",
  });
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

  it('실제 저장소: 대상 밖·잘못된 JSON은 0, 망가진 메타 스킬 경로는 검사한다', () => {
    expect(runHook(cmd, PROJECT_ROOT, JSON.stringify({ tool_input: { file_path: '/etc/hosts' } })).code).toBe(0);
    expect(runHook(cmd, PROJECT_ROOT, 'not json').code).toBe(0);
    const skill = join(PROJECT_ROOT, 'harness/meta-skills/harness-design/SKILL.md');
    expect(runHook(cmd, PROJECT_ROOT, JSON.stringify({ tool_input: { file_path: skill } })).code).toBe(0);
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

  it('package.json prepare가 core.hooksPath=.githooks를 설정한다', () => {
    const pkg: unknown = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
    expect(isRecord(pkg) && isRecord(pkg['scripts']) && pkg['scripts']['prepare']).toBe('git config core.hooksPath .githooks');
  });
});
