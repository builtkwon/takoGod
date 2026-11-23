import type { ReviewResult } from '../contracts';
import { hudText, titleText } from '../data';
import type { TitleChoice } from './handle';
import { el } from './dom';
import { PERSONALITY_LABEL, sessionAverageText } from './format';
import { starRow, starsLabel } from './v2/stars';

const TOAST_MS = 3000;

/** 카드 우상단 별 칸. */
function starCorner(stars: number): HTMLElement {
  const e = el('div', 'ui-card-stars');
  e.append(starRow(stars));
  return e;
}

function overlay(layer: HTMLElement, cls: string): HTMLElement {
  const o = el('div', `ui-overlay ui-hit ${cls}`);
  layer.append(o);
  return o;
}

/** 버그 제보용 버전 라벨(하단 작은 글씨, 선택 가능). 문자열은 main이 만들어 넘기고 형식은 정하지 않는다. 없거나 비면 null. */
export function versionTag(label: string | undefined): HTMLElement | null {
  return label ? el('div', 'ui-version', label) : null;
}

/** 타이틀. 버튼을 누르면 사라지고 선택을 resolve한다. 튜토리얼 버튼은 tutorialButton이 true일 때만 '시작' 아래에 둔다. */
export function showTitle(layer: HTMLElement, versionLabel?: string, opts?: { readonly tutorialButton?: boolean }): Promise<TitleChoice> {
  return new Promise((resolve) => {
    const o = overlay(layer, 'ui-title');
    const choose = (choice: TitleChoice) => (): void => {
      o.remove();
      resolve(choice);
    };
    const start = el('button', 'ui-big', titleText.start);
    start.addEventListener('click', choose('start'));
    o.append(el('h1', '', '타코야끼트럭'), start);
    if (opts?.tutorialButton) {
      const tutorial = el('button', 'ui-secondary', titleText.tutorial);
      tutorial.addEventListener('click', choose('tutorial'));
      o.append(tutorial);
    }
    const v = versionTag(versionLabel);
    if (v) o.append(v);
  });
}

/** 튜토리얼 완료 + 5★ 리뷰 카드. 확인을 누르면 닫힌다. */
export function showTutorialComplete(layer: HTMLElement, review: ReviewResult): void {
  const o = overlay(layer, 'ui-tutorial-done');
  const ok = el('button', 'ui-big', '확인');
  ok.addEventListener('click', () => o.remove());
  const card = el('div', 'ui-card');
  card.append(starCorner(review.stars), el('p', '', review.comment));
  o.append(el('h2', '', '튜토리얼 완료!'), card, ok);
}

/** 손님 리뷰 카드. 잠시 뒤 사라진다. */
export function showReviewCard(layer: HTMLElement, review: ReviewResult): void {
  // 입력을 막지 않도록 ui-hit를 쓰지 않는다. 카드는 컨테이너에 쌓여 겹치지 않는다.
  let toasts = layer.querySelector<HTMLElement>('.ui-toasts');
  if (!toasts) layer.append((toasts = el('div', 'ui-toasts')));
  const card = el('div', 'ui-card');
  const who = review.personality ? `${PERSONALITY_LABEL[review.personality]} ` : '';
  card.append(starCorner(review.stars), el('div', 'ui-stars', who.trim()), el('p', '', review.comment));
  toasts.append(card);
  setTimeout(() => card.remove(), TOAST_MS);
}

/** 결과 화면. average는 GameState.sessionAverage(core 계산)이고 null이면 점수를 표시하지 않는다. */
export function showResult(
  layer: HTMLElement,
  result: { readonly average: number | null; readonly reviews: readonly ReviewResult[]; readonly shopScore?: number; readonly newBest?: boolean; readonly gameOver?: boolean },
  versionLabel?: string,
): Promise<'again'> {
  const o = overlay(layer, 'ui-result');
  o.append(el('h2', '', result.gameOver ? hudText.gameOverTitle : hudText.resultTitle));
  if (result.shopScore !== undefined) o.append(el('div', 'ui-shop-score', hudText.resultShopScore(result.shopScore)));
  if (result.newBest) o.append(el('div', 'ui-new-best', hudText.resultNewBest));
  const text = sessionAverageText(result.average);
  if (result.average !== null && text !== null) o.append(el('div', 'ui-score', `${text}점`), starRow(result.average, `평균 ${starsLabel(result.average)}`));
  o.append(el('p', '', `받은 리뷰 ${result.reviews.length}개`));
  const again = el('button', 'ui-big', titleText.replay);
  const v = versionTag(versionLabel);
  o.append(again);
  if (v) o.append(v);
  return new Promise((resolve) => {
    again.addEventListener('click', () => {
      o.remove();
      resolve('again');
    });
  });
}
