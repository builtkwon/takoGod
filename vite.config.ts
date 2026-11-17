import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'harness/scripts/__tests__/**/*.test.ts'],
    environment: 'node',
    // git 환경 격리(GIT_*, HOME, 전역·시스템 설정). import 순서에 기대지 않도록 여기서 먼저 적용한다.
    setupFiles: ['harness/scripts/__tests__/setup.ts'],
  },
});
