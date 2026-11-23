import { describe, expect, it } from 'vitest';
import { createEventBus } from '../event-bus';

describe('EventBus', () => {
  it('구독자에게 payload를 전달하고 해제 함수가 동작한다', () => {
    const bus = createEventBus();
    const got: string[] = [];
    const off = bus.on('customer/left', (p) => got.push(p.customerId));
    bus.emit('customer/left', { customerId: 'a' });
    off();
    bus.emit('customer/left', { customerId: 'b' });
    expect(got).toEqual(['a']);
  });

  it('다른 이벤트 구독자는 호출되지 않는다', () => {
    const bus = createEventBus();
    let n = 0;
    bus.on('customer/left', () => n++);
    bus.emit('phase/changed', { phase: 'main', level: 1 });
    expect(n).toBe(0);
  });
});
