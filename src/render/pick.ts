// ScenePicker 구현. 투영·광선 판정은 순수 함수라 three 없이 테스트한다.
import type { PickTarget, ScenePicker } from '../contracts';
import { BOARD_K, CAMERA, FUNE_S, FUNE_Z, HOLE_POS, PLATE_TOP, TRAY_TOP, TRAY_X, TRAY_Z } from './layout';
import type { V3 } from './layout';

export interface CameraSpec {
  readonly pos: V3;
  readonly target: V3;
  /** 세로 시야각(도). */
  readonly fovDeg: number;
  readonly aspect: number;
}

/** 캔버스 정규화 좌표: u는 왼→오, v는 위→아래, 0..1. */
export interface Uv {
  readonly u: number;
  readonly v: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface Projector {
  /** 월드 점 → 캔버스 uv. 카메라 뒤면 null. */
  project(p: V3): Uv | null;
  /** 캔버스 uv → 월드 광선(방향은 정규화하지 않음: p = o + d*t). */
  ray(u: number, v: number): { readonly o: V3; readonly d: V3 };
}

/** three의 PerspectiveCamera.lookAt(up=+y)과 같은 규약의 핀홀 투영. */
export function makeProjector(cam: CameraSpec): Projector {
  const f = norm(sub(cam.target, cam.pos));
  const r = norm(cross(f, [0, 1, 0]));
  const up = cross(r, f);
  const th = Math.tan((cam.fovDeg * Math.PI) / 360);
  return {
    project(p) {
      const d = sub(p, cam.pos);
      const z = dot(d, f);
      if (z <= 0) return null;
      return { u: (dot(d, r) / (z * th * cam.aspect) + 1) / 2, v: (1 - dot(d, up) / (z * th)) / 2 };
    },
    ray(u, v) {
      const x = (u * 2 - 1) * th * cam.aspect;
      const y = (1 - v * 2) * th;
      return { o: cam.pos, d: [f[0] + r[0] * x + up[0] * y, f[1] + r[1] * x + up[1] * y, f[2] + r[2] * x + up[2] * y] };
    },
  };
}

// 판정 면: 모델 중심 높이의 수평면. 서 있는 모델 윗부분을 눌러도 같은 대상으로 잡히게 한다.
const HOLE_Y = PLATE_TOP + 0.2;
const HOLE_R = 0.42 * BOARD_K; // 구멍 간격 HOLE_SPACING(0.9×BOARD_K=1.035)의 절반(0.5175) 안쪽(0.483)이라 이웃과 겹치지 않는다.
const TRAY_Y = TRAY_TOP + 0.12;
const TRAY_HALF_X = 0.25;
const TRAY_HALF_Z = 0.3;
const FUNE_Y = 0.2;
const FUNE_RX = 1.55 * FUNE_S;
const FUNE_RZ = 0.75 * FUNE_S;

/** 대상의 판정·anchor 기준점(월드). 존재하지 않는 대상이면 null. */
export function worldAnchor(t: PickTarget, trayCount: number): V3 | null {
  if (t.kind === 'hole') {
    const p = HOLE_POS[t.index];
    return p === undefined ? null : [p[0], HOLE_Y, p[2]];
  }
  if (t.kind === 'tray') {
    const x = TRAY_X[t.slot];
    return x === undefined || t.slot >= trayCount ? null : [x, TRAY_Y, TRAY_Z];
  }
  return [0, FUNE_Y, FUNE_Z];
}

/** 수평면 y에 닿는 광선 매개변수 t(앞쪽만). */
function hitPlane(o: V3, d: V3, y: number): V3 | null {
  if (d[1] >= 0) return null;
  const t = (y - o[1]) / d[1];
  return t > 0 ? [o[0] + d[0] * t, y, o[2] + d[2] * t] : null;
}

/** uv에 있는 대상. 겹치면 카메라에 가까운(광선이 먼저 닿는) 쪽. */
export function pickUv(proj: Projector, u: number, v: number, trayCount: number): PickTarget | null {
  const { o, d } = proj.ray(u, v);
  let best: { t: PickTarget; dist: number } | null = null;
  const offer = (t: PickTarget, hit: V3 | null) => {
    if (hit === null) return;
    const dist = Math.hypot(hit[0] - o[0], hit[1] - o[1], hit[2] - o[2]);
    if (best === null || dist < best.dist) best = { t, dist };
  };
  const onHole = hitPlane(o, d, HOLE_Y);
  if (onHole !== null) {
    HOLE_POS.forEach((p, index) => {
      if (Math.hypot(onHole[0] - p[0], onHole[2] - p[2]) <= HOLE_R) offer({ kind: 'hole', index }, onHole);
    });
  }
  const onTray = hitPlane(o, d, TRAY_Y);
  if (onTray !== null) {
    for (let slot = 0; slot < Math.min(trayCount, TRAY_X.length); slot++) {
      if (Math.abs(onTray[0] - (TRAY_X[slot] ?? 0)) <= TRAY_HALF_X && Math.abs(onTray[2] - TRAY_Z) <= TRAY_HALF_Z) offer({ kind: 'tray', slot }, onTray);
    }
  }
  const onFune = hitPlane(o, d, FUNE_Y);
  if (onFune !== null && (onFune[0] / FUNE_RX) ** 2 + ((onFune[2] - FUNE_Z) / FUNE_RZ) ** 2 <= 1) offer({ kind: 'fune' }, onFune);
  return (best as { t: PickTarget } | null)?.t ?? null;
}

/** 대상의 uv. 없는 대상·카메라 뒤·화면 밖이면 null. */
export function anchorUv(proj: Projector, target: PickTarget, trayCount: number): Uv | null {
  const w = worldAnchor(target, trayCount);
  const uv = w === null ? null : proj.project(w);
  return uv !== null && uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1 ? uv : null;
}

/**
 * canvas의 현재 CSS 위치·크기로 뷰포트 좌표를 변환한다(렌더 해상도와 무관하게 rect 비율만 쓴다).
 * getTrayCount: 현재 화면에 있는 트레이 칸 수(렌더러가 마지막으로 그린 GameStateV2.tray 길이).
 */
export function createScenePicker(canvas: Pick<HTMLElement, 'getBoundingClientRect'>, getTrayCount: () => number, cam: CameraSpec = CAMERA): ScenePicker {
  const proj = makeProjector(cam);
  return {
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const u = (clientX - r.left) / r.width;
      const v = (clientY - r.top) / r.height;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
      return pickUv(proj, u, v, getTrayCount());
    },
    anchor(target) {
      const r = canvas.getBoundingClientRect();
      const uv = anchorUv(proj, target, getTrayCount());
      return uv === null ? null : { x: r.left + uv.u * r.width, y: r.top + uv.v * r.height };
    },
  };
}
