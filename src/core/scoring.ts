// 점수 규칙. 원본: docs/GDD.md §점수, §굽기
import type { ReviewResult } from '../contracts';

export const START_SATISFACTION = 80;
export const GOOD_ANSWER = 10;
export const BAD_ANSWER = -10;
export const TIMEOUT = -10;
const PERFECT_PLATE = 20;
const BAD_DONENESS = -10;
const TRAP = -20;

/** 만족도는 변화마다 0~100으로 clamp한다. */
export const applySatisfaction = (current: number, delta: number): number => Math.min(100, Math.max(0, current + delta));

/** clamp(만족도 / 20, 1, 5)를 0.5 단위로 반올림(0.25 경계는 올림). */
export const starsFromSatisfaction = (satisfaction: number): number =>
  Math.round(Math.min(5, Math.max(1, satisfaction / 20)) * 2) / 2;

export function sessionAverage(reviews: readonly ReviewResult[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
}

export interface PlateFacts {
  /** 6구 모두 익음 2회 적정, 굴리기 3회 성공, 속재료 문어. */
  readonly perfect: boolean;
  /** 덜익음/탐 구멍이 1개 이상. */
  readonly hasBadDoneness: boolean;
  /** 함정 재료 구멍이 1개 이상. */
  readonly hasTrap: boolean;
}

/** 접시 하나가 만족도에 주는 변화. 적용 순서대로 돌려준다. */
export function plateDeltas(f: PlateFacts): number[] {
  const out: number[] = [];
  if (f.perfect) out.push(PERFECT_PLATE);
  if (f.hasBadDoneness) out.push(BAD_DONENESS);
  if (f.hasTrap) out.push(TRAP);
  return out;
}
