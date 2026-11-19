import type { EventBus, GameStateV2 } from '../contracts';
import { el } from './dom';
import { PERSONALITY_LABEL } from './format';
import { placeAnswerButtons, type Rect } from './layout';

const BTN = { w: 150, h: 52 };
const BUBBLE_TOP = 120;
const BUBBLE_STEP = 84; // 말풍선 높이(CSS 76px) + 간격

interface Shown {
  readonly slot: number;
  readonly bubble: HTMLElement;
  readonly timer: HTMLElement;
  readonly buttons: readonly HTMLElement[];
}

export interface Dialogues {
  update(state: Pick<GameStateV2, 'activeDialogues'>): void;
}

/** 말풍선과 랜덤 배치 답 버튼. 답 버튼은 fixed 요소와 obstacles(layer 기준 좌표, 장면의 구멍·트레이·후네 등)와 겹치지 않는다. */
export function createDialogues(
  ctx: { readonly layer: HTMLElement; readonly bus: EventBus; readonly disposers: (() => void)[] },
  fixed: readonly HTMLElement[],
  obstacles: () => readonly Rect[],
  rng: () => number = Math.random,
): Dialogues {
  const shown = new Map<string, Shown>();

  const rectOf = (e: HTMLElement): Rect => {
    const r = e.getBoundingClientRect();
    const base = ctx.layer.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  };

  const remove = (customerId: string): void => {
    const s = shown.get(customerId);
    if (!s) return;
    s.bubble.remove();
    s.buttons.forEach((b) => b.remove());
    shown.delete(customerId);
  };

  ctx.disposers.push(
    ctx.bus.on('dialogue/started', ({ customerId, line }) => {
      remove(customerId);
      const bubble = el('div', 'ui-bubble ui-hit');
      const used = new Set([...shown.values()].map((x) => x.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      bubble.style.top = `${BUBBLE_TOP + slot * BUBBLE_STEP}px`;
      const timer = el('span', 'ui-timer');
      bubble.append(el('b', '', PERSONALITY_LABEL[line.personality]), el('p', '', line.prompt), timer);
      ctx.layer.append(bubble);

      const blocked = [...[...fixed, bubble, ...[...shown.values()].flatMap((s) => [s.bubble, ...s.buttons])].map(rectOf), ...obstacles()];
      const base = ctx.layer.getBoundingClientRect();
      const spots = placeAnswerButtons({ w: base.width, h: base.height }, BTN, blocked, rng);
      // 좋은 답과 나쁜 답이 어느 자리에 가는지도 섞는다.
      const answers = rng() < 0.5 ? (['good', 'bad'] as const) : (['bad', 'good'] as const);
      const buttons = answers.map((choice, i) => {
        const b = el('button', 'ui-answer ui-hit', line[choice]);
        const spot = spots[i];
        if (spot) Object.assign(b.style, { left: `${spot.x}px`, top: `${spot.y}px`, width: `${BTN.w}px`, height: `${BTN.h}px` });
        b.addEventListener('click', () => {
          buttons.forEach((x) => (x.disabled = true));
          ctx.bus.emit('input/answer', { customerId, choice });
        });
        ctx.layer.append(b);
        return b;
      });
      shown.set(customerId, { slot, bubble, timer, buttons });
    }),
    ctx.bus.on('dialogue/resolved', ({ customerId }) => remove(customerId)),
    ctx.bus.on('customer/left', ({ customerId }) => remove(customerId)),
  );

  return {
    update(state) {
      for (const d of state.activeDialogues) {
        const s = shown.get(d.customerId);
        if (s) s.timer.textContent = `${Math.ceil(d.remainingSec)}초`;
      }
    },
  };
}
