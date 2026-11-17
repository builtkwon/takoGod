// 테스트 프로세스의 git 환경 격리. vitest setupFiles(setup.ts)가 모든 테스트 파일보다 먼저 불러온다.
// - GIT_* 환경변수 제거: git 훅 안에서 vitest를 돌려도 GIT_DIR·GIT_INDEX_FILE이 바깥 저장소를 가리키지 않게.
// - HOME·XDG_CONFIG_HOME을 빈 임시 디렉터리로, 전역·시스템 git 설정 파일을 읽지 않게.
// 테스트가 부르는 제품 코드(exportStaged, readTrailers, readHeadToolset)도 process.env를 물려받으므로 함께 격리된다.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 격리 전 환경(GIT_* 제외). pnpm·corepack처럼 실제 HOME이 필요한 하위 프로세스에만 쓴다. */
export const REAL_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
);

const home = mkdtempSync(join(tmpdir(), 'harness-test-home-'));
const emptyConfig = join(home, 'empty.gitconfig');
writeFileSync(emptyConfig, '');
// 정리: vitest에서는 setup.ts의 afterAll, 일반 node 실행에서는 exit 이벤트.
process.on('exit', () => rmSync(home, { recursive: true, force: true }));

for (const k of Object.keys(process.env)) if (k.startsWith('GIT_')) delete process.env[k];
Object.assign(process.env, {
  HOME: home,
  XDG_CONFIG_HOME: join(home, '.config'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: emptyConfig,
  GIT_TERMINAL_PROMPT: '0',
});

export const ISOLATED_HOME = home;
