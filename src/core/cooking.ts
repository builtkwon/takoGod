// 굽기 공용 값. 원본: docs/GDD.md §굽기. 구멍 상태기계 상수는 cooking-v2.ts에 있다.
import type { Ingredient, IngredientId } from '../contracts';

/** 부동소수 누적 오차 허용(3.0초가 2.9999999999999996으로 쌓이는 경우). */
export const EPS = 1e-9;

const ROLL_PERIOD_SEC = 1.6;

/** 타이밍 바 위치(0..1). 진입 시 0에서 시작해 1.2초 주기로 왕복한다. */
export function rollPosition(elapsedSec: number): number {
  const phase = (elapsedSec % ROLL_PERIOD_SEC) / ROLL_PERIOD_SEC;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** 속재료 트레이 원본. 문어 외에는 함정. */
export const TRAY_SOURCE: readonly Ingredient[] = (
  ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'] satisfies IngredientId[]
).map((id) => ({ id, isTrap: id !== 'octopus' }));
