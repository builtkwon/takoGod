// 굽기 규칙. 원본: docs/GDD.md §굽기, §튜토리얼
import type { CookStep, Doneness, DonenessJudge, Ingredient, IngredientId } from '../contracts';

/** 부동소수 누적 오차 허용(3.0초가 2.9999999999999996으로 쌓이는 경우). */
export const EPS = 1e-9;

export const STEP_ORDER: readonly CookStep[] = [
  'margarine',
  'batter',
  'cook-1',
  'filling',
  'cook-2',
  'roll-1',
  'roll-2',
  'roll-3',
  'done',
];

/** 익음 게이지는 초당 20(0~100 기준)씩 오른다. */
const GAUGE_PER_SEC = 0.2;
const UNDER_BELOW = 0.6;
const BURNT_FROM = 0.86;
const TUTORIAL_PERFECT_FROM = 0.4;
const ROLL_PERIOD_SEC = 1.2;
const ROLL_FROM = 0.4;
const ROLL_TO = 0.6;

export const isGaugeStep = (s: CookStep): boolean => s === 'cook-1' || s === 'cook-2';
export const isRollStep = (s: CookStep): boolean => s === 'roll-1' || s === 'roll-2' || s === 'roll-3';

/** 타이밍 바 위치(0..1). 진입 시 0에서 시작해 1.2초 주기로 왕복한다. */
export function rollPosition(elapsedSec: number): number {
  const phase = (elapsedSec % ROLL_PERIOD_SEC) / ROLL_PERIOD_SEC;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** 단계 진입 후 경과 시간 → HoleState.gauge(0..1). 게이지가 없는 단계는 0. */
export function gaugeValue(step: CookStep, elapsedSec: number): number {
  if (isGaugeStep(step)) return Math.min(1, elapsedSec * GAUGE_PER_SEC);
  if (isRollStep(step)) return rollPosition(elapsedSec);
  return 0;
}

/**
 * 익음·굴리기 판정. 굴리기 실패는 방향(바 위치)으로 덜익음/탐을 돌려주지만
 * 감점 대상이 아니다(GDD: 실패는 완벽 판정만 무효). 감점은 익음 게이지만 센다.
 */
export function createDonenessJudge(isTutorial: boolean): DonenessJudge {
  return {
    judge(step: CookStep, gauge: number): Doneness {
      if (isRollStep(step)) {
        if (isTutorial) return 'perfect';
        if (gauge < ROLL_FROM - EPS) return 'under';
        return gauge > ROLL_TO + EPS ? 'burnt' : 'perfect';
      }
      // GDD 정수 구간 "적정 60~85, 탐 86 이상"은 연속값에서 "86 미만이 적정"으로 해석한다(PM 결정).
      if (!isGaugeStep(step)) return 'perfect';
      if (isTutorial) return gauge < TUTORIAL_PERFECT_FROM - EPS ? 'under' : 'perfect';
      if (gauge < UNDER_BELOW - EPS) return 'under';
      return gauge < BURNT_FROM - EPS ? 'perfect' : 'burnt';
    },
  };
}

/** 속재료 트레이 원본. 문어 외에는 함정. */
export const TRAY_SOURCE: readonly Ingredient[] = (
  ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'] satisfies IngredientId[]
).map((id) => ({ id, isTrap: id !== 'octopus' }));
