// 세션 저장 계약. 원본: docs/GDD.md §제품, docs/adr/0002-session-storage.md

import type { ReviewResult } from './review';

/** sessionStorage `takoyaki:session`에 JSON으로 저장하는 값. */
export interface SessionSnapshot {
  readonly version: 1;
  readonly tutorialCompleted: boolean;
  /** P5까지 끝나 결과 화면에 도달했다. */
  readonly finished: boolean;
  readonly reviews: readonly ReviewResult[];
}

/** 저장소 포트. core는 이 타입만 쓰고, 브라우저 구현은 main이 조립한다. */
export interface SessionStore {
  /** 값이 없거나 파싱 실패·version 불일치면 null. */
  load(): SessionSnapshot | null;
  save(s: SessionSnapshot): void;
}

/**
 * 최고 가게 점수 저장소 포트(localStorage `takoyaki:best`, 값 `{version: 1, best: number}`). 원본: docs/GDD.md §제품·§가게 점수, docs/adr/0004-best-shop-score-storage.md.
 * 브라우저 구현은 main이 조립한다.
 */
export interface BestScoreStore {
  /** 값이 없거나 파싱 실패·version 불일치·best가 유한한 0 이상의 수가 아니면 null. */
  load(): number | null;
  save(best: number): void;
}
