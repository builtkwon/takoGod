import type { ReviewResult } from '../contracts';

export interface UiHandle {
  /** 타이틀 화면을 띄우고 시작 버튼이 눌리면 resolve된다. */
  title(): Promise<void>;
  /** 결과 화면. average는 GameState.sessionAverage(core 계산)이고 null이면 점수를 표시하지 않는다. */
  showResult(result: { readonly average: number | null; readonly reviews: readonly ReviewResult[] }): void;
  destroy(): void;
}
