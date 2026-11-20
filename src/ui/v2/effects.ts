// 연출 DOM. 판정이 아니라 그리기만 한다(떨어짐·되돌아감·헛손질 표시).
import { el } from '../dom';
import { INGREDIENT_LABEL } from '../format';
import { iconSvg, LOOK_ARIA } from './icons';
import type { DragView, GhostLook, Pt } from './controller';

export type MarkTone = 'good' | 'bad' | 'neutral';

export interface Effects extends DragView {
  mark(text: string, at: Pt, tone: MarkTone): void;
}

const FLY_MS = 380;
const FALL_MS = 650;
const MARK_MS = 800;
/** 판정 글자(30px) 한 글자의 대략 폭. 화면 좌우로 잘리지 않게 가운데 x를 가두는 데 쓴다. */
const MARK_CHAR_PX = 30;

/** 글자 폭의 절반이 화면 안에 들어오도록 가운데 x를 가둔다. */
export function clampMarkX(x: number, text: string, viewportW: number): number {
  const half = (text.length * MARK_CHAR_PX) / 2 + 4;
  return viewportW <= 2 * half ? viewportW / 2 : Math.min(viewportW - half, Math.max(half, x));
}

function ghostEl(look: GhostLook): HTMLElement {
  const e = el('div', `ui-ghost ui-ghost-${look.kind}`);
  e.innerHTML = iconSvg(look);
  e.setAttribute('role', 'img');
  e.setAttribute('aria-label', look.ingredient ? INGREDIENT_LABEL[look.ingredient] : LOOK_ARIA[look.kind as Exclude<GhostLook['kind'], 'filling'>]);
  return e;
}

const place = (e: HTMLElement, p: Pt): void => {
  e.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
};

/** 놓인 곳(viewport 좌표) 기준으로 그리므로 요소는 position:fixed다. */
export function createEffects(layer: HTMLElement): Effects {
  let ghost: HTMLElement | null = null;
  let markEl: HTMLElement | null = null; // 판정 글자는 한 번에 하나만 보인다(인접 구멍을 연달아 눌러도 겹치지 않게)

  const animate = (e: HTMLElement, keyframes: Keyframe[], ms: number): void => {
    layer.append(e);
    const a = e.animate(keyframes, { duration: ms, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => e.remove();
  };
  const at = (p: Pt): string => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;

  return {
    ghostStart(look, p) {
      ghost?.remove();
      ghost = ghostEl(look);
      place(ghost, p);
      layer.append(ghost);
    },
    ghostMove(p) {
      if (ghost) place(ghost, p);
    },
    ghostEnd() {
      ghost?.remove();
      ghost = null;
    },
    fly(look, from, to) {
      animate(ghostEl(look), [{ transform: at(from) }, { transform: at(to) }], FLY_MS);
    },
    fall(look, from) {
      const to = { x: from.x, y: from.y + window.innerHeight };
      animate(ghostEl(look), [{ transform: `${at(from)} rotate(0deg)`, opacity: 1 }, { transform: `${at(to)} rotate(200deg)`, opacity: 0.6 }], FALL_MS);
    },
    mark(text, p, tone) {
      markEl?.remove();
      const e = el('div', `ui-mark ui-mark-${tone}`, text);
      const q = { x: clampMarkX(p.x, text, window.innerWidth), y: p.y };
      markEl = e;
      animate(e, [{ transform: `${at(q)} translateY(0)`, opacity: 1 }, { transform: `${at(q)} translateY(-56px)`, opacity: 0 }], MARK_MS);
    },
  };
}
