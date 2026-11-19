import type { GameStateV2, ScenePicker } from '../../contracts';
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

/** 칸마다 이름표 계획. 재료가 없거나 앵커가 없으면 null. */
export function trayLabelPlan(tray: GameStateV2['tray'], picker: Pick<ScenePicker, 'anchor'>): (TrayLabel | null)[] {
  return tray.map((ing, slot) => {
    const p = picker.anchor({ kind: 'tray', slot });
    return p ? { text: INGREDIENT_LABEL[ing.id], at: { x: p.x, y: p.y + LABEL_OFFSET_Y + (slot % 2) * STAGGER_Y } } : null;
  });
}

/** 속재료 트레이 칸 아래 이름표. 매 프레임 앵커를 다시 읽으므로 서빙 때 섞여도, 화면 크기가 바뀌어도 따라간다. */
export function createTrayLabels(layer: HTMLElement, picker: ScenePicker): { update(state: GameStateV2): void } {
  const nodes: HTMLElement[] = [];
  return {
    update(state) {
      const plan = trayLabelPlan(state.tray, picker);
      while (nodes.length < plan.length) {
        const n = el('div', 'ui-tray-label');
        n.hidden = true;
        layer.append(n);
        nodes.push(n);
      }
      nodes.forEach((n, i) => {
        const l = plan[i] ?? null;
        n.hidden = l === null;
        if (!l) return;
        if (n.textContent !== l.text) n.textContent = l.text;
        n.style.transform = `translate(${l.at.x}px, ${l.at.y}px) translate(-50%, -50%)`;
      });
    },
  };
}
