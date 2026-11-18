import { describe, expect, it } from 'vitest';
import { BalanceSimulator } from '../sim';

describe('BalanceSimulator', () => {
  it('평균 별점은 1~5 사이 유한수', () => {
    for (const kind of ['perfect', 'random'] as const) {
      const v = BalanceSimulator.run({ kind, sessions: 3, seed: 1 });
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('같은 시드는 같은 결과(재현성)', () => {
    const a = BalanceSimulator.run({ kind: 'random', sessions: 5, seed: 42 });
    const b = BalanceSimulator.run({ kind: 'random', sessions: 5, seed: 42 });
    expect(a).toBe(b);
  });

  it('전정답+완벽 굽기가 무작위 플레이보다 높다', () => {
    const perfect = BalanceSimulator.run({ kind: 'perfect', sessions: 5, seed: 1 });
    const random = BalanceSimulator.run({ kind: 'random', sessions: 5, seed: 1 });
    expect(perfect).toBeGreaterThan(random);
  });

  it('sessions가 1 미만이면 던진다', () => {
    expect(() => BalanceSimulator.run({ kind: 'perfect', sessions: 0, seed: 1 })).toThrow();
  });
});
