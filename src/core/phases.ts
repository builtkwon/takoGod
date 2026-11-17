// 진행 규칙. 원본: docs/GDD.md §진행, §손님 대화
import type { PhaseConfig, PhaseId } from '../contracts';

export const PHASES: Readonly<Record<PhaseId, PhaseConfig>> = {
  tutorial: { id: 'tutorial', isTutorial: true, customerCount: 0, dialogueIntervalsSec: [], countsReviews: true },
  P1: { id: 'P1', isTutorial: false, customerCount: 0, dialogueIntervalsSec: [], countsReviews: false },
  P2: { id: 'P2', isTutorial: false, customerCount: 1, dialogueIntervalsSec: [12], countsReviews: true },
  P3: { id: 'P3', isTutorial: false, customerCount: 2, dialogueIntervalsSec: [12, 12], countsReviews: true },
  P4: { id: 'P4', isTutorial: false, customerCount: 2, dialogueIntervalsSec: [6, 12], countsReviews: true },
  P5: { id: 'P5', isTutorial: false, customerCount: 2, dialogueIntervalsSec: [6, 6], countsReviews: true },
};

/** 페이즈 전환 기준 접시 수. 손님이 없는 단계(튜토리얼·P1)는 서빙 없이 완성한 접시 수다. */
export const TARGET_PLATES: Readonly<Record<PhaseId, number>> = { tutorial: 1, P1: 1, P2: 2, P3: 4, P4: 4, P5: 4 };

const ORDER: readonly PhaseId[] = ['tutorial', 'P1', 'P2', 'P3', 'P4', 'P5'];

/** P5 다음은 null(세션 결과). */
export const nextPhase = (id: PhaseId): PhaseId | null => ORDER[ORDER.indexOf(id) + 1] ?? null;

/** 손님 2명 페이즈에서 손님2가 페이즈 시작 후 입장하는 시간. */
export const SECOND_CUSTOMER_DELAY_SEC = 3;
/** 서빙받은 손님이 퇴장한 뒤 다음 손님이 입장하는 시간. */
export const REPLACEMENT_DELAY_SEC = 2;
/** 답 제한시간. */
export const ANSWER_LIMIT_SEC = 5;
