import type { CustomerStatus, GameStateV2, IngredientId, ScenePicker } from '../../contracts';
import { el } from '../dom';
import type { Rect } from '../layout';
import { iconSvg } from './icons';

export type BadgeItem =
  /** 주문 "재료 아이콘 x N". count 6은 '모두'. */
  | { readonly kind: 'order'; readonly ingredient: IngredientId; readonly text: string; readonly aria: string }
  /** 빼 주세요: 재료 아이콘 + 금지 표시. */
  | { readonly kind: 'avoid'; readonly ingredient: IngredientId; readonly aria: string }
  /** 단체: "x2", 하나 받았으면 "1/2". */
  | { readonly kind: 'group'; readonly text: string; readonly aria: string }
  | { readonly kind: 'vip'; readonly aria: string };

type BadgeSource = Pick<CustomerStatus, 'order' | 'avoid' | 'group' | 'vip'>;

/** 손님 머리 위에 보일 아이콘 목록. 없으면 빈 배열(표시 없음). 판정은 core가 하고 여기서는 보여 주기만 한다. */
export function badgeItems(c: BadgeSource): BadgeItem[] {
  const items: BadgeItem[] = [];
  if (c.order) {
    const text = c.order.count === 6 ? '모두' : `×${c.order.count}`;
    items.push({ kind: 'order', ingredient: c.order.ingredient, text, aria: `주문 ${text}` });
  }
  if (c.avoid) items.push({ kind: 'avoid', ingredient: c.avoid, aria: '빼 주세요' });
  if (c.group) {
    const { platesNeeded, platesReceived } = c.group;
    const text = platesReceived > 0 ? `${platesReceived}/${platesNeeded}` : `×${platesNeeded}`;
    items.push({ kind: 'group', text, aria: `단체 ${platesReceived}/${platesNeeded}` });
  }
  if (c.vip) items.push({ kind: 'vip', aria: 'VIP' });
  return items;
}

const ITEM_W = 34;
const BADGE_H = 30;

/** 아이콘 묶음이 머리 위(anchor 바로 위)에 차지하는 영역(viewport 좌표). */
export function badgeRect(at: { readonly x: number; readonly y: number }, count: number): Rect {
  const w = count * ITEM_W + 8;
  return { x: at.x - w / 2, y: at.y - BADGE_H - 4, w, h: BADGE_H };
}

function itemEl(item: BadgeItem): HTMLElement {
  const e = el('span', `ui-badge ui-badge-${item.kind}`);
  e.setAttribute('aria-label', item.aria);
  if (item.kind === 'order' || item.kind === 'avoid') {
    const ico = el('span', 'ui-badge-ico');
    ico.innerHTML = iconSvg({ kind: 'filling', ingredient: item.ingredient }); // 고정 문자열만 조립
    e.append(ico);
    if (item.kind === 'avoid') e.append(el('span', 'ui-badge-ban', '🚫'));
    else e.append(el('span', 'ui-badge-n', item.text));
  } else if (item.kind === 'group') e.append(el('span', 'ui-badge-n', item.text));
  else e.append(el('span', 'ui-badge-crown', '👑'));
  return e;
}

export interface CustomerBadges {
  update(state: Pick<GameStateV2, 'customers'>): void;
  /** 지금 보이는 아이콘 묶음 영역(layer 좌표). 말풍선이 가리지 않게 장애물로 쓴다. */
  rects(): readonly Rect[];
  /** 판이 바뀔 때 모두 지운다. */
  reset(): void;
}

/** 손님 머리 위 DOM 아이콘. 매 프레임 anchor({kind:'customer'})를 다시 읽어 따라가고, 손님이 없거나 anchor가 null이면 숨긴다. */
export function createCustomerBadges(layer: HTMLElement, picker: ScenePicker): CustomerBadges {
  const nodes = new Map<string, { readonly root: HTMLElement; key: string; count: number; at: { x: number; y: number } | null }>();
  const drop = (id: string): void => {
    nodes.get(id)?.root.remove();
    nodes.delete(id);
  };
  return {
    update(state) {
      const alive = new Set(state.customers.map((c) => c.id));
      for (const id of [...nodes.keys()]) if (!alive.has(id)) drop(id);
      for (const c of state.customers) {
        const items = badgeItems(c);
        const at = items.length > 0 ? picker.anchor({ kind: 'customer', customerId: c.id }) : null;
        if (at === null) {
          drop(c.id);
          continue;
        }
        let n = nodes.get(c.id);
        const key = items.map((i) => `${i.kind}:${'text' in i ? i.text : ''}:${'ingredient' in i ? i.ingredient : ''}`).join('|');
        if (!n) {
          n = { root: el('div', 'ui-badges'), key: '', count: 0, at: null };
          layer.append(n.root);
          nodes.set(c.id, n);
        }
        if (n.key !== key) {
          n.key = key;
          n.count = items.length;
          n.root.replaceChildren(...items.map(itemEl));
        }
        n.at = at;
        n.root.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
      }
    },
    rects() {
      const base = layer.getBoundingClientRect();
      return [...nodes.values()].flatMap((n) => {
        if (!n.at) return [];
        const r = badgeRect(n.at, n.count);
        return [{ x: r.x - base.left, y: r.y - base.top, w: r.w, h: r.h }];
      });
    },
    reset() {
      [...nodes.keys()].forEach(drop);
    },
  };
}
