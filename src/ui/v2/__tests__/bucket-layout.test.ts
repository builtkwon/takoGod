// 통(버터·반죽)은 구이판 사각형과 겹치지 않는다. 구이판은 구멍 네 모서리 + 간격 60% 여백(mount.grillRect와 같은 계산).
import { describe, expect, it } from 'vitest';
import { overlaps, type Rect } from '../../layout';
import { BUCKET_MIN, bucketLayout } from '../bucket-layout';

/** 캔버스 가운데 칸에서 구멍 네 모서리가 (x0,y0)-(x1,y1)인 구이판 사각형(여백 포함). */
const grillOf = (xs: [number, number], ys: [number, number], padX: number, padY: number): Rect => ({
  x: xs[0] - padX,
  y: ys[0] - padY,
  w: xs[1] - xs[0] + 2 * padX,
  h: ys[1] - ys[0] + 2 * padY,
});

const cases = [
  // 화면 폭 320: 여백이 좁아 통을 트레이 줄 끝으로 옮긴다.
  { name: '320×568', col: { left: 0, width: 320 }, layerH: 568, grill: grillOf([60, 262], [215, 318], 29, 33), tray: { minX: 90, maxX: 228, y: 372 } },
  { name: '390×844', col: { left: 0, width: 390 }, layerH: 844, grill: grillOf([96, 296], [300, 420], 30, 36), tray: { minX: 120, maxX: 270, y: 480 } },
  // 1280×800: 캔버스는 340~940 가운데 칸.
  { name: '1280×800', col: { left: 340, width: 600 }, layerH: 800, grill: grillOf([470, 810], [250, 460], 36, 42), tray: { minX: 520, maxX: 770, y: 560 } },
];

describe('bucketLayout: 어떤 크기에서도 구이판과 겹치지 않는다', () => {
  for (const c of cases) {
    it(c.name, () => {
      const l = bucketLayout(c);
      for (const b of [l.margarine, l.batter]) {
        expect(overlaps(b, c.grill)).toBe(false);
        expect(b.w).toBeGreaterThanOrEqual(BUCKET_MIN);
        expect(b.h).toBeGreaterThanOrEqual(BUCKET_MIN);
        expect(b.x).toBeGreaterThanOrEqual(c.col.left);
        expect(b.x + b.w).toBeLessThanOrEqual(c.col.left + c.col.width);
      }
    });
  }
  it('1280×800: 좌우 여백에 64px 통이 구이판 세로 가운데에 놓인다', () => {
    const c = cases[2]!;
    const l = bucketLayout(c);
    expect(l.margarine).toMatchObject({ w: 64, x: 346 });
    expect(l.batter.x + l.batter.w).toBe(934);
    expect(l.margarine.y + 32).toBeCloseTo(c.grill.y + c.grill.h / 2);
  });
  it('320×568: 여백(약 49-12)이 44px보다 좁아 트레이 줄 양끝(구이판 아래)으로 간다', () => {
    const c = cases[0]!;
    const l = bucketLayout(c);
    expect(l.margarine.y).toBeGreaterThanOrEqual(c.grill.y + c.grill.h);
    expect(l.margarine.x).toBe(6);
    expect(l.batter.x + l.batter.w).toBe(314);
  });
  it('구이판 앵커가 없으면 옛 자리(가장자리, 세로 42%)', () => {
    const l = bucketLayout({ col: { left: 0, width: 390 }, layerH: 800, grill: null, tray: null });
    expect(l.margarine).toEqual({ x: 6, y: 336, w: 64, h: 64 });
    expect(l.batter.x).toBe(320);
  });
});
