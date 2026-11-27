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
const GAUGE_W = 60;
const GAUGE_ROW_H = 14;

/** 줄 하나의 대략 폭(아이콘 + 글자). 글자 폭은 한글 기준으로 넉넉히 잡는다. */
const rowW = (i: BadgeItem): number => ('ingredient' in i ? ICON_W : 22) + i.text.length * (FONT_PX - 1) + 2 * PAD;

/**
 * 라벨 영역(viewport 좌표). 손님 머리 위(anchor) 바로 위에 두되, 상단 HUD·바 묶음(minTop 아래)을 넘지 않는다:
 * 머리가 HUD 뒤에 가려지는 위치(anchor가 minTop보다 위)면 묶음 바로 아래에 붙는다. 좌우는 화면 안으로 가둔다.
 */
export function badgeRect(at: { readonly x: number; readonly y: number }, items: readonly BadgeItem[], minTop: number, viewportW: number): Rect {
  const w = Math.min(viewportW - 8, naturalSize(items).w);
  const h = naturalSize(items).h;
  return { x: Math.min(viewportW - w - 4, Math.max(4, at.x - w / 2)), y: Math.max(at.y - h - 4, minTop + 4), w, h };
}

/** 줄임 없는 라벨 묶음 크기: 라벨 줄들 + 맨 아래 분노 게이지 줄. */
const naturalSize = (items: readonly BadgeItem[]): { readonly w: number; readonly h: number } => ({
  w: Math.max(GAUGE_W + 2 * PAD, ...items.map(rowW)),
  h: items.length * ROW_H + GAUGE_ROW_H + PAD,
});

/** 손님이 많을수록 라벨을 줄이는 하한(글자 15px → 약 7.5px). 이보다 작아지면 읽을 수 없어 넘치는 쪽은 그대로 둔다. */
export const MIN_BADGE_SCALE = 0.5;

export interface BadgeEntry {
  readonly id: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly items: readonly BadgeItem[];
}

export interface BadgePlacement extends Rect {
  readonly id: string;
  /** 줄임 배율(1이면 원래 크기). 요소는 naturalW 폭으로 만들고 이 배율로 줄인다. */
  readonly scale: number;
  readonly naturalW: number;
}

/**
 * 손님 여러 명의 머리 위 라벨 배치(칸 [left,right], viewport 좌표). 한 명이면 badgeRect와 같다.
 * 둘 이상이면 칸 폭을 사람 수로 나눈 폭에 맞춰 줄이고(MIN_BADGE_SCALE까지) 좌우로 밀어 서로 겹치지 않게 하며 칸 안으로 가둔다.
 */
export function layoutBadges(entries: readonly BadgeEntry[], minTop: number, left: number, right: number): BadgePlacement[] {
  const n = entries.length;
  const cap = n > 1 ? Math.floor((right - left - 8) / n) - 2 : right - left - 8;
  const out = entries.map((e) => {
    const nat = naturalSize(e.items);
    const scale = Math.min(1, Math.max(MIN_BADGE_SCALE, cap / nat.w));
    const w = Math.min(nat.w * scale, right - left - 8);
    const h = nat.h * scale;
    return { id: e.id, x: Math.min(right - w - 4, Math.max(left + 4, e.at.x - w / 2)), y: Math.max(e.at.y - h - 4, minTop + 4), w, h, scale, naturalW: nat.w };
  });
  const order = out.map((_, i) => i).sort((a, b) => out[a]!.x - out[b]!.x);
  const xs = out.map((o) => o.x);
  for (let k = 1; k < order.length; k++) xs[order[k]!] = Math.max(xs[order[k]!]!, xs[order[k - 1]!]! + out[order[k - 1]!]!.w + 2);
  const last = order.at(-1);
  if (last !== undefined) xs[last] = Math.min(xs[last]!, right - 4 - out[last]!.w);
  for (let k = order.length - 2; k >= 0; k--) xs[order[k]!] = Math.min(xs[order[k]!]!, xs[order[k + 1]!]! - 2 - out[order[k]!]!.w);
  return out.map((o, i) => ({ ...o, x: Math.max(left + 4, xs[i]!) }));
}

