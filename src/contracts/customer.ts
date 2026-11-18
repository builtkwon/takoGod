// 손님·대화 계약. 원본: docs/GDD.md §손님 대화, §콘텐츠

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

/**
 * @deprecated 6단계 ui·render 전환 뒤 삭제. 새 흐름은 CustomerStatus(만족도를 노출하지 않는다).
 */
export interface Customer {
  readonly id: string;
  readonly personality: Personality;
  /** 만족도. 시작값과 증감은 GDD §점수를 따른다. */
  readonly satisfaction: number;
  /** 발화 간격(초). PhaseConfig.dialogueIntervalsSec에서 온다. */
  readonly dialogueIntervalSec: number;
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
