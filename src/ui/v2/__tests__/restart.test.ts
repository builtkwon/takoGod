// 게임 중 다시 하기 확인 모달: 예 → onYes 1회, 아니오 → 0회. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRestartConfirm } from '../restart';

class FakeEl {
  className = '';
  textContent = '';
  removed = false;
  children: FakeEl[] = [];
  handlers: (() => void)[] = [];
  append(...c: FakeEl[]): void {
    this.children.push(...c);
  }
  remove(): void {
    this.removed = true;
  }
  addEventListener(_: string, h: () => void): void {
    this.handlers.push(h);
  }
}

afterEach(() => vi.unstubAllGlobals());

function setup() {
  vi.stubGlobal('document', { createElement: () => new FakeEl() });
  const layer = new FakeEl();
  const onYes = vi.fn();
  const c = createRestartConfirm(layer as unknown as HTMLElement, onYes);
  c.open();
  const modal = layer.children[0]!;
  const button = (label: string): FakeEl => modal.children.find((x) => x.textContent === label)!;
  return { c, layer, modal, onYes, button };
}

describe('다시 하기 확인 모달', () => {
  it('문구와 예/아니오 버튼이 있다', () => {
    const { modal, button } = setup();
    expect(modal.children[0]!.textContent).toBe('처음부터 다시 할까요?');
    expect(button('예')).toBeDefined();
    expect(button('아니오')).toBeDefined();
  });
  it('예 → 모달을 닫고 onYes 1회', () => {
    const { modal, onYes, button } = setup();
    button('예').handlers[0]!();
    expect(onYes).toHaveBeenCalledTimes(1);
    expect(modal.removed).toBe(true);
  });
  it('아니오 → 모달만 닫고 onYes 0회', () => {
    const { modal, onYes, button } = setup();
    button('아니오').handlers[0]!();
    expect(onYes).not.toHaveBeenCalled();
    expect(modal.removed).toBe(true);
  });
  it('이미 열려 있으면 또 열지 않는다', () => {
    const { c, layer } = setup();
    c.open();
    expect(layer.children).toHaveLength(1);
  });
});
