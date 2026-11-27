// 진행 규칙. 원본: docs/GDD.md §진행, §손님 대화
import type { PhaseConfig } from '../contracts';

/** 튜토리얼 뒤 단계는 무한하다(패배로만 끝난다). 난이도는 20단계에서 최대이고 이후 고정한다(levels.ts). */
const INTERVALS: Readonly<Record<number, readonly number[]>> = {
  0: [],
  1: [],
  2: [12],
  3: [12, 12],
  4: [6, 12],
};

/** 동시 손님 상한 = 자리 수(GDD §진행): 0~1단계 0, 2단계 1, 3~5단계 2, 6~9단계 3, 10단계~ 4. */
export function seatCount(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level <= 5) return 2;
  return level <= 9 ? 3 : 4;
}

/** 단계(튜토리얼 0, 본게임 1~)의 자리·대화 간격 설정. 대화 간격은 입장 순서(자리 번호)로 정하고, 5단계 이후는 모두 6초다. */
export function phaseConfig(level: number): PhaseConfig {
  const dialogueIntervalsSec = INTERVALS[level] ?? Array.from({ length: seatCount(level) }, () => 6);
  return { level, isTutorial: level === 0, customerCount: dialogueIntervalsSec.length, dialogueIntervalsSec, countsReviews: level !== 1 };
}

/** 단계 전환 접시 수. 손님이 없는 단계(튜토리얼·1단계)는 서빙 없이 완성한 접시 수다. */
export function targetPlates(level: number): number {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level <= 5) return 4;
  return 2;
}

/** 손님이 있는데 빈 자리가 더 있을 때 직전 입장 뒤 다음 손님이 입장하는 시간. */
export const SECOND_CUSTOMER_DELAY_SEC = 3;
/** 서빙받은 손님이 퇴장한 뒤 다음 손님이 입장하는 시간. */
export const REPLACEMENT_DELAY_SEC = 2;
/** 답 제한시간. */
export const ANSWER_LIMIT_SEC = 5;
