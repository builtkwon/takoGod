// 굽기 관련 계약. 원본: docs/GDD.md §굽기

/** 굽기 단계. GDD 순서 1~9와 1:1 대응한다. */
export type CookStep =
  | 'margarine' // 1 마가린
  | 'batter' // 2 반죽물
  | 'cook-1' // 3 살짝 익음 (익음 게이지)
  | 'filling' // 4 속재료 넣기
  | 'cook-2' // 5 살짝 익음 (익음 게이지)
  | 'roll-1' // 6 굴리기 1 (타이밍 판정)
  | 'roll-2' // 7 굴리기 2 (타이밍 판정)
  | 'roll-3' // 8 굴리기 3 (타이밍 판정)
  | 'done'; // 9 완성

export type IngredientId =
  | 'octopus'
  | 'wasabi'
  | 'raw-garlic'
  | 'eraser'
  | 'marshmallow'
  | 'chili';

/** 속재료 트레이의 재료 하나. 문어 외에는 함정 재료다. */
export interface Ingredient {
  readonly id: IngredientId;
  readonly isTrap: boolean;
}

/** 익음·타이밍 판정 결과: 덜익음(빠름) / 적정 / 탐(늦음). */
export type Doneness = 'under' | 'perfect' | 'burnt';

/**
 * 익음 게이지와 굴리기 타이밍을 판정한다.
 * gauge는 해당 단계 진입 후 0에서 시작해 증가하는 정규화 값(0..1)이다.
 * 적정 구간 폭과 탐 판정 여부는 PhaseConfig.isTutorial에 따라 구현이 정한다.
 */
export interface DonenessJudge {
  judge(step: CookStep, gauge: number): Doneness;
}

/** 6구 철판의 구멍 하나. 구멍별로 독립 상태를 가진다. */
export interface HoleState {
  /** 0..5 */
  readonly index: number;
  /** 다음에 수행할 단계. 아직 시작 전이면 'margarine'. */
  readonly step: CookStep;
  /** 현재 단계의 게이지(0..1). 게이지가 없는 단계는 0. */
  readonly gauge: number;
  readonly filling: IngredientId | null;
  /** 이 구멍에서 지금까지 나온 판정 결과. */
  readonly judgements: readonly Doneness[];
}
