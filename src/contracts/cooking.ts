// 굽기 관련 계약. 원본: docs/GDD.md §굽기

/**
 * 굽기 단계. 옛 GDD 순서 1~9와 1:1 대응한다.
 * @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 HoleStage.
 */
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

/**
 * 익음·타이밍 판정 결과: 덜익음(빠름) / 적정 / 탐(늦음).
 * @deprecated 6단계 ui·render 전환 뒤 삭제. 덜익음 판정이 없어졌다(GDD §굽기).
 */
export type Doneness = 'under' | 'perfect' | 'burnt';

/**
 * 익음 게이지와 굴리기 타이밍을 판정한다.
 * gauge는 정규화 값(0..1)이다. 익음 단계(cook-1, cook-2)는 진입 후 0에서 시작해 증가하는 게이지이고,
 * 굴리기 단계(roll-1~3)는 왕복하는 타이밍 바 위치다(GDD §굽기).
 * 적정 구간 폭과 탐 판정 여부는 PhaseConfig.isTutorial에 따라 구현이 정한다.
 * @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 구멍 상태기계가 판정하고 contracts에 판정 인터페이스를 두지 않는다.
 */
export interface DonenessJudge {
  judge(step: CookStep, gauge: number): Doneness;
}

/**
 * 6구 철판의 구멍 하나. 구멍별로 독립 상태를 가진다.
 * @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 HoleStateV2.
 */
export interface HoleState {
  /** 0..5 */
  readonly index: number;
  /** 다음에 수행할 단계. 아직 시작 전이면 'margarine'. */
  readonly step: CookStep;
  /** 현재 단계의 값(0..1). 익음 단계는 증가하는 게이지, 굴리기 단계는 왕복하는 타이밍 바 위치, 그 외 단계는 0. */
  readonly gauge: number;
  readonly filling: IngredientId | null;
  /** 이 구멍에서 지금까지 나온 판정 결과. */
  readonly judgements: readonly Doneness[];
}

// ── 굽기 조작 개편(GDD §굽기, 2026-11-18). 옛 타입과 병행하며, 옛 것은 6단계 ui·render 전환 뒤 삭제한다. ──
// V2 접미사는 옛 이름(HoleState, GameState)과 병행하는 동안만 쓴다. 옛 것을 지울 때 V2를 뗀다.

/**
 * 구멍 상태(GDD §굽기 상태 흐름). 들고 있음은 상태가 아니라 GameStateV2.holding이다.
 * 속 없음은 상태가 아니라 HoleStateV2.noFilling 표시다.
 */
export type HoleStage =
  | 'empty' // 빈칸
  | 'greased' // 기름칠(마가린)
  | 'cooking' // 익힘(반죽 시작, 경과 시간은 GDD §굽기)
  | 'cooked' // 익힘 완료
  | 'filled' // 속재료 후
  | 'rolled' // 굴림 1
  | 'done' // 완성(탐 타이머 시작)
  | 'dark' // 어두움(탐 타이머 누적, GDD §굽기)
  | 'burnt'; // 탄 것(탐 타이머 누적, GDD §굽기)

/** 구멍으로 끌어 놓는 재료. 속재료는 트레이의 재료 id를 함께 보낸다. */
export type Material =
  | { readonly kind: 'margarine' }
  | { readonly kind: 'batter' }
  | { readonly kind: 'filling'; readonly ingredient: IngredientId };

/** 타이밍 바 영역(0..1, 가운데 정렬). 영역 폭은 GDD §굽기(W1·W2). */
export interface RollZone {
  readonly from: number;
  readonly to: number;
}

/** 구멍 하나의 상태(새 흐름). 구멍별로 독립 상태를 가진다. */
export interface HoleStateV2 {
  /** 0..5 (내부용. 화면에는 번호를 보이지 않는다) */
  readonly index: number;
  readonly stage: HoleStage;
  /** 익힘 경과(초). 'cooking'에서만 증가하고 정해진 시간에 'cooked'로 넘어간다(GDD §굽기). 그 밖의 단계는 0. */
  readonly cookElapsedSec: number;
  /** 탐 타이머 누적(초). 'done'·'dark'에서 증가하고 들고 있는 동안은 멈춘다. 'dark'·'burnt' 전환 시점은 GDD §굽기. */
  readonly burnElapsedSec: number;
  /** 넣은 속재료. 속재료 전이거나 속 없음이면 null. */
  readonly filling: IngredientId | null;
  /** 속재료 전에 굴려 "속 없음"으로 고정됐다(감점과 완벽 무효는 GDD §굽기·§점수). */
  readonly noFilling: boolean;
  /** 굴리기 1·2 적중 기록. null은 아직 굴리지 않음. 둘 다 true여야 굴리기 완벽이다. */
  readonly rollHits: readonly [boolean | null, boolean | null];
  /** 이 구멍의 다음 굴리기에 적용되는 영역(W1은 'filled', W2는 'rolled'). 굴릴 수 없는 단계는 null. 바에 표시할 영역은 GameStateV2.barZone이다. */
  readonly rollZone: RollZone | null;
  /** core가 GDD §굽기 깜빡임 조건으로 정한다. render는 테두리 깜빡임에만 쓴다. */
  readonly warn: boolean;
}

/** 후네에 담긴 완성품 하나의 판정 사실. 결함 계산과 맛보기 반응의 근거다. */
export interface FuneItem {
  /** 굴리기 2회 모두 적중. */
  readonly rolledPerfectly: boolean;
  /** 속재료. 속 없음이면 null. */
  readonly filling: IngredientId | null;
  readonly noFilling: boolean;
  /** 어두워진 상태로 담겼다(탄 것은 담을 수 없다). */
  readonly dark: boolean;
}

/**
 * 놓은 곳(GDD §굽기). 후네에 닿게 놓으면 'fune', 그 밖의 곳(화면 밖 포함)은 'other'다.
 * 포인터 취소·앱 백그라운드 전환은 놓은 것이 아니라 'cancel'로 보낸다(원래 구멍으로 되돌리고 탐 타이머를 다시 흘린다).
 */
export type DropTarget =
  | 'fune'
  | 'other'
  | 'cancel'
  /** @deprecated 'other'로 통합. 화면 밖에 놓아도 후네 밖과 같다(떨어져 사라진다). */
  | 'offscreen';

/**
 * 조작이 거부된 이유. 거부되면 재료·완성품은 원위치로 돌아간다(ui가 되돌리기만 한다).
 * 후네 밖에 놓기는 거부가 아니라 떨어져 사라진다(cook/dropped). 튜토리얼만 후네 밖 놓기를 거부한다.
 */
export type RejectReason =
  | 'invalid-stage' // 지금 상태에서 받을 수 없는 재료·조작
  | 'fune-full' // 후네가 가득 찼다(떨어뜨리지 않고 원래 구멍으로 되돌린다)
  /** @deprecated 탄 것은 거부가 아니라 어디에 놓든 떨어져 사라진다(cook/dropped). 더 이상 내지 않는다. */
  | 'burnt-item'
  | 'already-holding' // 들기는 동시에 1개
  | 'tutorial-step'; // 튜토리얼에서 현재 유도 단계가 아닌 조작(후네 밖 놓기 포함)
