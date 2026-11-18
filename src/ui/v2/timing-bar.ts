import type { GameStateV2 } from '../../contracts';
import { el } from '../dom';
import { barView } from './bar';

export interface TimingBar {
  readonly root: HTMLElement;
  update(state: GameStateV2): void;
}

/** 상단 타이밍 바 하나. 위치·영역은 GameStateV2를 그대로 그린다. */
export function createTimingBar(): TimingBar {
  const root = el('div', 'ui-bar');
  const zone = el('div', 'ui-bar-zone');
  const marker = el('div', 'ui-bar-marker');
  root.append(zone, marker);
  return {
    root,
    update(state) {
      const v = barView(state);
      root.classList.toggle('active', v.active);
      zone.hidden = v.zone === null;
      if (v.zone) {
        zone.style.left = `${v.zone.leftPct}%`;
        zone.style.width = `${v.zone.widthPct}%`;
      }
      marker.style.left = `${v.markerPct}%`;
    },
  };
}
