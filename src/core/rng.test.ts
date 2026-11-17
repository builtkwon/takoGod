import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from './rng';

describe('rng', () => {
  it('같은 시드는 같은 수열, [0,1) 범위', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('시드가 다르면 수열이 다르다', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('shuffle은 원소를 보존하고 원본을 바꾸지 않는다', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, createRng(3));
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
