import { describe, expect, it } from 'vitest';
import { trackNewBest } from '../new-best';
import { stubBus } from './helpers';

describe('trackNewBest', () => {
  it('score/new-best를 기억하고 reset하면 다음 판에 남지 않는다', () => {
    const bus = stubBus();
    const t = trackNewBest(bus, []);
    expect(t.value()).toBe(false);
    bus.emit('score/new-best', { score: 100, previous: null });
    expect(t.value()).toBe(true);
    t.reset();
    expect(t.value()).toBe(false);
  });
});
