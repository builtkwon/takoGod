// 게임 상태 계약. core가 만들고 render·ui는 읽기만 한다.

import type { HoleState, Ingredient } from './cooking';
import type { ActiveDialogue, Customer } from './customer';
import type { PhaseId } from './phase';
import type { ReviewResult } from './review';

export interface GameState {
  readonly phase: PhaseId;
  /** 길이 6. */
  readonly holes: readonly HoleState[];
  /** 트레이 표시 순서. 매 판 셔플된다. */
  readonly tray: readonly Ingredient[];
  readonly customers: readonly Customer[];
  readonly activeDialogues: readonly ActiveDialogue[];
  /** 세션에서 받은 리뷰. 세션 점수는 이 목록의 별점 평균으로 계산한다. */
  readonly reviews: readonly ReviewResult[];
  readonly tutorialCompleted: boolean;
}
