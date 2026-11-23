// 분노 말풍선(ui-fumed)이 떠 있는 동안 새 답 버튼이 그 위에 놓이지 않는다. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { overlaps, type Rect } from '../layout';
import { createDialogues } from '../dialogue';
import { stubBus } from '../v2/__tests__/helpers';

class FakeEl {
  className = '';
  textContent = '';
  hidden = false;
  disabled = false;
  style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  append(...c: FakeEl[]): void {
    for (const x of c) {
      x.parent = this;
      this.children.push(x);
    }
  }
  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
  addEventListener(): void {}
  getBoundingClientRect(): Rect & { left: number; top: number; width: number; height: number } {
    if (this.className === 'layer') return { x: 0, y: 0, w: 400, h: 800, left: 0, top: 0, width: 400, height: 800 };
    const n = (k: string, d: number): number => (this.style[k] ? parseFloat(this.style[k]) : d);
    const r = { left: n('left', 12), top: n('top', 0), width: n('width', 300), height: n('height', 52) };
    return { x: r.left, y: r.top, w: r.width, h: r.height, ...r };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('답 버튼 배치', () => {
  it('떠 있는 분노 말풍선과 겹치지 않는다', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    layer.className = 'layer';
    const bus = stubBus();
    // 0.1 고정이면 첫 버튼 후보가 분노 말풍선(top 120~196) 위로 떨어진다.
    createDialogues({ layer: layer as unknown as HTMLElement, bus, disposers: [], personalityOf: () => 'salaryman' }, [], () => [], () => 0.1);
    bus.emit('customer/fumed', { customerId: 'a' });
    const fumed = layer.children.find((c) => c.className.includes('ui-fumed'));
    expect(fumed).toBeDefined();
    bus.emit('dialogue/started', { customerId: 'b', line: { personality: 'grandma', prompt: 'q', good: 'g', bad: 'b' } } as never);
    const buttons = layer.children.filter((c) => c.className.includes('ui-answer'));
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(overlaps(b.getBoundingClientRect(), fumed!.getBoundingClientRect())).toBe(false);
  });

  it('reset하면 대화 말풍선·답 버튼·분노 말풍선이 모두 사라진다(다시 하기 뒤 이전 판 UI 잔존 방지)', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    layer.className = 'layer';
    const bus = stubBus();
    const d = createDialogues({ layer: layer as unknown as HTMLElement, bus, disposers: [], personalityOf: () => 'salaryman' }, [], () => []);
    bus.emit('customer/fumed', { customerId: 'a' });
    bus.emit('dialogue/started', { customerId: 'b', line: { personality: 'grandma', prompt: 'q', good: 'g', bad: 'b' } } as never);
    const shown = (): number => layer.children.filter((c) => /ui-bubble|ui-answer/.test(c.className)).length;
    expect(shown()).toBe(4); // 분노 말풍선 1 + 대화 말풍선 1 + 답 버튼 2
    d.reset();
    expect(shown()).toBe(0);
  });

  it('입장한 주문 손님은 대사 말풍선이 한 번 뜨고 reset하면 사라진다', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    layer.className = 'layer';
    const bus = stubBus();
    const d = createDialogues({ layer: layer as unknown as HTMLElement, bus, disposers: [], personalityOf: () => 'salaryman' }, [], () => []);
    bus.emit('customer/entered', {
      customer: { id: 'a', personality: 'salaryman', dialogueIntervalSec: 8, patience: 0, face: 'normal', awaitingRedo: false, order: { ingredient: 'chili', count: 3 }, avoid: 'wasabi' },
    });
    const entry = (): number => layer.children.filter((c) => c.className.includes('ui-entry')).length;
    expect(entry()).toBe(2); // 주문 + 빼 주세요
    d.reset();
    expect(entry()).toBe(0);
  });
});
