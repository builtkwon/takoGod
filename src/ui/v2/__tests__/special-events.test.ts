// 특별 손님 연출: 입장 대사 선택, 주문 결과·신고·알레르기·러시 안내 카드, 러시 배지. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerStatus } from '../../../contracts';
import { reportCard, rushText } from '../../../data';
import { entryLines } from '../../entry-lines';
import { bindReveal } from '../reveal';
import { createRushBadge } from '../rush-badge';
import type { Clock } from '../sequencer';
import { stateOf, stubBus } from './helpers';

class FakeEl {
  className = '';
  textContent = '';
  hidden = false;
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  append(...c: FakeEl[]): void {
    for (const x of c) {
      x.parent = this;
      this.children.push(x);
    }
  }
  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  text(): string {
    return [this.textContent, ...this.children.map((c) => c.text())].join(' ');
  }
}

afterEach(() => vi.unstubAllGlobals());

const cust = (over: Partial<CustomerStatus> = {}): CustomerStatus => ({
  id: 'c1', personality: 'tourist', dialogueIntervalSec: 8, patience: 0, face: 'normal', awaitingRedo: false, ...over,
});

describe('entryLines', () => {
  it('일반 손님은 없고, 주문·빼 주세요·단체·VIP 순서로 하나씩', () => {
    expect(entryLines(cust())).toEqual([]);
    const lines = entryLines(cust({ order: { ingredient: 'chili', count: 3 }, avoid: 'wasabi', vip: true }), () => 0);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('고추');
    expect(lines[1]).toContain('빼 주세요');
    expect(lines[2]).toContain('VIP');
  });
  it('단체 손님은 단체 대사 하나', () => {
    expect(entryLines(cust({ group: { platesNeeded: 2, platesReceived: 0 } }), () => 0.9)).toEqual(['We are two! 두 접시 부탁해요!']);
  });
});

describe('점수 공개 카드(reveal 대기열)', () => {
  const setup = (customers: CustomerStatus[]) => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    const bus = stubBus();
    const clock: Clock = { set: () => 0, clear: () => {} };
    bindReveal(layer as unknown as HTMLElement, bus, () => stateOf([], { customers }), clock, () => 0);
    const card = (): FakeEl | undefined => layer.children[0];
    return { bus, card, layer };
  };
  it('order/resolved 성공·실패는 성격별 반응 카드', () => {
    const a = setup([cust()]);
    a.bus.emit('order/resolved', { customerId: 'c1', success: true });
    expect(a.card()?.className).toContain('ui-order-ok');
    expect(a.card()?.text()).toContain('Yes! 내가 말한 그대로예요!');
    const b = setup([cust()]);
    b.bus.emit('order/resolved', { customerId: 'c1', success: false });
    expect(b.card()?.className).toContain('ui-order-fail');
    expect(b.card()?.text()).toContain('Oh no');
  });
  it('plate/reported는 식품 신고 카드(제목 + 문구)', () => {
    const { bus, card } = setup([cust()]);
    bus.emit('plate/reported', { customerId: 'c1', starsPenalty: 1 });
    expect(card()?.text()).toContain('🚨 식품 신고 접수!');
    expect(card()?.text()).toContain(reportCard.lines[0]);
  });
  it('customer/allergy는 재료 이름이 든 강한 분노 카드', () => {
    const { bus, card } = setup([cust()]);
    bus.emit('customer/allergy', { customerId: 'c1', ingredient: 'wasabi' });
    expect(card()?.className).toContain('ui-allergy');
    expect(card()?.text()).toContain('와사비 넣지 말랬잖아요!!');
  });
  it('rush/started는 러시 아워 안내 카드', () => {
    const { bus, card } = setup([]);
    bus.emit('rush/started', { durationSec: 30 });
    expect(card()?.text()).toContain(rushText.notices[0]);
  });
});

describe('러시 배지', () => {
  it('state.rush가 있으면 남은 초와 함께 보이고 null이면 숨긴다', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const b = createRushBadge();
    const root = b.root as unknown as FakeEl;
    b.update({ rush: null });
    expect(root.hidden).toBe(true);
    b.update({ rush: { remainingSec: 22.3 } });
    expect(root.hidden).toBe(false);
    expect(root.textContent).toBe('러시 아워! 23초');
    b.update({ rush: null });
    expect(root.hidden).toBe(true);
  });
});
