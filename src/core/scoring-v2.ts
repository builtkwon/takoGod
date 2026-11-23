// 점수 규칙(개편). 원본: docs/GDD.md §굽기 판정 단위, §점수, §손님 대화
import type { FuneItem, IngredientId, PlateDefect } from '../contracts';

export const PERFECT_PLATE = 20;
export const NO_FILLING_PENALTY = -20;
export const TRAP_PENALTY = -20;
/** 인내 100% 도달(한 번). */
export const PATIENCE_EXPIRED = -20;

/** 접시 별점이 이 값 이하이면 다시해줘 후보(손님 1명당 1회). */
export const REDO_MAX_STARS = 2.5;
export const REDO_CHANCE = 0.2;
/** 접시 별점이 이 값 이하이고 다시해줘가 아니면 떠남 후보. */
export const WALKOUT_MAX_STARS = 1.5;
export const WALKOUT_CHANCE = 0.15;

const isTrap = (i: FuneItem): boolean => i.filling !== null && i.filling !== 'octopus';

/** 주문 손님의 접시에서 주문 재료는 함정이 아니다. 빼 주세요 위반은 별도 규칙이다. */
export interface PlateContext {
  /** 주문(GDD §주문): 재료 ingredient가 정확히 count개, 나머지는 문어. */
  readonly order?: { readonly ingredient: IngredientId; readonly count: number } | null;
  /** 빼 주세요(GDD §특별 손님): 이 재료가 접시에 있으면 위반이다. */
  readonly avoid?: IngredientId | null;
}

export const ORDER_SUCCESS_DELTA = 15;
export const ORDER_FAIL_DELTA = -15;
/** 빼 주세요 위반: 만족도 -40 하나로 끝낸다(그 재료의 함정 -20과 인내 100% -20은 더하지 않는다). */
export const ALLERGY_DELTA = -40;
/** 주문 성공 접시의 가게 점수 보너스(콤보 배수 전 기본에 더한다). */
export const ORDER_SCORE_BONUS = 50;
/** 지우개가 든 접시의 식품 신고 확률과 별점 감점. */
export const REPORT_CHANCE = 0.03;
export const REPORT_STARS_PENALTY = 1;
export const MIN_REPORTED_STARS = 0.5;

/** 주문 판정: 주문 재료가 정확히 count개이고 나머지는 모두 문어. 속 없음 구멍은 문어가 아니라 실패다. 어두운 알도 그 재료로 센다. */
export function orderSucceeded(items: readonly FuneItem[], order: { readonly ingredient: IngredientId; readonly count: number }): boolean {
  if (items.some((i) => i.noFilling || i.filling === null)) return false;
  return items.filter((i) => i.filling === order.ingredient).length === order.count && items.every((i) => i.filling === order.ingredient || i.filling === 'octopus');
}

/** 접시에 빼 주세요 재료가 1개라도 있으면 위반이다. */
export const allergyViolated = (items: readonly FuneItem[], avoid: IngredientId | null | undefined): boolean => avoid != null && items.some((i) => i.filling === avoid);

/** 완벽 굽기: 6개 모두 굴리기 2회 적중, 속재료 문어(주문 손님은 주문대로), 어두워짐 0개. */
export function isPerfectPlate(items: readonly FuneItem[], ctx: PlateContext = {}): boolean {
  if (!items.every((i) => i.rolledPerfectly && !i.dark)) return false;
  return ctx.order ? orderSucceeded(items, ctx.order) : items.every((i) => i.filling === 'octopus');
}

/** 접시의 결함 종류. 종류당 한 번, 속 없음·함정·어두움·빗나감 순서. 주문 재료는 함정이 아니다. */
export function plateDefects(items: readonly FuneItem[], ctx: PlateContext = {}): PlateDefect[] {
  const out: PlateDefect[] = [];
  if (items.some((i) => i.noFilling)) out.push('no-filling');
  if (items.some((i) => isTrap(i) && i.filling !== ctx.order?.ingredient)) out.push('trap');
  if (items.some((i) => i.dark)) out.push('dark');
  if (items.some((i) => !i.rolledPerfectly)) out.push('roll-miss');
  return out;
}

