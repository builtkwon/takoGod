import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { PickTarget } from '../../contracts';
import { CAMERA, HOLE_POS } from '../layout';
import { anchorUv, createScenePicker, makeProjector, pickUv, worldAnchor } from '../pick';

const RT_W = 300;
const RT_H = 400;

const proj = makeProjector(CAMERA);
const ALL: PickTarget[] = [...HOLE_POS.map((_, index): PickTarget => ({ kind: 'hole', index })), ...[0, 1, 2, 3, 4, 5].map((slot): PickTarget => ({ kind: 'tray', slot })), { kind: 'fune' }];

describe('투영', () => {
  it('three PerspectiveCamera 투영과 일치한다(오차 1e-6)', () => {
    const cam = new PerspectiveCamera(CAMERA.fovDeg, CAMERA.aspect, 0.1, 50);
    cam.position.set(...CAMERA.pos);
    cam.lookAt(...CAMERA.target);
    cam.updateMatrixWorld();
    for (const p of [[0, 0.3, 0], [1.1, 0.5, -0.55], [-0.75, 0.2, 3.5], [1.25, 0.2, 2.1]] as const) {
      const ndc = new Vector3(...p).project(cam);
      const uv = proj.project(p);
      expect(uv?.u).toBeCloseTo((ndc.x + 1) / 2, 6);
      expect(uv?.v).toBeCloseTo((1 - ndc.y) / 2, 6);
    }
  });
  it('project와 ray는 서로 역이다', () => {
    const uv = proj.project([0.4, 0.3, 1])!;
    const { o, d } = proj.ray(uv.u, uv.v);
    const t = (0.3 - o[1]) / d[1];
    expect([o[0] + d[0] * t, o[2] + d[2] * t].map((x) => Math.round(x * 1e6) / 1e6)).toEqual([0.4, 1]);
  });
});

describe('pick/anchor 왕복', () => {
  it('모든 대상의 anchor를 pick하면 같은 대상이다', () => {
    for (const t of ALL) {
      const uv = anchorUv(proj, t, 6);
      expect(uv, JSON.stringify(t)).not.toBeNull();
      expect(pickUv(proj, uv!.u, uv!.v, 6)).toEqual(t);
    }
  });
  it('대상 아닌 곳(위쪽 벽·철판 가장자리 밖)은 null이다', () => {
    expect(pickUv(proj, 0.5, 0.02, 6)).toBeNull();
    expect(pickUv(proj, 0.01, 0.5, 6)).toBeNull();
  });
  it('트레이 칸 수보다 큰 slot은 pick도 anchor도 없다', () => {
    const t: PickTarget = { kind: 'tray', slot: 4 };
    const uv = anchorUv(proj, t, 6)!;
    expect(pickUv(proj, uv.u, uv.v, 4)).toBeNull();
    expect(anchorUv(proj, t, 4)).toBeNull();
    expect(worldAnchor({ kind: 'hole', index: 16 }, 6)).toBeNull();
  });
  it('트레이 slot 순서는 왼쪽부터이고 구멍 인덱스는 행 우선이다', () => {
    const x = (t: PickTarget) => anchorUv(proj, t, 6)!.u;
    expect(x({ kind: 'tray', slot: 0 })).toBeLessThan(x({ kind: 'tray', slot: 5 }));
    expect(x({ kind: 'hole', index: 0 })).toBeLessThan(x({ kind: 'hole', index: 3 }));
    expect(anchorUv(proj, { kind: 'hole', index: 0 }, 6)!.v).toBeLessThan(anchorUv(proj, { kind: 'hole', index: 12 }, 6)!.v);
  });
  it('구멍 중심에서 반지름 0.3 안쪽을 눌러도 같은 구멍이다(8방향)', () => {
    const [px, , pz] = HOLE_POS[4]!;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const uv = proj.project([px + Math.cos(a) * 0.3, 0.5, pz + Math.sin(a) * 0.3])!;
      expect(pickUv(proj, uv.u, uv.v, 6)).toEqual({ kind: 'hole', index: 4 });
    }
  });
});

describe('createScenePicker (CSS 크기·위치)', () => {
  const at = (left: number, top: number, scale: number) => ({ getBoundingClientRect: () => ({ left, top, width: RT_W * scale, height: RT_H * scale }) as DOMRect });
  it('CSS 배율·오프셋이 달라도 같은 대상을 잡고 anchor는 뷰포트 좌표다', () => {
    for (const [l, t, s] of [[0, 0, 1], [37, 12, 2.5], [100, 40, 3]] as const) {
      const p = createScenePicker(at(l, t, s), () => 6, CAMERA);
      for (const target of ALL) {
        const a = p.anchor(target)!;
        expect(p.pick(a.x, a.y)).toEqual(target);
        const uv = anchorUv(proj, target, 6)!;
        expect(a.x).toBeCloseTo(l + uv.u * RT_W * s, 6);
        expect(a.y).toBeCloseTo(t + uv.v * RT_H * s, 6);
      }
    }
  });
  it('캔버스 밖 좌표는 null이다', () => {
    const p = createScenePicker(at(10, 10, 2), () => 6, CAMERA);
    expect(p.pick(5, 100)).toBeNull();
    expect(p.pick(10 + RT_W * 2, 100)).toBeNull();
    expect(p.pick(-50, -50)).toBeNull();
  });
  it('트레이 칸 수는 호출 시점의 값을 쓴다', () => {
    let n = 6;
    const p = createScenePicker(at(0, 0, 2), () => n, CAMERA);
    const a = p.anchor({ kind: 'tray', slot: 5 })!;
    n = 3;
    expect(p.pick(a.x, a.y)).toBeNull();
    expect(p.anchor({ kind: 'tray', slot: 5 })).toBeNull();
  });
});

describe('customer anchor', () => {
  const at = () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: RT_W, height: RT_H }) as DOMRect });
  const slotOf = (id: string) => ['a', 'b'].indexOf(id);
  it('손님 id의 자리 위 화면 좌표를 돌려주고, 자리가 바뀌면 따라간다', () => {
    const p = createScenePicker(at(), () => 0, CAMERA, slotOf);
    const a = p.anchor({ kind: 'customer', customerId: 'a' })!;
    const b = p.anchor({ kind: 'customer', customerId: 'b' })!;
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.y).toBeGreaterThan(0);
  });
  it('없는 손님은 null이고 pick은 customer를 돌려주지 않는다', () => {
    const p = createScenePicker(at(), () => 0, CAMERA, slotOf);
    expect(p.anchor({ kind: 'customer', customerId: 'zzz' })).toBeNull();
    const a = p.anchor({ kind: 'customer', customerId: 'a' })!;
    expect(p.pick(a.x, a.y)?.kind).not.toBe('customer');
  });
});
