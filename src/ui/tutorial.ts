import type { GameState } from '../contracts';
import { tutorialSteps } from '../data';
import { el, type UiContext } from './dom';
import type { Toolbar } from './toolbar';

export interface TutorialView {
  update(state: GameState): void;
}

const WARNING_MS = 2000;

/** 상단 안내문구, 도구바 화살표, 순서 외 탭 흔들림, 함정 재료 경고 말풍선. */
export function createTutorial(ctx: UiContext, toolbar: Toolbar): TutorialView {
  const guide = el('div', 'ui-guide ui-hit');
  const warning = el('div', 'ui-warning ui-hit');
  guide.hidden = true;
  warning.hidden = true;
  ctx.layer.append(guide, warning);

  let warningTimer: ReturnType<typeof setTimeout> | undefined;
  ctx.disposers.push(
    ctx.bus.on('tutorial/invalid-tap', () => toolbar.shake()),
    ctx.bus.on('tutorial/trap-warning', () => {
      warning.textContent = '함정 재료예요! 문어를 넣어 주세요!';
      warning.hidden = false;
      clearTimeout(warningTimer);
      warningTimer = setTimeout(() => (warning.hidden = true), WARNING_MS);
    }),
    () => clearTimeout(warningTimer),
  );

  return {
    update(state) {
      const step = state.phase === 'tutorial' ? state.holes[ctx.selected.hole]?.step : undefined;
      guide.hidden = step === undefined;
      guide.textContent = tutorialSteps.find((t) => t.target === step)?.message ?? '';
      toolbar.highlight(step ?? null);
    },
  };
}
