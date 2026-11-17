import type { CookStep, GameState } from '../contracts';
import { el, type UiContext } from './dom';
import { INGREDIENT_LABEL } from './format';
import { stepForTool, TOOLS } from './tools';

export interface Toolbar {
  readonly root: HTMLElement;
  /** 튜토리얼 화살표. null이면 끈다. */
  highlight(step: CookStep | null): void;
  /** 순서 외 탭 시 화살표를 흔든다. */
  shake(): void;
  update(state: GameState): void;
}

export function createToolbar(ctx: UiContext): Toolbar {
  const root = el('div', 'ui-toolbar ui-hit');
  const holes = el('div', 'ui-holes');
  const tools = el('div', 'ui-tools');
  const tray = el('div', 'ui-tray');
  tray.hidden = true;
  root.append(tray, holes, tools);

  const chips = Array.from({ length: 6 }, (_, i) => {
    const b = el('button', 'ui-chip', String(i + 1));
    b.addEventListener('click', () => {
      ctx.selected.hole = i;
    });
    holes.append(b);
    return b;
  });

  const buttons = TOOLS.map((tool) => {
    const b = el('button', 'ui-tool', tool.label);
    b.addEventListener('click', () => {
      const hole = ctx.selected.hole;
      const current = ctx.getState().holes[hole]?.step;
      if (!current) return;
      const step = stepForTool(tool, current);
      // 트레이는 속재료 차례일 때만 연다. 그 외에는 순서 외 입력으로 core에 넘긴다.
      if (step === 'filling' && current === 'filling') tray.hidden = !tray.hidden;
      else ctx.bus.emit('input/cook', { hole, step });
    });
    tools.append(b);
    return b;
  });

  let trayKey = '';
  const renderTray = (state: GameState): void => {
    const key = state.tray.map((t) => t.id).join();
    if (key === trayKey) return;
    trayKey = key;
    tray.replaceChildren(
      ...state.tray.map((ing) => {
        const b = el('button', 'ui-ingredient', INGREDIENT_LABEL[ing.id]);
        b.addEventListener('click', () => {
          tray.hidden = true;
          ctx.bus.emit('input/cook', { hole: ctx.selected.hole, step: 'filling', ingredient: ing.id });
        });
        return b;
      }),
    );
  };

  let hinted: HTMLElement | undefined;
  return {
    root,
    highlight(step) {
      const next = step ? buttons[TOOLS.findIndex((t) => t.steps.includes(step))] : undefined;
      if (next === hinted) return;
      hinted?.classList.remove('ui-hint', 'ui-shake');
      next?.classList.add('ui-hint');
      hinted = next;
    },
    shake() {
      if (!hinted) return;
      hinted.classList.remove('ui-shake');
      void hinted.offsetWidth; // 애니메이션 재시작
      hinted.classList.add('ui-shake');
    },
    update(state) {
      chips.forEach((c, i) => {
        c.classList.toggle('on', i === ctx.selected.hole);
        c.classList.toggle('done', state.holes[i]?.step === 'done');
      });
      if (state.holes[ctx.selected.hole]?.step !== 'filling') tray.hidden = true;
      renderTray(state);
    },
  };
}
