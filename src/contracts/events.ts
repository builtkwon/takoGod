// EventBus 이벤트 목록. 모듈 간 통신은 이 목록에 있는 이벤트로만 한다.

import type { CookStep, Doneness, IngredientId } from './cooking';
import type { AnswerChoice, AnswerOutcome, Customer, DialogueLine } from './customer';
import type { PhaseId } from './phase';
import type { ReviewResult } from './review';

export interface GameEvents {
  // 입력 (ui → core)
  'input/cook': { readonly hole: number; readonly step: CookStep; readonly ingredient?: IngredientId };
  'input/answer': { readonly customerId: string; readonly choice: AnswerChoice };

  // 굽기 (core → render·ui)
  'cook/step-advanced': { readonly hole: number; readonly step: CookStep };
  'cook/judged': { readonly hole: number; readonly step: CookStep; readonly doneness: Doneness };
  'cook/ingredient-added': { readonly hole: number; readonly ingredient: IngredientId };
  'cook/completed': { readonly hole: number };

  // 손님·대화 (core → render·ui)
  'customer/arrived': { readonly customer: Customer };
  'customer/left': { readonly customerId: string };
  'dialogue/started': { readonly customerId: string; readonly line: DialogueLine };
  'dialogue/resolved': { readonly customerId: string; readonly outcome: AnswerOutcome };

  // 진행·리뷰 (core → render·ui)
  'phase/changed': { readonly phase: PhaseId };
  'review/issued': { readonly review: ReviewResult };

  // 튜토리얼 (core → ui)
  'tutorial/invalid-tap': { readonly expected: CookStep };
  'tutorial/trap-warning': { readonly ingredient: IngredientId };
}

export type GameEventType = keyof GameEvents;

export type EventHandler<K extends GameEventType> = (payload: GameEvents[K]) => void;

export interface EventBus {
  /** 구독 해제 함수를 돌려준다. */
  on<K extends GameEventType>(type: K, handler: EventHandler<K>): () => void;
  emit<K extends GameEventType>(type: K, payload: GameEvents[K]): void;
}
