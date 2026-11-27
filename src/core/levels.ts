// 난이도 곡선. 원본: docs/GDD.md §진행 난이도 곡선. 순수 함수만 둔다.

/** 난이도가 최대가 되는 단계. 이후는 이 단계 값으로 고정한다. */
export const MAX_DIFFICULTY_LEVEL = 20;
/** 패배 기준 화난 손님 수. */
export const FUMED_LIMIT = 4;
/** 튜토리얼 바 왕복(초). 1단계와 같다. */
const TUTORIAL_PERIOD_SEC = 2.8;

export interface Difficulty {
  /** 바 왕복 주기(초). */
  readonly periodSec: number;
  /** 타이밍 영역 폭(바 전체 길이 1 기준). 모든 단계가 영역 1개를 굴리기 1·2가 함께 쓴다. */
  readonly width: number;
  /** 영역 중심이 바 가운데에서 떨어져야 하는 최소 거리 d(두 영역 단계만 의미). */
  readonly minCenterDistance: number;
  /** 손님 인내 범위(초). */
  readonly patienceMinSec: number;
  readonly patienceMaxSec: number;
}

/** 단계(튜토리얼 0, 본게임 1~)의 난이도. 20단계 이후는 20단계 값이다. 튜토리얼 영역은 고정이라 폭·거리는 쓰지 않는다. */
export function difficulty(level: number): Difficulty {
  if (level <= 0) return { periodSec: TUTORIAL_PERIOD_SEC, width: 0.5, minCenterDistance: 0, patienceMinSec: 48, patienceMaxSec: 96 };
  if (level <= 5) {
    const periodSec = level <= 2 ? 2.8 : level === 3 ? 2.5 : 2.2;
    const w = level <= 2 ? 0.54 : 0.36;
    return { periodSec, width: w, minCenterDistance: 0, patienceMinSec: 48, patienceMaxSec: 96 };
  }
  const t = (Math.min(level, MAX_DIFFICULTY_LEVEL) - 6) / (MAX_DIFFICULTY_LEVEL - 6);
  return {
    periodSec: 2.2 - 0.6 * t,
    width: 0.36 - 0.12 * t,
    minCenterDistance: 0.15 * t,
    patienceMinSec: 48 - 12 * t,
    patienceMaxSec: 96 - 24 * t,
  };
}

// ── v0.6.0 주문·특별 손님(GDD §주문, §특별 손님). 열리는 단계와 확률 ──
export const ORDER_FROM_LEVEL = 10;
export const RUSH_FROM_LEVEL = 12;
export const AVOID_FROM_LEVEL = 13;
export const GROUP_FROM_LEVEL = 15;
export const VIP_FROM_LEVEL = 17;
export const AVOID_CHANCE = 0.2;
export const GROUP_CHANCE = 0.15;
export const VIP_CHANCE = 0.1;
/** 주문 재료 개수 후보(6은 "모두"). */
export const ORDER_COUNTS = [1, 3, 6] as const;
/** 러시 아워: 가게 점수 이 값의 배수 경계마다 30초, 입장 대기 2배속, 그동안 입장한 손님 인내 ×1.5. */
export const RUSH_SCORE_STEP = 1000;
export const RUSH_DURATION_SEC = 30;
export const RUSH_PATIENCE_MULTIPLIER = 1.5;
export const GROUP_PATIENCE_MULTIPLIER = 1.6;
export const VIP_PATIENCE_MULTIPLIER = 0.7;
export const GROUP_PLATES = 2;

/** 새 손님이 주문을 가질 확률: 10단계 40%에서 20단계 70%까지 선형, 이후 고정. 10단계 전은 0이다. */
export const orderChance = (level: number): number => (level < ORDER_FROM_LEVEL ? 0 : 0.4 + (0.3 * (Math.min(level, MAX_DIFFICULTY_LEVEL) - ORDER_FROM_LEVEL)) / 10);
