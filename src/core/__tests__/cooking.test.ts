import { describe, expect, it } from 'vitest';
import { rollPosition } from '../cooking';

describe('굴리기 타이밍 바 (GDD §굽기)', () => {
  it('1.6초 주기 왕복: 0 → 1(0.8초) → 0(1.6초)', () => {
    expect(rollPosition(0)).toBe(0);
    expect(rollPosition(0.4)).toBeCloseTo(0.5, 12);
    expect(rollPosition(0.8)).toBeCloseTo(1, 12);
    expect(rollPosition(1.2)).toBeCloseTo(0.5, 12);
    expect(rollPosition(1.6)).toBeCloseTo(0, 9);
    expect(rollPosition(2)).toBeCloseTo(0.5, 9);
  });
});
