// 진행 계약. 원본: docs/GDD.md §진행

import type { CookStep } from './cooking';

export type PhaseId = 'tutorial' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface PhaseConfig {
  readonly id: PhaseId;
  readonly isTutorial: boolean;
  /** 동시 손님 수. */
  readonly customerCount: number;
  /** 손님별 대화 간격(초). 길이는 customerCount와 같다. */
  readonly dialogueIntervalsSec: readonly number[];
  /** 이 단계의 리뷰를 세션 점수에 집계하는지. */
  readonly countsReviews: boolean;
}

/** 튜토리얼 한 단계. target 단계의 버튼에 화살표를 띄우고 message를 상단에 표시한다. */
export interface TutorialStep {
  readonly target: CookStep;
  readonly message: string;
}
