import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { canvasSize, fitCamera, TOP_UI_PX } from '../fit';
import { HOLE_POS, PLATE_D, PLATE_TOP, PLATE_W } from '../layout';
import { createScenePicker, makeProjector } from '../pick';
import type { PickTarget } from '../../contracts';

const SIZES = [[320, 568], [390, 844], [430, 932], [768, 1024], [844, 390], [1280, 800]] as const;

describe('fitCamera', () => {
  it('철판 모서리가 상단 UI 아래·화면 안에 들어오고 빈 영역을 크게 쓴다', () => {
    for (const [cw, ch] of SIZES) {
      const { w, h } = canvasSize(cw, ch);
      const proj = makeProjector(fitCamera(w, h));
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => proj.project([(sx! * PLATE_W) / 2, PLATE_TOP, (sz! * PLATE_D) / 2])!);
      for (const c of corners) {
        expect(c.u).toBeGreaterThanOrEqual(0);
        expect(c.u).toBeLessThanOrEqual(1);
        expect(c.v * h).toBeGreaterThanOrEqual(TOP_UI_PX - 0.5);
        expect(c.v).toBeLessThanOrEqual(1);
      }
    }
  });
  it('세로가 긴 화면도 가로 폭 전체를 쓴다(canvasSize)', () => {
    expect(canvasSize(430, 932)).toEqual({ w: 430, h: 932 });
    expect(canvasSize(1280, 800)).toEqual({ w: 600, h: 800 });
  });
  it('three 오프축 투영 행렬과 일치한다(오차 1e-6)', () => {
    const spec = fitCamera(430, 932);
    const cam = new PerspectiveCamera(spec.fovDeg, spec.aspect, 0.1, 50);
    cam.position.set(...spec.pos);
    cam.lookAt(...spec.target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const m = cam.projectionMatrix.elements;
    m[0] = m[0]! * spec.scale!;
    m[5] = m[5]! * spec.scale!;
    m[8] = -spec.shiftX!;
    m[9] = -spec.shiftY!;
    const proj = makeProjector(spec);
    for (const p of [[0, 0.3, 0], [1.1, 0.5, -0.55], [-0.75, 0.2, 3.5]] as const) {
      const ndc = new Vector3(...p).project(cam);
      const uv = proj.project(p)!;
      expect(uv.u).toBeCloseTo((ndc.x + 1) / 2, 6);
      expect(uv.v).toBeCloseTo((1 - ndc.y) / 2, 6);
    }
  });
  it('모든 화면 크기에서 anchor로 pick하면 같은 대상이 나온다', () => {
    const targets: PickTarget[] = [...HOLE_POS.map((_, index): PickTarget => ({ kind: 'hole', index })), { kind: 'tray', slot: 0 }, { kind: 'fune' }];
    for (const [cw, ch] of SIZES) {
      const { w, h } = canvasSize(cw, ch);
      const spec = fitCamera(w, h);
      const p = createScenePicker({ getBoundingClientRect: () => ({ left: 10, top: 5, width: w, height: h }) as DOMRect }, () => 6, () => spec);
      for (const t of targets) {
        const a = p.anchor(t)!;
        expect(p.pick(a.x, a.y)).toEqual(t);
      }
    }
  });
  it('cam을 생략한 picker는 canvas 크기로 계산한 fitCamera와 같은 좌표를 낸다(e2e 경로)', () => {
    const { w, h } = canvasSize(430, 932);
    const rect = { getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) as DOMRect };
    const a = createScenePicker(rect, () => 6).anchor({ kind: 'hole', index: 5 });
    const b = createScenePicker(rect, () => 6, fitCamera(w, h)).anchor({ kind: 'hole', index: 5 });
    expect(a).toEqual(b);
  });
});
