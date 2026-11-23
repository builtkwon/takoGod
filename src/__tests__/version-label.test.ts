import { describe, expect, it } from 'vitest';
import { versionLabel } from '../version-label';

describe('versionLabel', () => {
  it('버전과 커밋을 "v버전 · 커밋"으로 만든다', () => {
    expect(versionLabel('0.0.0', 'abc1234')).toBe('v0.0.0 · abc1234');
    expect(versionLabel('1.2.3', 'dev')).toBe('v1.2.3 · dev');
  });

  it('define 주입값이 테스트 환경에서도 정의된다', () => {
    expect(versionLabel(__APP_VERSION__, __APP_COMMIT__)).toMatch(/^v\d+\.\d+\.\d+ · ([0-9a-f]{7}|dev)$/);
  });
});
