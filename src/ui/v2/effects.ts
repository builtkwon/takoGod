// 연출 DOM. 판정이 아니라 그리기만 한다(떨어짐·되돌아감·헛손질 표시).
import { el } from '../dom';
import { INGREDIENT_LABEL } from '../format';
import type { DragView, GhostLook, Pt } from './controller';

export type MarkTone = 'good' | 'bad' | 'neutral';

export interface Effects extends DragView {
  mark(text: string, at: Pt, tone: MarkTone): void;
}

const FLY_MS = 380;
const FALL_MS = 650;
const MARK_MS = 800;

const LABEL: Readonly<Record<GhostLook['kind'], string>> = { margarine: '마가린', batter: '반죽', filling: '', done: '', dark: '', burnt: '' };

function ghostEl(look: GhostLook): HTMLElement {
  const e = el('div', `ui-ghost ui-ghost-${look.kind}`, look.ingredient ? INGREDIENT_LABEL[look.ingredient] : LABEL[look.kind]);
  return e;
}

const place = (e: HTMLElement, p: Pt): void => {
  e.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
};

/** 놓인 곳(viewport 좌표) 기준으로 그리므로 요소는 position:fixed다. */
export function createEffects(layer: HTMLElement): Effects {
  let ghost: HTMLElement | null = null;

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
      const e = el('div', `ui-mark ui-mark-${tone}`, text);
      animate(e, [{ transform: `${at(p)} translateY(0)`, opacity: 1 }, { transform: `${at(p)} translateY(-36px)`, opacity: 0 }], MARK_MS);
    },
  };
}
