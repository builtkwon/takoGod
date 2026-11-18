// ui 모듈 진입점. DOM 오버레이를 root 위에 얹는다. core와는 EventBus·GameState(읽기)로만 통신한다.
// 경계: docs/rules/architecture/modules/ui.md
import type { EventBus, GameState } from '../contracts';
import { el, type UiContext } from './dom';
import { createDialogues } from './dialogue';
import type { UiHandle } from './handle';
import { createHud } from './hud';
import { showIosInstall } from './install';
import { showResult, showReviewCard, showTitle, showTutorialComplete } from './screens';
import { CSS } from './styles';
import { createToolbar } from './toolbar';
import { createTutorial } from './tutorial';

export function mountUi(root: HTMLElement, bus: EventBus, getState: () => GameState): UiHandle {
  const layer = el('div', 'ui-layer');
  const style = el('style', '', CSS);
  const ctx: UiContext = { layer, bus, getState, selected: { hole: 0 }, disposers: [] };

  const hud = createHud(ctx);
  const toolbar = createToolbar(ctx);
  const dialogues = createDialogues(ctx, [hud.root], toolbar.root);
  const tutorial = createTutorial(ctx, toolbar);
  layer.append(hud.root, toolbar.root);
  root.append(style, layer);

  ctx.disposers.push(
    bus.on('review/issued', ({ review }) => (review.source === 'tutorial' ? showTutorialComplete(layer, review) : showReviewCard(layer, review))),
  );

  let raf = 0;
  const frame = (): void => {
    const state = getState();
    hud.update(state);
    toolbar.update(state);
    dialogues.update(state);
    tutorial.update(state);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    title: () => showIosInstall(layer).then(() => showTitle(layer)),
    showResult: (result) => showResult(layer, result),
    destroy() {
      cancelAnimationFrame(raf);
      ctx.disposers.forEach((d) => d());
      layer.remove();
      style.remove();
    },
  };
}

export type { UiHandle } from './handle';
export { mountUiV2 } from './v2/mount';
