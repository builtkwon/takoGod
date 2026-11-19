// 점수 규칙. 원본: docs/GDD.md §점수, §굽기
import type { ReviewResult } from '../contracts';

export const START_SATISFACTION = 80;
export const GOOD_ANSWER = 10;
export const BAD_ANSWER = -10;
export const TIMEOUT = -10;

/** 만족도는 변화마다 0~100으로 clamp한다. */
export const applySatisfaction = (current: number, delta: number): number => Math.min(100, Math.max(0, current + delta));

/** clamp(만족도 / 20, 1, 5)를 0.5 단위로 반올림(0.25 경계는 올림). */
export const starsFromSatisfaction = (satisfaction: number): number =>
  Math.round(Math.min(5, Math.max(1, satisfaction / 20)) * 2) / 2;

export function sessionAverage(reviews: readonly ReviewResult[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
}
