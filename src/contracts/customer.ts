// 손님·대화 계약. 원본: docs/GDD.md §손님 대화, §콘텐츠
import type { IngredientId } from './cooking';

export type Personality = 'salaryman' | 'grandma' | 'gourmet' | 'tourist';

/**
 * 손님 문항 하나. prompt는 손님 대사, good/bad는 답 버튼 문구.
 * personality는 §3 필수 필드({prompt, good, bad})에 더해, 성격별 문항 선택을 위해 둔다.
 */
export interface DialogueLine {
  readonly personality: Personality;
  readonly prompt: string;
  readonly good: string;
  readonly bad: string;
}

// ── 굽기 조작 개편(GDD §손님 대화, 2026-11-18) ──

/** 손님 얼굴 단계: 기본 → 주황 → 빨강. 단계 경계 비율은 GDD §손님 대화. 되돌아가지 않는다. */
export type PatienceLevel = 'normal' | 'annoyed' | 'angry';

/**
 * 손님 하나의 공개 상태(새 흐름).
 * 점수 비공개(GDD §손님 대화) 규칙에 따라 만족도를 담지 않는다. 만족도 합산은 서빙 뒤 'plate/scored' 이벤트로만 공개된다.
 */
export interface CustomerStatus {
  readonly id: string;
  readonly personality: Personality;
  /** 발화 간격(초). PhaseConfig.dialogueIntervalsSec에서 온다. */
  readonly dialogueIntervalSec: number;
  /** 인내 경과 비율(0..1). 입장 시점부터 센다. 1에 도달했을 때의 처리는 GDD §손님 대화. */
  readonly patience: number;
  readonly face: PatienceLevel;
  /** 다시해줘를 요청해 다음 완성 후네를 우선 받는 중. */
  readonly awaitingRedo: boolean;

  // ── v0.6.0 주문·특별 손님(GDD §주문, §특별 손님) ──
  // 아래 필드는 모두 선택이다. 없거나 null이면 해당 없음이다(옛 생성처가 고치지 않아도 컴파일되도록 평평한 선택 필드로 둔다).
  // core는 입장 때 정한 값을 서빙·퇴장까지 바꾸지 않고 항상 채워 낸다(단체의 platesReceived만 서빙마다 늘어난다).
  /** 주문(10단계~): 재료 ingredient를 count개, 나머지는 문어. count 6은 "모두". 비문어 5종 중 하나다. 판정은 core가 하고 결과는 'order/resolved'다. */
  readonly order?: { readonly ingredient: IngredientId; readonly count: 1 | 3 | 6 } | null;
  /** 빼 주세요(13단계~): 이 재료가 접시에 있으면 위반이다. 머리 위 금지 아이콘의 근거. 위반은 'customer/allergy'다. */
  readonly avoid?: IngredientId | null;
  /** 단체 주문(15단계~): 접시를 platesNeeded개 받는다. platesReceived는 지금까지 받은 수다(머리 위 "×2" 표시). order와 함께 오지 않는다. */
  readonly group?: { readonly platesNeeded: 2; readonly platesReceived: number } | null;
  /** 깐깐한 VIP(17단계~): 왕관 표시. 인내·점수 배율은 core가 적용한다. */
  readonly vip?: boolean;
}

/** 접시의 결함 종류. 결함이 없으면 맛보기 반응은 'perfect'다. 탄 것은 접시에 들어가지 않으므로 없다. */
export type PlateDefect = 'no-filling' | 'trap' | 'dark' | 'roll-miss';

/** 맛보기 반응 대사의 종류(결함 4 + 완벽). */
export type TasteKind = PlateDefect | 'perfect';

/** 맛보기 반응 대사 데이터(src/data). 종류·성격당 2개(GDD §콘텐츠). 개수 검사는 dialogue.lint 확장 대상이다(아직 없음). */
export type TasteLines = Readonly<Record<Personality, Readonly<Record<TasteKind, readonly string[]>>>>;

export type AnswerChoice = 'good' | 'bad';
export type AnswerOutcome = AnswerChoice | 'timeout';

/** 진행 중인 대화. 답 버튼 위치는 ui가 정한다. */
export interface ActiveDialogue {
  readonly customerId: string;
  readonly line: DialogueLine;
  readonly remainingSec: number;
}
