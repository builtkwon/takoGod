// 서빙 직후 점수 공개: 맛보기 반응 말풍선 → 별점·합산 → (다시해줘·떠남) → 리뷰 카드. 순서는 직렬 대기열로 보장한다.
import type { EventBus, GameStateV2 } from '../../contracts';
import { el } from '../dom';
import { PERSONALITY_LABEL, starsText } from '../format';
import { showReviewCard, showTutorialComplete } from '../screens';
import { createSequencer, type Clock } from './sequencer';

const TASTE_MS = 1800;
const SCORE_MS = 1800;
const NOTICE_MS = 1400;

/** "+20", "-10", "0". */
export function deltaText(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function scoreText(delta: number, stars: number): string {
  return `만족도 ${deltaText(delta)} → ${starsText(stars)} (${stars.toFixed(1)})`;
}

export function bindReveal(layer: HTMLElement, bus: EventBus, getState: () => GameStateV2, clock?: Clock): () => void {
  const seq = createSequencer(clock);
  let card: HTMLElement | null = null;

  const who = (id: string): string => {
    const c = getState().customers.find((x) => x.id === id);
    return c ? PERSONALITY_LABEL[c.personality] : '손님';
  };
  const open = (name: string): HTMLElement => {
    card?.remove();
    card = el('div', 'ui-card ui-reveal');
    card.append(el('b', '', name));
    layer.append(card);
    return card;
  };
  const close = (): void => {
    card?.remove();
    card = null;
  };

  const offs = [
    bus.on('plate/tasted', ({ customerId, lines }) => {
      const name = who(customerId);
      seq.push(() => {
        const c = open(name);
        for (const l of lines) c.append(el('p', 'ui-taste', l.text));
      }, TASTE_MS);
    }),
    bus.on('plate/scored', ({ customerId, delta, stars }) => {
      const name = who(customerId);
      seq.push(() => {
        // 맛보기 말풍선이 열려 있으면 그 아래에 이어 붙인다.
        (card ?? open(name)).append(el('div', 'ui-stars', scoreText(delta, stars)));
        return close;
      }, SCORE_MS);
    }),
    bus.on('customer/redo-requested', ({ customerId }) => {
      const name = who(customerId);
      seq.push(() => {
        open(name).append(el('p', 'ui-taste', '다시 해줘요!'));
        return close;
      }, NOTICE_MS);
    }),
    bus.on('customer/walked-out', ({ customerId, stars }) => {
      const name = who(customerId);
      seq.push(() => {
        open(name).append(el('p', 'ui-taste', '안 먹어! 갈래요!'), el('div', 'ui-stars', starsText(stars)));
        return close;
      }, NOTICE_MS);
    }),
    bus.on('review/issued', ({ review }) =>
      seq.push(() => (review.source === 'tutorial' ? showTutorialComplete(layer, review) : showReviewCard(layer, review)), 0),
    ),
  ];
  return () => {
    offs.forEach((off) => off());
    seq.clear();
    close();
  };
}

