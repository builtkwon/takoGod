import type { ReviewResult } from '../contracts';

export type TitleChoice = 'start' | 'tutorial';

export interface UiHandle {
  /**
   * 타이틀 화면을 띄우고 버튼 선택을 돌려준다. '시작'은 'start', tutorialButton이 true일 때만 있는 '튜토리얼'은 'tutorial'.
   * 생략·false면 버튼은 '시작' 하나다.
   */
  title(opts?: { readonly tutorialButton?: boolean }): Promise<TitleChoice>;
  /** 결과 화면. '다시 하기'를 누르면 화면을 닫고 'again'으로 resolve한다(반환을 무시해도 된다). */
  showResult(result: { readonly average: number | null; readonly reviews: readonly ReviewResult[] }): Promise<'again'>;
  destroy(): void;
}
