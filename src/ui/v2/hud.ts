import type { GameStateV2 } from '../../contracts';
import { el } from '../dom';
import { PERSONALITY_LABEL, phaseLabel, sessionAverageText } from '../format';

export interface HudV2 {
  readonly root: HTMLElement;
  update(state: GameStateV2): void;
}

/** 단계·평균·리뷰 수·손님 얼굴. 진행 중인 만족도는 표시하지 않는다(GDD §손님 대화 점수 비공개). */
export function createHudV2(): HudV2 {
  const root = el('div', 'ui-hud2 ui-hit');
  const phase = el('span');
  const average = el('span');
  const reviews = el('span');
  const customers = el('div', 'ui-faces');
  const row = el('div', 'ui-hud-row');
  row.append(phase, average, reviews);
  root.append(row, customers);

  let facesKey = '';
  return {
    root,
    update(state) {
      phase.textContent = phaseLabel(state.phase);
      const avg = sessionAverageText(state.sessionAverage);
      average.textContent = avg === null ? '' : `평균 ${avg}`;
      reviews.textContent = `리뷰 ${state.reviews.length}`;
      const key = state.customers.map((c) => `${c.id}:${c.face}:${c.awaitingRedo}`).join();
      if (key === facesKey) return;
      facesKey = key;
      customers.replaceChildren(
        ...state.customers.map((c) => el('span', `ui-face ui-face-${c.face}`, `${PERSONALITY_LABEL[c.personality]}${c.awaitingRedo ? ' · 다시' : ''}`)),
      );
    },
  };
}
