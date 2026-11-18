// 장면 배치 상수와 카메라. three에 의존하지 않는다(pick.ts가 three 없이 테스트되도록 분리).
import { RT_H, RT_W } from './dims';

export type V3 = readonly [number, number, number];

/** 철판 윗면 높이. */
export const PLATE_TOP = 0.3;
/** 6구 위치: 3열 x 2행, 인덱스 0..5 = 행 우선. */
export const HOLE_POS: readonly V3[] = Array.from({ length: 6 }, (_, i): V3 => [(i % 3 - 1) * 1.1, PLATE_TOP, (Math.floor(i / 3) - 0.5) * 1.1]);
/** 트레이 슬롯 x 좌표(최대 6개). */
export const TRAY_X: readonly number[] = Array.from({ length: 6 }, (_, i) => (i - 2.5) * 0.5);
export const TRAY_TOP = 0.1;
export const TRAY_Z = 2.1;
/** 후네 중심 z. 철판·트레이 아래(화면 하단). */
export const FUNE_Z = 3.5;

/** 렌더 카메라(후네가 화면 하단에 들어오도록 철판 기준으로 앞으로 밀었다). fov는 세로. */
export const CAMERA = { pos: [0, 7.5, 7.3], target: [0, 0.4, 0.5], fovDeg: 45, aspect: RT_W / RT_H } as const;
