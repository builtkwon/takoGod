// 점수 규칙(개편). 원본: docs/GDD.md §굽기 판정 단위, §점수, §손님 대화
import type { FuneItem, PlateDefect } from '../contracts';

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

/** 완벽 굽기: 6개 모두 굴리기 2회 적중, 속재료 문어, 어두워짐 0개. */
export const isPerfectPlate = (items: readonly FuneItem[]): boolean =>
  items.every((i) => i.rolledPerfectly && i.filling === 'octopus' && !i.dark);

/** 접시의 결함 종류. 종류당 한 번, 속 없음·함정·어두움·빗나감 순서. */
export function plateDefects(items: readonly FuneItem[]): PlateDefect[] {
  const out: PlateDefect[] = [];
  if (items.some((i) => i.noFilling)) out.push('no-filling');
  if (items.some(isTrap)) out.push('trap');
  if (items.some((i) => i.dark)) out.push('dark');
  if (items.some((i) => !i.rolledPerfectly)) out.push('roll-miss');
  return out;
}

/** 접시가 만족도에 주는 변화(적용 순서). 어두움·빗나감은 만족도가 아니라 별점 상한·완벽 무효로만 작용한다. */
export function plateChanges(items: readonly FuneItem[]): number[] {
  const out: number[] = [];
  if (isPerfectPlate(items)) out.push(PERFECT_PLATE);
  if (items.some((i) => i.noFilling)) out.push(NO_FILLING_PENALTY);
  if (items.some(isTrap)) out.push(TRAP_PENALTY);
  return out;
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
