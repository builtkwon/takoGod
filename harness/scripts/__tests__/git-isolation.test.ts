import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ISOLATED_HOME, REAL_ENV } from './git-isolation.ts';
import { makeGitRepo } from './helpers.ts';

describe('테스트 git 환경 격리', () => {
  it('GIT_* 변수는 격리용만 남고, HOME은 임시 디렉터리다', () => {
    const git = Object.keys(process.env).filter((k) => k.startsWith('GIT_')).sort();
    expect(git).toEqual(['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_TERMINAL_PROMPT']);
    expect(process.env['HOME']).toBe(ISOLATED_HOME);
    expect(Object.keys(REAL_ENV).some((k) => k.startsWith('GIT_'))).toBe(false);
  });

  it('전역·시스템 git 설정을 읽지 않는다', () => {
    const r = spawnSync('git', ['config', '--list', '--show-origin'], { cwd: makeGitRepo(), encoding: 'utf8' });
    const origins = r.stdout.split('\n').filter((l) => l !== '').map((l) => l.split('\t')[0]);
    expect(origins.every((o) => o === 'file:.git/config')).toBe(true);
  });

  it('바깥에서 GIT_DIR·GIT_INDEX_FILE을 넣고 실행해도 격리된다', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', "await import('./harness/scripts/__tests__/git-isolation.ts'); console.log(Object.keys(process.env).filter((k) => k === 'GIT_DIR' || k === 'GIT_INDEX_FILE').length)"], {
      encoding: 'utf8',
      env: { ...process.env, GIT_DIR: '/tmp/outer/.git', GIT_INDEX_FILE: '/tmp/outer/.git/index' },
    });
    expect(r.stdout.trim()).toBe('0');
  });
});