/**
 * 접시가 만족도에 주는 변화(적용 순서). 어두움·빗나감은 만족도가 아니라 별점 상한·완벽 무효로만 작용한다.
 * 순서: 완벽 +20, 속 없음 -20, 함정 -20(주문 재료·빼 주세요 재료 제외), 빼 주세요 위반 -40, 주문 ±15.
 */
export function plateChanges(items: readonly FuneItem[], ctx: PlateContext = {}): number[] {
  const out: number[] = [];
  if (isPerfectPlate(items, ctx)) out.push(PERFECT_PLATE);
  if (items.some((i) => i.noFilling)) out.push(NO_FILLING_PENALTY);
  if (items.some((i) => isTrap(i) && i.filling !== ctx.order?.ingredient && i.filling !== ctx.avoid)) out.push(TRAP_PENALTY);
  if (allergyViolated(items, ctx.avoid)) out.push(ALLERGY_DELTA);
  if (ctx.order) out.push(orderSucceeded(items, ctx.order) ? ORDER_SUCCESS_DELTA : ORDER_FAIL_DELTA);
  return out;
}

/** 식품 신고 대상: 접시에 지우개가 1개 이상(주문 여부 무관). */
export const hasEraser = (items: readonly FuneItem[]): boolean => items.some((i) => i.filling === 'eraser');

/** 식품 신고로 깎인 별점: 1★ 감점, 최저 0.5★. 이미 0.5★ 이하면 그대로다. 깎인 만큼을 함께 돌려준다. */
export function reportedStars(stars: number): { readonly stars: number; readonly penalty: number } {
  if (stars <= MIN_REPORTED_STARS) return { stars, penalty: 0 };
  const next = Math.max(MIN_REPORTED_STARS, stars - REPORT_STARS_PENALTY);
  return { stars: next, penalty: stars - next };
}

/** 어두워진 개수별 별점 상한 범위. 어두운 구멍이 없으면 null. */
export function darkCapRange(count: number): { readonly min: number; readonly max: number } | null {
  if (count <= 0) return null;
  if (count === 1) return { min: 3.5, max: 4 };
  if (count <= 3) return { min: 3, max: 3.5 };
  if (count <= 5) return { min: 2.5, max: 3 };
  return { min: 2, max: 2.5 };
}

/** 리뷰 코멘트 구간(1~5). 0.5 단위는 내림하고 0~1점은 1 구간을 쓴다. */
export const commentBucket = (stars: number): 1 | 2 | 3 | 4 | 5 => Math.min(5, Math.max(1, Math.floor(stars))) as 1 | 2 | 3 | 4 | 5;

/** 굴리기 적중 1회당 가게 점수 보너스. */
export const HIT_BONUS = 5;
const COMBO_STEP = 0.2;
const COMBO_MAX_MULTIPLIER = 2;
/** 깐깐한 VIP의 완벽 접시 점수 배수(콤보 배수와 곱한다). */
export const VIP_PERFECT_MULTIPLIER = 2;

export interface ShopScoreExtra {
  /** 주문 성공 보너스(+50). 콤보 배수 전 기본에 더한다. */
  readonly orderBonus?: number;
  /** 깐깐한 VIP 손님의 접시. 완벽이면 ×2. */
  readonly vip?: boolean;
}

/**
 * 접시 가게 점수(GDD §가게 점수): round((기본 + 적중 × 5 + 주문 보너스) × 콤보 배수 × VIP 배수). 콤보 배수는 연속 완벽 n번째에 1.0 + 0.2 × (n − 1)(최대 2.0)이고
 * 완벽이 아니면 ×1.0과 콤보 0이다. prevCombo는 이 접시 전의 연속 완벽 수다. multiplier는 콤보 배수와 VIP 배수의 곱이다.
 */
export function shopPlateScore(
  base: number,
  hits: number,
  perfect: boolean,
  prevCombo: number,
  extra: ShopScoreExtra = {},
): { points: number; multiplier: number; combo: number } {
  const combo = perfect ? prevCombo + 1 : 0;
  const comboMultiplier = perfect ? Math.min(COMBO_MAX_MULTIPLIER, Math.round((1 + COMBO_STEP * (combo - 1)) * 10) / 10) : 1;
  const multiplier = comboMultiplier * (perfect && extra.vip ? VIP_PERFECT_MULTIPLIER : 1);
  return { points: Math.round((base + hits * HIT_BONUS + (extra.orderBonus ?? 0)) * multiplier), multiplier, combo };
}
