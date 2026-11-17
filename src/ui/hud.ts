import type { GameState } from '../contracts';
import { el, type UiContext } from './dom';
import { PERSONALITY_LABEL, phaseLabel, sessionAverageText } from './format';
import { gaugeBands, judgedText, markerPercent, type Band } from './gauge';
import { toolForStep } from './tools';

export interface Hud {
  readonly root: HTMLElement;
  update(state: GameState): void;
}

const JUDGED_MS = 1500;

export function createHud(ctx: UiContext): Hud {
  const root = el('div', 'ui-hud ui-hit');
  const phase = el('span', 'ui-phase');
  const average = el('span', 'ui-average');
  const reviews = el('span', 'ui-reviews');
  const top = el('div', 'ui-hud-row');
  top.append(phase, average, reviews);
  const customers = el('div', 'ui-customers');
  const gaugeLabel = el('span', 'ui-gauge-label');
  const marker = el('div', 'ui-marker');
  const gauge = el('div', 'ui-gauge');
  const judged = el('span', 'ui-judged');
  const gaugeRow = el('div', 'ui-hud-row');
  gaugeRow.append(gaugeLabel, gauge, judged);
  root.append(top, customers, gaugeRow);

  let shown: readonly Band[] | null = null;
  const showBands = (bands: readonly Band[] | null): void => {
    if (bands === shown) return;
    shown = bands;
    gauge.replaceChildren(
      ...(bands ?? []).map((b) => {
        const seg = el('div', `ui-band z-${b.zone}`);
        seg.style.flex = String(b.to - b.from);
        return seg;
      }),
      marker,
    );
  };

  let judgedTimer: ReturnType<typeof setTimeout> | undefined;
  ctx.disposers.push(
    ctx.bus.on('cook/judged', ({ hole, step, doneness }) => {
      const text = judgedText(step, doneness);
      if (!text) return;
      judged.textContent = `${hole + 1}번 ${text}`;
      judged.className = `ui-judged ${doneness === 'perfect' ? 'good' : 'bad'}`;
      clearTimeout(judgedTimer);
      judgedTimer = setTimeout(() => (judged.textContent = ''), JUDGED_MS);
    }),
    () => clearTimeout(judgedTimer),
  );

  return {
    root,
    update(state) {
      phase.textContent = phaseLabel(state.phase);
      const avg = sessionAverageText(state.sessionAverage);
      average.textContent = avg === null ? '' : `평균 ${avg}`;
      reviews.textContent = `리뷰 ${state.reviews.length}`;
      customers.textContent = state.customers.map((c) => `${PERSONALITY_LABEL[c.personality]} 만족도 ${c.satisfaction}`).join(' · ');
      const hole = state.holes[ctx.selected.hole];
      gaugeLabel.textContent = hole ? `${ctx.selected.hole + 1}번 ${toolForStep(hole.step)?.label ?? ''}` : '';
      const bands = hole ? gaugeBands(hole.step, state.phase === 'tutorial') : null;
      showBands(bands);
      gauge.hidden = bands === null;
      marker.style.left = `${markerPercent(hole?.gauge ?? 0)}%`;
    },
  };
}
