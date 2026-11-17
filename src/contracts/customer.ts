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

export interface Customer {
  readonly id: string;
  readonly personality: Personality;
  /** 만족도. 시작값과 증감은 GDD §점수를 따른다. */
  readonly satisfaction: number;
  /** 발화 간격(초). PhaseConfig.dialogueIntervalsSec에서 온다. */
  readonly dialogueIntervalSec: number;
}

export type AnswerChoice = 'good' | 'bad';
export type AnswerOutcome = AnswerChoice | 'timeout';

/** 진행 중인 대화. 답 버튼 위치는 ui가 정한다. */
export interface ActiveDialogue {
  readonly customerId: string;
  readonly line: DialogueLine;
  readonly remainingSec: number;
}
