// 난이도 곡선. 원본: docs/GDD.md §진행 난이도 곡선. 순수 함수만 둔다.

/** 난이도가 최대가 되는 단계. 이후는 이 단계 값으로 고정한다. */
export const MAX_DIFFICULTY_LEVEL = 20;
/** 패배 기준 화난 손님 수. */
export const FUMED_LIMIT = 4;
/** 튜토리얼 바 왕복(초). 1단계와 같은 2.2초다(GDD §굽기·§튜토리얼). */
const TUTORIAL_PERIOD_SEC = 2.2;

export interface Difficulty {
  /** 바 왕복 주기(초). */
  readonly periodSec: number;
  /** true면 영역이 W1·W2 두 개(6단계~), false면 하나를 굴리기 1·2가 함께 쓴다(1~5단계). */
  readonly twoZones: boolean;
  /** W1 폭(바 전체 길이 1 기준). 영역 1개일 때는 그 영역의 폭이다. */
  readonly w1: number;
  /** W2 폭. 영역 1개일 때는 w1과 같다. */
  readonly w2: number;
  /** 영역 중심이 바 가운데에서 떨어져야 하는 최소 거리 d(두 영역 단계만 의미). */
  readonly minCenterDistance: number;
  /** 손님 인내 범위(초). */
  readonly patienceMinSec: number;
  readonly patienceMaxSec: number;
}

/** 단계(튜토리얼 0, 본게임 1~)의 난이도. 20단계 이후는 20단계 값이다. 튜토리얼 영역은 고정이라 폭·거리는 쓰지 않는다. */
export function difficulty(level: number): Difficulty {
  if (level <= 0) return { periodSec: TUTORIAL_PERIOD_SEC, twoZones: true, w1: 0.5, w2: 0.5, minCenterDistance: 0, patienceMinSec: 20, patienceMaxSec: 40 };
  if (level <= 5) {
    const periodSec = level <= 2 ? 2.2 : level === 3 ? 1.9 : 1.6;
    const w = level <= 2 ? 0.54 : 0.24; // 첫 영역은 3단계 이후보다 1.8배 넓다(0.30 → 0.54)
    return { periodSec, twoZones: false, w1: w, w2: w, minCenterDistance: 0, patienceMinSec: 20, patienceMaxSec: 40 };
  }
  const t = (Math.min(level, MAX_DIFFICULTY_LEVEL) - 6) / (MAX_DIFFICULTY_LEVEL - 6);
  return {
    periodSec: 1.6 - 0.49 * t,
    twoZones: true,
    w1: 0.24 - 0.1 * t,
    w2: 0.2 - 0.1 * t,
    minCenterDistance: 0.3 * t,
    patienceMinSec: 20 - 5 * t,
    patienceMaxSec: 40 - 10 * t,
  };
}
