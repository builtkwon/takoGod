import { describe, expect, it } from 'vitest';
import { MAX_SEATS, PLATE_W, seatPositions, seatScale } from '../layout';
import { createScenePicker } from '../pick';
import { canvasSize, fitCamera } from '../fit';
import { makeProjector } from '../projector';

const HALF_W = 0.6; // 손님 모델 반쪽 폭(여유 포함).

describe('seatPositions', () => {
  it('1~4명이 가운데 기준 좌우 대칭이고, 이웃과 겹치지 않으며 카운터(±3) 안이다', () => {
    for (let n = 1; n <= MAX_SEATS; n++) {
      const p = seatPositions(n);
      expect(p).toHaveLength(n);
      expect(p[0]![0]).toBeCloseTo(-p[n - 1]![0], 9);
      for (let i = 1; i < n; i++) expect(p[i]![0] - p[i - 1]![0]).toBeGreaterThanOrEqual(2 * HALF_W * seatScale(n));
      expect(Math.abs(p[0]![0]) + HALF_W * seatScale(n)).toBeLessThanOrEqual(3);
    }
  });
  it('2명은 이전 배치(±1.5)와 같다', () => {
    expect(seatPositions(2).map((p) => p[0])).toEqual([-1.5, 1.5]);
  });
  it('4명 모두 모든 화면 크기에서 화면 안(좌우)에 들어온다', () => {
    for (const [cw, ch] of [[320, 568], [390, 844], [430, 932], [768, 1024], [844, 390]] as const) {
      const { w, h } = canvasSize(cw, ch);
      const proj = makeProjector(fitCamera(w, h));
      for (const [x, , z] of seatPositions(4)) {
        for (const dx of [-HALF_W * 0.8, HALF_W * 0.8]) {
          const uv = proj.project([x + dx, 2.0, z])!;
          expect(uv.u).toBeGreaterThanOrEqual(0);
          expect(uv.u).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(PLATE_W).toBeGreaterThan(0);
  });
});

describe('customer anchor with seatCount', () => {
  const rect = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) as DOMRect };
  it('자리 수가 바뀌면 같은 손님 자리의 anchor x도 새 배치를 따른다', () => {
    let n = 2;
    const p = createScenePicker(rect, () => 0, undefined, (id) => ['a', 'b', 'c', 'd'].indexOf(id), () => n);
    const two = p.anchor({ kind: 'customer', customerId: 'a' })!;
    n = 4;
    const four = p.anchor({ kind: 'customer', customerId: 'a' })!;
    expect(four.x).toBeGreaterThan(two.x - 200);
    expect(four.x).not.toBeCloseTo(two.x, 1);
    expect(p.anchor({ kind: 'customer', customerId: 'd' })).not.toBeNull();
    n = 2;
    expect(p.anchor({ kind: 'customer', customerId: 'd' })).toBeNull();
  });
});
