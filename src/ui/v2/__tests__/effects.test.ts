// 판정 글자는 한 번에 하나만 보인다. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampMarkX, createEffects } from '../effects';

class FakeEl {
  className = '';
  textContent = '';
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  append(c: FakeEl): void {
    c.parent = this;
    this.children.push(c);
  }
  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  animate(): { onfinish: (() => void) | null } {
    return { onfinish: null };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('판정 글자', () => {
  it('연속 판정 시 .ui-mark 요소는 1개이고 마지막 글자만 남는다', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    vi.stubGlobal('window', { innerWidth: 400, innerHeight: 800 });
    const layer = new FakeEl();
    const fx = createEffects(layer as unknown as HTMLElement);
    fx.mark('빗나감', { x: 100, y: 300 }, 'bad');
    fx.mark('빗나감', { x: 140, y: 300 }, 'bad');
    fx.mark('적중!', { x: 180, y: 300 }, 'good');
    const marks = layer.children.filter((c) => c.className.includes('ui-mark'));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('적중!');
  });

  it('좌우 가장자리에서는 글자가 잘리지 않게 가운데 x를 가둔다', () => {
    expect(clampMarkX(0, '빗나감', 400)).toBe(49);
    expect(clampMarkX(400, '빗나감', 400)).toBe(351);
    expect(clampMarkX(200, '빗나감', 400)).toBe(200);
  });
});
