import type { EventBus, GameStateV2, ScenePicker } from '../../contracts';
import { tutorialStepsV2 } from '../../data';
import { el } from '../dom';
import { INGREDIENT_LABEL } from '../format';
import { arrowGeometry, tutorialArrow } from './arrow';
import type { Pt } from './controller';

export interface TutorialViewV2 {
  update(state: GameStateV2): void;
}

const WARNING_MS = 2000;

/** 상단 안내문구, 유도 화살표, 거부 시 화살표 흔들림, 함정 재료 경고 말풍선. */
export function createTutorialView(
  layer: HTMLElement,
  bus: EventBus,
  picker: ScenePicker,
  buckets: { readonly margarine: () => Pt | null; readonly batter: () => Pt | null },
  disposers: (() => void)[],
): TutorialViewV2 {
  const guide = el('div', 'ui-guide ui-hit');
  const warning = el('div', 'ui-warning ui-hit');
  const arrow = el('div', 'ui-arrow');
  guide.hidden = true;
  warning.hidden = true;
  arrow.hidden = true;
  layer.append(guide, warning, arrow);

  let warningTimer: ReturnType<typeof setTimeout> | undefined;
  disposers.push(
    bus.on('tutorial/invalid-action', () => {
      arrow.classList.remove('ui-shake');
      void arrow.offsetWidth; // 애니메이션 재시작
      arrow.classList.add('ui-shake');
    }),
    bus.on('tutorial/trap-warning', ({ ingredient }) => {
      warning.textContent = `[${INGREDIENT_LABEL[ingredient]}] 함정 재료예요! 문어를 넣어 주세요!`;
      warning.hidden = false;
      clearTimeout(warningTimer);
      warningTimer = setTimeout(() => (warning.hidden = true), WARNING_MS);
    }),
    () => clearTimeout(warningTimer),
  );

  return {
    update(state) {
      const stage = state.phase === 'tutorial' ? state.tutorialStage : null;
      guide.hidden = stage === null;
      guide.textContent = stage ? (tutorialStepsV2.find((s) => s.stage === stage)?.message ?? '') : '';
      const a = stage ? tutorialArrow(stage, state, picker, buckets) : null;
      arrow.hidden = a === null;
      if (a) {
        const g = arrowGeometry(a.from, a.to);
        Object.assign(arrow.style, { left: `${g.x}px`, top: `${g.y}px`, width: `${g.length}px`, transform: `rotate(${g.angle}deg)` });
      }
    },
  };
}
