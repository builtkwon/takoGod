// 서빙 직후 점수 공개: 맛보기 반응 말풍선 → 별점·합산 → (다시해줘·떠남) → 리뷰 카드. 순서는 직렬 대기열로 보장한다.
import type { EventBus, GameStateV2 } from '../../contracts';
import { el } from '../dom';
import { allergyText, orderResultLines, reportCard, rushText } from '../../data';
import { INGREDIENT_LABEL, PERSONALITY_LABEL } from '../format';
import { showReviewCard, showTutorialComplete } from '../screens';
import { starRow, starsLabel } from './stars';
import { createSequencer, type Clock } from './sequencer';

const TASTE_MS = 1800;
const SCORE_MS = 1800;
const NOTICE_MS = 1400;

/** "+20", "-10", "0". */
export function deltaText(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function scoreText(delta: number): string {
  return `만족도 ${deltaText(delta)}`;
}

/** 카드 우상단 별 칸. */
const cardStars = (stars: number): HTMLElement => {
  const e = el('div', 'ui-card-stars');
  e.append(starRow(stars, starsLabel(stars)));
  return e;
};

/** dispose는 구독 해제, reset은 판이 바뀔 때 대기 중·표시 중인 점수 공개 연출을 비운다. */
export function bindReveal(layer: HTMLElement, bus: EventBus, getState: () => GameStateV2, clock?: Clock, rng: () => number = Math.random): { readonly dispose: () => void; readonly reset: () => void } {
  const seq = createSequencer(clock);
  let card: HTMLElement | null = null;

  const who = (id: string): string => {
    const c = getState().customers.find((x) => x.id === id);
    return c ? PERSONALITY_LABEL[c.personality] : '손님';
  };
  const open = (name: string, cls = ''): HTMLElement => {
    card?.remove();
    card = el('div', `ui-card ui-reveal ${cls}`.trim());
    card.append(el('b', '', name));
    layer.append(card);
    return card;
  };
  const close = (): void => {
    card?.remove();
    card = null;
  };

  const pickOf = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))] as T;
  const offs = [
    // 주문 결과 반응: 성공·실패 × 성격별 2개 중 하나(맛보기 반응 뒤, 별점 앞).
    bus.on('order/resolved', ({ customerId, success }) => {
      const c = getState().customers.find((x) => x.id === customerId);
      if (!c) return;
      const name = PERSONALITY_LABEL[c.personality];
      const text = pickOf(orderResultLines[success ? 'success' : 'fail'][c.personality]);
      seq.push(() => {
        open(name, success ? 'ui-order-ok' : 'ui-order-fail').append(el('p', 'ui-taste', text));
        return close;
      }, NOTICE_MS);
    }),
    // 빼 주세요 위반: 강한 분노 카드(이어서 customer/fumed 말풍선과 render 흔들림이 나온다).
    bus.on('customer/allergy', ({ customerId, ingredient }) => {
      const c = getState().customers.find((x) => x.id === customerId);
      const name = c ? PERSONALITY_LABEL[c.personality] : '손님';
      seq.push(() => {
        open(`${name} · ${allergyText.title}`, 'ui-allergy').append(el('p', 'ui-taste', allergyText.line(INGREDIENT_LABEL[ingredient])));
        return close;
      }, NOTICE_MS);
    }),
    // 식품 신고 카드: 별점 앞의 같은 대기열로 순서를 지킨다.
    bus.on('plate/reported', () => {
      seq.push(() => {
        open(reportCard.title, 'ui-report').append(el('p', 'ui-taste', pickOf(reportCard.lines)));
        return close;
      }, SCORE_MS);
    }),
    // 러시 아워 시작 안내(상단 배지는 HUD가 state.rush로 그린다).
    bus.on('rush/started', () => {
      seq.push(() => {
        open(rushText.banner, 'ui-rush-notice').append(el('p', 'ui-taste', pickOf(rushText.notices)));
        return close;
      }, NOTICE_MS);
    }),
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
        (card ?? open(name)).append(el('div', 'ui-stars', scoreText(delta)), cardStars(stars));
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
        open(name).append(el('p', 'ui-taste', '안 먹어! 갈래요!'), cardStars(stars));
        return close;
      }, NOTICE_MS);
    }),
    bus.on('review/issued', ({ review }) =>
      seq.push(() => (review.source === 'tutorial' ? showTutorialComplete(layer, review) : showReviewCard(layer, review)), 0),
    ),
  ];
  const reset = (): void => {
    seq.clear();
    close();
  };
  return {
    dispose: () => {
      offs.forEach((off) => off());
      reset();
    },
    reset,
  };
}

