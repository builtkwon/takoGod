import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRotateGuide, isLandscapeBlocked } from '../rotate-guide';

class FakeEl {
  className = '';
  textContent = '';
  hidden = false;
  removed = false;
  children: FakeEl[] = [];
  append(...c: FakeEl[]): void {
    this.children.push(...c);
  }
  remove(): void {
    this.removed = true;
  }
}
afterEach(() => vi.unstubAllGlobals());

describe('가로 모드 판정', () => {
  it('가로>세로 이고 높이<500일 때만 막는다', () => {
    expect(isLandscapeBlocked(844, 390)).toBe(true);
    expect(isLandscapeBlocked(390, 844)).toBe(false);
    expect(isLandscapeBlocked(1280, 800)).toBe(false); // 데스크톱 창
    expect(isLandscapeBlocked(640, 480)).toBe(true);
  });
});

describe('가로 모드 안내 오버레이', () => {
  it('가로면 보이고 isBlocking true, 세로로 돌아오면 숨기고 false', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    const g = createRotateGuide(layer as unknown as HTMLElement);
    const o = layer.children[0]!;
    expect(g.isBlocking()).toBe(false);
    g.update(844, 390);
    expect(o.hidden).toBe(false);
    expect(g.isBlocking()).toBe(true);
    expect(o.children.map((c) => c.textContent)).toEqual(['📱', '화면을 세로로 돌려 주세요']);
    g.update(390, 844);
    expect(g.isBlocking()).toBe(false);
    g.dispose();
    expect(o.removed).toBe(true);
  });
});
