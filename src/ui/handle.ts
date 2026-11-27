import type { ReviewResult } from '../contracts';

export type TitleChoice = 'start' | 'tutorial' | 'skip';

export interface UiHandle {
  /**
   * 타이틀 화면을 띄우고 버튼 선택을 돌려준다. '시작'은 'start', tutorialButton이 true일 때만 있는 '튜토리얼'은 'tutorial'.
   * 생략하면 버튼은 '시작' 하나다. 명시적으로 false(기록 없음)이면 '시작' 아래에 '튜토리얼 건너뛰기'(= 'skip')가 붙는다.
   */
  title(opts?: { readonly tutorialButton?: boolean }): Promise<TitleChoice>;
  /** 결과 화면. '다시 하기'를 누르면 화면을 닫고 'again'으로 resolve한다(반환을 무시해도 된다). */
  showResult(result: { readonly average: number | null; readonly reviews: readonly ReviewResult[] }): Promise<'again'>;
  /**
   * 확인 모달('다시 하기' 확인)이 열려 있는 동안 true. main은 프레임에서 isPaused()이면 core tick을 건너뛰고 렌더만 한다(일시정지).
   * 모달을 닫으면(예·아니오·판 초기화) false로 돌아온다.
   */
  isPaused(): boolean;
  destroy(): void;
}
