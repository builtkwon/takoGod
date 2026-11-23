// 손님 머리 위 아이콘: 표시 조건과 추종·숨김. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerStatus, PickTarget, ScenePicker } from '../../../contracts';
import { badgeItems, badgeRect, createCustomerBadges } from '../customer-badges';

const base = (over: Partial<CustomerStatus> = {}): CustomerStatus => ({
  id: 'c1', personality: 'salaryman', dialogueIntervalSec: 8, patience: 0, face: 'normal', awaitingRedo: false, ...over,
});

describe('badgeItems', () => {
  it('일반 손님은 아이콘이 없다', () => {
    expect(badgeItems(base())).toEqual([]);
    expect(badgeItems(base({ order: null, avoid: null, group: null, vip: false }))).toEqual([]);
  });
  it('주문: 개수 1·3은 ×N, 6은 모두', () => {
    expect(badgeItems(base({ order: { ingredient: 'chili', count: 3 } }))).toMatchObject([{ kind: 'order', ingredient: 'chili', text: '×3' }]);
    expect(badgeItems(base({ order: { ingredient: 'eraser', count: 1 } }))[0]).toMatchObject({ text: '×1' });
    expect(badgeItems(base({ order: { ingredient: 'marshmallow', count: 6 } }))[0]).toMatchObject({ text: '모두' });
  });
  it('빼 주세요: 재료 + 금지 표시, 주문과 함께 붙을 수 있다', () => {
    const items = badgeItems(base({ order: { ingredient: 'chili', count: 1 }, avoid: 'wasabi' }));
    expect(items.map((i) => i.kind)).toEqual(['order', 'avoid']);
    expect(items[1]).toMatchObject({ ingredient: 'wasabi', aria: '빼 주세요' });
  });
  it('단체: 처음에는 ×2, 하나 받으면 1/2', () => {
    expect(badgeItems(base({ group: { platesNeeded: 2, platesReceived: 0 } }))[0]).toMatchObject({ kind: 'group', text: '×2' });
    expect(badgeItems(base({ group: { platesNeeded: 2, platesReceived: 1 } }))[0]).toMatchObject({ text: '1/2' });
  });
  it('VIP는 왕관, 단체 VIP는 둘 다', () => {
    expect(badgeItems(base({ vip: true })).map((i) => i.kind)).toEqual(['vip']);
    expect(badgeItems(base({ vip: true, group: { platesNeeded: 2, platesReceived: 0 } })).map((i) => i.kind)).toEqual(['group', 'vip']);
  });
});

describe('badgeRect', () => {
  it('머리 위 anchor 바로 위, 가운데 정렬', () => {
    const r = badgeRect({ x: 200, y: 100 }, 2);
    expect(r.y + r.h).toBeLessThanOrEqual(100);
    expect(r.x + r.w / 2).toBe(200);
  });
});

class FakeEl {
  className = '';
  textContent = '';
  innerHTML = '';
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  style: Record<string, string> = {};
  append(...c: FakeEl[]): void {
    for (const x of c) {
      x.parent = this;
      this.children.push(x);
    }
  }
  replaceChildren(...c: FakeEl[]): void {
    this.children = [];
    this.append(...c);
  }
  setAttribute(): void {}
  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 390, height: 844 };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('createCustomerBadges', () => {
  const setup = () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    let present = true;
    const picker: ScenePicker = {
      pick: () => null,
      anchor: (t: PickTarget) => (t.kind === 'customer' && present ? { x: 120, y: 200 } : null),
    };
    const b = createCustomerBadges(layer as unknown as HTMLElement, picker);
    return { layer, b, setPresent: (v: boolean) => (present = v) };
  };
  it('아이콘이 있는 손님만 머리 위에 붙고, 손님이 사라지거나 anchor가 null이면 숨긴다', () => {
    const { layer, b, setPresent } = setup();
    const withOrder = base({ order: { ingredient: 'chili', count: 3 } });
    b.update({ customers: [withOrder, base({ id: 'c2' })] });
    expect(layer.children).toHaveLength(1);
    expect(layer.children[0]!.style.transform).toContain('120px, 200px');
    expect(b.rects()).toHaveLength(1);
    setPresent(false);
    b.update({ customers: [withOrder] });
    expect(layer.children).toHaveLength(0);
    setPresent(true);
    b.update({ customers: [withOrder] });
    expect(layer.children).toHaveLength(1);
    b.update({ customers: [] });
    expect(layer.children).toHaveLength(0);
  });
  it('reset은 모두 지운다', () => {
    const { layer, b } = setup();
    b.update({ customers: [base({ vip: true })] });
    expect(layer.children).toHaveLength(1);
    b.reset();
    expect(layer.children).toHaveLength(0);
    expect(b.rects()).toEqual([]);
  });
});
