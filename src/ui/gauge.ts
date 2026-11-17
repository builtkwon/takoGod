import type { CookStep, Doneness } from '../contracts';

export type Zone = 'under' | 'perfect' | 'burnt' | 'success' | 'fail';
export interface Band {
  readonly zone: Zone;
  /** 0..100, 표시용 */
  readonly from: number;
  readonly to: number;
}

// 구간 경계는 표시용 상수다. 판정은 core가 한다. 원본: docs/GDD.md §굽기, §튜토리얼
const COOK: readonly Band[] = [
  { zone: 'under', from: 0, to: 60 },
  { zone: 'perfect', from: 60, to: 86 },
  { zone: 'burnt', from: 86, to: 100 },
];
const COOK_TUTORIAL: readonly Band[] = [
  { zone: 'under', from: 0, to: 40 },
  { zone: 'perfect', from: 40, to: 100 },
];
const ROLL: readonly Band[] = [
  { zone: 'fail', from: 0, to: 40 },
  { zone: 'success', from: 40, to: 60 },
  { zone: 'fail', from: 60, to: 100 },
];
const ROLL_TUTORIAL: readonly Band[] = [{ zone: 'success', from: 0, to: 100 }];

const isCook = (s: CookStep): boolean => s === 'cook-1' || s === 'cook-2';
const isRoll = (s: CookStep): boolean => s === 'roll-1' || s === 'roll-2' || s === 'roll-3';

/** 단계별 구간 막대. 게이지·타이밍 바가 없는 단계는 null. */
export function gaugeBands(step: CookStep, tutorial: boolean): readonly Band[] | null {
  if (isCook(step)) return tutorial ? COOK_TUTORIAL : COOK;
  if (isRoll(step)) return tutorial ? ROLL_TUTORIAL : ROLL;
  return null;
}

/** 게이지(0..1) → 막대 위치(%). 범위 밖·NaN은 끝으로 붙인다. */
export function markerPercent(gauge: number): number {
  return Number.isFinite(gauge) ? Math.min(100, Math.max(0, gauge * 100)) : 0;
}

const COOK_TEXT: Readonly<Record<Doneness, string>> = { under: '덜익음', perfect: '적정', burnt: '탐' };

/** cook/judged 표시 문구. 굴리기의 under/burnt는 '탐'이 아니라 '실패'로만 보여 준다. */
export function judgedText(step: CookStep, doneness: Doneness): string {
  if (isCook(step)) return COOK_TEXT[doneness];
  if (isRoll(step)) return doneness === 'perfect' ? '성공' : '실패';
  return '';
}
