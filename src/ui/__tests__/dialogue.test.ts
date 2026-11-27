// 대화 말풍선·화면 아래 고정 답 버튼. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Rect } from '../layout';
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
  handlers: (() => void)[] = [];
  append(...c: FakeEl[]): void {
    for (const x of c) {
      x.parent = this;
      this.children.push(x);
    }
  }
  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
  addEventListener(_: string, h: () => void): void {
    this.handlers.push(h);
  }
  find(cls: string): FakeEl[] {
    return this.children.flatMap((c) => [...(c.className.includes(cls) ? [c] : []), ...c.find(cls)]);
  }
  getBoundingClientRect(): Rect & { left: number; top: number; width: number; height: number } {
    if (this.className === 'layer') return { x: 0, y: 0, w: 400, h: 800, left: 0, top: 0, width: 400, height: 800 };
    const n = (k: string, d: number): number => (this.style[k] ? parseFloat(this.style[k]) : d);
    const r = { left: n('left', 12), top: n('top', 700), width: n('width', 300), height: n('height', 100) };
    return { x: r.left, y: r.top, w: r.width, h: r.height, ...r };
  }
}

afterEach(() => vi.unstubAllGlobals());

const line = (personality: 'grandma' | 'salaryman', prompt = 'q'): never => ({ personality, prompt, good: `g-${prompt}`, bad: `b-${prompt}` }) as never;

function setup() {
  vi.stubGlobal('document', { createElement: () => new FakeEl() });
  const layer = new FakeEl();
  layer.className = 'layer';
  const bus = stubBus();
  const d = createDialogues({ layer: layer as unknown as HTMLElement, bus, disposers: [], personalityOf: () => 'salaryman' }, () => 0.1);
  return { layer, bus, d, box: () => layer.find('ui-answers')[0]! };
}

describe('답 버튼: 화면 아래 고정', () => {
  it('답 영역 하나(.ui-answers)에 손님별 한 줄(이름 태그 + 좋은 답·나쁜 답 나란히)이 쌓인다', () => {
    const { bus, box } = setup();
    bus.emit('dialogue/started', { customerId: 'a', line: line('grandma') });
    const rows = box().find('ui-answer-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.find('ui-answer-tag')[0]!.textContent).toBe('할머니');
    expect(rows[0]!.find('ui-answer ')).toHaveLength(2);
    // 버튼은 자유 배치(left/top)가 아니라 고정 영역 안의 흐름 배치다.
    for (const b of rows[0]!.find('ui-answer ')) expect(b.style.left).toBeUndefined();
  });
  it('동시 대화는 먼저 시작한 줄이 위, 가장 최근 줄이 아래', () => {
    const { bus, box } = setup();
    bus.emit('dialogue/started', { customerId: 'a', line: line('grandma', 'first') });
    bus.emit('dialogue/started', { customerId: 'b', line: line('salaryman', 'second') });
    const rows = box().find('ui-answer-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.find('ui-answer-tag')[0]!.textContent).toBe('할머니');
    expect(rows[1]!.find('ui-answer-tag')[0]!.textContent).toBe('직장인');
  });
  it('버튼을 누르면 input/answer가 가고 두 버튼이 잠긴다, 해결되면 그 줄만 사라진다', () => {
    const { bus, box } = setup();
    bus.emit('dialogue/started', { customerId: 'a', line: line('grandma') });
    bus.emit('dialogue/started', { customerId: 'b', line: line('salaryman') });
    const first = box().find('ui-answer-row')[0]!;
    const buttons = first.find('ui-answer ');
    buttons[0]!.handlers[0]!();
    expect(bus.sent.some((e) => e.type === 'input/answer' && (e.payload as { customerId: string }).customerId === 'a')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    bus.emit('dialogue/resolved', { customerId: 'a', outcome: 'good' } as never);
    expect(box().find('ui-answer-row')).toHaveLength(1);
  });
});

describe('말풍선 reset', () => {
  it('reset하면 대화 말풍선·답 줄·분노 말풍선이 모두 사라진다(다시 하기 뒤 이전 판 UI 잔존 방지)', () => {
    const { layer, bus, d, box } = setup();
    bus.emit('customer/fumed', { customerId: 'a' });
    bus.emit('dialogue/started', { customerId: 'b', line: line('grandma') });
    const bubbles = (): number => layer.children.filter((c) => c.className.includes('ui-bubble')).length;
    expect(bubbles()).toBe(2); // 분노 말풍선 + 대화 말풍선
    expect(box().find('ui-answer-row')).toHaveLength(1);
    d.reset();
    expect(bubbles()).toBe(0);
    expect(box().find('ui-answer-row')).toHaveLength(0);
  });
  it('입장한 주문 손님은 대사 말풍선이 한 번 뜨고 reset하면 사라진다', () => {
    const { layer, bus, d } = setup();
    bus.emit('customer/entered', {
      customer: { id: 'a', personality: 'salaryman', dialogueIntervalSec: 8, patience: 0, face: 'normal', awaitingRedo: false, order: { ingredient: 'chili', count: 3 }, avoid: 'wasabi' },
    });
    const entry = (): number => layer.children.filter((c) => c.className.includes('ui-entry')).length;
    expect(entry()).toBe(2); // 주문 + 빼 주세요
    d.reset();
    expect(entry()).toBe(0);
  });
});
