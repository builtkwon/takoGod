// 손님 머리 위 아이콘: 표시 조건과 추종·숨김. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerStatus, PickTarget, ScenePicker } from '../../../contracts';
import { badgeItems, badgeRect, createCustomerBadges, gaugeView } from '../customer-badges';

const base = (over: Partial<CustomerStatus> = {}): CustomerStatus => ({
  id: 'c1', personality: 'salaryman', dialogueIntervalSec: 8, patience: 0, face: 'normal', awaitingRedo: false, ...over,
});

describe('badgeItems(라벨 문자열)', () => {
  it('일반 손님은 라벨이 없다', () => {
    expect(badgeItems(base())).toEqual([]);
    expect(badgeItems(base({ order: null, avoid: null, group: null, vip: false }))).toEqual([]);
  });
  it('주문: 재료 이름 ×N, 6은 모두 재료', () => {
    expect(badgeItems(base({ order: { ingredient: 'chili', count: 3 } }))).toMatchObject([{ kind: 'order', ingredient: 'chili', text: '고추 ×3' }]);
    expect(badgeItems(base({ order: { ingredient: 'eraser', count: 1 } }))[0]).toMatchObject({ text: '지우개 ×1' });
    expect(badgeItems(base({ order: { ingredient: 'marshmallow', count: 6 } }))[0]).toMatchObject({ text: '모두 마시멜로' });
  });
  it('빼 주세요: 재료 + "재료 빼기", 주문과 함께 붙을 수 있다', () => {
    const items = badgeItems(base({ order: { ingredient: 'chili', count: 1 }, avoid: 'wasabi' }));
    expect(items.map((i) => i.kind)).toEqual(['order', 'avoid']);
    expect(items[1]).toMatchObject({ ingredient: 'wasabi', text: '와사비 빼기' });
  });
  it('단체: 접시 받은 수/필요한 수', () => {
    expect(badgeItems(base({ group: { platesNeeded: 2, platesReceived: 0 } }))[0]).toMatchObject({ kind: 'group', text: '접시 0/2' });
    expect(badgeItems(base({ group: { platesNeeded: 2, platesReceived: 1 } }))[0]).toMatchObject({ text: '접시 1/2' });
  });
  it('VIP는 VIP 줄(왕관), 단체 VIP는 둘 다', () => {
    expect(badgeItems(base({ vip: true })).map((i) => i.kind)).toEqual(['vip']);
    expect(badgeItems(base({ vip: true, group: { platesNeeded: 2, platesReceived: 0 } })).map((i) => i.kind)).toEqual(['group', 'vip']);
  });
});

describe('gaugeView', () => {
  it('채움 = 1 - patience, 색 = face, 100%면 빈 빨간 막대', () => {
    expect(gaugeView({ patience: 0, face: 'normal' })).toEqual({ fillPct: 100, tone: 'normal', angered: false });
    expect(gaugeView({ patience: 0.5, face: 'annoyed' })).toEqual({ fillPct: 50, tone: 'annoyed', angered: false });
    expect(gaugeView({ patience: 0.8, face: 'angry' }).tone).toBe('angry');
    expect(gaugeView({ patience: 1, face: 'angry' })).toEqual({ fillPct: 0, tone: 'angry', angered: true });
  });
  it('범위 밖·NaN은 0~100으로 자른다', () => {
    expect(gaugeView({ patience: 2, face: 'angry' }).angered).toBe(true);
    expect(gaugeView({ patience: -1, face: 'normal' }).fillPct).toBe(100);
    expect(gaugeView({ patience: Number.NaN, face: 'normal' }).fillPct).toBe(100);
  });
});

describe('badgeRect', () => {
  const items = badgeItems(base({ order: { ingredient: 'chili', count: 3 } }));
  it('머리 위 anchor 바로 위, 가운데 정렬', () => {
    const r = badgeRect({ x: 200, y: 300 }, items, 100, 390);
    expect(r.y + r.h).toBeLessThanOrEqual(300);
    expect(r.x + r.w / 2).toBeCloseTo(200, 0);
  });
  it('머리가 HUD·바 뒤에 가려지는 위치(anchor 58)면 묶음 바로 아래에 붙는다', () => {
    const r = badgeRect({ x: 114, y: 58 }, items, 104, 390);
    expect(r.y).toBeGreaterThanOrEqual(104);
  });
  it('좌우는 화면 안으로 가두고 줄 수만큼 높아진다', () => {
    const left = badgeRect({ x: 0, y: 300 }, items, 100, 390);
    const right = badgeRect({ x: 390, y: 300 }, items, 100, 390);
    expect(left.x).toBeGreaterThanOrEqual(0);
    expect(right.x + right.w).toBeLessThanOrEqual(390);
    const two = badgeItems(base({ order: { ingredient: 'chili', count: 3 }, avoid: 'wasabi' }));
    expect(badgeRect({ x: 200, y: 300 }, two, 100, 390).h).toBeGreaterThan(left.h);
  });
});

class FakeEl {
  className = '';
  textContent = '';
  innerHTML = '';
  hidden = false;
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
    const b = createCustomerBadges(layer as unknown as HTMLElement, picker, () => 390);
    return { layer, b, setPresent: (v: boolean) => (present = v) };
  };
  it('손님마다 머리 위에 붙고(라벨이 없으면 게이지만), 손님이 사라지거나 anchor가 null이면 숨긴다', () => {
    const { layer, b, setPresent } = setup();
    const withOrder = base({ order: { ingredient: 'chili', count: 3 } });
    b.update({ customers: [withOrder, base({ id: 'c2' })] });
    expect(layer.children).toHaveLength(2);
    expect(layer.children[0]!.style.transform).toMatch(/^translate\(/);
    expect(b.rects()).toHaveLength(2);
    setPresent(false);
    b.update({ customers: [withOrder] });
    expect(layer.children).toHaveLength(0);
    setPresent(true);
    b.update({ customers: [withOrder] });
    expect(layer.children).toHaveLength(1);
    b.update({ customers: [] });
    expect(layer.children).toHaveLength(0);
  });
  it('게이지 채움은 남은 인내, 색은 얼굴 단계, 화나면 빈 막대+😠', () => {
    const { layer, b } = setup();
    const gauge = (): FakeEl => layer.children[0]!.children[1]!.children[0]!.children[0]!; // root > 게이지 줄 > 트랙 > 채움
    const emoji = (): FakeEl => layer.children[0]!.children[1]!.children[1]!;
    b.update({ customers: [base({ patience: 0.25, face: 'normal' })] });
    expect(gauge().style.width).toBe('75%');
    expect(gauge().className).toContain('ui-gauge-normal');
    expect(emoji().hidden).toBe(true);
    b.update({ customers: [base({ patience: 0.6, face: 'annoyed' })] });
    expect(gauge().style.width).toBe('40%');
    expect(gauge().className).toContain('ui-gauge-annoyed');
    b.update({ customers: [base({ patience: 0.9, face: 'angry' })] });
    expect(gauge().className).toContain('ui-gauge-angry');
    b.update({ customers: [base({ patience: 1, face: 'angry' })] });
    expect(gauge().style.width).toBe('0%');
    expect(emoji().hidden).toBe(false);
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
