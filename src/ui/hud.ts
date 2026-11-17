import type { GameState } from '../contracts';
import { el, type UiContext } from './dom';
import { PERSONALITY_LABEL, phaseLabel } from './format';
import { toolForStep } from './tools';

export interface Hud {
  readonly root: HTMLElement;
  update(state: GameState): void;
}

export function createHud(ctx: UiContext): Hud {
  const root = el('div', 'ui-hud ui-hit');
  const phase = el('span', 'ui-phase');
  const reviews = el('span', 'ui-reviews');
  const top = el('div', 'ui-hud-row');
  top.append(phase, reviews);
  const customers = el('div', 'ui-customers');
  const gaugeLabel = el('span', 'ui-gauge-label');
  const gaugeFill = el('div', 'ui-gauge-fill');
  const gauge = el('div', 'ui-gauge');
  gauge.append(gaugeFill);
  const gaugeRow = el('div', 'ui-hud-row');
  gaugeRow.append(gaugeLabel, gauge);
  root.append(top, customers, gaugeRow);

  return {
    root,
    update(state) {
      phase.textContent = phaseLabel(state.phase);
      reviews.textContent = `리뷰 ${state.reviews.length}`;
      customers.textContent = state.customers.map((c) => `${PERSONALITY_LABEL[c.personality]} 만족도 ${c.satisfaction}`).join(' · ');
      const hole = state.holes[ctx.selected.hole];
      gaugeLabel.textContent = hole ? `${ctx.selected.hole + 1}번 ${toolForStep(hole.step)?.label ?? ''}` : '';
      gaugeFill.style.width = `${Math.round((hole?.gauge ?? 0) * 100)}%`;
    },
  };
}
