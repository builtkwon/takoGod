// 장면 배치 상수와 카메라. three에 의존하지 않는다(pick.ts가 three 없이 테스트되도록 분리).
import { VIEW_ASPECT } from './dims';

export type V3 = readonly [number, number, number];

/** 철판 윗면 높이. */
export const PLATE_TOP = 0.3;
/** 구멍 수(4×4)와 간격. */
export const HOLE_COUNT = 16;
export const HOLE_SPACING = 0.9;
/** 철판 크기(가로 x, 세로 z). */
export const PLATE_W = 4.0;
export const PLATE_D = 3.9;
/** 알(타코야끼·반죽)·구멍 장식을 6구 때보다 줄이는 배율(GDD §굽기: 구멍이 늘어난 만큼 조금 작게). */
export const TAKO_S = 0.76;
/** 16구 위치: 4열 x 4행, 인덱스 0..15 = 행 우선(index = 행*4 + 열, 0행이 화면 위쪽). */
export const HOLE_POS: readonly V3[] = Array.from({ length: HOLE_COUNT }, (_, i): V3 => [((i % 4) - 1.5) * HOLE_SPACING, PLATE_TOP, (Math.floor(i / 4) - 1.5) * HOLE_SPACING]);
/** 트레이 슬롯 x 좌표(최대 6개). */
export const TRAY_X: readonly number[] = Array.from({ length: 6 }, (_, i) => (i - 2.5) * 0.5);
export const TRAY_TOP = 0.1;
export const TRAY_Z = 2.6;
/** 후네 중심 z. 철판·트레이 아래(화면 하단). */
export const FUNE_Z = 4.0;
/** 후네(와 안의 볼·가쓰오부시)를 6구 때보다 줄이는 배율. 후네는 6알 그대로다. */
export const FUNE_S = 0.85;
/** 손님 서 있는 위치(뒤쪽 카운터). */
export const CUSTOMER_POS: readonly V3[] = [
  [-1.5, 0, -2.9],
  [1.5, 0, -2.9],
];

/** 렌더 카메라(4×4 철판·트레이·후네가 세로 화면에 들어오도록 철판 기준으로 높이고 뒤로 뺐다). fov는 세로. */
export const CAMERA = { pos: [0, 8.2, 8.0], target: [0, 0.3, 0.7], fovDeg: 45, aspect: VIEW_ASPECT } as const;
