import type { GameStateV2 } from '../../contracts';
import { rushText } from '../../data';
import { el } from '../dom';

export interface RushBadge {
  readonly root: HTMLElement;
  update(state: Pick<GameStateV2, 'rush'>): void;
  /** 판이 바뀔 때 숨긴다. */
  reset(): void;
}

/** 타이밍 바 아래 "러시 아워! N초" 배지. state.rush가 null이면 숨긴다(러시가 끝나거나 판이 끝났을 때). */
export function createRushBadge(): RushBadge {
  const root = el('div', 'ui-rush');
  root.hidden = true;
  let last = '';
  return {
    root,
    reset() {
      root.hidden = true;
      last = '';
    },
    update(state) {
      root.hidden = state.rush === null;
      if (!state.rush) {
        last = '';
        return;
      }
      const text = rushText.badge(state.rush.remainingSec);
      if (text !== last) {
        last = text;
        root.textContent = text;
      }
    },
  };
}
