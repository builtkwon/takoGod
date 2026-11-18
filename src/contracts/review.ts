// 리뷰 계약. 원본: docs/GDD.md §점수, §콘텐츠

import type { Personality } from './customer';

export type ReviewSource = 'tutorial' | 'customer';

export interface ReviewResult {
  readonly source: ReviewSource;
  /** 0~5, 0.5 단위. 접시 별점은 1~5이고 0~1점은 0~1점 떠남(GDD §손님 대화, §점수)에서만 나온다. */
  readonly stars: number;
  readonly comment: string;
  /** source가 'tutorial'이면 null. */
  readonly personality: Personality | null;
}
