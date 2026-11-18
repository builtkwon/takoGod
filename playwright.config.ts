// E2E 설정. 규칙: docs/rules/development/testing.md#e2e
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        // 헤드리스에서도 WebGL이 뜨도록 소프트웨어 GL을 쓴다.
        launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  // build 결과를 preview로 띄운다(PROD 빌드라 서비스 워커 등록도 검증된다).
  webServer: { command: 'pnpm build && pnpm exec vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 120_000 },
});
