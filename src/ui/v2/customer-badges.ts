import type { CustomerStatus, GameStateV2, IngredientId, ScenePicker } from '../../contracts';
import { hudText } from '../../data';
import { el } from '../dom';
import { INGREDIENT_LABEL } from '../format';
import type { Rect } from '../layout';
import { iconSvg } from './icons';

export type BadgeItem =
  /** 주문 "재료 아이콘 + 재료 이름 ×N"(6은 "모두 재료"). */
  | { readonly kind: 'order'; readonly ingredient: IngredientId; readonly text: string }
  /** 빼 주세요: 재료 아이콘 + 금지 표시 + "재료 빼기". */
  | { readonly kind: 'avoid'; readonly ingredient: IngredientId; readonly text: string }
  /** 단체: "접시 받은 수/필요한 수". */
  | { readonly kind: 'group'; readonly text: string }
  | { readonly kind: 'vip'; readonly text: string };

type BadgeSource = Pick<CustomerStatus, 'order' | 'avoid' | 'group' | 'vip'>;

/** 손님 머리 위 라벨 줄 목록. 없으면 빈 배열(표시 없음). 판정은 core가 하고 여기서는 보여 주기만 한다. */
export function badgeItems(c: BadgeSource): BadgeItem[] {
  const items: BadgeItem[] = [];
  if (c.order) items.push({ kind: 'order', ingredient: c.order.ingredient, text: hudText.orderLabel(INGREDIENT_LABEL[c.order.ingredient], c.order.count) });
  if (c.avoid) items.push({ kind: 'avoid', ingredient: c.avoid, text: hudText.avoidLabel(INGREDIENT_LABEL[c.avoid]) });
  if (c.group) items.push({ kind: 'group', text: hudText.groupLabel(c.group.platesReceived, c.group.platesNeeded) });
  if (c.vip) items.push({ kind: 'vip', text: hudText.vipLabel });
  return items;
}

const ROW_H = 26;
const PAD = 4;
const FONT_PX = 15;
const ICON_W = 26;

/** 줄 하나의 대략 폭(아이콘 + 글자). 글자 폭은 한글 기준으로 넉넉히 잡는다. */
const rowW = (i: BadgeItem): number => ('ingredient' in i ? ICON_W : 22) + i.text.length * (FONT_PX - 1) + 2 * PAD;

/**
 * 라벨 영역(viewport 좌표). 손님 머리 위(anchor) 바로 위에 두되, 상단 HUD·바 묶음(minTop 아래)을 넘지 않는다:
 * 머리가 HUD 뒤에 가려지는 위치(anchor가 minTop보다 위)면 묶음 바로 아래에 붙는다. 좌우는 화면 안으로 가둔다.
 */
export function badgeRect(at: { readonly x: number; readonly y: number }, items: readonly BadgeItem[], minTop: number, viewportW: number): Rect {
  const w = Math.min(viewportW - 8, Math.max(0, ...items.map(rowW)));
  const h = items.length * ROW_H + PAD;
  return { x: Math.min(viewportW - w - 4, Math.max(4, at.x - w / 2)), y: Math.max(at.y - h - 4, minTop + 4), w, h };
}

function rowEl(item: BadgeItem): HTMLElement {
  const e = el('div', `ui-badge ui-badge-${item.kind}`);
  e.setAttribute('aria-label', item.text);
  if (item.kind === 'order' || item.kind === 'avoid') {
    const ico = el('span', 'ui-badge-ico');
    ico.innerHTML = iconSvg({ kind: 'filling', ingredient: item.ingredient }); // 고정 문자열만 조립
    if (item.kind === 'avoid') ico.append(el('span', 'ui-badge-ban', '🚫'));
    e.append(ico);
  } else if (item.kind === 'vip') e.append(el('span', 'ui-badge-crown', '👑'));
  e.append(el('span', 'ui-badge-text', item.text));
  return e;
}

export interface CustomerBadges {
  /** minTop은 상단 HUD+바 묶음의 아래쪽(viewport 좌표). 라벨은 그 아래에 놓는다. */
  update(state: Pick<GameStateV2, 'customers'>, minTop?: number): void;
  /** 지금 보이는 라벨 영역(layer 좌표). 말풍선이 가리지 않게 장애물로 쓴다. */
  rects(): readonly Rect[];
  /** 판이 바뀔 때 모두 지운다. */
  reset(): void;
}

/** 손님 머리 위 DOM 라벨. 매 프레임 anchor({kind:'customer'})를 다시 읽어 따라가고, 손님이 없거나 anchor가 null이면 숨긴다. */
export function createCustomerBadges(layer: HTMLElement, picker: ScenePicker, viewportW: () => number = () => window.innerWidth): CustomerBadges {
  const nodes = new Map<string, { readonly root: HTMLElement; key: string; rect: Rect | null }>();
  const drop = (id: string): void => {
    nodes.get(id)?.root.remove();
    nodes.delete(id);
  };
  return {
    update(state, minTop = 0) {
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
        if (!n) {
          n = { root: el('div', 'ui-badges'), key: '', rect: null };
          layer.append(n.root);
          nodes.set(c.id, n);
        }
        const key = items.map((i) => `${i.kind}:${i.text}`).join('|');
        if (n.key !== key) {
          n.key = key;
          n.root.replaceChildren(...items.map(rowEl));
        }
        const r = badgeRect(at, items, minTop, viewportW());
        n.rect = r;
        n.root.style.transform = `translate(${r.x}px, ${r.y}px)`;
        n.root.style.width = `${r.w}px`;
      }
    },
    rects() {
      const base = layer.getBoundingClientRect();
      return [...nodes.values()].flatMap((n) => (n.rect ? [{ x: n.rect.x - base.left, y: n.rect.y - base.top, w: n.rect.w, h: n.rect.h }] : []));
    },
    reset() {
      [...nodes.keys()].forEach(drop);
    },
  };
}
