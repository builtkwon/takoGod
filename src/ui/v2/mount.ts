// 굽기 조작 개편 UI 진입점(GDD §굽기). 옛 mountUi와 병행하며 main이 V2 Game으로 바뀔 때 교체한다.
// core와는 EventBus·GameStateV2(읽기)·ScenePicker로만 통신한다. 판정은 하지 않는다.
import type { EventBus, GameStateV2, ScenePicker } from '../../contracts';
import { createDialogues } from '../dialogue';
import { el } from '../dom';
import { showIosInstall } from '../install';
import type { Rect } from '../layout';
import { showResult, showTitle } from '../screens';
import { CSS } from '../styles';
import type { UiHandle } from '../handle';
import { createBuckets } from './buckets';
import { createController } from './controller';
import { createEffects } from './effects';
import { bindFeedback } from './feedback';
import { createHudV2 } from './hud';
import { bindReveal } from './reveal';
import { CSS_V2 } from './styles';
import { createTimingBar } from './timing-bar';
import { createTutorialView } from './tutorial-view';

/** 장면 대상 주변을 답 버튼이 피할 반경(CSS px). 구멍·트레이 칸은 앵커 중심 기준이다. */
const HOLE_R = 46;
const TRAY_R = 36;
const FUNE_R = 70;

export function mountUiV2(root: HTMLElement, bus: EventBus, getState: () => GameStateV2, picker: ScenePicker): UiHandle {
  const layer = el('div', 'ui-layer');
  const style = el('style', '', CSS + CSS_V2);
  const disposers: (() => void)[] = [];

  const fx = createEffects(layer);
  const controller = createController({ bus, picker, getState, view: fx });
  const buckets = createBuckets(controller);
  const bar = createTimingBar();
  const hud = createHudV2();
  const tutorial = createTutorialView(layer, bus, picker, { margarine: () => buckets.origin('margarine'), batter: () => buckets.origin('batter') }, disposers);

  const sceneObstacles = (): readonly Rect[] => {
    const base = layer.getBoundingClientRect();
    const state = getState();
    const box = (p: { x: number; y: number } | null, r: number): Rect[] => (p ? [{ x: p.x - base.left - r, y: p.y - base.top - r, w: 2 * r, h: 2 * r }] : []);
    return [
      ...state.holes.flatMap((h) => box(picker.anchor({ kind: 'hole', index: h.index }), HOLE_R)),
      ...state.tray.flatMap((_, slot) => box(picker.anchor({ kind: 'tray', slot }), TRAY_R)),
      ...box(picker.anchor({ kind: 'fune' }), FUNE_R),
    ];
  };
  const dialogues = createDialogues({ layer, bus, disposers }, [hud.root, bar.root, buckets.margarine, buckets.batter], null, Math.random, sceneObstacles);

  layer.append(bar.root, hud.root, buckets.margarine, buckets.batter);
  root.append(style, layer);
  const prevTouch = root.style.touchAction;
  root.style.touchAction = 'none'; // 끌기 중 스크롤·확대 방지

  disposers.push(bindFeedback(bus, picker, fx), bindReveal(layer, bus, getState), () => controller.dispose());

  // 장면(3D 캔버스) 입력. ui-hit 요소 위의 입력은 DOM 쪽 몫이다.
  const pt = (e: PointerEvent): { x: number; y: number } => ({ x: e.clientX, y: e.clientY });
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('.ui-hit'))) return;
    controller.down(e.pointerId, pt(e));
  };
  const onMove = (e: PointerEvent): void => controller.move(e.pointerId, pt(e));
  const onUp = (e: PointerEvent): void => controller.up(e.pointerId, pt(e));
  const onCancel = (): void => controller.cancel();
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') controller.cancel();
  };
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.addEventListener('visibilitychange', onHidden);

  let raf = 0;
  const frame = (): void => {
    const state = getState();
    bar.update(state);
    hud.update(state);
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
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onHidden);
      root.style.touchAction = prevTouch;
      controller.cancel();
      disposers.forEach((d) => d());
      layer.remove();
      style.remove();
    },
  };
}
