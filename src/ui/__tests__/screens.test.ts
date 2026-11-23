// 버전 라벨: 값이 있으면 그대로, 없거나 빈 문자열이면 표시하지 않는다. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { versionTag } from '../screens';

afterEach(() => vi.unstubAllGlobals());

describe('versionTag', () => {
  it('라벨이 있으면 그대로 담은 요소, 없거나 빈 문자열이면 null', () => {
    vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '' }) });
    const tag = versionTag('v0.1.0 · abc1234');
    expect(tag).toMatchObject({ className: 'ui-version', textContent: 'v0.1.0 · abc1234' });
    expect(versionTag(undefined)).toBeNull();
    expect(versionTag('')).toBeNull();
  });
});
