import { describe, expect, it } from 'vitest';
import { rollPosition } from '../cooking';

describe('굴리기 타이밍 바 (GDD §굽기)', () => {
  it('1.2초 주기 왕복: 0 → 1(0.6초) → 0(1.2초)', () => {
    expect(rollPosition(0)).toBe(0);
    expect(rollPosition(0.3)).toBeCloseTo(0.5, 12);
    expect(rollPosition(0.6)).toBeCloseTo(1, 12);
    expect(rollPosition(0.9)).toBeCloseTo(0.5, 12);
    expect(rollPosition(1.2)).toBeCloseTo(0, 9);
    expect(rollPosition(1.5)).toBeCloseTo(0.5, 9);
  });
});
