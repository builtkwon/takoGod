// vitest setupFiles(vite.config.ts): 모든 테스트 파일보다 먼저 git 환경을 격리하고, 파일이 끝나면 임시 HOME을 지운다.
// 테스트 파일의 import 순서와 무관하다.
import { rmSync } from 'node:fs';
import { afterAll } from 'vitest';
import { ISOLATED_HOME } from './git-isolation.ts';

afterAll(() => rmSync(ISOLATED_HOME, { recursive: true, force: true }));
