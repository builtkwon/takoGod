import type { EventBus, GameStateV2, Personality } from '../contracts';
import { fumedLines } from '../data';
import { el } from './dom';
import { PERSONALITY_LABEL } from './format';
import { placeAnswerButtons, type Rect } from './layout';

const BTN = { w: 150, h: 52 };
const BUBBLE_TOP = 120;
const BUBBLE_STEP = 84; // 말풍선 높이(CSS 76px) + 간격
const FUMED_MS = 1200;

interface Shown {
  readonly slot: number;
  readonly bubble: HTMLElement;
  readonly timer: HTMLElement;
  readonly buttons: readonly HTMLElement[];
}

export interface Dialogues {
  update(state: Pick<GameStateV2, 'activeDialogues'>): void;
  /** 판이 끝나고 다시 시작할 때: 말풍선·답 버튼·분노 말풍선을 모두 지운다(이전 customerId로 input/answer가 새 판에 가지 않게). */
  reset(): void;
}

/** 말풍선과 랜덤 배치 답 버튼. 답 버튼은 fixed 요소와 obstacles(layer 기준 좌표, 장면의 구멍·트레이·후네 등)와 겹치지 않는다. */
export function createDialogues(
  ctx: {
    readonly layer: HTMLElement;
    readonly bus: EventBus;
    readonly disposers: (() => void)[];
    /** 분노 대사를 고를 성격. 손님이 이미 없으면 undefined. */
    readonly personalityOf?: (customerId: string) => Personality | undefined;
  },
  fixed: readonly HTMLElement[],
  obstacles: () => readonly Rect[],
  rng: () => number = Math.random,
): Dialogues {
  const shown = new Map<string, Shown>();
  /** 분노 말풍선: 손님당 하나, 약 1.2초. 말풍선 자리(slot)를 다이얼로그와 나눠 쓴다. */
  const fumed = new Map<string, { readonly slot: number; readonly bubble: HTMLElement; readonly timer: ReturnType<typeof setTimeout> }>();
  const usedSlots = (): Set<number> => new Set([...shown.values(), ...fumed.values()].map((x) => x.slot));
  const removeFumed = (customerId: string): void => {
    const f = fumed.get(customerId);
    if (!f) return;
    clearTimeout(f.timer);
    f.bubble.remove();
    fumed.delete(customerId);
  };

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
      const used = usedSlots();
      let slot = 0;
      while (used.has(slot)) slot++;
      bubble.style.top = `${BUBBLE_TOP + slot * BUBBLE_STEP}px`;
      const timer = el('span', 'ui-timer');
      bubble.append(el('b', '', PERSONALITY_LABEL[line.personality]), el('p', '', line.prompt), timer);
      ctx.layer.append(bubble);

      const blocked = [...[...fixed, bubble, ...[...fumed.values()].map((f) => f.bubble), ...[...shown.values()].flatMap((s) => [s.bubble, ...s.buttons])].map(rectOf), ...obstacles()];
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
    ctx.bus.on('customer/left', ({ customerId }) => {
      remove(customerId);
      removeFumed(customerId);
    }),
    ctx.bus.on('customer/fumed', ({ customerId }) => {
      const personality = ctx.personalityOf?.(customerId);
      if (!personality) return;
      removeFumed(customerId);
      const used = usedSlots();
      let slot = 0;
      while (used.has(slot)) slot++;
      const bubble = el('div', 'ui-bubble ui-fumed');
      bubble.style.top = `${BUBBLE_TOP + slot * BUBBLE_STEP}px`;
      const lines = fumedLines[personality];
      bubble.append(el('b', '', PERSONALITY_LABEL[personality]), el('p', '', lines[rng() < 0.5 ? 0 : 1]));
      ctx.layer.append(bubble);
      fumed.set(customerId, { slot, bubble, timer: setTimeout(() => removeFumed(customerId), FUMED_MS) });
    }),
    () => [...fumed.keys()].forEach(removeFumed),
  );

  return {
    reset() {
      [...shown.keys()].forEach(remove);
      [...fumed.keys()].forEach(removeFumed);
    },
    update(state) {
      for (const d of state.activeDialogues) {
        const s = shown.get(d.customerId);
        if (s) s.timer.textContent = `${Math.ceil(d.remainingSec)}초`;
      }
    },
  };
}
