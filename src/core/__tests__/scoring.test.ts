import { describe, expect, it } from 'vitest';
import type { ReviewResult } from '../../contracts';
import { applySatisfaction, sessionAverage, starsFromSatisfaction, START_SATISFACTION } from '../scoring';

const review = (stars: number): ReviewResult => ({ source: 'customer', stars, comment: '', personality: 'grandma' });

describe('scoring (GDD §점수)', () => {
  it('시작 만족도는 80', () => {
    expect(START_SATISFACTION).toBe(80);
  });

  it('만족도는 0 아래로 내려가지 않고 100을 넘을 수 있다(상한 없음)', () => {
    expect(applySatisfaction(95, 10)).toBe(105);
    expect(applySatisfaction(110, 20)).toBe(130);
    expect(applySatisfaction(5, -10)).toBe(0);
    expect(applySatisfaction(0, -20)).toBe(0);
    expect(applySatisfaction(50, -20)).toBe(30);
  });

  it('별점 = clamp(만족도/20, 1, 5)를 0.5 단위로 반올림', () => {
    expect(starsFromSatisfaction(0)).toBe(1);
    expect(starsFromSatisfaction(20)).toBe(1);
    expect(starsFromSatisfaction(60)).toBe(3);
    expect(starsFromSatisfaction(70)).toBe(3.5);
    expect(starsFromSatisfaction(83)).toBe(4); // 4.15 → 4.0
    expect(starsFromSatisfaction(85)).toBe(4.5); // 4.25 → 4.5 (0.25 경계는 올림)
    expect(starsFromSatisfaction(94)).toBe(4.5); // 4.7 → 4.5
    expect(starsFromSatisfaction(95)).toBe(5); // 4.75 → 5.0
    expect(starsFromSatisfaction(100)).toBe(5);
    expect(starsFromSatisfaction(130)).toBe(5); // 100을 넘어도 5★ 상한
  });

  it('세션 점수 = 모든 리뷰 별점의 산술평균, 리뷰가 없으면 null', () => {
    expect(sessionAverage([])).toBeNull();
    expect(sessionAverage([review(5), review(4), review(3.5)])).toBeCloseTo(12.5 / 3, 12);
  });
});
