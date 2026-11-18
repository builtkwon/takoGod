// EventBus 이벤트 목록. 모듈 간 통신은 이 목록에 있는 이벤트로만 한다.

import type { CookStep, Doneness, DropTarget, FuneItem, IngredientId, Material, RejectReason } from './cooking';
import type { AnswerChoice, AnswerOutcome, Customer, CustomerStatus, DialogueLine, PatienceLevel, PlateDefect, TasteKind } from './customer';
import type { PhaseId, TutorialStage } from './phase';
import type { ReviewResult } from './review';

export interface GameEvents {
  // 입력 (ui → core)
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 input/place-material, input/roll, input/pick, input/drop. */
  'input/cook': { readonly hole: number; readonly step: CookStep; readonly ingredient?: IngredientId };
  'input/answer': { readonly customerId: string; readonly choice: AnswerChoice };
  /** 재료를 구멍으로 끌어 놓았다. 받을 수 없는 상태면 core가 cook/rejected를 낸다. */
  'input/place-material': { readonly hole: number; readonly material: Material };
  /** 구멍을 탭했다(굴리기 1회). 결과는 core가 판정해 cook/rolled(적중·빗나감) 또는 cook/tap-ignored(효과 없음)로 알린다. */
  'input/roll': { readonly hole: number };
  /** 완성·어두움·탄 구멍을 들기 시작했다. 들고 있는 동안 탐 타이머가 멈춘다. */
  'input/pick': { readonly hole: number };
  /**
   * 들고 있던 것을 놓았다. 버리기는 target 'offscreen'으로 통합한다: 탄 것을 화면 밖에 놓는 것도 후네·다른 곳에 놓는 것과 같은 "들었다 놓기"이고,
   * 결과(빈칸 / 거부·원위치)는 core가 상태에 따라 정하므로 ui가 알릴 것은 놓은 곳뿐이다.
   */
  'input/drop': { readonly target: DropTarget };

  // 굽기 (core → render·ui)
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. 구멍 상태는 GameStateV2.holes로 읽는다. */
  'cook/step-advanced': { readonly hole: number; readonly step: CookStep };
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. */
  'cook/judged': { readonly hole: number; readonly step: CookStep; readonly doneness: Doneness };
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. */
  'cook/ingredient-added': { readonly hole: number; readonly ingredient: IngredientId };
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 fune/added. */
  'cook/completed': { readonly hole: number };
  /** 조작을 거부했다. hole은 대상 구멍이다. 재료는 출처(트레이)로, 완성품은 이 구멍으로 돌아간다. ui는 되돌리기만 한다(튜토리얼 거부도 이 이벤트를 낸다). */
  'cook/rejected': { readonly hole: number; readonly reason: RejectReason };
  /** 굴리기 결과. 적중 여부는 core가 탭 순간의 바 위치와 영역으로 판정한다(GDD §굽기). 구멍 상태는 GameStateV2.holes로 읽는다. */
  'cook/rolled': { readonly hole: number; readonly hit: boolean };
  /** 효과 없는 탭(굴릴 수 없는 상태). 감점 없음, 헛손질 효과음의 근거다(GDD §굽기). */
  'cook/tap-ignored': { readonly hole: number };
  /** 완성 구멍이 어두워졌다(탐 타이머, GDD §굽기). */
  'cook/darkened': { readonly hole: number };
  /** 어두운 구멍이 탔다(탐 타이머, GDD §굽기). */
  'cook/burnt': { readonly hole: number };
  /** 완성품이 후네에 담겼다. count는 담긴 뒤 후네의 개수. */
  'fune/added': { readonly hole: number; readonly item: FuneItem; readonly count: number };

  // 손님·대화 (core → render·ui)
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 customer/entered. */
  'customer/arrived': { readonly customer: Customer };
  /** 손님이 입장했다. 이후 상태는 GameStateV2.customers로 읽는다. */
  'customer/entered': { readonly customer: CustomerStatus };
  'customer/left': { readonly customerId: string };
  'dialogue/started': { readonly customerId: string; readonly line: DialogueLine };
  'dialogue/resolved': { readonly customerId: string; readonly outcome: AnswerOutcome };
  /** 인내에 따라 얼굴 단계가 바뀌었다(되돌아가지 않는다. GDD §손님 대화). */
  'customer/patience-changed': { readonly customerId: string; readonly face: PatienceLevel };

  // 서빙·점수 공개 (core → ui). 순서는 두 경로다.
  //   다시해줘 경로: plate/tasted → plate/scored → customer/redo-requested (리뷰·퇴장 없음, 손님은 남는다)
  //   일반·떠남 경로: plate/tasted → plate/scored → [customer/walked-out] → review/issued → customer/left
  /**
   * 서빙 직후 맛보기 반응. defects가 비어 있으면 결함이 없는 접시이고 lines는 완벽 대사 1개다.
   * lines는 core가 GDD §손님 대화의 난수 순서대로 고른다(ui는 고르지 않고 표시만 한다).
   */
  'plate/tasted': {
    readonly customerId: string;
    readonly defects: readonly PlateDefect[];
    readonly lines: readonly { readonly defect: TasteKind; readonly text: string }[];
  };
  /**
   * 점수 공개. delta는 손님이 입장한 뒤 받은 만족도 증감의 합(시작값 대비), stars는 어두워짐 상한 적용 뒤 이 접시의 별점이다.
   * 다시해줘를 부르는 접시에도 낸다.
   */
  'plate/scored': { readonly customerId: string; readonly delta: number; readonly stars: number };
  /** 손님이 다시해줘를 요청했다. 이 접시에는 리뷰를 발급하지 않는다. */
  'customer/redo-requested': { readonly customerId: string };
  /** 0~1점 떠남. stars(0~1)를 남기고 떠난다. 이어서 review/issued와 customer/left가 나온다. */
  'customer/walked-out': { readonly customerId: string; readonly stars: number };

  // 진행·리뷰 (core → render·ui)
  'phase/changed': { readonly phase: PhaseId };
  'review/issued': { readonly review: ReviewResult };

  // 튜토리얼 (core → ui)
  /** @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 tutorial/invalid-action. */
  'tutorial/invalid-tap': { readonly expected: CookStep };
  /** 현재 유도 단계가 아닌 조작을 했다. ui는 화살표를 흔든다(되돌리기는 cook/rejected 'tutorial-step'). */
  'tutorial/invalid-action': { readonly expected: TutorialStage };
  'tutorial/trap-warning': { readonly ingredient: IngredientId };
}

export type GameEventType = keyof GameEvents;

export type EventHandler<K extends GameEventType> = (payload: GameEvents[K]) => void;

export interface EventBus {
  /** 구독 해제 함수를 돌려준다. */
  on<K extends GameEventType>(type: K, handler: EventHandler<K>): () => void;
  emit<K extends GameEventType>(type: K, payload: GameEvents[K]): void;
}
