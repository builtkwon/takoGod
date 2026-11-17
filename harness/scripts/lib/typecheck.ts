// harness 스크립트 타입 검사(full 검사 항목). tsc --noEmit만 돌려 파일을 쓰지 않는다.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { exists } from './common.ts';

export const HARNESS_TSCONFIG = 'harness/tsconfig.json';

export interface TypecheckResult {
  readonly status: 'ok' | 'fail' | 'skip';
  readonly messages: readonly string[];
}

/** tsc는 이 저장소의 typescript를 쓴다(검사 대상 root에 node_modules가 없어도 된다). */
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');

export function typecheckHarness(root: string): TypecheckResult {
  if (!exists(root, HARNESS_TSCONFIG)) return { status: 'skip', messages: [`${HARNESS_TSCONFIG} 없음`] };
  const res = spawnSync(process.execPath, [TSC, '-p', join(root, HARNESS_TSCONFIG), '--noEmit', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (res.error !== undefined) return { status: 'fail', messages: [`tsc 실행 실패: ${res.error.message}`] };
  if (res.status === 0) return { status: 'ok', messages: [] };
  const lines = `${res.stdout}${res.stderr}`.split('\n').filter((l) => l.trim() !== '');
  return { status: 'fail', messages: lines.length > 0 ? lines : [`tsc 종료코드 ${String(res.status)}`] };
}
