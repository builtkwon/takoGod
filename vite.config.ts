import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

// 커밋 7자리: Cloudflare Pages 환경 변수 → git → 'dev'. git 실패는 무시한다.
function commit(): string {
  const sha = process.env.CF_PAGES_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // 최상위 define은 build와 vitest에 같이 적용된다.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  test: {
    include: ['src/**/*.test.ts', 'harness/scripts/__tests__/**/*.test.ts'],
    environment: 'node',
    // git 환경 격리(GIT_*, HOME, 전역·시스템 설정). import 순서에 기대지 않도록 여기서 먼저 적용한다.
    setupFiles: ['harness/scripts/__tests__/setup.ts'],
  },
});
