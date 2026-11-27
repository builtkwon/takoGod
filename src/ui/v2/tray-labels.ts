import type { GameStateV2, IngredientId, ScenePicker } from '../../contracts';
import { el } from '../dom';
import { INGREDIENT_LABEL } from '../format';
import type { Pt } from './controller';

export interface TrayLabel {
  readonly text: string;
  readonly at: Pt;
}

/** 칸 중심 아래로 내리는 거리(CSS px). 칸 간격이 좁아 홀수 칸은 STAGGER_Y만큼 더 내려 겹치지 않게 한다. */
export const LABEL_OFFSET_Y = 30;
const STAGGER_Y = 14;
/** 칸(캔버스) 폭이 이보다 좁으면 이름표 글자를 줄이고 위아래 간격을 벌려 이웃 이름표가 겹치지 않게 한다. */
export const NARROW_COL = 360;

export interface LabelStyle {
  readonly fontPx: number;
  readonly staggerY: number;
}

export const labelStyle = (colW: number): LabelStyle => (colW < NARROW_COL ? { fontPx: 10, staggerY: 18 } : { fontPx: 11, staggerY: STAGGER_Y });

/** 이름표 크기 근사(CSS .ui-tray-label: 좌우 padding 6px, line-height 글자+3). 한글 한 글자 ≈ 글자 크기. */
export function labelBox(text: string, s: LabelStyle): { readonly w: number; readonly h: number } {
  return { w: [...text].length * s.fontPx + 12, h: s.fontPx + 3 };
}

/** 칸마다 이름표 계획. 재료가 없거나 앵커가 없으면 null. */
export function trayLabelPlan(tray: GameStateV2['tray'], picker: Pick<ScenePicker, 'anchor'>, colW = Infinity): (TrayLabel | null)[] {
  const { staggerY } = labelStyle(colW);
  return tray.map((ing, slot) => {
    const p = picker.anchor({ kind: 'tray', slot });
    return p ? { text: INGREDIENT_LABEL[ing.id], at: { x: p.x, y: p.y + LABEL_OFFSET_Y + (slot % 2) * staggerY } } : null;
  });
}

/** 속재료 트레이 칸 아래 이름표. 매 프레임 앵커를 다시 읽으므로 서빙 때 섞여도, 화면 크기가 바뀌어도 따라간다. */
export function createTrayLabels(layer: HTMLElement, picker: ScenePicker, colW: () => number = () => window.innerWidth): { update(state: GameStateV2, selected?: IngredientId | null): void } {
  const nodes: HTMLElement[] = [];
  const ring = el('div', 'ui-tray-ring'); // 탭으로 고른 칸 테두리 강조
  ring.hidden = true;
  layer.append(ring);
  return {
    update(state, selected = null) {
      const sel = selected === null ? -1 : state.tray.findIndex((x) => x.id === selected);
      const selAt = sel < 0 ? null : picker.anchor({ kind: 'tray', slot: sel });
      ring.hidden = selAt === null;
      if (selAt) ring.style.transform = `translate(${selAt.x}px, ${selAt.y}px) translate(-50%, -50%)`;
      const w = colW();
      const fontPx = labelStyle(w).fontPx;
      const plan = trayLabelPlan(state.tray, picker, w);
      while (nodes.length < plan.length) {
        const n = el('div', 'ui-tray-label');
        n.hidden = true;
        layer.append(n);
        nodes.push(n);
      }
      nodes.forEach((n, i) => {
        const l = plan[i] ?? null;
        n.hidden = l === null;
        n.classList.toggle('ui-tray-label-selected', i === sel);
        if (!l) return;
        if (n.textContent !== l.text) n.textContent = l.text;
        n.style.fontSize = `${fontPx}px`;
        n.style.lineHeight = `${fontPx + 3}px`;
        n.style.transform = `translate(${l.at.x}px, ${l.at.y}px) translate(-50%, -50%)`;
      });
    },
  };
}
