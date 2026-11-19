// 굽기 관련 계약. 원본: docs/GDD.md §굽기

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

// ── 굽기 조작 개편(GDD §굽기, 2026-11-18) ──
// 옛 흐름 타입은 삭제했다. V2 접미사(HoleStateV2 등)를 떼는 이름 변경은 따로 남아 있다.

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
  /** @deprecated 'other'로 통합. 화면 밖에 놓아도 후네 밖과 같다(떨어져 사라진다). core의 sim·테스트가 아직 쓰고 있어 core 정리 때 삭제한다. */
  | 'offscreen';

/**
 * 조작이 거부된 이유. 거부되면 재료·완성품은 원위치로 돌아간다(ui가 되돌리기만 한다).
 * 후네 밖에 놓기는 거부가 아니라 떨어져 사라진다(cook/dropped). 튜토리얼만 후네 밖 놓기를 거부한다.
 */
export type RejectReason =
  | 'invalid-stage' // 지금 상태에서 받을 수 없는 재료·조작
  | 'fune-full' // 후네가 가득 찼다(떨어뜨리지 않고 원래 구멍으로 되돌린다)
  | 'already-holding' // 들기는 동시에 1개
  | 'tutorial-step'; // 튜토리얼에서 현재 유도 단계가 아닌 조작(후네 밖 놓기 포함)
