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
  const label = el('span', 'ui-bar-label');
  zone.append(label);
  const marker = el('div', 'ui-bar-marker');
  root.append(zone, marker);
  let zoneKey = '';
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
      // 영역이 바뀔 때(반죽·굴리기 1 때 새로 뽑힘, 다른 구멍을 만짐) 짧게 번쩍여 새 자리를 알린다.
      const key = v.zone ? `${v.zone.leftPct}:${v.zone.widthPct}` : '';
      if (key !== zoneKey) {
        zoneKey = key;
        if (key) {
          zone.classList.remove('ui-bar-flash');
          void zone.offsetWidth; // 애니메이션 재시작
          zone.classList.add('ui-bar-flash');
        }
      }
      root.dataset.step = String(v.step ?? 0);
      label.textContent = v.step === null ? '' : String(v.step);
      marker.style.left = `${v.markerPct}%`;
    },
  };
}