export type GaugeTone = 'normal' | 'annoyed' | 'angry';

export interface GaugeView {
  /** 남은 인내 0..100(%). patience는 경과 비율이라 1 - patience다. */
  readonly fillPct: number;
  /** 얼굴 단계와 같은 색(normal 초록, annoyed 주황, angry 빨강). */
  readonly tone: GaugeTone;
  /** 인내 100%(화남): 빨간 빈 막대 + 😠. */
  readonly angered: boolean;
}

/** 분노 게이지 표시값. 값은 core가 정한 CustomerStatus를 그대로 읽는다. */
export function gaugeView(c: Pick<CustomerStatus, 'patience' | 'face'>): GaugeView {
  const p = Number.isFinite(c.patience) ? Math.min(1, Math.max(0, c.patience)) : 0;
  const angered = p >= 1;
  return { fillPct: angered ? 0 : (1 - p) * 100, tone: angered ? 'angry' : c.face, angered };
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
export function createCustomerBadges(layer: HTMLElement, picker: ScenePicker, viewportW: () => number = () => window.innerWidth, colLeft: () => number = () => 0): CustomerBadges {
  interface Node {
    readonly root: HTMLElement;
    readonly rows: HTMLElement;
    readonly fill: HTMLElement;
    readonly emoji: HTMLElement;
    key: string;
    rect: Rect | null;
  }
  const nodes = new Map<string, Node>();
  const drop = (id: string): void => {
    nodes.get(id)?.root.remove();
    nodes.delete(id);
  };
  const create = (): Node => {
    const root = el('div', 'ui-badges');
    const rows = el('div', 'ui-badge-rows');
    const track = el('div', 'ui-gauge');
    const fill = el('div', 'ui-gauge-fill ui-gauge-normal');
    const emoji = el('span', 'ui-gauge-emoji', '😠');
    emoji.hidden = true;
    track.append(fill);
    const gaugeRow = el('div', 'ui-gauge-row');
    gaugeRow.append(track, emoji);
    root.append(rows, gaugeRow);
    layer.append(root);
    return { root, rows, fill, emoji, key: '', rect: null };
  };
  return {
    update(state, minTop = 0) {
      const alive = new Set(state.customers.map((c) => c.id));
      for (const id of [...nodes.keys()]) if (!alive.has(id)) drop(id);
      const seen: { c: (typeof state.customers)[number]; items: BadgeItem[]; at: { x: number; y: number } }[] = [];
      for (const c of state.customers) {
        const at = picker.anchor({ kind: 'customer', customerId: c.id });
        if (at === null) {
          drop(c.id);
          continue;
        }
        seen.push({ c, items: badgeItems(c), at });
      }
      // 자리가 여럿이면 손님끼리 라벨이 겹치지 않게 한꺼번에 배치한다.
      const place = layoutBadges(seen.map((s) => ({ id: s.c.id, at: s.at, items: s.items })), minTop, colLeft(), viewportW());
      seen.forEach(({ c, items }, i) => {
        let n = nodes.get(c.id);
        if (!n) {
          n = create();
          nodes.set(c.id, n);
        }
        const key = items.map((it) => `${it.kind}:${it.text}`).join('|');
        if (n.key !== key) {
          n.key = key;
          n.rows.replaceChildren(...items.map(rowEl));
        }
        const g = gaugeView(c);
        n.fill.style.width = `${g.fillPct}%`;
        n.fill.className = `ui-gauge-fill ui-gauge-${g.tone}`;
        n.emoji.hidden = !g.angered;
        const r = place[i]!;
        n.rect = r;
        n.root.style.transformOrigin = '0 0';
        n.root.style.transform = `translate(${r.x}px, ${r.y}px) scale(${r.scale})`;
        n.root.style.width = `${r.naturalW}px`;
      });
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
