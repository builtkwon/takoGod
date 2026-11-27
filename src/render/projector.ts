// 핀홀 투영(three 비의존). pick·fit이 공유한다.
import type { V3 } from './layout';

export interface CameraSpec {
  readonly pos: V3;
  readonly target: V3;
  /** 세로 시야각(도). */
  readonly fovDeg: number;
  readonly aspect: number;
  /** 화면 맞춤용 오프축 확대(기본 1)와 NDC 이동(기본 0). fit.ts가 화면 비율에 맞춰 채운다. */
  readonly scale?: number;
  readonly shiftX?: number;
  readonly shiftY?: number;
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
  const k = cam.scale ?? 1;
  const sx = cam.shiftX ?? 0;
  const sy = cam.shiftY ?? 0;
  return {
    project(p) {
      const d = sub(p, cam.pos);
      const z = dot(d, f);
      if (z <= 0) return null;
      return { u: ((dot(d, r) / (z * th * cam.aspect)) * k + sx + 1) / 2, v: (1 - ((dot(d, up) / (z * th)) * k + sy)) / 2 };
    },
    ray(u, v) {
      const x = (((u * 2 - 1) - sx) / k) * th * cam.aspect;
      const y = (((1 - v * 2) - sy) / k) * th;
      return { o: cam.pos, d: [f[0] + r[0] * x + up[0] * y, f[1] + r[1] * x + up[1] * y, f[2] + r[2] * x + up[2] * y] };
    },
  };
}

