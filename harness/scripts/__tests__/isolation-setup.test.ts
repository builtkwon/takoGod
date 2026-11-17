// helpers·git-isolation을 import하지 않는 파일에서도 격리가 적용되는지(setupFiles) 확인한다.
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('setupFiles 격리', () => {
  it('import 없이도 GIT_* 정리·HOME 격리·전역 설정 차단이 적용돼 있다', () => {
    expect(basename(process.env['HOME'] ?? '')).toMatch(/^harness-test-home-/);
    expect(process.env['GIT_CONFIG_NOSYSTEM']).toBe('1');
    expect(process.env['GIT_CONFIG_GLOBAL']).toMatch(/empty\.gitconfig$/);
    expect(process.env['GIT_DIR']).toBeUndefined();
    expect(process.env['GIT_INDEX_FILE']).toBeUndefined();
  });
});
