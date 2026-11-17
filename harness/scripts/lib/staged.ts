// pre-commit용: 작업 트리가 아니라 git 인덱스(스테이지된 내용)를 임시 디렉터리에 풀어 검사한다.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface StagedTree {
  readonly dir: string;
  cleanup(): void;
}

/**
 * root 저장소의 인덱스를 임시 디렉터리로 내보낸다. GIT_INDEX_FILE(커밋 중 git이 지정)을 따른다.
 * 타입 검사가 의존성을 찾도록 root/node_modules를 심볼릭 링크로 붙인다.
 */
export function exportStaged(root: string): StagedTree | string {
  const dir = mkdtempSync(join(tmpdir(), 'harness-staged-'));
  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
  const res = spawnSync('git', ['checkout-index', '--all', `--prefix=${dir}/`], { cwd: root, encoding: 'utf8' });
  if (res.error !== undefined || res.status !== 0) {
    cleanup();
    return `git checkout-index 실패: ${res.error?.message ?? res.stderr.trim()}`;
  }
  const modules = join(root, 'node_modules');
  if (existsSync(modules) && !existsSync(join(dir, 'node_modules'))) symlinkSync(modules, join(dir, 'node_modules'), 'dir');
  return { dir, cleanup };
}
