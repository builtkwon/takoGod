import { titleText } from '../../data';
import { el } from '../dom';

/** 가로가 세로보다 크고 높이가 500 미만이면 가로 모드(폰 가로). 넓은 데스크톱 창은 해당하지 않는다. */
export const LANDSCAPE_MAX_H = 500;
export const isLandscapeBlocked = (w: number, h: number): boolean => w > h && h < LANDSCAPE_MAX_H;

/**
 * 가로 모드 안내 전체 오버레이. 떠 있는 동안 아래 입력을 막고(ui-hit) isBlocking()이 true라 main이 게임을 멈춘다.
 * 세로로 돌아오면 숨긴다. 크기는 update로 받는다(프레임마다).
 */
export function createRotateGuide(layer: HTMLElement): { update(w: number, h: number): void; isBlocking(): boolean; dispose(): void } {
  const o = el('div', 'ui-rotate ui-hit');
  o.hidden = true;
  o.append(el('div', 'ui-rotate-icon', titleText.rotateIcon), el('p', '', titleText.rotatePrompt));
  layer.append(o);
  return {
    update(w, h) {
      const b = isLandscapeBlocked(w, h);
      if (o.hidden === b) o.hidden = !b;
    },
    isBlocking: () => !o.hidden,
    dispose: () => o.remove(),
  };
}
