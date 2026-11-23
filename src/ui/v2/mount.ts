// UI 진입점(GDD §굽기).
// core와는 EventBus·GameStateV2(읽기)·ScenePicker로만 통신한다. 판정은 하지 않는다.
import type { EventBus, GameStateV2, ScenePicker } from '../../contracts';
import { createDialogues } from '../dialogue';
import { el } from '../dom';
import { showIosInstall } from '../install';
import { topStack, type Rect } from '../layout';
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
import { createCustomerBadges } from './customer-badges';
import { createRestartConfirm } from './restart';
import { createTrayLabels } from './tray-labels';
import { trackNewBest } from './new-best';
import { createTutorialView } from './tutorial-view';

/** 장면 대상 주변을 답 버튼이 피할 반경(CSS px). 구멍·트레이 칸은 앵커 중심 기준이다. */
const HOLE_R = 46;
const TRAY_R = 36;
const FUNE_R = 70;

export function mountUiV2(root: HTMLElement, bus: EventBus, getState: () => GameStateV2, picker: ScenePicker, opts?: { readonly versionLabel?: string; readonly onRestart?: () => void }): UiHandle {
  const layer = el('div', 'ui-layer');
  const style = el('style', '', CSS + CSS_V2);
  const disposers: (() => void)[] = [];

  const newBest = trackNewBest(bus, disposers);
  const fx = createEffects(layer);
  const controller = createController({ bus, picker, getState, view: fx });
  const buckets = createBuckets(controller);
  const bar = createTimingBar();
  // 게임 중 다시 하기: 결과 화면 '다시 하기'와 같은 reset을 공유하고 상위(main)에 알린다.
  const restartConfirm = createRestartConfirm(layer, () => {
    reset();
    opts?.onRestart?.();
  });
  const hud = createHudV2(bus, disposers, opts?.onRestart ? () => restartConfirm.open() : undefined);
  const trayLabels = createTrayLabels(layer, picker);
  const badges = createCustomerBadges(layer, picker);
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
  /** 트레이 칸과 그 아래 이름표(최대 ~62px)를 덮는 영역. 말풍선이 가리면 안 된다. */
  const trayObstacles = (): readonly Rect[] => {
    const base = layer.getBoundingClientRect();
    return getState().tray.flatMap((_, slot) => {
      const p = picker.anchor({ kind: 'tray', slot });
      return p ? [{ x: p.x - base.left - TRAY_R, y: p.y - base.top - TRAY_R, w: 2 * TRAY_R, h: TRAY_R + 62 }] : [];
    });
  };
  const topBottom = (): number => top.getBoundingClientRect().bottom - layer.getBoundingClientRect().top;
  const dialogues = createDialogues({ layer, bus, disposers, trayObstacles: () => [...trayObstacles(), ...badges.rects()], topBottom, personalityOf: (id) => getState().customers.find((c) => c.id === id)?.personality }, [hud.root, bar.root, buckets.margarine, buckets.batter], sceneObstacles);

  const top = el('div', 'ui-top');
  top.append(hud.root, bar.root); // 타이밍 바는 점수판 바로 아래
  layer.append(top, buckets.margarine, buckets.batter);
  root.append(style, layer);
  const prevTouch = root.style.touchAction;
  root.style.touchAction = 'none'; // 끌기 중 스크롤·확대 방지

  const reveal = bindReveal(layer, bus, getState);
  disposers.push(bindFeedback(bus, picker, fx), reveal.dispose, () => controller.dispose());

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
  // 상단 고정 요소(안내·경고·점수 공개 카드)는 HUD+바 묶음의 실제 아래쪽 기준으로 놓는다(바 높이가 바뀌어도 가리지 않게).
  let topKey = -1;
  const syncTopStack = (): void => {
    const b = Math.ceil(topBottom());
    if (b === topKey) return;
    topKey = b;
    const s = topStack(b);
    layer.style.setProperty('--ui-guide-top', `${s.guide}px`);
    layer.style.setProperty('--ui-warning-top', `${s.warning}px`);
    layer.style.setProperty('--ui-reveal-top', `${s.reveal}px`);
  };
  const frame = (): void => {
    const state = getState();
    bar.update(state);
    syncTopStack();
    hud.update(state);
    trayLabels.update(state, controller.selected());
    badges.update(state);
    dialogues.update(state);
    tutorial.update(state, controller.selected());
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /** 판 단위 UI(대화·분노 말풍선·점수 공개·판정 글자·점수 팝업·끌기)를 모두 비운다. 다시 하기·튜토리얼 재시작 때 쓴다. */
  const reset = (): void => {
    controller.cancel();
    dialogues.reset();
    reveal.reset();
    fx.reset();
    hud.reset();
    badges.reset();
    controller.clearSelection();
    restartConfirm.close();
    newBest.reset();
  };

  return {
    title: (titleOpts) => {
      tutorial.setSuspended(true); // 시작 버튼을 누르기 전에는 튜토리얼 안내가 보이지 않는다
      return showIosInstall(layer)
        .then(() => showTitle(layer, opts?.versionLabel, titleOpts))
        .then((choice) => {
          if (choice === 'tutorial') reset(); // 튜토리얼 재시작: 이전 판 UI를 남기지 않는다
          return choice;
        })
        .finally(() => tutorial.setSuspended(false));
    },
    showResult: (result) =>
      showResult(layer, { ...result, shopScore: getState().shopScore, newBest: newBest.value() }, opts?.versionLabel).then((choice) => {
        reset(); // 이전 판 대화·연출 UI, 탭 선택, "최고 기록!" 표시가 새 판에 남지 않게
        return choice;
      }),
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
