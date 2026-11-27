import type { EventBus, GameStateV2, Personality } from '../contracts';
import { fumedLines } from '../data';
import { entryLines } from './entry-lines';
import { el } from './dom';
import { PERSONALITY_LABEL } from './format';
import { bubbleSpot, topStack, type Rect } from './layout';

const FUMED_MS = 1200;
const ENTRY_MS = 2600;

interface Shown {
  readonly slot: number;
  readonly bubble: HTMLElement;
  readonly timer: HTMLElement;
  /** 이 손님의 답 한 줄(이름 태그 + 버튼 둘). 화면 아래 고정 영역에 쌓인다. */
  readonly row: HTMLElement;
  readonly buttons: readonly HTMLElement[];
}

export interface Dialogues {
  update(state: Pick<GameStateV2, 'activeDialogues'>): void;
  /** 판이 끝나고 다시 시작할 때: 말풍선·답 버튼·분노 말풍선을 모두 지운다(이전 customerId로 input/answer가 새 판에 가지 않게). */
  reset(): void;
}

/**
 * 말풍선과 화면 아래 고정 답 버튼. 답 버튼은 접시 아래 고정 영역에 손님별로 한 줄씩(이름 태그 + 좋은 답·나쁜 답 나란히) 쌓는다.
 * 규칙: 먼저 시작한 대화가 위, 가장 최근 대화가 아래. 좋은 답·나쁜 답의 좌우 순서는 줄마다 섞는다.
 */
export function createDialogues(
  ctx: {
    readonly layer: HTMLElement;
    readonly bus: EventBus;
    readonly disposers: (() => void)[];
    /** 분노 대사를 고를 성격. 손님이 이미 없으면 undefined. */
    readonly personalityOf?: (customerId: string) => Personality | undefined;
    /** 속재료 트레이 칸(이름표 포함) 영역(layer 좌표). 말풍선은 이 영역을 가리지 않는다. */
    /** 상단 HUD+바 묶음의 아래쪽(layer 좌표). 말풍선은 그 아래부터 쌓는다. */
    readonly topBottom?: () => number;
    readonly trayObstacles?: () => readonly Rect[];
    /** 구이판(16구 전체) 영역(layer 좌표). 말풍선은 이 영역 가운데를 가리지 않는다. */
    readonly grillRect?: () => Rect | null;
  },
  rng: () => number = Math.random,
): Dialogues {
  const shown = new Map<string, Shown>();
  const answerBox = el('div', 'ui-answers');
  ctx.layer.append(answerBox);
  /** 말풍선 자리(폭 화면의 55%): HUD·라벨 아래 손님 영역을 우선하고 트레이·라벨·구이판은 피한다. */
  const place = (bubble: HTMLElement, slot: number): void => {
    const r = ctx.layer.getBoundingClientRect();
    const top = ctx.topBottom ? topStack(ctx.topBottom()).bubble : 120;
    // 화면 아래 고정 답 영역도 피한다(답이 떠 있을 때만).
    const ab = shown.size > 0 ? answerBox.getBoundingClientRect() : null;
    const answerRect = ab ? [{ x: ab.left - r.left, y: ab.top - r.top, w: ab.width, h: ab.height }] : [];
    const spot = bubbleSpot(slot, { w: r.width, h: r.height }, [...(ctx.trayObstacles?.() ?? []), ...answerRect], ctx.grillRect?.() ?? null, top);
    Object.assign(bubble.style, { top: `${spot.y}px`, left: `${spot.x}px`, width: `${spot.w}px`, right: 'auto' });
  };
  /** 분노 말풍선: 손님당 하나, 약 1.2초. 말풍선 자리(slot)를 다이얼로그와 나눠 쓴다. */
  const fumed = new Map<string, { readonly slot: number; readonly bubble: HTMLElement; readonly timer: ReturnType<typeof setTimeout> }>();
  const usedSlots = (): Set<number> => new Set([...shown.values(), ...fumed.values()].map((x) => x.slot));
  const removeFumed = (key: string): void => {
    const f = fumed.get(key);
    if (!f) return;
    clearTimeout(f.timer);
    f.bubble.remove();
    fumed.delete(key);
  };
  /** 짧게 떠 있는 말풍선(분노·입장 대사). key는 `${customerId}:종류`라서 같은 종류는 하나만 남는다. 답 버튼은 없다. */
  const say = (key: string, personality: Personality, text: string, cls: string, ms: number): void => {
    removeFumed(key);
    const used = usedSlots();
    let slot = 0;
    while (used.has(slot)) slot++;
    const bubble = el('div', `ui-bubble ${cls}`);
    place(bubble, slot);
    bubble.append(el('b', '', PERSONALITY_LABEL[personality]), el('p', '', text));
    ctx.layer.append(bubble);
    fumed.set(key, { slot, bubble, timer: setTimeout(() => removeFumed(key), ms) });
  };

  const remove = (customerId: string): void => {
    const s = shown.get(customerId);
    if (!s) return;
    s.bubble.remove();
    s.row.remove();
    shown.delete(customerId);
  };

  ctx.disposers.push(
    () => answerBox.remove(),
    ctx.bus.on('dialogue/started', ({ customerId, line }) => {
      remove(customerId);
      const bubble = el('div', 'ui-bubble ui-hit');
      const used = usedSlots();
      let slot = 0;
      while (used.has(slot)) slot++;
      place(bubble, slot);
      const timer = el('span', 'ui-timer');
      bubble.append(el('b', '', PERSONALITY_LABEL[line.personality]), el('p', '', line.prompt), timer);
      ctx.layer.append(bubble);

      // 좋은 답과 나쁜 답의 좌우 순서는 섞는다.
      const answers = rng() < 0.5 ? (['good', 'bad'] as const) : (['bad', 'good'] as const);
      const row = el('div', 'ui-answer-row');
      const buttons = answers.map((choice) => {
        const b = el('button', 'ui-answer ui-hit', line[choice]);
        b.addEventListener('click', () => {
          buttons.forEach((x) => (x.disabled = true));
          ctx.bus.emit('input/answer', { customerId, choice });
        });
        return b;
      });
      const pair = el('div', 'ui-answer-pair');
      pair.append(...buttons);
      row.append(el('span', 'ui-answer-tag', PERSONALITY_LABEL[line.personality]), pair);
      answerBox.append(row); // 가장 최근 대화가 아래
      shown.set(customerId, { slot, bubble, timer, row, buttons });
    }),
    ctx.bus.on('dialogue/resolved', ({ customerId }) => remove(customerId)),
    ctx.bus.on('customer/left', ({ customerId }) => {
      remove(customerId);
      [...fumed.keys()].filter((k) => k.startsWith(`${customerId}:`)).forEach(removeFumed);
    }),
    ctx.bus.on('customer/fumed', ({ customerId }) => {
      const personality = ctx.personalityOf?.(customerId);
      if (personality) say(`${customerId}:fumed`, personality, fumedLines[personality][rng() < 0.5 ? 0 : 1], 'ui-fumed', FUMED_MS);
    }),
    // 입장 때 주문·빼 주세요·단체·VIP 대사를 한 번씩 말풍선으로 보여 준다.
    ctx.bus.on('customer/entered', ({ customer }) =>
      entryLines(customer, rng).forEach((text, i) => say(`${customer.id}:entry:${i}`, customer.personality, text, 'ui-entry', ENTRY_MS)),
    ),
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
