// 리뷰 계약. 원본: docs/GDD.md §점수, §콘텐츠

import type { Personality } from './customer';

export type ReviewSource = 'tutorial' | 'customer';

export interface ReviewResult {
  readonly source: ReviewSource;
  /** 1~5, 0.5 단위. */
  readonly stars: number;
  readonly comment: string;
  /** source가 'tutorial'이면 null. */
  readonly personality: Personality | null;
}
