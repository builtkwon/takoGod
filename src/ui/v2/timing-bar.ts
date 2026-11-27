import type { GameStateV2 } from '../../contracts';
import { el } from '../dom';
import { barView, type ZoneView } from './bar';

export interface TimingBar {
  readonly root: HTMLElement;
  update(state: GameStateV2): void;
}

/** 영역 하나. 값이 바뀔 때마다 번쩍여 새 자리를 알린다. */
function createZone(): { readonly root: HTMLElement; update(v: ZoneView | null): void } {
  const root = el('div', 'ui-bar-zone');
  root.hidden = true;
  let key = '';
  return {
    root,
    update(v) {
      root.hidden = v === null;
      const next = v ? `${v.leftPct}:${v.widthPct}` : '';
      if (v) {
        root.style.left = `${v.leftPct}%`;
        root.style.width = `${v.widthPct}%`;
      }
      if (next === key) return;
      key = next;
      if (!next) return;
      root.classList.remove('ui-bar-flash');
      void root.offsetWidth; // 애니메이션 재시작
      root.classList.add('ui-bar-flash');
    },
  };
}

/** 점수판(HUD) 아래 타이밍 바 하나. 트랙은 항상 보이고 위치·영역 하나는 GameStateV2를 그대로 그린다. */
export function createTimingBar(): TimingBar {
  const root = el('div', 'ui-bar');
  const zone = createZone();
  const marker = el('div', 'ui-bar-marker');
  root.append(zone.root, marker);
  return {
    root,
    update(state) {
      const v = barView(state);
      zone.update(v.zone);
      marker.style.left = `${v.markerPct}%`;
    },
  };
}
