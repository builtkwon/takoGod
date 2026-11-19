// 진행 계약. 원본: docs/GDD.md §진행

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

/**
 * 튜토리얼 유도 단계(GDD §진행 튜토리얼). 단계마다 6구 모두에 같은 조작을 하게 한다.
 * 순서: 마가린 → 반죽물 → 익힘 기다림 → 속재료 → 굴리기 1 → 굴리기 2 → 후네 담기.
 */
export type TutorialStage = 'margarine' | 'batter' | 'cook-wait' | 'filling' | 'roll-1' | 'roll-2' | 'fune';

/** 튜토리얼 안내 한 개(새 흐름). stage 조작의 시작점→목적지에 화살표를 띄우고 message를 상단에 표시한다. */
export interface TutorialStepV2 {
  readonly stage: TutorialStage;
  readonly message: string;
}
