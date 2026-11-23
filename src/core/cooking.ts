// 굽기 공용 값. 원본: docs/GDD.md §굽기. 구멍 상태기계 상수는 cooking-v2.ts에 있다.
import type { Ingredient, IngredientId } from '../contracts';

/** 부동소수 누적 오차 허용(3.0초가 2.9999999999999996으로 쌓이는 경우). */
export const EPS = 1e-9;

const DEFAULT_PERIOD_SEC = 1.6;

/** 한 주기를 1로 센 누적 위상(cycles)에서 타이밍 바 위치(0..1). 0에서 시작해 1까지 올라갔다 내려온다. */
export function trianglePosition(cycles: number): number {
  const phase = cycles % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** 주기가 일정할 때 경과 시간으로 바 위치를 구한다. 주기가 단계마다 바뀌는 게임 본체는 trianglePosition을 쓴다. */
export const rollPosition = (elapsedSec: number, periodSec = DEFAULT_PERIOD_SEC): number => trianglePosition(elapsedSec / periodSec);

/** 속재료 트레이 원본. 문어 외에는 함정. */
export const TRAY_SOURCE: readonly Ingredient[] = (
  ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'] satisfies IngredientId[]
).map((id) => ({ id, isTrap: id !== 'octopus' }));
