import type { ReviewResult } from '../contracts';

export type TitleChoice = 'start' | 'tutorial';

export interface UiHandle {
  /**
   * 타이틀 화면을 띄우고 버튼 선택을 돌려준다. '시작'은 'start', tutorialButton이 true일 때만 있는 '튜토리얼'은 'tutorial'.
   * 생략·false면 버튼은 '시작' 하나다.
   */
  title(opts?: { readonly tutorialButton?: boolean }): Promise<TitleChoice>;
  /** 결과 화면. average는 GameState.sessionAverage(core 계산)이고 null이면 점수를 표시하지 않는다. */
  showResult(result: { readonly average: number | null; readonly reviews: readonly ReviewResult[] }): void;
  destroy(): void;
}
