// 화면 비율·상단 UI 높이에 맞춰 같은 카메라 방향으로 장면을 채우는 오프축 맞춤. three에 의존하지 않는다(pick과 공유).
import { CAMERA, CUSTOMER_POS, FUNE_S, FUNE_Z, PLATE_D, PLATE_TOP, PLATE_W } from './layout';
import type { V3 } from './layout';
import { makeProjector } from './projector';
import type { CameraSpec } from './projector';
import { VIEW_ASPECT } from './dims';

/** 상단 UI(HUD+타이밍 바) 높이(CSS px). ui의 .ui-top 높이와 맞춘다(약 125px). 장면은 이 아래 영역에 채운다. */
export const TOP_UI_PX = 125;

/** 반드시 보여야 하는 월드 점: 손님 머리 위, 철판 모서리(좌우 여유 포함), 후네 앞. */
const CONTENT: readonly V3[] = [
  ...CUSTOMER_POS.flatMap(([x, , z]): V3[] => [[x - 0.7, 2.7, z], [x + 0.7, 2.7, z]]),
  [-PLATE_W / 2 - 0.3, PLATE_TOP, PLATE_D / 2],
  [PLATE_W / 2 + 0.3, PLATE_TOP, PLATE_D / 2],
  [-PLATE_W / 2 - 0.3, PLATE_TOP, -PLATE_D / 2],
  [PLATE_W / 2 + 0.3, PLATE_TOP, -PLATE_D / 2],
  [0, 0, FUNE_Z + 0.75 * FUNE_S + 0.2],
];

/** 캔버스 CSS 크기: 폭이 높이의 VIEW_ASPECT(3:4)보다 넓으면 가로를 줄인다(양옆 letterbox 유지). 좁고 긴 화면은 컨테이너를 다 쓴다. */
export function canvasSize(cw: number, ch: number): { w: number; h: number } {
  const w = Math.floor(Math.min(cw, ch * VIEW_ASPECT));
  return { w, h: ch };
}

/** 캔버스(w×h CSS px)에서 CONTENT가 상단 UI 아래 영역에 최대한 크게, 잘리지 않게 들어가는 카메라. */
export function fitCamera(w: number, h: number, topPx: number = TOP_UI_PX): CameraSpec {
  const base: CameraSpec = { ...CAMERA, aspect: w / h };
  const proj = makeProjector(base);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of CONTENT) {
    const uv = proj.project(p);
    if (uv === null) continue;
    const nx = uv.u * 2 - 1;
    const ny = 1 - uv.v * 2;
    x0 = Math.min(x0, nx); x1 = Math.max(x1, nx);
    y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
  }
  const top = 1 - 2 * Math.min(topPx / h, 0.5); // 상단 UI 아래 경계(NDC)
  const scale = Math.min(2 / (x1 - x0), (top + 1) / (y1 - y0));
  return { ...base, scale, shiftX: -scale * (x0 + x1) / 2, shiftY: (top - 1) / 2 - (scale * (y0 + y1)) / 2 };
}
