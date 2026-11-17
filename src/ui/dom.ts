import type { EventBus, GameState } from '../contracts';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** 모듈이 공유하는 UI 문맥. selected는 도구바에서 고른 구멍(ui 로컬 상태). */
export interface UiContext {
  readonly layer: HTMLElement;
  readonly bus: EventBus;
  readonly getState: () => GameState;
  readonly selected: { hole: number };
  readonly disposers: (() => void)[];
}
